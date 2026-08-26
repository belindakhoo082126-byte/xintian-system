import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Dashboard 库存预警跳转", () => {
  it("将Dashboard十件库存预警阈值同步传给商品管理筛选", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
    const products = readFileSync(resolve(process.cwd(), "client/src/pages/ProductsV2.tsx"), "utf8");

    expect(dashboard).toContain('/products?stock=low&stockThreshold=10');
    expect(products).toContain('get("stockThreshold")');
    expect(products).toContain('String(urlStockThreshold)');
  });
});
