export type DocumentPayment = {
  amount: string | number | null | undefined;
  reviewStatus?: string | null;
  paymentSource?: string | null;
  purpose?: string | null;
};

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
