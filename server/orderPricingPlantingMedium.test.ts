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
    expect(breakdown.blocksFreeShippingPlantingMediumCombination).toBe(true);
  });

  it("植物与种植介质组合即使普通商品达到RM150，仍必须阻止免邮结账", () => {
    const breakdown = calculateOrderPriceBreakdown([
      item("花类", 170),
      item("种植介质", 21),
      item("肥料/杀虫剂", 30),
    ]);
    expect(breakdown.freeShippingEligibleSubtotal).toBe(200);
    expect(breakdown.blocksFreeShippingPlantingMediumCombination).toBe(true);
  });

  it("订单没有植物时，肥料与种植介质可以合并计入RM150门槛", () => {
    const breakdown = calculateOrderPriceBreakdown([
      item("种植介质", 80),
      item("肥料/杀虫剂", 70),
    ]);
    expect(breakdown.freeShippingEligibleSubtotal).toBe(150);
    expect(breakdown.blocksFreeShippingPlantingMediumCombination).toBe(false);
  });

  it("即使订单没有植物，特价商品仍不计入免邮门槛", () => {
    const breakdown = calculateOrderPriceBreakdown([
      item("种植介质", 100),
      item("肥料", 80, "special"),
    ]);
    expect(breakdown.freeShippingEligibleSubtotal).toBe(100);
  });

  it("植物与种植介质同单但合资格普通商品未满RM150时，只按一般运费计算而不阻止结账", () => {
    const breakdown = calculateOrderPriceBreakdown([
      item("花类", 140),
      item("种植介质", 100),
      item("肥料", 50, "special"),
    ]);
    expect(breakdown.blocksFreeShippingPlantingMediumCombination).toBe(true);
    expect(breakdown.freeShippingEligibleSubtotal).toBe(140);
    expect(breakdown.freeShippingEligibleSubtotal).toBeLessThan(150);
  });
});
