import { describe, expect, it } from "vitest";
import { getRefundMethodLabel, getSpecialOrderDisplayAmount, getSpecialOrderQueryMode } from "../shared/specialOrderHistoryRules";

describe("special order history query rules", () => {
  it("uses the current order marker for pending special work", () => {
    expect(getSpecialOrderQueryMode({ isSpecialOrder: true, specialOrderStatus: "pending" })).toBe("current");
  });

  it("uses persisted special-status history for resolved work after the current marker is cleared", () => {
    expect(getSpecialOrderQueryMode({ isSpecialOrder: true, specialOrderStatus: "resolved" })).toBe("resolved_history");
  });

  it("does not accidentally broaden normal order searches into special-history searches", () => {
    expect(getSpecialOrderQueryMode({ specialOrderStatus: "resolved" })).toBe("current");
  });

  it("shows the actual resolved history amount before any retained order-level difference", () => {
    expect(getSpecialOrderDisplayAmount({ historyAmount: "20.00", shippingDifference: null })).toBe(20);
    expect(getSpecialOrderDisplayAmount({ historyAmount: "0.00", shippingDifference: "-6.00" })).toBe(6);
    expect(getSpecialOrderDisplayAmount({ historyAmount: "0.00", shippingDifference: "9.00" })).toBe(9);
  });

  it("shows requested refund amount while the refund remains pending", () => {
    expect(getSpecialOrderDisplayAmount({ pendingRefundRequestedAmount: "10.00", shippingDifference: "0.00" })).toBe(10);
  });

  it("uses concise, employee-facing labels for every supported refund method", () => {
    expect(getRefundMethodLabel("credit")).toBe("Credit");
    expect(getRefundMethodLabel("cash")).toBe("Cash");
    expect(getRefundMethodLabel("tng")).toBe("TNG");
    expect(getRefundMethodLabel("bank_transfer")).toBe("银行转账");
    expect(getRefundMethodLabel(null)).toBeNull();
  });
});
