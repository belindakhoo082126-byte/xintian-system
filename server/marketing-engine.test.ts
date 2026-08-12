import { describe, expect, it } from "vitest";
import { evaluateMarketingCampaign, getMarketingThresholdGap, type MarketingCampaignInput } from "./marketingEngine";

const campaign = (rules: MarketingCampaignInput["rules"], overrides: Partial<MarketingCampaignInput> = {}): MarketingCampaignInput => ({
  id: 101,
  allowMemberPriceStack: false,
  allowBundlePriceStack: false,
  allowCouponStack: false,
  rules,
  ...overrides,
});

describe("marketingEngine", () => {
  it("prevents a campaign discount from silently stacking with member price", () => {
    const result = evaluateMarketingCampaign(campaign([{ id: 1, campaignId: 101, ruleType: "product_discount", priority: 1, stackable: false, config: { discountKind: "percent", discountValue: 10 }, scopes: [] }]), [{ productId: 10, quantity: 2, unitPrice: 20 }], { isMemberPriceApplied: true });
    expect(result).toMatchObject({ eligible: false, blockedReason: "活动不允许与会员价叠加", subtotal: 40, discountTotal: 0 });
  });

  it("uses the current unified price and does not double-discount a product by default", () => {
    const result = evaluateMarketingCampaign(campaign([
      { id: 1, campaignId: 101, ruleType: "product_discount", priority: 1, stackable: false, config: { discountKind: "percent", discountValue: 10 }, scopes: [{ scopeType: "eligible_product", productId: 10 }] },
      { id: 2, campaignId: 101, ruleType: "clearance", priority: 2, stackable: false, config: { discountKind: "fixed", discountValue: 8 }, scopes: [{ scopeType: "eligible_product", productId: 10 }] },
    ]), [{ productId: 10, quantity: 2, unitPrice: 30 }]);
    expect(result.discountTotal).toBe(6);
    expect(result.finalSubtotal).toBe(54);
    expect(result.appliedRuleIds).toEqual([1]);
  });

  it("calculates quantity gifts as entitlements and never presents them as a stock mutation", () => {
    const result = evaluateMarketingCampaign(campaign([{ id: 3, campaignId: 101, ruleType: "quantity_gift", priority: 1, stackable: false, config: { triggerQuantity: 3 }, scopes: [{ scopeType: "trigger_product", productId: 10 }, { scopeType: "gift_product", productId: 88, quantity: 2 }] }]), [{ productId: 10, quantity: 7, unitPrice: 10 }]);
    expect(result.discountTotal).toBe(0);
    expect(result.entitlements).toContainEqual(expect.objectContaining({ type: "gift", productId: 88, quantity: 4, unitPrice: 0 }));
  });

  it("returns add-on offers and lottery entries only after their spending thresholds are met", () => {
    const rules: MarketingCampaignInput["rules"] = [
      { id: 4, campaignId: 101, ruleType: "add_on", priority: 1, stackable: false, config: { triggerAmount: 50, addOnPrice: 5 }, scopes: [{ scopeType: "add_on_product", productId: 60, quantity: 1 }] },
      { id: 5, campaignId: 101, ruleType: "spin_eligibility", priority: 2, stackable: false, config: { thresholdAmount: 80, entryCount: 2 }, scopes: [] },
    ];
    expect(evaluateMarketingCampaign(campaign(rules), [{ productId: 10, quantity: 1, unitPrice: 49 }]).entitlements).toHaveLength(0);
    const result = evaluateMarketingCampaign(campaign(rules), [{ productId: 10, quantity: 2, unitPrice: 50 }]);
    expect(result.entitlements).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "add_on_offer", productId: 60, unitPrice: 5 }),
      expect.objectContaining({ type: "lottery_entry", entryCount: 2 }),
    ]));
  });

  it("calculates a non-negative threshold gap for safe storefront guidance", () => {
    expect(getMarketingThresholdGap(150, 128.65)).toBe(21.35);
    expect(getMarketingThresholdGap(150, 180)).toBe(0);
  });
});
