import { describe, expect, it } from "vitest";
import { getMallDetailMainImage } from "../shared/mallVariantImage";

describe("商城规格图片同步", () => {
  it("选择有图片的规格时优先显示该规格图片，否则回退商品主图", () => {
    expect(getMallDetailMainImage("/product.jpg", "/variant.jpg")).toBe("/variant.jpg");
    expect(getMallDetailMainImage("/product.jpg", "")).toBe("/product.jpg");
    expect(getMallDetailMainImage(undefined, undefined)).toBe("");
  });
});

