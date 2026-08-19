export function getSalesModeFromPresale(isPresale: boolean, currentMode: string) {
  if (currentMode === "import_preorder") return currentMode;
  return isPresale ? "presale" : "normal";
}

export function isPresaleSalesMode(salesMode: string) {
  return salesMode === "presale";
}

