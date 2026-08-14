import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("订单通知状态筛选", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/Orders.tsx"), "utf8");

  it("不再提供用户要求移除的“全部通知”选项", () => {
    expect(source).not.toContain('value="all">{translate("全部通知", "All Notifications")}</SelectItem>');
  });

  it("移除全部备注旁无有效默认值的通知筛选卡格，不改写通知记录或通知中心", () => {
    expect(source).not.toContain('translate("通知状态", "Notification")');
    expect(source).toContain("notificationStatus: notificationFilter !== \"all\" ? notificationFilter : undefined");
  });
});
