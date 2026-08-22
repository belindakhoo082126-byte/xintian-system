export function getRefundCompletionDates(awaitingReturn: boolean, completedAt = new Date()) {
  return {
    processedAt: completedAt,
    refundDate: completedAt,
    inventoryFinalizedAt: awaitingReturn ? null : completedAt,
  };
}
