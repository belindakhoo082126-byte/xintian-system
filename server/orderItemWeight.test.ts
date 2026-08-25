import { describe, expect, it } from "vitest";
import { calculateOrderItemWeight, normalizeOrderWeightKg, resolveOrderItemUnitWeight } from "../shared/orderItemWeight";

describe("订单规格重量快照规则", () => {
  it("所选规格重量优先于商品默认重量", () => {
    expect(resolveOrderItemUnitWeight({ productType: "physical", variantWeight: "8.40", productWeight: "2.00" })).toBe(8.4);
  });

  it("未填写规格重量时回退到商品默认重量，虚拟商品不计重量", () => {
    expect(resolveOrderItemUnitWeight({ productType: "physical", variantWeight: null, productWeight: "1.25" })).toBe(1.25);
    expect(resolveOrderItemUnitWeight({ productType: "membership", variantWeight: "9", productWeight: "2" })).toBe(0);
  });

  it("按订单项数量汇总重量，并兼容未填写重量的旧资料", () => {
    expect(calculateOrderItemWeight([
      { quantity: 2, unitWeight: "8.4" },
      { quantity: 3, unitWeight: null },
    ])).toBe(18.3);
  });

  it("将早期写入重量字段的克数安全归一化为公斤", () => {
    expect(normalizeOrderWeightKg("1000.00")).toBe(1);
    expect(resolveOrderItemUnitWeight({ productType: "physical", productWeight: "1000.00" })).toBe(1);
    expect(calculateOrderItemWeight([{ quantity: 10, unitWeight: "1000.00" }])).toBe(10);
  });
});
