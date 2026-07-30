import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storeIncomingMessengerMessage: vi.fn(),
  getOrCreateConversation: vi.fn(),
  createAiLog: vi.fn(),
  addDeliveryAttempt: vi.fn(),
  updateDeliveryAttempt: vi.fn(),
  updateAiLogAfterSend: vi.fn(),
  addChatMessage: vi.fn(),
  processChatAI: vi.fn(),
  axiosPost: vi.fn(),
}));

vi.mock("./db", () => ({
  storeIncomingMessengerMessage: mocks.storeIncomingMessengerMessage,
  getOrCreateConversation: mocks.getOrCreateConversation,
  createAiLog: mocks.createAiLog,
  addDeliveryAttempt: mocks.addDeliveryAttempt,
  updateDeliveryAttempt: mocks.updateDeliveryAttempt,
  updateAiLogAfterSend: mocks.updateAiLogAfterSend,
  addChatMessage: mocks.addChatMessage,
}));

vi.mock("./aiEngines", () => ({
  processChatAI: mocks.processChatAI,
}));

vi.mock("axios", () => ({
  default: { post: mocks.axiosPost },
}));

import { handleMessengerEvent } from "./messenger";

describe("普通私聊 AI日志发送生命周期", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FB_PAGE_ID = "page-under-test";
    process.env.FB_PAGE_ACCESS_TOKEN = "test-token";
    mocks.storeIncomingMessengerMessage.mockResolvedValue({
      conversationId: 101,
      customerMessageId: 301,
      customerId: 201,
      customerName: "受控测试客户",
    });
    mocks.getOrCreateConversation.mockResolvedValue({
      id: 101,
      customerId: 201,
      aiReplyEnabled: true,
      handoverStatus: "none",
    });
    mocks.processChatAI.mockImplementation(async (_input: unknown, options: any) => {
      options.logContext.finalSource = "reply_rule";
      options.logContext.matchedRuleId = 88;
      options.logContext.aiReply = "受控测试回复";
      options.logContext.addStep("reply_rule", "固定回复规则", "命中规则（ID:88）", "hit", { ruleId: 88 });
      return {
        shouldReply: true,
        reply: "受控测试回复",
        source: "reply_rule",
        shouldHandover: false,
        ruleId: 88,
      };
    });
    mocks.createAiLog.mockResolvedValue(701);
    mocks.addDeliveryAttempt.mockResolvedValue(702);
    mocks.updateDeliveryAttempt.mockResolvedValue(undefined);
    mocks.updateAiLogAfterSend.mockResolvedValue(undefined);
    mocks.addChatMessage.mockResolvedValue({ messageId: 401 });
    mocks.axiosPost.mockResolvedValue({ data: { message_id: "mid.701" } });
  });

  it("creates pending records before sending and finalizes the same records after Messenger confirms", async () => {
    await handleMessengerEvent({
      sender: { id: "customer-psid" },
      recipient: { id: "page-under-test" },
      message: { text: "运费怎么算？" },
    });

    expect(mocks.createAiLog).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 101,
      customerMessageId: 301,
      finalSource: "reply_rule",
      matchedRuleId: 88,
      sendStatus: "pending",
    }));
    expect(mocks.addDeliveryAttempt).toHaveBeenCalledWith(701, 1, "pending");
    expect(mocks.axiosPost).toHaveBeenCalledTimes(1);
    expect(mocks.updateDeliveryAttempt).toHaveBeenCalledWith(702, expect.objectContaining({
      sendStatus: "sent",
      platformMessageId: "mid.701",
    }));
    expect(mocks.addChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 101,
      status: "sent",
      aiResponseSource: "reply_rule",
    }));
    expect(mocks.updateAiLogAfterSend).toHaveBeenCalledWith(701, expect.objectContaining({
      sendStatus: "sent",
      platformMessageId: "mid.701",
      aiReplyMessageId: 401,
      processingTimeMs: expect.any(Number),
      processingSteps: expect.arrayContaining([
        expect.objectContaining({ step: "delivery", result: "pending" }),
        expect.objectContaining({ step: "delivery", result: "sent" }),
      ]),
    }));
  });

  it("records a failed send on the same delivery attempt and exposes structured failure data", async () => {
    mocks.axiosPost.mockRejectedValueOnce({ code: 429, message: "平台限流" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await handleMessengerEvent({
      sender: { id: "customer-psid" },
      recipient: { id: "page-under-test" },
      message: { text: "运费怎么算？" },
    });

    expect(mocks.addDeliveryAttempt).toHaveBeenCalledWith(701, 1, "pending");
    expect(mocks.updateDeliveryAttempt).toHaveBeenCalledWith(702, expect.objectContaining({
      sendStatus: "failed",
      errorCode: "429",
      errorMessage: "平台限流",
    }));
    expect(mocks.addChatMessage).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    expect(mocks.updateAiLogAfterSend).toHaveBeenCalledWith(701, expect.objectContaining({
      sendStatus: "failed",
      errorCode: "429",
      errorStage: "messenger_send",
      errorMessage: "平台限流",
      processingSteps: expect.arrayContaining([
        expect.objectContaining({ step: "delivery", result: "failed" }),
      ]),
    }));
    errorSpy.mockRestore();
  });

  it("still sends the customer reply when the main log helper returns no record", async () => {
    mocks.createAiLog.mockResolvedValue(null);

    await handleMessengerEvent({
      sender: { id: "customer-psid" },
      recipient: { id: "page-under-test" },
      message: { text: "运费怎么算？" },
    });

    expect(mocks.axiosPost).toHaveBeenCalledTimes(1);
    expect(mocks.addDeliveryAttempt).not.toHaveBeenCalled();
    expect(mocks.updateDeliveryAttempt).not.toHaveBeenCalled();
    expect(mocks.addChatMessage).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });
});
