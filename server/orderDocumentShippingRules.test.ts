import { describe, expect, it } from "vitest";
import { getOrderDocumentShippingRows, getOrderShippingDisplay } from "@shared/orderDocumentShippingRules";

describe("正式单据运费明细", () => {
  it("未达免邮时显示首10kg基础RM15及客户应付RM15", () => {
    expect(getOrderDocumentShippingRows({ isWestMalaysia: true, isFreeShipping: false, baseShippingFee: 15, extraWeightKg: 0, extraWeightFee: 0, shippingFee: 15, additionalKgFee: 3 })).toEqual([
      expect.objectContaining({ zhLabel: "首10kg基础运费", zhValue: "RM 15.00" }),
      expect.objectContaining({ zhLabel: "客户应付运费", zhValue: "RM 15.00" }),
    ]);
  });

  it("免邮且未超过10kg时只显示首10kg基础免邮", () => {
    expect(getOrderDocumentShippingRows({ isWestMalaysia: true, isFreeShipping: true, baseShippingFee: 0, extraWeightKg: 0, extraWeightFee: 0, shippingFee: 0, additionalKgFee: 3 })).toEqual([
      expect.objectContaining({ zhLabel: "首10kg基础运费", zhValue: "免邮" }),
    ]);
  });

  it("免邮但估计12kg时显示2kg每公斤RM3的客户续重", () => {
    expect(getOrderDocumentShippingRows({ isWestMalaysia: true, isFreeShipping: true, baseShippingFee: 0, extraWeightKg: 2, extraWeightFee: 6, shippingFee: 6, additionalKgFee: 3 })).toEqual([
      expect.objectContaining({ zhLabel: "首10kg基础运费", zhValue: "免邮" }),
      expect.objectContaining({ zhLabel: "客户应付运费（Per kg/RM3.00）", zhValue: "2kg RM 6.00" }),
    ]);
  });

  it("以订单已保存运费拆出RM15基础费与3kg续重RM9，供查看、Edit与Preview共用", () => {
    const display = getOrderShippingDisplay({
      shippingMethod: "west_malaysia",
      estimatedWeight: 13,
      shippingFee: 24,
    });

    expect(display).toMatchObject({
      isWestMalaysia: true,
      isFreeShipping: false,
      baseShippingFee: 15,
      extraWeightKg: 3,
      extraWeightFee: 9,
      shippingFee: 24,
    });
    expect(display.rows).toEqual([
      expect.objectContaining({ zhLabel: "首10kg基础运费", zhValue: "RM 15.00" }),
      expect.objectContaining({ zhLabel: "续重（Per kg/RM3.00）", zhValue: "3kg RM 9.00" }),
      expect.objectContaining({ zhLabel: "客户应付运费", zhValue: "RM 24.00" }),
    ]);
  });
});
