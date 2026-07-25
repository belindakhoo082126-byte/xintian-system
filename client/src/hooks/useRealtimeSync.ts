import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

// ============================================================================
// Real-time Sync: SSE Subscription Hook
// ============================================================================
// This hook establishes a single SSE connection to /api/sync and listens
// for data-change events from the server. When an event arrives, it
// invalidates the corresponding React Query cache entries, triggering
// an immediate background refetch — so all open pages update instantly
// without manual refresh.
//
// Usage: mount once in App.tsx (inside QueryClientProvider)
//   useRealtimeSync();
// ============================================================================

// Map SSE category → React Query key prefix to invalidate
const CATEGORY_TO_QUERY_KEYS: Record<string, string[]> = {
  orders: ["orders", "orderItems", "orderRemarks", "orderExceptions", "specialOrders"],
  products: ["products", "productVariations", "variants", "productBundles"],
  customers: ["customers"],
  inventory: ["inventory", "products", "adjustments"],
  dashboard: ["dashboard", "stats", "followUp"],
  liveRooms: ["liveRooms", "liveOrderCaptures"],
  importBatches: ["importBatches", "importBatchItems"],
  notifications: ["notifications"],
  orderExceptions: ["orderExceptions", "orders"],
  specialOrders: ["specialOrders", "orders", "followUp"],
  membership: ["membership", "membershipReviews"],
  all: [], // Empty = invalidate everything
};

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    const connect = () => {
      if (!mounted) return;

      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const es = new EventSource("/api/sync");
      eventSourceRef.current = es;

      es.onopen = () => {
        // Connection established — invalidate all queries to get fresh data
        queryClient.invalidateQueries();
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data || !data.category) return;

          if (data.category === "all" || data.type === "connected") {
            // Invalidate everything
            queryClient.invalidateQueries();
            return;
          }

          // Get query key prefixes for this category
          const keyPrefixes = CATEGORY_TO_QUERY_KEYS[data.category];
          if (!keyPrefixes || keyPrefixes.length === 0) {
            // Unknown category — invalidate everything as fallback
            queryClient.invalidateQueries();
            return;
          }

          // Invalidate each matching query key prefix
          for (const prefix of keyPrefixes) {
            queryClient.invalidateQueries({ queryKey: [prefix] });
          }
        } catch {
          // Ignore parse errors (e.g. heartbeat comments)
        }
      };

      es.onerror = () => {
        // EventSource auto-reconnects, but if it fails repeatedly,
        // we manually reconnect after a delay
        es.close();
        eventSourceRef.current = null;

        if (mounted) {
          reconnectTimerRef.current = setTimeout(connect, 5000);
        }
      };
    };

    connect();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [queryClient]);
}
