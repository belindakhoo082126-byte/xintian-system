import { appendItemsToUnpaidLocalOrder, applyTrustedSpecialPriceSnapshots, assertChinaImportOrderItemsEligible, assertImportLiveOrderWindow, cancelOrderWithReason, findMergeableUnpaidImportLiveOrder, findMergeableUnpaidLocalOrder, getActiveImportLiveRoomId, getDb, resolveOrderCategory, recalculateOrderBalance, generateOrderNumber, generateSecureToken } from "./db";
import { draftOrders, orderChangeRequests, reservationRecords, products, productVariations, variants, orders, orderItems, aiLogs, aiHandoverRequests } from "../drizzle/schema";
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

  // 先读取商品资料供错误与记录使用；真正的库存校验在下面的 UPDATE 条件中完成。
  // 不能依赖这一次读取决定是否可预留，否则两位客户同时私聊时会超卖。
  const [product] = await database.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) throw new Error(`Product ${productId} not found`);

  // 预留数量和正式库存占用共同决定可售数；允许超卖的商品保留原有例外逻辑。
  const updateResult = await database.update(products)
    .set({ reservedQuantity: sql`COALESCE(${products.reservedQuantity}, 0) + ${quantity}` })
    .where(and(
      eq(products.id, productId),
      sql`(${products.allowOversold} = true OR (COALESCE(${products.stockQuantity}, 0) - COALESCE(${products.reservedQuantity}, 0)) >= ${quantity})`,
    ));
  const affectedRows = Number((updateResult as any)?.[0]?.affectedRows ?? (updateResult as any)?.affectedRows ?? 0);
  if (affectedRows < 1) {
    const [current] = await database.select({ stockQuantity: products.stockQuantity, reservedQuantity: products.reservedQuantity })
      .from(products).where(eq(products.id, productId)).limit(1);
    const available = Math.max(0, Number(current?.stockQuantity ?? 0) - Number(current?.reservedQuantity ?? 0));
    throw new Error(`STOCK_INSUFFICIENT: ${product.name} 库存不足，目前最多可下单 ${available} 件`);
  }

  if (variantId) {
    const variantCondition = product.allowPresale || product.allowOversold
      ? and(eq(variants.id, variantId), eq(variants.productId, productId), eq(variants.status, "active"))
      : and(eq(variants.id, variantId), eq(variants.productId, productId), eq(variants.status, "active"), sql`${variants.stockQuantity} >= ${quantity}`);
    const variantResult = await database.update(variants)
      .set({ stockQuantity: sql`${variants.stockQuantity} - ${quantity}` })
      .where(variantCondition);
    const variantAffectedRows = Number((variantResult as any)?.[0]?.affectedRows ?? (variantResult as any)?.affectedRows ?? 0);
    if (variantAffectedRows < 1) {
      await database.update(products).set({
        reservedQuantity: sql`GREATEST(COALESCE(${products.reservedQuantity}, 0) - ${quantity}, 0)`,
      }).where(eq(products.id, productId));
      throw new Error(`STOCK_INSUFFICIENT: 商品「${product.name}」所选规格库存不足`);
    }
  }

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
      await database.update(products)
        .set({ reservedQuantity: sql`GREATEST(COALESCE(${products.reservedQuantity}, 0) - ${record.quantity}, 0)` })
        .where(eq(products.id, record.productId));
    }
    if (record.variantId) {
      await database.update(variants).set({
        stockQuantity: sql`${variants.stockQuantity} + ${record.quantity}`,
      }).where(eq(variants.id, record.variantId));
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
      // 将已预留数量转为正式订单占用；转换时同时减少库存与预留，
      // 后续“已发货”只转换统计，不可再次扣库存。
      await database.update(products)
        .set({
          stockQuantity: sql`GREATEST(COALESCE(${products.stockQuantity}, 0) - ${record.quantity}, 0)`,
          reservedQuantity: sql`GREATEST(COALESCE(${products.reservedQuantity}, 0) - ${record.quantity}, 0)`,
        })
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
  variantName?: string;
  priceType?: "retail" | "special";
  originalUnitPrice?: string | null;
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

  const trustedItems = params.items.map((item) => ({
    productId: item.productId,
    variationId: item.variantId,
    quantity: item.quantity,
    unitPrice: Number(item.price || 0).toFixed(2),
    subtotal: (Number(item.price || 0) * item.quantity).toFixed(2),
    priceType: item.priceType,
    originalUnitPrice: item.originalUnitPrice,
  }));
  await applyTrustedSpecialPriceSnapshots(database, trustedItems, { useProductSpecialPrice: true });
  params.items = params.items.map((item, index) => ({
    ...item,
    price: Number(trustedItems[index].unitPrice),
    priceType: trustedItems[index].priceType as "retail" | "special",
    originalUnitPrice: trustedItems[index].originalUnitPrice,
  }));

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
  let importLiveRoomId: number | null = null;
  if (orderCategory === "import") {
    await assertChinaImportOrderItemsEligible(productIds);
    importLiveRoomId = await getActiveImportLiveRoomId();
    await assertImportLiveOrderWindow(importLiveRoomId);
  }

  const mergeTarget = draft.customerId
    ? orderCategory === "import"
      ? await findMergeableUnpaidImportLiveOrder(draft.customerId, importLiveRoomId!)
      : await findMergeableUnpaidLocalOrder(draft.customerId)
    : null;
  if (mergeTarget) {
    const mergedOrder = await appendItemsToUnpaidLocalOrder({
      customerId: draft.customerId!,
      targetOrderId: mergeTarget.id,
      expectedOrderCategory: orderCategory,
      reserveStock: false,
      operationType: orderCategory === "import" ? "import_ai_merge" : "cross_channel_merge",
      operationBy: "AI／私聊",
      items: draftItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productType: "physical" as const,
        quantity: item.quantity,
        unitPrice: item.price.toFixed(2),
        subtotal: (item.price * item.quantity).toFixed(2),
        variationId: item.variantId || null,
        variationName: item.variantName || null,
        itemSource: "messenger" as const,
        salesMode: orderCategory === "import" ? "import_preorder" as const : "normal" as const,
        priceType: item.priceType || "retail",
        originalUnitPrice: item.originalUnitPrice || null,
      })),
    });
    await convertInventory(draftId, "draft_order");
    await database.update(draftOrders).set({
      status: "approved",
      approvedBy,
      approvedAt: new Date(),
      officialOrderId: mergeTarget.id,
    }).where(eq(draftOrders.id, draftId));
    return { orderId: mergedOrder.orderId, orderNumber: mergedOrder.orderNumber };
  }

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
    liveRoomId: importLiveRoomId,
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
      variationId: item.variantId || null,
      variationName: item.variantName || null,
      priceType: item.priceType || "retail",
      originalUnitPrice: item.originalUnitPrice || null,
      itemSource: "messenger",
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
  requestType: "add_item" | "remove_item" | "change_quantity" | "change_address" | "change_phone" | "change_variant" | "cancel_item" | "cancel_order" | "other";
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

  const [boundOrder] = await database.select().from(orders).where(eq(orders.id, request.orderId)).limit(1);
  if (!boundOrder) throw new Error("原订单不存在");
  if (["shipped", "completed", "cancelled", "partial_shipped"].includes(boundOrder.physicalStatus || "")) {
    throw new Error("原订单已进入不可修改状态，无法批准此变更请求");
  }

  const details = request.changeDetails as any;

  const restoreOrderItemStock = async (item: any, quantity: number) => {
    if (quantity <= 0) return;
    if (item.variationId) {
      await database.update(productVariations)
        .set({ stockQuantity: sql`COALESCE(${productVariations.stockQuantity}, 0) + ${quantity}` })
        .where(eq(productVariations.id, item.variationId));
    }
    if (item.productId) {
      await database.update(products)
        .set({ stockQuantity: sql`COALESCE(${products.stockQuantity}, 0) + ${quantity}` })
        .where(eq(products.id, item.productId));
    }
  };

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
        const [item] = await database.select().from(orderItems).where(and(eq(orderItems.id, details.orderItemId), eq(orderItems.orderId, request.orderId))).limit(1);
        if (!item) throw new Error("原订单中找不到要移除的商品");
        await restoreOrderItemStock(item, item.quantity);
        await database.delete(orderItems).where(eq(orderItems.id, details.orderItemId));
      }
      break;
    }
    case "change_quantity": {
      if (details.orderItemId && Number.isInteger(details.newQuantity) && details.newQuantity > 0) {
        const [item] = await database.select().from(orderItems).where(and(eq(orderItems.id, details.orderItemId), eq(orderItems.orderId, request.orderId))).limit(1);
        if (!item) throw new Error("原订单中找不到要修改数量的商品");
        const quantityChange = details.newQuantity - item.quantity;
        if (quantityChange < 0) await restoreOrderItemStock(item, Math.abs(quantityChange));
        await database.update(orderItems)
          .set({ quantity: details.newQuantity, subtotal: (Number(item.unitPrice) * details.newQuantity).toFixed(2) })
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
        const [item] = await database.select().from(orderItems).where(and(eq(orderItems.id, details.orderItemId), eq(orderItems.orderId, request.orderId))).limit(1);
        if (!item) throw new Error("原订单中找不到要取消的商品");
        await restoreOrderItemStock(item, item.quantity);
        await database.delete(orderItems).where(eq(orderItems.id, details.orderItemId));
      }
      break;
    }
    case "change_variant": {
      if (!details.orderItemId || !details.newVariationId) throw new Error("规格变更资料不完整");
      const [item] = await database.select().from(orderItems).where(and(eq(orderItems.id, details.orderItemId), eq(orderItems.orderId, request.orderId))).limit(1);
      if (!item) throw new Error("原订单中找不到要修改规格的商品");
      const [newVariation] = await database.select().from(productVariations)
        .where(and(eq(productVariations.id, details.newVariationId), eq(productVariations.productId, item.productId!))).limit(1);
      if (!newVariation) throw new Error("指定的新规格不存在或不属于该商品");
      const variantUpdate = await database.update(productVariations)
        .set({ stockQuantity: sql`COALESCE(${productVariations.stockQuantity}, 0) - ${item.quantity}` })
        .where(and(eq(productVariations.id, newVariation.id), sql`COALESCE(${productVariations.stockQuantity}, 0) >= ${item.quantity}`));
      const affectedRows = Number((variantUpdate as any)?.[0]?.affectedRows ?? (variantUpdate as any)?.affectedRows ?? 0);
      if (affectedRows < 1) throw new Error(`新规格「${newVariation.name}」库存不足，无法批准变更`);
      if (item.variationId) {
        await database.update(productVariations)
          .set({ stockQuantity: sql`COALESCE(${productVariations.stockQuantity}, 0) + ${item.quantity}` })
          .where(eq(productVariations.id, item.variationId));
      }
      const nextPrice = Number(details.newPrice ?? newVariation.price);
      await database.update(orderItems).set({
        variationId: newVariation.id,
        variationName: newVariation.name,
        unitPrice: nextPrice.toFixed(2),
        subtotal: (nextPrice * item.quantity).toFixed(2),
      }).where(eq(orderItems.id, item.id));
      break;
    }
    case "cancel_order": {
      await cancelOrderWithReason(request.orderId, details.reason || "客户通过 Messenger 申请取消订单", approvedBy);
      await database.update(orderChangeRequests)
        .set({ status: "approved", approvedBy, approvedAt: new Date() })
        .where(eq(orderChangeRequests.id, requestId));
      return;
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
