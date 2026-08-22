import { describe, expect, it } from "vitest";
import { normalizeNotificationLogChannel } from "../shared/notificationLogChannel";

describe("通知审计频道标准化", () => {
  it("将Facebook发送平台记为Messenger审计频道", () => {
    expect(normalizeNotificationLogChannel("facebook")).toBe("messenger");
  });

  it("将无联系方式或未知平台记为系统频道，避免写入非法枚举", () => {
    expect(normalizeNotificationLogChannel("none")).toBe("system");
    expect(normalizeNotificationLogChannel()).toBe("system");
  });
});
