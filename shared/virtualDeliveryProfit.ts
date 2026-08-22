export type VirtualDeliveryProfitInput = {
  quantity: number;
  subtotal: string | number;
  itemDiscount?: string | number | null;
  marketingDiscount?: string | number | null;
  contentCostPerUnit: string | number;
};

function money(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Returns immutable per-order-item figures used by the manual delivery queue and reports. */
export function calculateVirtualDeliveryProfit(input: VirtualDeliveryProfitInput) {
  const quantity = Math.max(0, Math.floor(input.quantity || 0));
  const revenueNet = Math.max(0, money(input.subtotal) - money(input.itemDiscount) - money(input.marketingDiscount));
  const contentCost = Math.max(0, quantity * money(input.contentCostPerUnit));
  return {
    revenueNet: revenueNet.toFixed(2),
    contentCost: contentCost.toFixed(2),
    profitAmount: (revenueNet - contentCost).toFixed(2),
  };
}
