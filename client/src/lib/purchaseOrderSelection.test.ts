import { describe, expect, it } from "vitest";
import {
  expandProductToPurchaseOrderItems,
  filterPurchaseProductOptions,
  type PurchaseProductOption,
} from "./purchaseOrderSelection";

const products: PurchaseProductOption[] = [
  {
    id: 1,
    name: "白掌",
    sku: "PLANT-WP-01",
    keyword: "白掌",
    type: "physical",
    isGift: false,
    currentCost: "8.50",
    sellingPrice: "18.00",
    variants: [
      { id: 11, name: "小盆", keyword: "WP-S", sku: "PLANT-WP-01-S", currentCost: "7.00", sellingPrice: "16.00" },
      { id: 12, name: "大盆", keyword: "WP-L", sku: "PLANT-WP-01-L", currentCost: "10.00", sellingPrice: "22.00" },
    ],
  },
  {
    id: 2,
    name: "赠品肥料",
    sku: "GIFT-FERT-01",
    keyword: "赠肥",
    type: "gift",
    isGift: true,
    currentCost: "0",
    variants: [],
  },
];

describe("进货单商品选择逻辑", () => {
  it("按商品名称、SKU 与规格关键词筛选", () => {
    expect(filterPurchaseProductOptions(products, "白掌")).toHaveLength(1);
    expect(filterPurchaseProductOptions(products, "gift-fert")[0]?.id).toBe(2);
    expect(filterPurchaseProductOptions(products, "wp-l")[0]?.id).toBe(1);
  });

  it("不会过滤赠品商品", () => {
    const result = filterPurchaseProductOptions(products, "赠肥");
    expect(result).toEqual([products[1]]);
    expect(result[0]?.isGift).toBe(true);
  });

  it("选择有规格商品时为每个规格创建带规格快照的进货行", () => {
    expect(expandProductToPurchaseOrderItems(products[0])).toMatchObject([
      { productId: 1, variantName: "小盆", variantKeyword: "WP-S", quantity: 1, unitCost: "7.00" },
      { productId: 1, variantName: "大盆", variantKeyword: "WP-L", quantity: 1, unitCost: "10.00" },
    ]);
  });

  it("选择无规格赠品时保留商品级入库行", () => {
    expect(expandProductToPurchaseOrderItems(products[1])).toMatchObject([
      { productId: 2, variantName: "", variantKeyword: "", quantity: 1, unitCost: "0.00" },
    ]);
  });
});
