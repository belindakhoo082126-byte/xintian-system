import { describe, expect, it } from "vitest";
import { buildRestockAllocationKey, canAllocateWaitingRestock, getRestockAllocationProgress } from "../shared/restockAllocationRules";

describe("waiting restock allocation rules", () => {
  it("keeps base products and each variant in independent incoming-stock buckets", () => {
    expect(buildRestockAllocationKey(88, null)).toBe("88:base");
    expect(buildRestockAllocationKey(88, 501)).toBe("88:501");
    expect(buildRestockAllocationKey(88, 502)).not.toBe(buildRestockAllocationKey(88, 501));
  });

  it("allocates only a fully received matching product and variant", () => {
    expect(canAllocateWaitingRestock({
      incomingProductId: 88,
      incomingVariantId: 501,
      exceptionProductId: 88,
      exceptionVariantId: 501,
      incomingQuantity: 4,
      requiredQuantity: 4,
    })).toBe(true);

    expect(canAllocateWaitingRestock({
      incomingProductId: 88,
      incomingVariantId: 502,
      exceptionProductId: 88,
      exceptionVariantId: 501,
      incomingQuantity: 4,
      requiredQuantity: 4,
    })).toBe(false);

    expect(canAllocateWaitingRestock({
      incomingProductId: 88,
      incomingVariantId: 501,
      exceptionProductId: 88,
      exceptionVariantId: 501,
      incomingQuantity: 3,
      requiredQuantity: 4,
    })).toBe(false);
  });

  it("accumulates partial receipts and closes only after the full shortage arrives", () => {
    expect(getRestockAllocationProgress(5, 0, 2)).toEqual({
      newlyAllocated: 2,
      totalAllocated: 2,
      remainingRequired: 3,
      isComplete: false,
    });
    expect(getRestockAllocationProgress(5, 2, 3)).toEqual({
      newlyAllocated: 3,
      totalAllocated: 5,
      remainingRequired: 0,
      isComplete: true,
    });
  });
});
