export type OrderPricingItem = {
  productType?: "physical" | "membership" | "gift" | null;
  priceType?: string | null;
  categoryNameZh?: string | null;
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

export type MerchandiseNotificationBreakdown = {
  normalSubtotal: number;
  specialSubtotal: number;
  freeShippingEligibleSubtotal: number;
};

const asMoney = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const PLANT_CATEGORY_NAMES = new Set([
  "花类", "叶类", "果树", "盆栽", "水种植物", "仙人掌多肉", "多肉及仙人掌",
  "兰花", "香草类及蔬菜", "泰国空气草套装", "茶花", "捕虫/蕨类",
]);

const normalizeCategoryName = (value?: string | null) => String(value || "").replace(/\s+/g, "").trim();

export function isPlantCategory(categoryNameZh?: string | null) {
  return PLANT_CATEGORY_NAMES.has(normalizeCategoryName(categoryNameZh));
}

export function isPlantingMediumCategory(categoryNameZh?: string | null) {
  return normalizeCategoryName(categoryNameZh) === "种植介质";
}

/**
 * Calculates the amount eligible for the RM150 shipping threshold.
 * Membership fees and special-price items are deliberately excluded. When an
 * order includes plants, planting-medium items are also excluded; without a
 * plant, fertilizer and planting medium may combine toward the threshold.
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
  const containsPlant = items.some((item) => item.productType === "physical" && isPlantCategory(item.categoryNameZh));

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
    if (containsPlant && isPlantingMediumCategory(item.categoryNameZh)) continue;
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

/**
 * Produces the three merchandise figures that must be shown together in
 * customer-facing notifications.  Special-price merchandise is deliberately
 * kept separate because it never contributes to the RM150 shipping threshold.
 */
export function calculateMerchandiseNotificationBreakdown(
  items: OrderPricingItem[],
  options: { promotionDiscount?: number | string | null; discountAmount?: number | string | null } = {},
): MerchandiseNotificationBreakdown {
  const breakdown = calculateOrderPriceBreakdown(items, options);
  return {
    normalSubtotal: Math.max(0, breakdown.physicalSubtotal - breakdown.specialSubtotal),
    specialSubtotal: breakdown.specialSubtotal,
    freeShippingEligibleSubtotal: breakdown.freeShippingEligibleSubtotal,
  };
}
