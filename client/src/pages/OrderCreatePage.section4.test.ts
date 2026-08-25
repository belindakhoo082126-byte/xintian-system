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
});
