import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ShippingRules 系统设置同步", () => {
  it("展示并锁定西马植物／种植介质免邮资格规则", () => {
    const source = readFileSync(new URL("./ShippingRules.tsx", import.meta.url), "utf8");

    expect(source).toContain("getWestMalaysiaFreeShippingEligibilitySpecification");
    expect(source).toContain("正式运费规则 V2.2（系统计算口径）");
    expect(source).toContain("统一生效运费参数（自动同步至结账、订单、包货与单据）");
    expect(source).toContain("updateControlled");
    expect(source).toContain("旧配送分区资料（仅显示／供应商资讯）");
    expect(source).toContain("usesSystemManagedShippingCalculation");
  });

  it("展示Lalamove公司承担RM15的实际费用结算说明", () => {
    const source = readFileSync(new URL("./ShippingRules.tsx", import.meta.url), "utf8");

    expect(source).toContain("getLalamoveSettlementSpecification");
    expect(source).toContain("Lalamove 结算规则（系统计算口径）");
    expect(source).toContain("companyBearingFee");
  });
});
