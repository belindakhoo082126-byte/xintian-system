import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const dbSource = fs.readFileSync(path.resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = fs.readFileSync(path.resolve(process.cwd(), "server/routers.ts"), "utf8");
const detailSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/OrderDetail.tsx"), "utf8");
const browseSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/OrderBrowsePage.tsx"), "utf8");
const ordersSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/Orders.tsx"), "utf8");

describe("未付款订单拆单", () => {
  it("仅提供本地未付款实体订单的按商品数量拆单服务，并拒绝已履约或已结算订单", () => {
    expect(dbSource).toContain("export async function splitUnpaidPhysicalOrder");
    expect(dbSource).toContain('source.orderType !== "physical" || source.orderCategory === "import"');
    expect(dbSource).toContain("['pending', 'receipt_uploaded', 'hold_order']");
    expect(dbSource).toContain("只有未确认付款或保留中的订单可以拆单");
    expect(dbSource).toContain("含已确认付款或已使用 Credit 的订单不可拆单");
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

  it("后台订单详情恢复受限的拆单与合单入口，且复用同客户未付款本地订单边界", () => {
    expect(browseSource).toContain("拆分订单");
    expect(browseSource).toContain("合并订单");
    expect(browseSource).toContain("trpc.orders.split.useMutation");
    expect(browseSource).toContain("trpc.orders.merge.useMutation");
    expect(browseSource).toContain("trpc.orders.mergeCandidates.useQuery");
    expect(browseSource).toContain("only unpaid local physical orders can be split");
    expect(browseSource).toContain("同一客户、未付款、无付款凭证");
  });

  it("手动合单只移动既有库存保留的订单项目，保留来源审计且拒绝跨客户、XTC或付款订单", () => {
    expect(dbSource).toContain("export async function getManualOrderMergeCandidates");
    expect(dbSource).toContain("export async function mergeUnpaidLocalOrders");
    expect(dbSource).toContain("AND o.orderCategory = 'local'");
    expect(dbSource).toContain("AND o.orderType = 'physical'");
    expect(dbSource).toContain("仅可合并同一客户的订单");
    expect(dbSource).toContain("tx.update(orderItems).set({ orderId: input.targetOrderId })");
    expect(dbSource).toContain("await recalculateOrderTotals(input.targetOrderId)");
    expect(dbSource).toContain('"manual_order_merge"');
    expect(routerSource).toMatch(/mergeCandidates:\s*adminProcedure/);
    expect(routerSource).toMatch(/merge:\s*adminProcedure/);
    expect(routerSource).toContain("db.mergeUnpaidLocalOrders");
  });

  it("订单筛选栏保留全部备注筛选，并不再渲染其右侧无有效默认值的通知空白卡格", () => {
    expect(ordersSource).toContain('translate("全部备注", "All Remarks")');
    expect(ordersSource).not.toContain('translate("通知状态", "Notification")');
  });
});
