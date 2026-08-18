/**
 * XLCS Phase 4: Unified Price Engine (统一价格引擎)
 *
 * Rules:
 * 1. If special price is active (within date range), ALL customer types see special price
 * 2. Otherwise, price depends on customer type:
 *    - retail → sellingPrice
 *    - member → memberPrice (falls back to sellingPrice if not set)
 *    - wholesale → wholesalePrice (falls back to sellingPrice × 50% if not set)
 *    - agent → agentPrice (falls back to sellingPrice × 70% if not set)
 * 3. compareAtPrice is always shown as strikethrough (if set)
 */

export type CustomerType = "retail" | "wholesale" | "agent";
export type PriceTier = "retail" | "member" | "wholesale" | "agent";

export interface ProductPricing {
  sellingPrice: string | number | null;
  compareAtPrice: string | number | null;
  memberPrice: string | number | null;
  wholesalePrice: string | number | null;
  agentPrice: string | number | null;
  specialPrice: string | number | null;
  isSpecial: boolean;
  specialPriceStartDate: Date | string | null;
  specialPriceEndDate: Date | string | null;
}

export interface ResolvedPrice {
  /** The final price the customer pays */
  finalPrice: number;
  /** The original price for strikethrough display */
  compareAtPrice: number | null;
  /** Which price tier was used */
  tier: PriceTier;
  /** Whether special price was applied */
  isSpecialPrice: boolean;
  /** Whether this is a member price */
  isMemberPrice: boolean;
  /** Display label for the price tier */
  tierLabel: string;
}

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(v) || 0;
};

/**
 * Check if special price is currently active (within date range)
 */
export function isSpecialPriceActive(product: ProductPricing): boolean {
  if (!product.isSpecial || !product.specialPrice) return false;
  const now = new Date();
  const start = product.specialPriceStartDate ? new Date(product.specialPriceStartDate) : null;
  const end = product.specialPriceEndDate ? new Date(product.specialPriceEndDate) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

/**
 * Resolve the final price for a given customer type
 * This is the core of the unified price engine.
 */
export function resolvePrice(
  product: ProductPricing,
  customerType: CustomerType = "retail",
  isMember: boolean = false
): ResolvedPrice {
  const sellingPrice = num(product.sellingPrice);
  const compareAt = num(product.compareAtPrice);

  // Rule 1: Special price takes priority over ALL tiers
  if (isSpecialPriceActive(product)) {
    return {
      finalPrice: num(product.specialPrice),
      compareAtPrice: compareAt || sellingPrice,
      tier: "retail",
      isSpecialPrice: true,
      isMemberPrice: false,
      tierLabel: "特价",
    };
  }

  // Rule 2: Price by customer type
  if (customerType === "wholesale") {
    const wholesale = num(product.wholesalePrice);
    // Fallback: auto-calculate as sellingPrice × 50% if not set
    const finalWholesale = wholesale > 0 ? wholesale : sellingPrice * 0.5;
    return {
      finalPrice: finalWholesale,
      compareAtPrice: compareAt || sellingPrice,
      tier: "wholesale",
      isSpecialPrice: false,
      isMemberPrice: false,
      tierLabel: "批发价",
    };
  }

  if (customerType === "agent") {
    const agent = num(product.agentPrice);
    // Fallback: auto-calculate as sellingPrice × 70% if not set
    const finalAgent = agent > 0 ? agent : sellingPrice * 0.7;
    return {
      finalPrice: finalAgent,
      compareAtPrice: compareAt || sellingPrice,
      tier: "agent",
      isSpecialPrice: false,
      isMemberPrice: false,
      tierLabel: "代理价",
    };
  }

  // Member price (via member price link, not a customer type)
  if (isMember && product.memberPrice) {
    const member = num(product.memberPrice);
    if (member > 0) {
      return {
        finalPrice: member,
        compareAtPrice: compareAt || sellingPrice,
        tier: "member",
        isSpecialPrice: false,
        isMemberPrice: true,
        tierLabel: "会员价",
      };
    }
  }

  // Default: retail price
  return {
    finalPrice: sellingPrice,
    compareAtPrice: compareAt > 0 ? compareAt : null,
    tier: "retail",
    isSpecialPrice: false,
    isMemberPrice: false,
    tierLabel: "零售价",
  };
}

/**
 * Check if a product is visible to a given customer type
 */
export function isProductVisibleTo(
  visibleTo: string | null,
  customerType: CustomerType,
  isMember: boolean = false
): boolean {
  if (!visibleTo) {
    // Default: visible to all
    return true;
  }
  try {
    const audiences: string[] = JSON.parse(visibleTo);
    if (audiences.includes("retail") && customerType === "retail" && !isMember) return true;
    if (audiences.includes("member") && isMember) return true;
    if (audiences.includes("wholesale") && customerType === "wholesale") return true;
    if (audiences.includes("agent") && customerType === "agent") return true;
    return false;
  } catch {
    return true; // Invalid JSON = visible to all
  }
}

/**
 * Auto-calculate wholesale and agent prices from selling price
 */
export function autoCalculatePrices(sellingPrice: number): {
  wholesalePrice: number;
  agentPrice: number;
} {
  return {
    wholesalePrice: Math.round(sellingPrice * 0.5 * 100) / 100,
    agentPrice: Math.round(sellingPrice * 0.7 * 100) / 100,
  };
}

/**
 * Check if MOQ is met for a given quantity
 */
export function isMoqMet(moq: number, quantity: number): boolean {
  if (moq <= 0) return true; // No MOQ set
  return quantity >= moq;
}

/**
 * Get all price tiers for a product (for admin price preview)
 */
export function getAllPriceTiers(product: ProductPricing): Array<{
  tier: PriceTier;
  label: string;
  price: number;
  isSpecial: boolean;
}> {
  const sellingPrice = num(product.sellingPrice);
  const tiers: Array<{ tier: PriceTier; label: string; price: number; isSpecial: boolean }> = [];

  // Special price (if active)
  if (isSpecialPriceActive(product)) {
    tiers.push({
      tier: "retail",
      label: "特价（所有客户）",
      price: num(product.specialPrice),
      isSpecial: true,
    });
    return tiers; // Special price overrides all
  }

  // Retail
  tiers.push({
    tier: "retail",
    label: "普通客户",
    price: sellingPrice,
    isSpecial: false,
  });

  // Member
  const member = num(product.memberPrice);
  tiers.push({
    tier: "member",
    label: "会员",
    price: member > 0 ? member : sellingPrice,
    isSpecial: false,
  });

  // Wholesale
  const wholesale = num(product.wholesalePrice);
  tiers.push({
    tier: "wholesale",
    label: "批发客户",
    price: wholesale > 0 ? wholesale : Math.round(sellingPrice * 0.5 * 100) / 100,
    isSpecial: false,
  });

  // Agent
  const agent = num(product.agentPrice);
  tiers.push({
    tier: "agent",
    label: "代理商",
    price: agent > 0 ? agent : Math.round(sellingPrice * 0.7 * 100) / 100,
    isSpecial: false,
  });

  return tiers;
}
