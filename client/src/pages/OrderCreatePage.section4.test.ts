import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("OrderCreatePage 区域四", () => {
  it("保留商品搜索与订单项目编辑，但不再显示右侧添加商品按钮", () => {
    const source = readFileSync(new URL("./OrderCreatePage.tsx", import.meta.url), "utf8");

    expect(source).toContain("区域四：商品搜索与加入订单");
    expect(source).toContain("handleProductSelect(idx, v)");
    expect(source).toContain("updateManualItem(idx, \"quantity\"");
    expect(source).not.toContain("onClick={addManualItem}");
    expect(source).toContain("resolveManualOrderItemPrice");
  });

  it("多规格商品必须先显示规格选择，并在选择后保存规格标识", () => {
    const source = readFileSync(new URL("./OrderCreatePage.tsx", import.meta.url), "utf8");

    expect(source).toContain("setVariantSelectionProduct(p)");
    expect(source).toContain("选择商品规格");
    expect(source).toContain("variationId: variant?.id");
    expect(source).toContain("variationName: variant?.name");
    expect(source).toContain("availableStock: Number(variant?.stockQuantity");
    expect(source).toContain("unitWeight: String(variant?.weight");
  });

  it("手机端商品卡片以两栏／单栏流程展示完整操作，不再固定压缩为十二栏", () => {
    const source = readFileSync(new URL("./OrderCreatePage.tsx", import.meta.url), "utf8");

    expect(source).toContain('grid grid-cols-2 gap-3 sm:grid-cols-12 sm:gap-2 sm:items-end');
    expect(source).toContain('hidden shrink-0 sm:inline-flex');
    expect(source).toContain('col-span-2 min-w-0 sm:col-span-2');
    expect(source).toContain('h-10 w-full sm:h-9');
  });
});
