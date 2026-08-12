export const MALL_FAVORITES_STORAGE_KEY = "xintian_mall_favorites";
export const MALL_CART_STORAGE_KEY = "mall_cart";

export type MallCartItem = {
  productId: number;
  quantity: number;
  productName?: string;
  [key: string]: unknown;
};

/**
 * Keeps the cart isolated from favorites and ignores any legacy or malformed
 * browser data which cannot render as a purchasable item.
 */
export function readMallCartItems(rawValue: string | null): MallCartItem[] {
  try {
    const parsed = JSON.parse(rawValue || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is MallCartItem => (
        Boolean(value)
        && typeof value === "object"
        && Number.isInteger(value.productId)
        && value.productId > 0
        && typeof value.productName === "string"
        && Number.isFinite(Number(value.quantity))
        && Number(value.quantity) > 0
      ))
      : [];
  } catch {
    return [];
  }
}

export function getMallCartItemCount(cart: MallCartItem[]): number {
  return cart.reduce((total, item) => total + Math.max(0, Math.floor(Number(item.quantity) || 0)), 0);
}

export function readMallFavoriteIds(rawValue: string | null): number[] {
  try {
    const parsed = JSON.parse(rawValue || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value, index, values) => Number.isInteger(value) && value > 0 && values.indexOf(value) === index)
      : [];
  } catch {
    return [];
  }
}

export function toggleMallFavoriteId(favoriteIds: number[], productId: number): number[] {
  return favoriteIds.includes(productId)
    ? favoriteIds.filter((id) => id !== productId)
    : [...favoriteIds, productId];
}

export function getMallShareLinks({ url, text }: { url: string; text: string }) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  };
}
