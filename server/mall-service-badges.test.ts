import { describe, expect, it } from "vitest";
import { DEFAULT_MALL_SERVICE_BADGES, resolveMallServiceBadges } from "../client/src/lib/mallServiceBadges";

describe("商城商品详情服务标签", () => {
  it("为未设置商城标签的旧配置保留正式运费与保留期默认文案", () => {
    expect(resolveMallServiceBadges(null)).toEqual(DEFAULT_MALL_SERVICE_BADGES);
  });

  it("保留管理员自定义的中英文服务标签，并为遗漏字段补回默认值", () => {
    expect(resolveMallServiceBadges({
      shipping: { zh: "西马消费满RM180免邮", en: "Free delivery over RM180" },
      reservation: { zh: "5天保留", en: "" },
    })).toEqual({
      shipping: { zh: "西马消费满RM180免邮", en: "Free delivery over RM180" },
      reservation: { zh: "5天保留", en: DEFAULT_MALL_SERVICE_BADGES.reservation.en },
    });
  });
});
