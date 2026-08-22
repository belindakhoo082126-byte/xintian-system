export const SUPPLEMENTAL_SHIPPING_PAYMENT_PURPOSE_PREFIX = "supplemental_shipping:";

/**
 * 补运费是订单完成付款后的独立物流收款：它需要进入实际现金流，
 * 但不能再次增加商品订单的已收／多汇款余额。
 */
export function isBalanceAffectingPayment(purpose?: string | null) {
  return !String(purpose || "").startsWith(SUPPLEMENTAL_SHIPPING_PAYMENT_PURPOSE_PREFIX);
}

export function makeSupplementalShippingPaymentPurpose(specialActionId: number) {
  return `${SUPPLEMENTAL_SHIPPING_PAYMENT_PURPOSE_PREFIX}${specialActionId}`;
}

export function calculateFinancialCashFlow(input: {
  confirmedCashReceived: number;
  completedRefunds: number;
  initialShippingConfirmed: number;
  supplementalShippingReceived: number;
  actualShippingCost: number;
}) {
  const customerShippingReceived = input.initialShippingConfirmed + input.supplementalShippingReceived;
  return {
    netCashReceived: input.confirmedCashReceived - input.completedRefunds,
    customerShippingReceived,
    shippingNet: customerShippingReceived - input.actualShippingCost,
  };
}
