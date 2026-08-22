export const LIVE_STOCK_DEDUCTION_REASONS = ["damaged", "scrap", "unhealthy", "other"] as const;

export type LiveStockDeductionReason = typeof LIVE_STOCK_DEDUCTION_REASONS[number];

/** Live room inventory may only be reduced; replenishment must use purchase receiving. */
export function toLiveStockDeduction(quantityToDeduct: number): number {
  const quantity = Number(quantityToDeduct);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("直播扣减数量必须为大于 0 的整数");
  }
  return -quantity;
}
