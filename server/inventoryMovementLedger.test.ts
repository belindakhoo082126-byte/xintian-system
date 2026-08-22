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
