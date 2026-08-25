import { WEST_MALAYSIA_V22_SHIPPING } from "./shippingV22";

export type OrderDocumentShippingRow = {
  key: "base" | "extra" | "customer" | "shipping";
  zhLabel: string;
  enLabel: string;
  zhValue: string;
  enValue: string;
};

export function getOrderDocumentShippingRows(input: {
  isWestMalaysia: boolean;
  isFreeShipping: boolean;
  baseShippingFee: number;
  extraWeightKg: number;
  extraWeightFee: number;
  shippingFee: number;
  additionalKgFee: number;
}): OrderDocumentShippingRow[] {
  const money = (value: number) => `RM ${value.toFixed(2)}`;

  if (!input.isWestMalaysia) {
    return [{ key: "shipping", zhLabel: "运费", enLabel: "Shipping", zhValue: money(input.shippingFee), enValue: money(input.shippingFee) }];
  }

  const rows: OrderDocumentShippingRow[] = [{
    key: "base",
    zhLabel: "首10kg基础运费",
    enLabel: "First 10kg Base Shipping",
    zhValue: input.isFreeShipping ? "免邮" : money(input.baseShippingFee),
    enValue: input.isFreeShipping ? "Free Shipping" : money(input.baseShippingFee),
  }];

  if (input.isFreeShipping) {
    if (input.extraWeightKg > 0) {
      rows.push({
        key: "customer",
        zhLabel: `客户应付运费（Per kg/RM${input.additionalKgFee.toFixed(2)}）`,
        enLabel: `Customer Shipping Due (Per kg/RM${input.additionalKgFee.toFixed(2)})`,
        zhValue: `${input.extraWeightKg}kg ${money(input.extraWeightFee)}`,
        enValue: `${input.extraWeightKg}kg ${money(input.extraWeightFee)}`,
      });
    }
    return rows;
  }

  if (input.extraWeightKg > 0) {
    rows.push({
      key: "extra",
      zhLabel: `续重（Per kg/RM${input.additionalKgFee.toFixed(2)}）`,
      enLabel: `Extra Weight (Per kg/RM${input.additionalKgFee.toFixed(2)})`,
      zhValue: `${input.extraWeightKg}kg ${money(input.extraWeightFee)}`,
      enValue: `${input.extraWeightKg}kg ${money(input.extraWeightFee)}`,
    });
  }

  rows.push({
    key: "customer",
    zhLabel: "客户应付运费",
    enLabel: "Customer Shipping Due",
    zhValue: money(input.shippingFee),
    enValue: money(input.shippingFee),
  });
  return rows;
}

/**
 * 查看页、Edit画面、Preview／打印／下载单据共用的运费展示模型。
 * 运费金额本身仍以订单已保存的 shippingFee 为准；这里仅用同一规则拆出首10kg与续重行。
 */
export function getOrderShippingDisplay(input: {
  shippingMethod: string | null | undefined;
  estimatedWeight: number;
  shippingFee: number;
}) {
  const isWestMalaysia = input.shippingMethod === "west_malaysia";
  const estimatedWeight = Math.max(0, Number(input.estimatedWeight) || 0);
  const shippingFee = Math.max(0, Number(input.shippingFee) || 0);
  const extraWeightKg = isWestMalaysia
    ? Math.max(0, Math.ceil(estimatedWeight - WEST_MALAYSIA_V22_SHIPPING.includedWeightKg))
    : 0;
  const extraWeightFee = extraWeightKg * WEST_MALAYSIA_V22_SHIPPING.additionalKgFee;
  const baseShippingFee = isWestMalaysia ? Math.max(0, shippingFee - extraWeightFee) : shippingFee;
  const isFreeShipping = isWestMalaysia && estimatedWeight > 0 && baseShippingFee === 0;

  return {
    isWestMalaysia,
    estimatedWeight,
    isFreeShipping,
    baseShippingFee,
    extraWeightKg,
    extraWeightFee,
    shippingFee,
    rows: getOrderDocumentShippingRows({
      isWestMalaysia,
      isFreeShipping,
      baseShippingFee,
      extraWeightKg,
      extraWeightFee,
      shippingFee,
      additionalKgFee: WEST_MALAYSIA_V22_SHIPPING.additionalKgFee,
    }),
  };
}
