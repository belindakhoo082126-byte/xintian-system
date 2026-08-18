/**
 * Order-level merging is an order-management action. Packing can handle
 * fulfilment only and must never expose or initiate an order merge.
 */
export function canOpenOrderMergeFromPath(pathname: string): boolean {
  return pathname === "/orders"
    || pathname === "/orders/local"
    || pathname === "/orders/search";
}
