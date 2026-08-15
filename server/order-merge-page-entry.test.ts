import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ordersPage = readFileSync(new URL("../client/src/pages/Orders.tsx", import.meta.url), "utf8");
const orderBrowsePage = readFileSync(new URL("../client/src/pages/OrderBrowsePage.tsx", import.meta.url), "utf8");
const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

describe("订单管理页面级合并订单入口", () => {
  it("提供独立页面操作入口，并要求从列表单选来源订单", () => {
    expect(ordersPage).toContain("data-page-merge-entry");
    expect(ordersPage).toContain('translate("合并订单", "Merge Orders")');
    expect(ordersPage).toContain("if (selectedIds.size !== 1)");
    expect(ordersPage).toContain("setMergeSourceOrderId(sourceOrderId)");
  });

  it("复用既有合单候选与确认接口，不绕过服务端资格保护", () => {
    expect(ordersPage).toContain("trpc.orders.mergeCandidates.useQuery");
    expect(ordersPage).toContain("enabled: mergeDialogOpen && mergeSourceOrderId !== null");
    expect(ordersPage).toContain("trpc.orders.merge.useMutation");
    expect(ordersPage).toContain("sourceOrderId: mergeSourceOrderId, targetOrderId: Number(mergeTargetId), creditDisposition: mergeCreditDisposition");
    expect(ordersPage).toContain("utils.orders.invalidate()");
  });

  it("将来源订单、不同客户合并资格与目标订单客户资料均呈现在页面级对话框中", () => {
    expect(ordersPage).toContain("data-page-merge-dialog");
    expect(ordersPage).toContain('translate("合并至订单", "Merge into order")');
    expect(ordersPage).toContain("mergeCandidates.map");
    expect(ordersPage).toContain("不同客户也可合并");
    expect(ordersPage).toContain("candidate.customerName");
  });

  it("在确认前明确标示来源订单会关闭、目标订单会保留，并说明资料去向", () => {
    expect(ordersPage).toContain("data-merge-order-role-summary");
    expect(ordersPage).toContain("data-merge-source-closes");
    expect(ordersPage).toContain("来源订单 · 合并后关闭");
    expect(ordersPage).toContain("data-merge-target-keeps");
    expect(ordersPage).toContain("保留订单 · 用于付款与收货");
    expect(ordersPage).toContain("data-merge-final-summary");
    expect(ordersPage).toContain("确认合并并保留目标订单");
  });

  it("允许含 Credit 的未付款订单出现在候选中，并要求服务端选择其处置方式", () => {
    expect(dbSource).toContain("o.physicalStatus, o.totalAmount, o.creditUsed, o.shippingMethod");
    expect(dbSource).not.toContain("AND COALESCE(o.creditUsed, 0) = 0");
    expect(dbSource).toContain('creditDisposition?: "carry_forward" | "return_to_source"');
    expect(dbSource).toContain("原订单已使用客户 Credit，请选择带入保留订单或退回来源客户余额");
  });

  it("在两个合并入口均明确让员工选择带入 Credit 或退回来源客户余额", () => {
    expect(ordersPage).toContain("data-merge-credit-disposition");
    expect(ordersPage).toContain('value="carry_forward"');
    expect(ordersPage).toContain('value="return_to_source"');
    expect(orderBrowsePage).toContain("data-merge-credit-disposition");
    expect(orderBrowsePage).toContain("creditDisposition: mergeCreditDisposition");
  });

  it("在合并时清除来源订单 Credit、只带入可抵扣部分并记录两种金额结果", () => {
    expect(dbSource).toContain('creditUsed: "0.00"');
    expect(dbSource).toContain("creditCarriedForward = Math.min(sourceCreditUsed");
    expect(dbSource).toContain("await refundCustomerCredit(source!.customerId!, creditReturnedToSource");
    expect(dbSource).toContain("creditReturnedToSource: creditReturnedToSource.toFixed(2)");
  });
});
