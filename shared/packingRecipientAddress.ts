export type PackingRecipientAddress = {
  recipientName?: string | null;
  customerName?: string | null;
  recipientPhone?: string | null;
  customerPhone?: string | null;
  phoneNumber?: string | null;
  addressLine1?: string | null;
  shippingAddress?: string | null;
  recipientAddress?: string | null;
  customerAddress?: string | null;
  postcode?: string | null;
  recipientPostcode?: string | null;
  postalCode?: string | null;
  customerPostalCode?: string | null;
};

/**
 * 订单资料优先；订单仍未填写时，才回退到客户档案中的已保存收件资料。
 * 自取订单不调用此校验，因此不会阻挡免运费自取流程。
 */
export function getMissingPackingRecipientAddressFields(order: PackingRecipientAddress, lang: "zh" | "en") {
  const labels = lang === "zh"
    ? { recipient: "收件人", phone: "收件电话", address: "收件地址", postcode: "邮编" }
    : { recipient: "Recipient", phone: "Recipient phone", address: "Address", postcode: "Postcode" };
  const present = (value: unknown) => String(value || "").trim().length > 0;

  return [
    !present(order.recipientName || order.customerName) ? labels.recipient : null,
    !present(order.recipientPhone || order.customerPhone || order.phoneNumber) ? labels.phone : null,
    !present(order.addressLine1 || order.shippingAddress || order.recipientAddress || order.customerAddress) ? labels.address : null,
    !present(order.postcode || order.recipientPostcode || order.postalCode || order.customerPostalCode) ? labels.postcode : null,
  ].filter(Boolean) as string[];
}
