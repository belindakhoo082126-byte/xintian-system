export function composeLiveVariantKeyword(
  productKeyword: string | null | undefined,
  variantKeyword: string | null | undefined,
): string {
  const product = String(productKeyword || "").trim();
  const variant = String(variantKeyword || "").trim();
  if (!product) return variant;
  if (!variant) return product;
  return variant.toLowerCase().startsWith(product.toLowerCase()) ? variant : `${product}${variant}`;
}
