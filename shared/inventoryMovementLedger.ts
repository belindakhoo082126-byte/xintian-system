export type InventoryMovementType =
  | "purchase_receipt"
  | "bundle_component_deduct"
  | "bundle_component_return"
  | "manual_adjustment"
  | "live_stock_adjustment";

export type InventoryMovementDraft = {
  productId: number;
  variantId?: number | null;
  movementType: InventoryMovementType;
  quantityChange: number;
  stockBefore: number;
  stockAfter: number;
  referenceType?: string | null;
  referenceId?: number | null;
  reason?: string | null;
  operator?: string | null;
};

/**
 * 建立写入数据库前的库存流水。每一行都必须可由“变动前 + 变动数量 = 变动后”复算，
 * 否则拒绝写入，以免产生无法追溯的审计记录。
 */
export function buildInventoryMovementRecord(input: InventoryMovementDraft): InventoryMovementDraft {
  const numbers = [input.productId, input.quantityChange, input.stockBefore, input.stockAfter];
  if (!numbers.every(Number.isFinite) || !Number.isInteger(input.productId)) {
    throw new Error("库存流水包含无效数值");
  }
  if (input.quantityChange === 0) {
    throw new Error("库存流水变动数量不可为 0");
  }
  if (input.stockAfter !== input.stockBefore + input.quantityChange) {
    throw new Error("库存流水前后数量与变动数量不一致");
  }
  if ((input.referenceType && !input.referenceId) || (!input.referenceType && input.referenceId)) {
    throw new Error("库存流水关联单据类型与编号必须同时提供");
  }
  return input;
}
