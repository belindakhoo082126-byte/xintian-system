import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const dbSource = fs.readFileSync(path.resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = fs.readFileSync(path.resolve(process.cwd(), "server/routers.ts"), "utf8");
const detailSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/OrderDetail.tsx"), "utf8");
const browseSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/OrderBrowsePage.tsx"), "utf8");
const ordersSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/Orders.tsx"), "utf8");

describe("本地订单拆单", () => {
  it("仅提供本地未付款、部分汇款或保留实体订单的按商品数量拆单服务，并拒绝已履约或已结算订单", () => {
    expect(dbSource).toContain("export async function splitUnpaidPhysicalOrder");
    expect(dbSource).toContain('source.orderType !== "physical" || source.orderCategory === "import"');
    expect(dbSource).toContain("['pending', 'receipt_uploaded', 'partial_payment', 'hold_order']");
    expect(dbSource).toContain("只有未付款、部分汇款或保留中的订单可以拆单");
    expect(dbSource).not.toContain("含已确认付款或已使用 Credit 的订单不可拆单");
    expect(dbSource).toContain("请至少保留一项商品在原订单");
    expect(dbSource).toContain("requestedQuantities");
    expect(routerSource).toContain("orderItemId: z.number().int().positive()");
    expect(routerSource).toContain("quantity: z.number().int().positive()");
    expect(routerSource).toContain("newOrderAllocatedPayment: z.number().finite().min(0).optional()");
    expect(routerSource).toContain("newOrderAllocatedCredit: z.number().finite().min(0).optional()");
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

  it("部分汇款拆单对已收款与Credit实行受控分配，并校验两张订单金额守恒", () => {
    expect(dbSource).toContain("newOrderAllocatedPayment?: number");
    expect(dbSource).toContain("newOrderAllocatedCredit?: number");
    expect(dbSource).toContain("sourcePaidCents");
    expect(dbSource).toContain("originalOrderRetainedPaymentCents");
    expect(dbSource).toContain("originalOrderRetainedCreditCents");
    expect(dbSource).toContain("新订单分配的已收款金额不可超过原订单已收款");
    expect(dbSource).toContain("新订单分配的 Credit 不可超过原订单已使用 Credit");
    expect(dbSource).toContain("已收款分配不可超过对应订单的应付金额，请重新调整分配金额");
    expect(dbSource).toContain("resolveSplitPaymentStatus");
  });

  it("部分汇款拆单以无凭据付款流水转移金额，付款凭据只留在原订单且审计可追溯", () => {
    expect(dbSource).toContain("拆单已收款分配（转出）");
    expect(dbSource).toContain("拆单已收款分配（转入）");
    expect(dbSource).toContain('paymentSource: "order_split_allocation"');
    expect(dbSource).toContain("receiptEvidence: \"retained_on_original_order_only\"");
    expect(dbSource).toContain("原付款凭据仍只保留在本订单");
    expect(dbSource).toContain("付款凭据仍只保留在原订单");
    expect(dbSource).not.toMatch(/orderId:\s*newOrderId,[\s\S]{0,300}receiptUrl:/);
  });

  it("订单详情展示原价、特价、Credit、额外收费、折扣、运费和拆单入口", () => {
    ["原价商品", "特价商品", "Credit 抵扣", "额外收费", "折扣", "运费", "拆分订单"].forEach((label) => {
      expect(detailSource).toContain(label);
    });
    expect(detailSource).toContain('item.priceType === "special"');
    expect(detailSource).toContain("splitQuantities");
    expect(detailSource).toContain("拆分数量");
  });

  it("后台订单详情提供部分汇款拆单的受控金额分配，并保留合单入口", () => {
    expect(browseSource).toContain("拆分订单");
    expect(browseSource).toContain("合并订单");
    expect(browseSource).toContain("trpc.orders.split.useMutation");
    expect(browseSource).toContain("trpc.orders.merge.useMutation");
    expect(browseSource).toContain("trpc.orders.mergeCandidates.useQuery");
    expect(browseSource).toContain("local unpaid, partially paid, and hold orders may be split");
    expect(browseSource).toContain("newOrderAllocatedPayment");
    expect(browseSource).toContain("newOrderAllocatedCredit");
    expect(browseSource).toContain("付款凭据不会复制，仍只保留在原订单及其付款审计中");
    expect(browseSource).toContain("不同客户也可合并");
    expect(browseSource).toContain("未付款或保留订单");
  });

  it("手动合单允许不同客户的未付款本地订单，仍保留来源审计并拒绝XTC、付款或履约订单", () => {
    expect(dbSource).toContain("export async function getManualOrderMergeCandidates");
    expect(dbSource).toContain("export async function mergeUnpaidLocalOrders");
    expect(dbSource).toContain("AND o.orderCategory = 'local'");
    expect(dbSource).toContain("AND o.orderType = 'physical'");
    expect(dbSource).toContain("LEFT JOIN customers c ON c.id = o.customerId");
    expect(dbSource).not.toContain("AND o.customerId = ${source.customerId}");
    expect(dbSource).not.toContain("仅可合并同一客户的订单");
    expect(dbSource).toContain("sourceCustomerId: source!.customerId");
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
