import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dbSource = readFileSync(resolve(import.meta.dirname, "db.ts"), "utf8");
const productPageSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ProductsV2.tsx"), "utf8");

describe("商品级统一预售", () => {
  it("以 allowPresale 作为统一库存守卫并兼容历史 allowOversold", () => {
    const reserveSlice = dbSource.slice(dbSource.indexOf("export async function reserveProductStocksForOrder"), dbSource.indexOf("type SpecialPriceSnapshotItem"));
    expect(reserveSlice).toContain("eq(products.allowPresale, true)");
    expect(reserveSlice).toContain("stockQuantity: sql`${products.stockQuantity} - ${quantity}`");
    expect(reserveSlice).toContain("STOCK_INSUFFICIENT");
  });

  it("商品保存会同步预售开关与历史库存许可字段", () => {
    expect(dbSource).toContain("allowOversold: data.allowPresale ?? false");
    expect(dbSource).toContain("(updateData as any).allowOversold = updateData.allowPresale");
  });

  it("商品管理只提供商品级预售开关，不再以超卖作为管理员操作语义", () => {
    expect(productPageSource).toContain('p.type === "physical" && p.allowPresale');
    expect(productPageSource).toContain('translate("预售", "Presale")');
    expect(productPageSource).toContain('translate("编辑商品", "Edit product")');
    expect(productPageSource).not.toContain('translate("允许超卖", "Allow overselling")');
  });

  it("直播成功捉单不再分流预售数量，所有订单进入同一库存账本", () => {
    const liveSyncSlice = dbSource.slice(dbSource.indexOf("async function syncLiveRoomProductCounts"), dbSource.indexOf("// --- Get live order captures"));
    expect(liveSyncSlice).toContain("reservedCount: sql`${liveRoomProducts.reservedCount} + ${quantity}`");
    expect(liveSyncSlice).toContain("availableStock: sql`GREATEST(0, ${liveRoomProducts.availableStock} - ${quantity})`");
    expect(liveSyncSlice).not.toContain("const isPreorder");
    expect(liveSyncSlice).not.toContain("preorderCount} + ${quantity}");
  });

  it("进货收货按本次入库数量增量抵销预售产生的负库存", () => {
    const receiveSlice = dbSource.slice(dbSource.indexOf("export async function receivePurchaseOrder"), dbSource.indexOf("export async function getLatestSupplierProductCost"));
    expect(receiveSlice).toContain("stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`");
    expect(receiveSlice).not.toContain("GREATEST(0");
  });
});
