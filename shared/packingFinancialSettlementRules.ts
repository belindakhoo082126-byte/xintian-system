export type PackingFinancialSettlementInput = {
  currentOrderDue: number;
  checkoutReceipts: number;
  approvedSupplementalShipping: number;
  completedRefunds: number;
  pendingRefunds: number;
};

/** Separates the current order total from cash already received and refunds still awaiting completion. */
export function derivePackingFinancialSettlement(input: PackingFinancialSettlementInput) {
  const confirmedReceipts = Math.max(0, input.checkoutReceipts) + Math.max(0, input.approvedSupplementalShipping);
  const currentActualNetReceived = confirmedReceipts - Math.max(0, input.completedRefunds);
  const projectedNetAfterPendingRefund = currentActualNetReceived - Math.max(0, input.pendingRefunds);
  return {
    currentOrderDue: Math.max(0, input.currentOrderDue),
    confirmedReceipts,
    currentActualNetReceived,
    projectedNetAfterPendingRefund,
  };
}
