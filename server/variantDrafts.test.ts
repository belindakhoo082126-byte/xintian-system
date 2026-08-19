import { describe, expect, it } from "vitest";
import { hasDuplicateDraftVariantKeyword, hasRepeatedVariantKeyword } from "../shared/variantDrafts";

describe("新增商品的草稿规格", () => {
  it("在保存商品前阻止同一规格关键词重复，并允许编辑自身", () => {
    const drafts = [{ draftId: "draft-1", keyword: "PINK" }];
    expect(hasDuplicateDraftVariantKeyword(drafts, " pink ")).toBe(true);
    expect(hasDuplicateDraftVariantKeyword(drafts, "pink", "draft-1")).toBe(false);
    expect(hasDuplicateDraftVariantKeyword(drafts, "WHITE")).toBe(false);
  });

  it("在服务端最终创建前识别大小写或空白差异造成的重复规格关键词", () => {
    expect(hasRepeatedVariantKeyword(["PINK", " pink "])).toBe(true);
    expect(hasRepeatedVariantKeyword(["PINK", "WHITE"])).toBe(false);
  });
});

