import { describe, expect, it } from "vitest";
import { formatPurchaseOrderQuantityInput, parsePurchaseOrderQuantityInput } from "./purchaseOrderQuantity";

describe("进货单数量输入", () => {
  it("允许清空数量为0而不会留下前导零", () => {
    expect(parsePurchaseOrderQuantityInput("")).toBe(0);
    expect(formatPurchaseOrderQuantityInput(0)).toBe("");
    expect(parsePurchaseOrderQuantityInput("2")).toBe(2);
    expect(formatPurchaseOrderQuantityInput(2)).toBe("2");
  });
});
