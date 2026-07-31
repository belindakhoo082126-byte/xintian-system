/**
 * AI Test Runner — Safe test execution service for AI Brain Test Center.
 *
 * Core principles:
 * 1. Reuse production engines (processChatAI) with dryRun=true
 * 2. Never send messages, create conversations, or trigger side effects
 * 3. SideEffectPolicy throws errors on any forbidden operation in dry_run mode
 * 4. Test records are written to ai_test_runs (completely isolated from ai_logs)
 */

import { processChatAI, type MessageContext, type ChatAIResult } from "./aiEngines";
import { AiProcessingContext } from "./aiLogContext";
import { getDb } from "./db";
import { aiTestRuns, aiPersona, aiKnowledge, aiLogs } from "../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ---------------------------------------------------------------------------
// SideEffectPolicy — Unified side-effect interception layer
// ---------------------------------------------------------------------------

export type ExecutionMode = "live" | "dry_run";

export interface ViolationRecord {
  operation: string;
  detail: string;
  timestamp: string;
}

export class SideEffectPolicy {
  private violations: ViolationRecord[] = [];

  constructor(private mode: ExecutionMode) {}

  /**
   * Guard a forbidden operation. In dry_run mode, throws an error.
   * In live mode, executes the operation.
   */
  async guard(action: string, fn: () => Promise<void>): Promise<void> {
    if (this.mode === "dry_run") {
      this.violations.push({ operation: action, detail: "blocked", timestamp: new Date().toISOString() });
      throw new Error(
        `[TestRunner] 禁止操作: "${action}" 在测试模式下不可执行`
      );
    }
    await fn();
  }

  /** Check if we're in dry_run mode */
  get isDryRun(): boolean {
    return this.mode === "dry_run";
  }

  /** Get all recorded violations */
  getViolations(): ViolationRecord[] {
    return this.violations;
  }

  // Specific guard methods for testing
  guardSend(platform: string, recipient: string, message: string): void {
    if (this.mode === "dry_run") {
      this.violations.push({ operation: "send", detail: `${platform}:${recipient}`, timestamp: new Date().toISOString() });
      throw new Error(`[TestRunner] FORBIDDEN: send is not allowed in test mode`);
    }
  }

  guardCreateConversation(platform: string, psid: string): void {
    if (this.mode === "dry_run") {
      this.violations.push({ operation: "create_conversation", detail: `${platform}:${psid}`, timestamp: new Date().toISOString() });
      throw new Error(`[TestRunner] FORBIDDEN: create_conversation is not allowed in test mode`);
    }
  }

  guardCreateMessage(conversationId: number, text: string, sender: string): void {
    if (this.mode === "dry_run") {
      this.violations.push({ operation: "create_message", detail: `conv:${conversationId}:${sender}`, timestamp: new Date().toISOString() });
      throw new Error(`[TestRunner] FORBIDDEN: create_message is not allowed in test mode`);
    }
  }

  guardCreateHandover(conversationId: number): void {
    if (this.mode === "dry_run") {
      this.violations.push({ operation: "create_handover", detail: `conv:${conversationId}`, timestamp: new Date().toISOString() });
      throw new Error(`[TestRunner] FORBIDDEN: create_handover is not allowed in test mode`);
    }
  }

  guardIncrementUsage(type: string, id: number): void {
    if (this.mode === "dry_run") {
      this.violations.push({ operation: "increment_usage", detail: `${type}:${id}`, timestamp: new Date().toISOString() });
      throw new Error(`[TestRunner] FORBIDDEN: increment_usage is not allowed in test mode`);
    }
  }

  guardWriteAiLog(): void {
    if (this.mode === "dry_run") {
      this.violations.push({ operation: "write_ai_log", detail: "blocked", timestamp: new Date().toISOString() });
      throw new Error(`[TestRunner] FORBIDDEN: write_ai_log is not allowed in test mode`);
    }
  }

  guardCreateOrder(): void {
    if (this.mode === "dry_run") {
      this.violations.push({ operation: "create_order", detail: "blocked", timestamp: new Date().toISOString() });
      throw new Error(`[TestRunner] FORBIDDEN: create_order is not allowed in test mode`);
    }
  }

  guardNotify(): void {
    if (this.mode === "dry_run") {
      this.violations.push({ operation: "notify", detail: "blocked", timestamp: new Date().toISOString() });
      throw new Error(`[TestRunner] FORBIDDEN: notify is not allowed in test mode`);
    }
  }

  guardTriggerFlow(): void {
    if (this.mode === "dry_run") {
      this.violations.push({ operation: "trigger_flow", detail: "blocked", timestamp: new Date().toISOString() });
      throw new Error(`[TestRunner] FORBIDDEN: trigger_flow is not allowed in test mode`);
    }
  }
}

// ---------------------------------------------------------------------------
// Test Run Types
// ---------------------------------------------------------------------------

export interface TestRunConfig {
  platform: "messenger" | "whatsapp";
  language: string; // auto/zh/en/ms
  aiEnabled: boolean;
  handoverStatus: "none" | "pending" | "claimed";
  enableLLM: boolean;
  simulatedCustomerName?: string;
  isMember: boolean; // reserved — not yet wired to engines
  hasOrder: boolean; // reserved — not yet wired to engines
  testMessage: string;
}

export interface TestRunResult {
  finalSource: string;
  matchedRuleId?: number;
  matchedKnowledgeId?: number;
  matchedProductId?: number;
  aiReply: string | null;
  shouldHandover: boolean;
  handoverReason?: string;
  processingTimeMs: number;
  processingSteps: any[];
  errorCode?: string;
  errorStage?: string;
  errorMessage?: string;
  // LLM tracking
  llmCalled: boolean;
  llmModel?: string;
  llmProcessingTimeMs?: number;
  llmSuccess?: boolean;
  llmErrorStage?: string;
  llmErrorCode?: string;
  llmTimedOut: boolean;
  llmInputTokens?: number;
  llmOutputTokens?: number;
  // Persona snapshot
  personaSnapshot: any;
  // Product AI Intelligence
  productAiTags?: string[];
  productAiRecommendations?: Array<{ productId: number; name: string; sellingPrice: string | null }>;
}

// ---------------------------------------------------------------------------
// Persona Snapshot
// ---------------------------------------------------------------------------

async function getPersonaSnapshot(): Promise<any> {
  const database = await getDb();
  if (!database) return null;
  try {
    const [persona] = await database
      .select()
      .from(aiPersona)
      .limit(1);
    if (!persona) return null;
    return {
      aiName: persona.aiName,
      replyTone: persona.replyTone,
      defaultLanguage: persona.defaultLanguage,
      replyLength: persona.replyLength,
      emojiLevel: persona.emojiLevel,
      ctaTemplate: persona.ctaTemplate,
      replyPrinciples: persona.replyPrinciples,
      personaUpdatedAt: persona.updatedAt,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// LLM Call (for knowledge entries with useLLM=true)
// ---------------------------------------------------------------------------

async function callLLMForTest(
  systemPrompt: string,
  userMessage: string,
  knowledgeContent: string,
  model?: string
): Promise<{
  reply: string;
  model: string;
  processingTimeMs: number;
  success: boolean;
  errorStage?: string;
  errorCode?: string;
  timedOut: boolean;
  inputTokens?: number;
  outputTokens?: number;
}> {
  const t0 = Date.now();
  try {
    const messages = [
      {
        role: "system" as const,
        content: `${systemPrompt}\n\n知识库参考内容:\n${knowledgeContent}`,
      },
      { role: "user" as const, content: userMessage },
    ];

    const response = await invokeLLM({ messages, model });
    const processingTimeMs = Date.now() - t0;

    const rawContent = response?.choices?.[0]?.message?.content;
    const reply = typeof rawContent === "string"
      ? rawContent
      : "抱歉，我暂时无法生成回复。";
    const usage = response?.usage;
    const usedModel = model || "default";

    return {
      reply,
      model: usedModel,
      processingTimeMs,
      success: true,
      timedOut: false,
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
    };
  } catch (err: any) {
    const processingTimeMs = Date.now() - t0;
    const isTimeout =
      err?.code === "ETIMEDOUT" ||
      err?.message?.includes("timeout") ||
      err?.message?.includes("Timeout");

    return {
      reply: "抱歉，AI处理暂时不可用。",
      model: model || "default",
      processingTimeMs,
      success: false,
      errorStage: "llm_call",
      errorCode: isTimeout ? "LLM_TIMEOUT" : err?.code || "LLM_ERROR",
      timedOut: isTimeout,
    };
  }
}

// ---------------------------------------------------------------------------
// Main: Run Test
// ---------------------------------------------------------------------------

export async function runTest(
  config: TestRunConfig,
  testedBy: string
): Promise<TestRunResult> {
  const policy = new SideEffectPolicy("dry_run");

  // 1. Get persona snapshot
  const personaSnapshot = await getPersonaSnapshot();

  // 2. Construct virtual MessageContext (no real IDs)
  const ctx: MessageContext = {
    text: config.testMessage,
    platform: config.platform,
    customerId: undefined,
    conversationId: undefined,
    sourceType: "private_chat",
  };

  // 3. Construct AiProcessingContext (all IDs null)
  const logContext = new AiProcessingContext(
    null,           // conversationId
    null,           // customerId
    config.simulatedCustomerName || null, // customerName
    config.platform, // platform
    null,           // customerMessageId
    config.testMessage, // customerMessage
    config.aiEnabled,  // aiEnabled
    config.handoverStatus, // handoverStatus
  );

  // 4. Record reserved member/order status in trail
  if (config.isMember) {
    logContext.addStep(
      "member_check",
      "会员状态检查",
      "预留功能：尚未接入引擎",
      "skipped"
    );
  }
  if (config.hasOrder) {
    logContext.addStep(
      "order_check",
      "订单状态检查",
      "预留功能：尚未接入引擎",
      "skipped"
    );
  }

  // 5. Execute processChatAI with dryRun=true
  const startTime = Date.now();
  let result: ChatAIResult;
  let errorCode: string | undefined;
  let errorStage: string | undefined;
  let errorMessage: string | undefined;

  try {
    result = await processChatAI(ctx, {
      aiEnabled: config.aiEnabled,
      handoverStatus: config.handoverStatus,
      logContext,
      dryRun: true,
    });
  } catch (err: any) {
    result = {
      shouldReply: false,
      reply: null,
      source: "error",
      shouldHandover: false,
    };
    errorCode = err?.code || "TEST_RUN_ERROR";
    errorStage = "test_execution";
    errorMessage = err?.message || String(err);
    logContext.finalSource = "error";
    logContext.addStep(
      "error",
      "测试执行错误",
      errorMessage,
      "error"
    );
  }

  const processingTimeMs = Date.now() - startTime;

  // 6. LLM call (if enabled and knowledge matched with useLLM=true)
  let llmCalled = false;
  let llmModel: string | undefined;
  let llmProcessingTimeMs: number | undefined;
  let llmSuccess: boolean | undefined;
  let llmErrorStage: string | undefined;
  let llmErrorCode: string | undefined;
  let llmTimedOut = false;
  let llmInputTokens: number | undefined;
  let llmOutputTokens: number | undefined;

  if (
    config.enableLLM &&
    result.source === "knowledge" &&
    result.knowledgeId
  ) {
    // Check if the matched knowledge entry has useLLM=true
    const database = await getDb();
    if (database) {
      const [entry] = await database
        .select()
        .from(aiKnowledge)
        .where(eq(aiKnowledge.id, result.knowledgeId))
        .limit(1);

      if (entry?.useLLM && personaSnapshot) {
        llmCalled = true;
        const systemPrompt = [
          personaSnapshot.aiName
            ? `你是${personaSnapshot.aiName}。`
            : "你是一个友善的客服助手。",
          personaSnapshot.replyTone
            ? `语气：${personaSnapshot.replyTone}`
            : "",
          personaSnapshot.replyPrinciples || "",
        ]
          .filter(Boolean)
          .join("\n");

        const llmResult = await callLLMForTest(
          systemPrompt,
          config.testMessage,
          entry.content
        );

        llmModel = llmResult.model;
        llmProcessingTimeMs = llmResult.processingTimeMs;
        llmSuccess = llmResult.success;
        llmErrorStage = llmResult.errorStage;
        llmErrorCode = llmResult.errorCode;
        llmTimedOut = llmResult.timedOut;
        llmInputTokens = llmResult.inputTokens;
        llmOutputTokens = llmResult.outputTokens;

        if (llmResult.success) {
          // Override the reply with LLM-generated content
          result.reply = llmResult.reply;
          logContext.finalSource = "llm";
          logContext.addStep("llm", "LLM生成", `模型: ${llmModel}, 耗时: ${llmProcessingTimeMs}ms`, "hit", {
            durationMs: llmProcessingTimeMs,
          });
        } else {
          logContext.addStep("llm", "LLM生成", `失败: ${llmErrorCode}`, "error", {
            durationMs: llmProcessingTimeMs,
          });
        }
      } else {
        logContext.addStep(
          "llm",
          "LLM生成",
          config.enableLLM
            ? "知识条目未启用LLM处理"
            : "已跳过（测试配置关闭）",
          "skipped"
        );
      }
    }
  } else if (!config.enableLLM) {
    logContext.addStep(
      "llm",
      "LLM生成",
      "已跳过（测试配置关闭）",
      "skipped"
    );
  } else if (result.source !== "knowledge") {
    logContext.addStep(
      "llm",
      "LLM生成",
      `已跳过（来源: ${result.source}，非知识库命中）`,
      "skipped"
    );
  }

  // 7. Finalize processing trail
  const finalized = logContext.finalize();

  // 8. Build result
  const testResult: TestRunResult = {
    finalSource: finalized.finalSource || result.source,
    matchedRuleId: finalized.matchedRuleId || undefined,
    matchedKnowledgeId: finalized.matchedKnowledgeId || undefined,
    matchedProductId: finalized.matchedProductId || undefined,
    aiReply: result.reply,
    shouldHandover: result.shouldHandover,
    handoverReason: result.handoverReason,
    processingTimeMs,
    processingSteps: finalized.processingSteps,
    errorCode,
    errorStage,
    errorMessage,
    llmCalled,
    llmModel,
    llmProcessingTimeMs,
    llmSuccess,
    llmErrorStage,
    llmErrorCode,
    llmTimedOut,
    llmInputTokens,
    llmOutputTokens,
    personaSnapshot,
    productAiTags: result.productAiTags,
    productAiRecommendations: result.productAiRecommendations?.map(id => ({ productId: id, name: "", sellingPrice: null })),
  };

  // 9. Write to ai_test_runs (independent table)
  const db = await getDb();
  if (db) {
    await db.insert(aiTestRuns).values({
      platform: config.platform,
      language: config.language,
      aiEnabled: config.aiEnabled,
      handoverStatus: config.handoverStatus,
      enableLLM: config.enableLLM,
      simulatedCustomerName: config.simulatedCustomerName || null,
      isMember: config.isMember,
      hasOrder: config.hasOrder,
      testMessage: config.testMessage,
      processingSteps: testResult.processingSteps,
      finalSource: testResult.finalSource as any,
      matchedRuleId: testResult.matchedRuleId || null,
      matchedKnowledgeId: testResult.matchedKnowledgeId || null,
      matchedProductId: testResult.matchedProductId || null,
      aiReply: testResult.aiReply,
      shouldHandover: testResult.shouldHandover,
      handoverReason: testResult.handoverReason || null,
      processingTimeMs: testResult.processingTimeMs,
      errorCode: testResult.errorCode || null,
      errorStage: testResult.errorStage || null,
      errorMessage: testResult.errorMessage || null,
      llmCalled: testResult.llmCalled,
      llmModel: testResult.llmModel || null,
      llmProcessingTimeMs: testResult.llmProcessingTimeMs || null,
      llmSuccess: testResult.llmSuccess,
      llmErrorStage: testResult.llmErrorStage || null,
      llmErrorCode: testResult.llmErrorCode || null,
      llmTimedOut: testResult.llmTimedOut,
      llmInputTokens: testResult.llmInputTokens || null,
      llmOutputTokens: testResult.llmOutputTokens || null,
      personaSnapshot: testResult.personaSnapshot,
      testedBy,
      notes: null,
      previousRunId: null,
    });
  }

  return testResult;
}

// ---------------------------------------------------------------------------
// Rerun a test (creates a new record linked via previousRunId)
// ---------------------------------------------------------------------------

export async function rerunTest(
  runId: number,
  testedBy: string
): Promise<TestRunResult | null> {
  const database = await getDb();
  if (!database) return null;

  const [original] = await database
    .select()
    .from(aiTestRuns)
    .where(eq(aiTestRuns.id, runId))
    .limit(1);

  if (!original) return null;

  const config: TestRunConfig = {
    platform: original.platform,
    language: original.language,
    aiEnabled: original.aiEnabled,
    handoverStatus: original.handoverStatus,
    enableLLM: original.enableLLM,
    simulatedCustomerName: original.simulatedCustomerName || undefined,
    isMember: original.isMember,
    hasOrder: original.hasOrder,
    testMessage: original.testMessage,
  };

  // Run the test
  const result = await runTest(config, testedBy);

  // Update the new record with previousRunId
  // Find the latest record by this tester
  const [latest] = await database
    .select()
    .from(aiTestRuns)
    .where(eq(aiTestRuns.testedBy, testedBy))
    .orderBy(desc(aiTestRuns.id))
    .limit(1);

  if (latest && latest.id !== runId) {
    await database
      .update(aiTestRuns)
      .set({ previousRunId: runId })
      .where(eq(aiTestRuns.id, latest.id));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Replay from AI Log — Re-execute AI on a historical log entry
// ---------------------------------------------------------------------------

export async function replayFromAiLog(
  logId: number,
  testedBy: string
): Promise<{
  historical: {
    finalSource: string;
    matchedRuleId: number | null;
    matchedKnowledgeId: number | null;
    matchedProductId: number | null;
    aiReply: string | null;
    isHandover: boolean;
    handoverReason: string | null;
    processingTimeMs: number | null;
    processingSteps: any;
    errorCode: string | null;
    errorStage: string | null;
    errorMessage: string | null;
    customerMessage: string | null;
    createdAt: Date;
  };
  current: TestRunResult;
  differences: {
    sourceChanged: boolean;
    replyChanged: boolean;
    handoverChanged: boolean;
    ruleChanged: boolean;
    knowledgeChanged: boolean;
    productChanged: boolean;
    processingTimeChanged: boolean;
    sourceDetail: string;
    replyDetail: string;
  };
} | null> {
  const database = await getDb();
  if (!database) return null;

  // 1. Get the original AI log
  const [originalLog] = await database
    .select()
    .from(aiLogs)
    .where(eq(aiLogs.id, logId))
    .limit(1);

  if (!originalLog) return null;

  // 2. Build test config from the log
  const config: TestRunConfig = {
    platform: originalLog.platform === "whatsapp" ? "whatsapp" : "messenger",
    language: "auto",
    aiEnabled: originalLog.aiEnabled,
    handoverStatus: originalLog.handoverStatus as "none" | "pending" | "claimed",
    enableLLM: true, // Always enable LLM for replay to see full behavior
    simulatedCustomerName: originalLog.customerName || undefined,
    isMember: false, // Reserved
    hasOrder: false, // Reserved
    testMessage: originalLog.customerMessage || "",
  };

  // 3. Run the test (dry run, no side effects)
  const currentResult = await runTest(config, testedBy);

  // 4. Build historical snapshot
  const historical = {
    finalSource: originalLog.finalSource,
    matchedRuleId: originalLog.matchedRuleId,
    matchedKnowledgeId: originalLog.matchedKnowledgeId,
    matchedProductId: originalLog.matchedProductId,
    aiReply: originalLog.aiReply,
    isHandover: originalLog.isHandover,
    handoverReason: originalLog.handoverReason,
    processingTimeMs: originalLog.processingTimeMs,
    processingSteps: originalLog.processingSteps,
    errorCode: originalLog.errorCode,
    errorStage: originalLog.errorStage,
    errorMessage: originalLog.errorMessage,
    customerMessage: originalLog.customerMessage,
    createdAt: originalLog.createdAt,
  };

  // 5. Compute differences
  const sourceChanged = historical.finalSource !== currentResult.finalSource;
  const replyChanged = historical.aiReply !== currentResult.aiReply;
  const handoverChanged = historical.isHandover !== currentResult.shouldHandover;
  const ruleChanged = historical.matchedRuleId !== (currentResult.matchedRuleId ?? null);
  const knowledgeChanged = historical.matchedKnowledgeId !== (currentResult.matchedKnowledgeId ?? null);
  const productChanged = historical.matchedProductId !== (currentResult.matchedProductId ?? null);
  const processingTimeChanged = historical.processingTimeMs !== currentResult.processingTimeMs;

  const sourceDetail = sourceChanged
    ? `${historical.finalSource} → ${currentResult.finalSource}`
    : "无变化";
  const replyDetail = replyChanged
    ? "回复内容已改变"
    : "回复内容相同";

  return {
    historical,
    current: currentResult,
    differences: {
      sourceChanged,
      replyChanged,
      handoverChanged,
      ruleChanged,
      knowledgeChanged,
      productChanged,
      processingTimeChanged,
      sourceDetail,
      replyDetail,
    },
  };
}

// ---------------------------------------------------------------------------
// Regression Test — Batch Execution Engine
// ---------------------------------------------------------------------------

export interface RegressionResult {
  runId: number;
  totalQuestions: number;
  passedCount: number;
  failedCount: number;
  accuracy: number;
  avgProcessingMs: number;
  // Difference summary
  newHits: number;
  lostHits: number;
  sourceChanged: number;
  replyChanged: number;
  noMatchIncreased: number;
  noMatchDecreased: number;
  handoverIncreased: number;
  llmIncreased: number;
  llmDecreased: number;
  failedDetails: RegressionFailedDetail[];
}

export interface RegressionFailedDetail {
  questionId: number;
  question: string;
  finalSource: string;
  baselineSource?: string;
  aiReply: string | null;
  baselineReply?: string | null;
  differences: any;
  suggestion: string;
}

export interface RegressionQuestionInput {
  id: number;
  question: string;
  expectedSource?: string;
  expectedKeywords?: string;
  expectedReply?: string;
}

export interface BaselineResult {
  questionId: number;
  finalSource: string;
  aiReply: string | null;
  matchedRuleId?: number;
  matchedKnowledgeId?: number;
  matchedProductId?: number;
  shouldHandover: boolean;
}

/**
 * Run a regression test: execute all questions through the formal AI engine in Dry Run mode.
 * Compare results against baseline (if available).
 * All results are saved to regression_runs and regression_run_details tables.
 */
export async function runRegression(
  questions: RegressionQuestionInput[],
  baseline: BaselineResult[] | null,
  runId: number,
  saveDetailFn: (data: any) => Promise<void>,
): Promise<RegressionResult> {
  let passedCount = 0;
  let failedCount = 0;
  let totalProcessingMs = 0;
  let newHits = 0;
  let lostHits = 0;
  let sourceChanged = 0;
  let replyChanged = 0;
  let noMatchIncreased = 0;
  let noMatchDecreased = 0;
  let handoverIncreased = 0;
  let llmIncreased = 0;
  let llmDecreased = 0;
  const failedDetails: RegressionFailedDetail[] = [];

  const baselineMap = new Map<number, BaselineResult>();
  if (baseline) {
    for (const b of baseline) {
      baselineMap.set(b.questionId, b);
    }
  }

  for (const q of questions) {
    const config: TestRunConfig = {
      platform: "messenger",
      language: "auto",
      aiEnabled: true,
      handoverStatus: "none",
      enableLLM: true,
      isMember: false,
      hasOrder: false,
      testMessage: q.question,
    };

    let result: TestRunResult;
    try {
      result = await runTest(config, "regression");
    } catch (err: any) {
      result = {
        finalSource: "error",
        aiReply: null,
        shouldHandover: false,
        processingTimeMs: 0,
        processingSteps: [{ step: "regression_error", error: err?.message || String(err) }],
        llmCalled: false,
        llmTimedOut: false,
        personaSnapshot: null,
      };
    }

    totalProcessingMs += result.processingTimeMs;

    // Compare with baseline
    const baselineEntry = baselineMap.get(q.id);
    const hasBaseline = !!baselineEntry;

    const diffs: any = {};
    let isPassed = true;
    const suggestions: string[] = [];

    // Check expected source if specified
    if (q.expectedSource && q.expectedSource !== result.finalSource) {
      isPassed = false;
      suggestions.push(`期望来源 ${q.expectedSource}，实际 ${result.finalSource}`);
    }

    // Compare with baseline
    if (hasBaseline) {
      const bl = baselineEntry!;
      if (bl.finalSource !== result.finalSource) {
        diffs.sourceChanged = { from: bl.finalSource, to: result.finalSource };
        sourceChanged++;
        isPassed = false;
        suggestions.push(`来源从 ${bl.finalSource} 变为 ${result.finalSource}`);
      }
      if (bl.aiReply !== result.aiReply) {
        diffs.replyChanged = { from: bl.aiReply, to: result.aiReply };
        replyChanged++;
      }
      if (bl.shouldHandover !== result.shouldHandover) {
        diffs.handoverChanged = { from: bl.shouldHandover, to: result.shouldHandover };
        if (result.shouldHandover && !bl.shouldHandover) handoverIncreased++;
      }
      if (bl.finalSource === "no_match" && result.finalSource !== "no_match") {
        noMatchDecreased++;
        newHits++;
      }
      if (bl.finalSource !== "no_match" && result.finalSource === "no_match") {
        noMatchIncreased++;
        lostHits++;
        isPassed = false;
        suggestions.push("此前可命中，现在无法匹配");
      }
      if (!bl.shouldHandover && result.shouldHandover) {
        handoverIncreased++;
      }
      if (result.llmCalled && !baselineMap.has(q.id)) {
        llmIncreased++;
      }
    } else {
      // No baseline — first run, treat as baseline
      if (result.finalSource === "no_match") {
        isPassed = false;
        suggestions.push("无法匹配任何来源");
      }
    }

    if (isPassed) {
      passedCount++;
    } else {
      failedCount++;
      failedDetails.push({
        questionId: q.id,
        question: q.question,
        finalSource: result.finalSource,
        baselineSource: baselineEntry?.finalSource,
        aiReply: result.aiReply,
        baselineReply: baselineEntry?.aiReply,
        differences: diffs,
        suggestion: suggestions.join("；") || "未通过预期验证",
      });
    }

    // Save detail
    await saveDetailFn({
      runId,
      questionId: q.id,
      question: q.question,
      finalSource: result.finalSource,
      matchedRuleId: result.matchedRuleId || null,
      matchedKnowledgeId: result.matchedKnowledgeId || null,
      matchedProductId: result.matchedProductId || null,
      aiReply: result.aiReply,
      shouldHandover: result.shouldHandover,
      processingTimeMs: result.processingTimeMs,
      llmCalled: result.llmCalled,
      processingSteps: result.processingSteps,
      baselineSource: baselineEntry?.finalSource || null,
      baselineReply: baselineEntry?.aiReply || null,
      baselineRuleId: baselineEntry?.matchedRuleId || null,
      baselineKnowledgeId: baselineEntry?.matchedKnowledgeId || null,
      baselineProductId: baselineEntry?.matchedProductId || null,
      baselineIsHandover: baselineEntry?.shouldHandover || false,
      isPassed,
      differences: diffs,
      suggestion: suggestions.join("；") || null,
    });
  }

  const accuracy = questions.length > 0 ? (passedCount / questions.length) * 100 : 0;
  const avgProcessingMs = questions.length > 0 ? Math.round(totalProcessingMs / questions.length) : 0;

  return {
    runId,
    totalQuestions: questions.length,
    passedCount,
    failedCount,
    accuracy,
    avgProcessingMs,
    newHits,
    lostHits,
    sourceChanged,
    replyChanged,
    noMatchIncreased,
    noMatchDecreased,
    handoverIncreased,
    llmIncreased,
    llmDecreased,
    failedDetails,
  };
}
