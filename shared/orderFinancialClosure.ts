export type FinancialClosureInput = {
  physicalStatus?: string | null;
  specialOrderType?: string | null;
  specialOrderStatus?: string | null;
  hasPendingReturn?: boolean;
};

/**
 * 已发货的实体订单完成最后一项运费财务待办后，才可进入订单已完成。
 * 物流包裹、AWB 与 shippedAt 仍保留，前端应显示“订单已完成（已发货）”。
 */
export function shouldCompleteShippedOrderAfterFinancialFollowUp(input: FinancialClosureInput): boolean {
  if (input.hasPendingReturn) return false;
  if (input.physicalStatus !== "shipped") return false;
  return input.specialOrderType === "pending_shipping" || input.specialOrderType === "pending_refund";
}

/**
 * 7天物流自动完成只能作用于没有未结财务待办的已发货订单。
 * 待汇款差价、待退款或其他处理中事项必须保留在工作队列，直到人工财务收口。
 */
export function shouldAutoCompleteShippedOrder(input: FinancialClosureInput): boolean {
  if (input.physicalStatus !== "shipped") return false;
  return input.specialOrderStatus !== "pending" && input.specialOrderStatus !== "processing";
}
