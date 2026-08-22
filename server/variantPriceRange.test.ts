import { describe, expect, it } from "vitest";
import { formatVariantPriceRange, getActiveVariantPriceRange } from "../shared/variantPriceRange";

describe("多规格售价区间", () => {
  it("汇总启用规格的最低与最高售价", () => {
    expect(getActiveVariantPriceRange([
      { sellingPrice: "17.00", status: "active" },
      { sellingPrice: "7.00", status: "active" },
      { sellingPrice: "99.00", status: "hidden" },
    ])).toEqual({ min: 7, max: 17 });
  });

  it("格式化不同规格价格为用户可读的RM7–17", () => {
    expect(formatVariantPriceRange([
      { sellingPrice: "17.00", status: "active" },
      { sellingPrice: "7.00", status: "active" },
    ], "0")).toBe("RM 7–17");
  });

  it("没有启用规格价格时回退商品级售价", () => {
    expect(formatVariantPriceRange([{ sellingPrice: null, status: "inactive" }], "18.50")).toBe("RM 18.50");
  });
});
