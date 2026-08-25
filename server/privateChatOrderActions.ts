import { and, desc, eq } from "drizzle-orm";
import { orderItems, orders, variants, products } from "../drizzle/schema";
import { addOrderPayment, getDb, transitionOrderStatus, updateOrderStatus } from "./db";
import { createDraftOrder, createOrderChangeRequest, type DraftOrderItem } from "./businessAi";
import { storagePut } from "./storage";

type SafeActionResult = {
  handled: boolean;
  shouldHandover: boolean;
  reply?: string;
  handoverReason?: string;
  draftOrderId?: number;
  changeRequestId?: number;
};

type EligibleOrder = typeof orders.$inferSelect;

const FINAL_OR_PROTECTED_STATUSES = new Set(["shipped", "completed", "cancelled", "partial_shipped", "packing"]);
const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(value: string) {
  return value.replace(ESCAPE_REGEX, "\\$&");
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[\s\-_/，,。.!！?？]/g, "");
}

function getOrderNumberFromMessage(message: string) {
  return message.match(/\b(?:XT|XTC|XTD)\d{3,}\b/i)?.[0]?.toUpperCase() ?? null;
}

function getMentionedAmount(message: string): string | null {
  const match = message.match(/(?:RM|MYR|令吉)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  return match ? Number(match[1]).toFixed(2) : null;
}

function extractQuantity(message: string, aliases: string[]) {
  for (const alias of aliases.filter((value) => value.trim().length >= 2).sort((left, right) => right.length - left.length)) {
    const escaped = escapeRegex(alias.trim());
    const patterns = [
      new RegExp(`${escaped}\\s*(?:[+x×＊*]|数量[:：]?)\\s*(\\d{1,3})`, "i"),
      new RegExp(`${escaped}\\s*(\\d{1,3})\\s*(?:个|件|盆|包|棵|株|份|袋|瓶|盒|粒)?(?:\\b|$)`, "i"),
    ];
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const quantity = Number(match[1]);
        if (Number.isInteger(quantity) && quantity > 0 && quantity <= 999) return quantity;
      }
    }
  }
  return null;
}

async function resolveEligibleOrder(customerId: number | null | undefined, message: string, purpose: "change" | "payment") {
  if (!customerId) return { order: null, reason: "未能确认客户资料，无法安全关联订单" };
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const requestedOrderNumber = getOrderNumberFromMessage(message);
  const rows = await database.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));
  const candidates = rows.filter((order) => {
    if (requestedOrderNumber && order.orderNumber !== requestedOrderNumber) return false;
    if (FINAL_OR_PROTECTED_STATUSES.has(order.physicalStatus || "")) return false;
    if (purpose === "change") {
      return ["pending", "hold_order"].includes(order.physicalStatus || "")
        && Number(order.paidAmount || 0) === 0
        && !order.receiptUrl
        && !order.paymentUploadedAt;
    }
    return ["pending", "hold_order", "partial_payment"].includes(order.physicalStatus || "") && !order.receiptUrl;
  });
  if (candidates.length === 1) return { order: candidates[0] as EligibleOrder, reason: null };
  if (requestedOrderNumber) return { order: null, reason: `找不到可处理的订单 ${requestedOrderNumber}` };
  return {
    order: null,
    reason: candidates.length === 0 ? "没有可安全处理的未付款订单" : "客户有多张可处理订单，请先提供订单编号",
  };
}

async function findExactlyOneProduct(message: string) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const listed = await database.select().from(products).where(and(eq(products.status, "active"), eq(products.isListed, true)));
  const text = normalise(message);
  const matches = listed.filter((product) => {
    const aliases = [product.keyword, product.sku, product.name].filter(Boolean) as string[];
    return aliases.some((alias) => alias.length >= 2 && text.includes(normalise(alias)));
  });
  return matches.length === 1 ? matches[0] : null;
}

async function findExactlyOneVariantForProduct(productId: number, productKeyword: string | null, message: string) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const text = normalise(message);
  const candidates = await database.select().from(variants)
    .where(and(eq(variants.productId, productId), eq(variants.status, "active")));
  const matches = candidates.filter((variant) => {
    const aliases = [
      variant.name,
      variant.keyword,
      productKeyword && variant.keyword ? `${productKeyword}${variant.keyword}` : null,
    ].filter((value): value is string => Boolean(value) && normalise(String(value)).length >= 2);
    return aliases.some((alias) => text.includes(normalise(alias)));
  });
  return matches.length === 1 ? matches[0] : null;
}

async function findOrderItemForProduct(orderId: number, productId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const items = await database.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const matched = items.filter((item) => item.productId === productId);
  return matched.length === 1 ? matched[0] : null;
}

function handover(reason: string): SafeActionResult {
  return { handled: true, shouldHandover: true, handoverReason: reason };
}

/**
 * Handles only actions whose customer, order, product and quantity can be
 * established without guessing. It never updates an official order itself.
 */
export async function capturePrivateChatOrderIntent(input: {
  message: string;
  customerId?: number | null;
  customerName?: string | null;
  messengerId?: string | null;
  workflow: "draft_order" | "change_request";
}): Promise<SafeActionResult> {
  const message = input.message.trim();
  const isAddress = /(地址|邮寄资料|收件人|postcode|邮编|jalan\b|taman\b|lorong\b)/i.test(message);

  if (input.workflow === "draft_order") {
    const product = await findExactlyOneProduct(message);
    if (!product) return handover("AI无法唯一确认要购买的商品，请客户提供商品关键词和数量");
    const variant = product.productMode === "variant"
      ? await findExactlyOneVariantForProduct(product.id, product.keyword, message)
      : null;
    if (product.productMode === "variant" && !variant) {
      return handover(`商品「${product.name}」需要确认规格或颜色，请人工建立待审核草稿`);
    }
    const quantity = extractQuantity(message, [product.keyword, product.sku, product.name, variant?.keyword || "", variant && product.keyword ? `${product.keyword}${variant.keyword}` : ""]);
    if (!quantity) return handover(`已识别商品「${product.name}」，但无法确认数量，请客户补充数量`);
    const price = Number(variant?.sellingPrice ?? product.sellingPrice ?? product.regularPrice ?? 0);
    if (!(price > 0)) return handover(`商品「${product.name}」没有有效售价，无法建立草稿订单`);
    const draft = await createDraftOrder({
      customerId: input.customerId ?? undefined,
      customerName: input.customerName ?? undefined,
      messengerId: input.messengerId ?? undefined,
      platform: "messenger",
      detectedIntent: "new_order",
      originalMessage: message,
      items: [{ productId: product.id, productName: product.name, quantity, price, variantId: variant?.id, variantName: variant?.name }],
    });
    return {
      handled: true,
      shouldHandover: false,
      draftOrderId: draft.draftId,
      reply: `已收到您的下单要求：${product.name} × ${quantity}。我们已建立待审核订单草稿（${draft.draftNumber}），客服确认后会通知您。`,
    };
  }

  const target = await resolveEligibleOrder(input.customerId, message, "change");
  if (!target.order) return handover(`无法建立订单变更请求：${target.reason}`);
  const order = target.order;

  if (isAddress) {
    const request = await createOrderChangeRequest({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: input.customerId ?? undefined,
      customerName: input.customerName ?? undefined,
      requestType: "change_address",
      changeDetails: { newAddress: message, source: "messenger_private_chat" },
      detectedIntent: "order_modification",
      originalMessage: message,
    });
    return { handled: true, shouldHandover: false, changeRequestId: request.requestId, reply: `已收到邮寄资料，已建立待审核地址更新申请（${request.requestNumber}）。客服确认后才会更新订单资料。` };
  }

  if (/(取消.{0,6}(订单|整单)|不要(?:整个|整张)?订单)/.test(message)) {
    const request = await createOrderChangeRequest({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: input.customerId ?? undefined,
      customerName: input.customerName ?? undefined,
      requestType: "cancel_order",
      changeDetails: { reason: "客户通过 Messenger 申请取消订单", source: "messenger_private_chat" },
      detectedIntent: "order_modification",
      originalMessage: message,
    });
    return { handled: true, shouldHandover: false, changeRequestId: request.requestId, reply: `已登记取消订单申请（${request.requestNumber}）。客服审核前，订单不会被取消。` };
  }

  const product = await findExactlyOneProduct(message);
  const addingItem = /(加单|加货|加商品|再要|再加)/.test(message);
  if (addingItem) {
    if (!product) return handover("无法唯一确认要加购的商品，请客户提供商品关键词和数量");
    const variant = product.productMode === "variant"
      ? await findExactlyOneVariantForProduct(product.id, product.keyword, message)
      : null;
    if (product.productMode === "variant" && !variant) return handover(`商品「${product.name}」需要确认规格或颜色，请人工处理加购申请`);
    const quantity = extractQuantity(message, [product.keyword, product.sku, product.name, variant?.keyword || "", variant && product.keyword ? `${product.keyword}${variant.keyword}` : ""]);
    if (!quantity) return handover(`已识别加购商品「${product.name}」，但无法确认数量`);
    const price = Number(variant?.sellingPrice ?? product.sellingPrice ?? product.regularPrice ?? 0);
    if (!(price > 0)) return handover(`商品「${product.name}」没有有效售价，无法建立加购申请`);
    const items: DraftOrderItem[] = [{ productId: product.id, productName: product.name, quantity, price, variantId: variant?.id, variantName: variant?.name }];
    const request = await createOrderChangeRequest({
      orderId: order.id, orderNumber: order.orderNumber, customerId: input.customerId ?? undefined, customerName: input.customerName ?? undefined,
      requestType: "add_item", changeDetails: { items, source: "messenger_private_chat" }, detectedIntent: "order_modification", originalMessage: message,
    });
    return { handled: true, shouldHandover: false, changeRequestId: request.requestId, reply: `已登记加购申请：${product.name} × ${quantity}（${request.requestNumber}）。客服审核前，原订单不会变更。` };
  }

  if (!product) return handover("无法唯一确认要变更的商品，请客户提供订单编号、商品关键词及要求");
  const item = await findOrderItemForProduct(order.id, product.id);
  if (!item) return handover(`订单 ${order.orderNumber} 中找不到唯一的商品「${product.name}」，请人工确认`);

  if (/(取消商品|不要了|删掉|移除|取消这(?:个|盆|包|件))/.test(message)) {
    const request = await createOrderChangeRequest({
      orderId: order.id, orderNumber: order.orderNumber, customerId: input.customerId ?? undefined, customerName: input.customerName ?? undefined,
      requestType: "cancel_item", changeDetails: { orderItemId: item.id, productId: product.id, source: "messenger_private_chat" }, detectedIntent: "order_modification", originalMessage: message,
    });
    return { handled: true, shouldHandover: false, changeRequestId: request.requestId, reply: `已登记取消商品「${product.name}」申请（${request.requestNumber}）。客服审核前，订单不会变更。` };
  }

  if (/(改数量|数量|改成|改为|数量要)/.test(message)) {
    const newQuantity = extractQuantity(message, [product.keyword, product.sku, product.name]);
    if (!newQuantity) return handover(`已识别商品「${product.name}」，但无法确认新的数量`);
    if (newQuantity === item.quantity) return handover(`商品「${product.name}」的新数量与原订单相同，请人工确认客户要求`);
    const request = await createOrderChangeRequest({
      orderId: order.id, orderNumber: order.orderNumber, customerId: input.customerId ?? undefined, customerName: input.customerName ?? undefined,
      requestType: "change_quantity", changeDetails: { orderItemId: item.id, productId: product.id, productName: product.name, newQuantity, quantityChange: newQuantity - item.quantity, source: "messenger_private_chat" }, detectedIntent: "order_modification", originalMessage: message,
    });
    return { handled: true, shouldHandover: false, changeRequestId: request.requestId, reply: `已登记「${product.name}」数量变更为 ${newQuantity} 的申请（${request.requestNumber}）。客服审核前，订单不会变更。` };
  }

  if (/(颜色|规格|款式|换成|换.*色|改.*色)/.test(message)) {
    const database = await getDb();
    if (!database) throw new Error("Database not available");
    const productVariants = await database.select().from(variants).where(and(eq(variants.productId, product.id), eq(variants.status, "active")));
    const text = normalise(message);
    const matches = productVariants.filter((variant) => [variant.name, variant.keyword].filter(Boolean).some((value) => normalise(String(value)).length >= 2 && text.includes(normalise(String(value)))));
    if (matches.length !== 1) return handover(`无法唯一确认商品「${product.name}」要更换的规格或颜色`);
    const request = await createOrderChangeRequest({
      orderId: order.id, orderNumber: order.orderNumber, customerId: input.customerId ?? undefined, customerName: input.customerName ?? undefined,
      requestType: "change_variant", changeDetails: { orderItemId: item.id, productId: product.id, newVariationId: matches[0].id, newVariationName: matches[0].name, newPrice: Number(matches[0].sellingPrice), source: "messenger_private_chat" }, detectedIntent: "order_modification", originalMessage: message,
    });
    return { handled: true, shouldHandover: false, changeRequestId: request.requestId, reply: `已登记「${product.name}」更换为「${matches[0].name}」的申请（${request.requestNumber}）。客服审核前，订单不会变更。` };
  }

  return handover("AI已识别订单修改意图，但无法安全确定变更内容，已转交客服处理");
}

/** Persist a Messenger image before attaching it to the existing payment-review workflow. */
export async function captureMessengerPaymentProof(input: {
  imageUrl: string;
  message: string;
  customerId?: number | null;
  conversationId?: number | null;
  customerMessageId?: number | null;
}): Promise<SafeActionResult> {
  if (!/^https:\/\//i.test(input.imageUrl)) return handover("付款凭据图片来源无效，已转人工处理");
  const target = await resolveEligibleOrder(input.customerId, input.message, "payment");
  if (!target.order) return handover(`已收到图片，但无法安全关联付款订单：${target.reason}`);
  const response = await fetch(input.imageUrl, { signal: AbortSignal.timeout(15_000) });
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (!response.ok || !contentType.startsWith("image/") || contentLength > 10 * 1024 * 1024) {
    return handover("付款凭据图片无法安全读取，已转人工处理");
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length === 0 || body.length > 10 * 1024 * 1024) return handover("付款凭据图片大小不符合要求，已转人工处理");
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const { url } = await storagePut(
    `payment-proofs/messenger/${target.order.orderNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`,
    body,
    contentType,
  );
  const amount = getMentionedAmount(input.message) ?? "0.00";
  const notes = JSON.stringify({
    source: "messenger_private_chat",
    conversationId: input.conversationId ?? null,
    customerMessageId: input.customerMessageId ?? null,
    suppliedAmount: amount === "0.00" ? null : amount,
    reviewNote: amount === "0.00" ? "客户未在文字中提供金额；审核员须以凭据图片核对并更正金额后批准。" : "金额由客户文字提供；审核员须以凭据图片核对。",
  });
  await transitionOrderStatus(target.order.id, "receipt_uploaded", "Messenger 私聊", "客户通过 Messenger 上传付款凭据");
  await updateOrderStatus(target.order.id, { receiptUrl: url });
  await addOrderPayment({
    orderId: target.order.id,
    amount,
    paymentMethod: "Messenger 汇款凭据",
    receiptUrl: url,
    paymentSource: "customer_upload",
    notes,
  });
  return { handled: true, shouldHandover: false, reply: amount === "0.00"
    ? `已收到订单 ${target.order.orderNumber} 的汇款凭据，已进入待审核队列。客服会核对凭据金额后确认。`
    : `已收到订单 ${target.order.orderNumber} 的 RM${amount} 汇款凭据，已进入待审核队列。` };
}
