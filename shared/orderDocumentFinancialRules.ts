export type DocumentPayment = {
  amount: string | number | null | undefined;
  reviewStatus?: string | null;
  paymentSource?: string | null;
  purpose?: string | null;
};

export type DocumentMerchandiseItem = {
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  subtotal?: string | number | null;
  priceType?: string | null;
};

export function getOrderDocumentMerchandiseBreakdown(items: DocumentMerchandiseItem[] | null | undefined) {
  return (items || []).reduce(
    (summary, item) => {
      const subtotal = Number(item.subtotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 0));
      if (String(item.priceType || "regular") === "special") {
        summary.specialItemsSubtotal += subtotal;
      } else {
        summary.regularItemsSubtotal += subtotal;
      }
      summary.itemsSubtotal += subtotal;
      return summary;
    },
    { regularItemsSubtotal: 0, specialItemsSubtotal: 0, itemsSubtotal: 0 },
  );
}

export function getOrderDocumentPaymentSummary(input: {
  baseOrderTotal: number;
  payments: DocumentPayment[];
}) {
  const approvedPayments = input.payments.filter((payment) => !payment.reviewStatus || payment.reviewStatus === "approved");
  const approvedPaymentTotal = approvedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const confirmedSupplementalShipping = approvedPayments
    .filter((payment) => String(payment.paymentSource || "").startsWith("supplemental_shipping") || String(payment.purpose || "").startsWith("supplemental_shipping"))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const finalOrderTotal = input.baseOrderTotal + confirmedSupplementalShipping;

  return {
    approvedPaymentTotal,
    confirmedSupplementalShipping,
    finalOrderTotal,
    balance: finalOrderTotal - approvedPaymentTotal,
  };
}
