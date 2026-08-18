/**
 * Marketing Center — deterministic pricing and entitlement engine.
 *
 * This module is intentionally pure: it never changes stock, orders, credit or
 * payments. Callers must run the resulting purchasable gift/add-on items through
 * the existing server-side inventory service before an order is saved.
 */

export type MarketingRuleType =
  | "quantity_gift"
  | "nth_item_discount"
  | "order_threshold"
  | "spin_eligibility"
  | "add_on"
  | "product_discount"
  | "category_discount"
  | "clearance"
  | "live_lottery"
  | "member_offer";

export type DiscountKind = "percent" | "fixed";

export interface MarketingCartLine {
  productId: number;
  categoryId?: number | null;
  quantity: number;
  /** Current unified price, after the existing member/special-price engine. */
  unitPrice: number;
  /** Snapshot cost used by callers for profit preview, never used to change price. */
  unitCost?: number;
}

export interface RuleScope {
  scopeType: "trigger_product" | "eligible_product" | "eligible_category" | "gift_product" | "add_on_product";
  productId?: number | null;
  categoryId?: number | null;
  quantity?: number;
}

export interface MarketingRuleInput {
  id: number;
  campaignId: number;
  ruleType: MarketingRuleType;
  priority: number;
  stackable: boolean;
  /** Validated JSON configuration kept versioned in the database. */
  config: Record<string, unknown>;
  scopes: RuleScope[];
}

export interface MarketingCampaignInput {
  id: number;
  allowMemberPriceStack: boolean;
  allowBundlePriceStack: boolean;
  allowCouponStack: boolean;
  perOrderLimit?: number | null;
  rules: MarketingRuleInput[];
}

export interface MarketingContext {
  isMemberPriceApplied?: boolean;
  isBundlePriceApplied?: boolean;
  couponApplied?: boolean;
  orderSource?: string;
  orderCategory?: string;
}

export interface MarketingDiscount {
  ruleId: number;
  campaignId: number;
  productId: number;
  amount: number;
  reason: string;
}

export interface MarketingEntitlement {
  ruleId: number;
  campaignId: number;
  type: "gift" | "add_on_offer" | "lottery_entry" | "free_shipping";
  productId?: number;
  quantity?: number;
  unitPrice?: number;
  entryCount?: number;
  reason: string;
}

export interface MarketingEvaluation {
  eligible: boolean;
  blockedReason?: string;
  subtotal: number;
  discountTotal: number;
  finalSubtotal: number;
  discounts: MarketingDiscount[];
  entitlements: MarketingEntitlement[];
  appliedRuleIds: number[];
}

const money = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const positiveInt = (value: unknown, fallback = 1) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const nonNegative = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

function productScope(rule: MarketingRuleInput, kind: RuleScope["scopeType"]): RuleScope[] {
  return rule.scopes.filter((scope) => scope.scopeType === kind);
}

function eligibleLines(rule: MarketingRuleInput, cart: MarketingCartLine[]): MarketingCartLine[] {
  const productScopes = productScope(rule, "eligible_product");
  const categoryScopes = productScope(rule, "eligible_category");
  const triggerScopes = productScope(rule, "trigger_product");
  const allowedProducts = [...productScopes, ...triggerScopes]
    .map((scope) => scope.productId)
    .filter((id): id is number => typeof id === "number");
  const allowedCategories = categoryScopes
    .map((scope) => scope.categoryId)
    .filter((id): id is number => typeof id === "number");

  // An empty scope explicitly means campaign-wide eligibility, not no eligibility.
  if (!allowedProducts.length && !allowedCategories.length) return cart;
  return cart.filter((line) => allowedProducts.includes(line.productId) || (line.categoryId != null && allowedCategories.includes(line.categoryId)));
}

function discountFor(amount: number, kind: unknown, value: unknown): number {
  const requested = kind === "percent"
    ? amount * Math.min(100, nonNegative(value)) / 100
    : nonNegative(value);
  return money(Math.max(0, Math.min(amount, requested)));
}

function rulesCanStack(campaign: MarketingCampaignInput, context: MarketingContext): string | null {
  if (context.isMemberPriceApplied && !campaign.allowMemberPriceStack) return "活动不允许与会员价叠加";
  if (context.isBundlePriceApplied && !campaign.allowBundlePriceStack) return "活动不允许与组合价叠加";
  if (context.couponApplied && !campaign.allowCouponStack) return "活动不允许与优惠券叠加";
  return null;
}

/**
 * Evaluates an already-priced cart. One item unit may only receive one discount
 * unless both rules declare stackable; this prevents implicit double discount.
 */
export function evaluateMarketingCampaign(
  campaign: MarketingCampaignInput,
  cart: MarketingCartLine[],
  context: MarketingContext = {},
): MarketingEvaluation {
  const blockedReason = rulesCanStack(campaign, context);
  const subtotal = money(cart.reduce((sum, line) => sum + Math.max(0, line.quantity) * Math.max(0, line.unitPrice), 0));
  if (blockedReason) {
    return { eligible: false, blockedReason, subtotal, discountTotal: 0, finalSubtotal: subtotal, discounts: [], entitlements: [], appliedRuleIds: [] };
  }

  const discounts: MarketingDiscount[] = [];
  const entitlements: MarketingEntitlement[] = [];
  const appliedRuleIds = new Set<number>();
  const discountedProducts = new Map<number, boolean>();
  const sortedRules = campaign.rules.slice().sort((a, b) => a.priority - b.priority || a.id - b.id);

  for (const rule of sortedRules) {
    const lines = eligibleLines(rule, cart);
    if (!lines.length) continue;
    const config = rule.config || {};
    const markApplied = () => appliedRuleIds.add(rule.id);
    const canDiscountLine = (line: MarketingCartLine) => rule.stackable || !discountedProducts.get(line.productId);
    const addDiscount = (line: MarketingCartLine, amount: number, reason: string) => {
      if (amount <= 0 || !canDiscountLine(line)) return;
      discounts.push({ ruleId: rule.id, campaignId: campaign.id, productId: line.productId, amount: money(amount), reason });
      discountedProducts.set(line.productId, true);
      markApplied();
    };

    if (rule.ruleType === "product_discount" || rule.ruleType === "category_discount" || rule.ruleType === "clearance" || rule.ruleType === "member_offer") {
      for (const line of lines) {
        const amount = discountFor(line.unitPrice * line.quantity, config.discountKind, config.discountValue);
        addDiscount(line, amount, "商品营销优惠");
      }
      continue;
    }

    if (rule.ruleType === "nth_item_discount") {
      const every = positiveInt(config.nthItem, 2);
      for (const line of lines) {
        const eligibleUnits = Math.floor(Math.max(0, line.quantity) / every);
        if (!eligibleUnits) continue;
        const amount = discountFor(line.unitPrice * eligibleUnits, config.discountKind, config.discountValue);
        addDiscount(line, amount, `每满 ${every} 件优惠`);
      }
      continue;
    }

    if (rule.ruleType === "quantity_gift") {
      const triggerQuantity = positiveInt(config.triggerQuantity, 1);
      const triggerCount = lines.reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
      const times = Math.floor(triggerCount / triggerQuantity);
      const giftScope = productScope(rule, "gift_product")[0];
      if (times && giftScope?.productId) {
        entitlements.push({
          ruleId: rule.id,
          campaignId: campaign.id,
          type: "gift",
          productId: giftScope.productId,
          quantity: times * positiveInt(giftScope.quantity, positiveInt(config.giftQuantity, 1)),
          unitPrice: 0,
          reason: `购买满 ${triggerQuantity} 件赠品资格`,
        });
        markApplied();
      }
      continue;
    }

    if (rule.ruleType === "order_threshold" || rule.ruleType === "spin_eligibility") {
      const threshold = nonNegative(config.thresholdAmount);
      if (subtotal < threshold) continue;
      if (rule.ruleType === "spin_eligibility") {
        entitlements.push({ ruleId: rule.id, campaignId: campaign.id, type: "lottery_entry", entryCount: positiveInt(config.entryCount, 1), reason: `订单满 RM${threshold.toFixed(2)} 获得抽奖资格` });
        markApplied();
      } else if (config.benefitType === "free_shipping") {
        entitlements.push({ ruleId: rule.id, campaignId: campaign.id, type: "free_shipping", reason: `订单满 RM${threshold.toFixed(2)} 免运费活动` });
        markApplied();
      } else if (config.benefitType === "gift") {
        const giftScope = productScope(rule, "gift_product")[0];
        if (giftScope?.productId) {
          entitlements.push({ ruleId: rule.id, campaignId: campaign.id, type: "gift", productId: giftScope.productId, quantity: positiveInt(giftScope.quantity, 1), unitPrice: 0, reason: `订单满 RM${threshold.toFixed(2)} 赠品资格` });
          markApplied();
        }
      } else {
        const pseudoLine: MarketingCartLine = { productId: 0, quantity: 1, unitPrice: subtotal };
        const amount = discountFor(subtotal, config.discountKind, config.discountValue);
        if (amount > 0) {
          discounts.push({ ruleId: rule.id, campaignId: campaign.id, productId: 0, amount, reason: `订单满 RM${threshold.toFixed(2)} 优惠` });
          markApplied();
        }
        void pseudoLine;
      }
      continue;
    }

    if (rule.ruleType === "add_on") {
      const threshold = nonNegative(config.triggerAmount);
      const hasMinimumSpend = subtotal >= threshold;
      const addOnScopes = productScope(rule, "add_on_product");
      if (hasMinimumSpend && addOnScopes.length) {
        for (const scope of addOnScopes) {
          if (scope.productId == null) continue;
          entitlements.push({
            ruleId: rule.id,
            campaignId: campaign.id,
            type: "add_on_offer",
            productId: scope.productId,
            quantity: positiveInt(scope.quantity, 1),
            unitPrice: money(nonNegative(config.addOnPrice)),
            reason: "符合加价购资格；加入订单前仍须通过库存验证",
          });
        }
        markApplied();
      }
    }
  }

  const discountTotal = money(discounts.reduce((sum, discount) => sum + discount.amount, 0));
  return {
    eligible: appliedRuleIds.size > 0,
    subtotal,
    discountTotal,
    finalSubtotal: money(Math.max(0, subtotal - discountTotal)),
    discounts,
    entitlements,
    appliedRuleIds: Array.from(appliedRuleIds),
  };
}

/** Returns only safe purchaser guidance; it never reserves or changes inventory. */
export function getMarketingThresholdGap(thresholdAmount: number, cartSubtotal: number): number {
  return money(Math.max(0, nonNegative(thresholdAmount) - nonNegative(cartSubtotal)));
}
