export function resolveVirtualDeliveryPackageCosts<T extends { contentCost: string }>(packages: T[], standaloneProductCost: string): T[] {
  if (packages.length !== 1) return packages;
  return [{ ...packages[0], contentCost: standaloneProductCost }];
}

export function resolveVirtualDeliveryPackageNames<T extends { name: string }>(packages: T[], productName: string): T[] {
  if (packages.length !== 1) return packages;
  return [{ ...packages[0], name: packages[0].name.trim() || productName.trim() }];
}

export function getVirtualDeliveryCostLabel(packageCount: number): "商品成本" | "配套成本" {
  return packageCount === 1 ? "商品成本" : "配套成本";
}
