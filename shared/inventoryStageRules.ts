export type StockManagedProductType = "physical" | "gift" | "membership" | null | undefined;

/** Physical merchandise and gifts both occupy real inventory and shipping capacity. */
export function isStockManagedProductType(type: StockManagedProductType): boolean {
  return type === "physical" || type === "gift";
}

export type InventoryOrderStage = "ordered" | "paid" | "completed" | null;

/** Mirrors the mutually exclusive status groups used by product inventory counters. */
export function getInventoryOrderStage(status: string | null | undefined): InventoryOrderStage {
  if (["pending", "hold_order", "partial_payment", "receipt_uploaded"].includes(status || "")) return "ordered";
  if (["packing", "scheduled", "partial_shipped"].includes(status || "")) return "paid";
  if (["shipped", "completed"].includes(status || "")) return "completed";
  return null;
}

/**
 * Returns the quantity that can be sold immediately. Formal physical orders have
 * already reduced stockQuantity; reservedQuantity covers only stock that remains
 * physically on hand but is temporarily protected (for example, gift or draft
 * order reservations). This keeps “等待补货” allocations unavailable for resale.
 */
export function getSellableInventoryQuantity(stockQuantity: unknown, reservedQuantity: unknown = 0): number {
  const stock = Math.floor(Number(stockQuantity) || 0);
  const reserved = Math.max(0, Math.floor(Number(reservedQuantity) || 0));
  return Math.max(0, stock - reserved);
}
