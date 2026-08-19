export function getMallBrowseFilters(search: string) {
  const params = new URLSearchParams(search);
  const categoryValue = Number(params.get("categoryId"));
  return {
    categoryId: Number.isInteger(categoryValue) && categoryValue > 0 ? categoryValue : undefined,
    query: params.get("q")?.trim() || "",
  };
}

export function buildMallBrowseSearch(currentSearch: string, categoryId?: number, query?: string) {
  const params = new URLSearchParams(currentSearch);
  if (categoryId) params.set("categoryId", String(categoryId));
  else params.delete("categoryId");
  if (query?.trim()) params.set("q", query.trim());
  else params.delete("q");
  return params;
}

