import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { getSessionCookieOptions } from "./cookies";
import { COOKIE_NAME } from "@shared/const";

const QA_SESSION_MS = 60 * 60 * 1000;
import { registerStorageProxy } from "./storageProxy";
import { storagePut } from "../storage";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import facebookWebhook from "../facebook";
import { addSSEClient } from "./realtime";
import { sdk } from "./sdk";
import * as db from "../db";
import { sendTextMessage } from "../messenger";
import { runMarketingAutomationHeartbeat } from "../marketingAutomationService";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads. Preserve the
  // exact Facebook webhook payload before JSON parsing so its HMAC can be checked.
  app.use(express.json({
    limit: "50mb",
    verify: (req, _res, buffer) => {
      if (req.url?.startsWith("/api/facebook/webhook")) {
        (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      }
    },
  }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // SAT-only: development QA sessions, never registered in production.
  if (process.env.NODE_ENV === "development") {
    app.get("/__qa/login/:role", async (req, res) => {
      const role = req.params.role === "admin" ? "admin" : "user";
      const openId = `qa-sat-${role}`;
      const name = role === "admin" ? "SAT Admin" : "SAT Shipping Staff";
      try {
        await db.upsertUser({
          openId,
          name,
          loginMethod: "qa-sat",
          role,
          lastSignedIn: new Date(),
        });
        const sessionToken = await sdk.createSessionToken(openId, {
          name,
          expiresInMs: QA_SESSION_MS,
        });
        res.cookie(COOKIE_NAME, sessionToken, {
          ...getSessionCookieOptions(req),
          maxAge: QA_SESSION_MS,
        });
        res.redirect(302, "/");
      } catch (error) {
        console.error("[SAT] Failed to create QA session", error);
        res.status(500).json({ error: "Unable to create development QA session" });
      }
    });
  }
  // File upload endpoint (for payment receipts, product images, etc.)
  app.post("/api/upload", async (req, res) => {
    try {
      const { file, filename, contentType } = req.body;
      if (!file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      // file is base64 data URL: data:image/png;base64,xxxx
      const matches = file.match(/^data:(.+);base64,(.*)$/);
      if (!matches) {
        res.status(400).json({ error: "Invalid file format" });
        return;
      }
      const ct = contentType || matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      const ext = ct.split("/")[1]?.split(";")[0] || "png";
      const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const result = await storagePut(key, buffer, ct);
      res.json({ url: result.url, key: result.key });
    } catch (err: any) {
      console.error("[Upload] Error:", err);
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  });

  // V1.1: Scheduled task endpoints (Heartbeat cron callbacks)
  app.post("/api/scheduled/auto-complete", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      const result = await db.autoCompleteShippedOrders();
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message, stack: err.stack, timestamp: new Date().toISOString() });
    }
  });

  app.post("/api/scheduled/flow-reminder", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      const pending = await db.getPendingFlowReminders();
      let reminded = 0;
      let failed = 0;
      for (const review of pending) {
        try {
          // Get order and customer to find messenger PSID
          const order = await db.getOrderById(review.orderId);
          if (!order) { failed++; continue; }
          const customer = await db.getCustomerById(order.customerId);
          if (!customer?.messengerId) { failed++; continue; }
          // Send reminder message via Messenger
          await sendTextMessage(
            customer.messengerId,
            "温馨提醒：您尚未点击进入会员系统链接，请尽快点击完成注册。如有疑问请联系客服。"
          );
          await db.markFlowReminderSent(review.id);
          reminded++;
        } catch (e) {
          failed++;
        }
      }
      res.json({ ok: true, checked: pending.length, reminded, failed });
    } catch (err: any) {
      res.status(500).json({ error: err.message, stack: err.stack, timestamp: new Date().toISOString() });
    }
  });

  // AI Log auto-cleanup (daily cron)
  app.post("/api/scheduled/ai-log-cleanup", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      const deleted = await db.cleanupOldAiLogs();
      res.json({ ok: true, deleted, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ error: err.message, timestamp: new Date().toISOString() });
    }
  });

  // AI Test run auto-cleanup (daily cron, 180-day retention)
  app.post("/api/scheduled/ai-test-cleanup", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      const deleted = await db.cleanupOldTestRuns();
      res.json({ ok: true, deleted, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ error: err.message, timestamp: new Date().toISOString() });
    }
  });

  // Marketing automation runs only for the stored rule bound to the
  // authenticated Heartbeat task UID; request payloads are never trusted.
  app.post("/api/scheduled/marketing-automation", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      res.json(await runMarketingAutomationHeartbeat(user.taskUid));
    } catch (err: any) {
      res.status(500).json({
        error: err.message || "营销自动消息执行失败",
        stack: err.stack,
        context: { url: req.originalUrl },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // CN 汇款期限巡检：由项目级计划任务触发。业务处理本身可重复执行，
  // 因此平台重试不会造成重复取消或重复释放库存。
  app.post("/api/scheduled/cn-payment-expiry", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const result = await db.processExpiredCNOrders();
      res.json({ ok: true, taskUid: user.taskUid, ...result, timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || "CN 汇款期限巡检失败",
        stack: err.stack,
        context: { url: req.originalUrl },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Real-time sync: Server-Sent Events endpoint
  app.get("/api/sync", (req, res) => {
    const cleanup = addSSEClient(res);
    req.on("close", cleanup);
  });

  // Facebook Webhook routes (must be before tRPC to avoid body parsing conflicts)
  app.use("/api/facebook", facebookWebhook);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
