import { describe, expect, it } from "vitest";
import { getOrderDocumentMerchandiseBreakdown, getOrderDocumentPaymentSummary } from "@shared/orderDocumentFinancialRules";

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

  it("按保存价格类型拆分普通与特价商品，并兼容历史无价格类型项目", () => {
    expect(getOrderDocumentMerchandiseBreakdown([
      { quantity: 2, unitPrice: "15.00", priceType: "regular" },
      { subtotal: "20.00", priceType: "special" },
      { quantity: 1, unitPrice: "8.00" },
    ])).toEqual({
      regularItemsSubtotal: 38,
      specialItemsSubtotal: 20,
      itemsSubtotal: 58,
    });
  });
});
