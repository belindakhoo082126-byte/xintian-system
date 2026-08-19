export function upsertVariantInList<T extends { id: number }>(current: T[], variant: T) {
  const index = current.findIndex((item) => item.id === variant.id);
  if (index < 0) return [...current, variant];
  return current.map((item) => item.id === variant.id ? { ...item, ...variant } : item);
}

export function removeVariantFromList<T extends { id: number }>(current: T[], id: number) {
  return current.filter((item) => item.id !== id);
}

