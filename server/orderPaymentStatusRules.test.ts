import { describe, expect, it } from "vitest";
import { deriveOrderStatusAfterPayment } from "../shared/orderPaymentStatusRules";

describe("订单收款状态规则", () => {
  it("保持一般订单由付款确认进入包货", () => {
    expect(deriveOrderStatusAfterPayment({ currentStatus: "pending", totalPaid: 100, totalAmount: 100, shippingMethod: "delivery", orderCategory: "local" })).toBe("packing");
    expect(deriveOrderStatusAfterPayment({ currentStatus: "receipt_uploaded", totalPaid: 100, totalAmount: 100, shippingMethod: "delivery", orderCategory: "local" })).toBe("packing");
  });

  it("保留 Walk-in 自取订单全额付款后直接完成的合法例外", () => {
    expect(deriveOrderStatusAfterPayment({ currentStatus: "pending", totalPaid: 50, totalAmount: 50, shippingMethod: "self_pickup", orderCategory: "local" })).toBe("completed");
  });

  it("不改变已发货、已完成、已取消或部分发货订单的状态", () => {
    for (const currentStatus of ["shipped", "completed", "cancelled", "partial_shipped"]) {
      expect(deriveOrderStatusAfterPayment({ currentStatus, totalPaid: 50, totalAmount: 50, shippingMethod: "self_pickup", orderCategory: "local" })).toBe(currentStatus);
    }
  });
});
