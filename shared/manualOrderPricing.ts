import { isSpecialPriceCurrentlyActive } from "./specialPriceSchedule";

export type ManualOrderNature = "retail" | "wholesale" | "agent";

export type ManualOrderPriceSource = {
  sellingPrice?: string | number | null;
  regularPrice?: string | number | null;
  wholesalePrice?: string | number | null;
  agentPrice?: string | number | null;
  specialPrice?: string | number | null;
  isSpecial?: boolean | null;
  specialPriceStartDate?: Date | string | null;
  specialPriceEndDate?: Date | string | null;
};

export function resolveManualOrderItemPrice(product: ManualOrderPriceSource, orderNature: ManualOrderNature) {
  const toNumber = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
  const format = (value: string | number | null | undefined) => toNumber(value).toFixed(2);
  const regularPrice = toNumber(product.sellingPrice ?? product.regularPrice);

  if (isSpecialPriceCurrentlyActive(product)) {
    return {
      unitPrice: format(product.specialPrice),
      originalUnitPrice: regularPrice > 0 ? format(regularPrice) : undefined,
      priceType: "special" as const,
    };
  }

  const tierPrice = orderNature === "wholesale"
    ? toNumber(product.wholesalePrice) || regularPrice
    : orderNature === "agent"
      ? toNumber(product.agentPrice) || regularPrice
      : regularPrice;

  return {
    unitPrice: format(tierPrice),
    originalUnitPrice: undefined,
    priceType: orderNature,
  };
}
