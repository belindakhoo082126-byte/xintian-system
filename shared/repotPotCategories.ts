/**
 * 正式花盆分类：商品管理分类名称是换盆业务的主数据。
 * 旧商品仍可能只设置 isPot，因此各消费端必须同时兼容两种来源。
 */
export const REPOT_POT_CATEGORY_NAMES = [
  "陶瓷/紫砂盆",
  "懒人盆",
  "塑胶盆",
  "清货盆",
] as const;

export function isRepotPotCategoryName(categoryNameZh: string | null | undefined): boolean {
  if (!categoryNameZh) return false;
  const normalized = categoryNameZh.trim().replace(/\s+/g, " ");
  return (REPOT_POT_CATEGORY_NAMES as readonly string[]).includes(normalized);
}

export function isRepotPotItem(item: { isPot?: boolean | null; categoryNameZh?: string | null }): boolean {
  return Boolean(item.isPot) || isRepotPotCategoryName(item.categoryNameZh);
}
