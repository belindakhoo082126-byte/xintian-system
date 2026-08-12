import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dbSource = readFileSync(resolve(import.meta.dirname, "db.ts"), "utf8");
const messengerSource = readFileSync(resolve(import.meta.dirname, "messenger.ts"), "utf8");

describe("直播现货与预售库存同步", () => {
  it("现货才进入原子库存保留，预售不会扣除商品库存", () => {
    const captureSlice = dbSource.slice(dbSource.indexOf("export async function createOrderFromLiveCapture"), dbSource.indexOf("// --- Get live order captures"));
    expect(captureSlice).toContain("const inStockProducts = data.matchedProducts.filter((p) => !p.isPreorder)");
    expect(captureSlice).toContain("await reserveProductStocksForOrder(inStockProducts)");
    expect(captureSlice).toContain('salesMode: p.isPreorder ? (isImportOrder ? "import_preorder" : "presale") : "normal"');
  });

  it("成功捉单同步直播卡的已下单、预售、可售和售罄状态", () => {
    expect(dbSource).toContain("async function syncLiveRoomProductCounts");
    expect(dbSource).toContain("orderedCount: sql`${liveRoomProducts.orderedCount} + ${quantity}`");
    expect(dbSource).toContain("preorderCount: isPreorder");
    expect(dbSource).toContain("GREATEST(0, ${liveRoomProducts.availableStock} - ${quantity})");
    expect(dbSource).toContain("syncLiveRoomProductCounts(data.liveRoomId, data.matchedProducts)");
  });

  it("留言处理沿用已匹配的直播间和直播商品预售标记", () => {
    const captureCall = messengerSource.slice(messengerSource.indexOf("const orderResult = await createOrderFromLiveCapture"), messengerSource.indexOf("const itemList"));
    expect(messengerSource).toContain("let liveRoomId: number | undefined = activeRoomId || undefined");
    expect(captureCall).toContain("liveRoomProductId: m.liveRoomProductId");
    expect(captureCall).toContain("isPreorder: m.isPreorder");
  });

  it("并发抢完现货时向较晚留言者回复明确售罄提示", () => {
    expect(messengerSource).toContain('startsWith("STOCK_INSUFFICIENT:")');
    expect(messengerSource).toContain("这件现货刚刚被较早留言的顾客成功下单，现已售罄");
  });
});
