import { describe, expect, it } from "vitest";
import { getOrderDocumentPaymentSummary } from "@shared/orderDocumentFinancialRules";

describe("正式单据最终应收金额", () => {
  it("将已确认的实际补运费纳入最终应收与付款结余", () => {
    expect(getOrderDocumentPaymentSummary({
      baseOrderTotal: 606,
      payments: [
        { amount: "606.00", reviewStatus: "approved", paymentSource: "admin_manual" },
        { amount: "9.00", reviewStatus: "approved", paymentSource: "customer_upload", purpose: "supplemental_shipping:30001" },
      ],
    })).toEqual({
      approvedPaymentTotal: 615,
      confirmedSupplementalShipping: 9,
      finalOrderTotal: 615,
      balance: 0,
    });
  });

  it("不会把待审核补运费提前加入最终应收", () => {
    expect(getOrderDocumentPaymentSummary({
      baseOrderTotal: 606,
      payments: [{ amount: "9.00", reviewStatus: "pending", paymentSource: "customer_upload", purpose: "supplemental_shipping:30001" }],
    })).toEqual({
      approvedPaymentTotal: 0,
      confirmedSupplementalShipping: 0,
      finalOrderTotal: 606,
      balance: 606,
    });
  });
});
