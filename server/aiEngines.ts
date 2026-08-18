/**
 * AI Customer Service Engines — Three independent modules
 *
 * 1. Flow Engine    — Handles FB Live/Post/Reel bound flows
 * 2. Reply Rule Engine — Fixed reply rules (Admin-maintained, replaces hardcoded)
 * 3. Knowledge Engine  — AI knowledge base matching (independent from Live Flow)
 *
 * These modules are intentionally decoupled so the future "AI Brain" can
 * manage Flow, Reply Templates, Knowledge Base, and AI Rules independently.
 */

import { getDb } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  replyRules,
  aiKnowledge,
  products,
  liveAiFlows,
} from "../drizzle/schema";
import type { AiProcessingContext } from "./aiLogContext";
import { classifyIntent, generateHandoverSummary } from "./businessAi";
import { capturePrivateChatOrderIntent } from "./privateChatOrderActions";
import { runProductAiRecommendation } from "./productAi";
import type { CaseIntent, HandoverSummary } from "./businessAi";

// Helper: increment usage count and update lastMatchedAt for a matched rule or knowledge entry
async function recordUsage(table: "replyRules" | "aiKnowledge", id: number): Promise<void> {
  const database = await getDb();
  if (!database) return;
  try {
    if (table === "replyRules") {
      await database.update(replyRules)
        .set({
          usageCount: sql`${replyRules.usageCount} + 1`,
          lastMatchedAt: new Date(),
        })
        .where(eq(replyRules.id, id));
    } else {
      await database.update(aiKnowledge)
        .set({
          usageCount: sql`${aiKnowledge.usageCount} + 1`,
          lastMatchedAt: new Date(),
        })
        .where(eq(aiKnowledge.id, id));
    }
  } catch (err) {
    console.error(`[AI Engine] Failed to record usage for ${table} id=${id}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EngineResult {
  matched: boolean;
  reply: string | null;
  source: "flow" | "reply_rule" | "knowledge" | "product" | "none";
  flowId?: number;
  ruleId?: number;
  knowledgeId?: number;
  productId?: number;
}

export interface MessageContext {
  text: string;
  platform: "messenger" | "whatsapp";
  customerId?: number;
  customerName?: string | null;
  messengerId?: string | null;
  conversationId?: number;
  // For Flow Engine: identify if message comes from a FB Live/Post/Reel context
  sourceType?: "fb_live" | "fb_post" | "fb_reel" | "private_chat";
  sourceRef?: string; // e.g., live video ID, post ID, reel ID
}

// ---------------------------------------------------------------------------
// 1. Flow Engine
//    Handles messages from FB Live/Post/Reel that have bound flows.
//    Private chat (Messenger/WhatsApp) does NOT enter this engine.
// ---------------------------------------------------------------------------

export async function runFlowEngine(ctx: MessageContext): Promise<EngineResult> {
  // Only process if source is FB Live/Post/Reel
  if (!ctx.sourceType || ctx.sourceType === "private_chat") {
    return { matched: false, reply: null, source: "flow" };
  }

  const database = await getDb();
  if (!database) return { matched: false, reply: null, source: "flow" };

  // Find matching live AI flow (all flows are checked, as they are keyword-based)
  const flows = await database
    .select()
    .from(liveAiFlows)
    .where(eq(liveAiFlows.isEnabled, true))
    .orderBy(desc(liveAiFlows.sortOrder));

  for (const flow of flows) {
    // Check if message matches flow trigger keywords
    const triggerKeywords: string[] = flow.triggerKeywords
      ? JSON.parse(flow.triggerKeywords)
      : [];

    if (triggerKeywords.length === 0) continue;

    const textLower = ctx.text.toLowerCase();
    const matched = triggerKeywords.some((kw) =>
      textLower.includes(kw.toLowerCase())
    );

    if (matched) {
      return {
        matched: true,
        reply: flow.replyContent || null,
        source: "flow",
        flowId: flow.id,
      };
    }
  }

  return { matched: false, reply: null, source: "flow" };
}

// ---------------------------------------------------------------------------
// 2. Reply Rule Engine
//    Fixed reply rules maintained by Admin via backend UI.
//    Replaces all hardcoded keyword replies.
// ---------------------------------------------------------------------------

export async function runReplyRuleEngine(
  ctx: MessageContext,
  options?: { dryRun?: boolean }
): Promise<EngineResult> {
  const database = await getDb();
  if (!database) return { matched: false, reply: null, source: "reply_rule" };

  // Get all enabled reply rules sorted by priority
  const rules = await database
    .select()
    .from(replyRules)
    .where(eq(replyRules.isEnabled, true))
    .orderBy(replyRules.priority);

  const textLower = ctx.text.toLowerCase().trim();

  for (const rule of rules) {
    // Check channel scope
    let channels: string[] = [];
    try {
      channels = rule.channels ? JSON.parse(rule.channels) : ["messenger", "whatsapp"];
    } catch {
      channels = ["messenger", "whatsapp"];
    }

    if (!channels.includes(ctx.platform)) continue;

    // Check trigger keywords
    let triggerKeywords: string[] = [];
    try {
      triggerKeywords = JSON.parse(rule.triggerKeywords);
    } catch {
      continue;
    }

    if (triggerKeywords.length === 0) continue;

    const matched = triggerKeywords.some((kw) =>
      textLower.includes(kw.toLowerCase())
    );

    if (matched) {
      if (!options?.dryRun) await recordUsage("replyRules", rule.id);
      return {
        matched: true,
        reply: rule.replyContent,
        source: "reply_rule",
        ruleId: rule.id,
      };
    }
  }

  return { matched: false, reply: null, source: "reply_rule" };
}

// ---------------------------------------------------------------------------
// 3. Knowledge Engine
//    AI knowledge base matching — independent from Live Flow.
//    Used for Messenger/WhatsApp private chat when Reply Rules don't match.
// ---------------------------------------------------------------------------

export async function runKnowledgeEngine(
  ctx: MessageContext,
  options?: { dryRun?: boolean }
): Promise<EngineResult> {
  const database = await getDb();
  if (!database) return { matched: false, reply: null, source: "knowledge" };

  // Get all enabled, published knowledge entries sorted by priority
  // Draft entries (status='draft') are excluded from engine matching
  const knowledgeEntries = await database
    .select()
    .from(aiKnowledge)
    .where(and(eq(aiKnowledge.isEnabled, true), eq(aiKnowledge.status, "published")))
    .orderBy(aiKnowledge.priority);

  const textLower = ctx.text.toLowerCase().trim();

  for (const entry of knowledgeEntries) {
    let triggerKeywords: string[] = [];
    try {
      triggerKeywords = JSON.parse(entry.triggerKeywords);
    } catch {
      continue;
    }

    if (triggerKeywords.length === 0) continue;

    const matched = triggerKeywords.some((kw) =>
      textLower.includes(kw.toLowerCase())
    );

    if (matched) {
      if (!options?.dryRun) await recordUsage("aiKnowledge", entry.id);
      return {
        matched: true,
        reply: entry.content,
        source: "knowledge",
        knowledgeId: entry.id,
      };
    }
  }

  return { matched: false, reply: null, source: "knowledge" };
}

// ---------------------------------------------------------------------------
// 4. Product Match Engine
//    Checks if the message contains a valid product keyword for ordering.
//    Returns product info if matched.
// ---------------------------------------------------------------------------

export async function runProductMatchEngine(ctx: MessageContext): Promise<EngineResult> {
  const database = await getDb();
  if (!database) return { matched: false, reply: null, source: "product" };

  // Get all active products with keywords
  const allProducts = await database
    .select({
      id: products.id,
      name: products.name,
      keyword: products.keyword,
      sellingPrice: products.sellingPrice,
      shortDescZh: products.shortDescZh,
      status: products.status,
    })
    .from(products)
    .where(eq(products.status, "active"));

  const textLower = ctx.text.toLowerCase().trim();

  for (const product of allProducts) {
    if (product.keyword && textLower.includes(product.keyword.toLowerCase())) {
      const priceText = product.sellingPrice
        ? ` (RM${product.sellingPrice})`
        : "";
      const reply = `您提到的「${product.name}」${priceText}是我们目前在售的商品！\n${
        product.shortDescZh || ""
      }\n\n如需下单或了解更多详情，请随时告诉我们！`;

      return {
        matched: true,
        reply,
        source: "product",
        productId: product.id,
      };
    }
  }

  return { matched: false, reply: null, source: "product" };
}

// ---------------------------------------------------------------------------
// Main: Chat AI Pipeline
//    Orchestrates the engines in the correct order for private chat.
//
//    Flow:
//    1. Check AI enabled
//    2. Check human handover
//    3. Product keyword match
//    4. Reply Rule Engine (fixed rules)
//    5. Knowledge Engine (AI knowledge base)
//    6. If none matched → handover to human
// ---------------------------------------------------------------------------

export interface ChatAIResult {
  shouldReply: boolean;
  reply: string | null;
  source: string;
  shouldHandover: boolean;
  handoverReason?: string;
  ruleId?: number;
  knowledgeId?: number;
  productId?: number;
  // Business AI Integration
  detectedIntent?: string;
  handoverSummary?: any;
  draftOrderId?: number;
  changeRequestId?: number;
  // Product AI Intelligence
  productAiTags?: string[];
  productAiRecommendations?: number[];
}

export async function processChatAI(
  ctx: MessageContext,
  options: {
    aiEnabled: boolean;
    handoverStatus: "none" | "pending" | "claimed";
    logContext?: AiProcessingContext;
    dryRun?: boolean;
  }
): Promise<ChatAIResult> {
  const logCtx = options.logContext;

  // Step 1: Check if AI is enabled
  if (!options.aiEnabled) {
    if (logCtx) { logCtx.addStep("ai_disabled", "AI已关闭", "AI未开启，不自动回复", "skipped"); logCtx.finalSource = "ai_disabled"; }
    return {
      shouldReply: false,
      reply: null,
      source: "ai_disabled",
      shouldHandover: false,
      detectedIntent: classifyIntent(ctx.text).intent,
    };
  }

  // Step 2: Check if human has taken over
  if (options.handoverStatus === "claimed") {
    if (logCtx) { logCtx.addStep("human_check", "人工接手检查", "已被人工接手，AI不回复", "skipped"); logCtx.finalSource = "human_claimed"; }
    return {
      shouldReply: false,
      reply: null,
      source: "human_claimed",
      shouldHandover: false,
      detectedIntent: classifyIntent(ctx.text).intent,
    };
  }

  // Step 2.5: Intent Classification (Business AI)
  const intent = classifyIntent(ctx.text);
  if (logCtx) logCtx.addStep("intent_classification", "意图分类", `意图：${intent.intent}（置信度：${intent.confidence}），工作流：${intent.workflow}`, intent.shouldHandover ? "handover" : "classified");

  // Step 2.6: Mandatory handover — parcel_issue, complaint, refund, cooperation, human_assistance
  if (intent.shouldHandover) {
    const summary = generateHandoverSummary({
      customerName: logCtx?.customerName || "客户",
      customerMessage: ctx.text,
      reason: `AI识别到${intent.intent === "parcel_issue" ? "包裹问题" : intent.intent === "complaint" ? "投诉" : intent.intent === "refund" ? "退款请求" : intent.intent === "cooperation" ? "合作意向" : "人工客服请求"}，强制转人工`,
      detectedIntent: intent.intent as CaseIntent,
      aiAction: "AI识别到强制转人工场景，不自动回复，直接转人工处理",
    });
    if (logCtx) {
      logCtx.finalSource = "intent_handover";
      logCtx.isHandover = true;
      logCtx.handoverReason = summary.reason;
    }
    return {
      shouldReply: false,
      reply: null,
      source: "intent_handover",
      shouldHandover: true,
      handoverReason: summary.reason,
      detectedIntent: intent.intent,
      handoverSummary: summary,
    };
  }

  // Step 2.7: Private-chat order actions are constrained to creating a
  // reviewable draft/request. They never modify an official order here.
  if (intent.workflow === "draft_order" || intent.workflow === "change_request") {
    if (options.dryRun) {
      if (logCtx) logCtx.addStep("private_order_action", "私聊订单受控动作", "干跑模式：已识别为待审核订单动作，未写入业务资料", "skipped");
      return {
        shouldReply: true,
        reply: "测试模式：已识别订单操作意图；正式处理时将只建立待审核记录。",
        source: "private_order_action_dry_run",
        shouldHandover: false,
        detectedIntent: intent.intent,
      };
    }
    const action = await capturePrivateChatOrderIntent({
      message: ctx.text,
      customerId: ctx.customerId,
      customerName: ctx.customerName,
      messengerId: ctx.messengerId,
      workflow: intent.workflow,
    });
    if (logCtx) {
      logCtx.addStep(
        "private_order_action",
        "私聊订单受控动作",
        action.shouldHandover ? `无法安全写入：${action.handoverReason}` : "已建立待审核业务记录，未改动正式订单",
        action.shouldHandover ? "handover" : "hit",
      );
      logCtx.finalSource = action.shouldHandover ? "private_order_action_handover" : "private_order_action";
      logCtx.isHandover = action.shouldHandover;
      logCtx.handoverReason = action.handoverReason;
      logCtx.aiReply = action.reply ?? null;
    }
    if (action.shouldHandover) {
      const summary = generateHandoverSummary({
        customerName: ctx.customerName || logCtx?.customerName || "客户",
        customerMessage: ctx.text,
        reason: action.handoverReason || "订单资料无法安全确认",
        detectedIntent: intent.intent as CaseIntent,
        aiAction: "AI未建立或修改订单，已转交人工核对",
      });
      return { shouldReply: false, reply: null, source: "private_order_action", shouldHandover: true, handoverReason: action.handoverReason, detectedIntent: intent.intent, handoverSummary: summary };
    }
    return {
      shouldReply: Boolean(action.reply),
      reply: action.reply || null,
      source: "private_order_action",
      shouldHandover: false,
      detectedIntent: intent.intent,
      draftOrderId: action.draftOrderId,
      changeRequestId: action.changeRequestId,
    };
  }

  // Step 2.8: Flow source check (private chat skips Flow Engine)
  if (logCtx) logCtx.addStep("flow_check", "Flow来源检查", "普通私聊，不进入Flow Engine", "skipped");

  // Step 2.8: Product AI Recommendation (AI Tags based)
  const tAi = Date.now();
  const aiRecResult = await runProductAiRecommendation(ctx.text, {
    enableLLM: true,
    personaSnapshot: null, // will be fetched inside if needed
    logContext: logCtx,
  });
  if (aiRecResult.matched) {
    if (logCtx) {
      logCtx.finalSource = "product_ai";
      logCtx.matchedProductId = aiRecResult.recommendations[0]?.productId;
      logCtx.aiReply = aiRecResult.reply;
    }
    return {
      shouldReply: true,
      reply: aiRecResult.reply,
      source: "product_ai",
      shouldHandover: false,
      productId: aiRecResult.recommendations[0]?.productId,
      detectedIntent: intent.intent,
      productAiTags: aiRecResult.matchedTags,
      productAiRecommendations: aiRecResult.recommendations.map(r => r.productId),
    };
  }

  // Step 3: Order keyword / Product keyword match
  const t0 = Date.now();
  const productResult = await runProductMatchEngine(ctx);
  if (logCtx) logCtx.addStep("order_keyword", "下单关键词匹配", "未命中下单关键词", "missed", { durationMs: Date.now() - t0 });
  if (productResult.matched) {
    if (logCtx) { logCtx.addStep("product_match", "商品真实资料匹配", `命中商品（ID:${productResult.productId}）`, "hit", { productId: productResult.productId }); logCtx.finalSource = "product"; logCtx.matchedProductId = productResult.productId; logCtx.aiReply = productResult.reply; }
    return {
      shouldReply: true,
      reply: productResult.reply,
      source: "product",
      shouldHandover: false,
      productId: productResult.productId,
      detectedIntent: intent.intent,
    };
  }
  if (logCtx) logCtx.addStep("product_match", "商品真实资料匹配", "未命中商品关键词", "missed");

  // Step 4: Reply Rule Engine
  const t1 = Date.now();
  const ruleResult = await runReplyRuleEngine(ctx, { dryRun: options.dryRun });
  if (logCtx) logCtx.addStep("reply_rule", "固定回复规则", ruleResult.matched ? `命中规则（ID:${ruleResult.ruleId}）` : "未命中固定回复规则", ruleResult.matched ? "hit" : "missed", { durationMs: Date.now() - t1, ruleId: ruleResult.ruleId });
  if (ruleResult.matched) {
    if (logCtx) { logCtx.finalSource = "reply_rule"; logCtx.matchedRuleId = ruleResult.ruleId; logCtx.aiReply = ruleResult.reply; }
    return {
      shouldReply: true,
      reply: ruleResult.reply,
      source: "reply_rule",
      shouldHandover: false,
      ruleId: ruleResult.ruleId,
      detectedIntent: intent.intent,
    };
  }

  // Step 5: Knowledge Engine
  const t2 = Date.now();
  const knowledgeResult = await runKnowledgeEngine(ctx, { dryRun: options.dryRun });
  if (logCtx) logCtx.addStep("knowledge", "AI知识库", knowledgeResult.matched ? `命中知识（ID:${knowledgeResult.knowledgeId}）` : "未命中知识库", knowledgeResult.matched ? "hit" : "missed", { durationMs: Date.now() - t2, knowledgeId: knowledgeResult.knowledgeId });
  if (knowledgeResult.matched) {
    if (logCtx) { logCtx.finalSource = "knowledge"; logCtx.matchedKnowledgeId = knowledgeResult.knowledgeId; logCtx.aiReply = knowledgeResult.reply; }
    return {
      shouldReply: true,
      reply: knowledgeResult.reply,
      source: "knowledge",
      shouldHandover: false,
      knowledgeId: knowledgeResult.knowledgeId,
      detectedIntent: intent.intent,
    };
  }

  // Step 6: No match — handover to human
  const noMatchSummary = generateHandoverSummary({
    customerName: logCtx?.customerName || "客户",
    customerMessage: ctx.text,
    reason: "AI无法匹配客户消息，需要人工处理",
    detectedIntent: intent.intent as CaseIntent,
    aiAction: "AI尝试了商品匹配、固定回复规则、知识库匹配，均未命中",
  });
  if (logCtx) { logCtx.addStep("handover", "转人工", "AI无法匹配客户消息，需要人工处理", "handover"); logCtx.finalSource = "no_match"; logCtx.isHandover = true; logCtx.handoverReason = "AI无法匹配客户消息，需要人工处理"; }
  return {
    shouldReply: false,
    reply: null,
    source: "no_match",
    shouldHandover: true,
    handoverReason: "AI无法匹配客户消息，需要人工处理",
    detectedIntent: intent.intent,
    handoverSummary: noMatchSummary,
  };
}
