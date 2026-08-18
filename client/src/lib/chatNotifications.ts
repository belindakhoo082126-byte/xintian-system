export type CheckoutNotificationOrder = {
  orderNumber: string;
  secureToken?: string | null;
};

export type ShippingNotificationOrder = {
  orderNumber: string;
  courierCompany?: string | null;
  trackingNumber?: string | null;
};

export function buildCheckoutNotification(order: CheckoutNotificationOrder, origin: string) {
  if (!order.secureToken) return null;
  const checkoutLink = `${origin}/order/${order.orderNumber}/${order.secureToken}`;
  return `您好，感恩您的支持。\n\n目前还没收到您的汇款及确认信息。\n\n请您点击以下链接查询订单（${order.orderNumber}）：\n\n${checkoutLink}\n\n进入订单后，也可以继续到商城加单。\n\n西马消费满 RM150（特价商品除外），10kg 内即可享受免邮优惠。`;
}

export function buildShippingNotification(order: ShippingNotificationOrder) {
  const courierLine = order.courierCompany ? `\n快递公司：${order.courierCompany}` : "";
  const trackingLine = `\n追踪号码：${order.trackingNumber || "暂未提供"}`;
  return `您好，您的订单 ${order.orderNumber} 已安排发货。${courierLine}${trackingLine}\n\n感谢您的耐心等候，如有问题欢迎回复此 Messenger 对话。`;
}
