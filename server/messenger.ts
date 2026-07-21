import axios from "axios";

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
            { title: "联系客服", url: step.buttonUrl || "https://m.me/250376501495005" },
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

  if (text) {
    // Auto-reply for common queries
    const lowerText = text.toLowerCase().trim();

    // Check for order-related keywords
    if (lowerText.includes("下单") || lowerText.includes("order") || lowerText.includes("买")) {
      await sendTextMessage(
        psid,
        "您好！感谢您对心田的支持！请告诉我您想购买的商品，我会帮您处理订单。"
      );
      return;
    }

    if (lowerText.includes("会员") || lowerText.includes("member")) {
      await sendTextMessage(
        psid,
        "您好！心田会员可以享受更多专属福利。请点击以下链接了解会员详情："
      );
      await sendButtonMessage(psid, "心田会员专区", [
        { title: "了解会员", url: "https://m.me/250376501495005" },
      ]);
      return;
    }

    if (lowerText.includes("运费") || lowerText.includes("shipping")) {
      await sendTextMessage(
        psid,
        "运费根据商品重量计算。购买满 RM200 可享受免邮优惠（仅限西马）。"
      );
      return;
    }

    if (lowerText.includes("你好") || lowerText.includes("hi") || lowerText.includes("hello")) {
      await sendTextMessage(
        psid,
        "您好！欢迎来到心田 🌿 有什么可以帮到您的吗？"
      );
      return;
    }

    // Default auto-reply
    await sendTextMessage(
      psid,
      "感谢您的留言！我们的客服会尽快回复您。如果您需要下单，请直接告诉我们商品名称和数量。"
    );
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
      "心田会员可享受专属福利和优先服务。点击以下链接加入我们的 Telegram 会员群："
    );
    await sendButtonMessage(psid, "加入心田会员", [
      { title: "Telegram 入群", url: "https://t.me/xintian" },
    ]);
  }
}

/**
 * Handle Page feed events (comments, posts)
 */
export async function handlePageFeedEvent(change: any, pageId: string): Promise<void> {
  const field = change.field;
  const value = change.value;

  console.log("[Facebook] Page feed event:", field);

  if (field === "feed") {
    // New post on the page
    const postId = value?.post_id;
    const message = value?.message;
    console.log("[Facebook] New post:", postId, message);
  }

  if (field === "comments") {
    // New comment on a post
    const commentId = value?.comment_id;
    const commenterName = value?.from?.name;
    const commentMessage = value?.message;
    const postId = value?.post_id;

    console.log("[Facebook] New comment:", commenterName, ":", commentMessage, "on post:", postId);

    // Auto-reply to comments (especially during live streams)
    if (commentMessage) {
      const lowerMsg = commentMessage.toLowerCase();

      if (lowerMsg.includes("要") || lowerMsg.includes("买") || lowerMsg.includes("下单")) {
        await replyToComment(commentId, `${commenterName} 您好！已收到您的订单意向，请私信我们完成下单哦~`);
      } else if (lowerMsg.includes("多少钱") || lowerMsg.includes("价格") || lowerMsg.includes("price")) {
        await replyToComment(commentId, `${commenterName} 您好！请私信我们获取详细价格信息~`);
      } else if (lowerMsg.includes("有货") || lowerMsg.includes("stock")) {
        await replyToComment(commentId, `${commenterName} 您好！请私信我们确认库存情况~`);
      }
    }
  }

  if (field === "live_videos") {
    // Live video status change
    const status = value?.status;
    const liveVideoId = value?.id;
    console.log("[Facebook] Live video event:", liveVideoId, "status:", status);
  }
}

/**
 * Reply to a comment on a Facebook post
 */
async function replyToComment(commentId: string, message: string): Promise<void> {
  const token = getPageAccessToken();
  try {
    await axios.post(
      `${FB_GRAPH_API}/${commentId}/comments?access_token=${token}`,
      { message }
    );
    console.log("[Facebook] Replied to comment:", commentId);
  } catch (error: any) {
    console.error("[Facebook] Failed to reply to comment:", error?.response?.data || error?.message);
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
  buttonText: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Step 1: Send welcome text
    await sendTextMessage(psid, welcomeText);

    // Step 2: Send button with Telegram link
    const response = await sendButtonMessage(psid, "请点击以下按钮加入心田会员群", [
      { title: buttonText, url: telegramLink },
    ]);

    return { success: true, messageId: response?.message_id };
  } catch (error: any) {
    console.error("[Messenger] Telegram join flow failed:", error?.response?.data || error?.message);
    return {
      success: false,
      error: error?.response?.data?.error?.message || error?.message || "Unknown error",
    };
  }
}
