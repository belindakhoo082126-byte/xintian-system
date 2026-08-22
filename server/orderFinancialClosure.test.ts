import { describe, expect, it } from "vitest";
import { shouldAutoCompleteShippedOrder, shouldCompleteShippedOrderAfterFinancialFollowUp } from "../shared/orderFinancialClosure";

describe("order financial closure", () => {
  it("only completes a fully shipped order after a shipping financial follow-up is resolved", () => {
    expect(shouldCompleteShippedOrderAfterFinancialFollowUp({ physicalStatus: "shipped", specialOrderType: "pending_shipping" })).toBe(true);
    expect(shouldCompleteShippedOrderAfterFinancialFollowUp({ physicalStatus: "shipped", specialOrderType: "pending_refund" })).toBe(true);
  });

  it("does not mark partial shipment or an awaiting-return refund completed", () => {
    expect(shouldCompleteShippedOrderAfterFinancialFollowUp({ physicalStatus: "partial_shipped", specialOrderType: "pending_shipping" })).toBe(false);
    expect(shouldCompleteShippedOrderAfterFinancialFollowUp({ physicalStatus: "shipped", specialOrderType: "pending_refund", hasPendingReturn: true })).toBe(false);
  });

  it("never auto-completes shipped orders with pending remittance differences or refunds", () => {
    expect(shouldAutoCompleteShippedOrder({ physicalStatus: "shipped", specialOrderType: "pending_shipping", specialOrderStatus: "pending" })).toBe(false);
    expect(shouldAutoCompleteShippedOrder({ physicalStatus: "shipped", specialOrderType: "pending_refund", specialOrderStatus: "processing" })).toBe(false);
    expect(shouldAutoCompleteShippedOrder({ physicalStatus: "shipped", specialOrderStatus: "resolved" })).toBe(true);
  });
});
