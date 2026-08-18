export type BatchInventoryAdjustmentDraft = {
  productId: number;
  supplierId: number;
  quantityChange: number;
};

export function validateBatchInventoryAdjustmentDrafts(items: BatchInventoryAdjustmentDraft[]): string | null {
  if (items.length === 0) return "请至少添加一项库存调整";
  if (items.length > 50) return "单次最多调整 50 项商品";

  const productIds = new Set<number>();
  for (const item of items) {
    if (!Number.isInteger(item.productId) || item.productId <= 0) return "库存调整商品无效";
    if (!Number.isInteger(item.supplierId) || item.supplierId <= 0) return "库存调整厂家无效";
    if (!Number.isInteger(item.quantityChange) || item.quantityChange === 0) return "每项库存变动必须为非零整数";
    if (productIds.has(item.productId)) return "同一商品请合并为一项库存调整";
    productIds.add(item.productId);
  }
  return null;
}
