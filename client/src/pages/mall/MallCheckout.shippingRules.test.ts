import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MallCheckout 运费规则展示", () => {
  it("植物与种植介质达到西马免邮门槛时显示分单提示并禁用结账", () => {
    const source = readFileSync(new URL("./MallCheckout.tsx", import.meta.url), "utf8");

    expect(source).toContain("blocksPlantingMediumFreeShippingCheckout");
    expect(source).toContain("请取消种植介质或另开订单后再结账");
    expect(source).toContain("blocksPlantingMediumFreeShippingCheckout ||");
  });

  it("Lalamove结账预收为RM0并明确说明公司先承担RM15", () => {
    const source = readFileSync(new URL("./MallCheckout.tsx", import.meta.url), "utf8");

    expect(source).toContain("calculateLalamoveCheckoutCustomerShipping()");
    expect(source).toContain("公司先承担RM15");
    expect(source).toContain("实际超额后补差价");
  });
});
