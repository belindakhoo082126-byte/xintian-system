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
import { eq, and, desc } from "drizzle-orm";
import {
  replyRules,
  aiKnowledge,
  products,
  liveAiFlows,
} from "../drizzle/schema";

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

export async function runReplyRuleEngine(ctx: MessageContext): Promise<EngineResult> {
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

export async function runKnowledgeEngine(ctx: MessageContext): Promise<EngineResult> {
  const database = await getDb();
  if (!database) return { matched: false, reply: null, source: "knowledge" };

  // Get all enabled knowledge entries sorted by priority
  const knowledgeEntries = await database
    .select()
    .from(aiKnowledge)
    .where(eq(aiKnowledge.isEnabled, true))
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
}

export async function processChatAI(
  ctx: MessageContext,
  options: {
    aiEnabled: boolean;
    handoverStatus: "none" | "pending" | "claimed";
  }
): Promise<ChatAIResult> {
  // Step 1: Check if AI is enabled
  if (!options.aiEnabled) {
    return {
      shouldReply: false,
      reply: null,
      source: "ai_disabled",
      shouldHandover: false,
    };
  }

  // Step 2: Check if human has taken over
  if (options.handoverStatus === "claimed") {
    return {
      shouldReply: false,
      reply: null,
      source: "human_claimed",
      shouldHandover: false,
    };
  }

  // Step 3: Product keyword match
  const productResult = await runProductMatchEngine(ctx);
  if (productResult.matched) {
    return {
      shouldReply: true,
      reply: productResult.reply,
      source: "product",
      shouldHandover: false,
    };
  }

  // Step 4: Reply Rule Engine
  const ruleResult = await runReplyRuleEngine(ctx);
  if (ruleResult.matched) {
    return {
      shouldReply: true,
      reply: ruleResult.reply,
      source: "reply_rule",
      shouldHandover: false,
    };
  }

  // Step 5: Knowledge Engine
  const knowledgeResult = await runKnowledgeEngine(ctx);
  if (knowledgeResult.matched) {
    return {
      shouldReply: true,
      reply: knowledgeResult.reply,
      source: "knowledge",
      shouldHandover: false,
    };
  }

  // Step 6: No match — handover to human
  return {
    shouldReply: false,
    reply: null,
    source: "no_match",
    shouldHandover: true,
    handoverReason: "AI无法匹配客户消息，需要人工处理",
  };
}
