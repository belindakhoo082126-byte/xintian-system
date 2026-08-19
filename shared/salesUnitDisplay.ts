export type SalesUnitLabels = {
  unitNameZh?: string | null;
  unitNameEn?: string | null;
};

/** Returns the persisted product unit in the visitor's current language, with a safe fallback. */
export function getSalesUnitLabel(product: SalesUnitLabels, lang: "zh" | "en") {
  const primary = lang === "en" ? product.unitNameEn : product.unitNameZh;
  const fallback = lang === "en" ? product.unitNameZh : product.unitNameEn;
  return primary?.trim() || fallback?.trim() || "";
}

