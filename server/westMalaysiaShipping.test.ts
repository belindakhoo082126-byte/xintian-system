import { describe, expect, it } from "vitest";
import { calculateWestMalaysiaShipping, processActualWeight } from "./db";
import { calculateWestMalaysiaShippingBreakdown } from "../shared/shippingV22";

describe("西马首10kg与续重运费", () => {
  it("免邮门槛达标后，首10kg免费且超过部分由客户支付每公斤RM3", () => {
    expect(calculateWestMalaysiaShipping(10, 150)).toMatchObject({
      shippingFee: 0,
      freeShipping: true,
      extraWeightCharge: 0,
    });
    expect(calculateWestMalaysiaShipping(12, 150)).toMatchObject({
      shippingFee: 6,
      freeShipping: true,
      extraWeightCharge: 6,
    });
  });

  it("未达免邮门槛时收首10kg基础运费并继续收取续重", () => {
    expect(calculateWestMalaysiaShipping(10, 149.99)).toMatchObject({ shippingFee: 15, freeShipping: false });
    expect(calculateWestMalaysiaShipping(10.1, 149.99)).toMatchObject({ shippingFee: 18, freeShipping: false });
  });

  it("按1kg×12包估算并在实际包货后产生正确补收或退款差额", () => {
    const checkout = calculateWestMalaysiaShippingBreakdown(12, 100);
    expect(checkout).toMatchObject({
      estimatedWeight: 12,
      baseShippingFee: 15,
      extraWeightKg: 2,
      extraWeightCharge: 6,
      shippingFee: 21,
    });

    expect(processActualWeight(15, checkout.shippingFee, 100, false, null, 0)).toMatchObject({
      actualShippingFee: 30,
      difference: 9,
      needsSpecialOrder: true,
      specialOrderType: "pending_shipping",
    });

    expect(processActualWeight(9, checkout.shippingFee, 100, false, null, 0)).toMatchObject({
      actualShippingFee: 15,
      difference: -6,
      needsSpecialOrder: true,
      specialOrderType: "pending_refund",
    });
  });
});
