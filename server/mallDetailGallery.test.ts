import { describe, expect, it } from "vitest";
import { getMallDetailDisplayImage, getMallDetailGalleryImages } from "../shared/mallDetailGallery";

describe("商城详情图集", () => {
  it("读取公开图集的 url 字段并兼容历史 imageUrl 字段", () => {
    expect(getMallDetailGalleryImages([{ id: 1, url: "/one.jpg" }, { id: 2, imageUrl: "/two.jpg" }])).toEqual([
      { id: 1, url: "/one.jpg" },
      { id: 2, url: "/two.jpg" },
    ]);
  });

  it("缩略图可切换主图，已选规格图片仍拥有最高优先级", () => {
    expect(getMallDetailDisplayImage("/cover.jpg", "/gallery.jpg", undefined)).toBe("/gallery.jpg");
    expect(getMallDetailDisplayImage("/cover.jpg", "/gallery.jpg", "/variant.jpg")).toBe("/variant.jpg");
  });
});

