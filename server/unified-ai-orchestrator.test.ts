import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    beginAiMessageOrchestration: vi.fn(),
    createAiSalesRecord: vi.fn(),
    createHandoverRequest: vi.fn(),
    finalizeAiMessageOrchestration: vi.fn(),
    getAiOrchestrationSettings: vi.fn(),
  },
  processChatAI: vi.fn(),
}));

vi.mock("./db", () => mocks.db);
vi.mock("./aiEngines", () => ({ processChatAI: mocks.processChatAI }));

import { orchestrateInboundText } from "./unifiedAiOrchestrator";

const input = {
  conversationId: 10,
  customerId: 20,
  customerMessageId: 30,
  customerName: "小明",
  channel: "messenger" as const,
  platformId: "psid-1",
  text: "想买好照顾的植物",
  aiReplyEnabled: true,
  handoverStatus: "none" as const,
};

describe("统一 AI 回复编排", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.beginAiMessageOrchestration.mockResolvedValue({ record: { id: 88 }, isNew: true });
    mocks.db.getAiOrchestrationSettings.mockResolvedValue({ isEnabled: true });
  });

  it("同一已存客户消息只会由一个编排记录处理一次", async () => {
    mocks.db.beginAiMessageOrchestration.mockResolvedValue({ record: { id: 88 }, isNew: false });

    const result = await orchestrateInboundText(input);

    expect(result).toEqual({ kind: "duplicate", orchestrationId: 88 });
    expect(mocks.processChatAI).not.toHaveBeenCalled();
  });

  it("人工已接管时在统一入口停止 AI 引擎，不产生第二个自动回复", async () => {
    const result = await orchestrateInboundText({ ...input, handoverStatus: "claimed" });

    expect(mocks.processChatAI).not.toHaveBeenCalled();
    expect(result.kind).toBe("skipped");
    expect(mocks.db.finalizeAiMessageOrchestration).toHaveBeenCalledWith(88, expect.objectContaining({ handledBy: "human", primaryOutcome: "no_reply" }));
  });

  it("商品推荐由统一入口留下可追踪的 AI 销售记录", async () => {
    mocks.processChatAI.mockResolvedValue({
      shouldReply: true,
      shouldHandover: false,
      reply: "适合您的是薄荷。",
      source: "product_ai",
      detectedIntent: "product_recommendation",
      productAiRecommendations: [7],
    });

    const result = await orchestrateInboundText(input);

    expect(result.kind).toBe("reply");
    expect(mocks.db.createAiSalesRecord).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 10,
      sourceMessageId: 30,
      recommendationType: "product",
      recommendedProductIds: [7],
      outcome: "recommended",
    }));
  });
});
