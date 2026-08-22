export type VirtualDeliveryOrderItemType = "physical" | "gift" | "membership";

export function classifyVirtualDeliveryOrder(types: VirtualDeliveryOrderItemType[]): "physical" | "membership" | "mixed" {
  const hasVirtual = types.includes("membership");
  const hasPhysical = types.some((type) => type === "physical" || type === "gift");
  if (hasVirtual && hasPhysical) return "mixed";
  if (hasVirtual) return "membership";
  return "physical";
}

export function needsStockReservation(type: VirtualDeliveryOrderItemType): boolean {
  return type === "physical" || type === "gift";
}

export function shouldCreateManualDeliveryTask(params: { previousPhysicalStatus?: string | null; nextPhysicalStatus?: string; hasVirtualItems: boolean }): boolean {
  return params.hasVirtualItems
    && params.nextPhysicalStatus === "packing"
    && params.previousPhysicalStatus !== "packing";
}

export function buildManualDeliveryCopy(message?: string | null, link?: string | null): string {
  return [message?.trim(), link?.trim()].filter(Boolean).join("\n");
}
