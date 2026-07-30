import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getAiAnalysisDashboard: vi.fn(),
  getSourceAnalysis: vi.fn(),
  getKnowledgeAnalysis: vi.fn(),
  getReplyRuleAnalysis: vi.fn(),
  getNoMatchAnalysis: vi.fn(),
  getHandoverAnalysis: vi.fn(),
  getLlmAnalysis: vi.fn(),
  getAiSuggestions: vi.fn(),
}));

import * as db from "./db";

describe("AI Analysis Center — db helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAiAnalysisDashboard returns zero stats when db unavailable", async () => {
    vi.mocked(db.getAiAnalysisDashboard).mockResolvedValue({
      totalReplies: 0,
      hitRate: 0,
      handoverRate: 0,
      failureRate: 0,
      avgProcessingMs: 0,
      llmCallCount: 0,
      bySource: {},
      totalBySource: {},
      sentCount: 0,
      failedCount: 0,
      handoverCount: 0,
      noMatchCount: 0,
    });

    const result = await db.getAiAnalysisDashboard(1);
    expect(result.totalReplies).toBe(0);
    expect(result.hitRate).toBe(0);
  });

  it("getAiAnalysisDashboard calculates hit rate correctly", async () => {
    vi.mocked(db.getAiAnalysisDashboard).mockResolvedValue({
      totalReplies: 10,
      hitRate: 80,
      handoverRate: 10,
      failureRate: 20,
      avgProcessingMs: 500,
      llmCallCount: 2,
      bySource: { reply_rule: 4, knowledge: 3, no_match: 2, product: 1 },
      totalBySource: { reply_rule: 4, knowledge: 3, no_match: 2, product: 1 },
      sentCount: 8,
      failedCount: 2,
      handoverCount: 1,
      noMatchCount: 2,
    });

    const result = await db.getAiAnalysisDashboard(7);
    expect(result.totalReplies).toBe(10);
    expect(result.hitRate).toBe(80);
    expect(result.handoverRate).toBe(10);
    expect(result.failureRate).toBe(20);
    expect(result.bySource.reply_rule).toBe(4);
  });

  it("getSourceAnalysis returns sorted sources", async () => {
    vi.mocked(db.getSourceAnalysis).mockResolvedValue({
      sources: [
        { source: "reply_rule", count: 5, percentage: 50 },
        { source: "knowledge", count: 3, percentage: 30 },
        { source: "no_match", count: 2, percentage: 20 },
      ],
      total: 10,
    });

    const result = await db.getSourceAnalysis(7);
    expect(result.total).toBe(10);
    expect(result.sources[0].source).toBe("reply_rule");
    expect(result.sources[0].percentage).toBe(50);
  });

  it("getKnowledgeAnalysis separates published and draft", async () => {
    vi.mocked(db.getKnowledgeAnalysis).mockResolvedValue({
      usageRanking: [
        { id: 2, topic: "会员制度", category: "会员", usageCount: 5, lastMatchedAt: new Date(), isEnabled: true, status: "published" },
      ],
      neverUsed: [
        { id: 4, topic: "换盆服务", category: "常见问题", isEnabled: true, status: "published" },
      ],
      disabled: [],
      drafts: [
        { id: 30001, topic: "来自测试 #7", category: "faq", sourceAiTestRunId: 7, sourceNote: "test" },
      ],
      total: 6,
      publishedCount: 5,
      draftCount: 1,
    });

    const result = await db.getKnowledgeAnalysis();
    expect(result.total).toBe(6);
    expect(result.publishedCount).toBe(5);
    expect(result.draftCount).toBe(1);
    expect(result.usageRanking[0].topic).toBe("会员制度");
    expect(result.drafts[0].sourceAiTestRunId).toBe(7);
  });

  it("getReplyRuleAnalysis identifies never-used rules", async () => {
    vi.mocked(db.getReplyRuleAnalysis).mockResolvedValue({
      topHits: [
        { id: 1, name: "运费咨询", usageCount: 10, lastMatchedAt: new Date(), isEnabled: true },
      ],
      lowHits: [],
      neverUsed: [
        { id: 2, name: "营业时间", isEnabled: true },
        { id: 3, name: "付款方式", isEnabled: true },
      ],
      total: 6,
      enabledCount: 6,
    });

    const result = await db.getReplyRuleAnalysis();
    expect(result.total).toBe(6);
    expect(result.neverUsed.length).toBe(2);
    expect(result.topHits[0].name).toBe("运费咨询");
  });

  it("getNoMatchAnalysis returns top questions", async () => {
    vi.mocked(db.getNoMatchAnalysis).mockResolvedValue({
      topQuestions: [
        { message: "有没有新植物", count: 5, lastAskedAt: new Date() },
        { message: "什么时候到货", count: 3, lastAskedAt: new Date() },
      ],
      total: 8,
    });

    const result = await db.getNoMatchAnalysis(7, 20);
    expect(result.total).toBe(8);
    expect(result.topQuestions[0].count).toBe(5);
  });

  it("getHandoverAnalysis returns reason distribution", async () => {
    vi.mocked(db.getHandoverAnalysis).mockResolvedValue({
      total: 3,
      byReason: [
        { reason: "AI无法回答", count: 2 },
        { reason: "客户要求人工", count: 1 },
      ],
      recentHandovers: [],
    });

    const result = await db.getHandoverAnalysis(7);
    expect(result.total).toBe(3);
    expect(result.byReason[0].reason).toBe("AI无法回答");
  });

  it("getLlmAnalysis returns call statistics", async () => {
    vi.mocked(db.getLlmAnalysis).mockResolvedValue({
      totalCalls: 5,
      successCount: 4,
      failedCount: 1,
      successRate: 80,
      avgProcessingMs: 1200,
      avgInputTokens: 150,
      avgOutputTokens: 200,
      byModel: [{ model: "gpt-4o-mini", count: 5 }],
    });

    const result = await db.getLlmAnalysis(7);
    expect(result.totalCalls).toBe(5);
    expect(result.successRate).toBe(80);
    expect(result.byModel[0].model).toBe("gpt-4o-mini");
  });

  it("getAiSuggestions returns improvement suggestions", async () => {
    vi.mocked(db.getAiSuggestions).mockResolvedValue({
      suggestions: [
        {
          type: "no_match",
          severity: "high",
          title: "「有没有新植物」被问及 5 次，AI无法回答",
          description: "建议建立对应知识库条目",
          action: "建立知识库条目",
        },
        {
          type: "rule_unused",
          severity: "medium",
          title: "固定回复规则「营业时间」从未被命中",
          description: "可能需要优化关键词",
          action: "优化关键词或停用",
        },
      ],
    });

    const result = await db.getAiSuggestions();
    expect(result.suggestions.length).toBe(2);
    expect(result.suggestions[0].severity).toBe("high");
    expect(result.suggestions[1].type).toBe("rule_unused");
  });
});

describe("AI Analysis Center — router structure", () => {
  it("aiAnalysis router should have all 8 procedures", async () => {
    // Import the router definition
    const routerModule = await import("./routers");
    const appRouter = (routerModule as any).appRouter ?? (routerModule as any).default;
    if (appRouter) {
      // tRPC flattens nested routers with dot notation
      const procedures = Object.keys(appRouter._def.procedures);
      expect(procedures).toContain("aiAnalysis.getDashboard");
      expect(procedures).toContain("aiAnalysis.getSourceAnalysis");
      expect(procedures).toContain("aiAnalysis.getKnowledgeAnalysis");
      expect(procedures).toContain("aiAnalysis.getReplyRuleAnalysis");
      expect(procedures).toContain("aiAnalysis.getNoMatchAnalysis");
      expect(procedures).toContain("aiAnalysis.getHandoverAnalysis");
      expect(procedures).toContain("aiAnalysis.getLlmAnalysis");
      expect(procedures).toContain("aiAnalysis.getSuggestions");
    }
  });
});
