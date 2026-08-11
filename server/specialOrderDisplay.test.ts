import { describe, expect, it } from "vitest";
import {
  getSpecialOrderHandlingLabel,
  getSpecialOrderReasonLabel,
  isSpecialOrderResolved,
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
});
