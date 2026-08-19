import { describe, expect, it } from "vitest";
import { getVariantStockQuantity } from "../shared/variantStockDisplay";

describe("规格库存展示", () => {
  it("显示规格库存数值，并在缺失数据时安全回退为零", () => {
    expect(getVariantStockQuantity(12)).toBe(12);
    expect(getVariantStockQuantity("3")).toBe(3);
    expect(getVariantStockQuantity(undefined)).toBe(0);
  });
});

