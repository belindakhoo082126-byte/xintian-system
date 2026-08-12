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

    expect(helper).toContain("products.stockQuantity} - COALESCE(${products.reservedQuantity}, 0) >= ${quantity}");
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

  it("treats product stock as the already-deducted sellable balance and never subtracts pending orders twice", () => {
    const start = source.indexOf("export async function getProductsEnhanced");
    const next = source.indexOf("export async function getProductOrderDetails", start);
    const helper = source.slice(start, next === -1 ? undefined : next);

    expect(helper).toContain("availableQuantity: Math.max(0, Number(p.stockQuantity || 0) - Number(p.reservedQuantity || 0))");
    expect(helper).not.toContain("availableQuantity: (p.stockQuantity || 0) - (pendingMap[p.id] || 0)");
  });

  it("splits partial shipments by package-item quantity for ordered and completed counts", () => {
    const start = source.indexOf("export async function getProductsEnhanced");
    const next = source.indexOf("export async function getProductOrderDetails", start);
    const helper = source.slice(start, next === -1 ? undefined : next);

    expect(helper).toContain("WHEN o.physicalStatus = 'partial_shipped'");
    expect(helper).toContain("package_items pi");
    expect(helper).toContain("GREATEST(oi.quantity - COALESCE(shipped_items.shippedQty, 0), 0)");
    expect(helper).toContain("LEAST(oi.quantity, COALESCE(shipped_items.shippedQty, 0))");
  });

  it("counts active AI draft reservations in the same sellable balance as every formal checkout", () => {
    const aiSource = fs.readFileSync(path.resolve(process.cwd(), "server/businessAi.ts"), "utf8");
    const reserveStart = aiSource.indexOf("export async function reserveInventory");
    const releaseStart = aiSource.indexOf("export async function releaseInventory", reserveStart);
    const helper = aiSource.slice(reserveStart, releaseStart);

    expect(helper).toContain("COALESCE(${products.stockQuantity}, 0) - COALESCE(${products.reservedQuantity}, 0)");
    expect(helper).toContain("STOCK_INSUFFICIENT:");
    expect(helper).toContain("reservedQuantity: sql`COALESCE(${products.reservedQuantity}, 0) + ${quantity}`");
  });
});
