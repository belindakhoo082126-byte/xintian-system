import { describe, expect, it } from "vitest";
import { groupVariantSummariesByProduct } from "../shared/variantSummaries";

describe("商品列表规格摘要", () => {
  it("按商品归集规格名称、库存与关键词，避免将不同商品的规格混在一起", () => {
    const grouped = groupVariantSummariesByProduct([
      { id: 1, productId: 2, name: "粉白色", keyword: "1", stockQuantity: 0, status: "active" },
      { id: 2, productId: 2, name: "白色", keyword: "2", stockQuantity: 3, status: "active" },
      { id: 3, productId: 3, name: "小盆", keyword: "S", stockQuantity: 1, status: "active" },
    ]);
    expect(grouped[2].map((variant) => variant.name)).toEqual(["粉白色", "白色"]);
    expect(grouped[2][1].stockQuantity).toBe(3);
    expect(grouped[3][0].keyword).toBe("S");
  });
});

