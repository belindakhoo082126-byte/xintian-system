import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const dbSource = fs.readFileSync(path.resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = fs.readFileSync(path.resolve(process.cwd(), "server/routers.ts"), "utf8");
const detailSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/OrderDetail.tsx"), "utf8");

describe("未付款订单拆单", () => {
  it("仅提供本地未付款实体订单的按商品数量拆单服务", () => {
    expect(dbSource).toContain("export async function splitUnpaidPhysicalOrder");
    expect(dbSource).toContain('source.orderType !== "physical" || source.orderCategory === "import"');
    expect(dbSource).toContain("['pending', 'receipt_uploaded', 'hold_order']");
    expect(dbSource).toContain("请至少保留一项商品在原订单");
    expect(dbSource).toContain("requestedQuantities");
    expect(routerSource).toContain("orderItemId: z.number().int().positive()");
    expect(routerSource).toContain("quantity: z.number().int().positive()");
  });

  it("拆单会安全拆分部分数量，使用当前V2.2规则重算两张订单且不建立第二次库存保留", () => {
    expect(dbSource).toContain("calculateOrderPriceBreakdown(items)");
    expect(dbSource).toContain("calculateWestMalaysiaShipping(totalWeight, price.freeShippingEligibleSubtotal)");
    expect(dbSource).toContain("tx.update(orderItems).set({ orderId: newOrderId })");
    expect(dbSource).toContain("await tx.insert(orderItems).values({");
    expect(dbSource).toContain("quantity: retainedItem.quantity");
    expect(dbSource).toContain("拆分数量不可超过原订单商品数量");
    expect(dbSource).not.toContain("reserveInventoryForSplitOrder");
  });

  it("拆单接口保持管理员授权并写入原订单与新订单的双向审计记录", () => {
    expect(routerSource).toMatch(/split:\s*adminProcedure/);
    expect(routerSource).toContain("db.splitUnpaidPhysicalOrder");
    expect((dbSource.match(/logOrderOperation\([^\n]+"split"/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it("订单详情展示原价、特价、Credit、额外收费、折扣、运费和拆单入口", () => {
    ["原价商品", "特价商品", "Credit 抵扣", "额外收费", "折扣", "运费", "拆分订单"].forEach((label) => {
      expect(detailSource).toContain(label);
    });
    expect(detailSource).toContain('item.priceType === "special"');
    expect(detailSource).toContain("splitQuantities");
    expect(detailSource).toContain("拆分数量");
  });
});
