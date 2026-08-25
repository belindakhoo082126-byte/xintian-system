import { describe, expect, it } from "vitest";
import { resolveManualOrderVariantPrice } from "../shared/manualOrderVariantPricing";

describe("手动订单规格价格", () => {
  it("零售订单带入所选规格的售价，而不是商品默认价", () => {
    const price = resolveManualOrderVariantPrice(
      { sellingPrice: "17.00", isSpecial: false },
      { sellingPrice: "21.00", weight: "1.20", keyword: "AS2" },
      "retail",
    );

    expect(price).toEqual({ unitPrice: "21.00", originalUnitPrice: undefined, priceType: "retail" });
  });

  it("商品级有效特价保留所选规格作为原价快照", () => {
    const price = resolveManualOrderVariantPrice(
      { sellingPrice: "17.00", specialPrice: "15.00", isSpecial: true },
      { sellingPrice: "21.00" },
      "retail",
    );

    expect(price).toEqual({ unitPrice: "15.00", originalUnitPrice: "21.00", priceType: "special" });
  });
});
