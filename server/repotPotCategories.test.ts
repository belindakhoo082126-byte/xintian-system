import { describe, expect, it } from "vitest";
import { isRepotPotCategoryName, isRepotPotItem } from "../shared/repotPotCategories";

describe("换盆花盆分类识别", () => {
  it.each(["陶瓷/紫砂盆", "懒人盆", "塑胶盆", "清货盆", "塑胶盆 ", "  陶瓷/紫砂盆  "])(
    "将正式花盆分类 %s 识别为花盆",
    (categoryNameZh) => {
      expect(isRepotPotCategoryName(categoryNameZh)).toBe(true);
    },
  );

  it("兼容旧isPot标记，并排除非花盆分类", () => {
    expect(isRepotPotItem({ isPot: true, categoryNameZh: "植物" })).toBe(true);
    expect(isRepotPotItem({ isPot: false, categoryNameZh: "种植介质" })).toBe(false);
  });
});
