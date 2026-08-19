export type SpecialPriceSchedule = {
  isSpecial?: boolean | null;
  specialPrice?: string | number | null;
  specialPriceStartDate?: Date | string | null;
  specialPriceEndDate?: Date | string | null;
};

export function isSpecialPriceCurrentlyActive(product: SpecialPriceSchedule, now = new Date()) {
  if (!product.isSpecial || !product.specialPrice || Number(product.specialPrice) <= 0) return false;
  const start = product.specialPriceStartDate ? new Date(product.specialPriceStartDate) : null;
  const end = product.specialPriceEndDate ? new Date(product.specialPriceEndDate) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

