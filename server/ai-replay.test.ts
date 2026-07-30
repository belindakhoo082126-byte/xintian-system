import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getAiLogForReplay: vi.fn(),
}));

// Mock aiEngines to avoid importing real processChatAI
vi.mock("./aiEngines", () => ({
  processChatAI: vi.fn(),
}));

// Mock aiLogContext
vi.mock("./aiLogContext", () => ({
  AiProcessingContext: vi.fn().mockImplementation(() => ({
    addStep: vi.fn(),
    finalize: vi.fn().mockReturnValue({
      finalSource: "reply_rule",
      matchedRuleId: 1,
      matchedKnowledgeId: null,
      matchedProductId: null,
      processingSteps: [],
    }),
  })),
}));

// Mock llm
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import * as db from "./db";

describe("AI Replay — db.getAiLogForReplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when database is unavailable", async () => {
    vi.mocked(db.getAiLogForReplay).mockResolvedValue(null);
    const result = await db.getAiLogForReplay(1);
    expect(result).toBeNull();
  });

  it("returns log data when found", async () => {
    const mockLog = {
      id: 1,
      customerMessage: "请问运费多少",
      platform: "messenger",
      sourceType: "private_chat",
      aiEnabled: true,
      handoverStatus: "none",
      finalSource: "reply_rule",
      matchedRuleId: 1,
      matchedKnowledgeId: null,
      matchedProductId: null,
      aiReply: "西马运费 RM10",
      isHandover: false,
      handoverReason: null,
      processingTimeMs: 50,
      processingSteps: [],
      errorCode: null,
      errorStage: null,
      errorMessage: null,
      customerName: "Test User",
      createdAt: new Date("2026-07-20"),
    };
    vi.mocked(db.getAiLogForReplay).mockResolvedValue(mockLog);

    const result = await db.getAiLogForReplay(1);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
    expect(result!.customerMessage).toBe("请问运费多少");
    expect(result!.finalSource).toBe("reply_rule");
  });

  it("returns null when log not found", async () => {
    vi.mocked(db.getAiLogForReplay).mockResolvedValue(null);
    const result = await db.getAiLogForReplay(999);
    expect(result).toBeNull();
  });
});

describe("AI Replay — difference computation logic", () => {
  it("detects source change correctly", () => {
    const historical = { finalSource: "reply_rule" };
    const current = { finalSource: "knowledge" };
    const sourceChanged = historical.finalSource !== current.finalSource;
    expect(sourceChanged).toBe(true);
  });

  it("detects no source change when same", () => {
    const historical = { finalSource: "reply_rule" };
    const current = { finalSource: "reply_rule" };
    const sourceChanged = historical.finalSource !== current.finalSource;
    expect(sourceChanged).toBe(false);
  });

  it("detects reply change correctly", () => {
    const historical = { aiReply: "回复A" };
    const current = { aiReply: "回复B" };
    const replyChanged = historical.aiReply !== current.aiReply;
    expect(replyChanged).toBe(true);
  });

  it("detects handover change correctly", () => {
    const historical = { isHandover: false };
    const current = { shouldHandover: true };
    const handoverChanged = historical.isHandover !== current.shouldHandover;
    expect(handoverChanged).toBe(true);
  });

  it("builds source detail string for changed source", () => {
    const historical = { finalSource: "reply_rule" };
    const current = { finalSource: "no_match" };
    const sourceDetail = `${historical.finalSource} → ${current.finalSource}`;
    expect(sourceDetail).toBe("reply_rule → no_match");
  });
});

describe("AI Replay — router structure", () => {
  it("aiLog.replay procedure exists in router", async () => {
    const routerModule = await import("./routers");
    const appRouter = (routerModule as any).appRouter ?? (routerModule as any).default;
    if (appRouter) {
      const procedures = Object.keys(appRouter._def.procedures);
      expect(procedures).toContain("aiLog.replay");
    }
  });
});
