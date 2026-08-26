import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTROLLED_SHIPPING_CONFIGURATION,
  normalizeControlledShippingConfiguration,
} from "../shared/shippingConfiguration";

describe("受控运费配置", () => {
  it("保留用户已确认的四类默认参数", () => {
    expect(DEFAULT_CONTROLLED_SHIPPING_CONFIGURATION).toMatchObject({
      westMalaysia: { freeShippingThreshold: 150, includedWeightKg: 10, baseFeeBelowThreshold: 15, additionalKgFee: 3 },
      eastMalaysiaPosLaju: { checkoutPrepaidFee: 50 },
      eastMalaysiaShopee: { checkoutPrepaidFee: 0 },
      lalamove: { companyBearingFee: 15 },
    });
  });

  it("接受四类合法管理员参数，并在缺漏或无效值时安全回退默认值", () => {
    const configured = normalizeControlledShippingConfiguration({
      westMalaysia: { freeShippingThreshold: 180, includedWeightKg: 12, baseFeeBelowThreshold: 18, additionalKgFee: 4 },
      eastMalaysiaPosLaju: { checkoutPrepaidFee: 55, settlementNote: "包货后按实际费用结算。" },
      eastMalaysiaShopee: { checkoutPrepaidFee: 2, settlementNote: "平台另行收取余款。" },
      lalamove: { companyBearingFee: 20, settlementNote: "公司先承担RM20，客户仅补超额。" },
    });
    expect(configured).toMatchObject({
      westMalaysia: { freeShippingThreshold: 180, includedWeightKg: 12, baseFeeBelowThreshold: 18, additionalKgFee: 4 },
      eastMalaysiaPosLaju: { checkoutPrepaidFee: 55 },
      eastMalaysiaShopee: { checkoutPrepaidFee: 2 },
      lalamove: { companyBearingFee: 20 },
    });

    expect(normalizeControlledShippingConfiguration({
      westMalaysia: { freeShippingThreshold: -1 } as any,
      lalamove: { companyBearingFee: -1, settlementNote: " " },
    })).toMatchObject({
      westMalaysia: DEFAULT_CONTROLLED_SHIPPING_CONFIGURATION.westMalaysia,
      lalamove: DEFAULT_CONTROLLED_SHIPPING_CONFIGURATION.lalamove,
    });
  });
});
