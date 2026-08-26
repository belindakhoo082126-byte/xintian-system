import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

describe("虚拟交付库存与订单阶段汇总契约", () => {
  it("复用商品管理的四阶段和规格汇总，覆盖实体材料包与非库存会员", () => {
    expect(dbSource).toContain("export async function getProductsEnhanced(params");
    expect(dbSource).toContain("productIds?: number[]");
    expect(dbSource).toContain("await getProductsEnhanced({ productIds");
    expect(dbSource).toContain("inventory: inventoryByProductId.get(row.product.id)");
    expect(dbSource).toContain("variantSummaries");
  });
});
