export type SpecialOrderDisplayLabel = {
  zh: string;
  en: string;
  className: string;
};

const DEFAULT_REASON: SpecialOrderDisplayLabel = {
  zh: "其他异常",
  en: "Other Exception",
  className: "bg-slate-100 text-slate-700 border-slate-300",
};

export const SPECIAL_ORDER_REASON_LABELS: Record<string, SpecialOrderDisplayLabel> = {
  over_payment: { zh: "多汇款", en: "Overpayment", className: "bg-red-100 text-red-700 border-red-300" },
  under_payment: { zh: "少汇款", en: "Underpayment", className: "bg-orange-100 text-orange-700 border-orange-300" },
  partial_payment: { zh: "少汇款／部分汇款", en: "Underpayment / Partial Payment", className: "bg-orange-100 text-orange-700 border-orange-300" },
  pending_shipping_fee: { zh: "待补运费", en: "Pending Shipping Fee", className: "bg-amber-100 text-amber-700 border-amber-300" },
  pending_shipping: { zh: "待补运费", en: "Pending Shipping Fee", className: "bg-amber-100 text-amber-700 border-amber-300" },
  overcharged_shipping: { zh: "运费多收", en: "Overcharged Shipping", className: "bg-red-100 text-red-700 border-red-300" },
  refund_pending: { zh: "待退款", en: "Pending Refund", className: "bg-red-100 text-red-700 border-red-300" },
  pending_refund: { zh: "待退款", en: "Pending Refund", className: "bg-red-100 text-red-700 border-red-300" },
  price_change: { zh: "金额变更", en: "Price Change", className: "bg-rose-100 text-rose-700 border-rose-300" },
  amount_changed: { zh: "金额变更", en: "Amount Changed", className: "bg-rose-100 text-rose-700 border-rose-300" },
  logistics_issue: { zh: "物流异常", en: "Logistics Issue", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  logistics_error: { zh: "物流异常", en: "Logistics Issue", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  data_issue: { zh: "资料异常", en: "Data Issue", className: "bg-blue-100 text-blue-700 border-blue-300" },
  incomplete_info: { zh: "资料异常", en: "Incomplete Information", className: "bg-blue-100 text-blue-700 border-blue-300" },
  stock_exception: { zh: "库存异常", en: "Stock Exception", className: "bg-violet-100 text-violet-700 border-violet-300" },
  notification_failed: { zh: "通知失败", en: "Notification Failed", className: "bg-purple-100 text-purple-700 border-purple-300" },
  overdue: { zh: "超时未处理", en: "Overdue", className: "bg-red-100 text-red-700 border-red-300" },
  other: DEFAULT_REASON,
};

/**
 * 用户在订单管理和包货工作台可直接筛选的特别订单原因。
 * 保留数据库中的其他原因类型在「全部原因」中可见，避免把旧订单隐藏。
 */
export const SPECIAL_ORDER_FILTER_OPTIONS = [
  { value: "pending_shipping", zh: "待补运费", en: "Pending Shipping Fee" },
  { value: "pending_refund", zh: "待退款", en: "Pending Refund" },
  { value: "logistics_error", zh: "物流异常", en: "Logistics Error" },
  { value: "incomplete_info", zh: "客户资料不完整", en: "Incomplete Customer Information" },
  { value: "notification_failed", zh: "自动通知失败", en: "Automatic Notification Failed" },
  { value: "over_payment", zh: "多汇款", en: "Overpayment" },
  { value: "amount_changed", zh: "金额异常", en: "Amount Exception" },
] as const;

export function getSpecialOrderReasonLabel(type?: string | null): SpecialOrderDisplayLabel {
  return (type && SPECIAL_ORDER_REASON_LABELS[type]) || DEFAULT_REASON;
}

export function isSpecialOrderResolved(isResolved?: boolean | null, status?: string | null): boolean {
  return isResolved === true || status === "resolved";
}

export function getSpecialOrderHandlingLabel(isResolved?: boolean | null, status?: string | null): SpecialOrderDisplayLabel {
  return isSpecialOrderResolved(isResolved, status)
    ? { zh: "已处理", en: "Resolved", className: "bg-emerald-100 text-emerald-700 border-emerald-300" }
    : { zh: "待处理", en: "Pending", className: "bg-orange-100 text-orange-700 border-orange-300" };
}
