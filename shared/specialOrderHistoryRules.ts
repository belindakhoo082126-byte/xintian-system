export type SpecialOrderQueryMode = "current" | "resolved_history";

/**
 * Pending special work is represented by the order's current marker. Once all
 * work is resolved that marker is deliberately cleared, so resolved history
 * must instead be read from order_special_statuses.
 */
export function getSpecialOrderQueryMode(input: {
  isSpecialOrder?: boolean;
  specialOrderStatus?: string;
}): SpecialOrderQueryMode {
  return input.isSpecialOrder === true && input.specialOrderStatus === "resolved"
    ? "resolved_history"
    : "current";
}

/**
 * A resolved special-status row is the primary audit record for what was
 * actually handled. A pending refund has not yet written its actual refunded
 * amount, so it must display the refund-management requested amount first.
 * Older rows may have been migrated without an amount, so only then may the
 * UI fall back to the order's retained shipping difference.
 */
export function getSpecialOrderDisplayAmount(input: {
  historyAmount?: number | string | null;
  pendingRefundRequestedAmount?: number | string | null;
  shippingDifference?: number | string | null;
}): number {
  const historyAmount = Math.abs(Number(input.historyAmount ?? 0));
  if (historyAmount > 0.01) return historyAmount;
  const pendingRefundRequestedAmount = Math.abs(Number(input.pendingRefundRequestedAmount ?? 0));
  if (pendingRefundRequestedAmount > 0.01) return pendingRefundRequestedAmount;
  return Math.abs(Number(input.shippingDifference ?? 0));
}

export function getRefundMethodLabel(method?: string | null): string | null {
  const normalized = String(method || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    credit: "Credit",
    cash: "Cash",
    tng: "TNG",
    touch_n_go: "TNG",
    bank_transfer: "银行转账",
    online_transfer: "银行转账",
  };
  return labels[normalized] || null;
}
