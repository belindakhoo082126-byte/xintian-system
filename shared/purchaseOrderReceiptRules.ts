export type PurchaseOrderReceiptStatus = "draft" | "ordered" | "received" | "cancelled";

export function getPurchaseOrderReceiptDecision(status: PurchaseOrderReceiptStatus): "receive" | "already_received" | "reject" {
  if (status === "ordered") return "receive";
  if (status === "received") return "already_received";
  return "reject";
}
