import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const orderCreateSource = readFileSync(new URL("./OrderCreatePage.tsx", import.meta.url), "utf8");
const orderEditSource = readFileSync(new URL("./OrderEditPage.tsx", import.meta.url), "utf8");

describe("订单页面的虚拟交付规格选择", () => {
  it("只有productMode为variant时才打开规格选择，不因历史单一配套行而强制选择", () => {
    expect(orderCreateSource).toContain('if (p.productMode === "variant")');
    expect(orderCreateSource).not.toContain('p.productMode === "variant" || activeVariants.length > 0');
    expect(orderEditSource).toContain('if (product.productMode === "variant")');
  });

  it("仅实体库存商品会因零库存被阻止，会员零库存可直接加入订单", () => {
    expect(orderCreateSource).toContain('const isStockManaged = p.type === "physical" || p.type === "gift"');
    expect(orderCreateSource).toContain('const outOfStock = isStockManaged &&');
    expect(orderCreateSource).toContain('variantSelectionProduct?.type === "physical" || variantSelectionProduct?.type === "gift"');
    expect(orderEditSource).toContain('variantSelectionProduct?.type === "physical" || variantSelectionProduct?.type === "gift"');
  });
});
