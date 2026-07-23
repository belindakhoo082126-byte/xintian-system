import { Router, Request, Response } from "express";
import crypto from "crypto";
import { handleMessengerEvent, handlePageFeedEvent } from "./messenger";

const router = Router();

/**
 * Verify the webhook subscription with Facebook.
 * Facebook sends a GET request with hub.mode, hub.verify_token, and hub.challenge.
 * We must verify the token matches our FB_VERIFY_TOKEN and return the challenge.
 */
router.get("/webhook", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.FB_VERIFY_TOKEN) {
    console.log("[Facebook] Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    console.warn("[Facebook] Webhook verification failed", { mode, token });
    res.sendStatus(403);
  }
});

/**
 * Receive webhook events from Facebook.
 * This includes:
 * - Messenger messages (messages, messaging_postbacks, messaging_optins)
 * - Page feed events (comments, feed)
 * - Live video comments
 */
router.post("/webhook", (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = req.get("X-Hub-Signature-256");

  if (!rawBody || !verifyXHubSignature(rawBody, signature)) {
    console.warn("[Facebook] Rejected webhook with an invalid signature");
    res.sendStatus(403);
    return;
  }

  const body = req.body;

  // Verify this is from Facebook Page subscription
  if (body.object === "page") {
    for (const entry of body.entry || []) {
      // Handle Messenger events
      if (entry.messaging) {
        for (const event of entry.messaging) {
          handleMessengerEvent(event).catch(err =>
            console.error("[Facebook] Messenger event error:", err)
          );
        }
      }

      // Handle Page feed events (comments, posts)
      if (entry.changes) {
        for (const change of entry.changes) {
          handlePageFeedEvent(change, entry.id).catch(err =>
            console.error("[Facebook] Page feed event error:", err)
          );
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else if (body.object === "instagram") {
    // Future: Instagram integration
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

/**
 * Verify X-Hub-Signature-256 header for security.
 * This ensures the webhook request is genuinely from Facebook.
 */
export function verifyXHubSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
  if (!signature || !process.env.FB_APP_SECRET) return false;

  const expectedSignature = "sha256=" + crypto
    .createHmac("sha256", process.env.FB_APP_SECRET)
    .update(rawBody)
    .digest("hex");

  const receivedSignature = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (receivedSignature.length !== expectedSignatureBuffer.length) return false;

  return crypto.timingSafeEqual(receivedSignature, expectedSignatureBuffer);
}

export default router;
