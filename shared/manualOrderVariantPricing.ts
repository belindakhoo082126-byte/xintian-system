import { resolveManualOrderItemPrice, type ManualOrderNature, type ManualOrderPriceSource } from "./manualOrderPricing";

export type ManualOrderVariantPriceSource = {
  sellingPrice?: string | number | null;
  weight?: string | number | null;
  keyword?: string | null;
  imageUrl?: string | null;
};

/**
 * A product-level special price applies consistently to every active variant,
 * while an ordinary retail price must come from the selected variant itself.
 */
export function resolveManualOrderVariantPrice(
  product: ManualOrderPriceSource,
  variant: ManualOrderVariantPriceSource,
  orderNature: ManualOrderNature,
) {
  return resolveManualOrderItemPrice({
    ...product,
    sellingPrice: variant.sellingPrice ?? product.sellingPrice ?? product.regularPrice,
  }, orderNature);
}
