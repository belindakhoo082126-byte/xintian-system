import { describe, expect, it } from "vitest";
import { validateBatchInventoryAdjustmentDrafts } from "../shared/inventoryAdjustmentBatch";

describe("批量库存调整输入规则", () => {
  it("接受正负整数的多商品调整", () => {
    expect(validateBatchInventoryAdjustmentDrafts([
      { productId: 1, supplierId: 5, quantityChange: -2 },
      { productId: 2, supplierId: 5, quantityChange: 3 },
    ])).toBeNull();
  });

  it("拒绝空列表、零变动和同商品重复行", () => {
    expect(validateBatchInventoryAdjustmentDrafts([])).toBe("请至少添加一项库存调整");
    expect(validateBatchInventoryAdjustmentDrafts([{ productId: 1, supplierId: 5, quantityChange: 0 }])).toBe("每项库存变动必须为非零整数");
    expect(validateBatchInventoryAdjustmentDrafts([
      { productId: 1, supplierId: 5, quantityChange: -1 },
      { productId: 1, supplierId: 5, quantityChange: -1 },
    ])).toBe("同一商品请合并为一项库存调整");
  });
});
