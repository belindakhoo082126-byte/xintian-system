import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const readSource = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

describe("直播结束得标通知", () => {
  it("直播订单查询返回每张订单的安全令牌", () => {
    const source = readSource("server/db.ts");
    const querySlice = source.slice(source.indexOf("export async function getLiveRoomOrders"), source.indexOf("export async function getLiveRoomOrdersByProduct"));
    expect(querySlice).toContain("secureToken: order.secureToken");
    expect(querySlice).toContain("priceType: item.priceType");
    expect(querySlice).toContain("originalUnitPrice: item.originalUnitPrice");
  });

  it("结播通知为每张可访问订单附带专属结单按钮", () => {
    const source = readSource("server/messenger.ts");
    const closeSlice = source.slice(source.indexOf("// Send settlement notifications"), source.indexOf("console.log(`[Facebook] Sent settlement notifications"));
    expect(closeSlice).toContain("/order/${order.orderNumber}/${order.secureToken}");
    expect(closeSlice).toContain("sendButtonMessage(order.facebookId");
    expect(closeSlice).toContain("查询订单及结账");
    expect(closeSlice).toContain("calculateMerchandiseNotificationBreakdown(order.items || [])");
    expect(closeSlice).toContain("普通商品小计");
    expect(closeSlice).toContain("特价商品小计");
    expect(closeSlice).toContain("免邮计算基数");
    expect(closeSlice).toContain("运费：待填写配送资料后计算");
  });
});
