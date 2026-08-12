import type { AiProcessingContext } from "./aiLogContext";
import { processChatAI, type ChatAIResult } from "./aiEngines";
import {
  beginAiMessageOrchestration,
  createAiSalesRecord,
  createHandoverRequest,
  finalizeAiMessageOrchestration,
  getAiOrchestrationSettings,
} from "./db";

export type UnifiedInputType = "text" | "image" | "audio" | "video" | "file";

export interface UnifiedTextInput {
  conversationId: number;
  customerId: number | null;
  customerMessageId: number;
  customerName: string;
  channel: "messenger" | "whatsapp";
  platformId: string;
  text: string;
  aiReplyEnabled: boolean;
  handoverStatus: "none" | "pending" | "claimed";
  sourceType?: "fb_live" | "fb_post" | "fb_reel" | "private_chat";
  inputType?: UnifiedInputType;
  logContext?: AiProcessingContext;
}

export type UnifiedTextOutcome =
  | { kind: "duplicate"; orchestrationId: number }
  | { kind: "reply"; orchestrationId: number; result: ChatAIResult }
  | { kind: "handover"; orchestrationId: number; result: ChatAIResult }
  | { kind: "skipped"; orchestrationId: number; result: ChatAIResult };

/**
 * The sole decision entry for a persisted private-chat text message.
 * It never sends a platform message; the channel adapter remains responsible
 * for delivery and reports the resulting stored reply message back to this service.
 */
export async function orchestrateInboundText(input: UnifiedTextInput): Promise<UnifiedTextOutcome> {
  const started = await beginAiMessageOrchestration({
    conversationId: input.conversationId,
    customerId: input.customerId,
    customerMessageId: input.customerMessageId,
    channel: input.channel,
    inputType: input.inputType ?? "text",
  });

  if (!started.isNew) {
    return { kind: "duplicate", orchestrationId: started.record.id };
  }

  const orchestrationId = started.record.id;
  try {
    const settings = await getAiOrchestrationSettings();
    const globallyEnabled = settings?.isEnabled !== false;
    const aiEnabled = globallyEnabled && input.aiReplyEnabled;
    if (!aiEnabled || input.handoverStatus !== "none") {
      const source = input.handoverStatus !== "none" ? "human_handover_active" : "ai_disabled";
      const skippedResult = {
        shouldReply: false,
        shouldHandover: false,
        reply: null,
        source,
        detectedIntent: input.handoverStatus !== "none" ? "human_assistance" : "general_inquiry",
      } as ChatAIResult;
      await finalizeAiMessageOrchestration(orchestrationId, {
        status: "skipped",
        primaryOutcome: "no_reply",
        handledBy: input.handoverStatus !== "none" ? "human" : "system",
        detectedIntent: skippedResult.detectedIntent,
        processingTrace: { source, reason: input.handoverStatus !== "none" ? "human_handover_active" : "ai_disabled" },
      });
      return { kind: "skipped", orchestrationId, result: skippedResult };
    }
    const result = await processChatAI(
      {
        text: input.text,
        platform: input.channel,
        customerId: input.customerId ?? undefined,
        conversationId: input.conversationId,
        sourceType: input.sourceType ?? "private_chat",
      },
      {
        aiEnabled,
        handoverStatus: input.handoverStatus,
        logContext: input.logContext,
      },
    );

    if (result.shouldHandover) {
      await createHandoverRequest({
        conversationId: input.conversationId,
        customerId: input.customerId,
        customerName: input.customerName || "客户",
        platform: input.channel,
        platformId: input.platformId,
        reason: result.handoverReason || "AI 无法匹配客户消息",
        priority: result.handoverSummary?.priority || "medium",
        aiSummary: result.handoverSummary ? JSON.stringify(result.handoverSummary) : undefined,
      });
      await finalizeAiMessageOrchestration(orchestrationId, {
        status: "handover",
        primaryOutcome: "handover",
        handledBy: "ai",
        detectedIntent: result.detectedIntent ?? null,
        processingTrace: { source: result.source, reason: result.handoverReason ?? null },
      });
      return { kind: "handover", orchestrationId, result };
    }

    if (!result.shouldReply || !result.reply) {
      await finalizeAiMessageOrchestration(orchestrationId, {
        status: "skipped",
        primaryOutcome: "no_reply",
        handledBy: "system",
        detectedIntent: result.detectedIntent ?? null,
        processingTrace: { source: result.source },
      });
      return { kind: "skipped", orchestrationId, result };
    }

    if (result.source === "product_ai" || result.source === "product") {
      await createAiSalesRecord({
        conversationId: input.conversationId,
        customerId: input.customerId,
        sourceMessageId: input.customerMessageId,
        channel: input.channel,
        customerRequest: input.text,
        recommendationType: "product",
        recommendedProductIds: result.productAiRecommendations ?? (result.productId ? [result.productId] : []),
        recommendationReason: result.source === "product_ai" ? "AI 根据客户需求推荐商品" : "客户讯息命中商品关键词",
        outcome: "recommended",
      });
    }

    return { kind: "reply", orchestrationId, result };
  } catch (error) {
    await finalizeAiMessageOrchestration(orchestrationId, {
      status: "failed",
      primaryOutcome: "no_reply",
      handledBy: "system",
      errorCode: "orchestration_error",
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    });
    throw error;
  }
}

/** Call this only after a channel adapter has persisted the AI reply message. */
export async function completeUnifiedReply(
  orchestrationId: number,
  data: { replyMessageId: number | null; delivered: boolean; source: string; errorMessage?: string },
) {
  await finalizeAiMessageOrchestration(orchestrationId, {
    status: data.delivered ? "completed" : "failed",
    primaryOutcome: "reply",
    handledBy: "ai",
    replyMessageId: data.replyMessageId,
    processingTrace: { source: data.source, delivered: data.delivered },
    errorCode: data.delivered ? null : "channel_send_error",
    errorMessage: data.delivered ? null : (data.errorMessage ?? "Channel delivery failed"),
  });
}

export function detectUnifiedInputType(attachments?: Array<{ type?: string }>): UnifiedInputType {
  const type = attachments?.[0]?.type;
  if (type === "audio") return "audio";
  if (type === "image") return "image";
  if (type === "video") return "video";
  if (type) return "file";
  return "text";
}
