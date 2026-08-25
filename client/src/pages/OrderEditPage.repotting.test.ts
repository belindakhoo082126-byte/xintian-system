import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/OrderEditPage.tsx"), "utf8");
const detailService = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

describe("OrderEditPage repotting flowerpot synchronization", () => {
  it("uses the same shared flowerpot classifier for order plants and order flowerpots", () => {
    expect(source).toContain('import { isRepotPotItem } from "@shared/repotPotCategories"')
    expect(source).toContain("!isRepotPotItem(item) && item.productType === \"physical\"")
    expect(source).toContain("isRepotPotItem(item) && item.productType === \"physical\"")
  })

  it("returns product isPot and actual Chinese category names through order detail items", () => {
    expect(detailService).toContain("isPot: products.isPot")
    expect(detailService).toContain("categoryNameZh: categories.nameZh")
    expect(detailService).toContain(".leftJoin(categories, eq(products.categoryId, categories.id))")
  })

  it("uses the current Edit item draft for repotting and opens the same variant picker as manual orders", () => {
    expect(source).toContain("return itemsModified ? editItems : ((order as any).items || []);")
    expect(source).toContain("const [variantSelectionProduct, setVariantSelectionProduct]")
    expect(source).toContain("function handleProductSelection(product: any)")
    expect(source).toContain("选择商品规格")
    expect(source).toContain("resolveManualOrderVariantPrice")
    expect(source).toContain("resolveOrderItemUnitWeight({ productType: product.type, variantWeight: variant?.weight, productWeight: product.weightKg })")
    expect(source).toContain("[product.variants, product.variations, product.productVariations]")
    expect(source).toContain('setVariantSelectionProduct({ ...product, variants: resolvedVariants })')
    expect(source).toContain('选择规格（${variantCount}）')
  })

  it("keeps long plant and flowerpot names readable in the expanded repotting remark dialog", () => {
    expect(source).toContain('max-w-4xl overflow-y-auto')
    expect(source).toContain('sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem_2rem]')
    expect(source).toContain('[&>span]:whitespace-normal [&>span]:break-words')
    expect(source).toContain('className="h-auto whitespace-normal break-words py-2 leading-5"')
    expect(source).toContain('sm:min-w-[28rem]')
  })
})
