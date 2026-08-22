/** A multi-variant product's total stock is always the sum of its variant stocks. */
export function sumVariantStock(variantStocks: Array<number | null | undefined>): number {
  return variantStocks.reduce<number>((total, stock) => total + Math.max(0, Math.trunc(Number(stock) || 0)), 0);
}
