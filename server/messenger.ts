import axios from "axios";
import {
  addChatMessage,
  addDeliveryAttempt,
  claimPublicFlowEvent,
  completePublicFlowEvent,
  createAiLog,
  createHandoverRequest,
  executeAutoOrderCapture,
  getLiveRooms,
  getOrCreateConversation,
  matchLiveAiFlowWithMetadata,
  storeIncomingMessengerMessage,
  updateAiLogAfterSend,
  updateDeliveryAttempt,
} from "./db";
import { AiProcessingContext } from "./aiLogContext";
import { processChatAI } from "./aiEngines";
import { processCustomerVoice } from "./aiVoiceService";
import { completeUnifiedReply, orchestrateInboundText } from "./unifiedAiOrchestrator";

const FB_GRAPH_API = "https://graph.facebook.com/v21.0";

/**
 * Get the Page Access Token from environment
 */
function getPageAccessToken(): string {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("FB_PAGE_ACCESS_TOKEN is not set");
  return token;
}

/**
 * Get the Page ID from environment
 */
function getPageId(): string {
  const id = process.env.FB_PAGE_ID;
  if (!id) throw new Error("FB_PAGE_ID is not set");
  return id;
}

// ============================================================
// Messenger Message Sending API
// ============================================================

/**
 * Send a text message to a user via Messenger
 */
export async function sendTextMessage(psid: string, text: string): Promise<any> {
  const token = getPageAccessToken();
  const response = await axios.post(
    `${FB_GRAPH_API}/me/messages?access_token=${token}`,
    {
      recipient: { id: psid },
      message: { text },
    }
  );
  return response.data;
}

/**
 * Send a message with buttons via Messenger
 */
export async function sendButtonMessage(
  psid: string,
  text: string,
  buttons: Array<{ title: string; url: string; type?: "web_url" }>
): Promise<any> {
  const token = getPageAccessToken();
  const response = await axios.post(
    `${FB_GRAPH_API}/me/messages?access_token=${token}`,
    {
      recipient: { id: psid },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text,
            buttons: buttons.map(b => ({
              type: b.type || "web_url",
              url: b.url,
              title: b.title,
              webview_height_ratio: "full",
            })),
          },
        },
      },
    }
  );
  return response.data;
}

/**
 * Send an image/video via Messenger
 */
export async function sendMediaMessage(
  psid: string,
  mediaType: "image" | "video",
  url: string,
  caption?: string
): Promise<any> {
  const token = getPageAccessToken();
  const payload: any = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: mediaType,
        payload: { url, is_reusable: true },
      },
    },
  };
  if (caption) {
    payload.message.attachment.payload.caption = caption;
  }
  const response = await axios.post(
    `${FB_GRAPH_API}/me/messages?access_token=${token}`,
    payload
  );
  return response.data;
}

/**
 * Send a generic template (card) message
 */
export async function sendTemplateMessage(
  psid: string,
  elements: Array<{
    title: string;
    subtitle?: string;
    image_url?: string;
    buttons?: Array<{ title: string; url: string }>;
  }>
): Promise<any> {
  const token = getPageAccessToken();
  const response = await axios.post(
    `${FB_GRAPH_API}/me/messages?access_token=${token}`,
    {
      recipient: { id: psid },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: elements.map(el => ({
              title: el.title,
              subtitle: el.subtitle,
              image_url: el.image_url,
              buttons: (el.buttons || []).map(b => ({
                type: "web_url",
                url: b.url,
                title: b.title,
                webview_height_ratio: "full",
              })),
            })),
          },
        },
      },
    }
  );
  return response.data;
}

/**
 * Send the membership onboarding Flow to a customer.
 * This is triggered ONLY after admin confirms membership fee payment.
 *
 * @param psid - Page-scoped ID of the customer
 * @param flowSteps - Array of flow steps to send
 */
export async function sendMembershipFlow(
  psid: string,
  flowSteps: Array<{
    type: "text" | "image" | "video" | "button" | "contact";
    content: string;
    mediaUrl?: string;
    buttonText?: string;
    buttonUrl?: string;
    delayMs?: number;
  }>
): Promise<Array<{ stepIndex: number; success: boolean; messageId?: string; error?: string }>> {
  const results: Array<{ stepIndex: number; success: boolean; messageId?: string; error?: string }> = [];

  for (let i = 0; i < flowSteps.length; i++) {
    const step = flowSteps[i];

    // Apply delay if specified
    if (step.delayMs && step.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, step.delayMs));
    }

    try {
      let response;
      switch (step.type) {
        case "text":
          response = await sendTextMessage(psid, step.content);
          break;
        case "image":
          response = await sendMediaMessage(psid, "image", step.mediaUrl || "", step.content);
          break;
        case "video":
          response = await sendMediaMessage(psid, "video", step.mediaUrl || "", step.content);
          break;
        case "button":
          response = await sendButtonMessage(psid, step.content, [
            { title: step.buttonText || "点击这里", url: step.buttonUrl || "" },
          ]);
          break;
        case "contact":
          response = await sendButtonMessage(psid, step.content, [
            { title: "联系客服", url: step.buttonUrl || `https://m.me/${getPageId()}` },
          ]);
          break;
        default:
          response = await sendTextMessage(psid, step.content);
      }
      results.push({ stepIndex: i, success: true, messageId: response?.message_id });
    } catch (error: any) {
      console.error(`[Messenger] Flow step ${i} failed:`, error?.response?.data || error?.message);
      results.push({
        stepIndex: i,
        success: false,
        error: error?.response?.data?.error?.message || error?.message || "Unknown error",
      });
    }
  }

  return results;
}

// ============================================================
// Webhook Event Handlers
// ============================================================

/**
 * Handle incoming Messenger events (messages, postbacks, etc.)
 */
export async function handleMessengerEvent(event: any): Promise<void> {
  const senderPsid = event.sender?.id;
  const recipientId = event.recipient?.id;
  const pageId = getPageId();

  // Verify this event is for our page
  if (recipientId !== pageId) return;

  console.log("[Messenger] Received event from PSID:", senderPsid);

  // Handle message
  if (event.message) {
    await handleIncomingMessage(senderPsid, event.message);
  }

  // Handle postback (button click)
  if (event.postback) {
    await handlePostback(senderPsid, event.postback);
  }

  // Handle delivery confirmation
  if (event.delivery) {
    console.log("[Messenger] Message delivered to PSID:", senderPsid);
  }

  // Handle read confirmation
  if (event.read) {
    console.log("[Messenger] Message read by PSID:", senderPsid);
  }
}

/**
 * Handle incoming text/media messages from customers
 */
async function handleIncomingMessage(psid: string, message: any): Promise<void> {
  const text = message.text;
  const attachments = message.attachments;

  console.log("[Messenger] Message from PSID:", psid, "Text:", text);

  // Store incoming message in chat system
  let conversation: any = null;
  let storeResult: Awaited<ReturnType<typeof storeIncomingMessengerMessage>> | null = null;
  try {
    storeResult = await storeIncomingMessengerMessage(psid, text, attachments);
    // Get conversation to check AI status
    conversation = await getOrCreateConversation(null, "messenger", psid);
  } catch (err) {
    console.error("[Messenger] Failed to store chat message:", err);
  }

  // === Unified Auto Order Engine: check for keyword+quantity pattern first ===
  // If the message matches keyword patterns (e.g. "MON+2", "J5+1"), execute auto order capture
  // before any AI reply logic. This ensures Messenger private chat uses the same Auto Order Engine
  // as Facebook Live comments.
  if (text) {
    try {
      // V2.1.02: Look up active live rooms to determine if this is an import preorder
      let liveRoomId: number | undefined;
      let liveType: string | undefined;
      try {
        const allRooms = await getLiveRooms({});
        const now = new Date();
        const activeRoom = (allRooms || []).find((r: any) => {
          if (r.status === 'closed' || r.status === 'ended') return false;
          if (r.liveType === 'import_preorder' && r.preorderEndDate) {
            return new Date(r.preorderEndDate) > now;
          }
          return r.status === 'live' || r.status === 'preparing';
        });
        if (activeRoom) {
          liveRoomId = activeRoom.id;
          liveType = activeRoom.liveType;
        }
      } catch (liveErr: any) {
        console.log("[Messenger] Live room lookup failed:", liveErr?.message);
      }
      const orderResult = await executeAutoOrderCapture({
        customerName: storeResult?.customerName || psid,
        customerPsid: psid,
        message: text,
        liveRoomId,
        liveType,
        sourceType: "messenger",
        sourceName: "Messenger 私聊",
      });

      if (orderResult.matched && orderResult.success) {
        // Keyword matched and order created/merged — send winning notification via Messenger
        console.log("[Messenger] Auto order captured:", orderResult.orderNumber, "for PSID:", psid);

        // Send the winning notification message
        await sendTextMessage(psid, orderResult.replyMessage || `🎉 得标通知！\n订单号：${orderResult.orderNumber}\n小计：RM${orderResult.totalAmount}\n\n请点击下方按钮查看订单详情。`);

        // Send the "查询订单及结账" button
        if (orderResult.secureToken && orderResult.orderNumber) {
          const checkoutUrl = `${process.env.VITE_PUBLIC_URL || 'https://www.xintian.com.my'}/order/${orderResult.orderNumber}/${orderResult.secureToken}`;
          await sendButtonMessage(psid, "查询订单及结账", [
            { title: "查询订单及结账", url: checkoutUrl },
          ]);
        }

        // Store the auto-reply in chat system
        if (conversation?.id) {
          try {
            await addChatMessage({
              conversationId: conversation.id,
              senderType: "ai",
              senderName: "自动捉单",
              messageType: "text",
              content: orderResult.replyMessage || `得标通知 - 订单号：${orderResult.orderNumber}`,
              status: "sent",
              aiResponseSource: "auto_order_engine",
            });
          } catch (err) {
            console.error("[Messenger] Failed to store auto order reply:", err);
          }
        }
        return; // Order captured — skip AI reply
      }

      // If keyword was detected but no product matched, still skip AI and send the unmatched reply
      if (!orderResult.matched && orderResult.replyMessage && orderResult.unmatchedKeywords && orderResult.unmatchedKeywords.length > 0) {
        console.log("[Messenger] Keywords unmatched:", orderResult.unmatchedKeywords, "for PSID:", psid);
        await sendTextMessage(psid, orderResult.replyMessage);
        return;
      }
    } catch (orderErr) {
      console.error("[Messenger] Auto Order Engine error:", orderErr);
      // Continue to AI reply on error
    }
  }

  // Check if AI reply is enabled for this conversation
  const aiEnabled = conversation?.aiReplyEnabled !== false;
  const handoverStatus = conversation?.handoverStatus || "none";

  const audioAttachment = storeResult?.attachmentMessages?.find((attachment) => attachment.type === "audio" && attachment.mediaUrl);
  if (!text && conversation?.id && audioAttachment?.mediaUrl) {
    try {
      const voiceOutcome = await processCustomerVoice({
        conversationId: conversation.id,
        customerId: storeResult?.customerId ?? null,
        customerMessageId: audioAttachment.messageId,
        customerName: storeResult?.customerName || "客户",
        channel: "messenger",
        platformId: psid,
        mediaUrl: audioAttachment.mediaUrl,
        aiReplyEnabled: aiEnabled,
        handoverStatus,
      });

      if (voiceOutcome.kind === "ai") {
        const outcome = voiceOutcome.orchestration;
        if (outcome.kind === "reply" && outcome.result.reply) {
          let delivered = false;
          let errorMessage: string | undefined;
          try {
            await sendTextMessage(psid, outcome.result.reply);
            delivered = true;
          } catch (error: any) {
            errorMessage = (error?.message ?? String(error)).slice(0, 500);
          }
          const storedReply = await addChatMessage({
            conversationId: conversation.id,
            senderType: "ai",
            senderName: "AI客服（语音）",
            messageType: "text",
            content: outcome.result.reply,
            status: delivered ? "sent" : "failed",
            aiResponseSource: outcome.result.source,
          });
          await completeUnifiedReply(outcome.orchestrationId, {
            replyMessageId: storedReply?.messageId ?? null,
            delivered,
            source: outcome.result.source,
            errorMessage,
          });
        }
        return;
      }

      if (voiceOutcome.kind === "needs_review") {
        await createHandoverRequest({
          conversationId: conversation.id,
          customerId: storeResult?.customerId ?? null,
          customerName: storeResult?.customerName || "客户",
          platform: "messenger",
          platformId: psid,
          reason: "客户语音无法可靠辨识，需人工协助",
          priority: "medium",
        });
      }

      await sendTextMessage(psid, voiceOutcome.customerMessage);
      await addChatMessage({
        conversationId: conversation.id,
        senderType: "ai",
        senderName: voiceOutcome.kind === "confirmation" ? "AI客服（待确认）" : "AI客服（语音）",
        messageType: "text",
        content: voiceOutcome.customerMessage,
        status: "sent",
        aiResponseSource: voiceOutcome.kind === "confirmation" ? "voice_confirmation" : "voice_review",
      });
      return;
    } catch (error) {
      console.error("[Messenger] Voice processing failed:", error);
    }
  }

  if (text && conversation?.id && storeResult?.customerMessageId) {
    // Create AiProcessingContext for logging
    const logCtx = new AiProcessingContext(
      conversation?.id ?? null,
      storeResult?.customerId ?? null,
      storeResult?.customerName ?? null,
      "messenger",
      storeResult?.customerMessageId ?? null,
      text,
      true,
      handoverStatus,
    );

    // The unified orchestrator is the single arbitration point for AI, Flow and human handover.
    // It decides whether there is a reply, a handover or no action. This channel adapter only delivers.
    try {
      const outcome = await orchestrateInboundText({
        conversationId: conversation.id,
        customerId: storeResult.customerId,
        customerMessageId: storeResult.customerMessageId,
        customerName: storeResult.customerName || "客户",
        channel: "messenger",
        platformId: psid,
        text,
        aiReplyEnabled: aiEnabled,
        handoverStatus,
        sourceType: "private_chat",
        logContext: logCtx,
      });

      if (outcome.kind === "duplicate") {
        console.log("[Messenger] Duplicate message orchestration skipped:", storeResult.customerMessageId);
        return;
      }

      const result = outcome.result;

      if (outcome.kind === "handover") {
        logCtx.sendStatus = "not_sent";
        if (result.detectedIntent) (logCtx as any).detectedIntent = result.detectedIntent;
        if (result.handoverSummary) (logCtx as any).handoverSummary = result.handoverSummary;
        await createAiLog(logCtx.finalize());
        return;
      }

      if (outcome.kind === "skipped") {
        logCtx.sendStatus = "not_sent";
        logCtx.addStep("orchestration", "统一回复仲裁", "已跳过自动回复（人工接管、全局停用或规则无需回复）", "skipped");
        await createAiLog(logCtx.finalize());
        return;
      }

      if (result.shouldReply && result.reply) {
        // Create the primary log and the first delivery attempt before sending.
        // All logging helpers fail closed, so an audit write failure never blocks the reply.
        logCtx.sendStatus = "pending";
        logCtx.addStep("delivery", "发送AI回复", "已建立发送尝试，等待 Messenger 平台确认", "pending");
        const aiLogId = await createAiLog(logCtx.finalize());
        const deliveryAttemptId = aiLogId
          ? await addDeliveryAttempt(aiLogId, 1, "pending")
          : null;

        // Send AI reply via Messenger API.
        let sendOk = false;
        let platformMsgId: string | undefined;
        let errorCode: string | undefined;
        let errorMessage: string | undefined;
        try {
          const sendResult = await sendTextMessage(psid, result.reply);
          sendOk = true;
          platformMsgId = sendResult?.message_id;
        } catch (sendErr: any) {
          errorCode = String(sendErr?.code ?? sendErr?.statusCode ?? "send_error");
          errorMessage = (sendErr?.message ?? String(sendErr)).slice(0, 500);
          console.error("[Messenger] Failed to send AI reply:", sendErr);
        }

        // Update the same first attempt with the actual platform result.
        if (deliveryAttemptId) {
          await updateDeliveryAttempt(deliveryAttemptId, {
            sendStatus: sendOk ? "sent" : "failed",
            platformMessageId: platformMsgId,
            errorCode,
            errorMessage,
          });
        }

        // Store AI reply in chat system.
        let aiReplyMessageId: number | null = null;
        try {
          const aiMsgResult = await addChatMessage({
            conversationId: conversation.id,
            senderType: "ai",
            senderName: "AI客服",
            messageType: "text",
            content: result.reply,
            status: sendOk ? "sent" : "failed",
            aiResponseSource: result.source,
          });
          aiReplyMessageId = aiMsgResult?.messageId ?? null;
        } catch (err) {
          console.error("[Messenger] Failed to store AI reply:", err);
        }

        // Persist the final audit state, including the exact end-to-end duration.
        logCtx.sendStatus = sendOk ? "sent" : "failed";
        logCtx.platformMessageId = platformMsgId;
        logCtx.aiReplyMessageId = aiReplyMessageId ?? undefined;
        logCtx.errorCode = errorCode;
        logCtx.errorStage = sendOk ? undefined : "messenger_send";
        logCtx.errorMessage = errorMessage;
        logCtx.addStep(
          "delivery",
          "发送AI回复",
          sendOk ? `Messenger 已确认（平台消息 ID：${platformMsgId ?? "未返回"}）` : `发送失败：${errorMessage ?? errorCode ?? "未知错误"}`,
          sendOk ? "sent" : "failed",
        );
        if (aiLogId) {
          const finalLog = logCtx.finalize();
          await updateAiLogAfterSend(aiLogId, {
            sendStatus: finalLog.sendStatus,
            platformMessageId: finalLog.platformMessageId,
            aiReplyMessageId: finalLog.aiReplyMessageId ?? undefined,
            errorCode: finalLog.errorCode,
            errorStage: finalLog.errorStage,
            errorMessage: finalLog.errorMessage,
            processingTimeMs: finalLog.processingTimeMs,
            processingSteps: finalLog.processingSteps,
          });
        }
        await completeUnifiedReply(outcome.orchestrationId, {
          replyMessageId: aiReplyMessageId,
          delivered: sendOk,
          source: result.source,
          errorMessage,
        });
        return;
      }

      if (result.shouldHandover) {
        // AI could not match or mandatory handover — create handover request for human staff
        console.log("[Messenger] AI handover triggered for PSID:", psid, "Reason:", result.handoverReason, "Intent:", result.detectedIntent);
        const handoverPriority = result.handoverSummary?.priority || "medium";
        try {
          await createHandoverRequest({
            conversationId: conversation.id,
            customerId: conversation.customerId,
            customerName: conversation.customerName ?? storeResult?.customerName ?? "客户",
            platform: "messenger",
            platformId: psid,
            reason: result.handoverReason || "AI无法匹配客户消息",
            priority: handoverPriority,
            aiSummary: result.handoverSummary ? JSON.stringify(result.handoverSummary) : undefined,
          });
        } catch (err) {
          console.error("[Messenger] Failed to create handover request:", err);
        }
        // Create AI log for handover (include detectedIntent and handoverSummary)
        try {
          logCtx.sendStatus = "not_sent";
          if (result.detectedIntent) (logCtx as any).detectedIntent = result.detectedIntent;
          if (result.handoverSummary) (logCtx as any).handoverSummary = result.handoverSummary;
          await createAiLog(logCtx.finalize());
        } catch (err) {
          console.error("[Messenger] Failed to create handover AI log:", err);
        }
        return;
      }
    } catch (err) {
      console.error("[Messenger] AI engine error:", err);
      // Create error AI log
      try {
        logCtx.finalSource = "error";
        logCtx.sendStatus = "failed";
        logCtx.errorCode = "engine_error";
        logCtx.errorStage = "process_chat_ai";
        logCtx.errorMessage = (err as any)?.message?.slice(0, 500) ?? String(err);
        await createAiLog(logCtx.finalize());
      } catch { /* ignore log error */ }
    }
  } else if (text && !aiEnabled) {
    console.log("[Messenger] AI reply disabled for PSID:", psid, "— skipping auto-reply");
    // Create AI log for disabled AI
    try {
      const logCtx = new AiProcessingContext(
        conversation?.id ?? null,
        storeResult?.customerId ?? null,
        storeResult?.customerName ?? null,
        "messenger",
        storeResult?.customerMessageId ?? null,
        text,
        false,
        handoverStatus,
      );
      logCtx.addStep("ai_disabled", "AI已关闭", "AI未开启，不自动回复", "skipped");
      logCtx.finalSource = "ai_disabled";
      logCtx.sendStatus = "not_sent";
      await createAiLog(logCtx.finalize());
    } catch { /* ignore log error */ }
  } else if (text && handoverStatus === "claimed") {
    // Human has claimed — create AI log
    try {
      const logCtx = new AiProcessingContext(
        conversation?.id ?? null,
        storeResult?.customerId ?? null,
        storeResult?.customerName ?? null,
        "messenger",
        storeResult?.customerMessageId ?? null,
        text,
        true,
        handoverStatus,
      );
      logCtx.addStep("human_check", "人工接手检查", "已被人工接手，AI不回复", "skipped");
      logCtx.finalSource = "human_claimed";
      logCtx.sendStatus = "not_sent";
      await createAiLog(logCtx.finalize());
    } catch { /* ignore log error */ }
  }

  if (attachments) {
    for (const attachment of attachments) {
      if (attachment.type === "image") {
        // Could be a payment receipt
        console.log("[Messenger] Image attachment from PSID:", psid);
        await sendTextMessage(
          psid,
          "已收到您的图片。如果是汇款单据，请告知订单编号，我们会尽快为您确认。"
        );
      }
    }
  }
}

/**
 * Handle postback events (button clicks)
 */
async function handlePostback(psid: string, postback: any): Promise<void> {
  const payload = postback.payload;
  console.log("[Messenger] Postback from PSID:", psid, "Payload:", payload);

  if (payload === "GET_STARTED") {
    await sendTextMessage(
      psid,
      "欢迎来到心田 🌿 我们提供各类植物、肥料和盆器。有什么可以帮到您的吗？"
    );
  } else if (payload === "MEMBER_INFO") {
    await sendTextMessage(
      psid,
      "心田会员可享受专属福利和优先服务。如有兴趣加入会员，请联系我们了解更多详情。"
    );
  }
}

function inferCommentSourceType(value: any): "facebook_live" | "facebook_post" | "facebook_reel" {
  if (value?.reel_id || value?.media_product_type === "REELS" || value?.media_type === "REELS") {
    return "facebook_reel";
  }
  if (value?.live_video_id || value?.video_id || value?.live_video?.id) {
    return "facebook_live";
  }
  return "facebook_post";
}

/**
 * Handle Page feed events (comments, posts)
 */
export async function handlePageFeedEvent(change: any, pageId: string): Promise<void> {
  const field = change.field;
  const value = change.value;

  console.log("[Facebook] Page feed event:", field);

  if (field === "feed") {
    // feed field covers posts, comments, shares, likes, reactions, etc.
    // When item === "comment", the payload contains a comment event — process it as a comment
    const item = value?.item;
    const postId = value?.post_id;
    const message = value?.message;

    if (item === "comment") {
      // Comment event delivered via feed field
      // Normalize fields: feed payload uses slightly different field names than the legacy comments field
      const commentId = value?.comment_id;
      const commenterName = value?.from?.name;
      const commenterPsid = value?.from?.id;
      const commentMessage = value?.message;
      console.log("[Facebook] New comment (via feed):", commenterName, ":", commentMessage, "on post:", postId);
      await processComment({
        commentId,
        commenterName,
        commenterPsid,
        commentMessage,
        postId,
        sourceType: inferCommentSourceType(value),
      });
    } else {
      // Other feed events (posts, shares, likes, etc.)
      console.log("[Facebook] Feed event item:", item, "post:", postId, "message:", message);
    }
  }

  if (field === "comments") {
    // Legacy comments field (may still be delivered for some apps)
    const commentId = value?.comment_id;
    const commenterName = value?.from?.name;
    const commenterPsid = value?.from?.id; // Facebook sender ID
    const commentMessage = value?.message;
    const postId = value?.post_id;

    console.log("[Facebook] New comment (via comments field):", commenterName, ":", commentMessage, "on post:", postId);

    // Auto-reply to comments + keyword matching for live order capture
    if (commentMessage) {
      await processComment({
        commentId,
        commenterName,
        commenterPsid,
        commentMessage,
        postId,
        sourceType: inferCommentSourceType(value),
      });
    }
  }
  if (field === "live_videos") {
    // Live video status change
    const status = value?.status;
    const liveVideoId = value?.id;
    console.log("[Facebook] Live video event:", liveVideoId, "status:", status);
    
    // Auto-end live room when Facebook Live ends
    if (status === 'ended' || status === 'stopped') {
      try {
        const { getLiveRooms, updateLiveRoom, getLiveRoomOrders } = require("./db");
        const allRooms = await getLiveRooms({ status: 'live' });
        const matchingRoom = (allRooms || []).find((r: any) => 
          r.facebookVideoId === String(liveVideoId) || 
          (r.facebookLiveUrl && r.facebookLiveUrl.includes(String(liveVideoId)))
        );
        if (matchingRoom) {
          // Set status to ended
          await updateLiveRoom(matchingRoom.id, { status: 'ended' } as any);
          console.log(`[Facebook] Auto-ended live room ${matchingRoom.id} (${matchingRoom.name})`);
          
          // Send settlement notifications to all customers with orders
          try {
            const orders = await getLiveRoomOrders(matchingRoom.id, 200);
            const customerSet = new Set<number>();
            for (const order of orders) {
              if (order.customerId && !customerSet.has(order.customerId)) {
                customerSet.add(order.customerId);
                // Send settlement notification via Messenger
                try {
                  const { sendTextMessage } = require("./messenger");
                  const msg = `直播已结束！\n\n您的订单 ${order.orderNumber} 已整理完毕。\n总额: RM ${order.totalAmount}\n\n请尽快完成付款哦~\n如需加单，欢迎到我们的商城继续选购！`;
                  // Try to get customer's PSID for Messenger
                  if (order.facebookId) {
                    await sendTextMessage(order.facebookId, msg).catch(() => {});
                  }
                } catch (e) {
                  console.log("[Facebook] Settlement notification failed:", (e as any)?.message);
                }
              }
            }
            console.log(`[Facebook] Sent settlement notifications to ${customerSet.size} customers`);
          } catch (settleErr) {
            console.log("[Facebook] Settlement notification error:", (settleErr as any)?.message);
          }
        }
      } catch (endErr) {
        console.log("[Facebook] Auto-end live room failed:", (endErr as any)?.message);
      }
    }
  }
}

/**
 * Process a comment event — shared by feed (item=comment) and legacy comments field.
 * Handles AI Flow matching, keyword capture for live orders, and generic auto-replies.
 */
async function processComment(params: {
  commentId: string;
  commenterName: string;
  commenterPsid: string;
  commentMessage: string;
  postId: string;
  sourceType: "facebook_live" | "facebook_post" | "facebook_reel";
}): Promise<void> {
  const { commentId, commenterName, commenterPsid, commentMessage, postId, sourceType } = params;
  const lowerMsg = commentMessage.toLowerCase();
  let campaign: any = null;

  // A Facebook comment can be redelivered through more than one webhook field.
  // Claim it before any Flow or order logic so one platform event can create at
  // most one customer-facing reply and one live-order capture.
  let publicEventClaim: { id: number } | null = null;
  let publicEventResult: {
    outcome: "flow" | "live_order" | "no_reply" | "failed";
    handledBy: "flow" | "live_order" | "system";
    liveRoomId?: number | null;
    responseSummary?: string | null;
    errorMessage?: string | null;
  } = {
    outcome: "no_reply",
    handledBy: "system",
    responseSummary: "评论未命中可执行 Flow 或直播捉单关键词",
  };
  try {
    const claimResult = await claimPublicFlowEvent({
      platform: "facebook",
      eventType: sourceType === "facebook_live" ? "live_comment" : "comment",
      sourceEventId: commentId,
    });
    if (!claimResult.isNew) {
      console.log("[Facebook] Duplicate public comment event skipped:", commentId);
      return;
    }
    publicEventClaim = claimResult.claim;
  } catch (claimError: any) {
    // Fail closed. It is safer to defer a reply than to risk a duplicate order
    // or duplicate Flow response when the single-event guard is unavailable.
    console.error("[Facebook] Unable to claim public comment event:", claimError?.message);
    return;
  }

  try {

  // Flow comments intentionally use no chat conversation. Their platform event and matched
  // Flow ID are persisted directly so audit records never create a fake private chat.
  try {
    const flowMatch = await matchLiveAiFlowWithMetadata(commentMessage);
    if (flowMatch) {
      const startedAt = Date.now();
      const receivedAt = new Date();
      const processingSteps = [
        {
          step: "receive",
          label: "收到 Facebook 评论",
          detail: `来源：${sourceType}`,
          result: "passed",
          ts: receivedAt.toISOString(),
        },
        {
          step: "flow_match",
          label: "Flow Engine 匹配",
          detail: `${flowMatch.matchType === "keyword" ? "关键词" : "语义"}命中：${flowMatch.matchedKeyword}`,
          result: "hit",
          ts: new Date().toISOString(),
          flowId: flowMatch.flowId,
        },
      ];

      let aiLogId: number | null = null;
      try {
        aiLogId = await createAiLog({
          conversationId: null,
          customerId: null,
          customerName: commenterName || null,
          platform: "messenger",
          sourceType,
          sourceEventId: commentId || postId || null,
          sourceBindingId: flowMatch.flowId,
          customerMessageId: null,
          aiReplyMessageId: null,
          customerMessage: commentMessage,
          receivedAt,
          aiEnabled: true,
          handoverStatus: "none",
          processingSteps,
          finalSource: "flow",
          matchedFlowId: flowMatch.flowId,
          aiReply: flowMatch.reply,
          sendStatus: "pending",
          retryCount: 0,
          isHandover: false,
          processingTimeMs: Date.now() - startedAt,
        });
      } catch (logErr) {
        console.error("[AI Log] Failed to start Flow audit record:", logErr);
      }

      let attemptId: number | null = null;
      if (aiLogId) {
        try {
          attemptId = await addDeliveryAttempt(aiLogId, 1, "pending");
        } catch (logErr) {
          console.error("[AI Log] Failed to start Flow delivery attempt:", logErr);
        }
      }

      // AI Flow matched — auto-reply and return (no order capture).
      const replyResult = await replyToComment(commentId, flowMatch.reply);
      publicEventResult = replyResult.success
        ? {
            outcome: "flow",
            handledBy: "flow",
            responseSummary: `Flow #${flowMatch.flowId} 已回复：${flowMatch.matchedKeyword}`,
          }
        : {
            outcome: "failed",
            handledBy: "flow",
            responseSummary: `Flow #${flowMatch.flowId} 回复发送失败`,
            errorMessage: replyResult.errorMessage ?? "Facebook 评论回复发送失败",
          };
      const finalProcessingSteps = [
        ...processingSteps,
        {
          step: "delivery",
          label: "Facebook 评论回复发送",
          detail: replyResult.success ? "发送成功" : `发送失败：${replyResult.errorMessage ?? "未知错误"}`,
          result: replyResult.success ? "sent" : "failed",
          ts: new Date().toISOString(),
        },
      ];

      if (aiLogId) {
        if (attemptId) {
          await updateDeliveryAttempt(attemptId, {
            sendStatus: replyResult.success ? "sent" : "failed",
            platformMessageId: replyResult.platformMessageId,
            errorCode: replyResult.errorCode,
            errorMessage: replyResult.errorMessage,
          });
        }
        await updateAiLogAfterSend(aiLogId, {
          sendStatus: replyResult.success ? "sent" : "failed",
          platformMessageId: replyResult.platformMessageId,
          errorCode: replyResult.errorCode,
          errorStage: replyResult.success ? undefined : "facebook_comment_send",
          errorMessage: replyResult.errorMessage,
          processingTimeMs: Date.now() - startedAt,
          processingSteps: finalProcessingSteps,
        });
      }

      console.log("[Facebook] AI Flow auto-reply completed for comment:", commentMessage);
      return;
    }
  } catch (aiErr: any) {
    console.log("[Facebook] AI Flow matching error:", aiErr?.message);
  }

  // Try keyword matching for live order capture (e.g. "ABS+2", "POT+1")
  try {
    const { parseCommentKeywords, matchKeywordsToProducts, createOrderFromLiveCapture, getLiveRooms, getLiveRoomProducts, recordLiveComment } = require("./db");
    const keywords = parseCommentKeywords(commentMessage);

    if (keywords.length > 0) {
      // Check if any live room is currently active (not closed)
      let activeRoomId: number | null = null;
      let activeRoom: any = null;
      try {
        const allRooms = await getLiveRooms({ status: 'live' });
        const now = new Date();
        const activeRooms = (allRooms || []).filter((r: any) => {
          if (r.status === 'closed') return false;
          if (r.status === 'ended') return false;
          if (r.liveType === 'import_preorder' && r.preorderEndDate) {
            return new Date(r.preorderEndDate) > now;
          }
          return r.status === 'live';
        });
        if (activeRooms.length === 0) {
          // Check if there's an import_preorder room that has expired (deadline passed)
          const allImportRooms = await getLiveRooms({});
          const expiredPreorderRooms = (allImportRooms || []).filter((r: any) =>
            r.liveType === 'import_preorder' &&
            r.preorderEndDate &&
            new Date(r.preorderEndDate) <= now &&
            r.status !== 'closed'
          );
          if (expiredPreorderRooms.length > 0 && keywords.length > 0) {
            // Preorder deadline has passed - reply with closure message
            const replyResult = await replyToComment(commentId,
              `${commenterName} 您好！此代购活动已截止，如有疑问请联系客服，谢谢。`
            );
            publicEventResult = replyResult.success
              ? { outcome: "no_reply", handledBy: "system", responseSummary: "已回复代购活动截止通知" }
              : { outcome: "failed", handledBy: "system", responseSummary: "代购截止通知发送失败", errorMessage: replyResult.errorMessage ?? null };
            return;
          }
          const preparingRooms = await getLiveRooms({ status: 'preparing' });
          const activePreparing = (preparingRooms || []).filter((r: any) => {
            if (r.liveType === 'import_preorder' && r.preorderEndDate) {
              return new Date(r.preorderEndDate) > now;
            }
            return true;
          });
          if (activePreparing.length === 0) {
            console.log("[Facebook] No active live room, skipping capture");
            return;
          }
          activeRoom = activePreparing[0];
          activeRoomId = activePreparing[0].id;
        } else {
          activeRoom = activeRooms[0];
          activeRoomId = activeRooms[0].id;
        }
      } catch (roomCheckErr: any) {
        console.log("[Facebook] Live room check failed, continuing capture:", roomCheckErr?.message);
      }

      // If we have an active live room, try to match only products in that room
      let matched: any[] = [];
      let unmatched: any[] = [];
      if (activeRoomId) {
        try {
          const roomProductGroups = await getLiveRoomProducts(activeRoomId);
          const roomProductMap = new Map();
          for (const group of roomProductGroups) {
            for (const rp of group.variations || [group]) {
              if (rp.status === 'paused') continue;
              if (rp.status === 'sold_out' && !rp.allowPreorder) continue;
              roomProductMap.set(rp.keyword.toUpperCase().replace(/\s+/g, ''), rp);
            }
          }
          for (const kw of keywords) {
            const upperKw = kw.keyword.toUpperCase().replace(/\s+/g, '');
            const roomProduct = roomProductMap.get(upperKw);
            if (roomProduct) {
              if (roomProduct.availableStock <= 0 && !roomProduct.allowPreorder) {
                unmatched.push({ keyword: kw.keyword, reason: 'sold_out' });
              } else {
                matched.push({
                  keyword: kw.keyword,
                  quantity: kw.quantity,
                  productId: roomProduct.productId,
                  productName: roomProduct.displayName,
                  productSku: '',
                  unitPrice: parseFloat(roomProduct.price),
                  liveRoomProductId: roomProduct.id,
                  isPreorder: roomProduct.availableStock <= 0 && roomProduct.allowPreorder,
                });
              }
            } else {
              unmatched.push({ keyword: kw.keyword, reason: 'not_in_room' });
            }
          }
          try {
            await recordLiveComment({
              liveRoomId: activeRoomId,
              commentId,
              commenterName,
              commenterPsid: commenterPsid || '',
              commentMessage,
              parsedKeyword: keywords.map((k: any) => k.keyword).join(', '),
              parsedQuantity: keywords.reduce((sum: number, k: any) => sum + k.quantity, 0),
              matchResult: matched.length > 0 ? 'matched' : (unmatched.some((u: any) => u.reason === 'sold_out') ? 'sold_out' : 'no_match'),
              matchedProductId: matched[0]?.productId,
              matchedProductName: matched[0]?.productName,
              matchedLiveRoomProductId: matched[0]?.liveRoomProductId,
              commentDate: new Date(),
            });
          } catch (recErr: any) {
            console.log("[Facebook] Failed to record live comment:", recErr?.message);
          }
        } catch (roomProdErr: any) {
          console.log("[Facebook] Failed to get live room products, falling back to global match:", roomProdErr?.message);
          const result = await matchKeywordsToProducts(keywords);
          matched = result.matched;
          unmatched = result.unmatched;
        }
      } else {
        // No active live room — try to find a Campaign by content ID (Post ID / Video ID / Reel ID)
        campaign = null;
        try {
          const { findCampaignByContentId } = require("./db");
          campaign = postId ? await findCampaignByContentId(String(postId)) : null;
          if (campaign && campaign.status === 'active') {
            console.log(`[Facebook] Found active Campaign ${campaign.id} (${campaign.name}) for content ID ${postId}`);
          }
        } catch (campaignErr: any) {
          console.log("[Facebook] Campaign lookup failed:", campaignErr?.message);
        }
        if (campaign && campaign.status === 'active') {
          // Match keywords ONLY against Campaign's bound products (no global fallback)
          const { matchKeywordsToCampaignProducts } = require("./db");
          const result = await matchKeywordsToCampaignProducts(keywords, campaign.id);
          matched = result.matched;
          unmatched = result.unmatched;
        } else {
          // No Campaign found — use global keyword matching as before
          const result = await matchKeywordsToProducts(keywords);
          matched = result.matched;
          unmatched = result.unmatched;
        }
      }

      if (matched.length > 0) {
        // V2.1.02: Look up live room to get liveType for order routing
        let liveRoomId: number | undefined;
        let liveType: string | undefined;
        try {
          const { getLiveRooms } = require("./db");
          const allRooms = await getLiveRooms({});
          const matchingRoom = (allRooms || []).find((r: any) =>
            r.facebookVideoId === postId ||
            r.facebookLiveUrl?.includes(postId)
          );
          if (matchingRoom) {
            liveRoomId = matchingRoom.id;
            liveType = matchingRoom.liveType;
          }
        } catch (liveErr: any) {
          console.log("[Facebook] Live room lookup failed:", liveErr?.message);
        }
        const orderResult = await createOrderFromLiveCapture({
          commenterName,
          commentMessage,
          commentId,
          postId,
          liveRoomId,
          liveType,
          matchedProducts: matched.map((m: any) => ({
            keyword: m.keyword,
            quantity: m.quantity,
            productId: m.productId,
            productName: m.productName,
            productSku: m.productSku,
            unitPrice: m.unitPrice,
          })),
          sourceName: campaign ? campaign.name : "Facebook Live",
          campaignId: campaign?.id,
          campaignName: campaign?.name,
          sourceType: campaign ? "facebook_post" : "facebook_live",
        });
        const itemList = matched.map((m: any) => `${m.keyword}+${m.quantity}`).join(", ");
        const commentReplyResult = await replyToComment(
          commentId,
          `${commenterName} 您好！已自动建单 ✅\n订单编号: ${orderResult.orderNumber}\n商品: ${itemList}\n总额: RM ${orderResult.totalAmount}\n\n请私信我们提供收货地址和付款方式哦~`
        );
        publicEventResult = {
          outcome: "live_order",
          handledBy: "live_order",
          liveRoomId: liveRoomId ?? null,
          responseSummary: `已建立订单 ${orderResult.orderNumber}`,
          errorMessage: commentReplyResult.success ? null : (commentReplyResult.errorMessage ?? "订单评论确认发送失败"),
        };
        try {
          const isMerged = (orderResult as any).merged;
          if (isMerged) {
            // V2.0.2: Merged order notification with detailed product info and "查询订单及结账" button
            const mergeOrderUrl = orderResult.secureToken
              ? `${process.env.VITE_PUBLIC_URL || 'https://www.xintian.com.my'}/order/${orderResult.orderNumber}/${orderResult.secureToken}`
              : null;
            const mergeDetailLines = matched.map((m: any) => `• ${m.productName}${m.variationName ? ` (${m.variationName})` : ''} ×${m.quantity} @ RM ${m.unitPrice}`).join('\n');
            const mergeText = `${commenterName} 您好！已追加到订单 ${orderResult.orderNumber}\n\n新增商品:\n${mergeDetailLines}\n\n目前商品金额: RM ${orderResult.totalAmount}\n（运费将在填写收货地址后自动计算）`;
            if (mergeOrderUrl) {
              await sendButtonMessage(commenterPsid || '', mergeText, [
                { title: '查询订单及结账', url: mergeOrderUrl },
              ]);
            } else {
              await sendTextMessage(commenterPsid || '', mergeText);
            }
          } else {
            // V2.0.2: Send winner notification with detailed product info and "查询订单及结账" button
            const orderUrl = orderResult.secureToken
              ? `${process.env.VITE_PUBLIC_URL || 'https://www.xintian.com.my'}/order/${orderResult.orderNumber}/${orderResult.secureToken}`
              : null;
            const detailLines = matched.map((m: any) => `• ${m.productName}${m.variationName ? ` (${m.variationName})` : ''} ×${m.quantity} @ RM ${m.unitPrice} = RM ${(parseFloat(m.unitPrice) * m.quantity).toFixed(2)}`).join('\n');
            const notifText = `恭喜 ${commenterName} 成功下单 ✅\n\n订单编号: ${orderResult.orderNumber}\n\n${detailLines}\n\n目前商品金额: RM ${orderResult.totalAmount}\n（运费将在填写收货地址后自动计算，消费满 RM150 不含特价 10kg 内即可享用免邮福利）\n\n请点击下方按钮查看订单并完成结账~`;
            if (orderUrl) {
              await sendButtonMessage(commenterPsid || '', notifText, [
                { title: '查询订单及结账', url: orderUrl },
              ]);
            } else {
              await sendTextMessage(commenterPsid || '', notifText + '\n\n请提供以下信息完成订单：\n1. 收货地址\n2. 联系电话\n3. 付款方式');
            }
          }
        } catch (msgErr) {
          console.log("[Facebook] Could not send Messenger message (expected if no PSID)");
        }
        return;
      } else if (unmatched.length > 0) {
        const allSoldOut = unmatched.every((u: any) => u.reason === 'sold_out');
        if (allSoldOut) {
          return;
        }
        return;
      }
    }
  } catch (kwError: any) {
    console.error("[Facebook] Keyword matching error:", kwError?.message);
  }

  // Generic auto-replies (only if no keyword match was attempted)
  if (lowerMsg.includes("要") || lowerMsg.includes("买") || lowerMsg.includes("下单")) {
    const replyResult = await replyToComment(commentId, `${commenterName} 您好！已收到您的订单意向，请私信我们完成下单哦~`);
    publicEventResult = replyResult.success
      ? { outcome: "no_reply", handledBy: "system", responseSummary: "已回复通用下单引导" }
      : { outcome: "failed", handledBy: "system", responseSummary: "通用下单引导发送失败", errorMessage: replyResult.errorMessage ?? null };
  } else if (lowerMsg.includes("多少钱") || lowerMsg.includes("价格") || lowerMsg.includes("price")) {
    const replyResult = await replyToComment(commentId, `${commenterName} 您好！请私信我们获取详细价格信息~`);
    publicEventResult = replyResult.success
      ? { outcome: "no_reply", handledBy: "system", responseSummary: "已回复通用价格引导" }
      : { outcome: "failed", handledBy: "system", responseSummary: "通用价格引导发送失败", errorMessage: replyResult.errorMessage ?? null };
  } else if (lowerMsg.includes("有货") || lowerMsg.includes("stock")) {
    const replyResult = await replyToComment(commentId, `${commenterName} 您好！请私信我们确认库存情况~`);
    publicEventResult = replyResult.success
      ? { outcome: "no_reply", handledBy: "system", responseSummary: "已回复通用库存引导" }
      : { outcome: "failed", handledBy: "system", responseSummary: "通用库存引导发送失败", errorMessage: replyResult.errorMessage ?? null };
  }
  } finally {
    if (publicEventClaim) {
      try {
        await completePublicFlowEvent(publicEventClaim.id, publicEventResult);
      } catch (completeError: any) {
        console.error("[Facebook] Unable to finalize public comment event:", completeError?.message);
      }
    }
  }
}

/**
 * Reply to a comment on a Facebook post
 */
async function replyToComment(commentId: string, message: string): Promise<{
  success: boolean;
  platformMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
}> {
  try {
    const token = getPageAccessToken();
    const response = await axios.post(
      `${FB_GRAPH_API}/${commentId}/comments?access_token=${token}`,
      { message }
    );
    console.log("[Facebook] Replied to comment:", commentId);
    const platformMessageId = response?.data?.id ?? response?.data?.comment_id;
    return { success: true, platformMessageId: platformMessageId ? String(platformMessageId) : undefined };
  } catch (error: any) {
    const errorCode = error?.response?.status ?? error?.code ?? "facebook_comment_send";
    const errorMessage = error?.response?.data?.error?.message ?? error?.message ?? "Facebook 评论回复发送失败";
    console.error("[Facebook] Failed to reply to comment:", error?.response?.data || error?.message);
    return { success: false, errorCode: String(errorCode), errorMessage: String(errorMessage).slice(0, 500) };
  }
}

/**
 * Get user profile (name, profile pic) from PSID
 */
export async function getUserProfile(psid: string): Promise<{
  name?: string;
  firstName?: string;
  lastName?: string;
  profilePic?: string;
}> {
  const token = getPageAccessToken();
  try {
    const response = await axios.get(
      `${FB_GRAPH_API}/${psid}?fields=first_name,last_name,name,profile_pic&access_token=${token}`
    );
    return {
      name: response.data.name,
      firstName: response.data.first_name,
      lastName: response.data.last_name,
      profilePic: response.data.profile_pic,
    };
  } catch (error: any) {
    console.error("[Messenger] Failed to get user profile:", error?.response?.data || error?.message);
    return {};
  }
}

/**
 * Send a custom message with the Telegram join link for membership onboarding.
 * This is the core function called when admin confirms membership fee.
 *
 * @param psid - Customer's Page-scoped ID
 * @param telegramLink - Telegram group join link
 * @param welcomeText - Welcome message text
 * @param buttonText - Button text (e.g. "加入 Telegram 群")
 */
export async function sendTelegramJoinFlow(
  psid: string,
  telegramLink: string,
  welcomeText: string,
  buttonText: string,
  imageUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Step 1: Send welcome text (contains Telegram link in the text itself)
    await sendTextMessage(psid, welcomeText);

    // Step 2: Send image if provided (membership tutorial image)
    let imageResponse: any = null;
    if (imageUrl) {
      try {
        imageResponse = await sendMediaMessage(psid, "image", imageUrl);
      } catch (imgError: any) {
        console.warn("[Messenger] Failed to send membership image:", imgError?.message);
        // Don't fail the whole flow if image fails
      }
    }

    return { success: true, messageId: imageResponse?.message_id };
  } catch (error: any) {
    console.error("[Messenger] Telegram join flow failed:", error?.response?.data || error?.message);
    return {
      success: false,
      error: error?.response?.data?.error?.message || error?.message || "Unknown error",
    };
  }
}
