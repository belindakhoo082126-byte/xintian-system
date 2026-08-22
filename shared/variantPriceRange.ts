export type VariantPriceCandidate = {
  sellingPrice?: string | number | null;
  status?: string | null;
};

export function getActiveVariantPriceRange(variants: VariantPriceCandidate[] | undefined) {
  const prices = (variants || [])
    .filter((variant) => variant.status === "active")
    .map((variant) => Number(variant.sellingPrice))
    .filter((price) => Number.isFinite(price) && price >= 0);
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function formatRmPrice(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatVariantPriceRange(variants: VariantPriceCandidate[] | undefined, fallbackPrice?: string | number | null) {
  const range = getActiveVariantPriceRange(variants);
  if (!range) return `RM ${fallbackPrice || "0"}`;
  return range.min === range.max
    ? `RM ${formatRmPrice(range.min)}`
    : `RM ${formatRmPrice(range.min)}–${formatRmPrice(range.max)}`;
}
