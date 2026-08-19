export type VariantSummary = {
  id: number;
  productId: number;
  name: string;
  keyword: string;
  stockQuantity: number | null;
  status: string;
};

export function groupVariantSummariesByProduct<T extends VariantSummary>(summaries: T[]) {
  return summaries.reduce<Record<number, T[]>>((grouped, summary) => {
    (grouped[summary.productId] ||= []).push(summary);
    return grouped;
  }, {});
}

