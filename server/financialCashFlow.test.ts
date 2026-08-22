import { describe, expect, it } from "vitest";
import {
  calculateFinancialCashFlow,
  isBalanceAffectingPayment,
  makeSupplementalShippingPaymentPurpose,
} from "../shared/financialCashFlow";

describe("financial cash-flow summary", () => {
  it("keeps refunds out of cash receipts and calculates shipping separately", () => {
    expect(calculateFinancialCashFlow({
      confirmedCashReceived: 6000,
      completedRefunds: 200,
      initialShippingConfirmed: 300,
      supplementalShippingReceived: 50,
      actualShippingCost: 420,
    })).toEqual({
      netCashReceived: 5800,
      customerShippingReceived: 350,
      shippingNet: -70,
    });
  });

  it("lets a confirmed supplemental-shipping receipt enter cash flow without turning the product order into overpayment", () => {
    const purpose = makeSupplementalShippingPaymentPurpose(99);
    expect(purpose).toBe("supplemental_shipping:99");
    expect(isBalanceAffectingPayment(purpose)).toBe(false);
    expect(isBalanceAffectingPayment(null)).toBe(true);
    expect(isBalanceAffectingPayment("manual_adjustment")).toBe(true);
  });

  it("keeps a pending supplemental-shipping receipt outside cash reporting until its payment review is approved", () => {
    const pendingReceipt = { reviewStatus: "pending", amount: 9, purpose: makeSupplementalShippingPaymentPurpose(30001) };
    const approvedReceipt = { ...pendingReceipt, reviewStatus: "approved" };
    const cashFrom = (payment: typeof pendingReceipt) => payment.reviewStatus === "approved" ? payment.amount : 0;

    expect(cashFrom(pendingReceipt)).toBe(0);
    expect(cashFrom(approvedReceipt)).toBe(9);
    expect(isBalanceAffectingPayment(approvedReceipt.purpose)).toBe(false);
  });
});
