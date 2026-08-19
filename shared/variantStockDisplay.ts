export function getVariantStockQuantity(value: number | string | null | undefined) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? quantity : 0;
}

