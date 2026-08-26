import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

describe("虚拟交付下单选择规则", () => {
  it("单一会员建立为直接下单，多配套与材料包继续保留规格模式", () => {
    expect(dbSource).toContain('productMode: data.deliveryType === "membership" && packages.length === 1 ? "simple" : "variant"');
  });

  it("订单搜索同时识别当前variants表的配套名称与关键词", () => {
    expect(dbSource).toContain("const variantMatches = await db.select({ productId: variants.productId })");
    expect(dbSource).toContain("like(variants.name, searchTerm)");
    expect(dbSource).toContain("like(variants.keyword, searchTerm)");
  });
});
