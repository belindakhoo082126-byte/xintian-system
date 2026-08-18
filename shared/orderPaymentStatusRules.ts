export type PaymentStatusDecisionInput = {
  currentStatus: string | null | undefined;
  totalPaid: number;
  totalAmount: number;
  shippingMethod: string | null | undefined;
  orderCategory: string | null | undefined;
};

const LOCKED_STATUSES = new Set(["shipped", "completed", "cancelled", "partial_shipped"]);

export function deriveOrderStatusAfterPayment(input: PaymentStatusDecisionInput): string {
  const currentStatus = input.currentStatus || "pending";
  if (LOCKED_STATUSES.has(currentStatus)) return currentStatus;
  if (input.totalPaid >= input.totalAmount && input.totalAmount > 0) {
    // Walk-in self-pickup is the explicit exception: payment confirmation also
    // completes handover, so there is no packing or courier step.
    if (input.shippingMethod === "self_pickup" && input.orderCategory !== "import") return "completed";
    if (currentStatus === "hold_order") return "hold_order";
    if (["pending", "partial_payment", "receipt_uploaded"].includes(currentStatus)) return "packing";
    return currentStatus;
  }
  if (input.totalPaid > 0) return "partial_payment";
  if (["partial_payment", "receipt_uploaded"].includes(currentStatus)) return "pending";
  return currentStatus;
}
