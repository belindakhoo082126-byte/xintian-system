import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addDeliveryAttempt: vi.fn(),
  getAiLogDetail: vi.fn(),
  getChatConversationById: vi.fn(),
  updateAiLogAfterSend: vi.fn(),
  updateChatMessageDelivery: vi.fn(),
  updateDeliveryAttempt: vi.fn(),
  sendTextMessage: vi.fn(),
}));

vi.mock("./db", () => ({
  addDeliveryAttempt: mocks.addDeliveryAttempt,
  getAiLogDetail: mocks.getAiLogDetail,
  getChatConversationById: mocks.getChatConversationById,
  updateAiLogAfterSend: mocks.updateAiLogAfterSend,
  updateChatMessageDelivery: mocks.updateChatMessageDelivery,
  updateDeliveryAttempt: mocks.updateDeliveryAttempt,
}));

vi.mock("./messenger", () => ({
  sendTextMessage: mocks.sendTextMessage,
}));

import { retryFailedAiLogDelivery } from "./aiLogRetry";

const failedLog = {
  id: 501,
  sendStatus: "failed",
  sourceType: "private_chat",
  platform: "messenger",
  conversationId: 73,
  aiReply: "您好，这是一条可重试的固定回复。",
  aiReplyMessageId: 91,
  retryCount: 0,
  processingSteps: [{ step: "delivery", label: "发送AI回复", result: "failed" }],
  deliveryAttempts: [{ id: 701, attemptNumber: 1, sendStatus: "failed" }],
};

describe("AI日志发送重试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiLogDetail.mockResolvedValue({ ...failedLog });
    mocks.getChatConversationById.mockResolvedValue({ id: 73, platformId: "customer-psid" });
    mocks.addDeliveryAttempt.mockResolvedValue(702);
  });

  it("重试成功时新增第二次发送尝试、保留同一主日志并更新为 sent", async () => {
    mocks.sendTextMessage.mockResolvedValue({ message_id: "mid.retry-success" });

    await expect(retryFailedAiLogDelivery(501)).resolves.toMatchObject({
      aiLogId: 501,
      attemptNumber: 2,
      retryCount: 1,
      sendStatus: "sent",
      platformMessageId: "mid.retry-success",
    });

    expect(mocks.addDeliveryAttempt).toHaveBeenCalledWith(501, 2, "pending");
    expect(mocks.updateDeliveryAttempt).toHaveBeenCalledWith(702, expect.objectContaining({
      sendStatus: "sent",
      platformMessageId: "mid.retry-success",
    }));
    expect(mocks.updateAiLogAfterSend).toHaveBeenCalledWith(501, expect.objectContaining({
      sendStatus: "sent",
      retryCount: 1,
      errorCode: null,
      errorStage: null,
      errorMessage: null,
      processingSteps: expect.arrayContaining([
        expect.objectContaining({ step: "delivery_retry", result: "sent" }),
      ]),
    }));
    expect(mocks.updateChatMessageDelivery).toHaveBeenCalledWith(91, {
      status: "sent",
      platformMessageId: "mid.retry-success",
      errorMessage: null,
    });
  });

  it("重试仍失败时更新第二次发送尝试和同一主日志的错误信息", async () => {
    mocks.sendTextMessage.mockRejectedValue({
      response: { status: 429, data: { error: { message: "平台限流，请稍后再试" } } },
    });

    await expect(retryFailedAiLogDelivery(501)).resolves.toMatchObject({
      aiLogId: 501,
      attemptNumber: 2,
      retryCount: 1,
      sendStatus: "failed",
      errorCode: "429",
    });

    expect(mocks.updateDeliveryAttempt).toHaveBeenCalledWith(702, expect.objectContaining({
      sendStatus: "failed",
      errorCode: "429",
      errorMessage: "平台限流，请稍后再试",
    }));
    expect(mocks.updateAiLogAfterSend).toHaveBeenCalledWith(501, expect.objectContaining({
      sendStatus: "failed",
      retryCount: 1,
      errorCode: "429",
      errorStage: "messenger_send",
    }));
    expect(mocks.updateChatMessageDelivery).toHaveBeenCalledWith(91, {
      status: "failed",
      platformMessageId: null,
      errorMessage: "平台限流，请稍后再试",
    });
  });

  it("拒绝对已发送日志或非私聊来源重复发送", async () => {
    mocks.getAiLogDetail.mockResolvedValue({ ...failedLog, sendStatus: "sent" });
    await expect(retryFailedAiLogDelivery(501)).rejects.toThrow("只有发送失败的AI日志可以重试");

    mocks.getAiLogDetail.mockResolvedValue({ ...failedLog, sourceType: "facebook_live", conversationId: null });
    await expect(retryFailedAiLogDelivery(501)).rejects.toThrow("当前仅支持重试关联 Messenger 私聊的AI日志");
  });
});
