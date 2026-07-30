import {
  addDeliveryAttempt,
  getAiLogDetail,
  getChatConversationById,
  updateAiLogAfterSend,
  updateChatMessageDelivery,
  updateDeliveryAttempt,
} from "./db";
import { sendTextMessage } from "./messenger";
import type { ProcessingStep } from "./aiLogContext";

export interface AiLogRetryResult {
  aiLogId: number;
  attemptNumber: number;
  retryCount: number;
  sendStatus: "sent" | "failed";
  platformMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

function describeSendError(error: any): { errorCode: string; errorMessage: string } {
  const errorCode = String(error?.response?.status ?? error?.code ?? error?.statusCode ?? "send_error");
  const errorMessage = String(
    error?.response?.data?.error?.message ?? error?.message ?? error,
  ).slice(0, 500);
  return { errorCode, errorMessage };
}

/**
 * Retry a failed Messenger delivery without creating a second AI processing log.
 * This function is intentionally limited to private Messenger chats, because Flow
 * comments and other event sources have different delivery semantics.
 */
export async function retryFailedAiLogDelivery(aiLogId: number): Promise<AiLogRetryResult> {
  const log = await getAiLogDetail(aiLogId);
  if (!log) throw new Error("AI日志不存在");
  if (log.sendStatus !== "failed") throw new Error("只有发送失败的AI日志可以重试");
  if (log.sourceType !== "private_chat" || log.platform !== "messenger" || !log.conversationId) {
    throw new Error("当前仅支持重试关联 Messenger 私聊的AI日志");
  }
  if (!log.aiReply) throw new Error("该AI日志没有可重发的回复内容");

  const conversation = await getChatConversationById(log.conversationId);
  if (!conversation?.platformId) throw new Error("未找到对应客户的 Messenger 收件人标识");

  const previousAttempts = Array.isArray(log.deliveryAttempts) ? log.deliveryAttempts : [];
  const attemptNumber = previousAttempts.reduce(
    (max: number, item: any) => Math.max(max, Number(item?.attemptNumber) || 0),
    0,
  ) + 1;
  const retryCount = (Number(log.retryCount) || 0) + 1;
  const retryStartedAt = new Date();
  const attemptId = await addDeliveryAttempt(aiLogId, attemptNumber, "pending");

  let sendStatus: "sent" | "failed" = "failed";
  let platformMessageId: string | undefined;
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  try {
    const result = await sendTextMessage(conversation.platformId, log.aiReply);
    sendStatus = "sent";
    platformMessageId = result?.message_id;
  } catch (error: any) {
    ({ errorCode, errorMessage } = describeSendError(error));
  }

  if (attemptId) {
    await updateDeliveryAttempt(attemptId, {
      sendStatus,
      platformMessageId,
      errorCode,
      errorMessage,
    });
  }

  const retryStep: ProcessingStep = {
    step: "delivery_retry",
    label: "重试发送AI回复",
    detail: sendStatus === "sent"
      ? `第 ${attemptNumber} 次发送成功（平台消息 ID：${platformMessageId ?? "未返回"}）`
      : `第 ${attemptNumber} 次发送失败：${errorMessage ?? errorCode ?? "未知错误"}`,
    result: sendStatus,
    ts: new Date().toISOString(),
    durationMs: Date.now() - retryStartedAt.getTime(),
  };

  await updateAiLogAfterSend(aiLogId, {
    sendStatus,
    platformMessageId: platformMessageId ?? null,
    errorCode: sendStatus === "sent" ? null : errorCode,
    errorStage: sendStatus === "sent" ? null : "messenger_send",
    errorMessage: sendStatus === "sent" ? null : errorMessage,
    retryCount,
    lastRetryAt: retryStartedAt,
    processingSteps: [...(Array.isArray(log.processingSteps) ? log.processingSteps : []), retryStep],
  });

  if (log.aiReplyMessageId) {
    await updateChatMessageDelivery(log.aiReplyMessageId, {
      status: sendStatus,
      platformMessageId: platformMessageId ?? null,
      errorMessage: sendStatus === "sent" ? null : errorMessage ?? null,
    });
  }

  return {
    aiLogId,
    attemptNumber,
    retryCount,
    sendStatus,
    platformMessageId,
    errorCode,
    errorMessage,
  };
}
