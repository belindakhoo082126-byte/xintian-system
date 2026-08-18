import { describe, expect, it } from "vitest";
import { resolveShippableQuantity } from "../shared/shipmentQuantityRules";

describe("包货剩余数量规则", () => {
  it("整单未指定数量时只发出尚未发货的余量", () => {
    expect(resolveShippableQuantity(5, 2)).toBe(3);
  });

  it("允许合法部分发货，并拒绝重复或超量发货", () => {
    expect(resolveShippableQuantity(5, 2, 2)).toBe(2);
    expect(() => resolveShippableQuantity(5, 5, 1)).toThrow("SHIPMENT_ALREADY_FULFILLED");
    expect(() => resolveShippableQuantity(5, 2, 4)).toThrow("SHIPMENT_QUANTITY_EXCEEDS_REMAINING");
  });
});
