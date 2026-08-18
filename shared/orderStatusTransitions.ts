export const PHYSICAL_ORDER_STATUSES = [
  "pending",
  "receipt_uploaded",
  "partial_payment",
  "hold_order",
  "packing",
  "scheduled",
  "partial_shipped",
  "shipped",
  "completed",
  "cancelled",
  "special",
] as const;

export type PhysicalOrderStatus = (typeof PHYSICAL_ORDER_STATUSES)[number];

const transitions: Record<PhysicalOrderStatus, readonly PhysicalOrderStatus[]> = {
  pending: ["pending", "receipt_uploaded", "partial_payment", "hold_order", "cancelled", "special"],
  receipt_uploaded: ["receipt_uploaded", "partial_payment", "hold_order", "packing", "cancelled", "special"],
  partial_payment: ["partial_payment", "receipt_uploaded", "hold_order", "cancelled", "special"],
  hold_order: ["hold_order", "pending", "receipt_uploaded", "partial_payment", "cancelled", "special"],
  packing: ["packing", "scheduled", "partial_shipped", "shipped", "cancelled", "special"],
  scheduled: ["scheduled", "packing", "partial_shipped", "shipped", "cancelled", "special"],
  partial_shipped: ["partial_shipped", "shipped", "completed", "special"],
  shipped: ["shipped", "completed", "special"],
  completed: ["completed"],
  cancelled: ["cancelled"],
  special: ["special", "pending", "receipt_uploaded", "partial_payment", "hold_order", "packing", "scheduled", "partial_shipped", "shipped", "completed", "cancelled"],
};

export function isPhysicalOrderStatus(value: string): value is PhysicalOrderStatus {
  return (PHYSICAL_ORDER_STATUSES as readonly string[]).includes(value);
}

export function isAllowedPhysicalOrderStatusTransition(from: string | null | undefined, to: string): boolean {
  if (!isPhysicalOrderStatus(to)) return false;
  const candidateFrom = from || "pending";
  const normalizedFrom: PhysicalOrderStatus = isPhysicalOrderStatus(candidateFrom) ? candidateFrom : "pending";
  return transitions[normalizedFrom].includes(to);
}
