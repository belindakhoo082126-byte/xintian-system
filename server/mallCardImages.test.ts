import { describe, expect, it } from "vitest";
import { getMallCardImageUrls } from "../shared/mallCardImages";

describe("商城商品卡多图", () => {
  it("保留封面图并展示其余商品图片，同时排除重复和空地址", () => {
    expect(getMallCardImageUrls("/cover.jpg", ["/cover.jpg", "/second.jpg", "", "/third.jpg"])).toEqual([
      "/cover.jpg",
      "/second.jpg",
      "/third.jpg",
    ]);
  });
});

