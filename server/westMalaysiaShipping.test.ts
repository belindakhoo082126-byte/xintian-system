import { describe, expect, it } from "vitest";
import { calculateWestMalaysiaShipping } from "./db";

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
});
