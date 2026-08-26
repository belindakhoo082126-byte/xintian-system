export type VirtualDeliveryCatalogType = "membership" | "course" | "resource" | "material_kit";

/**
 * Material kits are purchased, stocked, shipped and packed as physical goods.
 * Memberships, courses and digital resources remain non-inventory products.
 */
export function resolveVirtualDeliveryCatalogProductType(deliveryType: VirtualDeliveryCatalogType): "physical" | "membership" {
  return deliveryType === "material_kit" ? "physical" : "membership";
}

export function requiresMaterialKitWeight(deliveryType: VirtualDeliveryCatalogType): boolean {
  return deliveryType === "material_kit";
}
