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
