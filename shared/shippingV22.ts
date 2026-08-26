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

export type WestMalaysiaShippingParameters = {
  freeShippingThreshold: number;
  includedWeightKg: number;
  baseFeeBelowThreshold: number;
  additionalKgFee: number;
};

/** Lalamove first RM15 is always borne by the company. */
export const LALAMOVE_COMPANY_BEARING = 15;

/** Customers only pay the actual Lalamove amount above the company bearing after packing. */
export function calculateLalamoveCheckoutCustomerShipping(_companyBearingFee = LALAMOVE_COMPANY_BEARING) {
  return 0;
}

/**
 * Converts the packed Lalamove actual delivery fee into the only amount the
 * customer still owes. The company bears the first RM15, and a lower actual
 * fee must never create either a refund or a negative customer balance.
 */
export function calculateLalamoveActualCustomerBalance(actualDeliveryFee: number, companyBearingFee = LALAMOVE_COMPANY_BEARING) {
  const actualShippingFee = Math.max(0, Number(actualDeliveryFee) || 0);
  const customerBalance = Math.max(0, actualShippingFee - Math.max(0, Number(companyBearingFee) || 0));
  return {
    actualShippingFee,
    customerBalance,
    needsSpecialOrder: customerBalance > 0.01,
  };
}

/**
 * 西马订单的唯一重量／运费明细规则。
 * 首10kg的资格由免邮门槛决定；超过10kg的部分一律向上取整并按RM3／kg计。
 */
export function calculateWestMalaysiaShippingBreakdown(
  totalWeight: number,
  freeShippingEligibleSubtotal = 0,
  configuredRule: Partial<WestMalaysiaShippingParameters> = WEST_MALAYSIA_V22_SHIPPING,
) {
  const rule = { ...WEST_MALAYSIA_V22_SHIPPING, ...configuredRule };
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

export function getWestMalaysiaV22Specification(configuredRule: Partial<WestMalaysiaShippingParameters> = WEST_MALAYSIA_V22_SHIPPING): string {
  const rule = { ...WEST_MALAYSIA_V22_SHIPPING, ...configuredRule };
  return `订单商品金额满 RM${rule.freeShippingThreshold}：首 ${rule.includedWeightKg}kg 免邮，超过部分每公斤加 RM${rule.additionalKgFee}。订单商品金额未满 RM${rule.freeShippingThreshold}：首 ${rule.includedWeightKg}kg 收 RM${rule.baseFeeBelowThreshold}，超过部分每公斤加 RM${rule.additionalKgFee}。`;
}

export function getWestMalaysiaFreeShippingEligibilitySpecification(
  configuredRule: Partial<WestMalaysiaShippingParameters> = WEST_MALAYSIA_V22_SHIPPING,
): string {
  const rule = { ...WEST_MALAYSIA_V22_SHIPPING, ...configuredRule };
  return `免邮资格：特价商品不计入RM${rule.freeShippingThreshold}；订单含植物时，种植介质不计入门槛。植物与种植介质同单且合资格普通商品达到RM${rule.freeShippingThreshold}时，必须取消种植介质或另开订单后才可结账；没有植物时，种植介质可与肥料等普通商品合计免邮。`;
}

export function getLalamoveSettlementSpecification(companyBearingFee = LALAMOVE_COMPANY_BEARING): string {
  return `Lalamove结账时客户运费为RM0，公司先承担RM${companyBearingFee}；包货后填写实际配送费用，只有超过RM${companyBearingFee}的部分才向客户补收。实际费用不超过RM${companyBearingFee}时不补收也不退款。`;
}
