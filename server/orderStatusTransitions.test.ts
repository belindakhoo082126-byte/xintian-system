import { describe, expect, it } from "vitest";
import { isAllowedPhysicalOrderStatusTransition } from "../shared/orderStatusTransitions";

describe("订单状态流转规则", () => {
  it("允许待付款／待确认到包货、出货和完成的正常链路", () => {
    expect(isAllowedPhysicalOrderStatusTransition("pending", "receipt_uploaded")).toBe(true);
    expect(isAllowedPhysicalOrderStatusTransition("receipt_uploaded", "packing")).toBe(true);
    expect(isAllowedPhysicalOrderStatusTransition("packing", "shipped")).toBe(true);
    expect(isAllowedPhysicalOrderStatusTransition("shipped", "completed")).toBe(true);
  });

  it("允许保留订单恢复处理及部分发货收敛为已发货", () => {
    expect(isAllowedPhysicalOrderStatusTransition("hold_order", "pending")).toBe(true);
    expect(isAllowedPhysicalOrderStatusTransition("partial_shipped", "shipped")).toBe(true);
  });

  it("拒绝终态回退和跳过包货的非顺序发货", () => {
    expect(isAllowedPhysicalOrderStatusTransition("completed", "pending")).toBe(false);
    expect(isAllowedPhysicalOrderStatusTransition("cancelled", "packing")).toBe(false);
    expect(isAllowedPhysicalOrderStatusTransition("pending", "packing")).toBe(false);
    expect(isAllowedPhysicalOrderStatusTransition("pending", "shipped")).toBe(false);
  });
});
