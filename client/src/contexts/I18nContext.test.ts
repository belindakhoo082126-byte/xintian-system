import { describe, expect, it } from "vitest";
import { interpolateTranslation, resolveTranslation } from "./I18nContext";

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

describe("resolveTranslation", () => {
  it("returns the English value for shared navigation and workflow labels", () => {
    expect(resolveTranslation("nav.paymentSettings", "en")).toBe("Payment Settings");
    expect(resolveTranslation("nav.shippingRules", "en")).toBe("Shipping Rules");
    expect(resolveTranslation("orders.sendCheckoutMessenger", "en")).toBe("Send Checkout to Messenger");
  });

  it("keeps the Chinese source label and safely falls back for unknown keys", () => {
    expect(resolveTranslation("nav.paymentSettings", "zh")).toBe("付款设定");
    expect(resolveTranslation("orders.sendCheckoutFailed", "en", { message: "Network error" })).toBe("Send failed: Network error");
    expect(resolveTranslation("unknown.translation.key", "en")).toBe("unknown.translation.key");
  });
});
