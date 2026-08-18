export type FollowUpStats = {
  pendingShippingCount?: number;
  pendingRefundCount?: number;
  logisticsErrorCount?: number;
  incompleteInfoCount?: number;
  notificationFailedCount?: number;
  stockExceptionCount?: number;
  overdueCount?: number;
  partialPaymentCount?: number;
  overPaymentCount?: number;
  amountChangedCount?: number;
  otherCount?: number;
};

/**
 * Normalizes Dashboard follow-up data so the urgent-order framework always
 * renders meaningful zero counts before data exists or while data is empty.
 */
export function getFollowUpDisplayState(
  stats?: FollowUpStats | null,
  items?: unknown[] | null,
) {
  return {
    pendingShippingCount: stats?.pendingShippingCount ?? 0,
    pendingRefundCount: stats?.pendingRefundCount ?? 0,
    logisticsErrorCount: stats?.logisticsErrorCount ?? 0,
    incompleteInfoCount: stats?.incompleteInfoCount ?? 0,
    notificationFailedCount: stats?.notificationFailedCount ?? 0,
    stockExceptionCount: stats?.stockExceptionCount ?? 0,
    overdueCount: stats?.overdueCount ?? 0,
    partialPaymentCount: stats?.partialPaymentCount ?? 0,
    overPaymentCount: stats?.overPaymentCount ?? 0,
    amountChangedCount: stats?.amountChangedCount ?? 0,
    otherCount: stats?.otherCount ?? 0,
    itemCount: items?.length ?? 0,
  };
}
