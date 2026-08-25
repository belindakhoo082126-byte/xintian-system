import { describe, expect, it } from "vitest";
import { resolveManualOrderItemPrice } from "../shared/manualOrderPricing";

describe("手动订单当前有效特价", () => {
  it("在有效期内优先带入特价和原价快照", () => {
    expect(resolveManualOrderItemPrice({
      sellingPrice: "20",
      specialPrice: "15",
      isSpecial: true,
    }, "retail")).toEqual({ unitPrice: "15.00", originalUnitPrice: "20.00", priceType: "special" });
  });

  it("未开始或已结束的特价回退到当前订单价格层级", () => {
    expect(resolveManualOrderItemPrice({
      sellingPrice: "20",
      wholesalePrice: "12",
      specialPrice: "15",
      isSpecial: true,
      specialPriceStartDate: "2099-01-01",
    }, "wholesale")).toEqual({ unitPrice: "12.00", originalUnitPrice: undefined, priceType: "wholesale" });
  });
});
