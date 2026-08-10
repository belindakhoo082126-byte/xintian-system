import { getDb, resolveOrderCategory, recalculateOrderBalance, generateOrderNumber, generateSecureToken } from "./db";
import { draftOrders, orderChangeRequests, reservationRecords, products, orders, orderItems, aiLogs, aiHandoverRequests } from "../drizzle/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { SideEffectPolicy } from "./aiTestRunner";

// ===========================================================================
// AI Case Classification — Intent detection for every customer message
// ===========================================================================

export type CaseIntent =
  | "general_inquiry"
  | "product_inquiry"
  | "membership"
  | "new_order"
  | "order_modification"
  | "order_status"
  | "shipment_tracking"
  | "parcel_issue"
  | "complaint"
  | "refund"
  | "cooperation"
  | "human_assistance"
  | "other";

export interface IntentClassification {
  intent: CaseIntent;
  confidence: number;
  shouldHandover: boolean;
  workflow: "ai_reply" | "product_match" | "draft_order" | "change_request" | "query_order" | "shipping_api" | "human_handover";
}

// Keyword patterns for intent classification (checked BEFORE formal AI matching)
const INTENT_PATTERNS: { intent: CaseIntent; patterns: string[]; workflow: IntentClassification["workflow"]; handover?: boolean }[] = [
  {
    intent: "shipment_tracking",
    patterns: ["parcel", "package", "shipment", "tracking", "where is my", "快递", "包裹", "物流", "追踪", "到哪里了", "什么时候到", "发货了吗"],
    workflow: "shipping_api",
  },
  {
    intent: "parcel_issue",
    patterns: ["damaged", "broken", "wrong item", "missing", "lost package", "损坏", "破", "错", "少了", "丢了", "烂"],
    workflow: "human_handover",
    handover: true,
  },
  {
    intent: "complaint",
    patterns: ["complaint", "terrible", "awful", "disappointed", "投诉", "差评", "不满", "糟糕"],
    workflow: "human_handover",
    handover: true,
  },
  {
    intent: "refund",
    patterns: ["refund", "money back", "return", "退款", "退货", "还钱", "退钱"],
    workflow: "human_handover",
    handover: true,
  },
  {
    intent: "cooperation",
    patterns: ["cooperation", "collaborate", "partner", "wholesale", "合作", "代理", "批发", "经销"],
    workflow: "human_handover",
    handover: true,
  },
  {
    intent: "order_modification",
    patterns: ["add item", "remove item", "change quantity", "change address", "change phone", "cancel item", "加货", "减货", "改数量", "改地址", "改电话", "取消商品", "换货"],
    workflow: "change_request",
  },
  {
    intent: "order_status",
    patterns: ["order status", "my order", "when ship", "when deliver", "订单状态", "我的订单", "什么时候发货", "订单怎样了"],
    workflow: "query_order",
  },
  {
    intent: "membership",
    patterns: ["member", "membership", "join", "vip", "会员", "加入", "升级"],
    workflow: "ai_reply",
  },
  {
    intent: "new_order",
    patterns: ["buy", "order", "purchase", "want", "get this", "下单", "买", "要", "订购", "多少钱"],
    workflow: "draft_order",
  },
  {
    intent: "product_inquiry",
    patterns: ["product", "plant", "flower", "size", "care", "water", "sunlight", "商品", "植物", "花", "大小", "养护", "浇水", "阳光"],
    workflow: "product_match",
  },
  {
    intent: "human_assistance",
    patterns: ["human", "agent", "staff", "help me", "人工", "客服", "帮忙", "转人工"],
    workflow: "human_handover",
    handover: true,
  },
  {
    intent: "general_inquiry",
    patterns: ["hello", "hi", "hey", "thank", "你好", "谢谢", "请问"],
    workflow: "ai_reply",
  },
];

/**
 * Classify customer message into intent using keyword patterns.
 * This runs BEFORE the formal AI matching pipeline to determine the workflow.
 */
export function classifyIntent(message: string): IntentClassification {
  const lowerMsg = message.toLowerCase().trim();

  for (const pattern of INTENT_PATTERNS) {
    for (const kw of pattern.patterns) {
      if (lowerMsg.includes(kw.toLowerCase())) {
        return {
          intent: pattern.intent,
          confidence: 0.85,
          shouldHandover: !!pattern.handover,
          workflow: pattern.workflow,
        };
      }
    }
  }

  return {
    intent: "other",
    confidence: 0.3,
    shouldHandover: false,
    workflow: "ai_reply",
  };
}

// ===========================================================================
// Inventory Reservation System
// ===========================================================================

/**
 * Reserve inventory for a draft order or change request.
 * Increases product.reservedQuantity and creates a reservation record.
 */
export async function reserveInventory(
  productId: number,
  quantity: number,
  source: "draft_order" | "change_request",
  referenceNumber: string,
  referenceId: number,
  productName?: string,
  variantId?: number,
): Promise<number> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  // Check available stock
  const [product] = await database.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) throw new Error(`Product ${productId} not found`);

  const available = (product.stockQuantity || 0) - (product.reservedQuantity || 0);
  if (available < quantity) {
    throw new Error(`Insufficient stock for ${product.name}: available ${available}, requested ${quantity}`);
  }

  // Increase reserved quantity
  await database.update(products)
    .set({ reservedQuantity: (product.reservedQuantity || 0) + quantity })
    .where(eq(products.id, productId));

  // Create reservation record
  const [result] = await database.insert(reservationRecords).values({
    productId,
    productName: productName || product.name,
    variantId: variantId || null,
    quantity,
    source,
    referenceNumber,
    referenceId,
    status: "active",
  });

  return (result as any).insertId;
}

/**
 * Release reserved inventory (when draft order or change request is rejected).
 */
export async function releaseInventory(referenceId: number, source: "draft_order" | "change_request"): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const records = await database.select().from(reservationRecords)
    .where(and(
      eq(reservationRecords.referenceId, referenceId),
      eq(reservationRecords.source, source),
      eq(reservationRecords.status, "active"),
    ));

  for (const record of records) {
    // Decrease product reserved quantity
    const [product] = await database.select().from(products).where(eq(products.id, record.productId)).limit(1);
    if (product) {
      const newReserved = Math.max(0, (product.reservedQuantity || 0) - record.quantity);
      await database.update(products)
        .set({ reservedQuantity: newReserved })
        .where(eq(products.id, record.productId));
    }

    // Mark reservation as released
    await database.update(reservationRecords)
      .set({ status: "released", releasedAt: new Date() })
      .where(eq(reservationRecords.id, record.id));
  }
}

/**
 * Convert reserved inventory to official allocation (when draft order or change request is approved).
 * Decreases both stockQuantity and reservedQuantity.
 */
export async function convertInventory(referenceId: number, source: "draft_order" | "change_request"): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const records = await database.select().from(reservationRecords)
    .where(and(
      eq(reservationRecords.referenceId, referenceId),
      eq(reservationRecords.source, source),
      eq(reservationRecords.status, "active"),
    ));

  for (const record of records) {
    const [product] = await database.select().from(products).where(eq(products.id, record.productId)).limit(1);
    if (product) {
      // Decrease stock (official allocation) and reserved
      const newStock = Math.max(0, (product.stockQuantity || 0) - record.quantity);
      const newReserved = Math.max(0, (product.reservedQuantity || 0) - record.quantity);
      await database.update(products)
        .set({ stockQuantity: newStock, reservedQuantity: newReserved })
        .where(eq(products.id, record.productId));
    }

    // Mark reservation as converted
    await database.update(reservationRecords)
      .set({ status: "converted", convertedAt: new Date() })
      .where(eq(reservationRecords.id, record.id));
  }
}

// ===========================================================================
// Draft Order Creation
// ===========================================================================

let draftCounter = 0;

function generateDraftNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  draftCounter++;
  return `DO-${ymd}-${String(draftCounter).padStart(4, "0")}`;
}

export interface DraftOrderItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  variantId?: number;
}

/**
 * Create a draft order from AI-detected purchase intent.
 * Reserves inventory immediately. Does NOT create official order.
 */
export async function createDraftOrder(params: {
  customerId?: number;
  customerName?: string;
  messengerId?: string;
  platform?: string;
  aiLogId?: number;
  detectedIntent?: string;
  originalMessage?: string;
  items: DraftOrderItem[];
}): Promise<{ draftId: number; draftNumber: string }> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const draftNumber = generateDraftNumber();
  const totalAmount = params.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Create draft order
  const [result] = await database.insert(draftOrders).values({
    draftNumber,
    customerId: params.customerId || null,
    customerName: params.customerName || null,
    messengerId: params.messengerId || null,
    platform: (params.platform as any) || "messenger",
    aiLogId: params.aiLogId || null,
    detectedIntent: params.detectedIntent || null,
    originalMessage: params.originalMessage || null,
    items: params.items,
    totalAmount: totalAmount.toFixed(2),
    status: "waiting_approval",
  });

  const draftId = (result as any).insertId;

  // Reserve inventory for each item
  for (const item of params.items) {
    await reserveInventory(
      item.productId,
      item.quantity,
      "draft_order",
      draftNumber,
      draftId,
      item.productName,
      item.variantId,
    );
  }

  return { draftId, draftNumber };
}

/**
 * Approve a draft order — creates official order and converts inventory.
 * V2.1.23: Uses resolveOrderCategory to determine local (XT) vs import (XTC).
 * Local orders start as "pending" (待汇款), import orders start as "pending" (挂单).
 * Prevents duplicate generation: only waiting_approval drafts can be approved.
 */
export async function approveDraftOrder(draftId: number, approvedBy: string): Promise<{ orderId: number; orderNumber: string }> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const [draft] = await database.select().from(draftOrders).where(eq(draftOrders.id, draftId)).limit(1);
  if (!draft) throw new Error("Draft order not found");
  if (draft.status !== "waiting_approval") throw new Error(`草稿订单状态为 ${draft.status}，无法重复批准`);

  // V2.1.23: Resolve orderCategory from product IDs
  const draftItems = draft.items as DraftOrderItem[];
  const productIds = draftItems.map(i => i.productId).filter(Boolean) as number[];
  const orderCategory = await resolveOrderCategory({ productIds });

  // V2.1.23: Generate proper order number with XT/XTC prefix
  const prefix = orderCategory === "import" ? "XTC" : "XT";
  const orderNumber = await generateOrderNumber(prefix);
  const secureToken = generateSecureToken();
  const checkoutLink = `/order/${orderNumber}/${secureToken}`;

  // V2.1.23: Set initial status based on orderCategory
  // Local: physicalStatus = pending (待汇款)
  // Import: physicalStatus = pending, importStatus = pending (挂单)
  const physicalStatus = "pending";
  const importStatus = orderCategory === "import" ? "pending" : null;

  // Create official order
  const [orderResult] = await database.insert(orders).values({
    orderNumber,
    secureToken,
    checkoutLink,
    customerId: draft.customerId || 0,
    facebookName: draft.customerName,
    messengerId: draft.messengerId,
    orderType: "physical",
    orderSource: "messenger",
    totalAmount: draft.totalAmount,
    paidAmount: "0",
    physicalStatus,
    importStatus,
    isSpecialOrder: false,
    orderCategory: orderCategory as any,
  });

  const orderId = (orderResult as any).insertId;

  // Create order items from draft items
  for (const item of draftItems) {
    await database.insert(orderItems).values({
      orderId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.price.toFixed(2),
      subtotal: (item.price * item.quantity).toFixed(2),
    });
  }

  // Convert reserved inventory to official allocation
  await convertInventory(draftId, "draft_order");

  // Update draft order status
  await database.update(draftOrders)
    .set({
      status: "approved",
      approvedBy,
      approvedAt: new Date(),
      officialOrderId: orderId,
    })
    .where(eq(draftOrders.id, draftId));

  return { orderId, orderNumber };
}

/**
 * Reject a draft order — releases reserved inventory.
 */
export async function rejectDraftOrder(draftId: number, rejectedBy: string, reason?: string): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  // Release reserved inventory
  await releaseInventory(draftId, "draft_order");

  // Update draft order status
  await database.update(draftOrders)
    .set({
      status: "rejected",
      rejectedBy,
      rejectedAt: new Date(),
      rejectReason: reason || null,
    })
    .where(eq(draftOrders.id, draftId));
}

// ===========================================================================
// Order Change Request Creation
// ===========================================================================

let changeRequestCounter = 0;

function generateRequestNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  changeRequestCounter++;
  return `OCR-${ymd}-${String(changeRequestCounter).padStart(4, "0")}`;
}

/**
 * Create an order change request from AI-detected modification intent.
 * AI never modifies the official order directly.
 */
export async function createOrderChangeRequest(params: {
  orderId: number;
  orderNumber: string;
  customerId?: number;
  customerName?: string;
  requestType: "add_item" | "remove_item" | "change_quantity" | "change_address" | "change_phone" | "cancel_item" | "other";
  changeDetails: any;
  aiLogId?: number;
  detectedIntent?: string;
  originalMessage?: string;
}): Promise<{ requestId: number; requestNumber: string }> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const requestNumber = generateRequestNumber();

  const [result] = await database.insert(orderChangeRequests).values({
    requestNumber,
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    customerId: params.customerId || null,
    customerName: params.customerName || null,
    requestType: params.requestType,
    changeDetails: params.changeDetails,
    aiLogId: params.aiLogId || null,
    detectedIntent: params.detectedIntent || null,
    originalMessage: params.originalMessage || null,
    status: "waiting_approval",
  });

  const requestId = (result as any).insertId;

  // Reserve inventory for add_item or change_quantity (increase) requests
  if (params.requestType === "add_item" && params.changeDetails.items) {
    for (const item of params.changeDetails.items as DraftOrderItem[]) {
      await reserveInventory(
        item.productId,
        item.quantity,
        "change_request",
        requestNumber,
        requestId,
        item.productName,
        item.variantId,
      );
    }
  } else if (params.requestType === "change_quantity" && params.changeDetails.productId && params.changeDetails.quantityChange > 0) {
    await reserveInventory(
      params.changeDetails.productId,
      params.changeDetails.quantityChange,
      "change_request",
      requestNumber,
      requestId,
      params.changeDetails.productName,
    );
  }

  return { requestId, requestNumber };
}

/**
 * Approve an order change request — updates the official order.
 */
export async function approveOrderChangeRequest(requestId: number, approvedBy: string): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const [request] = await database.select().from(orderChangeRequests).where(eq(orderChangeRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Change request not found");
  if (request.status !== "waiting_approval") throw new Error(`Change request status is ${request.status}`);

  const details = request.changeDetails as any;

  switch (request.requestType) {
    case "add_item": {
      // Add items to order
      if (details.items) {
        for (const item of details.items as DraftOrderItem[]) {
          await database.insert(orderItems).values({
            orderId: request.orderId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.price.toFixed(2),
            subtotal: (item.price * item.quantity).toFixed(2),
          });
        }
      }
      // Convert reserved inventory
      await convertInventory(requestId, "change_request");
      break;
    }
    case "remove_item": {
      if (details.orderItemId) {
        await database.delete(orderItems).where(eq(orderItems.id, details.orderItemId));
      }
      break;
    }
    case "change_quantity": {
      if (details.orderItemId && details.newQuantity) {
        await database.update(orderItems)
          .set({ quantity: details.newQuantity })
          .where(eq(orderItems.id, details.orderItemId));
      }
      if (details.quantityChange > 0) {
        await convertInventory(requestId, "change_request");
      }
      break;
    }
    case "change_address": {
      await database.update(orders)
        .set({ shippingAddress: details.newAddress })
        .where(eq(orders.id, request.orderId));
      break;
    }
    case "change_phone": {
      // Phone is on customer record, not order — would need customer update
      break;
    }
    case "cancel_item": {
      if (details.orderItemId) {
        await database.delete(orderItems).where(eq(orderItems.id, details.orderItemId));
      }
      break;
    }
    default:
      break;
  }

  // V2.1.23: Recalculate order total from items, then call recalculateOrderBalance
  // to automatically update payment status (e.g. partial_payment if paid < new total)
  // WITHOUT resetting the original business status unnecessarily.
  const items = await database.select().from(orderItems).where(eq(orderItems.orderId, request.orderId));
  const newTotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  await database.update(orders)
    .set({ totalAmount: newTotal.toFixed(2) })
    .where(eq(orders.id, request.orderId));

  // V2.1.23: Recalculate balance — this will update physicalStatus/importStatus
  // based on paidAmount vs totalAmount, but won't reset to pending if already
  // in hold_order, partial_payment, etc. (lockedStatuses protect shipped/completed/cancelled)
  await recalculateOrderBalance(request.orderId);

  // Update request status
  await database.update(orderChangeRequests)
    .set({ status: "approved", approvedBy, approvedAt: new Date() })
    .where(eq(orderChangeRequests.id, requestId));
}

/**
 * Reject an order change request — releases any reserved inventory.
 */
export async function rejectOrderChangeRequest(requestId: number, rejectedBy: string, reason?: string): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  // Release any reserved inventory
  await releaseInventory(requestId, "change_request");

  // Update request status
  await database.update(orderChangeRequests)
    .set({ status: "rejected", rejectedBy, rejectedAt: new Date(), rejectReason: reason || null })
    .where(eq(orderChangeRequests.id, requestId));
}

/**
 * V2.1.23: Mark a draft order as invalid — when the bound original order
 * has already been shipped/completed/cancelled and can no longer be modified.
 * This is NOT time-based expiry; it's a business-rule invalidation.
 */
export async function markDraftOrderInvalid(draftId: number, markedBy: string, reason?: string): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const [draft] = await database.select().from(draftOrders).where(eq(draftOrders.id, draftId)).limit(1);
  if (!draft) throw new Error("Draft order not found");
  if (draft.status !== "waiting_approval") throw new Error(`草稿订单状态为 ${draft.status}，无法标记为失效`);

  // Release reserved inventory
  await releaseInventory(draftId, "draft_order");

  await database.update(draftOrders)
    .set({ status: "invalid", rejectedBy: markedBy, rejectedAt: new Date(), rejectReason: reason || "原订单状态不允许修改" })
    .where(eq(draftOrders.id, draftId));
}

/**
 * V2.1.23: Mark an order change request as invalid — when the bound original order
 * has already been shipped/completed/cancelled and can no longer be modified.
 * This is NOT time-based expiry; it's a business-rule invalidation.
 */
export async function markOrderChangeRequestInvalid(requestId: number, markedBy: string, reason?: string): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const [request] = await database.select().from(orderChangeRequests).where(eq(orderChangeRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Change request not found");
  if (request.status !== "waiting_approval") throw new Error(`变更请求状态为 ${request.status}，无法标记为失效`);

  // Release reserved inventory
  await releaseInventory(requestId, "change_request");

  await database.update(orderChangeRequests)
    .set({ status: "invalid", rejectedBy: markedBy, rejectedAt: new Date(), rejectReason: reason || "原订单状态不允许修改" })
    .where(eq(orderChangeRequests.id, requestId));
}

// ===========================================================================
// AI Handover Summary — structured summary when transferring to human
// ===========================================================================

export interface HandoverSummary {
  customer: string;
  reason: string;
  detectedIntent: CaseIntent;
  customerMessage: string;
  relatedOrder?: { orderNumber: string; status: string };
  trackingStatus?: string;
  aiAction: string;
  suggestedNextAction: string;
  priority: "high" | "medium" | "normal";
}

/**
 * Generate a structured handover summary for AI-to-human transfer.
 */
export function generateHandoverSummary(params: {
  customerName: string;
  customerMessage: string;
  reason: string;
  detectedIntent: CaseIntent;
  aiAction: string;
  relatedOrder?: { orderNumber: string; status: string };
  trackingStatus?: string;
}): HandoverSummary {
  let priority: "high" | "medium" | "normal" = "normal";

  // Determine priority based on intent
  if (["parcel_issue", "complaint", "refund"].includes(params.detectedIntent)) {
    priority = "high";
  } else if (["new_order", "order_modification"].includes(params.detectedIntent)) {
    priority = "medium";
  }

  // Generate suggested next action
  let suggestedNextAction = "查看客户消息并回复";
  switch (params.detectedIntent) {
    case "parcel_issue":
      suggestedNextAction = "检查物流状态，联系快递公司处理包裹问题";
      break;
    case "complaint":
      suggestedNextAction = "了解投诉详情，提供解决方案或补偿";
      break;
    case "refund":
      suggestedNextAction = "确认退款原因，处理退款流程";
      break;
    case "cooperation":
      suggestedNextAction = "了解合作意向，转交相关负责人";
      break;
    case "order_modification":
      suggestedNextAction = "查看相关订单，确认变更请求是否可行";
      break;
    case "shipment_tracking":
      suggestedNextAction = "查询物流状态，回复客户包裹信息";
      break;
    default:
      suggestedNextAction = "查看客户消息并回复";
  }

  return {
    customer: params.customerName,
    reason: params.reason,
    detectedIntent: params.detectedIntent,
    customerMessage: params.customerMessage,
    relatedOrder: params.relatedOrder,
    trackingStatus: params.trackingStatus,
    aiAction: params.aiAction,
    suggestedNextAction,
    priority,
  };
}

// ===========================================================================
// AI Logistics — automatic shipping status query
// ===========================================================================

export async function queryOrderShipping(orderId: number): Promise<{
  found: boolean;
  trackingNumber?: string;
  shippingStatus?: string;
  delivered?: boolean;
  reply?: string;
}> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const [order] = await database.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { found: false };

  if (!order.trackingNumber) {
    return {
      found: true,
      reply: `您的订单 ${order.orderNumber} 尚未发货，请耐心等待。如有疑问请联系客服。`,
    };
  }

  // If order is already delivered
  if (order.physicalStatus === "completed") {
    return {
      found: true,
      trackingNumber: order.trackingNumber,
      shippingStatus: "已送达",
      delivered: true,
      reply: `您的订单 ${order.orderNumber} 已送达。追踪号：${order.trackingNumber}。`,
    };
  }

  // If shipped but not delivered
  if (order.physicalStatus === "shipped" || order.physicalStatus === "partial_shipped") {
    return {
      found: true,
      trackingNumber: order.trackingNumber,
      shippingStatus: "运输中",
      delivered: false,
      reply: `您的订单 ${order.orderNumber} 已发货，追踪号：${order.trackingNumber}，目前正在运输中。快递公司：${order.courierCompany || "未指定"}。`,
    };
  }

  return {
    found: true,
    trackingNumber: order.trackingNumber,
    reply: `您的订单 ${order.orderNumber} 追踪号：${order.trackingNumber}。`,
  };
}
