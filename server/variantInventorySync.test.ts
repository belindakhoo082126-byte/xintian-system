import { describe, expect, it } from "vitest";
import { sumVariantStock } from "../shared/variantInventorySync";

describe("多规格库存汇总", () => {
  it("规格扣减后商品总库存等于全部规格库存之和", () => {
    expect(sumVariantStock([9, 10, 10, 10])).toBe(39);
  });

  it("不会把负值规格计入商品总库存", () => {
    expect(sumVariantStock([9, -2, undefined])).toBe(9);
  });
});
