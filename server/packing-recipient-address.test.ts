import { describe, expect, it } from "vitest";
import { getMissingPackingRecipientAddressFields } from "../shared/packingRecipientAddress";

describe("packing recipient address validation", () => {
  it("accepts a saved customer address when the order has no separate recipient address", () => {
    expect(getMissingPackingRecipientAddressFields({
      customerName: "客户甲",
      customerPhone: "0123456789",
      customerAddress: "No 31, Jalan Pantai Jerjak 5",
      customerPostalCode: "11700",
    }, "zh")).toEqual([]);
  });

  it("reports only the precise missing recipient fields", () => {
    expect(getMissingPackingRecipientAddressFields({
      recipientName: "收件人乙",
      recipientPhone: "0112233445",
      addressLine1: "Jalan Test 1",
    }, "zh")).toEqual(["邮编"]);
  });

  it("returns English field labels for the English packing interface", () => {
    expect(getMissingPackingRecipientAddressFields({}, "en")).toEqual([
      "Recipient", "Recipient phone", "Address", "Postcode",
    ]);
  });
});
