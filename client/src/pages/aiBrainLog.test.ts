import { describe, expect, it } from "vitest";
import { formatAuditDate } from "./AiBrainLog";

describe("AI日志审计时间格式化", () => {
  it("优先格式化发送尝试的 attemptedAt 时间，而不会显示 Invalid Date", () => {
    const formatted = formatAuditDate("2026-07-30T11:37:56.000Z");

    expect(formatted).not.toBe("Invalid Date");
    expect(formatted).not.toBe("—");
  });

  it("对缺失或非法时间返回占位符，而不是 Invalid Date", () => {
    expect(formatAuditDate(undefined)).toBe("—");
    expect(formatAuditDate("not-a-date")).toBe("—");
  });
});
