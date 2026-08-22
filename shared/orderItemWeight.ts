export type OrderWeightSource = {
  productType?: "physical" | "gift" | "membership" | string | null;
  variantWeight?: string | number | null;
  productWeight?: string | number | null;
};

function positiveWeight(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * 订单项保存为重量快照：已选规格优先，其次商品默认重量；为兼容未填写重量的旧资料，
 * 实体商品与赠品沿用旧有的 0.5kg 默认值，虚拟商品为 0kg。
 */
export function resolveOrderItemUnitWeight(source: OrderWeightSource): number {
  if (source.productType === "membership") return 0;
  return positiveWeight(source.variantWeight)
    ?? positiveWeight(source.productWeight)
    ?? 0.5;
}

export function calculateOrderItemWeight(items: Array<{ quantity: number; unitWeight?: string | number | null }>) {
  return items.reduce((total, item) => total + resolveOrderItemUnitWeight({ productWeight: item.unitWeight }) * Number(item.quantity || 0), 0);
}
