import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  matchLiveAiFlowWithMetadata: vi.fn(),
  createAiLog: vi.fn(),
  addDeliveryAttempt: vi.fn(),
  updateDeliveryAttempt: vi.fn(),
  updateAiLogAfterSend: vi.fn(),
  getOrCreateConversation: vi.fn(),
  storeIncomingMessengerMessage: vi.fn(),
  addChatMessage: vi.fn(),
  createHandoverRequest: vi.fn(),
  processChatAI: vi.fn(),
  axiosPost: vi.fn(),
}));

vi.mock("./db", () => ({
  addChatMessage: mocks.addChatMessage,
  addDeliveryAttempt: mocks.addDeliveryAttempt,
  createAiLog: mocks.createAiLog,
  createHandoverRequest: mocks.createHandoverRequest,
  getOrCreateConversation: mocks.getOrCreateConversation,
  matchLiveAiFlowWithMetadata: mocks.matchLiveAiFlowWithMetadata,
  storeIncomingMessengerMessage: mocks.storeIncomingMessengerMessage,
  updateAiLogAfterSend: mocks.updateAiLogAfterSend,
  updateDeliveryAttempt: mocks.updateDeliveryAttempt,
}));

vi.mock("./aiEngines", () => ({ processChatAI: mocks.processChatAI }));
vi.mock("axios", () => ({ default: { post: mocks.axiosPost } }));

import { handlePageFeedEvent } from "./messenger";

describe("Flow 来源 AI日志", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FB_PAGE_ACCESS_TOKEN = "flow-test-token";
    mocks.matchLiveAiFlowWithMetadata.mockResolvedValue({
      flowId: 88,
      reply: "直播配送安排如下。",
      matchedKeyword: "配送",
      matchType: "keyword",
    });
    mocks.createAiLog.mockResolvedValue(501);
    mocks.addDeliveryAttempt.mockResolvedValue(502);
    mocks.axiosPost.mockResolvedValue({ data: { id: "reply-comment-900" } });
  });

  it("logs a Live Flow hit without creating a fake chat conversation", async () => {
    await handlePageFeedEvent({
      field: "feed",
      value: {
        item: "comment",
        comment_id: "comment-123",
        post_id: "post-456",
        live_video_id: "live-789",
        from: { id: "commenter-psid", name: "测试评论客户" },
        message: "请问配送怎么安排？",
      },
    }, "page-under-test");

    expect(mocks.matchLiveAiFlowWithMetadata).toHaveBeenCalledWith("请问配送怎么安排？");
    expect(mocks.createAiLog).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: null,
      customerId: null,
      customerMessageId: null,
      aiReplyMessageId: null,
      sourceType: "facebook_live",
      sourceEventId: "comment-123",
      sourceBindingId: 88,
      finalSource: "flow",
      matchedFlowId: 88,
      sendStatus: "pending",
    }));
    expect(mocks.getOrCreateConversation).not.toHaveBeenCalled();
    expect(mocks.addDeliveryAttempt).toHaveBeenCalledWith(501, 1, "pending");
    expect(mocks.updateDeliveryAttempt).toHaveBeenCalledWith(502, expect.objectContaining({
      sendStatus: "sent",
      platformMessageId: "reply-comment-900",
    }));
    expect(mocks.updateAiLogAfterSend).toHaveBeenCalledWith(501, expect.objectContaining({
      sendStatus: "sent",
      platformMessageId: "reply-comment-900",
      processingSteps: expect.arrayContaining([
        expect.objectContaining({ step: "flow_match", flowId: 88, result: "hit" }),
        expect.objectContaining({ step: "delivery", result: "sent" }),
      ]),
    }));
  });

  it("records a structured failure on the same Flow delivery attempt", async () => {
    mocks.axiosPost.mockRejectedValueOnce({
      response: { status: 503, data: { error: { message: "Facebook 暂时不可用" } } },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await handlePageFeedEvent({
      field: "comments",
      value: {
        comment_id: "comment-failed",
        post_id: "post-failed",
        reel_id: "reel-1",
        from: { id: "commenter-psid", name: "测试评论客户" },
        message: "配送问题",
      },
    }, "page-under-test");

    expect(mocks.createAiLog).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "facebook_reel",
      sourceEventId: "comment-failed",
      matchedFlowId: 88,
    }));
    expect(mocks.updateDeliveryAttempt).toHaveBeenCalledWith(502, expect.objectContaining({
      sendStatus: "failed",
      errorCode: "503",
      errorMessage: "Facebook 暂时不可用",
    }));
    expect(mocks.updateAiLogAfterSend).toHaveBeenCalledWith(501, expect.objectContaining({
      sendStatus: "failed",
      errorCode: "503",
      errorStage: "facebook_comment_send",
      errorMessage: "Facebook 暂时不可用",
    }));
    errorSpy.mockRestore();
  });
});
