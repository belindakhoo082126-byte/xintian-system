export function normalizeRestockVariantId(variantId: number | null | undefined): number | null {
  return typeof variantId === "number" && Number.isInteger(variantId) && variantId > 0
    ? variantId
    : null;
}

export function buildRestockAllocationKey(productId: number, variantId: number | null | undefined): string {
  return `${productId}:${normalizeRestockVariantId(variantId) ?? "base"}`;
}

export function canAllocateWaitingRestock(params: {
  incomingProductId: number;
  incomingVariantId?: number | null;
  exceptionProductId: number;
  exceptionVariantId?: number | null;
  incomingQuantity: number;
  requiredQuantity: number;
}): boolean {
  return params.incomingProductId === params.exceptionProductId
    && normalizeRestockVariantId(params.incomingVariantId) === normalizeRestockVariantId(params.exceptionVariantId)
    && Number.isInteger(params.incomingQuantity)
    && Number.isInteger(params.requiredQuantity)
    && params.incomingQuantity >= params.requiredQuantity
    && params.requiredQuantity > 0;
}

export function getRestockAllocationProgress(requiredQuantity: number, allocatedQuantity: number, incomingQuantity: number) {
  const required = Math.max(0, Math.floor(Number(requiredQuantity) || 0));
  const allocated = Math.min(required, Math.max(0, Math.floor(Number(allocatedQuantity) || 0)));
  const incoming = Math.max(0, Math.floor(Number(incomingQuantity) || 0));
  const newlyAllocated = Math.min(incoming, Math.max(0, required - allocated));
  const totalAllocated = allocated + newlyAllocated;
  return {
    newlyAllocated,
    totalAllocated,
    remainingRequired: Math.max(0, required - totalAllocated),
    isComplete: required > 0 && totalAllocated >= required,
  };
}
