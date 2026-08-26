import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isStockManagedProductType } from "../shared/inventoryStageRules";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

describe("会员订单库存边界", () => {
  it("会员与资料包不是库存商品，实体材料包仍是库存商品", () => {
    expect(isStockManagedProductType("membership")).toBe(false);
    expect(isStockManagedProductType("physical")).toBe(true);
    expect(isStockManagedProductType("gift")).toBe(true);
  });

  it("手动建立订单会在预留库存前以商品主档校正客户端类型", () => {
    const trustedTypeIndex = dbSource.indexOf("const productIdsForType = Array.from(new Set(data.items.map((item) => item.productId).filter(Boolean)))");
    const stockReserveIndex = dbSource.indexOf("const stockManagedItems = data.items.filter(i => isStockManagedProductType(i.productType));");
    expect(trustedTypeIndex).toBeGreaterThan(-1);
    expect(stockReserveIndex).toBeGreaterThan(trustedTypeIndex);
    expect(dbSource).toContain('trustedType === "membership" || trustedType === "virtual" ? "membership"');
  });

  it("统一库存预留函数也会按商品主档跳过会员，覆盖订单编辑与其他调用路径", () => {
    expect(dbSource).toContain("const trustedTypeById = new Map<number, string>(typeRows.map((product) => [product.id, String(product.type)]));");
    expect(dbSource).toContain("if (!isStockManagedProductType(normalizedType as \"physical\" | \"gift\" | \"membership\")) continue;");
  });
});
