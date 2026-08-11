import { describe, expect, it } from "vitest";
import {
  getSpecialOrderHandlingLabel,
  getSpecialOrderReasonLabel,
  isSpecialOrderResolved,
  SPECIAL_ORDER_FILTER_OPTIONS,
} from "@shared/specialOrderDisplay";

describe("特别订单列表显示", () => {
  it("将主要特别订单类型映射为客户与员工可识别的中文原因", () => {
    expect(getSpecialOrderReasonLabel("over_payment").zh).toBe("多汇款");
    expect(getSpecialOrderReasonLabel("under_payment").zh).toBe("少汇款");
    expect(getSpecialOrderReasonLabel("pending_shipping_fee").zh).toBe("待补运费");
    expect(getSpecialOrderReasonLabel("overcharged_shipping").zh).toBe("运费多收");
  });

  it("同时兼容 isResolved 和既有 specialOrderStatus 两种处理状态字段", () => {
    expect(isSpecialOrderResolved(true, "pending")).toBe(true);
    expect(isSpecialOrderResolved(false, "resolved")).toBe(true);
    expect(isSpecialOrderResolved(false, "pending")).toBe(false);
    expect(getSpecialOrderHandlingLabel(false, "pending").zh).toBe("待处理");
    expect(getSpecialOrderHandlingLabel(undefined, "resolved").zh).toBe("已处理");
  });

  it("提供订单管理与包货工作台一致的七类分类筛选，且不包含已移除的超时分类", () => {
    expect(SPECIAL_ORDER_FILTER_OPTIONS.map((option) => option.value)).toEqual([
      "pending_shipping",
      "pending_refund",
      "logistics_error",
      "incomplete_info",
      "notification_failed",
      "over_payment",
      "amount_changed",
    ]);
    expect(SPECIAL_ORDER_FILTER_OPTIONS.some((option) => option.value === "overdue")).toBe(false);
  });
});
