export type MallDetailGalleryImage = { id: number | string; url?: string | null; imageUrl?: string | null };

export function getMallDetailGalleryImages(images: MallDetailGalleryImage[] | null | undefined) {
  return (images || [])
    .map((image, index) => ({ id: image.id ?? index, url: image.url?.trim() || image.imageUrl?.trim() || "" }))
    .filter((image) => Boolean(image.url));
}

export function getMallDetailDisplayImage(
  coverImageUrl?: string | null,
  selectedGalleryImageUrl?: string | null,
  selectedVariantImageUrl?: string | null,
) {
  return selectedVariantImageUrl?.trim() || selectedGalleryImageUrl?.trim() || coverImageUrl?.trim() || "";
}

