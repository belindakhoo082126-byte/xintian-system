export function calculateActualGrossProfit(input: {
  salesRevenue: number;
  productCost: number;
  shippingDiff: number;
  scrapLoss: number;
  refundLoss: number;
  inventoryAdjustmentLoss: number;
}): number {
  return input.salesRevenue - input.productCost + input.shippingDiff - input.scrapLoss - input.refundLoss - input.inventoryAdjustmentLoss;
}
