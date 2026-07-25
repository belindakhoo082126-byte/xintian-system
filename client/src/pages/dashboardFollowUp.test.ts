import { describe, expect, it } from "vitest";
import { getFollowUpDisplayState } from "./dashboardFollowUp";

describe("getFollowUpDisplayState", () => {
  it("keeps the urgent-order framework visible with zero values before data loads", () => {
    expect(getFollowUpDisplayState(undefined, undefined)).toEqual({
      pendingShippingCount: 0,
      pendingRefundCount: 0,
      logisticsErrorCount: 0,
      overdueCount: 0,
      itemCount: 0,
    });
  });

  it("preserves follow-up counts and the list badge count when data exists", () => {
    expect(getFollowUpDisplayState({
      pendingShippingCount: 2,
      pendingRefundCount: 1,
      logisticsErrorCount: 3,
      overdueCount: 1,
    }, [{ id: 1 }, { id: 2 }])).toEqual({
      pendingShippingCount: 2,
      pendingRefundCount: 1,
      logisticsErrorCount: 3,
      overdueCount: 1,
      itemCount: 2,
    });
  });
});
