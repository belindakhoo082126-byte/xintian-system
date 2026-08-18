export type OrderSelectionRecord = {
  id: number;
  orderCategory?: "local" | "import" | string | null;
  physicalStatus?: string | null;
  importStatus?: string | null;
};

export function getDisplayOrderStatus(order: OrderSelectionRecord): string | null | undefined {
  return order.orderCategory === "import" ? order.importStatus : order.physicalStatus;
}

export function isCancelledOrder(order: OrderSelectionRecord): boolean {
  return getDisplayOrderStatus(order) === "cancelled";
}

export function getSelectableOrderIds(orders: OrderSelectionRecord[]): number[] {
  return orders.filter(order => !isCancelledOrder(order)).map(order => order.id);
}

/** Order merging is intentionally limited to unpaid local orders and hold orders. */
export function isOrderMergeEligible(order: OrderSelectionRecord): boolean {
  return order.orderCategory !== "import"
    && (order.physicalStatus === "pending" || order.physicalStatus === "hold_order");
}
