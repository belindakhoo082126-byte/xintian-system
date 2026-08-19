export function getMallDetailMainImage(
  productCoverImageUrl?: string | null,
  selectedVariantImageUrl?: string | null,
) {
  return selectedVariantImageUrl?.trim() || productCoverImageUrl?.trim() || "";
}

