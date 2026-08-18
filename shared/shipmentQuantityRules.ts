export function resolveShippableQuantity(totalQuantity: number, alreadyShippedQuantity: number, requestedQuantity?: number): number {
  if (!Number.isInteger(totalQuantity) || totalQuantity <= 0 || !Number.isInteger(alreadyShippedQuantity) || alreadyShippedQuantity < 0) {
    throw new Error("SHIPMENT_QUANTITY_INVALID");
  }
  const remainingQuantity = totalQuantity - alreadyShippedQuantity;
  if (remainingQuantity <= 0) throw new Error("SHIPMENT_ALREADY_FULFILLED");
  const quantity = requestedQuantity === undefined ? remainingQuantity : requestedQuantity;
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > remainingQuantity) {
    throw new Error("SHIPMENT_QUANTITY_EXCEEDS_REMAINING");
  }
  return quantity;
}
