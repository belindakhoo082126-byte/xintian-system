import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MallCheckout 运费规则展示", () => {
  it("植物与种植介质达到西马免邮门槛时显示分单提示并禁用结账", () => {
    const source = readFileSync(new URL("./MallCheckout.tsx", import.meta.url), "utf8");

    expect(source).toContain("blocksPlantingMediumFreeShippingCheckout");
    expect(source).toContain("请取消种植介质或另开订单后再结账");
    expect(source).toContain("blocksPlantingMediumFreeShippingCheckout ||");
  });

  it("Lalamove结账预收为RM0，并使用公开统一配置说明公司承担额与实际超额补收", () => {
    const source = readFileSync(new URL("./MallCheckout.tsx", import.meta.url), "utf8");

    expect(source).toContain("shippingRules.checkoutConfiguration.useQuery()");
    expect(source).toContain("calculateLalamoveCheckoutCustomerShipping(shippingConfiguration.lalamove.companyBearingFee)");
    expect(source).toContain("shippingConfiguration.lalamove.companyBearingFee");
    expect(source).toContain("实际超额后补差价");
  });
});
