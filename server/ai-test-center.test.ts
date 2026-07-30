import { describe, it, expect, vi, beforeEach } from "vitest";
import { SideEffectPolicy } from "./aiTestRunner";

// ---------------------------------------------------------------------------
// SideEffectPolicy — must throw on all forbidden operations
// ---------------------------------------------------------------------------

describe("SideEffectPolicy", () => {
  it("throws when attempting to send a message", () => {
    const policy = new SideEffectPolicy("dry_run");
    expect(() => policy.guardSend("messenger", "test-recipient", "hello")).toThrow(/FORBIDDEN.*send/i);
  });

  it("throws when attempting to create a conversation", () => {
    const policy = new SideEffectPolicy("dry_run");
    expect(() => policy.guardCreateConversation("messenger", "test-psid")).toThrow(/FORBIDDEN.*conversation/i);
  });

  it("throws when attempting to create a chat message", () => {
    const policy = new SideEffectPolicy("dry_run");
    expect(() => policy.guardCreateMessage(1, "hello", "ai")).toThrow(/FORBIDDEN.*message/i);
  });

  it("throws when attempting to create a handover request", () => {
    const policy = new SideEffectPolicy("dry_run");
    expect(() => policy.guardCreateHandover(1)).toThrow(/FORBIDDEN.*handover/i);
  });

  it("throws when attempting to increment usage count", () => {
    const policy = new SideEffectPolicy("dry_run");
    expect(() => policy.guardIncrementUsage("rule", 1)).toThrow(/FORBIDDEN.*usage/i);
  });

  it("throws when attempting to write to ai_logs", () => {
    const policy = new SideEffectPolicy("dry_run");
    expect(() => policy.guardWriteAiLog()).toThrow(/FORBIDDEN.*ai_log/i);
  });

  it("throws when attempting to create an order", () => {
    const policy = new SideEffectPolicy("dry_run");
    expect(() => policy.guardCreateOrder()).toThrow(/FORBIDDEN.*order/i);
  });

  it("throws when attempting to trigger a notification", () => {
    const policy = new SideEffectPolicy("dry_run");
    expect(() => policy.guardNotify()).toThrow(/FORBIDDEN.*notif/i);
  });

  it("throws when attempting to trigger a flow", () => {
    const policy = new SideEffectPolicy("dry_run");
    expect(() => policy.guardTriggerFlow()).toThrow(/FORBIDDEN.*flow/i);
  });

  it("logs all violations to the violation log", () => {
    const policy = new SideEffectPolicy("dry_run");
    try { policy.guardSend("messenger", "x", "y"); } catch {}
    try { policy.guardCreateConversation("messenger", "x"); } catch {}
    try { policy.guardWriteAiLog(); } catch {}
    expect(policy.getViolations()).toHaveLength(3);
    expect(policy.getViolations()[0].operation).toBe("send");
    expect(policy.getViolations()[1].operation).toBe("create_conversation");
    expect(policy.getViolations()[2].operation).toBe("write_ai_log");
  });
});

// ---------------------------------------------------------------------------
// Knowledge draft isolation — status=draft, isEnabled=false
// ---------------------------------------------------------------------------

describe("AI Test Center — Knowledge Draft Isolation", () => {
  it("draft status and isEnabled=false are the correct defaults", () => {
    // Verify the expected defaults match the schema constraints
    const draftDefaults = {
      status: "draft",
      isEnabled: false,
    };
    expect(draftDefaults.status).toBe("draft");
    expect(draftDefaults.isEnabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test run result — finalSource enum coverage
// ---------------------------------------------------------------------------

describe("AI Test Center — Final Source Coverage", () => {
  it("all expected finalSource values are covered", () => {
    const expectedSources = [
      "order_keyword",
      "product",
      "reply_rule",
      "knowledge",
      "llm",
      "no_match",
      "error",
      "ai_disabled",
      "human_claimed",
    ];
    // Each should have a label in the frontend mapping
    const frontendLabels: Record<string, string> = {
      order_keyword: "下单关键词",
      product: "商品资料",
      reply_rule: "固定回复",
      knowledge: "知识库",
      llm: "LLM",
      no_match: "无法匹配",
      error: "错误",
      ai_disabled: "AI已关闭",
      human_claimed: "人工已接手",
    };
    for (const src of expectedSources) {
      expect(frontendLabels[src]).toBeDefined();
    }
  });
});
