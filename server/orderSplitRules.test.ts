import { describe, expect, it } from "vitest";
import { getOrderSplitIneligibility, isOrderSplitEligible } from "../shared/orderSplitRules";

describe("order split eligibility", () => {
  it("allows local physical orders before fulfilment", () => {
    expect(isOrderSplitEligible({ orderType: "physical", orderCategory: "local", physicalStatus: "partial_payment" })).toBe(true);
  });

  it("blocks import, virtual and fulfilment-started orders", () => {
    expect(getOrderSplitIneligibility({ orderType: "physical", orderCategory: "import", physicalStatus: "pending" })).toContain("本地实体");
    expect(getOrderSplitIneligibility({ orderType: "membership", orderCategory: "local", physicalStatus: "pending" })).toContain("本地实体");
    expect(getOrderSplitIneligibility({ orderType: "physical", orderCategory: "local", physicalStatus: "packing" })).toContain("未付款");
  });

  it("blocks orders with order-level amount adjustments", () => {
    expect(getOrderSplitIneligibility({ orderType: "physical", orderCategory: "local", physicalStatus: "pending", extraCharge: "1.00" })).toContain("额外收费");
  });
});
