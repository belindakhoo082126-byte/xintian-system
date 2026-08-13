import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { calculateOrderPriceBreakdown } from "../shared/orderPricing";

const dbSource = fs.readFileSync(path.resolve(process.cwd(), "server/db.ts"), "utf8");

describe("订单金额与V2.2免邮资格", () => {
  it("仅以非特价的实体商品金额计算RM150免邮资格", () => {
    const breakdown = calculateOrderPriceBreakdown([
      { productType: "physical", priceType: "retail", quantity: 1, subtotal: "140.00" },
      { productType: "physical", priceType: "special", quantity: 1, subtotal: "80.00", originalUnitPrice: "100.00" },
      { productType: "membership", quantity: 1, subtotal: "50.00" },
      { productType: "gift", quantity: 1, subtotal: "0.00" },
    ]);

    expect(breakdown).toMatchObject({
      physicalSubtotal: 220,
      membershipSubtotal: 50,
      specialSubtotal: 80,
      originalSpecialSubtotal: 100,
      freeShippingEligibleSubtotal: 140,
    });
  });

  it("全单折扣最多扣减可计入免邮的普通实体商品", () => {
    const breakdown = calculateOrderPriceBreakdown([
      { productType: "physical", priceType: "retail", subtotal: "160.00" },
      { productType: "physical", priceType: "special", subtotal: "70.00" },
      { productType: "membership", subtotal: "50.00" },
    ], { promotionDiscount: "15.00", discountAmount: "10.00" });

    expect(breakdown.freeShippingEligibleSubtotal).toBe(135);
  });

  it("在新建订单、后台加商品与商城加单三处复用同一资格计算", () => {
    expect(dbSource).toContain('import { calculateOrderPriceBreakdown } from "../shared/orderPricing"');
    expect((dbSource.match(/calculateOrderPriceBreakdown\(/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
