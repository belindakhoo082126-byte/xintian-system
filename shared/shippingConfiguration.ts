export type WestMalaysiaShippingConfig = {
  freeShippingThreshold: number;
  includedWeightKg: number;
  baseFeeBelowThreshold: number;
  additionalKgFee: number;
};

export type EastMalaysiaPosLajuShippingConfig = {
  checkoutPrepaidFee: number;
  settlementNote: string;
};

export type EastMalaysiaShopeeShippingConfig = {
  checkoutPrepaidFee: number;
  settlementNote: string;
};

export type LalamoveShippingConfig = {
  companyBearingFee: number;
  settlementNote: string;
};

export type ControlledShippingConfiguration = {
  westMalaysia: WestMalaysiaShippingConfig;
  eastMalaysiaPosLaju: EastMalaysiaPosLajuShippingConfig;
  eastMalaysiaShopee: EastMalaysiaShopeeShippingConfig;
  lalamove: LalamoveShippingConfig;
};

export const DEFAULT_CONTROLLED_SHIPPING_CONFIGURATION: ControlledShippingConfiguration = {
  westMalaysia: {
    freeShippingThreshold: 150,
    includedWeightKg: 10,
    baseFeeBelowThreshold: 15,
    additionalKgFee: 3,
  },
  eastMalaysiaPosLaju: {
    checkoutPrepaidFee: 50,
    settlementNote: "结账预收RM50；包货后按实际运费结算。",
  },
  eastMalaysiaShopee: {
    checkoutPrepaidFee: 0,
    settlementNote: "运费由Shopee平台收取，本系统不收运费。",
  },
  lalamove: {
    companyBearingFee: 15,
    settlementNote: "结账客户运费RM0；公司先承担RM15，实际费用超出部分才向客户补收。",
  },
};

function positiveNumber(value: unknown, fallback: number, allowZero = false) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  if (allowZero ? numberValue < 0 : numberValue <= 0) return fallback;
  return numberValue;
}

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizeControlledShippingConfiguration(value: Partial<ControlledShippingConfiguration> | null | undefined): ControlledShippingConfiguration {
  const defaults = DEFAULT_CONTROLLED_SHIPPING_CONFIGURATION;
  const west = (value?.westMalaysia ?? {}) as Partial<WestMalaysiaShippingConfig>;
  const poslaju = (value?.eastMalaysiaPosLaju ?? {}) as Partial<EastMalaysiaPosLajuShippingConfig>;
  const shopee = (value?.eastMalaysiaShopee ?? {}) as Partial<EastMalaysiaShopeeShippingConfig>;
  const lalamove = (value?.lalamove ?? {}) as Partial<LalamoveShippingConfig>;

  return {
    westMalaysia: {
      freeShippingThreshold: positiveNumber(west.freeShippingThreshold, defaults.westMalaysia.freeShippingThreshold),
      includedWeightKg: positiveNumber(west.includedWeightKg, defaults.westMalaysia.includedWeightKg),
      baseFeeBelowThreshold: positiveNumber(west.baseFeeBelowThreshold, defaults.westMalaysia.baseFeeBelowThreshold, true),
      additionalKgFee: positiveNumber(west.additionalKgFee, defaults.westMalaysia.additionalKgFee, true),
    },
    eastMalaysiaPosLaju: {
      checkoutPrepaidFee: positiveNumber(poslaju.checkoutPrepaidFee, defaults.eastMalaysiaPosLaju.checkoutPrepaidFee, true),
      settlementNote: textValue(poslaju.settlementNote, defaults.eastMalaysiaPosLaju.settlementNote),
    },
    eastMalaysiaShopee: {
      checkoutPrepaidFee: positiveNumber(shopee.checkoutPrepaidFee, defaults.eastMalaysiaShopee.checkoutPrepaidFee, true),
      settlementNote: textValue(shopee.settlementNote, defaults.eastMalaysiaShopee.settlementNote),
    },
    lalamove: {
      companyBearingFee: positiveNumber(lalamove.companyBearingFee, defaults.lalamove.companyBearingFee, true),
      settlementNote: textValue(lalamove.settlementNote, defaults.lalamove.settlementNote),
    },
  };
}
