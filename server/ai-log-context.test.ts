import { describe, expect, it } from "vitest";
import { AiProcessingContext } from "./aiLogContext";

describe("AiProcessingContext", () => {
  it("records the real processing trail and finalizes a single log record", () => {
    const context = new AiProcessingContext(
      101,
      202,
      "花友小明",
      "messenger",
      303,
      "请问西马运费怎么算？",
      true,
      "ai_active",
    );

    context.addStep("product", "商品资料检查", "未命中商品关键词", "missed");
    context.addStep("reply_rule", "固定回复检查", "命中规则：运费咨询", "hit", { ruleId: 88 });
    context.finalSource = "reply_rule";
    context.matchedRuleId = 88;
    context.aiReply = "西马订单满 RM150，10kg 内免邮；未满则 RM15。";
    context.sendStatus = "pending";

    const log = context.finalize();

    expect(log).toMatchObject({
      conversationId: 101,
      customerId: 202,
      customerName: "花友小明",
      platform: "messenger",
      sourceType: "private_chat",
      customerMessageId: 303,
      aiEnabled: true,
      handoverStatus: "ai_active",
      finalSource: "reply_rule",
      matchedRuleId: 88,
      sendStatus: "pending",
      isHandover: false,
    });
    expect(log.processingSteps).toHaveLength(4);
    expect(log.processingSteps.map((step) => step.step)).toEqual([
      "receive",
      "ai_check",
      "product",
      "reply_rule",
    ]);
    expect(log.processingSteps[3]).toMatchObject({
      result: "hit",
      ruleId: 88,
    });
    expect(log.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("captures timed step errors without swallowing the original exception", () => {
    const context = new AiProcessingContext(
      null,
      1,
      "花友",
      "messenger",
      null,
      "测试消息",
      true,
      "ai_active",
    );

    expect(() => context.timedStep("knowledge", "知识库检查", () => {
      throw new Error("知识库服务暂不可用");
    })).toThrow("知识库服务暂不可用");

    const log = context.finalize();
    const failureStep = log.processingSteps.at(-1);
    expect(failureStep).toMatchObject({
      step: "knowledge",
      label: "知识库检查",
      result: "error",
    });
    expect(failureStep?.detail).toContain("知识库服务暂不可用");
    expect(failureStep?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("truncates long message and detail fields to prevent oversized log rows", () => {
    const longText = "花".repeat(300);
    const context = new AiProcessingContext(
      1,
      2,
      "花友",
      "messenger",
      3,
      longText,
      true,
      "ai_active",
    );
    context.addStep("rule", "固定回复检查", longText, "missed");

    const log = context.finalize();
    expect(log.customerMessage).toHaveLength(200);
    expect(log.processingSteps.at(-1)?.detail).toHaveLength(200);
  });
});
