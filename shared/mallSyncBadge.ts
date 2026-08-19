export function shouldShowMallSyncBadge(product: { syncToMall?: boolean | null }) {
  return product.syncToMall === true;
}

