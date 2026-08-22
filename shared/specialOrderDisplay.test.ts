import { describe, expect, it } from "vitest";
import { SPECIAL_ORDER_FILTER_OPTIONS, getSpecialOrderReasonLabel } from "./specialOrderDisplay";

describe("待汇款差价状态显示", () => {
  it("将已发货后欠运费差额显示为可交接的待汇款差价", () => {
    expect(getSpecialOrderReasonLabel("pending_shipping").zh).toBe("待汇款差价");
    expect(getSpecialOrderReasonLabel("pending_shipping_fee").zh).toBe("待汇款差价");
  });

  it("保留待汇款差价作为订单管理可筛选的特别状态", () => {
    expect(SPECIAL_ORDER_FILTER_OPTIONS).toContainEqual({
      value: "pending_shipping",
      zh: "待汇款差价",
      en: "Pending Remittance Difference",
    });
  });

  it("保留等待补货作为订单管理可筛选的特别状态", () => {
    expect(SPECIAL_ORDER_FILTER_OPTIONS).toContainEqual({
      value: "stock_exception",
      zh: "等待补货",
      en: "Waiting Restock",
    });
  });

  it("不将多汇款作为特别状态筛选，而是交由退款管理处理", () => {
    expect(SPECIAL_ORDER_FILTER_OPTIONS.some((option) => option.value === "over_payment")).toBe(false);
  });
});
