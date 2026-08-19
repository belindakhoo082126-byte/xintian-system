export type DraftVariantInput = {
  draftId: string;
  keyword: string;
};

export function normalizeVariantKeyword(keyword: string) {
  return keyword.toUpperCase().replace(/\s+/g, "");
}

export function hasDuplicateDraftVariantKeyword(
  drafts: DraftVariantInput[],
  keyword: string,
  excludeDraftId?: string | null,
) {
  const normalized = normalizeVariantKeyword(keyword);
  return drafts.some((draft) => draft.draftId !== excludeDraftId && normalizeVariantKeyword(draft.keyword) === normalized);
}

export function hasRepeatedVariantKeyword(keywords: string[]) {
  const normalized = keywords.map(normalizeVariantKeyword);
  return new Set(normalized).size !== normalized.length;
}

