export type PendingPackingSpecialOrder = {
  isSpecialOrder?: boolean | number | null;
  specialOrderType?: string | null;
  specialOrderStatus?: string | null;
  hasShippingReleaseApproval?: boolean;
};

export type PackingShippingControl = {
  mode: "allow" | "requires_release" | "partial_only" | "block";
  reason: "none" | "pending_refund" | "pending_shipping" | "waiting_restock" | "other_special";
};

/**
 * Pending special work stays visible for handover but does not always stop a
 * shipment. Refunds never block dispatch; a remittance difference waits for an
 * explicit staff release; and a waiting-restock item permits only partial
 * shipment of the other available order items.
 */
export function getPackingShippingControl(order: PendingPackingSpecialOrder): PackingShippingControl {
  if (!Boolean(order.isSpecialOrder) || String(order.specialOrderStatus || "").toLowerCase() !== "pending") {
    return { mode: "allow", reason: "none" };
  }
  switch (String(order.specialOrderType || "")) {
    case "pending_refund":
      return { mode: "allow", reason: "pending_refund" };
    case "pending_shipping":
      return order.hasShippingReleaseApproval
        ? { mode: "allow", reason: "pending_shipping" }
        : { mode: "requires_release", reason: "pending_shipping" };
    case "stock_exception":
      return { mode: "partial_only", reason: "waiting_restock" };
    default:
      return { mode: "block", reason: "other_special" };
  }
}

export function isPackingBlockedByPendingSpecialOrder(order: PendingPackingSpecialOrder): boolean {
  return getPackingShippingControl(order).mode === "block";
}
