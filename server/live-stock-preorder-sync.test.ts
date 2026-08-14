import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dbSource = readFileSync(resolve(import.meta.dirname, "db.ts"), "utf8");
const messengerSource = readFileSync(resolve(import.meta.dirname, "messenger.ts"), "utf8");

describe("直播商品级预售与库存同步", () => {
  it("直播预售与现货均进入相同原子库存账本，预售可将库存扣为负数", () => {
    const captureSlice = dbSource.slice(dbSource.indexOf("export async function createOrderFromLiveCapture"), dbSource.indexOf("// --- Get live order captures"));
    expect(captureSlice).toContain("const reservableProducts = data.matchedProducts.map");
    expect(captureSlice).toContain("await reserveProductStocksForOrder(reservableProducts)");
    expect(captureSlice).toContain('salesMode: isImportOrder ? "import_preorder" : "normal"');
  });

  it("成功捉单同步直播卡的已下单、可售和售罄状态，预售不另建数量分流", () => {
    expect(dbSource).toContain("async function syncLiveRoomProductCounts");
    expect(dbSource).toContain("orderedCount: sql`${liveRoomProducts.orderedCount} + ${quantity}`");
    expect(dbSource).toContain("reservedCount: sql`${liveRoomProducts.reservedCount} + ${quantity}`");
    expect(dbSource).toContain("preorderCount: sql`${liveRoomProducts.preorderCount}`");
    expect(dbSource).toContain("GREATEST(0, ${liveRoomProducts.availableStock} - ${quantity})");
    expect(dbSource).toContain("data.matchedProducts,");
    expect(dbSource).not.toContain("const isPreorder = Boolean(item.isPreorder)");
  });

  it("留言处理按商品主档预售标记匹配，直播房不再拥有独立预售规则", () => {
    const captureCall = messengerSource.slice(messengerSource.indexOf("const orderResult = await createOrderFromLiveCapture"), messengerSource.indexOf("const itemList"));
    expect(messengerSource).toContain("let liveRoomId: number | undefined = activeRoomId || undefined");
    expect(captureCall).toContain("liveRoomProductId: m.liveRoomProductId");
    expect(captureCall).toContain("isPreorder: m.isPreorder");
    expect(messengerSource).toContain("productAllowPresale");
    expect(messengerSource).not.toContain("!roomProduct.allowPreorder");
  });

  it("并发抢完现货时向较晚留言者回复明确售罄提示", () => {
    expect(messengerSource).toContain('startsWith("STOCK_INSUFFICIENT:")');
    expect(messengerSource).toContain("这件现货刚刚被较早留言的顾客成功下单，现已售罄");
  });
});
