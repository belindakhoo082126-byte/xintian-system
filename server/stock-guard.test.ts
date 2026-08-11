import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(process.cwd(), "server/db.ts"), "utf8");

describe("未开启 Over Sold 的原子防超卖库存限制", () => {
  it("only deducts non-oversold stock when the available balance covers the full requested quantity", () => {
    const helper = source.slice(
      source.indexOf("export async function reserveProductStocksForOrder"),
      source.indexOf("export async function createOrderWithSplit"),
    );

    expect(helper).toContain("gte(products.stockQuantity, quantity)");
    expect(helper).toContain("eq(products.allowOversold, true)");
    expect(helper).toContain("STOCK_INSUFFICIENT:");
    expect(helper).toContain("stockQuantity: sql`${products.stockQuantity} - ${quantity}`");
  });

  it("uses the same stock reservation helper for admin orders, order edits, mall checkout, add-ons, and live orders", () => {
    const requiredEntrypoints = [
      "export async function createOrderWithSplit",
      "export async function updateOrderItems",
      "export async function mallCheckout",
      "export async function addMallItemsToOrder",
      "export async function createOrderFromLiveCapture",
    ];

    for (const entrypoint of requiredEntrypoints) {
      const start = source.indexOf(entrypoint);
      const next = source.indexOf("export async function", start + entrypoint.length);
      const block = source.slice(start, next === -1 ? undefined : next);
      expect(block).toContain("reserveProductStocksForOrder(");
    }
  });
});
