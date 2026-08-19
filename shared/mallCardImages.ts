export function getMallCardImageUrls(
  coverImageUrl?: string | null,
  galleryImageUrls: Array<string | null | undefined> = [],
) {
  return Array.from(new Set([coverImageUrl, ...galleryImageUrls].filter((url): url is string => Boolean(url?.trim()))));
}

