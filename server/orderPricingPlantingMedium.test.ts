import { describe, expect, it } from "vitest";
import { calculateOrderPriceBreakdown } from "../shared/orderPricing";

const item = (categoryNameZh: string, subtotal: number, priceType = "retail") => ({
  productType: "physical" as const,
  categoryNameZh,
  priceType,
  quantity: 1,
  subtotal,
});

describe("植物与种植介质免邮门槛", () => {
  it("订单含植物时，种植介质不计入RM150门槛", () => {
    const breakdown = calculateOrderPriceBreakdown([
      item("果树", 120),
      item("种植介质", 60),
    ]);
    expect(breakdown.freeShippingEligibleSubtotal).toBe(120);
  });

  it("订单没有植物时，肥料与种植介质可以合并计入RM150门槛", () => {
    const breakdown = calculateOrderPriceBreakdown([
      item("种植介质", 80),
      item("肥料/杀虫剂", 70),
    ]);
    expect(breakdown.freeShippingEligibleSubtotal).toBe(150);
  });

  it("即使订单没有植物，特价商品仍不计入免邮门槛", () => {
    const breakdown = calculateOrderPriceBreakdown([
      item("种植介质", 100),
      item("肥料", 80, "special"),
    ]);
    expect(breakdown.freeShippingEligibleSubtotal).toBe(100);
  });
});
