import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertValues, insert, updateWhere, updateSet, update, broadcastChange } = vi.hoisted(() => {
  const insertValues = vi.fn();
  const insert = vi.fn(() => ({ values: insertValues }));
  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const broadcastChange = vi.fn();
  return { insertValues, insert, updateWhere, updateSet, update, broadcastChange };
});

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => ({ insert, update })),
}));

vi.mock("./_core/realtime", () => ({
  broadcastChange,
  broadcastChanges: vi.fn(),
}));

import { addDeliveryAttempt, createAiLog, updateAiLogAfterSend, updateDeliveryAttempt } from "./db";
import { AiProcessingContext } from "./aiLogContext";

describe("createAiLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "mysql://ai-log-test";
  });

  it("writes one fully populated main log and publishes an aiLog sync event", async () => {
    insertValues.mockResolvedValue([{ insertId: 901 }]);

    const context = new AiProcessingContext(
      101,
      202,
      "花友小明",
      "messenger",
      303,
      "请问运费怎么算？",
      true,
      "ai_active",
    );
    context.addStep("reply_rule", "固定回复检查", "命中规则：运费咨询", "hit", { ruleId: 88 });
    context.finalSource = "reply_rule";
    context.matchedRuleId = 88;
    context.aiReply = "西马订单满 RM150，10kg 内免邮；未满则 RM15。";
    context.sendStatus = "pending";

    await expect(createAiLog(context.finalize())).resolves.toBe(901);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 101,
      customerId: 202,
      customerName: "花友小明",
      platform: "messenger",
      customerMessageId: 303,
      finalSource: "reply_rule",
      matchedRuleId: 88,
      sendStatus: "pending",
      isHandover: false,
      processingSteps: expect.arrayContaining([
        expect.objectContaining({ step: "reply_rule", result: "hit", ruleId: 88 }),
      ]),
    }));
    expect(broadcastChange).toHaveBeenCalledWith("aiLog");
  });

  it("persists Flow event identity without requiring a chat conversation", async () => {
    insertValues.mockResolvedValue([{ insertId: 903 }]);

    await expect(createAiLog({
      conversationId: null,
      customerId: null,
      customerName: "直播评论客户",
      platform: "messenger",
      sourceType: "facebook_live",
      sourceEventId: "comment-123",
      sourceBindingId: 88,
      customerMessageId: null,
      aiReplyMessageId: null,
      customerMessage: "配送怎么安排？",
      receivedAt: new Date("2026-07-30T00:00:00Z"),
      aiEnabled: true,
      handoverStatus: "none",
      processingSteps: [],
      finalSource: "flow",
      matchedFlowId: 88,
      aiReply: "直播配送安排如下。",
      sendStatus: "pending",
      retryCount: 0,
      isHandover: false,
      processingTimeMs: 5,
    })).resolves.toBe(903);

    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: null,
      sourceType: "facebook_live",
      sourceEventId: "comment-123",
      sourceBindingId: 88,
      matchedFlowId: 88,
      finalSource: "flow",
    }));
  });

  it("returns null and does not leak an insert error into the message-processing flow", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    insertValues.mockRejectedValueOnce(new Error("database unavailable"));

    const context = new AiProcessingContext(
      1,
      2,
      "花友",
      "messenger",
      3,
      "测试",
      true,
      "ai_active",
    );

    await expect(createAiLog(context.finalize())).resolves.toBeNull();
    expect(broadcastChange).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("creates a pending delivery attempt before send and updates the same attempt with the platform result", async () => {
    insertValues.mockResolvedValueOnce([{ insertId: 902 }]);

    await expect(addDeliveryAttempt(901, 1, "pending")).resolves.toBe(902);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      aiLogId: 901,
      attemptNumber: 1,
      sendStatus: "pending",
    }));

    await updateDeliveryAttempt(902, {
      sendStatus: "sent",
      platformMessageId: "mid.123",
    });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      sendStatus: "sent",
      platformMessageId: "mid.123",
    }));
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it("updates the primary log with final delivery state, complete steps, and end-to-end processing time", async () => {
    const processingSteps = [
      { step: "delivery", label: "发送AI回复", result: "pending" },
      { step: "delivery", label: "发送AI回复", result: "sent" },
    ];

    await updateAiLogAfterSend(901, {
      sendStatus: "sent",
      platformMessageId: "mid.123",
      aiReplyMessageId: 555,
      processingTimeMs: 42,
      processingSteps,
    });

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      sendStatus: "sent",
      platformMessageId: "mid.123",
      aiReplyMessageId: 555,
      processingTimeMs: 42,
      processingSteps,
    }));
    expect(broadcastChange).toHaveBeenCalledWith("aiLog");
  });
});
