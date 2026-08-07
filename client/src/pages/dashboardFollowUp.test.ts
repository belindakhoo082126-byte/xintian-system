import { describe, expect, it } from "vitest";
import { getFollowUpDisplayState } from "./dashboardFollowUp";

describe("getFollowUpDisplayState", () => {
  it("keeps the urgent-order framework visible with zero values before data loads", () => {
    expect(getFollowUpDisplayState(undefined, undefined)).toEqual({
      pendingShippingCount: 0,
      pendingRefundCount: 0,
      logisticsErrorCount: 0,
      incompleteInfoCount: 0,
      notificationFailedCount: 0,
      stockExceptionCount: 0,
      overdueCount: 0,
      partialPaymentCount: 0,
      overPaymentCount: 0,
      amountChangedCount: 0,
      otherCount: 0,
      itemCount: 0,
    });
  });

  it("preserves follow-up counts and the list badge count when data exists", () => {
    expect(getFollowUpDisplayState({
      pendingShippingCount: 2,
      pendingRefundCount: 1,
      logisticsErrorCount: 3,
      incompleteInfoCount: 1,
      notificationFailedCount: 4,
      stockExceptionCount: 2,
      overdueCount: 1,
      partialPaymentCount: 5,
      overPaymentCount: 1,
      amountChangedCount: 2,
      otherCount: 3,
    }, [{ id: 1 }, { id: 2 }])).toEqual({
      pendingShippingCount: 2,
      pendingRefundCount: 1,
      logisticsErrorCount: 3,
      incompleteInfoCount: 1,
      notificationFailedCount: 4,
      stockExceptionCount: 2,
      overdueCount: 1,
      partialPaymentCount: 5,
      overPaymentCount: 1,
      amountChangedCount: 2,
      otherCount: 3,
      itemCount: 2,
    });
  });

  it("treats partial stats (missing new fields) as zero for the new categories", () => {
    expect(getFollowUpDisplayState({
      pendingShippingCount: 1,
      pendingRefundCount: 0,
      logisticsErrorCount: 0,
      overdueCount: 0,
    }, [])).toEqual({
      pendingShippingCount: 1,
      pendingRefundCount: 0,
      logisticsErrorCount: 0,
      incompleteInfoCount: 0,
      notificationFailedCount: 0,
      stockExceptionCount: 0,
      overdueCount: 0,
      partialPaymentCount: 0,
      overPaymentCount: 0,
      amountChangedCount: 0,
      otherCount: 0,
      itemCount: 0,
    });
  });
});
