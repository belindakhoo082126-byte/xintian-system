import { describe, expect, it } from "vitest";
import { calculateVirtualDeliveryProfit } from "../shared/virtualDeliveryProfit";

describe("calculateVirtualDeliveryProfit", () => {
  it("uses the selected package cost and keeps discounts out of virtual delivery profit", () => {
    expect(calculateVirtualDeliveryProfit({
      quantity: 2,
      subtotal: "100.00",
      itemDiscount: "10.00",
      marketingDiscount: "5.00",
      contentCostPerUnit: "12.50",
    })).toEqual({ revenueNet: "85.00", contentCost: "25.00", profitAmount: "60.00" });
  });

  it("never reports a negative net revenue when discounts exceed the item subtotal", () => {
    expect(calculateVirtualDeliveryProfit({
      quantity: 1,
      subtotal: "10.00",
      itemDiscount: "12.00",
      contentCostPerUnit: "3.00",
    })).toEqual({ revenueNet: "0.00", contentCost: "3.00", profitAmount: "-3.00" });
  });
});
