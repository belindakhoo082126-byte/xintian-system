import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const aiSource = readFileSync(new URL("./businessAi.ts", import.meta.url), "utf8");
const privateChatSource = readFileSync(new URL("./privateChatOrderActions.ts", import.meta.url), "utf8");

describe("商城、AI与留言订单的规格特价可信规则", () => {
  it("商城结账、商城加购和直播留言都在服务端重算有效特价与原价快照", () => {
    expect(dbSource).toContain('await applyTrustedSpecialPriceSnapshots(db, data.items, { useProductSpecialPrice: true });');
    expect(dbSource).toContain('await applyTrustedSpecialPriceSnapshots(db, items, { useProductSpecialPrice: true });');
    expect(dbSource).toContain('await applyTrustedSpecialPriceSnapshots(db, trustedItems, { useProductSpecialPrice: true });');
    expect(dbSource).toContain('originalUnitPrice: p.originalUnitPrice || null');
    expect(dbSource).toContain('composeLiveVariantKeyword(candidate.productKeyword, candidate.keyword)');
  });

  it("多规格商品必须选择当前规格，并从当前variants库存预留和取消回库", () => {
    expect(dbSource).toContain('商品「${product.name}」必须先选择规格');
    expect(dbSource).toContain('eq(variants.productId, productId)');
    expect(dbSource).toContain('stockQuantity: sql`${variants.stockQuantity} - ${quantity}`');
    expect(dbSource).toContain('stockQuantity: sql`${variants.stockQuantity} + ${item.quantity}`');
  });

  it("AI／私聊在已明确规格关键字时可建立规格草稿，并在批准时保留规格和价格快照", () => {
    expect(aiSource).toContain('await applyTrustedSpecialPriceSnapshots(database, trustedItems, { useProductSpecialPrice: true });');
    expect(aiSource).toContain('variationName: item.variantName || null');
    expect(aiSource).toContain('originalUnitPrice: item.originalUnitPrice || null');
    expect(privateChatSource).toContain('findExactlyOneVariantForProduct');
    expect(privateChatSource).toContain('variantId: variant?.id');
    expect(privateChatSource).toContain('sort((left, right) => right.length - left.length)');
  });
});
