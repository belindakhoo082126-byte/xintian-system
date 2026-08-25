export function parsePurchaseOrderQuantityInput(value: string): number {
  if (value.trim() === "") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function formatPurchaseOrderQuantityInput(quantity: number): string {
  return Number(quantity) > 0 ? String(Math.floor(Number(quantity))) : "";
}
