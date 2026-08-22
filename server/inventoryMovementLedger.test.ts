import { describe, expect, it } from "vitest";
import { buildInventoryMovementRecord } from "../shared/inventoryMovementLedger";

describe("统一库存流水审计规则", () => {
  it("进货收货可记录规格库存的前后数量及进货单关联", () => {
    expect(buildInventoryMovementRecord({
      productId: 12,
      variantId: 23,
      movementType: "purchase_receipt",
      quantityChange: 10,
      stockBefore: 20,
      stockAfter: 30,
      referenceType: "purchase_order",
      referenceId: 91,
    })).toMatchObject({ variantId: 23, stockAfter: 30, referenceId: 91 });
  });

  it("组合包组件消耗使用负数并保留组合包关联", () => {
    expect(buildInventoryMovementRecord({
      productId: 7,
      movementType: "bundle_component_deduct",
      quantityChange: -10,
      stockBefore: 30,
      stockAfter: 20,
      referenceType: "product_bundle",
      referenceId: 5,
    })).toMatchObject({ quantityChange: -10, stockBefore: 30, stockAfter: 20 });
  });

  it("直播库存调整保留规格、前后数量与直播房关联", () => {
    expect(buildInventoryMovementRecord({
      productId: 9,
      variantId: 41,
      movementType: "live_stock_adjustment",
      quantityChange: -2,
      stockBefore: 10,
      stockAfter: 8,
      referenceType: "live_room",
      referenceId: 3,
      reason: "直播库存调整｜原因：破损",
    })).toMatchObject({ variantId: 41, stockAfter: 8, referenceType: "live_room" });
  });

  it("拒绝无法由前后库存复算的流水", () => {
    expect(() => buildInventoryMovementRecord({
      productId: 7,
      movementType: "bundle_component_return",
      quantityChange: 4,
      stockBefore: 12,
      stockAfter: 15,
      referenceType: "product_bundle",
      referenceId: 5,
    })).toThrow("前后数量与变动数量不一致");
  });
});
