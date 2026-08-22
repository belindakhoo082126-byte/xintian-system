export type LiveRoomCategory = {
  nameZh?: string | null;
  nameEn?: string | null;
  name?: string | null;
};

export function getLiveRoomCategoryLabel(category: LiveRoomCategory): string {
  return category.nameZh?.trim() || category.nameEn?.trim() || category.name?.trim() || "未分类";
}

export function shouldQueryLiveRoomProducts(searchQuery: string, categoryFilter: string): boolean {
  return searchQuery.trim().length > 0 || categoryFilter !== "all";
}
