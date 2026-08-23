import { describe, expect, it } from "vitest";
import { derivePackingFinancialSettlement } from "../shared/packingFinancialSettlementRules";
import { getPackingShippingControl, isPackingBlockedByPendingSpecialOrder } from "../shared/packingSpecialOrderRules";

describe("packing cross-page handover rules", () => {
  it("keeps a pending refund visible but permits normal shipment", () => {
    expect(getPackingShippingControl({
      isSpecialOrder: true,
      specialOrderType: "pending_refund",
      specialOrderStatus: "pending",
    })).toEqual({ mode: "allow", reason: "pending_refund" });
    expect(isPackingBlockedByPendingSpecialOrder({
      isSpecialOrder: false,
      specialOrderType: "pending_refund",
      specialOrderStatus: "resolved",
    })).toBe(false);
  });

  it("requires an explicit staff release before a pending remittance difference may ship", () => {
    expect(getPackingShippingControl({
      isSpecialOrder: true,
      specialOrderType: "pending_shipping",
      specialOrderStatus: "pending",
    })).toEqual({ mode: "requires_release", reason: "pending_shipping" });
    expect(getPackingShippingControl({
      isSpecialOrder: true,
      specialOrderType: "pending_shipping",
      specialOrderStatus: "pending",
      hasShippingReleaseApproval: true,
    })).toEqual({ mode: "allow", reason: "pending_shipping" });
  });

  it("allows only a partial shipment while a product is waiting for restock", () => {
    expect(getPackingShippingControl({
      isSpecialOrder: true,
      specialOrderType: "stock_exception",
      specialOrderStatus: "pending",
    })).toEqual({ mode: "partial_only", reason: "waiting_restock" });
  });

  it("separates the current order due from confirmed receipts and a pending refund", () => {
    expect(derivePackingFinancialSettlement({
      currentOrderDue: 35,
      checkoutReceipts: 45,
      approvedSupplementalShipping: 0,
      completedRefunds: 0,
      pendingRefunds: 10,
    })).toEqual({
      currentOrderDue: 35,
      confirmedReceipts: 45,
      currentActualNetReceived: 45,
      projectedNetAfterPendingRefund: 35,
    });
  });
});
