import { describe, expect, it } from "vitest";
import { interpolateTranslation } from "./I18nContext";

describe("interpolateTranslation", () => {
  it("replaces named parameters in translated business text", () => {
    expect(interpolateTranslation("共 {count} 单，第 {page} / {totalPages} 页", {
      count: 12,
      page: 1,
      totalPages: 3,
    })).toBe("共 12 单，第 1 / 3 页");
  });

  it("keeps an unmatched placeholder visible instead of hiding data", () => {
    expect(interpolateTranslation("已复制 {label}，共 {count} 项", { label: "订单号" }))
      .toBe("已复制 订单号，共 {count} 项");
  });

  it("returns the original text when no parameters are supplied", () => {
    expect(interpolateTranslation("Loading...")).toBe("Loading...");
  });
});
