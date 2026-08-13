import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { calculateOrderPriceBreakdown } from "../shared/orderPricing";

describe("特价商品订单入口分类", () => {
  const dbSource = fs.readFileSync(path.resolve(__dirname, "db.ts"), "utf8");

  it("统一金额口径将特价商品排除在 RM150 免邮门槛之外", () => {
    const breakdown = calculateOrderPriceBreakdown([
      { productType: "physical", quantity: 1, subtotal: "120.00", priceType: "retail" },
      { productType: "physical", quantity: 1, subtotal: "80.00", priceType: "special", originalUnitPrice: "100.00" },
    ]);

    expect(breakdown.physicalSubtotal).toBe(200);
    expect(breakdown.specialSubtotal).toBe(80);
    expect(breakdown.freeShippingEligibleSubtotal).toBe(120);
  });

  it("后台建单和商城结账都会以服务端商品设定覆盖客户端特价分类", () => {
    expect(dbSource).toContain("async function applyTrustedSpecialPriceSnapshots");
    expect(dbSource).toContain("await applyTrustedSpecialPriceSnapshots(db, data.items);");
    expect(dbSource).toContain("await applyTrustedSpecialPriceSnapshots(db, data.items, { useProductSpecialPrice: true });");
    expect(dbSource).toContain('priceType: item.isSpecial ? "special" : "retail"');
    expect(dbSource).toContain("originalUnitPrice: item.originalUnitPrice || null");
  });

  it("订单编辑新增商品同样刷新特价快照，再以该快照重算免邮资格", () => {
    expect(dbSource).toContain("const specialSnapshotCandidates: Array<SpecialPriceSnapshotItem");
    expect(dbSource).toContain("await applyTrustedSpecialPriceSnapshots(db, specialSnapshotCandidates);");
    expect(dbSource).toContain("candidate.source.priceType = candidate.priceType;");
    expect(dbSource).toContain("candidate.source.originalUnitPrice = candidate.originalUnitPrice;");
    expect(dbSource).toContain(".filter((item: any) => item.priceType === \"special\")");
    expect(dbSource).toContain("calculateWestMalaysiaShipping(totalWeight, eligibleSubtotal)");
  });

  it("只有商品明确启用特价且设有正数特价时才会写入特价快照", () => {
    expect(dbSource).toContain("Boolean(product?.isSpecial) && specialPrice > 0");
    expect(dbSource).toContain('item.priceType = isActiveSpecialPrice ? "special" : "retail"');
    expect(dbSource).toContain("item.originalUnitPrice = isActiveSpecialPrice");
  });
});
