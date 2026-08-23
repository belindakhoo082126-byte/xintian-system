export const SPLITTABLE_PHYSICAL_STATUSES = ["pending", "receipt_uploaded", "partial_payment", "hold_order"] as const;

export type SplitOrderCandidate = {
  orderType?: string | null;
  orderCategory?: string | null;
  physicalStatus?: string | null;
  discountAmount?: string | number | null;
  promotionDiscount?: string | number | null;
  extraCharge?: string | number | null;
};

export function getOrderSplitIneligibility(order: SplitOrderCandidate): string | null {
  if (order.orderType !== "physical" || order.orderCategory === "import") {
    return "目前只支持本地实体订单拆单";
  }
  if (!SPLITTABLE_PHYSICAL_STATUSES.includes((order.physicalStatus || "") as typeof SPLITTABLE_PHYSICAL_STATUSES[number])) {
    return "只有未付款、待审核付款凭证、部分汇款或保留中的订单可以拆单";
  }
  if (Number(order.discountAmount || 0) > 0 || Number(order.promotionDiscount || 0) > 0 || Number(order.extraCharge || 0) > 0) {
    return "含订单级折扣、促销或额外收费的订单不可拆单，请先处理金额后再拆单";
  }
  return null;
}

export function isOrderSplitEligible(order: SplitOrderCandidate): boolean {
  return getOrderSplitIneligibility(order) === null;
}
