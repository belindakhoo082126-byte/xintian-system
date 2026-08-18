export type GiftInventorySnapshot = {
  stockQuantity: number;
  reservedQuantity: number;
};

export function availableGiftQuantity(snapshot: GiftInventorySnapshot): number {
  return Math.max(0, snapshot.stockQuantity - snapshot.reservedQuantity);
}

export function lockGiftInventory(snapshot: GiftInventorySnapshot, quantity: number): GiftInventorySnapshot {
  if (!Number.isInteger(quantity) || quantity <= 0 || availableGiftQuantity(snapshot) < quantity) {
    throw new Error("GIFT_STOCK_INSUFFICIENT");
  }
  return { ...snapshot, reservedQuantity: snapshot.reservedQuantity + quantity };
}

export function shipGiftInventory(snapshot: GiftInventorySnapshot, quantity: number): GiftInventorySnapshot {
  if (!Number.isInteger(quantity) || quantity <= 0 || snapshot.reservedQuantity < quantity || snapshot.stockQuantity < quantity) {
    throw new Error("GIFT_SHIPMENT_INVALID");
  }
  return {
    stockQuantity: snapshot.stockQuantity - quantity,
    reservedQuantity: snapshot.reservedQuantity - quantity,
  };
}

export function returnGiftInventory(snapshot: GiftInventorySnapshot, quantity: number): GiftInventorySnapshot {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("GIFT_RETURN_INVALID");
  return { ...snapshot, stockQuantity: snapshot.stockQuantity + quantity };
}

export function cancelGiftReservation(snapshot: GiftInventorySnapshot, quantity: number): GiftInventorySnapshot {
  if (!Number.isInteger(quantity) || quantity <= 0 || snapshot.reservedQuantity < quantity) {
    throw new Error("GIFT_CANCEL_INVALID");
  }
  return { ...snapshot, reservedQuantity: snapshot.reservedQuantity - quantity };
}

export function receiveGiftInventory(snapshot: GiftInventorySnapshot, quantity: number): GiftInventorySnapshot {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("GIFT_RECEIVE_INVALID");
  return { ...snapshot, stockQuantity: snapshot.stockQuantity + quantity };
}
