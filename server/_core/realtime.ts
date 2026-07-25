import { Response } from "express";

// ============================================================================
// Real-time Sync: Server-Sent Events (SSE) Broadcast System
// ============================================================================
// This module provides a lightweight pub/sub layer that pushes data-change
// events to all connected browser clients via SSE. When any db.ts mutation
// function calls `broadcastChange(category)`, every connected client receives
// the event and invalidates the corresponding React Query cache entries,
// causing an immediate background refetch.
//
// Architecture:
//   db.ts mutation → broadcastChange("orders") → SSE push →
//   frontend useRealtimeSync → queryClient.invalidateQueries(["orders"])
//
// SSE is chosen over WebSocket because:
//  1. One-way server→client is sufficient (mutations go via tRPC HTTP)
//  2. Native browser support via EventSource — no client library needed
//  3. Auto-reconnects on connection drop (built into EventSource)
//  4. Works through proxies and load balancers with standard HTTP headers
//  5. No upgrade handshake — simpler than WebSocket for our use case
// ============================================================================

export type SyncCategory =
  | "orders"
  | "products"
  | "customers"
  | "inventory"
  | "dashboard"
  | "liveRooms"
  | "importBatches"
  | "notifications"
  | "orderExceptions"
  | "specialOrders"
  | "membership"
  | "liveAiFlows"
  | "all";

interface SyncEvent {
  category: SyncCategory;
  timestamp: number;
  // Optional: specific entity ID for targeted invalidation
  entityId?: number | string;
}

type ClientSet = Set<Response>;

// Map of category → connected SSE clients
const clientsByCategory = new Map<SyncCategory, ClientSet>();

// Also maintain a global client set for "all" events
const globalClients = new Set<Response>();

// Heartbeat interval to keep SSE connections alive through proxies
let heartbeatInterval: NodeJS.Timeout | null = null;

function ensureHeartbeat() {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    // Send heartbeat to all connected clients
    for (const res of Array.from(globalClients)) {
      try {
        res.write(`:heartbeat ${now}\n\n`);
      } catch {
        // Client disconnected, will be cleaned up on next event
      }
    }
  }, 30 * 1000); // 30 second heartbeat
}

/**
 * Register a new SSE client connection.
 * The client will receive change events for all categories.
 */
export function addSSEClient(res: Response): () => void {
  globalClients.add(res);

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // Disable Nginx buffering
  });

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`);

  ensureHeartbeat();

  // Return cleanup function
  return () => {
    globalClients.delete(res);
    for (const [, clientSet] of Array.from(clientsByCategory)) {
      clientSet.delete(res);
    }
  };
}

/**
 * Broadcast a data-change event to all connected clients.
 * Called from db.ts mutation functions after successful writes.
 *
 * @param category - Which data category changed (e.g. "orders", "products")
 * @param entityId - Optional specific entity ID that changed
 */
export function broadcastChange(category: SyncCategory, entityId?: number | string) {
  const event: SyncEvent = {
    category,
    timestamp: Date.now(),
    entityId,
  };

  const data = `data: ${JSON.stringify(event)}\n\n`;
  let sentCount = 0;

    // Send to all global clients
  for (const res of Array.from(globalClients)) {
    try {
      res.write(data);
      sentCount++;
    } catch {
      // Client disconnected, remove from all sets
      globalClients.delete(res);
      for (const [, clientSet] of Array.from(clientsByCategory)) {
        clientSet.delete(res);
      }
    }
  }

  if (sentCount > 0) {
    // Log only in development to avoid noise in production
    if (process.env.NODE_ENV === "development") {
      console.log(`[Realtime] Broadcast "${category}" to ${sentCount} client(s)`);
    }
  }
}

/**
 * Broadcast multiple categories at once.
 * Useful when a single operation affects multiple data types
 * (e.g. creating an order also affects inventory and dashboard stats).
 */
export function broadcastChanges(categories: SyncCategory[]) {
  for (const category of categories) {
    broadcastChange(category);
  }
}
