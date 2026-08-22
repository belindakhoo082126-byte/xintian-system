/**
 * 西马正式运费规则（V2.2）。
 * 此文件是前端说明与服务端订单计算共用的唯一常量来源。
 */
export const WEST_MALAYSIA_V22_SHIPPING = {
  freeShippingThreshold: 150,
  includedWeightKg: 10,
  baseFeeBelowThreshold: 15,
  additionalKgFee: 3,
} as const;

/**
 * 西马订单的唯一重量／运费明细规则。
 * 首10kg的资格由免邮门槛决定；超过10kg的部分一律向上取整并按RM3／kg计。
 */
export function calculateWestMalaysiaShippingBreakdown(totalWeight: number, freeShippingEligibleSubtotal = 0) {
  const rule = WEST_MALAYSIA_V22_SHIPPING;
  const estimatedWeight = Math.max(0, Number(totalWeight) || 0);
  const freeShipping = freeShippingEligibleSubtotal >= rule.freeShippingThreshold;
  const extraWeightKg = Math.max(0, Math.ceil(estimatedWeight - rule.includedWeightKg));
  const baseShippingFee = estimatedWeight > 0 && !freeShipping ? rule.baseFeeBelowThreshold : 0;
  const extraWeightCharge = extraWeightKg * rule.additionalKgFee;

  return {
    estimatedWeight,
    freeShipping,
    includedWeightKg: rule.includedWeightKg,
    extraWeightKg,
    baseShippingFee,
    extraWeightCharge,
    shippingFee: baseShippingFee + extraWeightCharge,
  };
}

export function getWestMalaysiaV22Specification(): string {
  const rule = WEST_MALAYSIA_V22_SHIPPING;
  return `订单商品金额满 RM${rule.freeShippingThreshold}：首 ${rule.includedWeightKg}kg 免邮，超过部分每公斤加 RM${rule.additionalKgFee}。订单商品金额未满 RM${rule.freeShippingThreshold}：首 ${rule.includedWeightKg}kg 收 RM${rule.baseFeeBelowThreshold}，超过部分每公斤加 RM${rule.additionalKgFee}。`;
}
