export type PurchaseVariantOption = {
  id: number;
  name: string;
  keyword: string;
  sku?: string | null;
  sellingPrice?: string | number | null;
  currentCost?: string | number | null;
};

export type PurchaseProductOption = {
  id: number;
  name: string;
  sku?: string | null;
  keyword?: string | null;
  type: "physical" | "gift";
  isGift: boolean;
  sellingPrice?: string | number | null;
  currentCost?: string | number | null;
  variants: PurchaseVariantOption[];
};

export type PurchaseOrderDraftItem = {
  productId: number | undefined;
  quantity: number;
  unitCost: string;
  sellingPrice: string;
  subtotal: string;
  variantName: string;
  variantKeyword: string;
};

const asAmount = (value: string | number | null | undefined) => Number(value ?? 0).toFixed(2);

export function createEmptyPurchaseOrderItem(): PurchaseOrderDraftItem {
  return {
    productId: undefined,
    quantity: 1,
    unitCost: "0",
    sellingPrice: "",
    subtotal: "0",
    variantName: "",
    variantKeyword: "",
  };
}

/** Searches product name, SKU, product keyword, variant name and variant keyword. */
export function filterPurchaseProductOptions(
  products: PurchaseProductOption[],
  query: string,
): PurchaseProductOption[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return products;

  return products.filter(product => {
    const searchableValues = [
      product.name,
      product.sku,
      product.keyword,
      ...product.variants.flatMap(variant => [variant.name, variant.keyword, variant.sku]),
    ];
    return searchableValues.some(value => value?.toLocaleLowerCase().includes(normalizedQuery));
  });
}

/**
 * A selected variant product becomes one purchase line per variant so the
 * received stock can be traced with both variantName and variantKeyword.
 */
export function expandProductToPurchaseOrderItems(product: PurchaseProductOption): PurchaseOrderDraftItem[] {
  if (product.variants.length === 0) {
    return [{
      ...createEmptyPurchaseOrderItem(),
      productId: product.id,
      unitCost: asAmount(product.currentCost),
      sellingPrice: product.sellingPrice == null ? "" : String(product.sellingPrice),
      subtotal: asAmount(product.currentCost),
    }];
  }

  return product.variants.map(variant => ({
    ...createEmptyPurchaseOrderItem(),
    productId: product.id,
    unitCost: asAmount(variant.currentCost ?? product.currentCost),
    sellingPrice: String(variant.sellingPrice ?? product.sellingPrice ?? ""),
    subtotal: asAmount(variant.currentCost ?? product.currentCost),
    variantName: variant.name,
    variantKeyword: variant.keyword,
  }));
}
