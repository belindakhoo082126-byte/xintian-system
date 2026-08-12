export type MallServiceBadges = {
  shipping: { zh: string; en: string };
  reservation: { zh: string; en: string };
};

export const DEFAULT_MALL_SERVICE_BADGES: MallServiceBadges = {
  shipping: {
    zh: "西马满RM150首10kg免邮，续重RM3/kg",
    en: "West Malaysia: Free 10kg over RM150, RM3/kg after",
  },
  reservation: {
    zh: "7天保留",
    en: "7-day reservation",
  },
};

export function resolveMallServiceBadges(value: unknown): MallServiceBadges {
  const source = value && typeof value === "object" ? value as Partial<MallServiceBadges> : {};
  return {
    shipping: {
      zh: typeof source.shipping?.zh === "string" && source.shipping.zh.trim() ? source.shipping.zh : DEFAULT_MALL_SERVICE_BADGES.shipping.zh,
      en: typeof source.shipping?.en === "string" && source.shipping.en.trim() ? source.shipping.en : DEFAULT_MALL_SERVICE_BADGES.shipping.en,
    },
    reservation: {
      zh: typeof source.reservation?.zh === "string" && source.reservation.zh.trim() ? source.reservation.zh : DEFAULT_MALL_SERVICE_BADGES.reservation.zh,
      en: typeof source.reservation?.en === "string" && source.reservation.en.trim() ? source.reservation.en : DEFAULT_MALL_SERVICE_BADGES.reservation.en,
    },
  };
}
