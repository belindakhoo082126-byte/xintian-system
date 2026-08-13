import { describe, expect, it } from "vitest";
import { dedupeAndSortConversations, dedupeAndSortMessages } from "./chatSynchronization";

describe("聊天同步排序", () => {
  it("按创建时间稳定排序并去除重复消息", () => {
    const sorted = dedupeAndSortMessages([
      { id: 3, createdAt: "2026-08-13T04:02:00.000Z", content: "第三" },
      { id: 1, createdAt: "2026-08-13T04:00:00.000Z", content: "第一" },
      { id: 2, createdAt: "2026-08-13T04:00:00.000Z", content: "第二" },
      { id: 3, createdAt: "2026-08-13T04:02:00.000Z", content: "第三（更新）" },
    ]);

    expect(sorted.map((message) => message.id)).toEqual([1, 2, 3]);
    expect(sorted[2].content).toBe("第三（更新）");
  });

  it("按最后消息时间倒序显示会话并去除重复会话", () => {
    const sorted = dedupeAndSortConversations([
      { id: 1, lastMessageAt: "2026-08-13T04:00:00.000Z", name: "较早" },
      { id: 2, lastMessageAt: "2026-08-13T04:02:00.000Z", name: "最新" },
      { id: 1, lastMessageAt: "2026-08-13T04:03:00.000Z", name: "更新后最新" },
    ]);

    expect(sorted.map((conversation) => conversation.id)).toEqual([1, 2]);
    expect(sorted[0].name).toBe("更新后最新");
  });
});
