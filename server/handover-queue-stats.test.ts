import { describe, expect, it } from "vitest";
import { summarizePendingHandoverQueue } from "./db";

describe("统一 AI 转人工队列统计", () => {
  const now = new Date("2026-08-12T12:00:00.000Z").getTime();

  it("汇总最久等待、最高优先级与超过 24 小时的待处理数量", () => {
    const summary = summarizePendingHandoverQueue([
      { createdAt: new Date("2026-08-12T11:30:00.000Z"), priority: "low" },
      { createdAt: new Date("2026-08-11T11:00:00.000Z"), priority: "high" },
      { createdAt: new Date("2026-08-11T12:01:00.000Z"), priority: "medium" },
    ], now);

    expect(summary).toEqual({
      pendingCount: 3,
      oldestWaitMinutes: 1500,
      over24HoursCount: 1,
      highestPriority: "high",
    });
  });

  it("没有待处理转人工时会安全返回零值", () => {
    expect(summarizePendingHandoverQueue([], now)).toEqual({
      pendingCount: 0,
      oldestWaitMinutes: 0,
      over24HoursCount: 0,
      highestPriority: null,
    });
  });
});
