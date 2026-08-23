export type PackingCancellationSettlement =
  | { type: "pending_refund"; amount: number }
  | { type: "pending_shipping"; amount: number }
  | { type: "settled"; amount: 0 };

function toMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * 商品在包货、未发货阶段取消后，以已确认付款和重算后的新订单应收额判断财务待办。
 * 正数差额必须进入退款管理；负数差额必须作为待汇款差价，不允许直接修改付款记录。
 */
export function getPackingCancellationSettlement(
  confirmedPaymentAmount: number,
  recalculatedOrderAmount: number,
): PackingCancellationSettlement {
  const difference = toMoney(confirmedPaymentAmount - recalculatedOrderAmount);
  if (difference > 0.01) return { type: "pending_refund", amount: difference };
  if (difference < -0.01) return { type: "pending_shipping", amount: Math.abs(difference) };
  return { type: "settled", amount: 0 };
}

/**
 * 包货进度只以当前订单项目的剩余数量为准。取消商品会先更新订单项目数量，
 * 因此重新读取后不得再保留取消前的待发数量。
 */
export function getRemainingFulfilmentQuantity(
  orderedQuantity: number,
  shippedQuantity: number,
) {
  const ordered = Math.max(0, Math.trunc(Number(orderedQuantity) || 0));
  const shipped = Math.max(0, Math.trunc(Number(shippedQuantity) || 0));
  return Math.max(0, ordered - shipped);
}

/** 待包货且没有任何已发货包裹，才允许改动订单商品。 */
export function getPackingItemCancellationIneligibility(input: {
  physicalStatus?: string | null;
  hasShippedPackage: boolean;
  quantity: number;
  itemQuantity: number;
}) {
  if (input.physicalStatus !== "packing") return "只有待包货、尚未发货的订单可以在包货阶段取消商品";
  if (input.hasShippedPackage) return "订单已有已发货包裹，不能再取消其中商品";
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) return "取消数量必须为正整数";
  if (input.quantity > input.itemQuantity) return "取消数量不可超过订单商品数量";
  return null;
}
