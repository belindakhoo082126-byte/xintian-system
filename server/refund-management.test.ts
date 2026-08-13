import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readProjectFile = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
const dbSource = readProjectFile("server/db.ts");
const routerSource = readProjectFile("server/routers.ts");
const refundPageSource = readProjectFile("client/src/pages/RefundManagement.tsx");
const packingPageSource = readProjectFile("client/src/pages/PackingDetail.tsx");
const schemaSource = readProjectFile("drizzle/schema.ts");
const dashboardSource = readProjectFile("client/src/pages/Dashboard.tsx");
const orderPageSource = readProjectFile("client/src/pages/OrderBrowsePage.tsx");
const appSource = readProjectFile("client/src/App.tsx");
const layoutSource = readProjectFile("client/src/components/DashboardLayout.tsx");

function sourceBlock(startMarker: string, endMarker: string) {
  const start = dbSource.indexOf(startMarker);
  const end = dbSource.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return dbSource.slice(start, end);
}

describe("退款管理业务规则", () => {
  it("建立未处理退款只保存申请与逐项明细，不会提前影响库存、Credit 或正式财务", () => {
    const createRefund = sourceBlock(
      "export async function createRefundRequest",
      "export async function completeRefundRequest",
    );

    expect(createRefund).toContain("status: 'pending'");
    expect(createRefund).toContain("orderRefundItems");
    expect(createRefund).toContain("可退款数量不足，不能重复退款");
    expect(createRefund).not.toContain("inventoryAdjustments");
    expect(createRefund).not.toContain("customerCreditLedger");
    expect(createRefund).not.toContain("tx.update(products)");

    const recalculateBalance = sourceBlock(
      "export async function recalculateOrderBalance",
      "// ============================================================================\n// V2.1.15",
    );
    expect(recalculateBalance).toContain("r.status === 'processed' || r.status === 'awaiting_return'");
  });

  it("完成退款会强制验证转账凭证、Credit 流水、库存处理与待退货确认流程", () => {
    const completeRefund = sourceBlock(
      "export async function completeRefundRequest",
      "export async function finalizeRefundReturnItem",
    );

    expect(dbSource).toContain("const refundProofRequired");
    expect(completeRefund).toContain("refundProofRequired(refund[0].refundMethod)");
    expect(completeRefund).toContain("退款必须上传退款凭证");
    expect(completeRefund).toContain("customerCreditLedger");
    expect(completeRefund).toContain("Credit 退款入账失败");
    expect(completeRefund).toContain("item.inventoryTreatment !== 'return_to_sale'");
    expect(completeRefund).toContain("inventoryAdjustments");
    expect(completeRefund).toContain("status: awaitingReturn ? 'awaiting_return' : 'processed'");
    expect(completeRefund).toContain("退款退库｜订单");
  });

  it("拒绝或取消仅限未处理记录，且不会改变库存或客户 Credit", () => {
    const pendingStatus = sourceBlock(
      "async function setPendingRefundStatus",
      "export async function rejectRefundRequest",
    );

    expect(pendingStatus).toContain("refund[0].status !== 'pending'");
    expect(pendingStatus).toContain("status: data.status");
    expect(pendingStatus).not.toContain("products");
    expect(pendingStatus).not.toContain("inventoryAdjustments");
    expect(pendingStatus).not.toContain("customerCreditLedger");
  });

  it("管理员更正已处理退款时以反向库存流水留痕，而非直接覆写历史", () => {
    const correction = sourceBlock(
      "export async function correctProcessedRefundInventoryTreatment",
      "// ============================================================================\n// V2.1.19",
    );

    expect(correction).toContain("修改已处理退款的库存方式必须填写原因");
    expect(correction).toContain("退款库存处理更正｜撤销退库");
    expect(correction).toContain("quantityChange: -item.refundQuantity");
    expect(correction).toContain("退款库存处理更正｜退回可售库存");
    expect(correction).toContain("inventoryAdjustmentId: latestAdjustmentId");
    expect(correction).toContain("refund_inventory_corrected");
  });

  it("退回可售库存的已处理退款会从商品已完成数量及明细中扣除，不改写原订单历史", () => {
    const productStats = sourceBlock(
      "export async function getProductsEnhanced",
      "export async function getProductOrderDetails",
    );
    const productOrderDetails = sourceBlock(
      "export async function getProductOrderDetails",
      "export async function getProductByIdEnhanced",
    );

    expect(productStats).toContain("ri.inventoryTreatment = 'return_to_sale'");
    expect(productStats).toContain("ri.inventoryActionStatus = 'returned'");
    expect(productStats).toContain("refund.status IN ('processed', 'awaiting_return')");
    expect(productStats).toContain("GREATEST(oi.quantity - COALESCE(returned_items.returnedQty, 0), 0)");
    expect(productOrderDetails).toContain("${type === 'completed' || type === 'paid' ? sql`${stageQuantity} > 0` : sql`1 = 1`}");
    expect(productOrderDetails).toContain("GREATEST(oi.quantity - COALESCE(returned_items.returnedQty, 0), 0)");
  });

  it("订单详情与退款追溯会展示实际退款损失、退库成本回收及退款后商品利润", () => {
    expect(dbSource).toContain("function buildRefundProfitSummary");
    expect(dbSource).toContain("refund.status === 'processed' || refund.status === 'awaiting_return'");
    expect(dbSource).toContain("returnedInventoryCostRecovery");
    expect(dbSource).toContain("finalProductProfit: originalProductProfit - actualRefundLoss + returnedInventoryCostRecovery");
    expect(dbSource).toContain("refundProfit: buildRefundProfitSummary");
    expect(refundPageSource).toContain("预计退款后商品利润（不含配送）");
    expect(orderPageSource).toContain("退款后商品利润（不含配送）");
  });
});

describe("退款管理客户通知与后台接入", () => {
  it("完成退款后发送可追溯的客户通知，并把失败写入通知日志", () => {
    const refundRouterStart = routerSource.indexOf("refunds: router({");
    const refundRouterEnd = routerSource.indexOf("}),\n\n  reports:", refundRouterStart);
    const refundRouter = routerSource.slice(refundRouterStart, refundRouterEnd);

    expect(refundRouter).toContain("completeRefundRequest");
    expect(refundRouter).toContain("autoNotifyCustomer");
    expect(refundRouter).toContain("退款申请已处理完成");
    expect(refundRouter).toContain("createNotificationLog");
    expect(refundRouter).toContain("退款完成通知发送失败");
    expect(refundRouter).toContain('status: "failed"');
  });

  it("后台页面、侧栏、路由、仪表板及订单详情均提供退款追溯入口", () => {
    expect(refundPageSource).toContain("trpc.refunds.list.useQuery");
    expect(refundPageSource).toContain("trpc.refunds.searchEligibleOrders.useQuery");
    expect(refundPageSource).toContain("trpc.refunds.complete.useMutation");
    expect(refundPageSource).toContain("isProofRequired");
    expect(refundPageSource).toContain("待退货确认");
    expect(refundPageSource).toContain("type=\"date\"");
    expect(appSource).toContain('path={"/admin/refunds"}');
    expect(layoutSource).toContain("退款管理");
    expect(dashboardSource).toContain("trpc.refunds.list.useQuery");
    expect(dashboardSource).toContain("待处理退款");
    expect(orderPageSource).toContain("部分退款");
    expect(orderPageSource).toContain("refundNumber).filter(Boolean).join");
  });
});

describe("包货异常退款桥接", () => {
  it("退款异常仅建立一笔可追溯的未处理退款，异常重试不会重复建立或提前影响库存与财务", () => {
    const exceptionRefund = sourceBlock(
      "export async function createPackingExceptionRefund",
      "const refundProofRequired",
    );

    expect(schemaSource).toContain('sourceExceptionId: int("sourceExceptionId")');
    expect(schemaSource).toContain('refundId: int("refundId")');
    expect(exceptionRefund).toContain("if (exception.refundId)");
    expect(exceptionRefund).toContain("existing: true");
    expect(exceptionRefund).toContain("createRefundRequest({");
    expect(exceptionRefund).toContain("sourceExceptionId: exception.id");
    expect(exceptionRefund).toContain("refundId: refund.id");
    expect(exceptionRefund).not.toContain("inventoryAdjustments");
    expect(exceptionRefund).not.toContain("customerCreditLedger");
  });

  it("包货与退款管理均保留客户退款资料、QR附件及关联退款状态，并提供可操作入口", () => {
    const exceptionList = sourceBlock(
      "export async function getOrderExceptions",
      "export async function createOrderException",
    );

    expect(exceptionList).toContain("linkedRefund");
    expect(exceptionList).toContain("customerRefundDetails");
    expect(exceptionList).toContain("attachmentUrls");
    expect(packingPageSource).toContain("uploadRefundAttachment");
    expect(packingPageSource).toContain("customerRefundDetails");
    expect(packingPageSource).toContain("refundAttachmentUrls");
    expect(packingPageSource).toContain("关联退款");
    expect(packingPageSource).toContain('href="/admin/refunds"');
    expect(refundPageSource).toContain("parseAttachmentUrls");
    expect(refundPageSource).toContain("copyRefundDetails");
    expect(refundPageSource).toContain("客户QR／问题附件");
  });
});
