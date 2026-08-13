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

export function getWestMalaysiaV22Specification(): string {
  const rule = WEST_MALAYSIA_V22_SHIPPING;
  return `订单商品金额满 RM${rule.freeShippingThreshold}：首 ${rule.includedWeightKg}kg 免邮，超过部分每公斤加 RM${rule.additionalKgFee}。订单商品金额未满 RM${rule.freeShippingThreshold}：首 ${rule.includedWeightKg}kg 收 RM${rule.baseFeeBelowThreshold}，超过部分每公斤加 RM${rule.additionalKgFee}。`;
}
