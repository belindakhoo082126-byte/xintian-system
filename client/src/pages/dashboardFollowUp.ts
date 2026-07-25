export type FollowUpStats = {
  pendingShippingCount?: number;
  pendingRefundCount?: number;
  logisticsErrorCount?: number;
  overdueCount?: number;
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
    overdueCount: stats?.overdueCount ?? 0,
    itemCount: items?.length ?? 0,
  };
}
