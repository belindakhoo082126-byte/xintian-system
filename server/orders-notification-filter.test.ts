import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("订单通知状态筛选", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/Orders.tsx"), "utf8");

  it("不再提供用户要求移除的“全部通知”选项", () => {
    expect(source).not.toContain('value="all">{translate("全部通知", "All Notifications")}</SelectItem>');
  });

  it("保留既有通知历史状态筛选，不改写通知记录或通知中心", () => {
    expect(source).toContain('value="unsent"');
    expect(source).toContain('value="sent"');
    expect(source).toContain('value="failed"');
    expect(source).toContain("notificationStatus: notificationFilter !== \"all\" ? notificationFilter : undefined");
  });
});
