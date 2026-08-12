import { transcribeAudio } from "./_core/voiceTranscription";
import {
  createAiPendingAction,
  createAiVoiceTranscript,
  getAiOrchestrationSettings,
  updateAiVoiceTranscript,
} from "./db";
import { orchestrateInboundText, type UnifiedTextOutcome } from "./unifiedAiOrchestrator";

export type VoiceProcessingOutcome =
  | { kind: "disabled" | "needs_review" | "confirmation"; transcriptId: number; customerMessage: string }
  | { kind: "ai"; transcriptId: number; transcript: string; orchestration: UnifiedTextOutcome };

function makeConfirmationMessage(transcript: string): string {
  const excerpt = transcript.length > 180 ? `${transcript.slice(0, 177)}…` : transcript;
  return `我听到您说：「${excerpt}」\n\n为避免商品、数量或配送资料有误，请您用文字回复「确认」或直接写商品关键词＋数量。确认前，系统不会建立或修改订单。`;
}

function isPotentialOrderInstruction(transcript: string) {
  return /(下单|加单|购买|订购|帮我拿|帮我留|我要|我想要|买|order\b|nak\b|mau\b|ambil\b)/i.test(transcript);
}

function deriveConfidence(result: any): number | null {
  const segments = Array.isArray(result?.segments) ? result.segments : [];
  const values = segments
    .map((segment: any) => Number(segment?.avg_logprob))
    .filter((value: number) => Number.isFinite(value))
    .map((value: number) => Math.max(0, Math.min(1, Math.exp(value))));
  if (values.length === 0) return null;
  return values.reduce((total: number, value: number) => total + value, 0) / values.length;
}

/**
 * Processes a stored customer audio message without ever executing an order from voice alone.
 * Normal voice enquiries can be sent to the same unified AI gateway as text; purchase or change
 * instructions become an auditable pending confirmation instead.
 */
export async function processCustomerVoice(input: {
  conversationId: number;
  customerId: number | null;
  customerMessageId: number;
  customerName: string;
  channel: "messenger" | "whatsapp";
  platformId: string;
  mediaUrl: string;
  aiReplyEnabled: boolean;
  handoverStatus: "none" | "pending" | "claimed";
}): Promise<VoiceProcessingOutcome> {
  const transcriptRecord = await createAiVoiceTranscript({
    conversationId: input.conversationId,
    customerId: input.customerId,
    chatMessageId: input.customerMessageId,
    mediaUrl: input.mediaUrl,
  });
  if (!transcriptRecord) throw new Error("Unable to create voice transcript record");

  const settings = await getAiOrchestrationSettings();
  if (settings?.voiceTranscriptionEnabled === false) {
    await updateAiVoiceTranscript(transcriptRecord.id, {
      status: "needs_review",
      warning: "语音转写已由管理员暂停，等待人工处理",
    });
    return { kind: "disabled", transcriptId: transcriptRecord.id, customerMessage: "已收到您的语音，客服会尽快为您处理。" };
  }

  try {
    const result: any = await transcribeAudio({
      audioUrl: input.mediaUrl,
      prompt: "马来西亚华人园艺商城客服语音。可能混用中文、English 和 Bahasa Melayu；请忠实转写商品关键词、数量、地址和配送方式。",
    });
    const transcript = String(result?.text || "").trim();
    const confidence = deriveConfidence(result);
    const confidenceFloor = Number(settings?.requireVoiceReviewBelow ?? "0.65");
    const shouldReview = transcript.length < 2 || (confidence !== null && confidence < confidenceFloor);

    if (shouldReview) {
      await updateAiVoiceTranscript(transcriptRecord.id, {
        status: "needs_review",
        transcript: transcript || null,
        detectedLanguage: result?.language ?? null,
        confidence: confidence === null ? null : confidence.toFixed(2),
        warning: transcript.length < 2 ? "无法可靠辨识语音内容" : "语音辨识可信度低于管理员设定阈值",
        transcribedAt: new Date(),
      });
      return { kind: "needs_review", transcriptId: transcriptRecord.id, customerMessage: "抱歉，我未能清楚听懂这段语音。请您用文字再发送一次，或稍后由客服协助您。" };
    }

    if (isPotentialOrderInstruction(transcript)) {
      const confirmationReply = makeConfirmationMessage(transcript);
      const action = await createAiPendingAction({
        conversationId: input.conversationId,
        customerId: input.customerId,
        sourceMessageId: input.customerMessageId,
        actionType: "add_to_order",
        payload: { source: "voice", transcript, transcriptId: transcriptRecord.id },
        confirmationReply,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      await updateAiVoiceTranscript(transcriptRecord.id, {
        status: "transcribed",
        transcript,
        detectedLanguage: result?.language ?? null,
        confidence: confidence === null ? null : confidence.toFixed(2),
        aiActionSummary: "已建立待文字确认的订单操作；未修改订单或库存",
        transcribedAt: new Date(),
      });
      return { kind: "confirmation", transcriptId: transcriptRecord.id, customerMessage: action?.confirmationReply ?? confirmationReply };
    }

    await updateAiVoiceTranscript(transcriptRecord.id, {
      status: "transcribed",
      transcript,
      detectedLanguage: result?.language ?? null,
      confidence: confidence === null ? null : confidence.toFixed(2),
      aiActionSummary: "语音转写已交由统一 AI 回复引擎处理",
      transcribedAt: new Date(),
    });
    const orchestration = await orchestrateInboundText({
      ...input,
      text: transcript,
      sourceType: "private_chat",
      inputType: "audio",
    });
    return { kind: "ai", transcriptId: transcriptRecord.id, transcript, orchestration };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "语音转写失败";
    await updateAiVoiceTranscript(transcriptRecord.id, { status: "failed", failureReason: message });
    return { kind: "needs_review", transcriptId: transcriptRecord.id, customerMessage: "语音暂时无法转写，客服会尽快协助您；也欢迎您以文字发送需求。" };
  }
}
