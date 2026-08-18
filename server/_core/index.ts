import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { storagePut } from "../storage";
import { addSSEClient } from "./realtime";

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
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // 上传文件存储于项目对象存储；数据库仅保存文件地址或键值。
  app.post("/api/upload", async (req, res) => {
    try {
      const { file, filename, contentType } = req.body as {
        file?: string;
        filename?: string;
        contentType?: string;
      };
      if (!file) return res.status(400).json({ error: "No file provided" });

      const matches = file.match(/^data:(.+);base64,(.*)$/);
      if (!matches) return res.status(400).json({ error: "Invalid file format" });

      const mimeType = contentType || matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      const extension = mimeType.split("/")[1]?.split(";")[0] || "bin";
      const safeName = (filename || "upload").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}.${extension}`;
      const result = await storagePut(key, buffer, mimeType);
      return res.json({ url: result.url, key: result.key });
    } catch (error) {
      console.error("[Upload] Error", error);
      return res.status(500).json({ error: "Upload failed" });
    }
  });

  // 仅推送应用内数据变更事件；不依赖外部服务配置。
  app.get("/api/sync", (req, res) => {
    const cleanup = addSSEClient(res);
    req.on("close", cleanup);
  });

  // Meta/Facebook Webhook 与任何周期任务均在用户明确授权并完成配置前不注册。
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port} instead`);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
