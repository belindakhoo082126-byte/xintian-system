import { describe, expect, it } from "vitest";
import { buildCheckoutNotification, buildShippingNotification } from "./chatNotifications";

describe("聊天客户通知预览", () => {
  it("结账通知含专属链接及正式V2.2运费说明", () => {
    const message = buildCheckoutNotification({ orderNumber: "XT00001", secureToken: "safe-token" }, "https://xintian.com.my");

    expect(message).toContain("https://xintian.com.my/order/XT00001/safe-token");
    expect(message).toContain("西马消费满 RM150（特价商品除外），10kg 内即可享受免邮优惠。");
  });

  it("未生成安全结账链接的订单不可建立结账通知", () => {
    expect(buildCheckoutNotification({ orderNumber: "XT00002" }, "https://xintian.com.my")).toBeNull();
  });

  it("发货通知带入快递和追踪号码，缺失追踪号时明确提示", () => {
    expect(buildShippingNotification({ orderNumber: "XT00003", courierCompany: "Parcel Daily", trackingNumber: "PD123" })).toContain("快递公司：Parcel Daily\n追踪号码：PD123");
    expect(buildShippingNotification({ orderNumber: "XT00004" })).toContain("追踪号码：暂未提供");
  });
});
