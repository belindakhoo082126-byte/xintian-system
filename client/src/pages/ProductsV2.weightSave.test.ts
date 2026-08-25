import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ProductsV2 商品重量保存", () => {
  it("空特价日期不应阻止商品重量提交", () => {
    const source = readFileSync(new URL("./ProductsV2.tsx", import.meta.url), "utf8");

    expect(source).toContain("if (form.specialPriceStartDate) data.specialPriceStartDate");
    expect(source).toContain("else delete data.specialPriceStartDate");
    expect(source).toContain("if (form.specialPriceEndDate) data.specialPriceEndDate");
    expect(source).toContain("else delete data.specialPriceEndDate");
    expect(source).toContain("weightKg: p.weightKg || \"\"");
  });
});
