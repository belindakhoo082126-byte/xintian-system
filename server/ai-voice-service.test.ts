import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    createAiPendingAction: vi.fn(),
    createAiVoiceTranscript: vi.fn(),
    getAiOrchestrationSettings: vi.fn(),
    updateAiVoiceTranscript: vi.fn(),
  },
  transcribeAudio: vi.fn(),
  orchestrateInboundText: vi.fn(),
}));

vi.mock("./_core/voiceTranscription", () => ({ transcribeAudio: mocks.transcribeAudio }));
vi.mock("./db", () => mocks.db);
vi.mock("./unifiedAiOrchestrator", () => ({ orchestrateInboundText: mocks.orchestrateInboundText }));

import { processCustomerVoice } from "./aiVoiceService";

const input = {
  conversationId: 4,
  customerId: 5,
  customerMessageId: 6,
  customerName: "阿芳",
  channel: "messenger" as const,
  platformId: "psid-2",
  mediaUrl: "https://media.example/audio.mp4",
  aiReplyEnabled: true,
  handoverStatus: "none" as const,
};

describe("客户语音受控处理", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.createAiVoiceTranscript.mockResolvedValue({ id: 101 });
    mocks.db.getAiOrchestrationSettings.mockResolvedValue({ voiceTranscriptionEnabled: true, requireVoiceReviewBelow: "0.65" });
  });

  it("低可信度语音只进入人工复核，不会调用 AI 或建立订单动作", async () => {
    mocks.transcribeAudio.mockResolvedValue({ text: "嗯", language: "zh", segments: [{ avg_logprob: -2.3 }] });

    const result = await processCustomerVoice(input);

    expect(result.kind).toBe("needs_review");
    expect(mocks.db.updateAiVoiceTranscript).toHaveBeenCalledWith(101, expect.objectContaining({ status: "needs_review" }));
    expect(mocks.db.createAiPendingAction).not.toHaveBeenCalled();
    expect(mocks.orchestrateInboundText).not.toHaveBeenCalled();
  });

  it("语音中的购买或加单意图只生成文字确认，确认前绝不执行订单动作", async () => {
    mocks.transcribeAudio.mockResolvedValue({ text: "我要买两包黄豆肥", language: "zh", segments: [{ avg_logprob: -0.1 }] });
    mocks.db.createAiPendingAction.mockResolvedValue({ id: 44, confirmationReply: "请用文字确认。" });

    const result = await processCustomerVoice(input);

    expect(result.kind).toBe("confirmation");
    expect(mocks.db.createAiPendingAction).toHaveBeenCalledWith(expect.objectContaining({
      actionType: "add_to_order",
      sourceMessageId: 6,
      payload: expect.objectContaining({ source: "voice", transcript: "我要买两包黄豆肥" }),
    }));
    expect(mocks.orchestrateInboundText).not.toHaveBeenCalled();
  });

  it("清楚的一般咨询语音转写后交给同一 AI 编排入口，而非直接由频道重复回复", async () => {
    mocks.transcribeAudio.mockResolvedValue({ text: "请问西马运费多少", language: "zh", segments: [{ avg_logprob: -0.1 }] });
    mocks.orchestrateInboundText.mockResolvedValue({ kind: "reply", orchestrationId: 99, result: { reply: "RM15 起" } });

    const result = await processCustomerVoice(input);

    expect(result.kind).toBe("ai");
    expect(mocks.orchestrateInboundText).toHaveBeenCalledWith(expect.objectContaining({
      customerMessageId: 6,
      text: "请问西马运费多少",
      inputType: "audio",
    }));
  });
});
