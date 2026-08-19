import { describe, expect, it } from "vitest";
import { normalizeVariantDecimal } from "../shared/variantDecimalValues";

describe("规格价格持久化", () => {
  it("将空价格归一化为 NULL，以表示继承商品价格而不是写入非法空字符串", () => {
    expect(normalizeVariantDecimal("")).toBeNull();
    expect(normalizeVariantDecimal("   ")).toBeNull();
    expect(normalizeVariantDecimal(undefined)).toBeNull();
    expect(normalizeVariantDecimal("17.00")).toBe("17.00");
  });
});

