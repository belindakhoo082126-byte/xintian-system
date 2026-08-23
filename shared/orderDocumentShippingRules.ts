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
