export type OrderPricingItem = {
  productType?: "physical" | "membership" | "gift" | null;
  priceType?: string | null;
  quantity?: number | string | null;
  subtotal?: number | string | null;
  originalUnitPrice?: number | string | null;
};

export type OrderPriceBreakdown = {
  physicalSubtotal: number;
  membershipSubtotal: number;
  specialSubtotal: number;
  originalSpecialSubtotal: number;
  freeShippingEligibleSubtotal: number;
};

const asMoney = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Calculates the amount eligible for the RM150 shipping threshold.
 * Membership fees and special-price items are deliberately excluded. Global
 * discounts are conservatively applied to eligible physical merchandise only.
 */
export function calculateOrderPriceBreakdown(
  items: OrderPricingItem[],
  options: { promotionDiscount?: number | string | null; discountAmount?: number | string | null } = {},
): OrderPriceBreakdown {
  let physicalSubtotal = 0;
  let membershipSubtotal = 0;
  let specialSubtotal = 0;
  let originalSpecialSubtotal = 0;
  let eligiblePhysicalSubtotal = 0;

  for (const item of items) {
    const subtotal = asMoney(item.subtotal);
    if (item.productType === "membership") {
      membershipSubtotal += subtotal;
      continue;
    }

    if (item.productType !== "physical" && item.productType !== "gift") continue;
    physicalSubtotal += subtotal;
    if (item.productType === "gift") continue;

    if (item.priceType === "special") {
      specialSubtotal += subtotal;
      const originalUnitPrice = asMoney(item.originalUnitPrice);
      const quantity = asMoney(item.quantity);
      originalSpecialSubtotal += originalUnitPrice > 0 && quantity > 0
        ? originalUnitPrice * quantity
        : subtotal;
      continue;
    }
    eligiblePhysicalSubtotal += subtotal;
  }

  const totalDiscount = Math.max(0, asMoney(options.promotionDiscount)) + Math.max(0, asMoney(options.discountAmount));
  return {
    physicalSubtotal,
    membershipSubtotal,
    specialSubtotal,
    originalSpecialSubtotal,
    freeShippingEligibleSubtotal: Math.max(0, eligiblePhysicalSubtotal - Math.min(eligiblePhysicalSubtotal, totalDiscount)),
  };
}
