import { eq, ne, and, or, desc, asc, sql, gte, lte, lt, isNull, like, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  products, productVariations, productCategories,
  customers, orders, orderItems,
  membershipFeeReviews, messengerFlowTemplates, flowSteps,
  customerMergeSuggestions, flowSendLogs,
  suppliers, purchaseOrders, purchaseOrderItems,
  // Phase 1 imports
  categories, units, variants, memberLinks, productImages, productVideos, productAttributes,
  // System Settings & Shipping imports
  systemSettings, shippingRules, shippingProviders, shipments,
  // Payment & Order imports
  paymentMethods, orderStatusLogs, holdOrderInfos, notificationLogs, aiNotificationActions,
  // Mall imports
  mallSettings, mallBanners, mallQuickContacts, mallNotices, mallThemeSchedules, mallProductDetailImages,
  // Packing & Shipping imports
  packages, packageItems, packageOrderLinks, liveOrderCaptures,
  // V1.1 imports
  orderItemRepots, orderRemarks,
  // V1.2 imports
  orderExceptions, orderExceptionItems, orderExceptionReplacements, inventoryAdjustments,
  orderSubOrders, specialOrderActions,
  // V2.0 imports
  liveRooms, importBatches, importBatchItems, cnChangeLogs, cnExpiryRunLogs, importBatchChangeLogs,
  // V2.0 Phase 2 imports - Live Room Products
  liveRoomProducts,
  // V2.0 Phase 2.5 imports - Live AI Flows
  liveAiFlows,
  liveComments,
  // V2.0 imports - Live Comment Notes (Staff Note)
  liveCommentNotes,
  // V3.1 imports - Product Bundles
  productBundles, productBundleItems, bundleStockLogs,
  // V2.1 imports - Order Payments & Operation Logs
  orderPayments, orderOperationLogs,
  // V4.0 imports - AI Customer Service (Chat & Handover)
  chatConversations, chatMessages, aiHandoverRequests,
  // V4.1 imports - AI Brain Phase 2 (AI Logs)
  aiLogs, aiLogDeliveryAttempts,
  // V4.2 imports - AI Brain Phase 2 Task 2 (AI Test Center)
  aiTestRuns, aiKnowledge,
  // V4.3 imports - AI Brain Phase 2 Task 5 (Regression Test & AI Version)
  regressionSets, regressionQuestions, regressionRuns, regressionRunDetails, aiVersions,
  // V2.0.21 imports - Facebook Campaign Module
  campaigns, campaignFlows, campaignButtons, campaignContentIds,
  // V2.0 imports - Reservation Records
  reservationRecords,
  // V2.0.43 imports - Order sequence counter
  orderSeq,
  // V2.0.78 imports - Customer Credit Ledger
  customerCreditLedger,
  // V2.0.98 imports - CN/IB enhancements
  ibDifferences, stockAllocations, costAdjustmentLogs,
  // V2.1.15 imports - Order Refunds
  orderRefunds, orderRefundItems,
  // V2.1.19 imports - Order Special Statuses
  orderSpecialStatuses,
  // V5.0 imports - Marketing Center
  marketingCampaigns, marketingRules, marketingRuleScopes,
  marketingOrderApplications, marketingCampaignUsages,
  marketingLotteryPrizes, marketingLotteryEntries, marketingLotteryDraws,
  marketingSegments, marketingMessageTemplates, marketingAutomationRules,
  marketingMessageDeliveries, marketingMessageEvents,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { broadcastChange, broadcastChanges } from './_core/realtime';
import { evaluateMarketingCampaign } from './marketingEngine';
import { SPECIAL_ORDER_FOLLOW_UP_TYPES, isSpecialOrderFollowUpType } from '../shared/specialOrderDisplay';
import { WEST_MALAYSIA_V22_SHIPPING } from '../shared/shippingV22';
import { calculateMerchandiseNotificationBreakdown, calculateOrderPriceBreakdown } from "../shared/orderPricing";

let _db: ReturnType<typeof drizzle> | null = null;

export async function executeRaw(query: any) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return await db.execute(query);
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Normalizes mysql2/Drizzle raw execute results. mysql2 returns `[rows, fields]`,
 * while some callers may already provide a plain row array.
 */
export function unwrapMySqlRows<T = Record<string, unknown>>(result: unknown): T[] {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? (result[0] as T[]) : (result as T[]);
}

// ============================================================================
// User helpers (existing)
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// Product helpers
// ============================================================================

export async function getProducts(filters?: { type?: string; search?: string; isListed?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(products);
  const conditions: any[] = [];
  if (filters?.type) conditions.push(eq(products.type, filters.type as any));
  if (filters?.isListed !== undefined) conditions.push(eq(products.isListed, filters.isListed));
  if (filters?.search) {
    // V2.2: Enhanced search - include variation name and variation keyword via subquery
    const searchTerm = `%${filters.search}%`;
    // First find product IDs that have matching variations
    const variationMatches = await db.select({ productId: productVariations.productId })
      .from(productVariations)
      .where(or(
        like(productVariations.name, searchTerm),
        like(productVariations.keywords, searchTerm)
      ) as any);
    const matchedProductIds = variationMatches.map(v => v.productId);
    
    conditions.push(or(
      like(products.name, searchTerm),
      like(products.sku, searchTerm),
      like(products.keyword, searchTerm),
      ...(matchedProductIds.length > 0 ? [inArray(products.id, matchedProductIds) as any] : [])
    ) as any);
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return await query.orderBy(desc(products.createdAt));
}

export function isChinaImportOrderEligibleProduct(product: {
  salesMode?: string | null;
  orderCategory?: string | null;
  allowImportOrder?: boolean | null;
}) {
  return product.salesMode === "import_preorder"
    || product.orderCategory === "import"
    || Boolean(product.allowImportOrder);
}

/**
 * 中国代购订单只允许中国进口代购商品，或已明确授权的本地配套商品。此服务层校验用于
 * 后台建单、AI建单与商城加单，不能只依赖前端筛选。
 */
export async function assertChinaImportOrderItemsEligible(productIds: number[]) {
  const uniqueIds = Array.from(new Set(productIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (uniqueIds.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db.select({
    id: products.id,
    name: products.name,
    salesMode: products.salesMode,
    orderCategory: products.orderCategory,
    allowImportOrder: products.allowImportOrder,
  }).from(products)
    .where(inArray(products.id, uniqueIds));

  const foundIds = new Set(rows.map((row) => row.id));
  const missing = uniqueIds.filter((id) => !foundIds.has(id));
  const disallowed = rows.filter((row) => !isChinaImportOrderEligibleProduct(row));
  if (missing.length > 0 || disallowed.length > 0) {
    const names = disallowed.map((row) => row.name).join("、");
    throw new Error(`中国代购订单只可选择“中国进口代购”模式商品，以及已开启“允许进入中国代购订单”的本地配套商品${names ? `；不可加入：${names}` : ""}`);
  }
}

export async function getProductsForOrder(filters?: { search?: string; orderCategory?: string }) {
  const productRows = await getProducts({ search: filters?.search });
  if (filters?.orderCategory !== "import" || productRows.length === 0) return productRows;
  const db = await getDb();
  if (!db) return [];
  const categoryRows = await db.select({
    id: products.id,
    salesMode: products.salesMode,
    orderCategory: products.orderCategory,
    allowImportOrder: products.allowImportOrder,
  }).from(products)
    .where(inArray(products.id, productRows.map((product) => product.id)));
  const eligibleIds = new Set(categoryRows.filter(isChinaImportOrderEligibleProduct).map((row) => row.id));
  return productRows.filter((product) => eligibleIds.has(product.id));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(data: typeof products.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return result;
}

export async function updateProduct(id: number, data: Partial<typeof products.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(products).where(eq(products.id, id));
}

// ============================================================================
// Customer helpers
// ============================================================================

export async function getCustomers(search?: string) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(customers);
  if (search) {
    // V2.1.17: Phone normalize — strip spaces, dashes, brackets, and convert +60 to 0
    const normalizedSearch = normalizePhone(search);
    const conditions = [
      like(customers.name, `%${search}%`),
      like(customers.facebookName, `%${search}%`),
      like(customers.phoneNumber, `%${search}%`),
      like(customers.email, `%${search}%`),
      like(customers.facebookId, `%${search}%`),
      like(customers.messengerId, `%${search}%`),
      like(customers.customerId, `%${search}%`),
      like(customers.displayName, `%${search}%`),
      like(customers.whatsappPhone, `%${search}%`),
    ];
    // Also search with normalized phone if it differs from original
    if (normalizedSearch !== search) {
      conditions.push(like(customers.phoneNumber, `%${normalizedSearch}%`));
      conditions.push(like(customers.whatsappPhone, `%${normalizedSearch}%`));
    }
    query = query.where(or(...conditions)) as any;
  }
  return await query.orderBy(desc(customers.createdAt));
}

/**
 * V2.1.17: Normalize Malaysian phone number for search.
 * Strips spaces, dashes, brackets, and converts +60 prefix to 0.
 * Examples: "+60 12-345 6789" → "0123456789", "6012-3456789" → "0123456789"
 */
export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s\-()\[\]]/g, '');
  // Convert +60 or 60 prefix to 0 (Malaysian format)
  if (normalized.startsWith('+60')) {
    normalized = '0' + normalized.slice(3);
  } else if (normalized.startsWith('60') && normalized.length >= 10) {
    normalized = '0' + normalized.slice(2);
  }
  return normalized;
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function findOrCreateCustomer(data: {
  facebookId?: string;
  facebookName?: string;
  messengerId?: string;
  name?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  shopLinkIdentifier?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Try to find by facebookId first
  if (data.facebookId) {
    const existing = await db.select().from(customers)
      .where(eq(customers.facebookId, data.facebookId)).limit(1);
    if (existing.length > 0 && !existing[0].mergedIntoCustomerId) {
      return existing[0];
    }
  }

  // Try messengerId
  if (data.messengerId) {
    const existing = await db.select().from(customers)
      .where(eq(customers.messengerId, data.messengerId)).limit(1);
    if (existing.length > 0 && !existing[0].mergedIntoCustomerId) {
      return existing[0];
    }
  }

  // Try phone number
  if (data.phoneNumber) {
    const existing = await db.select().from(customers)
      .where(eq(customers.phoneNumber, data.phoneNumber)).limit(1);
    if (existing.length > 0 && !existing[0].mergedIntoCustomerId) {
      return existing[0];
    }
  }

  // Create new. The deployed customers table requires a durable customerId.
  const customerId = `C${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const result = await db.insert(customers).values({
    customerId,
    displayName: data.name || data.facebookName || customerId,
    customerSource: "admin",
    facebookId: data.facebookId || null,
    facebookName: data.facebookName || null,
    messengerId: data.messengerId || null,
    name: data.name || null,
    phoneNumber: data.phoneNumber || null,
    email: data.email || null,
    address: data.address || null,
    city: data.city || null,
    state: data.state || null,
    postalCode: data.postalCode || null,
    country: data.country || null,
    shopLinkIdentifier: data.shopLinkIdentifier || null,
  });
  const inserted = await db.select().from(customers)
    .where(eq(customers.id, (result as any)[0].insertId)).limit(1);
  return inserted[0];
}

export async function updateCustomer(id: number, data: Partial<typeof customers.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function getCustomerOrders(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    orderType: orders.orderType,
    orderCategory: orders.orderCategory,
    importStatus: orders.importStatus,
    totalAmount: orders.totalAmount,
    paidAmount: orders.paidAmount,
    physicalStatus: orders.physicalStatus,
    membershipStatus: orders.membershipStatus,
    shippingMethod: orders.shippingMethod,
    trackingNumber: orders.trackingNumber,
    createdAt: orders.createdAt,
  }).from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt));
  return result;
}

export async function findPotentialDuplicateCustomers(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  const target = await getCustomerById(customerId);
  if (!target) return [];

  const conditions: any[] = [];
  if (target.facebookId) conditions.push(eq(customers.facebookId, target.facebookId));
  if (target.messengerId) conditions.push(eq(customers.messengerId, target.messengerId));
  if (target.phoneNumber) conditions.push(eq(customers.phoneNumber, target.phoneNumber));
  if (target.email) conditions.push(eq(customers.email, target.email));

  if (conditions.length === 0) return [];

  const results = await db.select().from(customers)
    .where(and(
      or(...conditions),
      ne(customers.id, customerId),
      isNull(customers.mergedIntoCustomerId)
    ));
  return results;
}

/**
 * Calculates a merge impact without writing data. The UI uses this snapshot
 * before presenting the irreversible customer merge confirmation.
 */
export async function getCustomerMergePreview(sourceId: number, targetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (sourceId === targetId) throw new Error("来源客户与主客户不可相同");

  const [source, target] = await Promise.all([
    getCustomerById(sourceId),
    getCustomerById(targetId),
  ]);
  if (!source || !target) throw new Error("Customer not found");
  if (source.mergedIntoCustomerId) throw new Error("副客户已合并，不能再次合并");
  if (target.mergedIntoCustomerId) throw new Error("主客户已合并，不能作为保留客户");

  const [orderCountRows, ledgerCountRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.customerId, sourceId)),
    db.select({ count: sql<number>`count(*)` }).from(customerCreditLedger).where(eq(customerCreditLedger.customerId, sourceId)),
  ]);
  const sourceCredit = parseFloat(String(source.creditBalance || "0"));
  const targetCredit = parseFloat(String(target.creditBalance || "0"));
  const sourceSpent = parseFloat(String(source.totalSpent || "0"));
  const targetSpent = parseFloat(String(target.totalSpent || "0"));

  return {
    source: {
      id: source.id,
      name: source.name || source.facebookName || `客户 #${source.id}`,
      phoneNumber: source.phoneNumber || null,
      creditBalance: sourceCredit.toFixed(2),
      totalSpent: sourceSpent.toFixed(2),
    },
    target: {
      id: target.id,
      name: target.name || target.facebookName || `客户 #${target.id}`,
      phoneNumber: target.phoneNumber || null,
      creditBalance: targetCredit.toFixed(2),
      totalSpent: targetSpent.toFixed(2),
    },
    transfer: {
      orderCount: Number(orderCountRows[0]?.count || 0),
      creditLedgerCount: Number(ledgerCountRows[0]?.count || 0),
      creditBalance: sourceCredit.toFixed(2),
    },
    result: {
      creditBalance: (sourceCredit + targetCredit).toFixed(2),
      totalSpent: (sourceSpent + targetSpent).toFixed(2),
      totalOrders: (source.totalOrders || 0) + (target.totalOrders || 0),
    },
  };
}

export async function mergeCustomers(sourceId: number, targetId: number, staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const preview = await getCustomerMergePreview(sourceId, targetId);

  // Get both customers to merge data
  const [source, target] = await Promise.all([
    getCustomerById(sourceId),
    getCustomerById(targetId),
  ]);
  if (!source || !target) throw new Error("Customer not found");

  // Merge Credit balances: target gets sum of both
  const sourceCredit = parseFloat(String(source.creditBalance || "0"));
  const targetCredit = parseFloat(String(target.creditBalance || "0"));
  const mergedCredit = sourceCredit + targetCredit;

  // Merge totalOrders and totalSpent
  const sourceOrders = source.totalOrders || 0;
  const targetOrders = target.totalOrders || 0;
  const sourceSpent = parseFloat(String(source.totalSpent || "0"));
  const targetSpent = parseFloat(String(target.totalSpent || "0"));

  // Fill missing fields on target from source (don't overwrite existing data)
  const mergedData: Record<string, any> = {
    creditBalance: mergedCredit.toFixed(2),
    totalOrders: sourceOrders + targetOrders,
    totalSpent: (sourceSpent + targetSpent).toFixed(2),
  };
  if (!target.facebookId && source.facebookId) mergedData.facebookId = source.facebookId;
  if (!target.facebookName && source.facebookName) mergedData.facebookName = source.facebookName;
  if (!target.messengerId && source.messengerId) mergedData.messengerId = source.messengerId;
  if (!target.name && source.name) mergedData.name = source.name;
  if (!target.phoneNumber && source.phoneNumber) mergedData.phoneNumber = source.phoneNumber;
  if (!target.whatsappPhone && source.whatsappPhone) mergedData.whatsappPhone = source.whatsappPhone;
  if (!target.email && source.email) mergedData.email = source.email;
  if (!target.address && source.address) mergedData.address = source.address;
  if (!target.city && source.city) mergedData.city = source.city;
  if (!target.state && source.state) mergedData.state = source.state;
  if (!target.postalCode && source.postalCode) mergedData.postalCode = source.postalCode;
  if (!target.country && source.country) mergedData.country = source.country;
  if (!target.displayName && source.displayName) mergedData.displayName = source.displayName;
  // If target is blacklisted, keep it blacklisted
  if (source.isBlacklisted && !target.isBlacklisted) {
    mergedData.isBlacklisted = true;
    mergedData.blacklistReason = source.blacklistReason || "Merged from another account";
  }

  // Update target customer with merged data
  await db.update(customers).set(mergedData).where(eq(customers.id, targetId));

  // Write Credit Ledger record for the merge transfer
  if (sourceCredit > 0) {
    await db.insert(customerCreditLedger).values({
      customerId: targetId,
      type: "admin_add",
      amount: sourceCredit.toFixed(2),
      balanceAfter: mergedCredit.toFixed(2),
      reason: `合并客户 #${sourceId} 的 Credit 转入`,
      performedBy: `Admin #${staffId}`,
      createdAt: new Date(),
    });
  }

  // Move all orders from source to target
  await db.update(orders).set({ customerId: targetId }).where(eq(orders.customerId, sourceId));

  // Move all credit ledger entries from source to target
  await db.update(customerCreditLedger).set({ customerId: targetId }).where(eq(customerCreditLedger.customerId, sourceId));

  // Mark source as merged
  await db.update(customers).set({ mergedIntoCustomerId: targetId }).where(eq(customers.id, sourceId));

  // Update merge suggestion
  await db.update(customerMergeSuggestions).set({
    status: "approved",
    reviewedByStaffId: staffId,
    reviewedAt: new Date(),
  }).where(or(
    and(eq(customerMergeSuggestions.customerAId, sourceId), eq(customerMergeSuggestions.customerBId, targetId)),
    and(eq(customerMergeSuggestions.customerAId, targetId), eq(customerMergeSuggestions.customerBId, sourceId))
  ));

  return {
    success: true,
    source: preview.source,
    target: preview.target,
    transfer: preview.transfer,
    result: preview.result,
  };
}

// V2.0.81: Get customer timeline — combines orders, credit ledger, blacklist changes, and merge events
export async function getCustomerTimeline(customerId: number) {
  const db = await getDb();
  if (!db) return [];

  const events: Array<{
    type: string;
    title: string;
    description: string;
    amount: string | null;
    orderId: number | null;
    orderNumber: string | null;
    operatorName: string | null;
    createdAt: Date;
  }> = [];

  // 1. Orders
  const customerOrders = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    totalAmount: orders.totalAmount,
    physicalStatus: orders.physicalStatus,
    membershipStatus: orders.membershipStatus,
    orderSource: orders.orderSource,
    createdAt: orders.createdAt,
  }).from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));

  for (const o of customerOrders) {
    // V2.0.85: Determine order source for accurate timeline description
    const source = o.orderSource || 'manual';
    const sourceLabel = source === 'facebook_live' || source === 'facebook_post' || source === 'facebook_reel' || source === 'messenger' ? '直播捉单' : source === 'store' ? '商城下单' : 'Admin 建立订单';
    events.push({
      type: "order",
      title: `${sourceLabel} ${o.orderNumber}`,
      description: `订单金额: RM ${o.totalAmount || "0"} | 状态: ${o.physicalStatus || o.membershipStatus || "-"}`,
      amount: String(o.totalAmount || "0"),
      orderId: o.id,
      orderNumber: o.orderNumber,
      operatorName: source === 'manual' ? 'Admin' : source === 'store' ? '客户' : 'System',
      createdAt: o.createdAt,
    });
  }

  // 2. Credit ledger
  const ledger = await db.select().from(customerCreditLedger)
    .where(eq(customerCreditLedger.customerId, customerId))
    .orderBy(desc(customerCreditLedger.createdAt));

  for (const l of ledger) {
    const creditType = l.type === "admin_add" ? "增加 Credit" : l.type === "admin_deduct" ? "扣除 Credit" : l.type === "order_use" ? "扣除 Credit" : l.type === "order_refund" ? "退回 Credit" : "Credit 变动";
    const creditDesc = l.orderNumber ? `原因：${l.reason || "-"}（订单 ${l.orderNumber}）` : `原因：${l.reason || "-"}`;
    events.push({
      type: "credit",
      title: creditType,
      description: creditDesc,
      amount: l.amount,
      orderId: l.orderId || null,
      orderNumber: l.orderNumber || null,
      operatorName: l.performedBy || (l.type === "order_use" ? "System" : l.type === "order_refund" ? "System" : "Admin"),
      createdAt: l.createdAt,
    });
  }

  // 3. Customer creation (V2.0.85: changed to activity record)
  const customer = await getCustomerById(customerId);
  if (customer) {
    events.push({
      type: "customer_created",
      title: "客户资料建立",
      description: `客户: ${customer.name || customer.facebookName || customer.displayName || "-"}`,
      amount: null,
      orderId: null,
      orderNumber: null,
      operatorName: "System",
      createdAt: customer.createdAt,
    });

    // 4. Blacklist events (V2.0.85: activity record format)
    if (customer.isBlacklisted && customer.blacklistAt) {
      events.push({
        type: "blacklist",
        title: "客户加入 Black List",
        description: customer.blacklistReason ? `原因：${customer.blacklistReason}` : "",
        amount: null,
        orderId: null,
        orderNumber: null,
        operatorName: "Admin",
        createdAt: customer.blacklistAt,
      });
    }
    if (!customer.isBlacklisted && customer.unblacklistAt) {
      events.push({
        type: "blacklist",
        title: "解除 Black List",
        description: "恢复正常",
        amount: null,
        orderId: null,
        orderNumber: null,
        operatorName: "Admin",
        createdAt: customer.unblacklistAt,
      });
    }
  }

  // Sort all events by date descending
  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return events;
}

export async function getMergeSuggestions(status?: string) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(customerMergeSuggestions);
  if (status) query = query.where(eq(customerMergeSuggestions.status, status as any)) as any;
  return await query.orderBy(desc(customerMergeSuggestions.createdAt));
}

// ============================================================================
// Order helpers
// ============================================================================

export async function getOrders(filters?: {
  physicalStatus?: string;
  importStatus?: string;
  membershipStatus?: string;
  orderType?: string;
  search?: string;
  todayOnly?: boolean;
  orderNature?: string;
  orderCategory?: string;
  isSpecialOrder?: boolean;
  specialOrderStatus?: string;
  specialOrderType?: string;
  salesChannel?: string;
  hasRemark?: boolean;
  notificationStatus?: string;
  crossChannelMergeToday?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];
  // V2.1.07: LEFT JOIN customers to return customerName for order list display
  // Use raw select to avoid TypeScript issues with spreading table columns
  let query = db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    customerId: orders.customerId,
    facebookName: orders.facebookName,
    facebookId: orders.facebookId,
    messengerId: orders.messengerId,
    orderType: orders.orderType,
    orderCategory: (orders as any).orderCategory,
    importStatus: (orders as any).importStatus,
    physicalStatus: orders.physicalStatus,
    membershipStatus: orders.membershipStatus,
    totalAmount: orders.totalAmount,
    paidAmount: orders.paidAmount,
    shippingAddress: orders.shippingAddress,
    shippingMethod: orders.shippingMethod,
    trackingNumber: orders.trackingNumber,
    orderNature: (orders as any).orderNature,
    orderSource: (orders as any).orderSource,
    sourceName: orders.sourceName,
    salesChannel: (orders as any).salesChannel,
    isSpecialOrder: (orders as any).isSpecialOrder,
    specialOrderStatus: (orders as any).specialOrderStatus,
    specialOrderType: (orders as any).specialOrderType,
    specialOrderReason: (orders as any).specialOrderReason,
    notificationStatus: orders.notificationStatus,
    notificationSentAt: orders.notificationSentAt,
    recipientName: orders.recipientName,
    recipientPhone: orders.recipientPhone,
    recipientCity: orders.recipientCity,
    recipientState: orders.recipientState,
    recipientPostcode: orders.recipientPostcode,
    recipientCountry: orders.recipientCountry,
    discountAmount: (orders as any).discountAmount,
    discountReason: (orders as any).discountReason,
    extraCharge: (orders as any).extraCharge,
    extraChargeDescription: (orders as any).extraChargeDescription,
    creditUsed: orders.creditUsed,
    totalWeight: orders.totalWeight,
    scheduledShippingDate: (orders as any).scheduledShippingDate,
    liveRoomId: (orders as any).liveRoomId,
    createdAt: orders.createdAt,
    customerName: customers.name,
    customerPhone: customers.phoneNumber,
    checkoutLink: orders.checkoutLink,
  }).from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id)) as any;
  const conditions: any[] = [];
  // XTC 合单是否可发生，已经由各下单入口的直播截止日期和商品范围守卫处理。
  // Dashboard 只读取实际写入的追加审计事件，避免以当前截止时间反推历史事件而改变统计。
  const dashboardMergeOperationTypes = [
    "cross_channel_merge",
    "import_ai_merge",
    "import_manual_merge",
    "import_mall_merge",
    "import_live_merge",
  ] as const;
  let todayCrossChannelMergeLogs: Array<{
    orderId: number;
    operationType: string;
    description: string | null;
    changes: string | null;
    operator: string | null;
    createdAt: Date;
  }> | null = null;
  if (filters?.physicalStatus) conditions.push(eq(orders.physicalStatus, filters.physicalStatus as any));
  if (filters?.importStatus) conditions.push(eq((orders as any).importStatus, filters.importStatus as any));
  if (filters?.membershipStatus) conditions.push(eq(orders.membershipStatus, filters.membershipStatus as any));
  if (filters?.orderType) conditions.push(eq(orders.orderType, filters.orderType as any));
  if (filters?.orderNature) conditions.push(eq((orders as any).orderNature, filters.orderNature as any));
  if (filters?.orderCategory) conditions.push(eq((orders as any).orderCategory, filters.orderCategory as any));
  if (filters?.isSpecialOrder !== undefined) conditions.push(eq((orders as any).isSpecialOrder, filters.isSpecialOrder ? 1 : 0));
  if (filters?.specialOrderStatus) conditions.push(eq((orders as any).specialOrderStatus, filters.specialOrderStatus as any));
  if (filters?.specialOrderType && filters.specialOrderType !== "all") conditions.push(eq((orders as any).specialOrderType, filters.specialOrderType as any));
  if (filters?.salesChannel) conditions.push(eq((orders as any).salesChannel, filters.salesChannel as any));
  if (filters?.notificationStatus && filters.notificationStatus !== "all") {
    if (filters.notificationStatus === "unsent") {
      conditions.push(or(eq(orders.notificationStatus, "pending"), sql`${orders.notificationStatus} IS NULL`) as any);
    } else {
      conditions.push(eq(orders.notificationStatus, filters.notificationStatus as any));
    }
  }
  if (filters?.hasRemark !== undefined) {
    const remarkRows = await db.select({ orderId: orderRemarks.orderId }).from(orderRemarks);
    const remarkOrderIds = Array.from(new Set(remarkRows.map(r => r.orderId)));
    if (filters.hasRemark) {
      if (remarkOrderIds.length === 0) return [];
      conditions.push(inArray(orders.id, remarkOrderIds) as any);
    } else {
      if (remarkOrderIds.length > 0) {
        conditions.push(sql`${orders.id} NOT IN (${sql.join(remarkOrderIds.map(id => sql`${id}`), sql`, `)})`);
      }
    }
  }
  if (filters?.todayOnly) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    conditions.push(gte(orders.createdAt, today));
  }
  if (filters?.crossChannelMergeToday) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    todayCrossChannelMergeLogs = await db.select({
      orderId: orderOperationLogs.orderId,
      operationType: orderOperationLogs.operationType,
      description: orderOperationLogs.description,
      changes: orderOperationLogs.changes,
      operator: orderOperationLogs.operator,
      createdAt: orderOperationLogs.createdAt,
    }).from(orderOperationLogs).where(and(
      inArray(orderOperationLogs.operationType, dashboardMergeOperationTypes as any),
      gte(orderOperationLogs.createdAt, today),
      lt(orderOperationLogs.createdAt, tomorrow),
    ));
    const mergedOrderIds = Array.from(new Set(todayCrossChannelMergeLogs.map((log) => log.orderId)));
    if (mergedOrderIds.length === 0) return [];
    conditions.push(inArray(orders.id, mergedOrderIds) as any);
  }
  if (filters?.search) {
    conditions.push(or(
      like(orders.orderNumber, `%${filters.search}%`),
      like(orders.facebookName, `%${filters.search}%`),
      like(orders.trackingNumber, `%${filters.search}%`),
      like(orders.sourceName, `%${filters.search}%`),
      like(orders.facebookId, `%${filters.search}%`),
      like(orders.messengerId, `%${filters.search}%`)
    ));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  const result = await query.orderBy(desc(orders.createdAt));
  if (!todayCrossChannelMergeLogs) return result;

  return result.map((order: any) => ({
    ...order,
    crossChannelMergeDetails: todayCrossChannelMergeLogs!
      .filter((log) => log.orderId === order.id)
      .map((log) => {
        let changes: { addedAmount?: string | number; items?: Array<{ quantity?: number; unitPrice?: string | number; itemSource?: string }> } = {};
        try {
          changes = JSON.parse(log.changes || "{}") || {};
        } catch {
          // Historical malformed audit payloads remain visible through the
          // original description, while amount and source fall back safely.
        }
        const fallbackAmount = (changes.items || []).reduce(
          (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
          0,
        );
        return {
          mergedAt: log.createdAt,
          mergeOperationType: log.operationType,
          addedAmount: (Number(changes.addedAmount ?? fallbackAmount) || 0).toFixed(2),
          addedSources: Array.from(new Set((changes.items || []).map((item) => item.itemSource).filter(Boolean))),
          itemSummary: log.description || "-",
          operator: log.operator || "-",
        };
      })
      .sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime()),
  }));
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  // V2.0.85: JOIN customers table to get customerPhone and creditBalance
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (result.length === 0) return undefined;

  const order = result[0];
  // V2.0.85: Fetch customer info separately for display
  const [customer] = await db.select({
    customerName: customers.name,
    customerPhone: customers.phoneNumber,
    customerEmail: customers.email,
    creditBalance: customers.creditBalance,
  }).from(customers).where(eq(customers.id, order.customerId)).limit(1);
  if (customer) {
    (order as any).customerName = customer.customerName;
    (order as any).customerPhone = customer.customerPhone;
    (order as any).customerEmail = customer.customerEmail;
    (order as any).creditBalance = customer.creditBalance;
  }
  // 兼容旧订单：管理员第一次打开详情时，自动补齐安全令牌和真实可访问的结单路径。
  // 使用 try-catch 防止 update 失败导致整个查询失败（如 unique 约束冲突等）
  const secureToken = order.secureToken || generateSecureToken();
  const checkoutLink = `/order/${order.orderNumber}/${secureToken}`;
  if (!order.secureToken || order.checkoutLink !== checkoutLink) {
    try {
      await db.update(orders).set({ secureToken, checkoutLink }).where(eq(orders.id, id));
    } catch (updateErr) {
      console.warn("[getOrderById] Failed to update secureToken/checkoutLink:", updateErr);
    }
  }
  const refunds = await db.select({
    id: orderRefunds.id,
    refundNumber: orderRefunds.refundNumber,
    status: orderRefunds.status,
    amount: orderRefunds.amount,
    requestedAmount: orderRefunds.requestedAmount,
    refundMethod: orderRefunds.refundMethod,
    processedAt: orderRefunds.processedAt,
  }).from(orderRefunds).where(eq(orderRefunds.orderId, id)).orderBy(desc(orderRefunds.createdAt));
  const detailItems = await db.select({
    id: orderItems.id,
    quantity: orderItems.quantity,
    unitPrice: orderItems.unitPrice,
    unitCost: orderItems.unitCost,
    subtotal: orderItems.subtotal,
  }).from(orderItems).where(eq(orderItems.orderId, id));
  const refundLineItems = refunds.length
    ? await db.select().from(orderRefundItems).where(inArray(orderRefundItems.refundId, refunds.map((refund) => refund.id)))
    : [];
  return { ...order, secureToken, checkoutLink, refunds, refundProfit: buildRefundProfitSummary(detailItems, refunds, refundLineItems) };
}

export async function getOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  // V2.0.34: JOIN products table to get imageUrl for order detail display
  const result = await db.select({
    id: orderItems.id,
    orderId: orderItems.orderId,
    productId: orderItems.productId,
    productName: orderItems.productName,
    productSku: orderItems.productSku,
    productType: orderItems.productType,
    variationId: orderItems.variationId,
    variationName: orderItems.variationName,
    facebookKeyword: orderItems.facebookKeyword,
    quantity: orderItems.quantity,
    unitPrice: orderItems.unitPrice,
    discount: orderItems.discount,
    subtotal: orderItems.subtotal,
    unitWeight: orderItems.unitWeight,
    itemSource: orderItems.itemSource,
    salesMode: orderItems.salesMode,
    priceType: orderItems.priceType,
    unitCost: orderItems.unitCost,
    originalUnitPrice: orderItems.originalUnitPrice,
    createdAt: orderItems.createdAt,
    productImage: products.coverImageUrl,
  }).from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId));
  return result;
}

// V2.0.43: Generate sequential order number (XT00001, XT00002, ...)
export async function generateOrderNumber(prefix: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Atomically get and increment the sequence number
  const [row] = await db.select().from(orderSeq).where(eq(orderSeq.prefix, prefix)).limit(1);
  let nextNum = 1;
  if (row) {
    nextNum = row.nextNumber;
    await db.update(orderSeq).set({ nextNumber: nextNum + 1 }).where(eq(orderSeq.prefix, prefix));
  } else {
    await db.insert(orderSeq).values({ prefix, nextNumber: 2 });
  }
  // Format with 5-digit zero-padded number
  return `${prefix}${String(nextNum).padStart(5, "0")}`;
}

// V2.1: Unified order category resolver — determines whether an order should be local (XT) or import (XTC).
// A local accessory with allowImportOrder remains XT by default. It can only
// enter an XTC order when the caller supplies an existing XTC order or an
// active China-import live context; the separate item-eligibility assertion
// then prevents unapproved local goods from entering XTC.
export async function resolveOrderCategory(opts: {
  productIds?: number[];
  existingOrderCategory?: string;
  liveType?: string;
}): Promise<"local" | "import"> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Priority 1: Any China-import product makes the
  // order an XTC order; inspecting only the first row would incorrectly route
  // a cart containing local accessories plus an import item into XT.
  if (opts.productIds && opts.productIds.length > 0) {
    const productRows = await db
      .select({ orderCategory: products.orderCategory })
      .from(products)
      .where(inArray(products.id, Array.from(new Set(opts.productIds))));
    if (productRows.some((row) => row.orderCategory === "import")) {
      return "import";
    }
  }

  // Priority 2: A verified existing XTC order remains XTC. Its caller must
  // still pass assertChinaImportOrderItemsEligible before appending items.
  if (opts.existingOrderCategory === "import") return "import";
  if (opts.existingOrderCategory === "local") return "local";

  // Priority 3: A China-import live provides the controlled XTC context for
  // authorised local accessories such as fertilizer and pots.
  if (opts.liveType === "import_preorder") return "import";

  // Every other context, including normal mall / AI / private-chat checkout,
  // remains a local XT order even if a product is eligible for XTC.
  return "local";
}

/**
 * Returns the newest local XT order that may safely receive items from any
 * sales channel. A candidate is deliberately narrower than a generic
 * "open" order: it must still be genuinely unpaid, without an uploaded or
 * pending payment proof, and must not have entered packing / fulfilment.
 *
 * XTC orders are never returned here. Their merge eligibility remains tied to
 * the selected China-import live window and is handled by the import flow.
 */
export async function findMergeableUnpaidLocalOrder(customerId: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = unwrapMySqlRows<any>(await db.execute(sql`
    SELECT o.*
    FROM orders o
    WHERE o.customerId = ${customerId}
      AND o.orderCategory = 'local'
      AND o.physicalStatus IN ('pending', 'hold_order')
      AND COALESCE(o.paidAmount, 0) = 0
      AND o.receiptUrl IS NULL
      AND o.paymentUploadedAt IS NULL
      AND o.paymentConfirmedAt IS NULL
      AND COALESCE(o.cancelProtection, 0) = 0
      AND NOT EXISTS (
        SELECT 1
        FROM order_payments op
        WHERE op.orderId = o.id
          AND op.reviewStatus IN ('pending', 'approved')
      )
    ORDER BY o.createdAt DESC, o.id DESC
    LIMIT 1
  `));

  return rows[0] ?? null;
}

/** China-import orders can only accept new items while their own import live window is open. */
export async function assertImportLiveOrderWindow(liveRoomId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!liveRoomId) throw new Error("XTC 中国代购订单必须来自已设定期限的中国代购直播间");

  const room = await db.select({
    id: liveRooms.id,
    liveType: liveRooms.liveType,
    preorderStartDate: liveRooms.preorderStartDate,
    preorderEndDate: liveRooms.preorderEndDate,
    liveStartTime: liveRooms.liveStartTime,
    liveEndTime: liveRooms.liveEndTime,
  }).from(liveRooms).where(eq(liveRooms.id, liveRoomId)).limit(1);
  const importRoom = room[0];
  if (!importRoom || importRoom.liveType !== "import_preorder") {
    throw new Error("XTC 中国代购订单只能在中国代购直播间建立");
  }
  const start = importRoom.preorderStartDate || importRoom.liveStartTime;
  const end = importRoom.preorderEndDate || importRoom.liveEndTime;
  if (!start || !end) throw new Error("该中国代购直播尚未设定开始日期或截止日期，不能下单");
  const now = new Date();
  if (now < new Date(start) || now > new Date(end)) {
    throw new Error("中国代购订单仅可在该直播的开始日期至截止日期期间下单");
  }
}

/** Resolves the only China-import live window that is open now for non-live channels. */
export async function getActiveImportLiveRoomId(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rooms = await db.select({
    id: liveRooms.id,
    preorderStartDate: liveRooms.preorderStartDate,
    preorderEndDate: liveRooms.preorderEndDate,
    liveStartTime: liveRooms.liveStartTime,
    liveEndTime: liveRooms.liveEndTime,
  }).from(liveRooms).where(eq(liveRooms.liveType, "import_preorder"));
  const now = new Date();
  const active = rooms.filter((room) => {
    const start = room.preorderStartDate || room.liveStartTime;
    const end = room.preorderEndDate || room.liveEndTime;
    return Boolean(start && end && now >= new Date(start) && now <= new Date(end));
  });
  if (active.length !== 1) {
    throw new Error(active.length === 0
      ? "目前没有处于开始日期至截止日期内的中国代购直播，无法建立 XTC 订单"
      : "目前有多个中国代购直播窗口重叠，请由直播间明确建立 XTC 订单");
  }
  return active[0].id;
}

export async function findMergeableUnpaidImportLiveOrder(customerId: number, liveRoomId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = unwrapMySqlRows<any>(await db.execute(sql`
    SELECT o.*
    FROM orders o
    WHERE o.customerId = ${customerId}
      AND o.orderCategory = 'import'
      AND o.liveRoomId = ${liveRoomId}
      AND o.physicalStatus IN ('pending', 'hold_order')
      AND COALESCE(o.paidAmount, 0) = 0
      AND o.receiptUrl IS NULL
      AND o.paymentUploadedAt IS NULL
      AND o.paymentConfirmedAt IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM order_payments op
        WHERE op.orderId = o.id AND op.reviewStatus IN ('pending', 'approved')
      )
    ORDER BY o.createdAt DESC, o.id DESC
    LIMIT 1
  `));
  return rows[0] ?? null;
}

type LocalOrderMergeItem = {
  productId: number;
  productName: string;
  productSku?: string | null;
  productType?: "physical" | "membership" | "gift";
  quantity: number;
  unitPrice: string;
  subtotal: string;
  variationId?: number | null;
  variationName?: string | null;
  facebookKeyword?: string | null;
  discount?: string | null;
  itemSource: "admin" | "facebook_live" | "messenger" | "mall";
  salesMode?: "normal" | "presale" | "import_preorder";
  priceType?: "retail" | "wholesale" | "agent" | "special" | "manual";
  unitCost?: string | null;
  originalUnitPrice?: string | null;
};

/**
 * Appends channel-specific item snapshots to an already validated unpaid XT
 * order, reusing the existing stock reservation and price-breakdown rules.
 * The function never changes the target order's source, receipt, payment or
 * address fields; every appended item keeps its originating channel instead.
 */
export async function appendItemsToUnpaidLocalOrder(params: {
  customerId: number;
  targetOrderId: number;
  expectedOrderCategory?: "local" | "import";
  items: LocalOrderMergeItem[];
  operationType: string;
  operationBy: string;
  reserveStock?: boolean;
  allocateFifoCost?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Recheck at write time. A payment upload, approval or packing transition
  // between candidate lookup and this call must turn the operation into a new
  // order rather than silently changing a paid / fulfilment order.
  const target = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    secureToken: orders.secureToken,
    customerId: orders.customerId,
    orderCategory: orders.orderCategory,
    physicalStatus: orders.physicalStatus,
    paidAmount: orders.paidAmount,
    receiptUrl: orders.receiptUrl,
    paymentUploadedAt: orders.paymentUploadedAt,
    paymentConfirmedAt: orders.paymentConfirmedAt,
    cancelProtection: orders.cancelProtection,
    membershipSubtotal: orders.membershipSubtotal,
    promotionDiscount: orders.promotionDiscount,
    discountAmount: orders.discountAmount,
    extraCharge: orders.extraCharge,
    creditUsed: orders.creditUsed,
    shippingMethod: orders.shippingMethod,
    totalAmount: orders.totalAmount,
  }).from(orders).where(eq(orders.id, params.targetOrderId)).limit(1);
  const order = target[0];
  const expectedCategory = params.expectedOrderCategory || "local";
  if (!order
    || order.customerId !== params.customerId
    || order.orderCategory !== expectedCategory
    || !["pending", "hold_order"].includes(order.physicalStatus || "pending")
    || Number(order.paidAmount || 0) !== 0
    || order.receiptUrl
    || order.paymentUploadedAt
    || order.paymentConfirmedAt
    || order.cancelProtection) {
    throw new Error("目标 XT 订单已不符合未汇款自动合并条件");
  }
  const paymentProofs = await db.select({ id: orderPayments.id }).from(orderPayments)
    .where(and(
      eq(orderPayments.orderId, params.targetOrderId),
      inArray(orderPayments.reviewStatus, ["pending", "approved"]),
    )).limit(1);
  if (paymentProofs.length > 0) {
    throw new Error("目标 XT 订单已有付款凭证或已确认付款，不能自动合并");
  }

  const stockItems = params.items
    .filter((item) => (item.productType || "physical") === "physical")
    .map((item) => ({ productId: item.productId, quantity: item.quantity }));
  if (params.reserveStock !== false && stockItems.length > 0) {
    await reserveProductStocksForOrder(stockItems);
  }

  for (const item of params.items) {
    await db.insert(orderItems).values({
      orderId: params.targetOrderId,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku || null,
      productType: item.productType || "physical",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      variationId: item.variationId || null,
      variationName: item.variationName || null,
      facebookKeyword: item.facebookKeyword || null,
      discount: item.discount || "0.00",
      itemSource: item.itemSource,
      salesMode: item.salesMode || "normal",
      priceType: item.priceType || "retail",
      unitCost: item.unitCost || "0.00",
      originalUnitPrice: item.originalUnitPrice || null,
    });
    if (params.allocateFifoCost && item.productId && (item.productType || "physical") === "physical") {
      await allocateFifoCostForSale({
        orderId: params.targetOrderId,
        productId: item.productId,
        quantity: item.quantity,
        createdBy: params.operationBy,
      });
    }
  }

  const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, params.targetOrderId));
  const breakdown = calculateOrderPriceBreakdown(allItems, {
    promotionDiscount: order.promotionDiscount,
    discountAmount: order.discountAmount,
  });
  const totalWeight = allItems
    .filter((item) => item.productType === "physical" || item.productType === "gift")
    .reduce((sum, item) => sum + (Number(item.unitWeight || 0) || 0.5) * Number(item.quantity || 0), 0);
  const membershipSubtotal = Number(order.membershipSubtotal || 0);
  const promotionDiscount = Number(order.promotionDiscount || 0);
  const discountAmount = Number(order.discountAmount || 0);
  const extraCharge = Number(order.extraCharge || 0);
  const creditUsed = Number(order.creditUsed || 0);
  let shippingFee = 0;
  if (order.shippingMethod === "west_malaysia") {
    shippingFee = calculateWestMalaysiaShipping(totalWeight, breakdown.freeShippingEligibleSubtotal).shippingFee;
  } else if (order.shippingMethod === "east_malaysia_poslaju") {
    shippingFee = 50;
  } else if (order.shippingMethod === "lalamove") {
    shippingFee = breakdown.freeShippingEligibleSubtotal >= 150 ? 0 : 15;
  }
  const totalAmount = breakdown.physicalSubtotal + membershipSubtotal - promotionDiscount - discountAmount + extraCharge + shippingFee - creditUsed;

  await db.update(orders).set({
    physicalSubtotal: breakdown.physicalSubtotal.toFixed(2),
    shippingFee: shippingFee.toFixed(2),
    customerPaidShipping: shippingFee.toFixed(2),
    totalWeight: totalWeight.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
  }).where(eq(orders.id, params.targetOrderId));
  await logOrderOperation(
    params.targetOrderId,
    params.operationType,
    `${params.operationBy} 自动合单：${params.items.map((item) => `${item.productName} ×${item.quantity}`).join("、")}`,
    JSON.stringify({
      items: params.items.map((item) => ({ productId: item.productId, quantity: item.quantity, itemSource: item.itemSource, unitPrice: item.unitPrice })),
      addedAmount: params.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0).toFixed(2),
      totalBefore: order.totalAmount,
      totalAfter: totalAmount.toFixed(2),
    }),
    params.operationBy,
  );
  broadcastChanges(["orders", "inventory", "dashboard", "customers"]);

  return {
    orderId: params.targetOrderId,
    orderNumber: order.orderNumber,
    secureToken: order.secureToken,
    totalAmount: totalAmount.toFixed(2),
  };
}

/**
 * Atomically reserves physical-product stock for an order.  The stock check is
 * intentionally part of the UPDATE condition instead of a separate read, so
 * concurrent orders cannot both consume the final available units.
 */
export async function reserveProductStocksForOrder(items: Array<{ productId: number; quantity: number }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const requested = new Map<number, number>();
  for (const item of items) {
    if (!item.productId) continue;
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("STOCK_INSUFFICIENT: 商品数量必须大于 0");
    }
    requested.set(item.productId, (requested.get(item.productId) || 0) + quantity);
  }

  const reserved: Array<{ productId: number; quantity: number }> = [];
  try {
    for (const [productId, quantity] of Array.from(requested.entries())) {
      const result = await db.update(products).set({
        stockQuantity: sql`${products.stockQuantity} - ${quantity}`,
      }).where(and(
        eq(products.id, productId),
        or(
        eq(products.allowPresale, true),
        eq(products.allowOversold, true),
          and(
            or(eq(products.allowOversold, false), isNull(products.allowOversold)),
            // 未转换的 AI 草稿也已经占用可售数，正式订单不可绕过它们。
            // 该条件位于同一条 UPDATE 内，避免直播／商城并发请求穿透库存。
            sql`${products.stockQuantity} - COALESCE(${products.reservedQuantity}, 0) >= ${quantity}`,
          ),
        ),
      ));

      const affectedRows = Number((result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? 0);
      if (affectedRows < 1) {
        const current = await db.select({ name: products.name, stockQuantity: products.stockQuantity, reservedQuantity: products.reservedQuantity })
          .from(products).where(eq(products.id, productId)).limit(1);
        const productName = current[0]?.name || `商品 #${productId}`;
        const available = Math.max(0, Number(current[0]?.stockQuantity ?? 0) - Number(current[0]?.reservedQuantity ?? 0));
        throw new Error(`STOCK_INSUFFICIENT: ${productName} 库存不足，目前最多可下单 ${available} 件`);
      }
      reserved.push({ productId, quantity });
    }
  } catch (error) {
    // If a later product cannot be reserved, release all earlier reservations
    // so this failed request never leaves a partial inventory hold.
    for (const item of reserved) {
      await db.update(products).set({
        stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
      }).where(eq(products.id, item.productId));
    }
    throw error;
  }
}

type SpecialPriceSnapshotItem = {
  productId: number;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  priceType?: string;
  originalUnitPrice?: string | null;
  isSpecial?: boolean;
  bundleId?: number;
};

/**
 * Browser payloads are only a shopping selection, not a source of truth for
 * price type. Refresh every regular item from the product master so special
 * prices are consistently excluded from the RM150 free-shipping threshold.
 */
async function applyTrustedSpecialPriceSnapshots(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  items: SpecialPriceSnapshotItem[],
  options: { useProductSpecialPrice?: boolean } = {},
) {
  const productIds = items
    .filter((item) => item.productId && !item.bundleId)
    .map((item) => item.productId);
  if (productIds.length === 0) return;

  const uniqueProductIds = Array.from(new Set(productIds));
  const productRows = await db
    .select({
      id: products.id,
      isSpecial: products.isSpecial,
      specialPrice: products.specialPrice,
      sellingPrice: products.sellingPrice,
    })
    .from(products)
    .where(inArray(products.id, uniqueProductIds));
  const productsById = new Map(productRows.map((product) => [product.id, product]));

  for (const item of items) {
    if (item.bundleId) continue;
    const product = productsById.get(item.productId);
    const specialPrice = Number(product?.specialPrice ?? 0);
    const isActiveSpecialPrice = Boolean(product?.isSpecial) && specialPrice > 0;
    item.priceType = isActiveSpecialPrice ? "special" : "retail";
    item.isSpecial = isActiveSpecialPrice;
    item.originalUnitPrice = isActiveSpecialPrice && product?.sellingPrice != null
      ? String(product.sellingPrice)
      : null;

    if (isActiveSpecialPrice && options.useProductSpecialPrice) {
      item.unitPrice = specialPrice.toFixed(2);
      item.subtotal = (specialPrice * item.quantity).toFixed(2);
    }
  }
}

export async function createOrderWithSplit(data: {
  customerId: number;
  facebookName?: string;
  facebookId?: string;
  messengerId?: string;
  items: Array<{
    productId: number;
    productName: string;
    productType: "physical" | "membership" | "gift";
    quantity: number;
    unitPrice: string;
    subtotal: string;
    variationId?: number;
    variationName?: string;
    priceType?: string;
    unitCost?: string;
    originalUnitPrice?: string;
    isSpecial?: boolean;
  }>;
  shippingAddress?: string;
  shippingMethod?: string;
  paymentMethodId?: number;
  paymentMethodName?: string;
  orderNature?: string;
  orderSource?: string;
  orderCategory?: string;
  sourceName?: string;
  liveRoomId?: number;
  // V2.2: Promotion / discount / extra charge / credit
  promotionId?: number;
  promotionName?: string;
  promotionDiscount?: string;
  discountAmount?: string;
  discountReason?: string;
  extraCharge?: string;
  extraChargeDescription?: string;
  creditUsed?: string;
  // V2.2: Recipient info
  recipientName?: string;
  recipientPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Physical products reserve stock atomically immediately before the order is
  // created. A separate read is not safe when multiple users order at once.
  const physicalItems = data.items.filter(i => i.productType === "physical");

  // Physical and gift items both go through the physical order flow
  // Gift items have price=0 but still count toward shipping weight and free-shipping threshold
  const hasPhysical = data.items.some(i => i.productType === "physical" || i.productType === "gift");
  const hasMembership = data.items.some(i => i.productType === "membership");
  const orderType = hasPhysical && hasMembership ? "mixed" : hasMembership ? "membership" : "physical";
  // V2.1.04: Use resolveOrderCategory for unified routing — product orderCategory takes priority
  if (!data.orderCategory) {
    const productIds = data.items.map(i => i.productId).filter(Boolean) as number[];
    data.orderCategory = await resolveOrderCategory({ productIds });
  }
  if (data.orderCategory === "import") {
    await assertChinaImportOrderItemsEligible(data.items.map((item) => item.productId));
    data.liveRoomId = data.liveRoomId || await getActiveImportLiveRoomId();
    await assertImportLiveOrderWindow(data.liveRoomId);
  }

  await applyTrustedSpecialPriceSnapshots(db, data.items);

  const mergeTarget = data.orderCategory === "import"
    ? await findMergeableUnpaidImportLiveOrder(data.customerId, data.liveRoomId!)
    : await findMergeableUnpaidLocalOrder(data.customerId);
  if (mergeTarget) {
    const itemSource = data.orderSource === "facebook_live"
      ? "facebook_live"
      : data.orderSource === "mall" || data.orderSource === "store"
        ? "mall"
        : data.orderSource === "ai" || data.orderSource === "private_chat" || data.orderSource === "messenger" || data.orderSource === "post"
          ? "messenger"
          : "admin";
    const mergedOrder = await appendItemsToUnpaidLocalOrder({
      customerId: data.customerId,
      targetOrderId: mergeTarget.id,
      expectedOrderCategory: data.orderCategory as "local" | "import",
      operationType: data.orderCategory === "import" ? "import_manual_merge" : "cross_channel_merge",
      operationBy: data.orderSource || "后台建单",
      allocateFifoCost: true,
      items: data.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productType: item.productType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        variationId: item.variationId || null,
        variationName: item.variationName || null,
        itemSource,
        salesMode: data.orderCategory === "import" ? "import_preorder" : "normal",
        priceType: (item.priceType as any) || "retail",
        unitCost: item.unitCost || "0",
        originalUnitPrice: item.originalUnitPrice || null,
      })),
    });
    return { ...mergedOrder, creditUsed: "0.00", creditRemaining: (await getCustomerById(data.customerId))?.creditBalance?.toString() || "0.00", merged: true };
  }

  // V2.2: Calculate shipping using new West Malaysia rules
  let shippingFee = 0;
  const promotionDiscountNum = parseFloat(data.promotionDiscount || "0");
  const discountAmountNum = parseFloat(data.discountAmount || "0");
  const extraChargeNum = parseFloat(data.extraCharge || "0");
  const creditUsedNum = parseFloat(data.creditUsed || "0");
  const priceBreakdown = calculateOrderPriceBreakdown(data.items, {
    promotionDiscount: promotionDiscountNum,
    discountAmount: discountAmountNum,
  });
  const { physicalSubtotal, membershipSubtotal, freeShippingEligibleSubtotal } = priceBreakdown;
  
  if (hasPhysical && data.shippingMethod === "west_malaysia") {
    const totalWeight = data.items
      .filter(i => i.productType === "physical" || i.productType === "gift")
      .reduce((sum, i) => sum + 0.5 * i.quantity, 0);
    const shipResult = calculateWestMalaysiaShipping(totalWeight, freeShippingEligibleSubtotal);
    shippingFee = shipResult.shippingFee;
  } else if (hasPhysical && data.shippingMethod === "east_malaysia_poslaju") {
    // V2.0.80: 东马 PosLaju 预收 RM50（2kg 内），打包后 API 计算实际运费
    shippingFee = 50;
  } else if (hasPhysical && data.shippingMethod === "east_malaysia_shopee") {
    // V2.0.84: 东马 Shopee 运费固定 RM0
    shippingFee = 0;
  } else if (hasPhysical && data.shippingMethod === "lalamove") {
    // V2.0.84: Lalamove — 满 RM150 公司承担，未满收 RM15
    shippingFee = freeShippingEligibleSubtotal >= 150 ? 0 : 15;
  }

  // V2.0.78: Auto-deduct credit from customer balance (no manual input)
  // Read customer's current credit balance
  const customer = await getCustomerById(data.customerId);
  if (!customer) throw new Error("Customer not found");
  const customerCreditBalance = parseFloat(customer.creditBalance?.toString() || "0");
  // Auto-calculate credit used: min(available credit, pre-credit total)
  const preCreditTotal = physicalSubtotal + membershipSubtotal - promotionDiscountNum - discountAmountNum + extraChargeNum + shippingFee;
  const autoCreditUsed = Math.min(customerCreditBalance, Math.max(0, preCreditTotal));
  const autoCreditUsedStr = autoCreditUsed.toFixed(2);

  // V2.2: Total = 商品小计 - 促销优惠 - 人工折扣 + 额外收费 + 运费 - 使用Credit
  const totalAmount = preCreditTotal - autoCreditUsed;
  
  // V2.0.99: Generate sequential order number with XT/XTC prefix (XT00001, XTC00001)
  if (physicalItems.length > 0) {
    await reserveProductStocksForOrder(physicalItems);
  }
  const prefix = data.orderCategory === "import" ? "XTC" : "XT";
  const orderNumber = await generateOrderNumber(prefix);
  const secureToken = generateSecureToken();
  const checkoutLink = `/order/${orderNumber}/${secureToken}`;

  const orderResult = await db.insert(orders).values({
    orderNumber,
    secureToken,
    checkoutLink,
    customerId: data.customerId,
    facebookName: data.facebookName || null,
    facebookId: data.facebookId || null,
    messengerId: data.messengerId || null,
    orderType: orderType as any,
    physicalSubtotal: physicalSubtotal.toFixed(2),
    membershipSubtotal: membershipSubtotal.toFixed(2),
    shippingFee: shippingFee.toFixed(2),
    customerPaidShipping: shippingFee.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    physicalStatus: "pending",
    importStatus: data.orderCategory === "import" ? "pending" : null,
    membershipStatus: hasMembership ? "pending" : undefined,
    shippingAddress: data.shippingAddress || null,
    shippingMethod: (data.shippingMethod as any) || null,
    paymentMethodId: (data.paymentMethodId as any) || null,
    paymentMethodName: (data.paymentMethodName as any) || null,
    orderNature: (data.orderNature as any) || "retail",
    orderSource: (data.orderSource as any) || "manual",
    orderCategory: (data.orderCategory as any) || "local",
    sourceName: data.sourceName || null,
    liveRoomId: data.liveRoomId || null,
    // V2.2: Promotion / discount / extra charge / credit
    promotionId: data.promotionId || null,
    promotionName: data.promotionName || null,
    promotionDiscount: data.promotionDiscount || null,
    extraCharge: data.extraCharge || null,
    extraChargeDescription: data.extraChargeDescription || null,
    creditUsed: autoCreditUsedStr,
    discountAmount: data.discountAmount || null,
    discountReason: data.discountReason || null,
    // V2.0.85: Save recipient info on order
    recipientName: data.recipientName || null,
    recipientPhone: data.recipientPhone || null,
    // V2.1.29: Save structured address fields on order
    addressLine1: data.addressLine1 || null,
    addressLine2: data.addressLine2 || null,
    postcode: data.postcode || null,
    recipientCity: data.city || null,
    recipientState: data.state || null,
    recipientPostcode: data.postcode || null,
    recipientCountry: data.country || null,
  });

    const orderId = (orderResult as any)[0].insertId;
  // Log operation
  await logOrderOperation(orderId, "create", `Order created with ${data.items.length} items`, null, null);

    // Insert order items
  for (const item of data.items) {
    await db.insert(orderItems).values({
      orderId,
      productId: item.productId,
      productName: item.productName,
      productType: item.productType as any,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      variationId: item.variationId || null,
      variationName: item.variationName || null,
      priceType: (item.priceType as any) || "retail",
      unitCost: item.unitCost || "0",
      originalUnitPrice: item.originalUnitPrice || null,
    });
    // Stock was atomically reserved before the order was created.
    if (item.productType === "physical" && item.productId) {
      await allocateFifoCostForSale({ orderId, productId: item.productId, quantity: item.quantity, createdBy: "admin" });
    }
  }
  // V2.0.78: Auto-deduct credit from customer and write ledger
  if (autoCreditUsed > 0) {
    await useCustomerCredit(data.customerId, autoCreditUsed, orderId, orderNumber);
  }

  // V2.1.29: Auto-sync address to customer profile — always update when address is provided
  const hasOrderAddress = data.shippingAddress || data.addressLine1 || data.city;
  if (hasOrderAddress) {
    const syncAddress = data.addressLine1 || data.shippingAddress || null;
    await db.update(customers).set({
      address: syncAddress,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      state: data.state || null,
      postalCode: data.postcode || null,
      postcode: data.postcode || null,
      country: data.country || null,
    }).where(eq(customers.id, data.customerId));
  }

  // Update customer stats
  await db.update(customers).set({
    totalOrders: sql`${customers.totalOrders} + 1`,
    totalSpent: sql`${customers.totalSpent} + ${totalAmount.toFixed(2)}`,
    lastOrderAt: new Date(),
  }).where(eq(customers.id, data.customerId));

  broadcastChanges(["orders", "inventory", "dashboard", "customers"]);
  return { orderId, orderNumber, totalAmount: totalAmount.toFixed(2), creditUsed: autoCreditUsedStr, creditRemaining: (customerCreditBalance - autoCreditUsed).toFixed(2) };
}

export async function updateOrderStatus(id: number, data: {
  physicalStatus?: string;
  membershipStatus?: string;
  courierCompany?: string;
  trackingNumber?: string;
  receiptUrl?: string;
  paymentMethodId?: number;
  paymentMethodName?: string;
  paidAmount?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = {};
  if (data.physicalStatus) updateData.physicalStatus = data.physicalStatus;
  if (data.membershipStatus) updateData.membershipStatus = data.membershipStatus;
  if (data.courierCompany !== undefined) updateData.courierCompany = data.courierCompany;
  if (data.trackingNumber !== undefined) updateData.trackingNumber = data.trackingNumber;
  if (data.receiptUrl !== undefined) updateData.receiptUrl = data.receiptUrl;
  if (data.paymentMethodId !== undefined) updateData.paymentMethodId = data.paymentMethodId;
  if (data.paymentMethodName !== undefined) updateData.paymentMethodName = data.paymentMethodName;
  if (data.paidAmount !== undefined) updateData.paidAmount = data.paidAmount;

  if (data.physicalStatus === "receipt_uploaded") updateData.paymentUploadedAt = new Date();
  // payment_confirmed is deprecated; use packing for confirmed payments
if (data.physicalStatus === "packing") updateData.paymentConfirmedAt = new Date();
  if (data.physicalStatus === "shipped") updateData.shippedAt = new Date();
  if (data.physicalStatus === "completed") updateData.completedAt = new Date();

  // For import orders, sync importStatus with physicalStatus changes
  const existingOrder = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (existingOrder.length > 0 && existingOrder[0].orderCategory === 'import') {
    const importStatusMap: Record<string, string> = {
      'unpaid': 'pending',           // 挂单
      'receipt_uploaded': 'receipt_uploaded', // 待审核付款凭证
      'partial_payment': 'partial_payment', // 部分汇款
      'packing': 'ready_to_ship',    // 待发货 (payment confirmed → ready to ship)
      'partial_shipped': 'partial_shipped', // 部分发货
      'shipped': 'shipped',          // 已发货
      'completed': 'completed',      // 已完成
      'cancelled': 'cancelled',      // 取消
    };
    const mappedImportStatus = data.physicalStatus ? importStatusMap[data.physicalStatus] : undefined;
    if (mappedImportStatus) {
      updateData.importStatus = mappedImportStatus;
    }
  }

  await db.update(orders).set(updateData).where(eq(orders.id, id));

  // Log status change
  const oldOrder = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (oldOrder.length > 0) {
    await logOrderOperation(id, "status_change", `Status changed to ${data.physicalStatus || data.membershipStatus}`, null, null);
  }

    broadcastChanges(["orders", "dashboard"]);
}
// V2.0.33: Update order notification status
export async function updateOrderNotificationStatus(orderId: number, status: "pending" | "sent" | "failed", error: string | null) {
  const db = await getDb();
  if (!db) return;
  const updateData: any = { notificationStatus: status };
  if (status === "sent") {
    updateData.notificationSentAt = new Date();
    updateData.notificationError = null;
  } else if (status === "failed") {
    updateData.notificationError = error;
  }
  await db.update(orders).set(updateData).where(eq(orders.id, orderId));
  broadcastChanges(["orders"]);
}
// ============================================================================
// V2.2: Update order details (for OrderEditPage)
// ============================================================================

export async function updateOrderDetails(id: number, data: {
  shippingAddress?: string;
  shippingMethod?: string;
  orderNature?: string;
  orderSource?: string;
  orderCategory?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientCity?: string;
  recipientState?: string;
  recipientPostcode?: string;
  recipientCountry?: string;
  discountAmount?: string;
  discountReason?: string;
  extraCharge?: string;
  extraChargeDescription?: string;
  // V2.0.78: creditUsed is now read-only (auto-calculated, not editable)
  promotionId?: number;
  promotionName?: string;
  promotionDiscount?: string;
  shippingFee?: string;
  totalAmount?: string;
  physicalStatus?: string;
  importStatus?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const currentOrder = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const existingOrder = currentOrder[0];
  const effectiveShippingMethod = data.shippingMethod ?? existingOrder?.shippingMethod;
  // Walk-in is a local self-pickup flow. Never allow a manual edit to restore
  // a delivery charge, and keep China import orders on their own shipping rules.
  const isWalkInSelfPickup = existingOrder?.orderCategory !== "import" && effectiveShippingMethod === "self_pickup";
  const updateData: any = {};
  if (data.shippingAddress !== undefined) updateData.shippingAddress = data.shippingAddress;
  if (data.shippingMethod !== undefined) updateData.shippingMethod = data.shippingMethod;
  if (data.orderNature !== undefined) updateData.orderNature = data.orderNature;
  if (data.orderSource !== undefined) updateData.orderSource = data.orderSource;
  if (data.orderCategory !== undefined) updateData.orderCategory = data.orderCategory;
  if (data.recipientName !== undefined) updateData.recipientName = data.recipientName;
  if (data.recipientPhone !== undefined) updateData.recipientPhone = data.recipientPhone;
  // V2.1.20: Save structured recipient address fields
  if (data.recipientCity !== undefined) updateData.recipientCity = data.recipientCity;
  if (data.recipientState !== undefined) updateData.recipientState = data.recipientState;
  if (data.recipientPostcode !== undefined) updateData.recipientPostcode = data.recipientPostcode;
  if (data.recipientCountry !== undefined) updateData.recipientCountry = data.recipientCountry;
  if (data.discountAmount !== undefined) updateData.discountAmount = data.discountAmount;
  if (data.discountReason !== undefined) updateData.discountReason = data.discountReason;
  if (data.extraCharge !== undefined) updateData.extraCharge = data.extraCharge;
  if (data.extraChargeDescription !== undefined) updateData.extraChargeDescription = data.extraChargeDescription;
  // V2.0.78: creditUsed is read-only, no longer updated from admin edits
  if (data.promotionId !== undefined) updateData.promotionId = data.promotionId;
  if (data.promotionName !== undefined) updateData.promotionName = data.promotionName;
  if (data.promotionDiscount !== undefined) updateData.promotionDiscount = data.promotionDiscount;
  if (isWalkInSelfPickup) {
    updateData.shippingMethod = "self_pickup";
    updateData.shippingFee = "0.00";
    updateData.customerPaidShipping = "0.00";
    const physicalSubtotal = Number(existingOrder?.physicalSubtotal || "0");
    const membershipSubtotal = Number(existingOrder?.membershipSubtotal || "0");
    const promotionDiscount = Number(data.promotionDiscount ?? existingOrder?.promotionDiscount ?? "0");
    const discountAmount = Number(data.discountAmount ?? existingOrder?.discountAmount ?? "0");
    const extraCharge = Number(data.extraCharge ?? existingOrder?.extraCharge ?? "0");
    const creditUsed = Number(existingOrder?.creditUsed || "0");
    updateData.totalAmount = (physicalSubtotal + membershipSubtotal - promotionDiscount - discountAmount + extraCharge - creditUsed).toFixed(2);
  } else {
    if (data.shippingFee !== undefined) updateData.shippingFee = data.shippingFee;
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
  }
  if (data.physicalStatus !== undefined) {
    updateData.physicalStatus = data.physicalStatus;
    if (data.physicalStatus === "receipt_uploaded") updateData.paymentUploadedAt = new Date();
    if (data.physicalStatus === "packing") updateData.paymentConfirmedAt = new Date();
    if (data.physicalStatus === "shipped") updateData.shippedAt = new Date();
    if (data.physicalStatus === "completed") updateData.completedAt = new Date();
  }
  if (data.importStatus !== undefined) {
    updateData.importStatus = data.importStatus;
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(orders).set(updateData).where(eq(orders.id, id));
    // Logging is handled by the routers.ts procedure to avoid duplicate entries
  }

  broadcastChanges(["orders", "dashboard"]);
  return { success: true };
}

// V2.0.92: Update order items (add/edit/delete) with auto recalculation and timeline logging
export async function updateOrderItems(orderId: number, items: Array<{
  id?: number;
  productId?: number | null;
  productName: string;
  productSku?: string | null;
  quantity: number;
  unitPrice: string;
  variationId?: number | null;
  variationName?: string | null;
  itemSource?: string;
  priceType?: string;
  originalUnitPrice?: string | null;
}>, operator?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get current order info for recalculation
  const target = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    physicalStatus: orders.physicalStatus,
    totalAmount: orders.totalAmount,
    membershipSubtotal: orders.membershipSubtotal,
    promotionDiscount: orders.promotionDiscount,
    discountAmount: orders.discountAmount,
    extraCharge: orders.extraCharge,
    creditUsed: orders.creditUsed,
    shippingMethod: orders.shippingMethod,
  }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!target[0]) throw new Error("Order not found");
  const prevTotal = target[0].totalAmount;

  // Get current items for diff logging
  const oldItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const oldItemsMap = new Map(oldItems.map((i: any) => [i.id, i]));

  // Track changes for timeline
  const changes: string[] = [];
  const newItems = items.filter(i => !i.id);
  const updatedItems = items.filter(i => i.id && oldItemsMap.has(i.id));
  const deletedItems = oldItems.filter((i: any) => !items.some(ni => ni.id === i.id));

  // New rows added from the order editor must follow the same trusted special
  // price snapshot path as all new orders. The UI can suggest a price, but it
  // may not decide whether a product is eligible for RM150 free shipping.
  const specialSnapshotCandidates: Array<SpecialPriceSnapshotItem & { source: (typeof newItems)[number] }> = newItems
    .filter((item) => typeof item.productId === "number" && item.productId > 0)
    .map((item) => ({
      source: item,
      productId: item.productId!,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
    }));
  if (specialSnapshotCandidates.length > 0) {
    await applyTrustedSpecialPriceSnapshots(db, specialSnapshotCandidates);
    for (const candidate of specialSnapshotCandidates) {
      candidate.source.priceType = candidate.priceType;
      candidate.source.originalUnitPrice = candidate.originalUnitPrice;
    }
  }

  // Reserve every newly-added unit and positive quantity difference with a
  // conditional UPDATE. This prevents order editing from bypassing the same
  // stock rule used by new orders.
  const additionalReservations = [
    ...newItems.filter((item) => !!item.productId).map((item) => ({ productId: item.productId!, quantity: item.quantity })),
    ...updatedItems.map((item) => {
      const old = oldItemsMap.get(item.id!) as any;
      return { productId: old.productId as number, quantity: item.quantity - old.quantity };
    }).filter((item) => !!item.productId && item.quantity > 0),
  ];
  if (additionalReservations.length > 0) {
    await reserveProductStocksForOrder(additionalReservations);
  }

  for (const ni of newItems) {
    changes.push(`+ ${ni.productName} ×${ni.quantity} @RM${ni.unitPrice}`);
  }
  for (const ui of updatedItems) {
    const old = oldItemsMap.get(ui.id!) as any;
    const diffs: string[] = [];
    if (old.quantity !== ui.quantity) diffs.push(`qty: ${old.quantity}→${ui.quantity}`);
    if (parseFloat(old.unitPrice) !== parseFloat(ui.unitPrice)) diffs.push(`price: ${old.unitPrice}→${ui.unitPrice}`);
    if ((old.variationName || "") !== (ui.variationName || "")) diffs.push(`variation: ${old.variationName || "-"}→${ui.variationName || "-"}`);
    if (diffs.length > 0) changes.push(`~ ${ui.productName}: ${diffs.join(", ")}`);
  }
  for (const di of deletedItems) {
    changes.push(`- ${(di as any).productName} ×${(di as any).quantity}`);
  }

  // Delete removed items (restore stock)
  for (const di of deletedItems) {
    const item = di as any;
    if (item.variationId) {
      await db.update(productVariations).set({
        stockQuantity: sql`${productVariations.stockQuantity} + ${item.quantity}`,
      }).where(eq(productVariations.id, item.variationId));
    }
    if (item.productId) {
      await db.update(products).set({
        stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
      }).where(eq(products.id, item.productId));
    }
    await db.delete(orderItems).where(eq(orderItems.id, item.id));
  }

  // Update existing items
  for (const ui of updatedItems) {
    const old = oldItemsMap.get(ui.id!) as any;
    const qtyDiff = ui.quantity - old.quantity;
    if (qtyDiff !== 0 && old.productId) {
      if (old.variationId) {
        await db.update(productVariations).set({
          stockQuantity: sql`${productVariations.stockQuantity} - ${qtyDiff}`,
        }).where(eq(productVariations.id, old.variationId));
      }
      if (qtyDiff < 0) {
        await db.update(products).set({
          stockQuantity: sql`${products.stockQuantity} + ${Math.abs(qtyDiff)}`,
        }).where(eq(products.id, old.productId));
      }
    }
    const subtotal = (parseFloat(ui.unitPrice) * ui.quantity).toFixed(2);
    await db.update(orderItems).set({
      quantity: ui.quantity,
      unitPrice: ui.unitPrice,
      subtotal,
      variationId: ui.variationId || null,
      variationName: ui.variationName || null,
    }).where(eq(orderItems.id, ui.id!));
  }

  // Insert new items
  for (const ni of newItems) {
    const subtotal = (parseFloat(ni.unitPrice) * ni.quantity).toFixed(2);
    await db.insert(orderItems).values({
      orderId,
      productId: ni.productId || 0,
      productName: ni.productName,
      productSku: ni.productSku || null,
      productType: "physical" as const,
      quantity: ni.quantity,
      unitPrice: ni.unitPrice,
      subtotal,
      variationId: ni.variationId || null,
      variationName: ni.variationName || null,
      priceType: (ni.priceType as "retail" | "wholesale" | "agent" | "special" | "manual") || "retail",
      originalUnitPrice: ni.originalUnitPrice || null,
      discount: "0.00",
      itemSource: (ni.itemSource as "admin" | "facebook_live" | "messenger" | "mall") || "admin",
    });
    if (ni.productId) {
      if (ni.variationId) {
        await db.update(productVariations).set({
          stockQuantity: sql`${productVariations.stockQuantity} - ${ni.quantity}`,
        }).where(eq(productVariations.id, ni.variationId));
      }
      // Product stock was atomically reserved above before item insertion.
    }
  }

  // Recalculate totals
  const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const physicalSubtotal = allItems
    .filter((item: any) => item.productType === "physical" || item.productType === "gift")
    .reduce((sum, item) => sum + parseFloat(item.subtotal || "0"), 0);
  const totalWeight = allItems
    .filter((item: any) => item.productType === "physical" || item.productType === "gift")
    .reduce((sum, item) => sum + 0.5 * Number(item.quantity || 0), 0);
  const specialSubtotal = allItems
    .filter((item: any) => item.priceType === "special")
    .reduce((sum, item) => sum + parseFloat(item.subtotal || "0"), 0);

  const membershipSubtotal = parseFloat(target[0].membershipSubtotal || "0");
  const promotionDiscount = parseFloat(target[0].promotionDiscount || "0");
  const discountAmount = parseFloat(target[0].discountAmount || "0");
  const extraCharge = parseFloat(target[0].extraCharge || "0");
  const creditUsed = parseFloat(target[0].creditUsed || "0");
  const eligibleSubtotal = physicalSubtotal + membershipSubtotal - specialSubtotal - promotionDiscount - discountAmount;

  let shippingFee = 0;
  if (target[0].shippingMethod === "west_malaysia") {
    shippingFee = calculateWestMalaysiaShipping(totalWeight, eligibleSubtotal).shippingFee;
  } else if (target[0].shippingMethod === "east_malaysia_poslaju") {
    // V2.0.80: 东马 PosLaju 预收 RM50
    shippingFee = 50;
  } else if (target[0].shippingMethod === "east_malaysia_shopee") {
    // V2.0.84: 东马 Shopee 运费固定 RM0
    shippingFee = 0;
  } else if (target[0].shippingMethod === "lalamove") {
    // V2.0.84: Lalamove
    shippingFee = eligibleSubtotal >= 150 ? 0 : 15;
  }

  const totalAmount = physicalSubtotal + membershipSubtotal - promotionDiscount - discountAmount + extraCharge + shippingFee - creditUsed;
    await db.update(orders).set({
    physicalSubtotal: physicalSubtotal.toFixed(2),
    shippingFee: shippingFee.toFixed(2),
    customerPaidShipping: shippingFee.toFixed(2),
    totalWeight: totalWeight.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
  }).where(eq(orders.id, orderId));
  // Log to timeline
  if (changes.length > 0) {
    await logOrderOperation(orderId, "admin_edit", `Admin修改商品：\n${changes.join("\n")}`, JSON.stringify({
      totalBefore: prevTotal,
      totalAfter: totalAmount.toFixed(2),
      changes,
    }), operator || "admin");
  }

  broadcastChanges(["orders", "inventory", "dashboard", "customers"]);
  return { success: true, totalAmount: totalAmount.toFixed(2), shippingFee: shippingFee.toFixed(2) };
}

// ============================================================================
// Order Operation Log helpers
// ============================================================================

export async function logOrderOperation(orderId: number, operationType: string, description?: string | null, changes?: string | null, operator?: string | null) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(orderOperationLogs).values({
      orderId,
      operationType,
      description: description || null,
      changes: changes || null,
      operator: operator || null,
    });
  } catch (e) {
    // Non-critical: don't fail the operation if logging fails
    console.warn("[OrderOperationLog] Failed to log:", e);
  }
}

export async function getOrderOperationLogs(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(orderOperationLogs).where(eq(orderOperationLogs.orderId, orderId)).orderBy(desc(orderOperationLogs.createdAt));
}

// ============================================================================
// Order Payment helpers (多次汇款)
// ============================================================================

export async function getOrderPayments(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(orderPayments).where(eq(orderPayments.orderId, orderId)).orderBy(desc(orderPayments.createdAt));
}

export async function addOrderPayment(data: {
  orderId: number;
  amount: string;
  paymentMethod?: string;
  receiptUrl?: string;
  paymentDate?: Date;
  operatorName?: string;
  notes?: string;
  paymentSource?: 'customer_upload' | 'admin_manual';
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const paymentSource = data.paymentSource || 'admin_manual';
  const reviewStatus = paymentSource === 'admin_manual' ? 'approved' : 'pending';

  await db.insert(orderPayments).values({
    orderId: data.orderId,
    amount: data.amount,
    paymentMethod: data.paymentMethod || null,
    receiptUrl: data.receiptUrl || null,
    paymentDate: data.paymentDate || new Date(),
    operatorName: data.operatorName || null,
    notes: data.notes || null,
    paymentSource,
    reviewStatus,
  });

    // Log activity
  if (paymentSource === 'customer_upload') {
    await logOrderOperation(data.orderId, 'payment', `客户上传付款凭证 RM${data.amount}`, null, 'customer');
  } else {
    await logOrderOperation(data.orderId, 'payment', `Admin新增付款 RM${data.amount}，状态：已确认`, null, data.operatorName);
  }
  // V2.1.15: Use unified recalculateOrderBalance
  await recalculateOrderBalance(data.orderId);
}

// ============================================================================
// V2.1.11: Review Payment (审核通过/审核失败)
// ============================================================================

export async function reviewPayment(data: {
  paymentId: number;
  action: 'approve' | 'reject';
  rejectReason?: string;
  reviewerName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the payment record
  const payment = await db.select().from(orderPayments).where(eq(orderPayments.id, data.paymentId)).limit(1);
  if (payment.length === 0) throw new Error("Payment record not found");
  if (payment[0].reviewStatus !== 'pending') throw new Error("Payment already reviewed");
  if (data.action === 'approve' && Number(payment[0].amount || 0) <= 0) {
    throw new Error("付款凭据金额尚未核对，请先更正金额后再批准");
  }

  const reviewStatus = data.action === 'approve' ? 'approved' : 'rejected';
  const reviewedAt = Date.now();

  await db.update(orderPayments).set({
    reviewStatus,
    reviewedBy: data.reviewerName,
    reviewedAt,
    rejectReason: data.rejectReason || null,
  }).where(eq(orderPayments.id, data.paymentId));

  const orderId = payment[0].orderId;
  const amount = payment[0].amount;

  // Log activity
  if (data.action === 'approve') {
    await logOrderOperation(orderId, 'payment', `付款审核通过 RM${amount}`, null, data.reviewerName);
  } else {
    await logOrderOperation(orderId, 'payment', `付款审核失败 RM${amount}${data.rejectReason ? '，原因：' + data.rejectReason : ''}`, null, data.reviewerName);
  }

  // V2.1.15: Use unified recalculateOrderBalance
  await recalculateOrderBalance(orderId);
}

// ============================================================================
// V2.1.15: Unified recalculateOrderBalance function
// Called after: addOrderPayment, reviewPayment, addMallItemsToOrder, editPayment, addRefund
// Recalculates: paidAmount, overpaidAmount, refundedAmount, order status, special order
// ============================================================================

export async function recalculateOrderBalance(orderId: number) {
  const db = await getDb();
  if (!db) return null;

  const order = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (order.length === 0) return null;

  const totalAmount = parseFloat(String(order[0].totalAmount || "0"));

  // Get all approved payments
  const allPayments = await db.select().from(orderPayments).where(eq(orderPayments.orderId, orderId));
  const approvedPayments = allPayments.filter((p: any) => p.reviewStatus === 'approved');
  const totalPaid = approvedPayments.reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);

  // 实际款项已退的记录影响正式实收；待退货确认只延后实物库存处理，
  // 不应延后扣减客户实收。旧记录的 status 默认为 processed。
  const allRefunds = await db.select().from(orderRefunds).where(eq(orderRefunds.orderId, orderId));
  const totalRefunded = allRefunds
    .filter((r: any) => r.status === 'processed' || r.status === 'awaiting_return')
    .reduce((sum, r) => sum + parseFloat(String(r.amount)), 0);

  // Calculate balance: paid - total = positive means overpaid, negative means still owe
  const balance = totalPaid - totalAmount;
  // V2.1.18: overpaidAmount is the gross overpayment (paid - total), not reduced by refunds.
  // resolvedOverpaymentAmount tracks how much has been processed (Credit/TNG/Cash).
  // The "pending" overpayment = overpaidAmount - resolvedOverpaymentAmount.
  const grossOverpaid = balance > 0.01 ? balance : 0;
  const resolvedOverpayment = parseFloat(String((order[0] as any).resolvedOverpaymentAmount || "0"));
  // overpaidAmount stored = gross overpaid (does NOT subtract refunds, since refunds are tracked separately)
  const overpaidAmount = grossOverpaid;

  // Determine order status
  let newStatus = order[0].physicalStatus;
  let isSpecialOrder = order[0].isSpecialOrder;
  let specialOrderType: string | null = (order[0] as any).specialOrderType || null;
  let specialOrderSource: string = (order[0] as any).specialOrderSource || "manual";
  let specialOrderStatus: string = (order[0] as any).specialOrderStatus || "pending";

  // Don't change status for shipped/completed/cancelled orders
  const lockedStatuses = ['shipped', 'completed', 'cancelled', 'partial_shipped'];
  if (!lockedStatuses.includes(order[0].physicalStatus || '')) {
    if (totalPaid >= totalAmount && totalAmount > 0) {
      // Fully paid or overpaid
      if (order[0].shippingMethod === 'self_pickup' && order[0].orderCategory !== 'import') {
        // Walk-in orders are collected at the shop. Once their payment is
        // confirmed in full, no packing or courier dispatch is required.
        newStatus = 'completed' as any;
      } else if (order[0].physicalStatus === 'hold_order') {
        newStatus = 'hold_order' as any;
      } else if (order[0].physicalStatus === 'pending') {
        newStatus = 'packing' as any;
      } else if (order[0].physicalStatus === 'partial_payment' || order[0].physicalStatus === 'receipt_uploaded') {
        newStatus = 'packing' as any;
      }
      // V2.1.18/V2.1.19: Overpayment → special order only if there's pending (unprocessed) overpayment
      const pendingOverpayment = grossOverpaid - resolvedOverpayment;
      if (pendingOverpayment > 0.01) {
        isSpecialOrder = true;
        specialOrderType = 'over_payment';
        specialOrderSource = 'system';
        specialOrderStatus = 'pending';
        // V2.1.19: Sync to order_special_statuses table
        await syncSpecialStatusToTable(orderId, 'over_payment', 'pending', `多汇款 RM${pendingOverpayment.toFixed(2)}`, pendingOverpayment.toFixed(2), 'system');
      } else if (isSpecialOrder && specialOrderType === 'over_payment' && pendingOverpayment <= 0.01) {
        // Overpayment fully processed → resolve special order
        isSpecialOrder = false;
        specialOrderType = null;
        specialOrderStatus = 'resolved';
        // V2.1.19: Resolve in order_special_statuses table
        await syncSpecialStatusToTable(orderId, 'over_payment', 'resolved', null, '0', 'system');
      } else if (isSpecialOrder && specialOrderType === 'partial_payment') {
        // Was partial payment special, now fully paid → resolve
        isSpecialOrder = false;
        specialOrderType = null;
        specialOrderStatus = 'resolved';
        await syncSpecialStatusToTable(orderId, 'partial_payment', 'resolved', null, '0', 'system');
      }
    } else if (totalPaid > 0 && totalPaid < totalAmount) {
      // Partial payment - this is a normal order status, NOT a special order
      newStatus = 'partial_payment' as any;
      // Do NOT set isSpecialOrder for partial_payment - it's a normal status
      if (isSpecialOrder && specialOrderType === 'partial_payment') {
        isSpecialOrder = false;
        specialOrderType = null;
        specialOrderStatus = 'resolved';
      }
    } else if (totalPaid === 0) {
      // No approved payments
      if (order[0].physicalStatus === 'partial_payment' || order[0].physicalStatus === 'receipt_uploaded') {
        newStatus = 'pending' as any;
      }
      if (isSpecialOrder && specialOrderType === 'partial_payment') {
        isSpecialOrder = false;
        specialOrderType = null;
        specialOrderStatus = 'resolved';
      }
    }
  }

  // For import orders, also update importStatus - but don't overwrite shipped/completed/cancelled
  let importStatusUpdate: string | null = null;
  const importLockedStatuses = ['shipped', 'completed', 'cancelled', 'partial_shipped'];
  if (order[0].orderCategory === 'import' && !importLockedStatuses.includes(order[0].importStatus || '')) {
    if (totalPaid >= totalAmount && totalAmount > 0) {
      // Keep current importStatus if already past waiting_stock (e.g. ready_to_ship, scheduled_ship)
      const currentImportStatus = order[0].importStatus || '';
      const pastWaitingStock = ['ready_to_ship', 'scheduled_ship'];
      if (!pastWaitingStock.includes(currentImportStatus)) {
        importStatusUpdate = 'waiting_stock';
      }
    } else if (totalPaid > 0) {
      importStatusUpdate = 'partial_payment';
    } else {
      importStatusUpdate = 'pending';
    }
  }

  const updateSet: any = {
    paidAmount: totalPaid.toFixed(2),
    overpaidAmount: overpaidAmount.toFixed(2),
    refundedAmount: totalRefunded.toFixed(2),
    physicalStatus: newStatus as any,
    isSpecialOrder,
    specialOrderType: specialOrderType as any,
    specialOrderSource: specialOrderSource as any,
    specialOrderStatus: specialOrderStatus as any,
    specialOrderUpdatedAt: new Date(),
  };
  if (importStatusUpdate) {
    updateSet.importStatus = importStatusUpdate;
  }
  if (newStatus === 'completed' && order[0].physicalStatus !== 'completed') {
    updateSet.completedAt = new Date();
  }
  await db.update(orders).set(updateSet).where(eq(orders.id, orderId));

  // Set fullPaymentConfirmedAt if fully paid
  if (totalPaid >= totalAmount && totalAmount > 0) {
    await checkAndSetFullPaymentConfirmed(orderId);
  }

  broadcastChanges(["orders", "dashboard"]);
  return { totalPaid, totalAmount, balance, overpaidAmount, totalRefunded, newStatus };
}

// ============================================================================
// V2.1.15: Edit Payment Record
// ============================================================================

export async function editOrderPayment(data: {
  paymentId: number;
  amount?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  notes?: string;
  operatorName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const payment = await db.select().from(orderPayments).where(eq(orderPayments.id, data.paymentId)).limit(1);
  if (payment.length === 0) throw new Error("Payment record not found");

  const updateSet: any = {};
  if (data.amount !== undefined) updateSet.amount = data.amount;
  if (data.paymentMethod !== undefined) updateSet.paymentMethod = data.paymentMethod;
  if (data.receiptUrl !== undefined) updateSet.receiptUrl = data.receiptUrl;
  if (data.notes !== undefined) updateSet.notes = data.notes;

  await db.update(orderPayments).set(updateSet).where(eq(orderPayments.id, data.paymentId));

  // Log activity
  const orderId = payment[0].orderId;
  const changes: string[] = [];
  if (data.amount !== undefined && data.amount !== String(payment[0].amount)) changes.push(`金额: ${payment[0].amount}→${data.amount}`);
  if (data.paymentMethod !== undefined && data.paymentMethod !== (payment[0].paymentMethod || '')) changes.push(`付款方式: ${payment[0].paymentMethod || '无'}→${data.paymentMethod}`);
  if (changes.length > 0) {
    await logOrderOperation(orderId, 'payment', `编辑付款记录：${changes.join('，')}`, null, data.operatorName);
  }

  // Recalculate order balance
  await recalculateOrderBalance(orderId);
  return { success: true };
}

// ============================================================================
// V2.1.15: Add Refund
// ============================================================================

export async function addOrderRefund(data: {
  orderId: number;
  amount: string;
  refundMethod: string;
  receiptUrl?: string;
  notes?: string;
  operatorName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(orderRefunds).values({
    orderId: data.orderId,
    amount: data.amount,
    refundMethod: data.refundMethod,
    receiptUrl: data.receiptUrl || null,
    notes: data.notes || null,
    operatorName: data.operatorName,
    refundDate: new Date(),
  });

  // Log activity
  await logOrderOperation(data.orderId, 'payment', `退款 RM${data.amount}，方式：${data.refundMethod}`, null, data.operatorName);

  // If Refund to Credit, actually add credit to customer account
  if (data.refundMethod === 'Refund to Credit') {
    const order = await db.select().from(orders).where(eq(orders.id, data.orderId)).limit(1);
    if (order.length > 0 && order[0].customerId) {
      const refundAmount = parseFloat(data.amount);
      await refundCustomerCredit(order[0].customerId, refundAmount, data.orderId, order[0].orderNumber || undefined);
      await logOrderOperation(data.orderId, 'payment', `退款转Credit RM${data.amount}，已加入客户Credit`, null, data.operatorName);
    }
  }

  // Recalculate order balance (will check if overpaidAmount is now 0)
  await recalculateOrderBalance(data.orderId);
  return { success: true };
}

// ============================================================================
// V2.1.18: Process Overpayment (Credit / TNG / Cash)
// ============================================================================

export async function processOverpayment(data: {
  orderId: number;
  amount: string;
  method: 'credit' | 'tng' | 'cash' | 'bank_transfer' | 'other';
  notes?: string;
  operatorName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const order = await db.select().from(orders).where(eq(orders.id, data.orderId)).limit(1);
  if (order.length === 0) throw new Error("Order not found");

  const overpaidAmount = parseFloat(String(order[0].overpaidAmount || "0"));
  const resolvedAmount = parseFloat(String((order[0] as any).resolvedOverpaymentAmount || "0"));
  const pendingOverpayment = overpaidAmount - resolvedAmount;
  const processAmount = parseFloat(data.amount);

  if (processAmount <= 0) throw new Error("Invalid amount");
  if (processAmount > pendingOverpayment + 0.01) {
    throw new Error(`Amount exceeds pending overpayment: RM${pendingOverpayment.toFixed(2)}`);
  }

  // Update resolvedOverpaymentAmount
  const newResolvedAmount = resolvedAmount + processAmount;
  await db.update(orders).set({
    resolvedOverpaymentAmount: newResolvedAmount.toFixed(2),
  }).where(eq(orders.id, data.orderId));

  // Record as a refund entry with method mapping
  const methodLabel: Record<string, string> = {
    credit: 'Refund to Credit',
    tng: 'TNG',
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    other: 'Other',
  };
  const refundMethod = methodLabel[data.method] || data.method;

  await db.insert(orderRefunds).values({
    orderId: data.orderId,
    amount: data.amount,
    refundMethod,
    receiptUrl: null,
    notes: data.notes || `多汇款处理：${refundMethod} RM${data.amount}`,
    operatorName: data.operatorName,
    refundDate: new Date(),
  });

  // Log activity
  await logOrderOperation(data.orderId, 'payment', `多汇款处理：RM${data.amount}，方式：${refundMethod}${data.notes ? '，备注：' + data.notes : ''}`, null, data.operatorName);

  // If Credit, add to customer's credit balance
  if (data.method === 'credit' && order[0].customerId) {
    await refundCustomerCredit(order[0].customerId, processAmount, data.orderId, order[0].orderNumber || undefined);
    await logOrderOperation(data.orderId, 'payment', `多汇款转Credit RM${data.amount}，已加入客户Credit`, null, data.operatorName);
  }

  // Check if overpayment is fully resolved
  const newPending = overpaidAmount - newResolvedAmount;
  if (newPending <= 0.01) {
    // Resolve the special order status
    await db.update(orders).set({
      isSpecialOrder: false,
      specialOrderType: null as any,
      specialOrderStatus: 'resolved' as any,
      specialOrderUpdatedAt: new Date(),
    }).where(eq(orders.id, data.orderId));
    await logOrderOperation(data.orderId, 'payment', `多汇款已完全处理，特别状态解除`, null, data.operatorName);
  }

  // Also recalculate balance to sync refundedAmount
  await recalculateOrderBalance(data.orderId);

  broadcastChanges(["orders", "dashboard"]);
  return { success: true, resolvedAmount: newResolvedAmount.toFixed(2), pendingOverpayment: Math.max(0, newPending).toFixed(2) };
}

// ============================================================================
// V2.1.15: Get Order Refunds
// ============================================================================

export async function getOrderRefunds(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(orderRefunds).where(eq(orderRefunds.orderId, orderId)).orderBy(desc(orderRefunds.createdAt));
}

// ============================================================================
// V5.1: Refund Management (退款管理)
// ============================================================================

export type RefundItemInput = {
  orderItemId?: number; productId?: number; productName: string; productSku?: string | null;
  refundQuantity: number; unitPrice: number; unitCost: number; refundAmount: number;
  inventoryTreatment: 'return_to_sale' | 'write_off' | 'none' | 'pending_return';
};

/**
 * 商品售后利润口径（不含配送收入／配送成本）：原订单商品销售额 - 原商品成本 - 实际退款 + 已退回可售库存的成本回收。
 * awaiting_return 代表款项已实际退回、仅等待实物确认，因此计入退款损失；其商品成本需在确认回库后才回收。
 */
function buildRefundProfitSummary(orderItemRows: any[], refunds: any[], refundItems: any[]) {
  const processedRefunds = refunds.filter((refund) => refund.status === 'processed' || refund.status === 'awaiting_return');
  const processedIds = new Set(processedRefunds.map((refund) => refund.id));
  const originalProductRevenue = orderItemRows.reduce((sum, item) => sum + Number(item.subtotal ?? (Number(item.unitPrice || 0) * Number(item.quantity || 0))), 0);
  const originalProductCost = orderItemRows.reduce((sum, item) => sum + Number(item.unitCost || 0) * Number(item.quantity || 0), 0);
  const actualRefundLoss = processedRefunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const returnedInventoryCostRecovery = refundItems
    .filter((item) => processedIds.has(item.refundId) && item.inventoryTreatment === 'return_to_sale' && item.inventoryActionStatus === 'returned')
    .reduce((sum, item) => sum + Number(item.unitCost || 0) * Number(item.refundQuantity || 0), 0);
  const originalProductProfit = originalProductRevenue - originalProductCost;
  return {
    originalProductRevenue,
    originalProductCost,
    originalProductProfit,
    actualRefundLoss,
    returnedInventoryCostRecovery,
    finalProductProfit: originalProductProfit - actualRefundLoss + returnedInventoryCostRecovery,
  };
}

export async function searchRefundEligibleOrders(search?: string) {
  const db = await getDb();
  if (!db) return [];
  const filters: any[] = [inArray(orders.physicalStatus, ['shipped', 'completed'] as any)];
  if (search?.trim()) {
    const pattern = `%${search.trim()}%`;
    filters.push(or(like(orders.orderNumber, pattern), like(customers.name, pattern), like(customers.whatsappPhone, pattern), like(shipments.trackingNumber, pattern)));
  }
  return db.select({
    id: orders.id, orderNumber: orders.orderNumber, customerName: customers.name, customerPhone: customers.whatsappPhone,
    physicalStatus: orders.physicalStatus, totalAmount: orders.totalAmount, paidAmount: orders.paidAmount,
    trackingNumber: shipments.trackingNumber, shippingMethod: orders.shippingMethod,
  }).from(orders).leftJoin(customers, eq(orders.customerId, customers.id)).leftJoin(shipments, eq(shipments.orderId, orders.id))
    .where(and(...filters)).orderBy(desc(orders.createdAt)).limit(30);
}

export async function getRefundOrderDetail(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ order: orders, customer: customers, shipment: shipments }).from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id)).leftJoin(shipments, eq(shipments.orderId, orders.id))
    .where(eq(orders.id, orderId)).limit(1);
  if (!rows[0]) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const refunds = await db.select().from(orderRefunds).where(eq(orderRefunds.orderId, orderId)).orderBy(desc(orderRefunds.createdAt));
  const refundItems = refunds.length ? await db.select().from(orderRefundItems).where(inArray(orderRefundItems.refundId, refunds.map(refund => refund.id))) : [];
  const refundedByOrderItem = new Map<number, number>();
  refundItems.filter(item => !['rejected', 'cancelled'].includes((refunds.find(refund => refund.id === item.refundId) as any)?.status || ''))
    .forEach(item => refundedByOrderItem.set(item.orderItemId!, (refundedByOrderItem.get(item.orderItemId!) || 0) + item.refundQuantity));
  return {
    ...rows[0],
    items: items.map(item => ({ ...item, refundedQuantity: refundedByOrderItem.get(item.id) || 0 })),
    refunds: refunds.map(refund => ({ ...refund, items: refundItems.filter(item => item.refundId === refund.id) })),
    refundProfit: buildRefundProfitSummary(items, refunds, refundItems),
  };
}

export async function createRefundRequest(data: {
  orderId: number; requestedAmount: number; refundMethod: string; refundReason?: string; issueDescription?: string;
  refundReasonCode?: string; refundSource?: 'manual' | 'packing'; customerRefundDetails?: string; customerRefundQrUrl?: string;
  attachmentUrls?: string; internalNotes?: string; requestedBy: string; items: RefundItemInput[];
  // 仅包货异常可在发货前建立正式“未处理”退款；后台手动退款仍限制已发货／已完成订单。
  sourceExceptionId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (data.requestedAmount <= 0) throw new Error('退款申请金额必须大于 RM0');
  if (data.sourceExceptionId) {
    const existing = await db.select().from(orderRefunds)
      .where(eq(orderRefunds.sourceExceptionId, data.sourceExceptionId)).limit(1);
    if (existing[0]) return { id: existing[0].id, refundNumber: existing[0].refundNumber || `RF-${existing[0].id}`, existing: true };
  }
  const detail = await getRefundOrderDetail(data.orderId);
  if (!detail?.order) throw new Error('订单不存在');
  if (!data.sourceExceptionId && !['shipped', 'completed'].includes(detail.order.physicalStatus || '')) throw new Error('仅已发货或已完成订单可建立退款');
  for (const item of data.items) {
    if (item.refundQuantity <= 0) throw new Error('退款商品数量必须大于 0');
    const original = item.orderItemId ? detail.items.find((row: any) => row.id === item.orderItemId) : null;
    if (item.orderItemId && (!original || item.refundQuantity > original.quantity - original.refundedQuantity)) {
      throw new Error(`${item.productName} 可退款数量不足，不能重复退款`);
    }
  }
  const refundNumber = `RF-${detail.order.orderNumber || data.orderId}-${Date.now().toString().slice(-6)}`;
  const refundId = await db.transaction(async (tx: any) => {
    const inserted = await tx.insert(orderRefunds).values({
      orderId: data.orderId, refundNumber, status: 'pending', requestedAmount: data.requestedAmount.toFixed(2), amount: '0', refundMethod: data.refundMethod,
      sourceExceptionId: data.sourceExceptionId || null,
      refundReason: data.refundReason || null, refundReasonCode: data.refundReasonCode || null, refundSource: data.refundSource || 'manual',
      issueDescription: data.issueDescription || null, customerRefundDetails: data.customerRefundDetails || null, customerRefundQrUrl: data.customerRefundQrUrl || null,
      attachmentUrls: data.attachmentUrls || null, internalNotes: data.internalNotes || null, requestedBy: data.requestedBy,
    });
    const id = Number((inserted as any)[0]?.insertId);
    if (!id) throw new Error('无法建立退款记录');
    if (data.items.length) await tx.insert(orderRefundItems).values(data.items.map(item => ({
      refundId: id, orderItemId: item.orderItemId || null, productId: item.productId || null, productName: item.productName, productSku: item.productSku || null,
      refundQuantity: item.refundQuantity, unitPrice: item.unitPrice.toFixed(2), unitCost: item.unitCost.toFixed(2), refundAmount: item.refundAmount.toFixed(2),
      inventoryTreatment: item.inventoryTreatment, inventoryActionStatus: item.inventoryTreatment === 'pending_return' ? 'pending' : 'not_required',
    })));
    // 未处理退款不可由付款期限任务自动取消；实际结束、拒绝或取消须由退款流程
    // 及管理员的审计动作处理，避免破坏退款与库存账本。
    await tx.update(orders).set({ cancelProtection: true }).where(eq(orders.id, data.orderId));
    return id;
  });
  await logOrderOperation(data.orderId, 'refund_request', `建立退款申请 ${refundNumber}，申请金额 RM${data.requestedAmount.toFixed(2)}`, null, data.requestedBy);
  broadcastChanges(['orders', 'dashboard']);
  return { id: refundId, refundNumber };
}

/**
 * 包货异常的退款只建立正式的“未处理”退款，实际退款、Credit、库存和订单利润
 * 均由退款管理的完成操作处理，避免旧异常流程发生即时且不可追溯的结算。
 */
export async function createPackingExceptionRefund(data: {
  exceptionId: number;
  requestedBy: string;
  refundAmount?: number;
  refundMethod?: 'credit' | 'tng' | 'cash';
  customerRefundDetails?: string;
  customerRefundQrUrl?: string;
  attachmentUrls?: string;
  internalNotes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const exceptionRows = await db.select().from(orderExceptions).where(eq(orderExceptions.id, data.exceptionId)).limit(1);
  const exception = exceptionRows[0];
  if (!exception) throw new Error('异常记录不存在');
  if (exception.refundId) {
    const linked = await db.select().from(orderRefunds).where(eq(orderRefunds.id, exception.refundId)).limit(1);
    if (linked[0]) return { id: linked[0].id, refundNumber: linked[0].refundNumber || `RF-${linked[0].id}`, existing: true };
  }
  const orderRows = await db.select().from(orders).where(eq(orders.id, exception.orderId)).limit(1);
  if (!orderRows[0]) throw new Error('异常订单不存在');
  const itemRows = exception.orderItemId
    ? await db.select().from(orderItems).where(eq(orderItems.id, exception.orderItemId)).limit(1)
    : [];
  const item = itemRows[0];
  const quantity = Math.max(0, Number(exception.quantity || 0));
  const calculatedAmount = item ? Number(item.unitPrice || 0) * quantity : 0;
  const requestedAmount = Number(data.refundAmount ?? exception.refundAmount ?? calculatedAmount);
  if (requestedAmount <= 0) throw new Error('退款金额必须大于 RM0');
  if (item && quantity <= 0) throw new Error('退款商品数量必须大于 0');
  const treatment: RefundItemInput['inventoryTreatment'] = exception.exceptionType === 'quality_issue' ? 'write_off' : 'none';
  const refund = await createRefundRequest({
    orderId: exception.orderId,
    requestedAmount,
    refundMethod: data.refundMethod === 'tng' ? 'tng_qr' : (data.refundMethod || 'credit'),
    refundReason: `包货异常：${({ out_of_stock: '商品缺货', quality_issue: '商品瑕疵', overcharged_shipping: '运费多收', delivery_delay: '配送延迟', cancelled_item: '商品取消', other: '其他异常' } as Record<string, string>)[exception.exceptionType] || '其他异常'}`,
    refundReasonCode: exception.exceptionType,
    refundSource: 'packing',
    issueDescription: exception.description || undefined,
    customerRefundDetails: data.customerRefundDetails,
    customerRefundQrUrl: data.customerRefundQrUrl,
    attachmentUrls: data.attachmentUrls,
    internalNotes: [`来源：包货异常 #${exception.id}`, data.internalNotes].filter(Boolean).join('\n'),
    requestedBy: data.requestedBy,
    sourceExceptionId: exception.id,
    items: item ? [{
      orderItemId: item.id,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku || null,
      refundQuantity: quantity,
      unitPrice: Number(item.unitPrice || 0),
      unitCost: Number(item.unitCost || 0),
      refundAmount: requestedAmount,
      inventoryTreatment: treatment,
    }] : [],
  });
  await db.update(orderExceptions).set({
    refundId: refund.id,
    resolutionType: 'refund',
    customerAction: 'refund',
    refundAmount: requestedAmount.toFixed(2),
  }).where(eq(orderExceptions.id, exception.id));
  await logOrderOperation(exception.orderId, 'refund_request', `包货异常 #${exception.id} 已建立退款 ${refund.refundNumber}`, null, data.requestedBy);
  broadcastChanges(['orders', 'dashboard']);
  return refund;
}

const refundProofRequired = (method: string) => /tng|duitnow|bank|transfer|qr/i.test(method);

export async function completeRefundRequest(data: { refundId: number; actualAmount: number; receiptUrl?: string; processedBy: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (data.actualAmount <= 0) throw new Error('实际退款金额必须大于 RM0');
  const refund = await db.select().from(orderRefunds).where(eq(orderRefunds.id, data.refundId)).limit(1);
  if (!refund[0]) throw new Error('退款记录不存在');
  if (refund[0].status !== 'pending') throw new Error('仅未处理退款可以完成');
  if (refundProofRequired(refund[0].refundMethod) && !data.receiptUrl) throw new Error('TNG、DuitNow、银行转账与 QR 退款必须上传退款凭证');
  const items = await db.select().from(orderRefundItems).where(eq(orderRefundItems.refundId, data.refundId));
  const awaitingReturn = items.some(item => item.inventoryTreatment === 'pending_return');
  await db.transaction(async (tx: any) => {
    let creditLedgerId: number | null = null;
    if (/credit/i.test(refund[0].refundMethod)) {
      const order = await tx.select().from(orders).where(eq(orders.id, refund[0].orderId)).limit(1);
      if (!order[0]?.customerId) throw new Error('无法将退款转入没有客户资料的订单 Credit');
      const customer = await tx.select().from(customers).where(eq(customers.id, order[0].customerId)).limit(1);
      const balanceAfter = Number(customer[0]?.creditBalance || 0) + data.actualAmount;
      await tx.update(customers).set({ creditBalance: balanceAfter.toFixed(2) }).where(eq(customers.id, order[0].customerId));
      const credit = await tx.insert(customerCreditLedger).values({ customerId: order[0].customerId, amount: data.actualAmount.toFixed(2), balanceAfter: balanceAfter.toFixed(2), type: 'order_refund', reason: `退款 ${refund[0].refundNumber || data.refundId}`, orderId: order[0].id, orderNumber: order[0].orderNumber, performedBy: data.processedBy });
      creditLedgerId = Number((credit as any)[0]?.insertId) || null;
      if (!creditLedgerId) throw new Error('Credit 退款入账失败');
    }
    for (const item of items) {
      if (item.inventoryTreatment === 'return_to_sale' && item.productId) {
        const product = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
        if (!product[0]) throw new Error(`商品 ${item.productName} 不存在，无法退回库存`);
        await tx.update(products).set({ stockQuantity: (product[0].stockQuantity || 0) + item.refundQuantity }).where(eq(products.id, item.productId));
        const adjustment = await tx.insert(inventoryAdjustments).values({
          productId: item.productId, adjustmentType: 'other', quantityChange: item.refundQuantity, unitCost: item.unitCost,
          totalCost: (Number(item.unitCost) * item.refundQuantity).toFixed(2), adjustedBy: data.processedBy,
          reason: `退款退库｜订单 ${refund[0].orderId}｜退款 ${refund[0].refundNumber || data.refundId}`, remark: '退款退回可售库存',
        });
        await tx.update(orderRefundItems).set({ inventoryActionStatus: 'returned', inventoryAdjustmentId: Number((adjustment as any)[0]?.insertId) || null, inventoryHandledBy: data.processedBy, inventoryHandledAt: new Date() }).where(eq(orderRefundItems.id, item.id));
        continue;
      }
      if (item.inventoryTreatment === 'write_off' && item.productId) {
        // The customer keeps or receives an unsaleable item. Available inventory must
        // not rise, but an explicit zero-delta ledger entry preserves after-sales cost traceability.
        const adjustment = await tx.insert(inventoryAdjustments).values({
          productId: item.productId, adjustmentType: 'other', quantityChange: 0, unitCost: item.unitCost,
          totalCost: (Number(item.unitCost) * item.refundQuantity).toFixed(2), adjustedBy: data.processedBy,
          reason: `售后退款不退库／报损｜订单 ${refund[0].orderId}｜退款 ${refund[0].refundNumber || data.refundId}`,
          remark: `商品 ${item.productName} 不退回可售库存`,
        });
        await tx.update(orderRefundItems).set({ inventoryActionStatus: 'written_off', inventoryAdjustmentId: Number((adjustment as any)[0]?.insertId) || null, inventoryHandledBy: data.processedBy, inventoryHandledAt: new Date() }).where(eq(orderRefundItems.id, item.id));
      }
    }
    await tx.update(orderRefunds).set({ status: awaitingReturn ? 'awaiting_return' : 'processed', amount: data.actualAmount.toFixed(2), receiptUrl: data.receiptUrl || null, processedBy: data.processedBy, processedAt: new Date(), inventoryFinalizedAt: awaitingReturn ? null : new Date(), creditLedgerId }).where(eq(orderRefunds.id, data.refundId));
    if (refund[0].sourceExceptionId) {
      await tx.update(orderExceptions).set({
        status: awaitingReturn ? 'open' : 'resolved',
        resolvedBy: awaitingReturn ? null : data.processedBy,
        resolvedAt: awaitingReturn ? null : new Date(),
      }).where(eq(orderExceptions.id, refund[0].sourceExceptionId));
    }
  });
  await recalculateOrderBalance(refund[0].orderId);
  await logOrderOperation(refund[0].orderId, 'refund_processed', `完成退款 ${refund[0].refundNumber || data.refundId}，实际退款 RM${data.actualAmount.toFixed(2)}${awaitingReturn ? '；待确认退货' : ''}`, null, data.processedBy);
  broadcastChanges(['orders', 'dashboard', 'inventory']);
  return {
    success: true,
    awaitingReturn,
    orderId: refund[0].orderId,
    refundId: data.refundId,
    refundNumber: refund[0].refundNumber || `RF-${data.refundId}`,
    refundMethod: refund[0].refundMethod,
  };
}

export async function finalizeRefundReturnItem(data: { refundItemId: number; inventoryTreatment: 'return_to_sale' | 'write_off'; processedBy: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db.select({ item: orderRefundItems, refund: orderRefunds }).from(orderRefundItems).innerJoin(orderRefunds, eq(orderRefundItems.refundId, orderRefunds.id)).where(eq(orderRefundItems.id, data.refundItemId)).limit(1);
  if (!rows[0]) throw new Error('退款商品记录不存在');
  const { item, refund } = rows[0];
  if (refund.status !== 'awaiting_return' || item.inventoryTreatment !== 'pending_return' || item.inventoryActionStatus !== 'pending') throw new Error('此退款商品不处于待退货确认状态');
  await db.transaction(async (tx: any) => {
    let inventoryAdjustmentId: number | null = null;
    if (data.inventoryTreatment === 'return_to_sale') {
      if (!item.productId) throw new Error('此退款商品没有可退回的商品编号');
      const product = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (!product[0]) throw new Error('商品不存在，无法退回库存');
      await tx.update(products).set({ stockQuantity: (product[0].stockQuantity || 0) + item.refundQuantity }).where(eq(products.id, item.productId));
      const adjustment = await tx.insert(inventoryAdjustments).values({ productId: item.productId, adjustmentType: 'other', quantityChange: item.refundQuantity, unitCost: item.unitCost, totalCost: (Number(item.unitCost) * item.refundQuantity).toFixed(2), adjustedBy: data.processedBy, reason: `退款退货确认退库｜订单 ${refund.orderId}｜退款 ${refund.refundNumber || refund.id}`, remark: '客户退货确认后退回可售库存' });
      inventoryAdjustmentId = Number((adjustment as any)[0]?.insertId) || null;
    }
    await tx.update(orderRefundItems).set({ inventoryTreatment: data.inventoryTreatment, inventoryActionStatus: data.inventoryTreatment === 'return_to_sale' ? 'returned' : 'written_off', inventoryAdjustmentId, inventoryHandledBy: data.processedBy, inventoryHandledAt: new Date() }).where(eq(orderRefundItems.id, item.id));
    const remaining = await tx.select().from(orderRefundItems).where(eq(orderRefundItems.refundId, refund.id));
    if (!remaining.some((row: typeof orderRefundItems.$inferSelect) => row.inventoryActionStatus === 'pending')) await tx.update(orderRefunds).set({ status: 'processed', inventoryFinalizedAt: new Date() }).where(eq(orderRefunds.id, refund.id));
  });
  await logOrderOperation(refund.orderId, 'refund_inventory_finalized', `退款 ${refund.refundNumber || refund.id} 已确认${data.inventoryTreatment === 'return_to_sale' ? '退回可售库存' : '报损不退库'}`, null, data.processedBy);
  broadcastChanges(['orders', 'dashboard', 'inventory']);
  return { success: true };
}

export async function getRefundManagementRecords(status?: 'pending' | 'processed' | 'awaiting_return' | 'rejected' | 'cancelled') {
  const db = await getDb();
  if (!db) return [];
  const condition = status ? eq(orderRefunds.status, status as any) : undefined;
  const rows = await db.select({
    refund: orderRefunds,
    orderNumber: orders.orderNumber,
    customerName: customers.name,
    customerPhone: customers.whatsappPhone,
  }).from(orderRefunds)
    .leftJoin(orders, eq(orderRefunds.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(condition)
    .orderBy(desc(orderRefunds.createdAt));
  const refundIds = rows.map(row => row.refund.id);
  const items = refundIds.length
    ? await db.select().from(orderRefundItems).where(inArray(orderRefundItems.refundId, refundIds))
    : [];
  return rows.map(row => ({ ...row, items: items.filter(item => item.refundId === row.refund.id) }));
}

async function setPendingRefundStatus(data: { refundId: number; status: 'rejected' | 'cancelled'; reason?: string; processedBy: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const refund = await db.select().from(orderRefunds).where(eq(orderRefunds.id, data.refundId)).limit(1);
  if (!refund[0]) throw new Error('退款记录不存在');
  if (refund[0].status !== 'pending') throw new Error('只有未处理退款可以拒绝或取消；已处理退款必须使用库存处理更正流程');
  await db.update(orderRefunds).set({
    status: data.status,
    internalNotes: [refund[0].internalNotes, `${data.status === 'rejected' ? '已拒绝' : '已取消'}：${data.reason || '未说明原因'}`]
      .filter(Boolean).join('\n'),
    processedBy: data.processedBy,
    processedAt: new Date(),
  }).where(eq(orderRefunds.id, data.refundId));
  await logOrderOperation(refund[0].orderId, 'refund_status', `${data.status === 'rejected' ? '拒绝' : '取消'}退款 ${refund[0].refundNumber || data.refundId}${data.reason ? `：${data.reason}` : ''}`, null, data.processedBy);
  broadcastChanges(['orders', 'dashboard']);
  return { success: true };
}

export async function rejectRefundRequest(data: { refundId: number; reason?: string; processedBy: string }) {
  return setPendingRefundStatus({ ...data, status: 'rejected' });
}

export async function cancelRefundRequest(data: { refundId: number; reason?: string; processedBy: string }) {
  return setPendingRefundStatus({ ...data, status: 'cancelled' });
}

export async function correctProcessedRefundInventoryTreatment(data: {
  refundItemId: number;
  inventoryTreatment: 'return_to_sale' | 'write_off';
  processedBy: string;
  reason: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (!data.reason.trim()) throw new Error('修改已处理退款的库存方式必须填写原因');
  const rows = await db.select({ item: orderRefundItems, refund: orderRefunds }).from(orderRefundItems)
    .innerJoin(orderRefunds, eq(orderRefundItems.refundId, orderRefunds.id))
    .where(eq(orderRefundItems.id, data.refundItemId)).limit(1);
  if (!rows[0]) throw new Error('退款商品记录不存在');
  const { item, refund } = rows[0];
  if (!['processed', 'awaiting_return'].includes(refund.status || '') || !['returned', 'written_off'].includes(item.inventoryActionStatus || '')) {
    throw new Error('只有库存已确认的已处理退款可以更正库存方式');
  }
  const previousTreatment = item.inventoryTreatment;
  if (previousTreatment === data.inventoryTreatment) throw new Error('库存处理方式没有变化');
  if (!item.productId) throw new Error('与库存无关的退款商品不能更正库存方式');

  await db.transaction(async (tx: any) => {
    const product = await tx.select().from(products).where(eq(products.id, item.productId!)).limit(1);
    if (!product[0]) throw new Error('商品不存在，无法更正库存处理');
    let latestAdjustmentId: number | null = null;
    if (previousTreatment === 'return_to_sale') {
      if (!product[0].allowOversold && (product[0].stockQuantity || 0) < item.refundQuantity) {
        throw new Error(`库存不足，无法撤销已退库的 ${item.productName} ${item.refundQuantity} 件`);
      }
      await tx.update(products).set({ stockQuantity: (product[0].stockQuantity || 0) - item.refundQuantity }).where(eq(products.id, item.productId!));
      const reversal = await tx.insert(inventoryAdjustments).values({
        productId: item.productId!, adjustmentType: 'other', quantityChange: -item.refundQuantity,
        unitCost: item.unitCost, totalCost: (Number(item.unitCost) * item.refundQuantity * -1).toFixed(2),
        adjustedBy: data.processedBy,
        reason: `退款库存处理更正｜撤销退库｜订单 ${refund.orderId}｜退款 ${refund.refundNumber || refund.id}`,
        remark: data.reason,
      });
      latestAdjustmentId = Number((reversal as any)[0]?.insertId) || null;
    }
    if (data.inventoryTreatment === 'return_to_sale') {
      await tx.update(products).set({ stockQuantity: (product[0].stockQuantity || 0) + item.refundQuantity }).where(eq(products.id, item.productId!));
      const returnAdjustment = await tx.insert(inventoryAdjustments).values({
        productId: item.productId!, adjustmentType: 'other', quantityChange: item.refundQuantity,
        unitCost: item.unitCost, totalCost: (Number(item.unitCost) * item.refundQuantity).toFixed(2),
        adjustedBy: data.processedBy,
        reason: `退款库存处理更正｜退回可售库存｜订单 ${refund.orderId}｜退款 ${refund.refundNumber || refund.id}`,
        remark: data.reason,
      });
      latestAdjustmentId = Number((returnAdjustment as any)[0]?.insertId) || latestAdjustmentId;
    } else {
      const writeOff = await tx.insert(inventoryAdjustments).values({
        productId: item.productId!, adjustmentType: 'other', quantityChange: 0,
        unitCost: item.unitCost, totalCost: (Number(item.unitCost) * item.refundQuantity).toFixed(2),
        adjustedBy: data.processedBy,
        reason: `售后退款不退库／报损｜订单 ${refund.orderId}｜退款 ${refund.refundNumber || refund.id}`,
        remark: data.reason,
      });
      latestAdjustmentId = Number((writeOff as any)[0]?.insertId) || latestAdjustmentId;
    }
    await tx.update(orderRefundItems).set({
      inventoryTreatment: data.inventoryTreatment,
      inventoryActionStatus: data.inventoryTreatment === 'return_to_sale' ? 'returned' : 'written_off',
      inventoryAdjustmentId: latestAdjustmentId,
      inventoryHandledBy: data.processedBy,
      inventoryHandledAt: new Date(),
    }).where(eq(orderRefundItems.id, item.id));
  });
  await logOrderOperation(refund.orderId, 'refund_inventory_corrected', `管理员更正退款 ${refund.refundNumber || refund.id} 的库存方式：${previousTreatment} → ${data.inventoryTreatment}；${data.reason}`, null, data.processedBy);
  broadcastChanges(['orders', 'dashboard', 'inventory']);
  return { success: true };
}

// ============================================================================
// V2.1.19: Order Special Statuses (多特别状态支持)
// ============================================================================

// Internal helper: sync special status to order_special_statuses table
async function syncSpecialStatusToTable(
  orderId: number,
  type: string,
  status: 'pending' | 'resolved',
  reason: string | null,
  amount: string,
  source: 'system' | 'manual'
) {
  const db = await getDb();
  if (!db) return;

  if (status === 'pending') {
    // Check if pending status of this type already exists
    const existing = await db.select().from(orderSpecialStatuses)
      .where(and(
        eq(orderSpecialStatuses.orderId, orderId),
        eq(orderSpecialStatuses.type, type as any),
        eq(orderSpecialStatuses.status, 'pending')
      )).limit(1);

    if (existing.length > 0) {
      // Update existing
      await db.update(orderSpecialStatuses).set({
        reason: reason || existing[0].reason,
        amount: amount as any,
        updatedAt: new Date(),
      }).where(eq(orderSpecialStatuses.id, existing[0].id));
    } else {
      // Create new
      await db.insert(orderSpecialStatuses).values({
        orderId,
        type: type as any,
        status: 'pending',
        reason: reason,
        amount: amount as any,
        source: source as any,
      });
    }
  } else if (status === 'resolved') {
    // Resolve all pending statuses of this type
    const pending = await db.select().from(orderSpecialStatuses)
      .where(and(
        eq(orderSpecialStatuses.orderId, orderId),
        eq(orderSpecialStatuses.type, type as any),
        eq(orderSpecialStatuses.status, 'pending')
      ));

    for (const p of pending) {
      await db.update(orderSpecialStatuses).set({
        status: 'resolved',
        resolutionMethod: 'data_corrected' as any,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(orderSpecialStatuses.id, p.id));
    }
  }
}

// Create a special status for an order
export async function createOrderSpecialStatus(data: {
  orderId: number;
  type: string;
  reason?: string;
  amount?: string;
  source?: 'system' | 'manual';
  createdBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if same type pending status already exists
  const existing = await db.select().from(orderSpecialStatuses)
    .where(and(
      eq(orderSpecialStatuses.orderId, data.orderId),
      eq(orderSpecialStatuses.type, data.type as any),
      eq(orderSpecialStatuses.status, 'pending')
    )).limit(1);

  if (existing.length > 0) {
    // Update existing instead of creating duplicate
    await db.update(orderSpecialStatuses).set({
      reason: data.reason || existing[0].reason,
      amount: (data.amount || '0') as any,
      updatedAt: new Date(),
    }).where(eq(orderSpecialStatuses.id, existing[0].id));
    return existing[0];
  }

  const [inserted] = await db.insert(orderSpecialStatuses).values({
    orderId: data.orderId,
    type: data.type as any,
    status: 'pending',
    reason: data.reason || null,
    amount: (data.amount || '0') as any,
    source: (data.source || 'system') as any,
    createdBy: data.createdBy || null,
  });

  // Update order's isSpecialOrder flag
  await db.update(orders).set({
    isSpecialOrder: true,
    specialOrderType: data.type as any,
    specialOrderStatus: 'pending',
    specialOrderSource: (data.source || 'system') as any,
    specialOrderReason: data.reason || null,
    specialOrderBy: data.createdBy || null,
    specialOrderUpdatedAt: new Date(),
  }).where(eq(orders.id, data.orderId));

  await logOrderOperation(data.orderId, 'special_status', `建立特别状态：${data.type}${data.reason ? ' - ' + data.reason : ''}`, null, data.createdBy || null);
  broadcastChanges(["orders", "dashboard"]);
  return { id: inserted.insertId };
}

// Resolve a special status
export async function resolveOrderSpecialStatus(data: {
  specialStatusId: number;
  resolutionMethod: 'credit' | 'tng' | 'cash' | 'bank_transfer' | 'other' | 'data_corrected' | 'company_bear' | 'false_positive';
  resolutionRemark?: string;
  resolvedBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const status = await db.select().from(orderSpecialStatuses)
    .where(eq(orderSpecialStatuses.id, data.specialStatusId)).limit(1);
  if (status.length === 0) throw new Error("Special status not found");

  const specialStatus = status[0];
  const resolutionLabel: Record<string, string> = {
    credit: '转入Credit',
    tng: 'TNG退款',
    cash: 'Cash退款',
    bank_transfer: '银行转账退款',
    other: '其他',
    data_corrected: '数据修正',
    company_bear: '公司承担',
    false_positive: '误判',
  };

  await db.update(orderSpecialStatuses).set({
    status: 'resolved',
    resolutionMethod: data.resolutionMethod as any,
    resolutionRemark: data.resolutionRemark || null,
    resolvedBy: data.resolvedBy,
    resolvedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(orderSpecialStatuses.id, data.specialStatusId));

  // If over_payment and method is credit, add to customer's credit
  if (specialStatus.type === 'over_payment' && data.resolutionMethod === 'credit') {
    const order = await db.select().from(orders).where(eq(orders.id, specialStatus.orderId)).limit(1);
    if (order.length > 0 && order[0].customerId) {
      const amount = parseFloat(String(specialStatus.amount || '0'));
      if (amount > 0) {
        await refundCustomerCredit(order[0].customerId, amount, specialStatus.orderId, order[0].orderNumber || undefined);
      }
    }
  }

  await logOrderOperation(specialStatus.orderId, 'special_status', `特别状态已处理：${specialStatus.type}，方式：${resolutionLabel[data.resolutionMethod]}${data.resolutionRemark ? '，备注：' + data.resolutionRemark : ''}`, null, data.resolvedBy);

  // Check if order has any remaining pending special statuses
  const pendingStatuses = await db.select().from(orderSpecialStatuses)
    .where(and(
      eq(orderSpecialStatuses.orderId, specialStatus.orderId),
      eq(orderSpecialStatuses.status, 'pending')
    ));

  if (pendingStatuses.length === 0) {
    // No more pending special statuses → clear isSpecialOrder flag
    await db.update(orders).set({
      isSpecialOrder: false,
      specialOrderType: null as any,
      specialOrderStatus: 'resolved' as any,
      specialOrderUpdatedAt: new Date(),
    }).where(eq(orders.id, specialStatus.orderId));
    await logOrderOperation(specialStatus.orderId, 'special_status', '所有特别状态已处理，特别标签解除', null, data.resolvedBy);
  } else {
    // Still has pending statuses → keep isSpecialOrder, update type to first pending
    const firstPending = pendingStatuses[0];
    await db.update(orders).set({
      isSpecialOrder: true,
      specialOrderType: firstPending.type as any,
      specialOrderStatus: 'pending',
      specialOrderReason: firstPending.reason as any,
      specialOrderUpdatedAt: new Date(),
    }).where(eq(orders.id, specialStatus.orderId));
  }

  broadcastChanges(["orders", "dashboard"]);
  return { success: true };
}

// Get all special statuses for an order
export async function getOrderSpecialStatuses(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(orderSpecialStatuses)
    .where(eq(orderSpecialStatuses.orderId, orderId))
    .orderBy(desc(orderSpecialStatuses.createdAt));
}

// Get orders with pending special statuses (for Dashboard and filtering)
export async function getOrdersWithSpecialStatuses(filters?: {
  orderCategory?: 'local' | 'import';
  type?: string;
  status?: 'pending' | 'resolved' | 'cancelled' | 'false_positive';
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.type) conditions.push(eq(orderSpecialStatuses.type, filters.type as any));
  if (filters?.status) conditions.push(eq(orderSpecialStatuses.status, filters.status as any));

  const query = db.select({
    special: orderSpecialStatuses,
    orderNumber: orders.orderNumber,
    customerId: orders.customerId,
    orderCategory: orders.orderCategory,
    physicalStatus: orders.physicalStatus,
    importStatus: (orders as any).importStatus,
    totalAmount: orders.totalAmount,
    paidAmount: orders.paidAmount,
  })
    .from(orderSpecialStatuses)
    .innerJoin(orders, eq(orderSpecialStatuses.orderId, orders.id));

  if (conditions.length > 0) {
    // @ts-ignore
    query.where(and(...conditions));
  }

  if (filters?.orderCategory) {
    // @ts-ignore
    query.where(eq(orders.orderCategory, filters.orderCategory));
  }

  return await query.orderBy(desc(orderSpecialStatuses.createdAt));
}

// Migrate existing special order data to new table
export async function migrateSpecialOrdersToTable() {
  const db = await getDb();
  if (!db) return { migrated: 0 };

  // Find all orders with isSpecialOrder = true that don't have a corresponding entry in order_special_statuses
  const specialOrders = await db.select().from(orders)
    .where(eq(orders.isSpecialOrder, true));

  let migrated = 0;
  for (const order of specialOrders) {
    const existingType = (order as any).specialOrderType;
    if (!existingType) continue;

    // Check if already migrated
    const existing = await db.select().from(orderSpecialStatuses)
      .where(and(
        eq(orderSpecialStatuses.orderId, order.id),
        eq(orderSpecialStatuses.type, existingType as any),
      )).limit(1);

    if (existing.length === 0) {
      await db.insert(orderSpecialStatuses).values({
        orderId: order.id,
        type: existingType as any,
        status: ((order as any).specialOrderStatus || 'pending') as any,
        reason: (order as any).specialOrderReason || null,
        amount: '0',
        source: ((order as any).specialOrderSource || 'manual') as any,
        createdBy: (order as any).specialOrderBy || null,
      });
      migrated++;
    }
  }

  return { migrated };
}

// ============================================================================
// Cancel Order with reason and inventory release
// ============================================================================

export async function cancelOrderWithReason(id: number, reason: string, operator?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const order = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (order.length === 0) throw new Error("Order not found");
  if (order[0].physicalStatus === "cancelled") throw new Error("Order already cancelled");
  if (order[0].physicalStatus === "shipped" || order[0].physicalStatus === "completed") {
    throw new Error("Cannot cancel shipped or completed order");
  }

  await db.update(orders).set({
    physicalStatus: "cancelled",
    cancelReason: reason,
    cancelledBy: operator || null,
  }).where(eq(orders.id, id));

  // V2.1.30补充4: Release stock for ALL cancelled orders (not just live orders)
  // 取消即释放库存
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  for (const item of items) {
    if (item.productId) {
      if (item.variationId) {
        await db.update(productVariations).set({
          stockQuantity: sql`${productVariations.stockQuantity} + ${item.quantity}`,
        }).where(eq(productVariations.id, item.variationId));
      }
      await db.update(products).set({
        stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
      }).where(eq(products.id, item.productId));
    }
  }

  await logOrderOperation(id, "cancel", `Order cancelled: ${reason}`, null, operator);
  broadcastChanges(["orders", "dashboard", "inventory"]);
}

// ============================================================================
// Membership Fee Review helpers
// ============================================================================

export async function getMembershipReviews(filters?: {
  status?: string;
  flowStatus?: string;
  membershipStatus?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(membershipFeeReviews);
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(membershipFeeReviews.reviewStatus, filters.status as any));
  if (filters?.flowStatus) conditions.push(eq(membershipFeeReviews.flowStatus, filters.flowStatus as any));
  // V2.1.26: Filter by membershipStatus on the orders table
  if (filters?.membershipStatus) {
    const reviewOrderIds = await db.select({ orderId: orders.id })
      .from(orders)
      .where(eq(orders.membershipStatus, filters.membershipStatus as any));
    const orderIds = reviewOrderIds.map((r: any) => r.orderId);
    if (orderIds.length === 0) return [];
    conditions.push(inArray(membershipFeeReviews.orderId, orderIds));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return await query.orderBy(desc(membershipFeeReviews.createdAt));
}

export async function getMembershipReviewById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(membershipFeeReviews)
    .where(eq(membershipFeeReviews.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMembershipReviewByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(membershipFeeReviews)
    .where(eq(membershipFeeReviews.orderId, orderId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createMembershipReview(data: {
  orderId: number;
  receiptFileUrl: string;
  flowTemplateId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(membershipFeeReviews).values({
    orderId: data.orderId,
    receiptFileUrl: data.receiptFileUrl,
    receiptUploadedAt: new Date(),
    reviewStatus: "pending",
    flowStatus: "pending",
    flowTemplateId: data.flowTemplateId || null,
  });
}

export async function approveMembershipFee(reviewId: number, staffId: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(membershipFeeReviews).set({
    reviewStatus: "approved",
    reviewedByStaffId: staffId,
    reviewNotes: notes || null,
    reviewedAt: new Date(),
  }).where(eq(membershipFeeReviews.id, reviewId));
}

export async function rejectMembershipFee(reviewId: number, staffId: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(membershipFeeReviews).set({
    reviewStatus: "rejected",
    reviewedByStaffId: staffId,
    reviewNotes: notes || null,
    reviewedAt: new Date(),
  }).where(eq(membershipFeeReviews.id, reviewId));
}

export async function updateFlowStatus(reviewId: number, data: {
  flowStatus: "sent" | "failed";
  flowSentAt?: Date;
  flowErrorMessage?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(membershipFeeReviews).set({
    flowStatus: data.flowStatus,
    flowSentAt: data.flowSentAt || null,
    flowErrorMessage: data.flowErrorMessage || null,
  }).where(eq(membershipFeeReviews.id, reviewId));
}

export async function markTelegramLinkClicked(reviewId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(membershipFeeReviews).set({
    telegramLinkClicked: true,
    telegramLinkClickedAt: new Date(),
  }).where(eq(membershipFeeReviews.id, reviewId));
}

export async function markNeedsManualFollowUp(reviewId: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(membershipFeeReviews).set({
    needsManualFollowUp: true,
    followUpNotes: notes || null,
    followUpCount: sql`${membershipFeeReviews.followUpCount} + 1`,
  }).where(eq(membershipFeeReviews.id, reviewId));
}

// ============================================================================
// Flow Template helpers
// ============================================================================

export async function getFlowTemplates(activeOnly?: boolean) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(messengerFlowTemplates);
  if (activeOnly) query = query.where(eq(messengerFlowTemplates.isActive, true)) as any;
  return await query.orderBy(desc(messengerFlowTemplates.createdAt));
}

export async function getFlowTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(messengerFlowTemplates)
    .where(eq(messengerFlowTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createFlowTemplate(data: typeof messengerFlowTemplates.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(messengerFlowTemplates).values(data);
}

export async function updateFlowTemplate(id: number, data: Partial<typeof messengerFlowTemplates.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(messengerFlowTemplates).set(data).where(eq(messengerFlowTemplates.id, id));
}

export async function deleteFlowTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(messengerFlowTemplates).where(eq(messengerFlowTemplates.id, id));
}

// ============================================================================
// Flow Steps helpers
// ============================================================================

export async function getFlowStepsByTemplateId(templateId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(flowSteps)
    .where(eq(flowSteps.flowTemplateId, templateId))
    .orderBy(asc(flowSteps.stepOrder));
}

export async function createFlowStep(data: typeof flowSteps.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(flowSteps).values(data);
}

export async function updateFlowStep(id: number, data: Partial<typeof flowSteps.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(flowSteps).set(data).where(eq(flowSteps.id, id));
}

export async function deleteFlowStep(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(flowSteps).where(eq(flowSteps.id, id));
}

// ============================================================================
// Flow Send Log helpers
// ============================================================================

export async function createFlowSendLog(data: typeof flowSendLogs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(flowSendLogs).values(data);
}

export async function getFlowSendLogsByReviewId(reviewId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(flowSendLogs)
    .where(eq(flowSendLogs.reviewId, reviewId))
    .orderBy(asc(flowSendLogs.stepOrder));
}

// ============================================================================
// Dashboard statistics
// ============================================================================

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) {
    return {
      newMembershipOrders: 0,
      pendingReviews: 0,
      flowSent: 0,
      needsFollowUp: 0,
      membershipRevenue: "0",
      flowSuccessRate: 0,
    };
  }

  // Current month start
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // New membership orders this month
  const membershipOrders = await db.select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(and(
      sql`${orders.membershipStatus} IS NOT NULL`,
      gte(orders.createdAt, monthStart)
    ));

  // Pending reviews
  const pendingReviews = await db.select({ count: sql<number>`count(*)` })
    .from(membershipFeeReviews)
    .where(eq(membershipFeeReviews.reviewStatus, "pending"));

  // Flow sent
  const flowSent = await db.select({ count: sql<number>`count(*)` })
    .from(membershipFeeReviews)
    .where(eq(membershipFeeReviews.flowStatus, "sent"));

  // Needs follow-up - count orders with membershipStatus = manual_follow_up
  const needsFollowUp = await db.select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.membershipStatus, "manual_follow_up"));

  // Membership revenue this month
  const revenueResult = await db.select({
    total: sql<string>`COALESCE(SUM(${orders.membershipSubtotal}), 0)`,
  }).from(orders).where(gte(orders.createdAt, monthStart));

  // Flow success rate
  const totalFlows = await db.select({ count: sql<number>`count(*)` })
    .from(membershipFeeReviews)
    .where(or(
      eq(membershipFeeReviews.flowStatus, "sent"),
      eq(membershipFeeReviews.flowStatus, "failed")
    ));

  const sentCount = flowSent[0]?.count || 0;
  const totalCount = totalFlows[0]?.count || 0;
  const successRate = totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;

  return {
    newMembershipOrders: membershipOrders[0]?.count || 0,
    pendingReviews: pendingReviews[0]?.count || 0,
    flowSent: sentCount,
    needsFollowUp: needsFollowUp[0]?.count || 0,
    membershipRevenue: revenueResult[0]?.total || "0",
    flowSuccessRate: successRate,
  };
}

// ============================================================================
// Product Category helpers
// ============================================================================

export async function getProductCategories(activeOnly?: boolean) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(productCategories);
  if (activeOnly) query = query.where(eq(productCategories.isActive, true)) as any;
  return await query.orderBy(asc(productCategories.sortOrder));
}

export async function createProductCategory(data: typeof productCategories.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(productCategories).values(data);
}

export async function updateProductCategory(id: number, data: Partial<typeof productCategories.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productCategories).set(data).where(eq(productCategories.id, id));
}

export async function deleteProductCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productCategories).set({ isActive: false }).where(eq(productCategories.id, id));
}

// ============================================================================
// Supplier helpers
// ============================================================================

export async function getSuppliers(activeOnly?: boolean) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(suppliers);
  if (activeOnly) query = query.where(eq(suppliers.isActive, true)) as any;
  return await query.orderBy(desc(suppliers.createdAt));
}

export async function getSupplierById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createSupplier(data: typeof suppliers.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(suppliers).values(data);
}

export async function updateSupplier(id: number, data: Partial<typeof suppliers.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
}

export async function deleteSupplier(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, id));
}

// ============================================================================
// Purchase Order helpers
// ============================================================================

export async function getPurchaseOrders(filters?: { supplierId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(purchaseOrders);
  const conditions: any[] = [];
  if (filters?.supplierId) conditions.push(eq(purchaseOrders.supplierId, filters.supplierId));
  if (filters?.status) conditions.push(eq(purchaseOrders.status, filters.status as any));
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return await query.orderBy(desc(purchaseOrders.createdAt));
}

export async function getPurchaseOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPurchaseOrderItems(poId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
}

export async function createPurchaseOrder(data: {
  supplierId: number;
  poNumber?: string;
  notes?: string;
  items: Array<{
    productId: number;
    quantity: number;
    unitCost: string;
    subtotal: string;
    // V2.1: Variant-level purchase support
    variantName?: string;
    variantKeyword?: string;
    sellingPrice?: string;
  }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const totalAmount = data.items.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const poNumber = data.poNumber || `PO${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const poResult = await db.insert(purchaseOrders).values({
    poNumber,
    supplierId: data.supplierId,
    totalAmount: totalAmount.toFixed(2),
    status: "ordered",
    notes: data.notes || null,
    orderedAt: new Date(),
  });

  const poId = (poResult as any)[0].insertId;

  for (const item of data.items) {
    let variantId: number | null = null;

    // V2.1: If variantName is provided, auto-create or find variant
    if (item.variantName && item.variantKeyword) {
      const normalizedKeyword = item.variantKeyword.toUpperCase().replace(/\s+/g, '');
      // Check if variant already exists for this product with same keyword
      const existingVariant = await db.select().from(variants)
        .where(and(eq(variants.productId, item.productId), eq(variants.keyword, normalizedKeyword)))
        .limit(1);
      
      if (existingVariant.length > 0) {
        variantId = existingVariant[0].id;
        // Update variant selling price and cost if provided
        const updateData: any = {};
        if (item.sellingPrice) updateData.sellingPrice = item.sellingPrice;
        if (item.unitCost) updateData.currentCost = item.unitCost;
        if (Object.keys(updateData).length > 0) {
          await db.update(variants).set(updateData).where(eq(variants.id, variantId));
        }
      } else {
        // Auto-create new variant
        const product = await db.select({ sku: products.sku }).from(products).where(eq(products.id, item.productId)).limit(1);
        if (product.length > 0) {
          const variantSku = await generateVariantSku(product[0].sku);
          const variantResult = await db.insert(variants).values({
            productId: item.productId,
            name: item.variantName,
            keyword: normalizedKeyword,
            sku: variantSku,
            sellingPrice: item.sellingPrice || null,
            currentCost: item.unitCost || null,
            status: 'active',
            visibility: 'public',
            sortOrder: 0,
            stockQuantity: 0, // Will be updated when PO is received
          });
          variantId = (variantResult as any)[0].insertId;
          // Ensure product is in variant mode
          await db.update(products).set({ productMode: 'variant' }).where(eq(products.id, item.productId));
        }
      }
    }

    await db.insert(purchaseOrderItems).values({
      purchaseOrderId: poId,
      productId: item.productId,
      variantId: variantId || null,
      variantName: item.variantName || null,
      variantKeyword: item.variantKeyword || null,
      sellingPrice: item.sellingPrice || null,
      quantity: item.quantity,
      unitCost: item.unitCost,
      subtotal: item.subtotal,
    });

    // Update product cost immediately (latest purchase cost)
    // Also sync selling price if provided (V2.1)
    // V4: Auto-calculate wholesalePrice (×50%) and agentPrice (×70%) from sellingPrice
    const productUpdate: any = { cost: item.unitCost, currentCost: item.unitCost };
    if (item.sellingPrice) {
      productUpdate.sellingPrice = item.sellingPrice;
      // Auto-calculate wholesale and agent prices
      const sp = parseFloat(String(item.sellingPrice)) || 0;
      if (sp > 0) {
        productUpdate.wholesalePrice = Math.round(sp * 0.5 * 100) / 100;
        productUpdate.agentPrice = Math.round(sp * 0.7 * 100) / 100;
      }
    }
    await db.update(products).set(productUpdate).where(eq(products.id, item.productId));
  }

  return { poId, poNumber, totalAmount: totalAmount.toFixed(2) };
}

export async function receivePurchaseOrder(poId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Mark PO as received
  await db.update(purchaseOrders).set({
    status: "received",
    receivedAt: new Date(),
  }).where(eq(purchaseOrders.id, poId));

  // Increase stock for each item in the PO
  const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
  for (const item of items) {
    // Update product-level stock
    await db.update(products).set({
      stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
    }).where(eq(products.id, item.productId));
    
    // V2.1: Update variant-level stock if variantId is set
    if (item.variantId) {
      await db.update(variants).set({
        stockQuantity: sql`${variants.stockQuantity} + ${item.quantity}`,
      }).where(eq(variants.id, item.variantId));
    }
  }
}

/**
 * Returns the latest received purchase cost for one product from one supplier.
 * A quick restock deliberately uses a supplier-specific historical cost instead
 * of the product-wide current cost, so multi-supplier cost records are not mixed.
 */
export async function getLatestSupplierProductCost(productId: number, supplierId: number) {
  const db = await getDb();
  if (!db) return null;

  const [rows] = await db.execute(sql`
    SELECT poi.unitCost AS unitCost, po.poNumber AS poNumber, po.receivedAt AS receivedAt
    FROM purchase_order_items poi
    INNER JOIN purchase_orders po ON po.id = poi.purchaseOrderId
    WHERE poi.productId = ${productId}
      AND po.supplierId = ${supplierId}
      AND po.status = 'received'
    ORDER BY po.receivedAt DESC, poi.id DESC
    LIMIT 1
  `);
  const result = rows as unknown as Array<{ unitCost?: string | number; poNumber?: string; receivedAt?: Date | string }>;
  if (!result[0]?.unitCost) return null;

  return {
    unitCost: Number(result[0].unitCost),
    poNumber: result[0].poNumber || null,
    receivedAt: result[0].receivedAt || null,
  };
}

/**
 * Records an immediately received, supplier-specific replenishment from the
 * order creation page. It keeps the existing inventory adjustment audit trail
 * while also creating the purchase, FIFO lot and purchase ledger records used
 * by profitability reports.
 */
export async function quickRestockProduct(data: {
  productId: number;
  supplierId: number;
  quantity: number;
  remark?: string;
  adjustedBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const quantity = Math.floor(data.quantity);
  if (!Number.isFinite(quantity) || quantity < 1) throw new Error("Restock quantity must be at least 1");

  const [product] = await db.select({ id: products.id, name: products.name }).from(products)
    .where(eq(products.id, data.productId)).limit(1);
  if (!product) throw new Error("Product not found");

  const [supplier] = await db.select({ id: suppliers.id, name: suppliers.name, isActive: suppliers.isActive }).from(suppliers)
    .where(eq(suppliers.id, data.supplierId)).limit(1);
  if (!supplier || !supplier.isActive) throw new Error("Supplier not found or inactive");

  const latestCost = await getLatestSupplierProductCost(data.productId, data.supplierId);
  if (!latestCost || latestCost.unitCost <= 0) {
    throw new Error("此厂家尚无已收货的进货成本，请先在进货管理完成该商品的收货记录");
  }

  const unitCost = latestCost.unitCost;
  const totalAmount = Number((quantity * unitCost).toFixed(2));
  const now = new Date();
  const poNumber = `QR${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const fullRemark = ["后台建单快捷补货", data.remark?.trim()].filter(Boolean).join("：");

  // Create an already-received PO so the supplier and amount appear in purchase management.
  const poResult = await db.insert(purchaseOrders).values({
    poNumber,
    supplierId: data.supplierId,
    totalAmount: totalAmount.toFixed(2),
    status: "received",
    notes: fullRemark,
    orderedAt: now,
    receivedAt: now,
  });
  const poId = (poResult as any)[0].insertId as number;

  await db.insert(purchaseOrderItems).values({
    purchaseOrderId: poId,
    productId: data.productId,
    quantity,
    unitCost: unitCost.toFixed(2),
    subtotal: totalAmount.toFixed(2),
  });

  // Preserve the existing stock adjustment log and increment the product stock once.
  await createInventoryAdjustment({
    productId: data.productId,
    adjustmentType: "other",
    quantityChange: quantity,
    unitCost,
    totalCost: totalAmount,
    adjustedBy: data.adjustedBy,
    reason: "后台建单快捷补货",
    remark: `${supplier.name}｜${fullRemark}`,
  });

  await db.update(products).set({
    cost: unitCost.toFixed(2),
    currentCost: unitCost.toFixed(2),
  }).where(eq(products.id, data.productId));

  const [updatedProduct] = await db.select({ stockQuantity: products.stockQuantity }).from(products)
    .where(eq(products.id, data.productId)).limit(1);
  const balanceAfter = Number(updatedProduct?.stockQuantity ?? 0);
  const lotNo = `QR${Date.now()}${poId}`;

  const lotResult = await db.execute(sql`
    INSERT INTO inventory_lots
      (lot_no, purchase_order_id, supplier_id, product_id, variant_id, original_quantity, remaining_quantity, unit_cost, purchase_date, status)
    VALUES (${lotNo}, ${poId}, ${data.supplierId}, ${data.productId}, NULL, ${quantity}, ${quantity}, ${unitCost.toFixed(2)}, ${now}, 'active')
  `);
  const lotId = ((lotResult as any)[0]?.insertId ?? (lotResult as any).insertId) as number;

  await db.execute(sql`
    INSERT INTO inventory_ledger
      (product_id, variant_id, lot_id, transaction_type, reference_type, reference_id, quantity_change, balance_after, unit_cost, created_by)
    VALUES (${data.productId}, NULL, ${lotId}, 'purchase', 'quick_restock', ${poId}, ${quantity}, ${balanceAfter}, ${unitCost.toFixed(2)}, ${data.adjustedBy || 'admin'})
  `);

  // 已下单商品的库存占用在建单时已经成立。补货入库后只按本次入库数量
  // 分配最早的完整等待补货异常，不再次改变可售库存，避免重复扣减。
  const restockAllocation = await autoAllocateWaitingRestockForProduct(
    data.productId,
    quantity,
    data.adjustedBy || 'admin',
  );

  return {
    poId,
    poNumber,
    lotId,
    lotNo,
    supplierName: supplier.name,
    quantity,
    unitCost: unitCost.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    stockQuantity: balanceAfter,
    allocatedExceptionIds: restockAllocation.allocatedExceptionIds,
    allocatedQuantity: restockAllocation.allocatedQuantity,
    unallocatedRestockQuantity: restockAllocation.remainingQuantity,
  };
}

/**
 * Assign the physical quantity already reserved by an order to the oldest
 * available inventory lots. Product stock was deducted by the caller; this
 * routine only writes the supplier-cost allocation used by FIFO profit reports.
 */
async function allocateFifoCostForSale(data: {
  orderId: number;
  productId: number;
  quantity: number;
  createdBy?: string;
}) {
  const db = await getDb();
  if (!db || data.quantity <= 0) {
    return { allocatedQuantity: 0, unallocatedQuantity: Math.max(0, data.quantity) };
  }

  const [product] = await db.select({ stockQuantity: products.stockQuantity }).from(products)
    .where(eq(products.id, data.productId)).limit(1);
  let runningBalance = Number(product?.stockQuantity ?? 0) + data.quantity;
  const [lotRows] = await db.execute(sql`
    SELECT id, remaining_quantity AS remainingQuantity, unit_cost AS unitCost
    FROM inventory_lots
    WHERE product_id = ${data.productId}
      AND status = 'active'
      AND remaining_quantity > 0
    ORDER BY purchase_date ASC, id ASC
  `);
  const lots = lotRows as unknown as Array<{ id: number; remainingQuantity: number | string; unitCost: number | string }>;
  let remaining = data.quantity;
  let allocated = 0;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const available = Number(lot.remainingQuantity) || 0;
    const quantityFromLot = Math.min(remaining, available);
    if (quantityFromLot <= 0) continue;

    await db.execute(sql`
      UPDATE inventory_lots
      SET remaining_quantity = remaining_quantity - ${quantityFromLot},
          status = CASE WHEN remaining_quantity - ${quantityFromLot} <= 0 THEN 'depleted' ELSE 'active' END
      WHERE id = ${lot.id} AND remaining_quantity >= ${quantityFromLot}
    `);
    runningBalance -= quantityFromLot;
    await db.execute(sql`
      INSERT INTO inventory_ledger
        (product_id, variant_id, lot_id, transaction_type, reference_type, reference_id, quantity_change, balance_after, unit_cost, created_by)
      VALUES (${data.productId}, NULL, ${lot.id}, 'sale', 'order_sale', ${data.orderId}, ${-quantityFromLot}, ${runningBalance}, ${Number(lot.unitCost).toFixed(2)}, ${data.createdBy || 'system'})
    `);
    remaining -= quantityFromLot;
    allocated += quantityFromLot;
  }

  return { allocatedQuantity: allocated, unallocatedQuantity: remaining };
}

// ============================================================================
// Profit Report helpers
// ============================================================================

export async function getMonthlyProfitReport(year: number, month: number) {
  const db = await getDb();
  if (!db) {
    return {
      revenue: "0",
      cost: "0",
      profit: "0",
      profitMargin: 0,
      orderCount: 0,
      membershipRevenue: "0",
      physicalRevenue: "0",
      shippingRevenue: "0",
      productCost: "0",
      shippingCost: "0",
      details: [],
    };
  }

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  // Get all completed orders in the month
  const monthOrders = await db.select().from(orders)
    .where(and(
      gte(orders.createdAt, monthStart),
      lte(orders.createdAt, monthEnd),
      or(
        eq(orders.physicalStatus, "completed"),
        eq(orders.membershipStatus, "completed"),
      )
    ));

  let physicalRevenue = 0;
  let membershipRevenue = 0;
  let shippingRevenue = 0;
  let productCost = 0;
  let orderCount = monthOrders.length;

  const details: any[] = [];

  for (const order of monthOrders) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const orderPhysicalRevenue = parseFloat(order.physicalSubtotal || "0");
    const orderMembershipRevenue = parseFloat(order.membershipSubtotal || "0");
    const orderShipping = parseFloat(order.shippingFee || "0");

    physicalRevenue += orderPhysicalRevenue;
    membershipRevenue += orderMembershipRevenue;
    shippingRevenue += orderShipping;

    // Calculate cost from order items
    let orderCost = 0;
    for (const item of items) {
      // Get product cost
      const product = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (product.length > 0 && product[0].cost) {
        orderCost += parseFloat(product[0].cost) * item.quantity;
      }
    }
    productCost += orderCost;

    details.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      revenue: (orderPhysicalRevenue + orderMembershipRevenue + orderShipping).toFixed(2),
      cost: orderCost.toFixed(2),
      profit: (orderPhysicalRevenue + orderMembershipRevenue + orderShipping - orderCost).toFixed(2),
    });
  }

  const totalRevenue = physicalRevenue + membershipRevenue + shippingRevenue;
  const totalCost = productCost;
  const profit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0;

  return {
    revenue: totalRevenue.toFixed(2),
    cost: totalCost.toFixed(2),
    profit: profit.toFixed(2),
    profitMargin,
    orderCount,
    membershipRevenue: membershipRevenue.toFixed(2),
    physicalRevenue: physicalRevenue.toFixed(2),
    shippingRevenue: shippingRevenue.toFixed(2),
    productCost: productCost.toFixed(2),
    details,
  };
}

// ============================================================================
// Phase 1: Product Core Module - Category helpers
// ============================================================================

export async function getAllCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).orderBy(asc(categories.sortOrder));
}

export async function getActiveCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).where(eq(categories.status, 'active')).orderBy(asc(categories.sortOrder));
}

export async function getStoreCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories)
    .where(and(eq(categories.status, 'active'), eq(categories.showInStore, true)))
    .orderBy(asc(categories.sortOrder));
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result[0];
}

export async function createCategory(data: { nameZh: string; nameEn: string; descZh?: string; descEn?: string; showInStore?: boolean; sortOrder?: number; imageUrl?: string; iconUrl?: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(categories).values({
    nameZh: data.nameZh,
    nameEn: data.nameEn,
    descZh: data.descZh,
    descEn: data.descEn,
    showInStore: data.showInStore ?? true,
    sortOrder: data.sortOrder ?? 0,
    imageUrl: data.imageUrl,
    iconUrl: data.iconUrl,
  });
  return { id: result[0].insertId };
}

export async function updateCategory(id: number, data: Partial<{ nameZh: string; nameEn: string; descZh: string; descEn: string; status: 'active' | 'inactive'; showInStore: boolean; sortOrder: number; imageUrl: string; iconUrl: string }>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(categories).set(data).where(eq(categories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Check if any products use this category
  const productsInCategory = await db.select({ count: sql`count(*)` }).from(products).where(eq(products.categoryId, id));
  if (Number(productsInCategory[0]?.count) > 0) {
    return { success: false, reason: '此分类内仍有商品，不能删除' };
  }
  await db.delete(categories).where(eq(categories.id, id));
  return { success: true };
}

export async function reorderCategories(items: Array<{ id: number; sortOrder: number }>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  for (const item of items) {
    await db.update(categories).set({ sortOrder: item.sortOrder }).where(eq(categories.id, item.id));
  }
}

export async function countProductsInCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql`count(*)` }).from(products).where(eq(products.categoryId, categoryId));
  return Number(result[0]?.count) || 0;
}

// ============================================================================
// Phase 1: Unit helpers
// ============================================================================

export async function getAllUnits() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(units).where(eq(units.isActive, true)).orderBy(asc(units.sortOrder));
}

export async function createUnit(data: { nameZh: string; nameEn: string; isDefault?: boolean; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(units).values({
    nameZh: data.nameZh,
    nameEn: data.nameEn,
    isDefault: data.isDefault ?? false,
    sortOrder: data.sortOrder ?? 0,
  });
  return { id: result[0].insertId };
}

// ============================================================================
// Phase 1: Product helpers (enhanced)
// ============================================================================

export async function generateSku(mode: 'simple' | 'variant'): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const prefix = mode === 'simple' ? 'XTN-P' : 'XTN-V';
  // Find the max number for this prefix
  const result = await db.select({ maxSku: sql`MAX(sku)` }).from(products)
    .where(like(products.sku, `${prefix}-%`));
  const maxSku = result[0]?.maxSku as string | null;
  let nextNum = 1;
  if (maxSku) {
    const match = maxSku.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `${prefix}-${String(nextNum).padStart(6, '0')}`;
}

export async function generateVariantSku(productSku: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Find max variant number for this product
  const result = await db.select({ maxSku: sql`MAX(sku)` }).from(variants)
    .where(like(variants.sku, `${productSku}-%`));
  const maxSku = result[0]?.maxSku as string | null;
  let nextNum = 1;
  if (maxSku) {
    const match = maxSku.match(/-(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `${productSku}-${String(nextNum).padStart(2, '0')}`;
}

export async function checkKeywordConflict(keyword: string, excludeProductId?: number) {
  const db = await getDb();
  if (!db) return { available: true };
  const normalizedKeyword = keyword.toUpperCase().replace(/\s+/g, '');
  const conditions = [eq(products.keyword, normalizedKeyword)];
  if (excludeProductId) {
    conditions.push(ne(products.id, excludeProductId));
  }
  const result = await db.select({ id: products.id, name: products.name })
    .from(products).where(and(...conditions)).limit(1);
  if (result.length > 0) {
    return { available: false, conflictWith: result[0] };
  }
  return { available: true };
}

export async function checkVariantKeywordConflict(productId: number, keyword: string, excludeVariantId?: number) {
  const db = await getDb();
  if (!db) return { available: true };
  const normalizedKeyword = keyword.toUpperCase().replace(/\s+/g, '');
  const conditions = [eq(variants.productId, productId), eq(variants.keyword, normalizedKeyword)];
  if (excludeVariantId) {
    conditions.push(ne(variants.id, excludeVariantId));
  }
  const result = await db.select({ id: variants.id, name: variants.name })
    .from(variants).where(and(...conditions)).limit(1);
  if (result.length > 0) {
    return { available: false, conflictWith: result[0] };
  }
  return { available: true };
}

export async function getProductsEnhanced(params: {
  search?: string;
  categoryId?: number;
  status?: string;
  productMode?: string;
  visibility?: string;
  type?: string;
  isFeatured?: boolean;
  importEligibility?: 'eligible' | 'ineligible';
  stockFilter?: string;
  stockThreshold?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [];
  if (params.search) {
    const searchTerm = `%${params.search}%`;
    conditions.push(or(like(products.name, searchTerm), like(products.keyword, searchTerm)));
  }
  if (params.categoryId) {
    conditions.push(eq(products.categoryId, params.categoryId));
  }
  if (params.status) {
    conditions.push(eq(products.status, params.status as any));
  }
  if (params.productMode) {
    conditions.push(eq(products.productMode, params.productMode as any));
  }
  if (params.visibility) {
    conditions.push(eq(products.visibility, params.visibility as any));
  }
  if (params.type) {
    conditions.push(eq(products.type, params.type as any));
  }
  if (params.isFeatured !== undefined) {
    conditions.push(eq(products.isFeatured, params.isFeatured));
  }
  if (params.importEligibility === 'eligible') {
    // 中国进口商品固有可入 XTC；本地商品必须由管理员明确开启授权才可入 XTC。
    conditions.push(or(
      eq(products.salesMode, 'import_preorder'),
      eq(products.allowImportOrder, true),
    ));
  }
  if (params.importEligibility === 'ineligible') {
    conditions.push(and(
      ne(products.salesMode, 'import_preorder'),
      or(isNull(products.allowImportOrder), eq(products.allowImportOrder, false)),
    ));
  }
  if (params.stockFilter === 'low') {
    const stockThreshold = Math.max(1, Math.floor(params.stockThreshold ?? 5));
    conditions.push(eq(products.type, 'physical'));
    conditions.push(lt(products.stockQuantity, stockThreshold));
    conditions.push(gt(products.stockQuantity, 0));
  }
  if (params.stockFilter === 'out') {
    conditions.push(eq(products.type, 'physical'));
    conditions.push(eq(products.stockQuantity, 0));
  }
  if (params.stockFilter === 'anomaly') {
    // 未开启允许超卖的实体商品不应为负库存；此筛选用于处理历史库存异常。
    conditions.push(eq(products.type, 'physical'));
    conditions.push(lt(products.stockQuantity, 0));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const items = await db.select().from(products)
    .where(where)
    .orderBy(desc(products.createdAt))
    .limit(limit)
    .offset(offset);
  const countResult = await db.select({ count: sql`count(*)` }).from(products).where(where);
  const total = Number(countResult[0]?.count) || 0;

  // 库存的唯一事实来源是 products.stockQuantity：订单成立时已原子扣减。
  // 已下单／已完成仅用于解释该原始库存如何被占用，绝不再从 stockQuantity 二次扣除。
  // 对部分发货订单，必须按 package_items 的实际已发数量逐项拆分，不能将整张订单全部转为已完成。
  const productIds = items.map((p: any) => p.id);
  let orderedMap: Record<number, number> = {};
  let paidMap: Record<number, number> = {};
  let completedMap: Record<number, number> = {};
  if (productIds.length > 0) {
    // 三阶段必须互斥：未完成汇款的订单计入已下单；已确认全额汇款的待包货
    // 订单计入已汇款；已实际进入 shipped 包裹的数量计入已完成。
    // legacy special 订单依已付款金额分流，避免该历史状态造成数量遗失或重复。
    const orderedItems = await db.execute(sql`
      SELECT
        oi.productId,
        COALESCE(SUM(oi.quantity), 0) AS orderedQty
      FROM order_items oi
      JOIN orders o ON o.id = oi.orderId
      WHERE (
        o.physicalStatus IN ('pending', 'hold_order', 'partial_payment', 'receipt_uploaded')
        OR (o.physicalStatus = 'special' AND COALESCE(o.paidAmount, 0) < COALESCE(o.totalAmount, 0))
      )
      AND oi.productId IN (${sql.join(productIds, sql`, `)})
      GROUP BY oi.productId
    `);
    for (const row of orderedItems as any[]) {
      orderedMap[row.productId] = Number(row.orderedQty) || 0;
    }
    const paidItems = await db.execute(sql`
      SELECT
        oi.productId,
        COALESCE(SUM(
          CASE
            WHEN o.physicalStatus = 'partial_shipped'
              THEN GREATEST(oi.quantity - COALESCE(shipped_items.shippedQty, 0), 0)
            ELSE oi.quantity
          END
        ), 0) AS paidQty
      FROM order_items oi
      JOIN orders o ON o.id = oi.orderId
      LEFT JOIN (
        SELECT pi.orderItemId, COALESCE(SUM(pi.quantity), 0) AS shippedQty
        FROM package_items pi
        JOIN packages pkg ON pkg.id = pi.packageId
        WHERE pkg.status = 'shipped'
        GROUP BY pi.orderItemId
      ) shipped_items ON shipped_items.orderItemId = oi.id
      WHERE (
        o.physicalStatus IN ('packing', 'scheduled', 'partial_shipped')
        OR (o.physicalStatus = 'special' AND COALESCE(o.totalAmount, 0) > 0 AND COALESCE(o.paidAmount, 0) >= COALESCE(o.totalAmount, 0))
      )
      AND oi.productId IN (${sql.join(productIds, sql`, `)})
      GROUP BY oi.productId
    `);
    for (const row of paidItems as any[]) {
      paidMap[row.productId] = Number(row.paidQty) || 0;
    }
    // 已完成：整单已发／已完成的全部数量，加上部分发货订单中已经进入包裹的数量。
    // 已处理退款中「退回可售库存」的数量代表商品未最终成交，必须从已完成数量扣除；
    // 报损／不退库不扣除，因为商品仍由客户持有，原订单成本也应继续保留。
    const completedItems = await db.execute(sql`
      SELECT
        oi.productId,
        COALESCE(SUM(
          CASE
            WHEN o.physicalStatus IN ('shipped', 'completed')
              THEN GREATEST(oi.quantity - COALESCE(returned_items.returnedQty, 0), 0)
            WHEN o.physicalStatus = 'partial_shipped'
              THEN GREATEST(LEAST(oi.quantity, COALESCE(shipped_items.shippedQty, 0)) - COALESCE(returned_items.returnedQty, 0), 0)
            ELSE 0
          END
        ), 0) AS completedQty
      FROM order_items oi
      JOIN orders o ON o.id = oi.orderId
      LEFT JOIN (
        SELECT pi.orderItemId, COALESCE(SUM(pi.quantity), 0) AS shippedQty
        FROM package_items pi
        JOIN packages pkg ON pkg.id = pi.packageId
        WHERE pkg.status = 'shipped'
        GROUP BY pi.orderItemId
      ) shipped_items ON shipped_items.orderItemId = oi.id
      LEFT JOIN (
        SELECT ri.orderItemId, COALESCE(SUM(ri.refundQuantity), 0) AS returnedQty
        FROM order_refund_items ri
        JOIN order_refunds refund ON refund.id = ri.refundId
        WHERE ri.inventoryTreatment = 'return_to_sale'
          AND ri.inventoryActionStatus = 'returned'
          AND refund.status IN ('processed', 'awaiting_return')
        GROUP BY ri.orderItemId
      ) returned_items ON returned_items.orderItemId = oi.id
      WHERE o.physicalStatus IN ('partial_shipped', 'shipped', 'completed')
      AND oi.productId IN (${sql.join(productIds, sql`, `)})
      GROUP BY oi.productId
    `);
    for (const row of completedItems as any[]) {
      completedMap[row.productId] = Number(row.completedQty) || 0;
    }
  }
  const itemsWithStageQuantities = items.map((p: any) => ({
    ...p,
    // pendingQuantity retained only as a compatibility alias for historical callers.
    pendingQuantity: orderedMap[p.id] || 0,
    orderedCount: orderedMap[p.id] || 0,
    paidCount: paidMap[p.id] || 0,
    completedCount: completedMap[p.id] || 0,
    // 正式订单已在下单时写入 stockQuantity；尚未转正式订单的 AI 草稿
    // 记录在 reservedQuantity，因此前端可售数只需额外扣除这一类临时预留。
    // 不得再从这里扣 pendingMap，否则会对正式订单发生二次扣减。
    availableQuantity: Math.max(0, Number(p.stockQuantity || 0) - Number(p.reservedQuantity || 0)),
  }));

  return { items: itemsWithStageQuantities, total };
}

/**
 * Returns the concrete orders behind a product's mutually exclusive order-stage counters.
 * The status groups intentionally mirror getProductsEnhanced so the dialog
 * always explains the exact number displayed in Products V2.
 */
export async function getProductOrderDetails(productId: number, type: 'ordered' | 'paid' | 'completed') {
  const db = await getDb();
  if (!db) return [];

  const statusCondition = type === 'ordered'
    ? sql`(o.physicalStatus IN ('pending', 'hold_order', 'partial_payment', 'receipt_uploaded') OR (o.physicalStatus = 'special' AND COALESCE(o.paidAmount, 0) < COALESCE(o.totalAmount, 0)))`
    : type === 'paid'
      ? sql`(o.physicalStatus IN ('packing', 'scheduled', 'partial_shipped') OR (o.physicalStatus = 'special' AND COALESCE(o.totalAmount, 0) > 0 AND COALESCE(o.paidAmount, 0) >= COALESCE(o.totalAmount, 0)))`
      : sql`o.physicalStatus IN ('shipped', 'completed', 'partial_shipped')`;
  const stageQuantity = type === 'completed'
    ? sql`CASE WHEN o.physicalStatus = 'partial_shipped' THEN GREATEST(LEAST(oi.quantity, COALESCE(shipped_items.shippedQty, 0)) - COALESCE(returned_items.returnedQty, 0), 0) ELSE GREATEST(oi.quantity - COALESCE(returned_items.returnedQty, 0), 0) END`
    : type === 'paid'
      ? sql`CASE WHEN o.physicalStatus = 'partial_shipped' THEN GREATEST(oi.quantity - COALESCE(shipped_items.shippedQty, 0), 0) ELSE oi.quantity END`
      : sql`oi.quantity`;

  const rows = await db.execute(sql`
    SELECT
      o.id AS orderId,
      o.orderNumber AS orderNumber,
      o.physicalStatus AS physicalStatus,
      ${stageQuantity} AS quantity,
      COALESCE(
        NULLIF(o.facebookName, ''),
        NULLIF(c.facebookName, ''),
        NULLIF(c.name, ''),
        NULLIF(c.displayName, ''),
        '—'
      ) AS customerName,
      COALESCE(c.phoneNumber, c.whatsappPhone, '') AS customerPhone
    FROM order_items oi
    JOIN orders o ON o.id = oi.orderId
    LEFT JOIN customers c ON c.id = o.customerId
    LEFT JOIN (
      SELECT pi.orderItemId, COALESCE(SUM(pi.quantity), 0) AS shippedQty
      FROM package_items pi
      JOIN packages pkg ON pkg.id = pi.packageId
      WHERE pkg.status = 'shipped'
      GROUP BY pi.orderItemId
    ) shipped_items ON shipped_items.orderItemId = oi.id
    LEFT JOIN (
      SELECT ri.orderItemId, COALESCE(SUM(ri.refundQuantity), 0) AS returnedQty
      FROM order_refund_items ri
      JOIN order_refunds refund ON refund.id = ri.refundId
      WHERE ri.inventoryTreatment = 'return_to_sale'
        AND ri.inventoryActionStatus = 'returned'
        AND refund.status IN ('processed', 'awaiting_return')
      GROUP BY ri.orderItemId
    ) returned_items ON returned_items.orderItemId = oi.id
    WHERE oi.productId = ${productId}
      AND ${statusCondition}
      AND ${type === 'completed' || type === 'paid' ? sql`${stageQuantity} > 0` : sql`1 = 1`}
    ORDER BY o.createdAt DESC, oi.id DESC
  `);

  return unwrapMySqlRows<{
    orderId: number;
    orderNumber: string;
    physicalStatus: string;
    quantity: number;
    customerName: string;
    customerPhone: string | null;
  }>(rows);
}

export async function getProductByIdEnhanced(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const productResult = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (productResult.length === 0) return undefined;
  const product = productResult[0];
  const images = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.sortOrder));
  const videos = await db.select().from(productVideos).where(eq(productVideos.productId, id)).orderBy(asc(productVideos.sortOrder));
  const variantList = await db.select().from(variants).where(eq(variants.productId, id)).orderBy(asc(variants.sortOrder));
  const links = await db.select().from(memberLinks).where(eq(memberLinks.productId, id));
  const attrs = await db.select().from(productAttributes).where(eq(productAttributes.productId, id)).orderBy(asc(productAttributes.sortOrder));
  return { ...product, images, videos, variants: variantList, memberLinks: links, attributes: attrs };
}

export async function createProductEnhanced(data: {
  name: string;
  type: 'physical' | 'membership' | 'gift';
  productMode: 'simple' | 'variant';
  categoryId?: number;
  unitId?: number;
  keyword: string;
  sku?: string;
  status?: string;
  visibility?: string;
  priceVisibility?: string;
  shortDescZh?: string;
  shortDescEn?: string;
  fullDescZh?: string;
  fullDescEn?: string;
  careZh?: string;
  careEn?: string;
  sellingPrice?: string;
  compareAtPrice?: string;
  memberPrice?: string;
  currentCost?: string;
  specialPrice?: string;
  dimensions?: any;
  weightKg?: string;
  stockQuantity?: number;
  isFeatured?: boolean;
  featuredSortOrder?: number;
  isMemberOnly?: boolean;
  membershipIntro?: string;
  telegramFlowLink?: string;
  allowStandalonePurchase?: boolean;
  allowMixedCheckout?: boolean;
  allowImportOrder?: boolean;
  notes?: string;
  coverImageUrl?: string;
  images?: string;
  videoUrl?: string;
  description?: string;
  isSpecial?: boolean;
  allowPresale?: boolean;
  allowStandaloneShipping?: boolean;
  standaloneShippingMethod?: string;
  standaloneShippingFee?: string;
  lightDesc?: string;
  waterDesc?: string;
  fertilizerDesc?: string;
  pruningDesc?: string;
  syncToMall?: boolean;
  mallSortOrder?: number;
  isPot?: boolean;
  potCapacity?: string;
  productImages?: string[];
  // V4: Wholesale & Agent
  wholesalePrice?: number;
  agentPrice?: number;
  moq?: number;
  visibleTo?: string;
  specialPriceStartDate?: string;
  specialPriceEndDate?: string;
  keywordChannels?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const normalizedKeyword = data.keyword.toUpperCase().replace(/\s+/g, '');
  const sku = data.sku || await generateSku(data.productMode);
  // Convert empty strings to null for decimal columns (MySQL rejects '' for DECIMAL type)
  const decimalFields = ['sellingPrice', 'compareAtPrice', 'memberPrice', 'currentCost', 'specialPrice', 'weightKg', 'standaloneShippingFee', 'wholesalePrice', 'agentPrice'];
  const normalizedData: any = {};
  for (const field of decimalFields) {
    if (field in data && (data as any)[field] === '') {
      normalizedData[field] = null;
    } else {
      normalizedData[field] = (data as any)[field];
    }
  }
  const result = await db.insert(products).values({
    name: data.name,
    type: data.type,
    productMode: data.productMode,
    categoryId: data.categoryId,
    unitId: data.unitId,
    keyword: normalizedKeyword,
    sku,
    status: (data.status as any) || 'draft',
    visibility: (data.visibility as any) || 'public',
    priceVisibility: (data.priceVisibility as any) || 'show',
    shortDescZh: data.shortDescZh,
    shortDescEn: data.shortDescEn,
    fullDescZh: data.fullDescZh,
    fullDescEn: data.fullDescEn,
    careZh: data.careZh,
    careEn: data.careEn,
    sellingPrice: normalizedData.sellingPrice,
    compareAtPrice: normalizedData.compareAtPrice,
    memberPrice: normalizedData.memberPrice,
    specialPrice: normalizedData.specialPrice,
    currentCost: normalizedData.currentCost,
    dimensions: data.dimensions,
    weightKg: normalizedData.weightKg,
    stockQuantity: data.stockQuantity,
    isFeatured: data.isFeatured ?? false,
    featuredSortOrder: data.featuredSortOrder ?? 0,
    membershipIntro: data.membershipIntro,
    telegramFlowLink: data.telegramFlowLink,
    allowStandalonePurchase: data.allowStandalonePurchase,
    allowMixedCheckout: data.allowMixedCheckout,
    allowImportOrder: data.allowImportOrder ?? false,
    notes: data.notes,
    coverImageUrl: data.coverImageUrl,
    images: data.images,
    videoUrl: data.videoUrl,
    description: data.description,
    isSpecial: data.isSpecial ?? false,
    // allowPresale 是商品级唯一业务开关；allowOversold 仅为历史库存守卫兼容字段。
    allowPresale: data.allowPresale ?? false,
    allowOversold: data.allowPresale ?? false,
    allowStandaloneShipping: data.allowStandaloneShipping ?? false,
    standaloneShippingMethod: (data.standaloneShippingMethod as any) || 'fixed_fee',
    standaloneShippingFee: normalizedData.standaloneShippingFee,
    lightDesc: data.lightDesc,
    waterDesc: data.waterDesc,
    fertilizerDesc: data.fertilizerDesc,
    pruningDesc: data.pruningDesc,
    syncToMall: data.syncToMall ?? false,
    mallSortOrder: data.mallSortOrder ?? 0,
    isPot: data.isPot ?? false,
    potCapacity: data.potCapacity,
    // V4: Wholesale & Agent
    wholesalePrice: normalizedData.wholesalePrice as any,
    agentPrice: normalizedData.agentPrice as any,
    moq: data.moq ?? 0,
    visibleTo: data.visibleTo,
    specialPriceStartDate: data.specialPriceStartDate ? new Date(data.specialPriceStartDate) : null,
    specialPriceEndDate: data.specialPriceEndDate ? new Date(data.specialPriceEndDate) : null,
    keywordChannels: data.keywordChannels || null,
  });
  const productId = result[0].insertId;
  // Save product images to product_images table
  if (data.productImages && data.productImages.length > 0) {
    for (let i = 0; i < data.productImages.length; i++) {
      const url = data.productImages[i];
      const fileKey = url.replace(/^.*\/manus-storage\//, '');
      await db.insert(productImages).values({
        productId,
        url,
        fileKey,
        sortOrder: i,
        isMain: i === 0,
      });
    }
  }
  return { id: productId, sku };
}

export async function updateProductEnhanced(id: number, data: Partial<{
  name: string;
  type: 'physical' | 'membership' | 'gift';
  productMode: 'simple' | 'variant';
  categoryId: number;
  unitId: number;
  keyword: string;
  status: string;
  visibility: string;
  priceVisibility: string;
  shortDescZh: string;
  shortDescEn: string;
  fullDescZh: string;
  fullDescEn: string;
  careZh: string;
  careEn: string;
  sellingPrice: string;
  compareAtPrice: string;
  memberPrice: string;
  currentCost: string;
  specialPrice: string;
  dimensions: any;
  weightKg: string;
  stockQuantity: number;
  isFeatured: boolean;
  featuredSortOrder: number;
  isMemberOnly: boolean;
  membershipIntro: string;
  telegramFlowLink: string;
  allowStandalonePurchase: boolean;
  allowMixedCheckout: boolean;
  allowImportOrder: boolean;
  notes: string;
  coverImageUrl: string;
  images: string;
  videoUrl: string;
  description: string;
  isSpecial: boolean;
  allowPresale: boolean;
  allowOversold: boolean;
  allowStandaloneShipping: boolean;
  standaloneShippingMethod: string;
  standaloneShippingFee: string;
  lightDesc: string;
  waterDesc: string;
  fertilizerDesc: string;
  pruningDesc: string;
  syncToMall: boolean;
  mallSortOrder: number;
  isPot: boolean;
  potCapacity: string;
  productImages: string[];
  // V4: Wholesale & Agent
  wholesalePrice: number;
  agentPrice: number;
  moq: number;
  visibleTo: string;
  specialPriceStartDate: string;
  specialPriceEndDate: string;
  keywordChannels: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const { productImages: imageUrls, ...updateData } = data;
  // 统一预售语义：新界面只写 allowPresale；旧入口若仍写 allowOversold，则同步回商品级开关。
  if (updateData.allowPresale !== undefined) {
    (updateData as any).allowOversold = updateData.allowPresale;
  } else if ((updateData as any).allowOversold !== undefined) {
    (updateData as any).allowPresale = (updateData as any).allowOversold;
  }
  if (data.keyword) {
    updateData.keyword = data.keyword.toUpperCase().replace(/\s+/g, '');
  }
  // Convert empty strings to null for decimal columns (MySQL rejects '' for DECIMAL type)
  const decimalFields = ['sellingPrice', 'compareAtPrice', 'memberPrice', 'currentCost', 'specialPrice', 'weightKg', 'standaloneShippingFee', 'wholesalePrice', 'agentPrice'];
  for (const field of decimalFields) {
    if (field in updateData && (updateData as any)[field] === '') {
      (updateData as any)[field] = null;
    }
  }
  // V4: Convert date strings to Date objects for timestamp fields
  if (updateData.specialPriceStartDate !== undefined) {
    (updateData as any).specialPriceStartDate = updateData.specialPriceStartDate ? new Date(updateData.specialPriceStartDate) : null;
  }
  if (updateData.specialPriceEndDate !== undefined) {
    (updateData as any).specialPriceEndDate = updateData.specialPriceEndDate ? new Date(updateData.specialPriceEndDate) : null;
  }
  await db.update(products).set(updateData as any).where(eq(products.id, id));
  // Sync coverImageUrl to live_room_products.imageUrl so Live Studio always shows the latest product image
  if (updateData.coverImageUrl !== undefined) {
    await db.update(liveRoomProducts).set({ imageUrl: updateData.coverImageUrl || null }).where(eq(liveRoomProducts.productId, id));
  }
  // Sync product images if provided
  if (imageUrls) {
    // Delete existing images and re-insert
    await db.delete(productImages).where(eq(productImages.productId, id));
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      const fileKey = url.replace(/^.*\/manus-storage\//, '');
      await db.insert(productImages).values({
        productId: id,
        url,
        fileKey,
        sortOrder: i,
        isMain: i === 0,
      });
    }
  }
}

export async function deleteProductEnhanced(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Check if product has orders
  const orderCount = await db.select({ count: sql`count(*)` }).from(orderItems).where(eq(orderItems.productId, id));
  if (Number(orderCount[0]?.count) > 0) {
    return { success: false, reason: '此商品已有订单记录，只能停用不能删除' };
  }
  // Delete related data
  await db.delete(productImages).where(eq(productImages.productId, id));
  await db.delete(productVideos).where(eq(productVideos.productId, id));
  await db.delete(variants).where(eq(variants.productId, id));
  await db.delete(memberLinks).where(eq(memberLinks.productId, id));
  await db.delete(productAttributes).where(eq(productAttributes.productId, id));
  await db.delete(products).where(eq(products.id, id));
  return { success: true };
}

// ============================================================================
// Phase 1: Product Images helpers
// ============================================================================

export async function addProductImage(data: { productId: number; url: string; fileKey: string; sortOrder?: number; isMain?: boolean; altText?: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // If isMain, unset other main images
  if (data.isMain) {
    await db.update(productImages).set({ isMain: false }).where(eq(productImages.productId, data.productId));
  }
  const result = await db.insert(productImages).values({
    productId: data.productId,
    url: data.url,
    fileKey: data.fileKey,
    sortOrder: data.sortOrder ?? 0,
    isMain: data.isMain ?? false,
    altText: data.altText,
  });
  return { id: result[0].insertId };
}

export async function deleteProductImage(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(productImages).where(eq(productImages.id, id));
}

export async function updateProductImageOrder(id: number, sortOrder: number, isMain?: boolean) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const updateData: any = { sortOrder };
  if (isMain !== undefined) {
    if (isMain) {
      // Get productId first
      const img = await db.select().from(productImages).where(eq(productImages.id, id)).limit(1);
      if (img.length > 0) {
        await db.update(productImages).set({ isMain: false }).where(eq(productImages.productId, img[0].productId));
      }
    }
    updateData.isMain = isMain;
  }
  await db.update(productImages).set(updateData).where(eq(productImages.id, id));
}

// ============================================================================
// Phase 1: Product Videos helpers
// ============================================================================

export async function addProductVideo(data: { productId: number; url: string; fileKey: string; sortOrder?: number; isMain?: boolean; thumbnailUrl?: string; duration?: number; altText?: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (data.isMain) {
    await db.update(productVideos).set({ isMain: false }).where(eq(productVideos.productId, data.productId));
  }
  const result = await db.insert(productVideos).values({
    productId: data.productId,
    url: data.url,
    fileKey: data.fileKey,
    sortOrder: data.sortOrder ?? 0,
    isMain: data.isMain ?? false,
    thumbnailUrl: data.thumbnailUrl,
    duration: data.duration,
    altText: data.altText,
  });
  return { id: result[0].insertId };
}

export async function deleteProductVideo(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(productVideos).where(eq(productVideos.id, id));
}

// ============================================================================
// Phase 1: Variant helpers
// ============================================================================

export async function createVariant(data: {
  productId: number;
  name: string;
  keyword: string;
  sku?: string;
  sellingPrice?: string;
  compareAtPrice?: string;
  memberPrice?: string;
  estimatedCost?: string;
  currentCost?: string;
  weight?: string;
  dimensions?: any;
  status?: string;
  visibility?: string;
  sortOrder?: number;
  imageUrl?: string;
  stockQuantity?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const normalizedKeyword = data.keyword.toUpperCase().replace(/\s+/g, '');
  // Get product SKU to generate variant SKU
  const product = await db.select({ sku: products.sku }).from(products).where(eq(products.id, data.productId)).limit(1);
  if (product.length === 0) throw new Error('Product not found');
  const sku = data.sku || await generateVariantSku(product[0].sku);
  const result = await db.insert(variants).values({
    productId: data.productId,
    name: data.name,
    keyword: normalizedKeyword,
    sku,
    sellingPrice: data.sellingPrice,
    compareAtPrice: data.compareAtPrice,
    memberPrice: data.memberPrice,
    estimatedCost: data.estimatedCost,
    currentCost: data.currentCost,
    weight: data.weight,
    dimensions: data.dimensions,
    status: (data.status as any) || 'active',
    visibility: (data.visibility as any) || 'public',
    sortOrder: data.sortOrder ?? 0,
    imageUrl: data.imageUrl,
    stockQuantity: 0,
  });
  return { id: result[0].insertId, sku };
}

export async function updateVariant(id: number, data: Partial<{
  name: string;
  keyword: string;
  sellingPrice: string;
  compareAtPrice: string;
  memberPrice: string;
  estimatedCost: string;
  currentCost: string;
  weight: string;
  dimensions: any;
  status: string;
  visibility: string;
  sortOrder: number;
  imageUrl: string;
  stockQuantity: number;
}>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const updateData: any = { ...data };
  // Variant quantities are maintained by purchase, order and inventory-ledger flows only.
  delete updateData.stockQuantity;
  if (data.keyword) {
    updateData.keyword = data.keyword.toUpperCase().replace(/\s+/g, '');
  }
  await db.update(variants).set(updateData).where(eq(variants.id, id));
}

export async function deleteVariant(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(variants).where(eq(variants.id, id));
}

// ============================================================================
// Phase 1: Member Link helpers
// ============================================================================

export async function generateMemberLink(productId: number): Promise<{ token: string; url: string }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Deactivate existing links
  await db.update(memberLinks).set({ isActive: false }).where(eq(memberLinks.productId, productId));
  // Generate new token using nanoid-like approach
  const token = generateToken(32);
  await db.insert(memberLinks).values({
    productId,
    token,
    isActive: true,
  });
  const url = `/m/${token}`;
  return { token, url };
}

export async function getMemberLinkByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const linkResult = await db.select().from(memberLinks)
    .where(and(eq(memberLinks.token, token), eq(memberLinks.isActive, true)))
    .limit(1);
  if (linkResult.length === 0) return undefined;
  const link = linkResult[0];
  // Check expiry
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return undefined;
  }
  // Get product with member price
  const productResult = await db.select().from(products).where(eq(products.id, link.productId)).limit(1);
  if (productResult.length === 0) return undefined;
  const product = productResult[0];
  const images = await db.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(asc(productImages.sortOrder));
  const videos = await db.select().from(productVideos).where(eq(productVideos.productId, product.id)).orderBy(asc(productVideos.sortOrder));
  const variantList = await db.select().from(variants).where(eq(variants.productId, product.id)).orderBy(asc(variants.sortOrder));
  return {
    ...product,
    images,
    videos,
    variants: variantList,
    // Include memberPrice for member link API
    memberPrice: product.memberPrice,
  };
}

export async function deactivateMemberLink(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(memberLinks).set({ isActive: false }).where(eq(memberLinks.id, linkId));
}

export async function getMemberLinksByProductId(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memberLinks).where(eq(memberLinks.productId, productId)).orderBy(desc(memberLinks.createdAt));
}

// ============================================================================
// Phase 1: Product Attributes helpers
// ============================================================================

export async function addProductAttribute(data: { productId: number; attributeName: string; attributeValue: string; sortOrder?: number; isFilterable?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(productAttributes).values({
    productId: data.productId,
    attributeName: data.attributeName,
    attributeValue: data.attributeValue,
    sortOrder: data.sortOrder ?? 0,
    isFilterable: data.isFilterable ?? false,
  });
  return { id: result[0].insertId };
}

export async function deleteProductAttribute(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(productAttributes).where(eq(productAttributes.id, id));
}

export async function getAttributesByProductId(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productAttributes).where(eq(productAttributes.productId, productId)).orderBy(asc(productAttributes.sortOrder));
}

// ============================================================================
// Phase 1: Public API helpers (price isolation)
// ============================================================================

export async function getPublicProducts(params: { categoryId?: number; search?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [
    eq(products.status, 'active'),
    eq(products.visibility, 'public'),
  ];
  if (params.categoryId) {
    conditions.push(eq(products.categoryId, params.categoryId));
  }
  if (params.search) {
    const searchTerm = `%${params.search}%`;
    conditions.push(or(like(products.name, searchTerm), like(products.keyword, searchTerm)));
  }
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const items = await db.select({
    id: products.id,
    name: products.name,
    type: products.type,
    productMode: products.productMode,
    categoryId: products.categoryId,
    keyword: products.keyword,
    shortDescZh: products.shortDescZh,
    shortDescEn: products.shortDescEn,
    sellingPrice: products.sellingPrice,
    compareAtPrice: products.compareAtPrice,
    weightKg: products.weightKg,
    isFeatured: products.isFeatured,
    coverImageUrl: products.coverImageUrl,
  }).from(products)
    .where(and(...conditions))
    .orderBy(desc(products.createdAt))
    .limit(limit)
    .offset(offset);
  const countResult = await db.select({ count: sql`count(*)` }).from(products).where(and(...conditions));
  const total = Number(countResult[0]?.count) || 0;
  return { items, total };
}

export async function getPublicProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const productResult = await db.select({
    id: products.id,
    name: products.name,
    type: products.type,
    productMode: products.productMode,
    categoryId: products.categoryId,
    keyword: products.keyword,
    shortDescZh: products.shortDescZh,
    shortDescEn: products.shortDescEn,
    fullDescZh: products.fullDescZh,
    fullDescEn: products.fullDescEn,
    careZh: products.careZh,
    careEn: products.careEn,
    sellingPrice: products.sellingPrice,
    compareAtPrice: products.compareAtPrice,
    weightKg: products.weightKg,
    dimensions: products.dimensions,
    coverImageUrl: products.coverImageUrl,
    isFeatured: products.isFeatured,
  }).from(products)
    .where(and(eq(products.id, id), eq(products.status, 'active'), eq(products.visibility, 'public')))
    .limit(1);
  if (productResult.length === 0) return undefined;
  const product = productResult[0];
  // Only expose public-safe fields (no fileKey or internal fields)
  const images = await db.select({
    id: productImages.id,
    url: productImages.url,
    sortOrder: productImages.sortOrder,
    isMain: productImages.isMain,
    altText: productImages.altText,
  }).from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.sortOrder));
  const videos = await db.select({
    id: productVideos.id,
    url: productVideos.url,
    sortOrder: productVideos.sortOrder,
    isMain: productVideos.isMain,
    thumbnailUrl: productVideos.thumbnailUrl,
    duration: productVideos.duration,
    altText: productVideos.altText,
  }).from(productVideos).where(eq(productVideos.productId, id)).orderBy(asc(productVideos.sortOrder));
  const variantList = await db.select({
    id: variants.id,
    name: variants.name,
    keyword: variants.keyword,
    sellingPrice: variants.sellingPrice,
    compareAtPrice: variants.compareAtPrice,
    weight: variants.weight,
    imageUrl: variants.imageUrl,
    status: variants.status,
    sortOrder: variants.sortOrder,
  }).from(variants).where(and(eq(variants.productId, id), eq(variants.status, 'active'), eq(variants.visibility, 'public')));
  return { ...product, images, videos, variants: variantList };
}

export async function getPublicProductByKeyword(keyword: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalizedKeyword = keyword.toUpperCase().replace(/\s+/g, '');
  const productResult = await db.select({
    id: products.id,
    name: products.name,
    type: products.type,
    productMode: products.productMode,
    keyword: products.keyword,
    sellingPrice: products.sellingPrice,
    compareAtPrice: products.compareAtPrice,
    weightKg: products.weightKg,
    coverImageUrl: products.coverImageUrl,
  }).from(products)
    .where(and(
      eq(products.keyword, normalizedKeyword),
      eq(products.status, 'active'),
      eq(products.visibility, 'public'),
    ))
    .limit(1);
  if (productResult.length === 0) return undefined;
  return productResult[0];
}

// ============================================================================
// Phase 1: Utility - Token generator
// ============================================================================

function generateToken(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================================================
// Phase 1: Dashboard stats helpers (enhanced)
// ============================================================================

export async function getProductStats() {
  const db = await getDb();
  if (!db) return { total: 0, active: 0, draft: 0, outOfStock: 0, featured: 0 };
  const total = await db.select({ count: sql`count(*)` }).from(products);
  const active = await db.select({ count: sql`count(*)` }).from(products).where(eq(products.status, 'active'));
  const draft = await db.select({ count: sql`count(*)` }).from(products).where(eq(products.status, 'draft'));
  const outOfStock = await db.select({ count: sql`count(*)` }).from(products).where(eq(products.status, 'out_of_stock'));
  const featured = await db.select({ count: sql`count(*)` }).from(products).where(eq(products.isFeatured, true));
  return {
    total: Number(total[0]?.count) || 0,
    active: Number(active[0]?.count) || 0,
    draft: Number(draft[0]?.count) || 0,
    outOfStock: Number(outOfStock[0]?.count) || 0,
    featured: Number(featured[0]?.count) || 0,
  };
}

// ============================================================================
// XLCS V1.0: Business Report Service
// ============================================================================

export interface DateRange {
  start: Date;
  end: Date;
}

/** 将 JavaScript 日期转为可与 TiDB timestamp 字段比较的 UTC 边界。 */
function toReportTimestamp(value: Date): string {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

export function getDateRange(preset: string, customStart?: string, customEnd?: string): DateRange {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'yesterday': {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const yEnd = new Date(start);
      yEnd.setHours(23, 59, 59, 999);
      return { start, end: yEnd };
    }
    case 'this_week': {
      const start = new Date(now);
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday as first day
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start, end };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const lEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end: lEnd };
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { start, end };
    }
    case 'custom': {
      const start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
      const cEnd = customEnd ? new Date(customEnd) : new Date(now);
      cEnd.setHours(23, 59, 59, 999);
      start.setHours(0, 0, 0, 0);
      return { start, end: cEnd };
    }
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start, end };
    }
  }
}

// Default package cost (RM15 per package - courier + packaging + labor)
const DEFAULT_PACKAGE_COST = 15;

export async function getBusinessOverview(dateRange: DateRange) {
  const db = await getDb();
  if (!db) return null;

  const { start, end } = dateRange;
  const startTimestamp = toReportTimestamp(start);
  const endTimestamp = toReportTimestamp(end);

  // 1. Total revenue (product subtotal only, no shipping, no cancelled, no test)
  const [revenueRows] = await db.execute(sql`
    SELECT 
      COALESCE(SUM(o.physicalSubtotal), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN o.paidAmount > 0 THEN o.paidAmount ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(CASE WHEN COALESCE(o.physicalStatus, '') <> 'cancelled' THEN o.totalAmount - o.paidAmount ELSE 0 END), 0) as total_unpaid,
      COUNT(*) as total_orders,
      SUM(CASE WHEN o.paidAmount > 0 AND o.paidAmount >= o.totalAmount THEN 1 ELSE 0 END) as paid_orders,
      SUM(CASE WHEN o.paidAmount = 0 THEN 1 ELSE 0 END) as unpaid_orders,
      SUM(CASE WHEN o.physicalStatus = 'shipped' OR o.physicalStatus = 'completed' THEN 1 ELSE 0 END) as shipped_packages,
      COALESCE(SUM(o.shippingFee), 0) as shipping_income
    FROM orders o
    WHERE o.createdAt >= ${startTimestamp} AND o.createdAt <= ${endTimestamp}
      AND COALESCE(o.physicalStatus, '') <> 'cancelled'
      AND COALESCE(o.orderType, '') <> 'membership'
  `);

  // 2. Refund total
  const [refundRows] = await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0) as total_refunds, COUNT(*) as refund_count
    FROM customer_refunds
    WHERE refundDate >= ${startTimestamp} AND refundDate <= ${endTimestamp}
  `);

  // 3. Order statistics
  const [orderStatRows] = await db.execute(sql`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN physicalStatus = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN physicalStatus = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN paidAmount > 0 AND paidAmount >= totalAmount THEN 1 ELSE 0 END) as paid,
      SUM(CASE WHEN paidAmount = 0 THEN 1 ELSE 0 END) as unpaid,
      SUM(CASE WHEN physicalStatus = 'shipped' THEN 1 ELSE 0 END) as shipped
    FROM orders
    WHERE createdAt >= ${startTimestamp} AND createdAt <= ${endTimestamp}
      AND COALESCE(orderType, '') <> 'membership'
  `);

  // 4. FIFO cost (from inventory_ledger where transaction_type = 'sale')
  const [fifoRows] = await db.execute(sql`
    SELECT COALESCE(SUM(ABS(quantity_change) * unit_cost), 0) as total_fifo_cost
    FROM inventory_ledger
    WHERE transaction_type = 'sale'
      AND created_at >= ${startTimestamp} AND created_at <= ${endTimestamp}
  `);

  const revenueData = revenueRows as unknown as any[];
  const totalRevenue = Number(revenueData[0]?.total_revenue) || 0;
  const totalPaid = Number(revenueData[0]?.total_paid) || 0;
  const totalUnpaid = Number(revenueData[0]?.total_unpaid) || 0;
  const refundData = refundRows as unknown as any[];
  const totalRefunds = Number(refundData[0]?.total_refunds) || 0;
  const paidOrders = Number(revenueData[0]?.paid_orders) || 0;
  const unpaidOrders = Number(revenueData[0]?.unpaid_orders) || 0;
  const shippedPackages = Number(revenueData[0]?.shipped_packages) || 0;
  const shippingIncome = Number(revenueData[0]?.shipping_income) || 0;
  const fifoData = fifoRows as unknown as any[];
  const fifoCost = Number(fifoData[0]?.total_fifo_cost) || 0;
  const borneShipping = shippedPackages * DEFAULT_PACKAGE_COST;
  const actualPaid = totalPaid - totalRefunds;
  const grossProfit = totalRevenue - fifoCost - borneShipping - totalRefunds;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    // Row 1: Revenue (9 cards)
    totalRevenue,
    totalPaid: actualPaid,
    totalUnpaid,
    totalRefunds,
    paidOrders,
    unpaidOrders,
    shippedPackages,
    borneShipping,
    shippingIncome,
    // Row 2: Profit analysis
    productSales: totalRevenue,
    fifoCost,
    grossProfit,
    grossMargin: Math.round(grossMargin * 100) / 100,
    // Row 3: Order statistics
    orderStats: {
      total: Number((orderStatRows as unknown as any[])[0]?.total_orders) || 0,
      paid: Number((orderStatRows as unknown as any[])[0]?.paid) || 0,
      unpaid: Number((orderStatRows as unknown as any[])[0]?.unpaid) || 0,
      refunded: Number(refundData[0]?.refund_count) || 0,
      completed: Number((orderStatRows as unknown as any[])[0]?.completed) || 0,
      cancelled: Number((orderStatRows as unknown as any[])[0]?.cancelled) || 0,
    },
  };
}

// TOP10: Best selling products by quantity
export async function getTopProductsByQuantity(dateRange: DateRange, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = dateRange;
  const [rows] = await db.execute(sql`
    SELECT 
            oi.productId,
      oi.productName,
      oi.variationName,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.subtotal) as total_sales
    FROM order_items oi
    INNER JOIN orders o ON oi.orderId = o.id
    WHERE o.createdAt >= ${toReportTimestamp(start)} AND o.createdAt <= ${toReportTimestamp(end)}
      AND COALESCE(o.physicalStatus, '') <> 'cancelled'
      AND COALESCE(oi.productType, 'physical') = 'physical'
    GROUP BY oi.productId, oi.productName, oi.variationId, oi.variationName
    ORDER BY total_quantity DESC
    LIMIT ${limit}
  `);
  return (rows as unknown as any[]).map((r: any) => ({
    productId: r.productId,
    productName: r.productName,
    variantName: r.variationName,
    totalQuantity: Number(r.total_quantity) || 0,
    totalSales: Number(r.total_sales) || 0,
  }));
}

// TOP10: Best selling products by revenue
export async function getTopProductsByRevenue(dateRange: DateRange, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = dateRange;
  const [rows] = await db.execute(sql`
    SELECT 
            oi.productId,
      oi.productName,
      oi.variationName,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.subtotal) as total_sales
    FROM order_items oi
    INNER JOIN orders o ON oi.orderId = o.id
    WHERE o.createdAt >= ${toReportTimestamp(start)} AND o.createdAt <= ${toReportTimestamp(end)}
      AND COALESCE(o.physicalStatus, '') <> 'cancelled'
      AND COALESCE(oi.productType, 'physical') = 'physical'
    GROUP BY oi.productId, oi.productName, oi.variationId, oi.variationName
    ORDER BY total_sales DESC
    LIMIT ${limit}
  `);
  return (rows as unknown as any[]).map((r: any) => ({
    productId: r.productId,
    productName: r.productName,
    variantName: r.variationName,
    totalQuantity: Number(r.total_quantity) || 0,
    totalSales: Number(r.total_sales) || 0,
  }));
}

// TOP10: Most profitable products (FIFO cost)
export async function getTopProductsByProfit(dateRange: DateRange, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = dateRange;
  const [rows] = await db.execute(sql`
    SELECT 
            il.product_id,
      p.name as product_name,
      SUM(ABS(il.quantity_change) * il.unit_cost) as fifo_cost,
      MAX(COALESCE(oi_sum.total_sales, 0)) as total_sales,
      MAX(COALESCE(oi_sum.total_sales, 0)) - SUM(ABS(il.quantity_change) * il.unit_cost) as gross_profit
    FROM inventory_ledger il
    LEFT JOIN products p ON il.product_id = p.id
    LEFT JOIN (
      SELECT oi.productId, SUM(oi.subtotal) as total_sales
      FROM order_items oi
      INNER JOIN orders o ON oi.orderId = o.id
      WHERE o.createdAt >= ${toReportTimestamp(start)} AND o.createdAt <= ${toReportTimestamp(end)}
        AND COALESCE(o.physicalStatus, '') <> 'cancelled'
        AND COALESCE(oi.productType, 'physical') = 'physical'
      GROUP BY oi.productId
    ) oi_sum ON il.product_id = oi_sum.productId
    WHERE il.transaction_type = 'sale'
      AND il.created_at >= ${toReportTimestamp(start)} AND il.created_at <= ${toReportTimestamp(end)}
    GROUP BY il.product_id, p.name
    ORDER BY gross_profit DESC
    LIMIT ${limit}
  `);
  return (rows as unknown as any[]).map((r: any) => ({
    productId: r.product_id,
    productName: r.product_name,
    fifoCost: Number(r.fifo_cost) || 0,
    totalSales: Number(r.total_sales) || 0,
    grossProfit: Number(r.gross_profit) || 0,
    grossMargin: Number(r.total_sales) > 0 ? Math.round(((Number(r.gross_profit) || 0) / Number(r.total_sales)) * 10000) / 100 : 0,
  }));
}

// TOP10: Top customers by paid amount
export async function getTopCustomersBySpending(dateRange: DateRange, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = dateRange;
  const [rows] = await db.execute(sql`
    SELECT 
            c.id,
      c.customerId as customer_code,
      c.displayName,
      c.facebookName,
      c.avatarUrl,
      COUNT(o.id) as order_count,
      COALESCE(SUM(o.paidAmount), 0) as total_paid,
      MAX(o.createdAt) as last_order_date
    FROM orders o
    INNER JOIN customers c ON o.customerId = c.id
    WHERE o.createdAt >= ${toReportTimestamp(start)} AND o.createdAt <= ${toReportTimestamp(end)}
      AND COALESCE(o.physicalStatus, '') <> 'cancelled'
      AND COALESCE(o.orderType, '') <> 'membership'
    GROUP BY c.id, c.customerId, c.displayName, c.facebookName, c.avatarUrl
    ORDER BY total_paid DESC
    LIMIT ${limit}
  `);
  return (rows as unknown as any[]).map((r: any) => ({
    customerId: r.id,
    customerCode: r.customer_code,
    displayName: r.displayName || r.facebookName,
    avatarUrl: r.avatarUrl,
    orderCount: Number(r.order_count) || 0,
    totalPaid: Number(r.total_paid) || 0,
    lastOrderDate: r.last_order_date,
  }));
}

// Sales & Payment Report
export async function getSalesPaymentReport(dateRange: DateRange) {
  const db = await getDb();
  if (!db) return null;

  const { start, end } = dateRange;
  const [rows] = await db.execute(sql`
    SELECT 
      o.id,
      o.orderNumber,
      o.facebookName,
      o.physicalSubtotal,
      o.shippingFee,
      o.totalAmount,
      o.paidAmount,
      (o.totalAmount - o.paidAmount) as balance,
      o.physicalStatus,
      o.paymentMethodName as payment_method,
      o.createdAt,
      o.shippedAt,
      o.completedAt
    FROM orders o
    WHERE o.createdAt >= ${toReportTimestamp(start)} AND o.createdAt <= ${toReportTimestamp(end)}
      AND COALESCE(o.orderType, '') <> 'membership'
    ORDER BY o.createdAt DESC
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    customerName: r.facebookName,
    productSubtotal: Number(r.physicalSubtotal) || 0,
    shippingFee: Number(r.shippingFee) || 0,
    totalAmount: Number(r.totalAmount) || 0,
    paidAmount: Number(r.paidAmount) || 0,
    balance: Number(r.balance) || 0,
    status: r.physicalStatus,
    paymentMethod: r.payment_method,
    createdAt: r.createdAt,
    shippedAt: r.shippedAt,
    completedAt: r.completedAt,
  }));
}

// Product Sales Report
export async function getProductSalesReport(dateRange: DateRange) {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = dateRange;
  const [rows] = await db.execute(sql`
    SELECT 
      oi.productId,
      oi.productName,
      oi.variationName,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.subtotal) as total_sales,
      COUNT(DISTINCT o.id) as order_count,
      MAX(COALESCE(il_sum.fifo_cost, 0)) as fifo_cost,
      COALESCE(SUM(oi.subtotal), 0) - MAX(COALESCE(il_sum.fifo_cost, 0)) as gross_profit
    FROM order_items oi
    INNER JOIN orders o ON oi.orderId = o.id
    LEFT JOIN (
      SELECT product_id, SUM(ABS(quantity_change) * unit_cost) as fifo_cost
      FROM inventory_ledger
      WHERE transaction_type = 'sale'
        AND created_at >= ${toReportTimestamp(start)} AND created_at <= ${toReportTimestamp(end)}
      GROUP BY product_id
    ) il_sum ON oi.productId = il_sum.product_id
    WHERE o.createdAt >= ${toReportTimestamp(start)} AND o.createdAt <= ${toReportTimestamp(end)}
      AND COALESCE(o.physicalStatus, '') <> 'cancelled'
      AND COALESCE(oi.productType, 'physical') = 'physical'
    GROUP BY oi.productId, oi.productName, oi.variationId, oi.variationName
    ORDER BY total_sales DESC
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    productId: r.productId,
    productName: r.productName,
    variantName: r.variationName,
    totalQuantity: Number(r.total_quantity) || 0,
    totalSales: Number(r.total_sales) || 0,
    orderCount: Number(r.order_count) || 0,
    fifoCost: Number(r.fifo_cost) || 0,
    grossProfit: Number(r.gross_profit) || 0,
    grossMargin: Number(r.total_sales) > 0 ? Math.round(((Number(r.gross_profit) || 0) / Number(r.total_sales)) * 10000) / 100 : 0,
  }));
}

// Customer Spending Report
export async function getCustomerSpendingReport(dateRange: DateRange) {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = dateRange;
  const [rows] = await db.execute(sql`
    SELECT 
      c.id,
      c.customerId as customer_code,
      c.displayName,
      c.facebookName,
      c.phoneNumber as phone,
      c.whatsappPhone,
      COUNT(o.id) as order_count,
      COALESCE(SUM(o.totalAmount), 0) as total_order_amount,
      COALESCE(SUM(o.paidAmount), 0) as total_paid,
      COALESCE(SUM(o.totalAmount - o.paidAmount), 0) as total_unpaid,
      MAX(o.createdAt) as last_order_date
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customerId
      AND o.createdAt >= ${toReportTimestamp(start)} AND o.createdAt <= ${toReportTimestamp(end)}
      AND COALESCE(o.physicalStatus, '') <> 'cancelled'
      AND COALESCE(o.orderType, '') <> 'membership'
    GROUP BY c.id, c.customerId, c.displayName, c.facebookName, c.phoneNumber, c.whatsappPhone
    HAVING order_count > 0
    ORDER BY total_paid DESC
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    customerId: r.id,
    customerCode: r.customer_code,
    displayName: r.displayName || r.facebookName,
    phone: r.phone,
    whatsappPhone: r.whatsappPhone,
    orderCount: Number(r.order_count) || 0,
    totalOrderAmount: Number(r.total_order_amount) || 0,
    totalPaid: Number(r.total_paid) || 0,
    totalUnpaid: Number(r.total_unpaid) || 0,
    lastOrderDate: r.last_order_date,
  }));
}

// Purchase & Inventory Report
export async function getPurchaseInventoryReport(dateRange: DateRange) {
  const db = await getDb();
  if (!db) return null;

  const { start, end } = dateRange;

  // Purchase summary
  const [purchaseRows] = await db.execute(sql`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(totalAmount), 0) as total_amount,
      SUM(CASE WHEN status IN ('ordered', 'received') THEN 1 ELSE 0 END) as confirmed_count,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count
    FROM purchase_orders
    WHERE COALESCE(receivedAt, orderedAt, createdAt) >= ${toReportTimestamp(start)}
      AND COALESCE(receivedAt, orderedAt, createdAt) <= ${toReportTimestamp(end)}
      AND status <> 'cancelled'
  `);

  // Inventory summary
  const [inventoryRows] = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT product_id) as product_count,
      COALESCE(SUM(remaining_quantity), 0) as total_stock,
      COALESCE(SUM(remaining_quantity * unit_cost), 0) as stock_value,
      SUM(CASE WHEN remaining_quantity = 0 THEN 1 ELSE 0 END) as exhausted_lots,
      SUM(CASE WHEN remaining_quantity > 0 THEN 1 ELSE 0 END) as active_lots
    FROM inventory_lots
    WHERE status = 'active'
  `);

  // Low stock products (remaining < 5)
  const [lowStockRows] = await db.execute(sql`
    SELECT 
      il.product_id,
      p.name as product_name,
      SUM(il.remaining_quantity) as total_remaining,
      SUM(il.remaining_quantity * il.unit_cost) as stock_value
    FROM inventory_lots il
    LEFT JOIN products p ON il.product_id = p.id
    WHERE il.status = 'active' AND il.remaining_quantity > 0
    GROUP BY il.product_id
    HAVING total_remaining < 5
    ORDER BY total_remaining ASC
    LIMIT 20
  `);

  return {
    purchase: {
      totalOrders: Number((purchaseRows as unknown as any[])[0]?.total_orders) || 0,
      totalAmount: Number((purchaseRows as unknown as any[])[0]?.total_amount) || 0,
      confirmedCount: Number((purchaseRows as unknown as any[])[0]?.confirmed_count) || 0,
      draftCount: Number((purchaseRows as unknown as any[])[0]?.draft_count) || 0,
    },
    inventory: {
      productCount: Number((inventoryRows as unknown as any[])[0]?.product_count) || 0,
      totalStock: Number((inventoryRows as unknown as any[])[0]?.total_stock) || 0,
      stockValue: Number((inventoryRows as unknown as any[])[0]?.stock_value) || 0,
      exhaustedLots: Number((inventoryRows as unknown as any[])[0]?.exhausted_lots) || 0,
      activeLots: Number((inventoryRows as unknown as any[])[0]?.active_lots) || 0,
    },
    lowStock: (lowStockRows as unknown as any[]).map((r: any) => ({
      productId: r.product_id,
      productName: r.product_name,
      totalRemaining: Number(r.total_remaining) || 0,
      stockValue: Number(r.stock_value) || 0,
    })),
  };
}

// Refund records list
export async function getRefundRecords(dateRange: DateRange) {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = dateRange;
  const [rows] = await db.execute(sql`
    SELECT 
      cr.id,
      cr.orderId,
      o.orderNumber,
      c.displayName,
      c.facebookName,
      cr.amount,
      cr.refundMethod,
      cr.reason,
      cr.operatorName,
      cr.refundDate,
      cr.createdAt
    FROM customer_refunds cr
    LEFT JOIN orders o ON cr.orderId = o.id
    LEFT JOIN customers c ON cr.customerId = c.id
    WHERE cr.refundDate >= ${toReportTimestamp(start)} AND cr.refundDate <= ${toReportTimestamp(end)}
    ORDER BY cr.refundDate DESC
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    id: r.id,
    orderId: r.orderId,
    orderNumber: r.orderNumber,
    customerName: r.displayName || r.facebookName,
    amount: Number(r.amount) || 0,
    refundMethod: r.refundMethod,
    reason: r.reason,
    operatorName: r.operatorName,
    refundDate: r.refundDate,
    createdAt: r.createdAt,
  }));
}

// ============================================================================
// System Settings helpers
// ============================================================================

export async function getSystemSettings() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(systemSettings).limit(1);
  return rows[0] ?? null;
}

export async function updateSystemSettings(data: any) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(systemSettings).limit(1);
  if (existing.length > 0) {
    await db.update(systemSettings).set(data).where(eq(systemSettings.id, existing[0].id));
    return (await db.select().from(systemSettings).limit(1))[0];
  } else {
    const result = await db.insert(systemSettings).values(data as any);
    return (await db.select().from(systemSettings).limit(1))[0];
  }
}

// ============================================================================
// Shipping Rules helpers
// ============================================================================

export async function getShippingRules() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(shippingRules).orderBy(asc(shippingRules.sortOrder));
  return rows;
}

export async function getShippingRuleByZone(zone: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(shippingRules).where(eq(shippingRules.zone, zone as any)).limit(1);
  return rows[0] ?? null;
}

export async function updateShippingRule(id: number, data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(shippingRules).set(data).where(eq(shippingRules.id, id));
  return (await db.select().from(shippingRules).where(eq(shippingRules.id, id)).limit(1))[0];
}

export async function createShippingRule(data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(shippingRules).values(data);
  return (await db.select().from(shippingRules).orderBy(desc(shippingRules.id)).limit(1))[0];
}

export async function deleteShippingRule(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(shippingRules).where(eq(shippingRules.id, id));
}

// ============================================================================
// Shipping Providers helpers
// ============================================================================

export async function getShippingProviders() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(shippingProviders);
  return rows;
}

export async function getShippingProviderByKey(key: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(shippingProviders).where(eq(shippingProviders.providerKey, key)).limit(1);
  return rows[0] ?? null;
}

export async function updateShippingProvider(key: string, data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(shippingProviders).set(data).where(eq(shippingProviders.providerKey, key));
  return (await db.select().from(shippingProviders).where(eq(shippingProviders.providerKey, key)).limit(1))[0];
}

// ============================================================================
// Shipments helpers
// ============================================================================

export async function getShipmentByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(shipments).where(eq(shipments.orderId, orderId)).limit(1);
  return rows[0] ?? null;
}

export async function createShipment(data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(shipments).values(data);
  return (await db.select().from(shipments).orderBy(desc(shipments.id)).limit(1))[0];
}

export async function updateShipment(id: number, data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(shipments).set(data).where(eq(shipments.id, id));
  return (await db.select().from(shipments).where(eq(shipments.id, id)).limit(1))[0];
}

export async function getShipmentsByStatus(status: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(shipments).where(eq(shipments.status, status as any));
  return rows;
}

// ============================================================================
// Payment Methods helpers (付款方式)
// ============================================================================

export async function getPaymentMethods(includeDisabled = false) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(paymentMethods).orderBy(asc(paymentMethods.displayOrder));
  return includeDisabled ? rows : rows.filter((r: any) => r.isEnabled);
}

export async function getPaymentMethodById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(paymentMethods).where(eq(paymentMethods.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPaymentMethod(data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(paymentMethods).values(data);
  return (await db.select().from(paymentMethods).orderBy(desc(paymentMethods.id)).limit(1))[0];
}

export async function updatePaymentMethod(id: number, data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(paymentMethods).set(data).where(eq(paymentMethods.id, id));
  return (await db.select().from(paymentMethods).where(eq(paymentMethods.id, id)).limit(1))[0];
}

export async function deletePaymentMethod(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
}

// ============================================================================
// Order Status Logs helpers (订单状态变更记录)
// ============================================================================

export async function getOrderStatusLogs(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(orderStatusLogs).where(eq(orderStatusLogs.orderId, orderId)).orderBy(desc(orderStatusLogs.createdAt));
  return rows;
}

export async function createOrderStatusLog(data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(orderStatusLogs).values(data);
  return (await db.select().from(orderStatusLogs).orderBy(desc(orderStatusLogs.id)).limit(1))[0];
}

// ============================================================================
// Hold Order Info helpers (保留订单)
// ============================================================================

export async function getHoldOrderInfo(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(holdOrderInfos).where(eq(holdOrderInfos.orderId, orderId)).limit(1);
  return rows[0] ?? null;
}

export async function getActiveHoldOrdersByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  // Join with orders to filter by customerId
  const rows = unwrapMySqlRows<any>(await db.execute(sql`
    SELECT h.*, o.orderNumber, o.customerId, o.totalAmount, o.paidAmount
    FROM hold_order_infos h
    LEFT JOIN orders o ON h.orderId = o.id
    WHERE o.customerId = ${customerId} AND h.isActive = 1
    AND o.physicalStatus = 'hold_order'
    ORDER BY h.holdCreatedAt DESC
  `));
  return rows;
}

export async function createHoldOrderInfo(data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(holdOrderInfos).values(data);
  return (await db.select().from(holdOrderInfos).orderBy(desc(holdOrderInfos.id)).limit(1))[0];
}

export async function updateHoldOrderInfo(orderId: number, data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(holdOrderInfos).set(data).where(eq(holdOrderInfos.orderId, orderId));
  return (await db.select().from(holdOrderInfos).where(eq(holdOrderInfos.orderId, orderId)).limit(1))[0];
}

export async function releaseHoldOrder(orderId: number, releasedBy: string) {
  const db = await getDb();
  if (!db) return null;
  await db.update(holdOrderInfos).set({
    isActive: false,
    holdReleasedAt: new Date() as any,
  }).where(eq(holdOrderInfos.orderId, orderId));
  return true;
}

// ============================================================================
// Notification Logs helpers (通知记录)
// ============================================================================

export async function getNotificationLogs(orderId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (orderId) {
    const rows = await db.select().from(notificationLogs).where(eq(notificationLogs.orderId, orderId)).orderBy(desc(notificationLogs.createdAt));
    return rows;
  }
  const rows = await db.select().from(notificationLogs).orderBy(desc(notificationLogs.createdAt)).limit(100);
  return rows;
}

export async function createNotificationLog(data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(notificationLogs).values(data);
  return (await db.select().from(notificationLogs).orderBy(desc(notificationLogs.id)).limit(1))[0];
}

export async function updateNotificationLog(id: number, data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(notificationLogs).set(data).where(eq(notificationLogs.id, id));
  return (await db.select().from(notificationLogs).where(eq(notificationLogs.id, id)).limit(1))[0];
}

const AI_NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  order_confirmation: "订单成立",
  payment_pending: "待付款提醒",
  payment_confirmed: "付款确认",
  order_hold: "保留订单提醒",
  shipment_reminder: "发货提醒",
  shipped: "发货通知",
};

export async function getAiNotificationCenter() {
  const db = await getDb();
  if (!db) return { stats: [], failures: [], templates: [] };
  const [logs, actions] = await Promise.all([
    db.select({
      id: notificationLogs.id, orderId: notificationLogs.orderId, customerId: notificationLogs.customerId,
      type: notificationLogs.type, channel: notificationLogs.channel, message: notificationLogs.message,
      status: notificationLogs.status, errorMessage: notificationLogs.errorMessage, createdAt: notificationLogs.createdAt,
      sentAt: notificationLogs.sentAt, orderNumber: orders.orderNumber, customerName: customers.name,
      customerPhone: customers.phoneNumber,
    }).from(notificationLogs).leftJoin(orders, eq(notificationLogs.orderId, orders.id))
      .leftJoin(customers, eq(notificationLogs.customerId, customers.id)).orderBy(desc(notificationLogs.createdAt)).limit(300),
    db.select().from(aiNotificationActions).orderBy(desc(aiNotificationActions.createdAt)).limit(500),
  ]);
  const latestActionByLog = new Map<number, typeof actions[number]>();
  for (const action of actions) if (!latestActionByLog.has(action.notificationLogId)) latestActionByLog.set(action.notificationLogId, action);
  const statKeys = Object.keys(AI_NOTIFICATION_TYPE_LABELS);
  const stats = statKeys.map(type => ({
    type, label: AI_NOTIFICATION_TYPE_LABELS[type], total: logs.filter(log => log.type === type).length,
    sent: logs.filter(log => log.type === type && log.status === "sent").length,
    pending: logs.filter(log => log.type === type && log.status === "pending").length,
    failed: logs.filter(log => log.type === type && log.status === "failed" && !latestActionByLog.has(log.id)).length,
  }));
  return {
    stats,
    failures: logs.filter(log => log.status === "failed" && !latestActionByLog.has(log.id)).map(log => ({ ...log, eventLabel: AI_NOTIFICATION_TYPE_LABELS[log.type] ?? log.type })),
    templates: statKeys.map(type => ({ type, label: AI_NOTIFICATION_TYPE_LABELS[type], variables: ["{customer_name}", "{order_number}", "{amount}", "{checkout_link}"] })),
  };
}

export async function handleAiNotificationFailure(input: { notificationLogId: number; action: "manual_sent" | "resolved" | "ignored"; note?: string; handledBy: string }) {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");
  const [log] = await db.select().from(notificationLogs).where(eq(notificationLogs.id, input.notificationLogId)).limit(1);
  if (!log) throw new Error("通知记录不存在");
  const [existingAction] = await db.select().from(aiNotificationActions).where(eq(aiNotificationActions.notificationLogId, input.notificationLogId)).limit(1);
  if (existingAction) throw new Error("此通知已由管理员处理，系统不会重复发送");
  try {
    await db.insert(aiNotificationActions).values(input);
    return { success: true, alreadyHandled: false };
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY" || String(error?.message ?? "").includes("Duplicate entry")) {
      return { success: true, alreadyHandled: true, message: "此通知已由管理员处理，系统不会重复发送" };
    }
    throw error;
  }
}

// ============================================================================
// Order Status Transition helpers (订单状态流转)
// ============================================================================

export async function transitionOrderStatus(orderId: number, toStatus: string, changedBy: string, notes?: string) {
  const db = await getDb();
  if (!db) return null;

  // Get current order
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order[0]) throw new Error("Order not found");

  const fromStatus = order[0].physicalStatus;
  const isImportOrder = order[0].orderCategory === 'import';

  // Update order status
  const updateData: any = { physicalStatus: toStatus as any };
  if (toStatus === "receipt_uploaded") updateData.paymentUploadedAt = new Date() as any;
  if (toStatus === "packing") updateData.paymentConfirmedAt = new Date() as any;
  if (toStatus === "shipped") updateData.shippedAt = new Date() as any;
  if (toStatus === "completed") updateData.completedAt = new Date() as any;

  // V2.0.99: For import orders, also update importStatus
  if (isImportOrder) {
    updateData.importStatus = toStatus as any;
  }

  await db.update(orders).set(updateData).where(eq(orders.id, orderId));

  // Create status log
  await db.insert(orderStatusLogs).values({
    orderId,
    fromStatus: fromStatus as string,
    toStatus,
    changedBy,
    notes: notes || null,
  });

  return (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
}

// ============================================================================
// Hold Order Auto-Merge helpers (保留订单自动合并)
// ============================================================================

export async function findMergeableHoldOrder(customerId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = unwrapMySqlRows<any>(await db.execute(sql`
    SELECT h.*, o.orderNumber, o.totalAmount, o.paidAmount, o.physicalSubtotal, o.shippingFee, o.discountAmount
    FROM hold_order_infos h
    LEFT JOIN orders o ON h.orderId = o.id
    WHERE o.customerId = ${customerId} 
    AND h.isActive = 1 
    AND h.allowAutoMerge = 1
    AND o.physicalStatus IN ('hold_order', 'partial_payment')
    ORDER BY h.holdCreatedAt DESC
    LIMIT 1
  `));
  return rows[0] ?? null;
}

export async function getMergeableHoldOrderById(customerId: number, orderId: number) {
  const db = await getDb();
  if (!db) return null;

  // V2.1.02: Only merge orders of the same category (local+local or import+import)
  const rows = unwrapMySqlRows<any>(await db.execute(sql`
    SELECT h.*, o.orderNumber, o.customerId, o.totalAmount, o.paidAmount, o.orderCategory
    FROM hold_order_infos h
    INNER JOIN orders o ON h.orderId = o.id
    WHERE h.orderId = ${orderId}
      AND o.customerId = ${customerId}
      AND h.isActive = 1
      AND h.allowAutoMerge = 1
      AND o.physicalStatus IN ('hold_order', 'partial_payment')
    LIMIT 1
  `));

  return rows[0] ?? null;
}

export async function mergeOrderItemsIntoOrder(targetOrderId: number, items: any[]) {
  const db = await getDb();
  if (!db) return;
  for (const item of items) {
    await db.insert(orderItems).values({
      orderId: targetOrderId,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku || null,
      productType: item.productType || "physical",
      variationId: item.variationId || null,
      variationName: item.variationName || null,
      facebookKeyword: item.facebookKeyword || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      discount: (item.discount || "0").toString(),
      subtotal: item.subtotal.toString(),
      unitWeight: (item.unitWeight || "0").toString(),
    });
  }
}

export async function recalculateOrderTotals(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get all items
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  
  let totalWeight = 0;
  let totalDiscount = 0;
  
  for (const item of items) {
    totalWeight += Number(item.unitWeight) * item.quantity;
    totalDiscount += Number(item.discount || 0);
  }
  
  // Get current order for shipping fee
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order[0]) return null;
  
  const priceBreakdown = calculateOrderPriceBreakdown(items, {
    promotionDiscount: order[0].promotionDiscount,
    discountAmount: totalDiscount,
  });
  const subtotal = priceBreakdown.physicalSubtotal + priceBreakdown.membershipSubtotal;
  const promotionDiscount = Number(order[0].promotionDiscount || 0);
  const extraCharge = Number(order[0].extraCharge || 0);
  const creditUsed = Number(order[0].creditUsed || 0);
  let shippingFee = Number(order[0].shippingFee || 0);
  if (order[0].shippingMethod === "west_malaysia") {
    shippingFee = calculateWestMalaysiaShipping(totalWeight, priceBreakdown.freeShippingEligibleSubtotal).shippingFee;
  } else if (order[0].shippingMethod === "lalamove") {
    shippingFee = priceBreakdown.freeShippingEligibleSubtotal >= 150 ? 0 : 15;
  } else if (order[0].shippingMethod === "self_pickup") {
    shippingFee = 0;
  }
  const paidAmount = Number(order[0].paidAmount || 0);
  const totalAmount = subtotal - promotionDiscount - totalDiscount + extraCharge + shippingFee - creditUsed;
  
  await db.update(orders).set({
    physicalSubtotal: subtotal.toString(),
    totalWeight: totalWeight.toString(),
    discountAmount: totalDiscount.toString(),
    shippingFee: shippingFee.toString(),
    customerPaidShipping: shippingFee.toString(),
    totalAmount: totalAmount.toString(),
  }).where(eq(orders.id, orderId));
  
  // Determine new status based on payment
  let newStatus = order[0].physicalStatus;
  if (paidAmount < totalAmount && paidAmount > 0) {
    newStatus = "receipt_uploaded" as any;
  } else if (paidAmount >= totalAmount && paidAmount > 0) {
    // Keep as hold_order if it was hold_order
    if (order[0].physicalStatus === "hold_order") {
      newStatus = "hold_order" as any;
    }
  }
  
  if (newStatus !== order[0].physicalStatus) {
    await db.update(orders).set({ physicalStatus: newStatus as any }).where(eq(orders.id, orderId));
  }
  
  return (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
}

// ============================================================================
// Mall Module - DB Helpers
// ============================================================================

// --- Mall Settings ---
export async function getMallSettings() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(mallSettings).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateMallSettings(id: number, data: Partial<typeof mallSettings.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mallSettings).set(data).where(eq(mallSettings.id, id));
  return await getMallSettings();
}

export async function createMallSettingsIfNotExists() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getMallSettings();
  if (existing) return existing;
  await db.insert(mallSettings).values({
    shopName: "心田 Xintian",
    activeTheme: "xintian_nature",
  });
  return await getMallSettings();
}

// --- Mall Banners ---
export async function getMallBanners(type?: string) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(mallBanners);
  if (type) query = query.where(eq(mallBanners.type, type as any)) as any;
  return await query.orderBy(asc(mallBanners.displayOrder));
}

export async function getEnabledMallBanners(type?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(mallBanners.isEnabled, true)];
  if (type) conditions.push(eq(mallBanners.type, type as any));
  let query = db.select().from(mallBanners).where(and(...conditions));
  const now = new Date();
  const results = await query.orderBy(asc(mallBanners.displayOrder));
  return results.filter(b => {
    if (b.startDate && new Date(b.startDate) > now) return false;
    if (b.endDate && new Date(b.endDate) < now) return false;
    return true;
  });
}

export async function createMallBanner(data: typeof mallBanners.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mallBanners).values(data);
  return result;
}

export async function updateMallBanner(id: number, data: Partial<typeof mallBanners.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mallBanners).set(data).where(eq(mallBanners.id, id));
}

export async function deleteMallBanner(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mallBanners).where(eq(mallBanners.id, id));
}

// --- Mall Quick Contacts ---
export async function getMallQuickContacts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(mallQuickContacts).orderBy(asc(mallQuickContacts.displayOrder));
}

export async function getEnabledMallQuickContacts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(mallQuickContacts)
    .where(eq(mallQuickContacts.isEnabled, true))
    .orderBy(asc(mallQuickContacts.displayOrder));
}

export async function createMallQuickContact(data: typeof mallQuickContacts.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mallQuickContacts).values(data);
  return result;
}

export async function updateMallQuickContact(id: number, data: Partial<typeof mallQuickContacts.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mallQuickContacts).set(data).where(eq(mallQuickContacts.id, id));
}

export async function deleteMallQuickContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mallQuickContacts).where(eq(mallQuickContacts.id, id));
}

// --- Mall Notices ---
export async function getMallNotices() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(mallNotices).orderBy(asc(mallNotices.displayOrder));
}

export async function getEnabledMallNotices() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(mallNotices)
    .where(eq(mallNotices.isEnabled, true))
    .orderBy(asc(mallNotices.displayOrder));
}

export async function createMallNotice(data: typeof mallNotices.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mallNotices).values(data);
  return result;
}

export async function updateMallNotice(id: number, data: Partial<typeof mallNotices.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mallNotices).set(data).where(eq(mallNotices.id, id));
}

export async function deleteMallNotice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mallNotices).where(eq(mallNotices.id, id));
}

// --- Mall Theme Schedules ---
export async function getMallThemeSchedules() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(mallThemeSchedules).orderBy(asc(mallThemeSchedules.startDate));
}

export async function createMallThemeSchedule(data: typeof mallThemeSchedules.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mallThemeSchedules).values(data);
  return result;
}

export async function deleteMallThemeSchedule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mallThemeSchedules).where(eq(mallThemeSchedules.id, id));
}

// --- Mall Product Detail Images ---
export async function getMallProductDetailImages(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(mallProductDetailImages)
    .where(eq(mallProductDetailImages.productId, productId))
    .orderBy(asc(mallProductDetailImages.displayOrder));
}

export async function createMallProductDetailImage(data: typeof mallProductDetailImages.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mallProductDetailImages).values(data);
  return result;
}

export async function deleteMallProductDetailImage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mallProductDetailImages).where(eq(mallProductDetailImages.id, id));
}

// --- Mall Product Sync ---
export async function getMallProducts(filters?: { categoryId?: number; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [
    eq(products.syncToMall, true),
    eq(products.status, "active"),
    eq(products.visibility, "public"),
    ne(products.type, "gift"),
  ];
  if (filters?.categoryId) {
    conditions.push(eq(products.categoryId, filters.categoryId));
  }
  if (filters?.search) {
    conditions.push(or(
      like(products.name, `%${filters.search}%`),
      like(products.sku, `%${filters.search}%`),
      like(products.keyword, `%${filters.search}%`),
    ));
  }
  let query = db.select().from(products).where(and(...conditions));
  return await query.orderBy(asc(products.mallSortOrder), desc(products.createdAt));
}

export async function getMallProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products)
    .where(and(eq(products.id, id), eq(products.syncToMall, true)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMallProductVariants(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(variants)
    .where(eq(variants.productId, productId))
    .orderBy(asc(variants.id));
}

export async function getMallProductImages(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.id));
}

export async function updateProductMallSync(productId: number, syncToMall: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set({ syncToMall }).where(eq(products.id, productId));
}

// --- Mall Categories (from ERP categories) ---
export async function getMallCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(categories)
    .where(and(eq(categories.status, "active"), eq(categories.showInStore, true)))
    .orderBy(asc(categories.sortOrder));
}

// --- Mall Checkout (Guest Checkout) ---
export async function mallCheckout(data: {
  customerName: string;
  contactNumber: string;
  whatsappNumber?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  postcode: string;
  city: string;
  state: string;
  area: string;
  deliveryRemark?: string;
  shippingMethod: string;
  items: Array<{
    productId: number;
    bundleId?: number;
    productName: string;
    productSku?: string;
    variationId?: number;
    variationName?: string;
    facebookKeyword?: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
    discount?: string;
    isSpecial?: boolean;
    isStandalone?: boolean;
    priceType?: string;
    originalUnitPrice?: string | null;
  }>;
  paymentMethodId?: number;
  paymentMethodName?: string;
  mergeIntoOrderId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // The browser only identifies a bundle. Its price, components and stock are
  // always refreshed from the stored bundle just before an order is created.
  const publicBundles = await getMallBundles();
  for (const item of data.items) {
    if (!item.bundleId) continue;
    const bundle = publicBundles.find((candidate) => candidate.id === item.bundleId);
    if (!bundle) throw new Error("组合优惠不存在、已下架或已售罄");
    if (bundle.bundleStock < item.quantity) throw new Error(`组合包库存不足 (剩余 ${bundle.bundleStock} 组)`);
    const trustedPrice = Number(bundle.specialPrice) > 0 ? Number(bundle.specialPrice) : Number(bundle.sellingPrice);
    const representative = bundle.items[0];
    if (!representative?.productId) throw new Error("组合优惠内容不完整，暂时无法结账");
    item.productId = representative.productId;
    item.productName = bundle.name;
    item.productSku = `BUNDLE-${bundle.id}`;
    item.variationId = undefined;
    item.variationName = undefined;
    item.unitPrice = trustedPrice.toFixed(2);
    item.subtotal = (trustedPrice * item.quantity).toFixed(2);
    item.isSpecial = true;
  }
  await applyTrustedSpecialPriceSnapshots(db, data.items, { useProductSpecialPrice: true });
  const regularItems = data.items.filter((item) => !item.bundleId);

  // Find or create customer
  const customer = await findOrCreateCustomer({
    name: data.customerName,
    phoneNumber: data.contactNumber,
    email: data.email,
  });
  const mallProductIds = data.items.map((item) => item.productId).filter(Boolean) as number[];
  const resolvedCategory = await resolveOrderCategory({ productIds: mallProductIds });
  let importLiveRoomId: number | null = null;
  if (resolvedCategory === "import") {
    await assertChinaImportOrderItemsEligible(mallProductIds);
    importLiveRoomId = await getActiveImportLiveRoomId();
    await assertImportLiveOrderWindow(importLiveRoomId);
  }

  // Build shipping address
  const shippingAddress = [
    data.addressLine1,
    data.addressLine2,
    `${data.postcode} ${data.city}`,
    data.state,
    data.area,
    ].filter(Boolean).join(", ");
  // Calculate totals
  const subtotal = data.items.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  // V2.2: Exclude standalone items from normal shipping calculation
  const normalItems = data.items.filter(i => !i.isStandalone);
  const standaloneItems = data.items.filter(i => i.isStandalone);
  // Weight for shipping: only normal (non-standalone) items
  const totalWeight = normalItems.reduce((sum, i) => sum + 0.5 * i.quantity, 0);
  // V2.1: Free shipping threshold excludes special-price items
  const specialSubtotal = data.items.filter(i => i.isSpecial).reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const normalSubtotal = normalItems.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const thresholdSubtotal = normalSubtotal - specialSubtotal;
  // Calculate shipping fee based on method
  let shippingFee = 0;
  if (data.shippingMethod === "west_malaysia") {
    if (thresholdSubtotal >= 150) {
      // 满 RM150：10kg 以内免邮，超过 10kg 每公斤 RM3
      shippingFee = totalWeight <= 10 ? 0 : Math.ceil(totalWeight - 10) * 3;
    } else {
      // 未满 RM150：10kg 以内 RM15，超过 10kg 每公斤 RM3
      shippingFee = 15 + (totalWeight <= 10 ? 0 : Math.ceil(totalWeight - 10) * 3);
    }
  } else if (data.shippingMethod === "east_malaysia_poslaju") {
    // V2.0.80: 东马 PosLaju 预收 RM50（2kg 内），打包后 API 计算实际运费
    shippingFee = 50;
  } else if (data.shippingMethod === "east_malaysia_shopee") {
    // V2.0.84: 东马 Shopee 运费固定 RM0，Shopee 平台自行向客户收取运费
    shippingFee = 0;
  } else if (data.shippingMethod === "east_malaysia") {
    // 兼容旧数据：默认走 Shopee 规则（RM0）
    shippingFee = 0;
  } else if (data.shippingMethod === "self_pickup") {
    shippingFee = 0;
  } else if (data.shippingMethod === "lalamove") {
    // V2.0.84: Lalamove — 满 RM150 公司承担 RM15，未满 RM15 收 RM15
    shippingFee = thresholdSubtotal >= 150 ? 0 : 15;
  }

  // The mall preview is guidance only. Re-evaluate promotions on the server
  // immediately before this new order is created.
  const marketingCart = data.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: Math.max(0, parseFloat(item.unitPrice) || 0),
  }));
  const appliedMarketingCampaigns = (await getActiveMarketingCampaigns())
    .filter((campaign) => Boolean((campaign as any).showInMall))
    .map((campaign) => ({
      campaign,
      result: evaluateMarketingCampaign(campaign as any, marketingCart, { orderSource: "store" }),
    }))
    .filter(({ result }) => result.eligible);
  const marketingDiscount = Math.min(subtotal, appliedMarketingCampaigns.reduce((sum, item) => sum + item.result.discountTotal, 0));
  const freeShippingEntitlement = appliedMarketingCampaigns.some(({ result }) => result.entitlements.some((entitlement) => entitlement.type === "free_shipping"));
  const marketingShippingSubsidy = freeShippingEntitlement ? shippingFee : 0;
  if (freeShippingEntitlement) shippingFee = 0;
  const totalAmount = subtotal - marketingDiscount + shippingFee;

  // Any local item from the mall joins the customer's newest truly unpaid XT
  // order, regardless of whether it was created in the mall, a live, AI chat,
  // post or the backend. A caller-supplied target is only accepted when it is
  // exactly that eligible candidate.
  const mergeTarget = resolvedCategory === "local"
    ? await findMergeableUnpaidLocalOrder(customer.id)
    : await findMergeableUnpaidImportLiveOrder(customer.id, importLiveRoomId!);
  if (data.mergeIntoOrderId && mergeTarget?.id !== data.mergeIntoOrderId) {
    throw new Error("所选订单已有付款或已进入包货／发货流程，不能继续自动合单");
  }
  if (mergeTarget) {
    await reserveProductStocksForOrder(regularItems);
    const mergedOrder = await appendItemsToUnpaidLocalOrder({
      customerId: customer.id,
      targetOrderId: mergeTarget.id,
      expectedOrderCategory: resolvedCategory,
      reserveStock: false,
      operationType: resolvedCategory === "import" ? "import_mall_merge" : "cross_channel_merge",
      operationBy: "商城",
      items: data.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku || null,
        productType: "physical" as const,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        variationId: item.variationId || null,
        variationName: item.variationName || null,
        facebookKeyword: item.facebookKeyword || null,
        discount: item.discount || "0.00",
        itemSource: "mall" as const,
        salesMode: resolvedCategory === "import" ? "import_preorder" as const : "normal" as const,
        priceType: item.isSpecial ? "special" as const : "retail" as const,
        originalUnitPrice: item.originalUnitPrice || null,
      })),
    });

    for (const item of data.items.filter((entry) => entry.bundleId)) {
      await deductBundleStock(item.bundleId!, item.quantity);
    }
    return { ...mergedOrder, merged: true };
  }

  // Create new order
  // V2.1.04: Use resolveOrderCategory for unified routing
  await reserveProductStocksForOrder(regularItems);
  const isImport = resolvedCategory === "import";
  const orderPrefix = isImport ? "XTC" : "XT";
  const orderNumber = await generateOrderNumber(orderPrefix);
  const secureToken = generateSecureToken();
  const checkoutLink = `/order/${orderNumber}/${secureToken}`;
  const orderResult = await db.insert(orders).values({
    orderNumber,
    secureToken,
    checkoutLink,
    customerId: customer.id,
    orderType: "physical",
    orderCategory: resolvedCategory,
    importStatus: isImport ? "pending" : null,
    physicalSubtotal: (subtotal - marketingDiscount).toFixed(2),
    membershipSubtotal: "0.00",
    shippingFee: shippingFee.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    totalWeight: totalWeight.toFixed(2),
    physicalStatus: "pending",
    shippingAddress,
    shippingMethod: data.shippingMethod as any,
    orderSource: "store",
    liveRoomId: importLiveRoomId,
    paymentMethodId: (data.paymentMethodId as any) || null,
    paymentMethodName: (data.paymentMethodName as any) || null,
    // V2.0.85: Save recipient info on order
    recipientName: data.customerName || null,
    recipientPhone: data.contactNumber || null,
    // V2.1.29: Save structured address fields on order
    addressLine1: data.addressLine1 || null,
    addressLine2: data.addressLine2 || null,
    postcode: data.postcode || null,
    recipientCity: data.city || null,
    recipientState: data.state || null,
    recipientPostcode: data.postcode || null,
    recipientCountry: data.area || null,
  });

  const orderId = (orderResult as any)[0].insertId;

  for (const item of data.items) {
    await db.insert(orderItems).values({
      orderId,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku || null,
      productType: "physical",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      variationId: item.variationId || null,
      variationName: item.variationName || null,
      facebookKeyword: item.facebookKeyword || null,
      discount: item.discount || "0.00",
      priceType: item.isSpecial ? "special" : "retail",
      originalUnitPrice: item.originalUnitPrice || null,
    });
  }

  for (const item of data.items.filter((entry) => entry.bundleId)) {
    await deductBundleStock(item.bundleId!, item.quantity);
  }

  // Save only auditable marketing results. Gifts and add-on products must still
  // be explicitly selected and use the existing atomic stock reservation service.
  for (const { campaign, result } of appliedMarketingCampaigns) {
    const discountsByRule = new Map<number, { amount: number; reasons: string[] }>();
    for (const discount of result.discounts) {
      const current = discountsByRule.get(discount.ruleId) ?? { amount: 0, reasons: [] };
      current.amount += discount.amount;
      current.reasons.push(discount.reason);
      discountsByRule.set(discount.ruleId, current);
    }
    for (const [ruleId, discount] of Array.from(discountsByRule.entries())) {
      await recordMarketingOrderApplication({
        orderId, campaignId: campaign.id, ruleId, customerId: customer.id,
        applicationType: "discount", originalAmount: subtotal, discountAmount: discount.amount,
        snapshot: { source: "mall_checkout", reasons: discount.reasons },
      });
    }
    for (const entitlement of result.entitlements) {
      const applicationType = entitlement.type === "free_shipping" ? "free_shipping"
        : entitlement.type === "lottery_entry" ? "lottery"
          : entitlement.type === "add_on_offer" ? "add_on" : "gift";
      await recordMarketingOrderApplication({
        orderId, campaignId: campaign.id, ruleId: entitlement.ruleId, customerId: customer.id,
        applicationType,
        shippingSubsidy: entitlement.type === "free_shipping" ? marketingShippingSubsidy : 0,
        snapshot: { source: "mall_checkout", entitlement },
      });
      if (entitlement.type === "lottery_entry") {
        await createMarketingLotteryEntry({
          campaignId: campaign.id, ruleId: entitlement.ruleId, customerId: customer.id, orderId,
          entrySource: "order_threshold", entryCount: entitlement.entryCount ?? 1,
          status: "pending_payment", reason: entitlement.reason,
        });
      }
    }
  }

  // Deduct stock for each item
  for (const item of data.items) {
    if (item.variationId) {
      // Deduct from variant stock
      await db.update(productVariations).set({
        stockQuantity: sql`${productVariations.stockQuantity} - ${item.quantity}`,
      }).where(eq(productVariations.id, item.variationId));
    }
    // Product stock was atomically reserved before order creation.
  }

  // V2.1.29: Auto-sync address to customer profile from mall checkout
  if (data.addressLine1 || data.city) {
    await db.update(customers).set({
      address: data.addressLine1 || null,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      state: data.state || null,
      postalCode: data.postcode || null,
      postcode: data.postcode || null,
      country: data.area || null,
    }).where(eq(customers.id, customer.id));
  }
  // Update customer stats
  await db.update(customers).set({
    totalOrders: sql`${customers.totalOrders} + 1`,
    totalSpent: sql`${customers.totalSpent} + ${totalAmount.toFixed(2)}`,
  }).where(eq(customers.id, customer.id));

  // V2.1: Create customer remark if provided
  if ((data as any).customerRemark) {
    await db.insert(orderRemarks).values({
      orderId,
      type: "customer",
      content: (data as any).customerRemark,
      remarkCategory: "other",
      createdBy: data.customerName,
    });
  }

  // V2.1: Create repotting remarks if provided
  if ((data as any).repotPairs && (data as any).repotPairs.length > 0) {
    const repotData = (data as any).repotPairs;
    const repotContent = repotData.map((p: any) => `${p.plantName} ×${p.quantity} → ${p.potName} ×${p.quantity}`).join('\n');
    await db.insert(orderRemarks).values({
      orderId,
      type: "customer",
      content: `【换盆】\n${repotContent}`,
      remarkCategory: "repotting",
      repottingData: JSON.stringify(repotData),
      createdBy: data.customerName,
    });
  }

    return { orderId, orderNumber, merged: false, totalAmount: totalAmount.toFixed(2) };
}

// 客户通过专属结单链接从商城加购时，将商品追加到原未付款订单。
export async function addMallItemsToOrder(orderId: number, items: Array<{
  productId: number;
  productName: string;
  productSku?: string;
  variationId?: number;
  variationName?: string;
  facebookKeyword?: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  isSpecial?: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const target = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    secureToken: orders.secureToken,
    physicalStatus: orders.physicalStatus,
    totalAmount: orders.totalAmount,
    membershipSubtotal: orders.membershipSubtotal,
    promotionDiscount: orders.promotionDiscount,
    discountAmount: orders.discountAmount,
    extraCharge: orders.extraCharge,
    creditUsed: orders.creditUsed,
    shippingMethod: orders.shippingMethod,
    orderCategory: orders.orderCategory,
    paidAmount: orders.paidAmount,
  }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!target[0]) throw new Error("Order not found");
  // 仅允许尚未履约完成的可编辑订单继续加单。packing 对应后台的
  // 「待包货／待备货」，仍未产生发货批次；partial_shipped 及其后的状态一律禁止。
  const mergeableStatuses = ["pending", "receipt_uploaded", "hold_order", "partial_payment", "packing"];
  const currentPhysicalStatus = target[0].physicalStatus || "pending";
  if (!mergeableStatuses.includes(currentPhysicalStatus)) throw new Error("当前订单状态不允许加单");
  // 中国代购可加中国进口代购商品，以及肥料和花盆；本地订单仍不能加入中国代购商品。
  const productIds = items.map((i) => i.productId).filter((id) => id > 0);
  if (productIds.length > 0) {
    const orderCat = target[0].orderCategory || "local";
    if (orderCat === "import") {
      await assertChinaImportOrderItemsEligible(productIds);
    } else {
      const productRows = await db.select({ orderCategory: products.orderCategory }).from(products).where(inArray(products.id, productIds));
      for (const pr of productRows) {
        if (pr.orderCategory === "import") {
        throw new Error("此商品属于中国代购商品，不能加入本地订单，请加入/建立中国代购 XTC 订单。");
        }
      }
    }
  }
  await reserveProductStocksForOrder(items);
  for (const item of items) {
    await db.insert(orderItems).values({
      orderId,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku || null,
      productType: "physical",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      variationId: item.variationId || null,
      variationName: item.variationName || null,
      facebookKeyword: item.facebookKeyword || null,
      priceType: item.isSpecial ? "special" : "retail",
      discount: "0.00",
      itemSource: "mall",
    });

    if (item.variationId) {
      await db.update(productVariations).set({
        stockQuantity: sql`${productVariations.stockQuantity} - ${item.quantity}`,
      }).where(eq(productVariations.id, item.variationId));
    }
    // Product stock was atomically reserved before the item was inserted.
    await allocateFifoCostForSale({ orderId, productId: item.productId, quantity: item.quantity, createdBy: "mall" });
  }

  const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const priceBreakdown = calculateOrderPriceBreakdown(allItems, {
    promotionDiscount: target[0].promotionDiscount,
    discountAmount: target[0].discountAmount,
  });
  const physicalSubtotal = priceBreakdown.physicalSubtotal;
  const totalWeight = allItems
    .filter((item: any) => item.productType === "physical" || item.productType === "gift")
    .reduce((sum, item) => sum + 0.5 * Number(item.quantity || 0), 0);
  const specialSubtotal = priceBreakdown.specialSubtotal;

  const membershipSubtotal = parseFloat(target[0].membershipSubtotal || "0");
  const promotionDiscount = parseFloat(target[0].promotionDiscount || "0");
  const discountAmount = parseFloat(target[0].discountAmount || "0");
  const extraCharge = parseFloat(target[0].extraCharge || "0");
  const creditUsed = parseFloat(target[0].creditUsed || "0");
  const eligibleSubtotal = priceBreakdown.freeShippingEligibleSubtotal;

  let shippingFee = 0;
  if (target[0].shippingMethod === "west_malaysia") {
    shippingFee = calculateWestMalaysiaShipping(totalWeight, eligibleSubtotal).shippingFee;
  } else if (target[0].shippingMethod === "east_malaysia_poslaju") {
    // V2.0.80: 东马 PosLaju 预收 RM50
    shippingFee = 50;
  } else if (target[0].shippingMethod === "east_malaysia_shopee") {
    // V2.0.84: 东马 Shopee 运费固定 RM0
    shippingFee = 0;
  } else if (target[0].shippingMethod === "lalamove") {
    // V2.0.84: Lalamove
    shippingFee = eligibleSubtotal >= 150 ? 0 : 15;
  }

  const totalAmount = physicalSubtotal + membershipSubtotal - promotionDiscount - discountAmount + extraCharge + shippingFee - creditUsed;

  // V2.1.14: Auto-recalculate order status after adding items
  const currentPaidAmount = parseFloat(target[0].paidAmount || "0");
  let newPhysicalStatus = currentPhysicalStatus;
  if (currentPaidAmount > 0 && currentPaidAmount < totalAmount) {
    newPhysicalStatus = "partial_payment";
  } else if (currentPaidAmount >= totalAmount && totalAmount > 0) {
    if (newPhysicalStatus === "pending") newPhysicalStatus = "packing";
  }

  await db.update(orders).set({
    physicalSubtotal: physicalSubtotal.toFixed(2),
    shippingFee: shippingFee.toFixed(2),
    customerPaidShipping: shippingFee.toFixed(2),
    totalWeight: totalWeight.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    physicalStatus: newPhysicalStatus,
  }).where(eq(orders.id, orderId));
  // V2.1.08: Removed auto-remark for mall add-on; itemSource on order_items already records it.
  // Activity log below serves as the system operation record.
  // V2.0.90: Add order operation log for timeline tracking
  await logOrderOperation(orderId, "mall_addon", `商城加单：${items.map((item) => `${item.productName} ×${item.quantity}`).join("、")}`, JSON.stringify({
    items: items.map((item) => ({ name: item.productName, qty: item.quantity, price: item.unitPrice })),
    totalBefore: target[0].totalAmount,
    totalAfter: totalAmount.toFixed(2),
  }), "客户结单页");
  broadcastChanges(["orders", "inventory", "dashboard", "customers"]);

  return {
    orderId,
    orderNumber: target[0].orderNumber,
    secureToken: target[0].secureToken,
    totalAmount: totalAmount.toFixed(2),
  };
}
// --- Mall Order Query (Guest) ---
export async function queryOrderByNumber(orderNumber: string, contactNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  // Find order by order number, then verify customer phone matches
  const order = await db.select().from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (order.length === 0) return undefined;
  const customer = await getCustomerById(order[0].customerId);
  if (!customer || customer.phoneNumber !== contactNumber) return undefined;
  return order[0];
}

// --- Smart Paste: parse customer info text ---
export function parseSmartPaste(text: string): {
  customerName?: string;
  contactNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  postcode?: string;
  city?: string;
  state?: string;
  area?: string;
} {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const result: any = {};

  // V2.0.79: Common label patterns to strip — these are prompt text, not data
  const labelPatterns: { regex: RegExp; field: 'customerName' | 'contactNumber' | 'address' }[] = [
    // Name labels
    { regex: /^\s*(receiver|name|recipient|收件人|姓名|买家|顾客)\s*[:：]\s*/i, field: 'customerName' },
    // Phone labels
    { regex: /^\s*(hp\s*no|hp|contact|phone|mobile|tel|电话|联络|手机)\s*[:：]?\s*/i, field: 'contactNumber' },
    // Address labels
    { regex: /^\s*(add|address|addr|地址|收货地址)\s*[:：]?\s*/i, field: 'address' },
  ];

  // Malaysian postcode pattern (5 digits)
  const postcodeRegex = /\b(\d{5})\b/;
  // Phone number pattern (Malaysian format)
  const phoneRegex = /(\+?6?01[0-9]\s?\-?\s?\d{3,4}\s?\-?\s?\d{3,4}|\+?6?01[0-9]{8,9})/;

  const states = ["Johor", "Kedah", "Kelantan", "Melaka", "Melacca", "Negeri Sembilan", "Pahang", "Penang", "Pulau Pinang", "Perak", "Perlis", "Sabah", "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Putrajaya", "Labuan", "WP Kuala Lumpur", "gelugor", "Georgetown", "Shah Alam", "Petaling Jaya", "Subang Jaya", "Klang", "Cheras", "Ampang", "Kajang", "Serdang", "Puchong", "Damansara"];
  const stateAliases: Record<string, string> = {
    "pulau pinang": "Penang", "penang": "Penang", "gelugor": "Penang", "georgetown": "Penang",
    "kuala lumpur": "Kuala Lumpur", "wp kuala lumpur": "Kuala Lumpur",
    "melacca": "Melaka", "melaka": "Melaka",
    "federal territory of kuala lumpur": "Kuala Lumpur",
    "federal territory": "Kuala Lumpur",
  };

  // V2.1.26补充4: Malaysian cities list for city extraction (Issue 1)
  const malaysianCities = [
    "Ipoh", "Johor Bahru", "Kuala Lumpur", "Georgetown", "Kuching", "Kota Kinabalu",
    "Shah Alam", "Petaling Jaya", "Subang Jaya", "Klang", "Cheras", "Ampang",
    "Kajang", "Serdang", "Puchong", "Damansara", "Seremban", "Malacca",
    "Alor Setar", "Kota Bharu", "Kuala Terengganu", "Kuantan", "Kangar",
    "Miri", "Sibu", "Sandakan", "Tawau", "Labuan",
    "Gombak", "Hulu Langat", "Sepang", "Kuala Selangor", "Sabak Bernam", "Kuala Langat",
    "Butterworth", "Bukit Mertajam", "Bayan Lepas", "Gelugor", "Balik Pulau",
    "Menglembu", "Gopeng", "Tapah", "Kampar", "Teluk Intan", "Lumut", "Sitiawan",
    "Taiping", "Kuala Kangsar", "Parit Buntar", "Sungai Siput",
    "Muar", "Batu Pahat", "Kluang", "Segamat", "Kulai", "Pasir Gudang",
    "Iskandar Puteri", "Skudai", "Pontian", "Kota Tinggi", "Mersing",
    "Mantin", "Port Dickson", "Nilai", "Bahau", "Kuala Pilah", "Jempol",
    "Lahad Datu", "Keningau", "Kudat", "Putatan",
    "Bintulu", "Limbang", "Sarikei", "Kapit",
    "Sungai Petani", "Kulim", "Baling", "Yan", "Sik", "Padang Terap",
    "Bentong", "Raub", "Temerloh", "Pekan", "Rompin", "Jerantut", "Cameron Highlands",
    "Pasir Mas", "Tumpat", "Pasir Puteh", "Bachok", "Tanah Merah",
    "Kemaman", "Dungun", "Marang", "Besut", "Setiu", "Hulu Terengganu",
    "Alor Gajah", "Jasin", "Masjid Tanah", "Merlimau",
    "Putrajaya", "Cyberjaya", "Bandar Baru Bangi", "Bangi",
  ];

  // V2.0.79: Collect address parts from labeled address lines
  const addressParts: string[] = [];

  for (const line of lines) {
    let workingLine = line;
    let labelField: 'customerName' | 'contactNumber' | 'address' | null = null;

    // V2.0.79: Strip labels first — labels are prompt text, not data
    for (const lp of labelPatterns) {
      const match = line.match(lp.regex);
      if (match) {
        labelField = lp.field;
        workingLine = line.replace(lp.regex, "").trim();
        break;
      }
    }

    // V2.0.79: If labeled as address, collect all address parts for later splitting
    if (labelField === 'address') {
      if (workingLine) addressParts.push(workingLine);
      continue;
    }

    // V2.0.79: If labeled as name, set customerName directly
    if (labelField === 'customerName') {
      if (workingLine && !result.customerName) result.customerName = workingLine;
      continue;
    }

    // V2.0.79: If labeled as phone, extract phone number and clean it
    if (labelField === 'contactNumber') {
      if (workingLine && !result.contactNumber) {
        // Remove all "-" and spaces from phone number
        result.contactNumber = workingLine.replace(/[\s\-]/g, "");
      }
      continue;
    }

    // No label found — try to auto-detect content type

    // Try phone match
    const phoneMatch = workingLine.match(phoneRegex);
    if (phoneMatch && !result.contactNumber) {
      result.contactNumber = phoneMatch[1].replace(/[\s\-]/g, "");
      workingLine = workingLine.replace(phoneMatch[0], " ").trim();
    }

    // Check for postcode in this line
    const postcodeMatch = workingLine.match(postcodeRegex);
    if (postcodeMatch && !result.postcode) {
      result.postcode = postcodeMatch[1];
      const restOfLine = workingLine.replace(postcodeRegex, "").replace(/,/g, " ").trim();
      const foundState = states.find(s => restOfLine.toLowerCase().includes(s.toLowerCase()));
      if (foundState) {
        const aliasKey = Object.keys(stateAliases).find(k => restOfLine.toLowerCase().includes(k.toLowerCase()));
        result.state = aliasKey ? stateAliases[aliasKey] : foundState;
        if (["Sabah", "Sarawak", "Labuan"].includes(result.state)) {
          result.area = "East Malaysia";
        } else {
          result.area = "West Malaysia";
        }
        const cityPart = restOfLine.replace(new RegExp(foundState, "gi"), "").trim();
        if (cityPart && !result.city) result.city = cityPart;
      } else if (restOfLine && !result.city) {
        result.city = restOfLine;
      }
      // If there's content before the postcode, treat as address
      const beforePostcode = workingLine.split(postcodeRegex)[0].replace(/,$/, "").trim();
      if (beforePostcode) addressParts.push(beforePostcode);
      continue;
    }

    // Check for Malaysian states (standalone state line)
    if (!result.state) {
      const foundState = states.find(s => workingLine.toLowerCase().includes(s.toLowerCase()));
      if (foundState) {
        const aliasKey = Object.keys(stateAliases).find(k => line.toLowerCase().includes(k.toLowerCase()));
        result.state = aliasKey ? stateAliases[aliasKey] : foundState;
        if (["Sabah", "Sarawak", "Labuan"].includes(result.state)) {
          result.area = "East Malaysia";
        } else {
          result.area = "West Malaysia";
        }
        const restOfLine = workingLine.replace(new RegExp(foundState, "gi"), "").replace(/,/g, "").trim();
        if (restOfLine && !result.city) result.city = restOfLine;
        continue;
      }
    }

    // First non-matched line without label is usually the name
    if (!result.customerName) {
      result.customerName = workingLine;
      continue;
    }

    // Otherwise treat as address part
    addressParts.push(workingLine);
  }

  // V2.0.79: Now split collected address parts into addressLine1, addressLine2, postcode, city, state
  if (addressParts.length > 0) {
    const fullAddress = addressParts.join(", ");
    // Try to extract postcode from the full address
    if (!result.postcode) {
      const pcMatch = fullAddress.match(postcodeRegex);
      if (pcMatch) {
        result.postcode = pcMatch[1];
      }
    }
    // Try to extract state from the full address
    if (!result.state) {
      const foundState = states.find(s => fullAddress.toLowerCase().includes(s.toLowerCase()));
      if (foundState) {
        const aliasKey = Object.keys(stateAliases).find(k => fullAddress.toLowerCase().includes(k.toLowerCase()));
        result.state = aliasKey ? stateAliases[aliasKey] : foundState;
        if (["Sabah", "Sarawak", "Labuan"].includes(result.state)) {
          result.area = "East Malaysia";
        } else {
          result.area = "West Malaysia";
        }
      }
    }
    // V2.1.26补充4: Try to extract city using known Malaysian cities list first (Issue 1)
    if (!result.city) {
      for (const city of malaysianCities) {
        const cityRegex = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (cityRegex.test(fullAddress)) {
          result.city = city;
          break;
        }
      }
    }
    // Fallback: text between postcode and state
    if (!result.city && result.postcode) {
      const afterPostcode = fullAddress.split(result.postcode)[1] || "";
      if (result.state) {
        const stateIdx = afterPostcode.toLowerCase().indexOf(result.state.toLowerCase());
        if (stateIdx > 0) {
          const cityCandidate = afterPostcode.substring(0, stateIdx).replace(/[,，]/g, "").trim();
          if (cityCandidate && !/\d/.test(cityCandidate)) result.city = cityCandidate;
        } else {
          const cityCandidate = afterPostcode.replace(/[,，]/g, "").trim();
          if (cityCandidate && !/\d/.test(cityCandidate)) result.city = cityCandidate.replace(new RegExp(result.state, "gi"), "").trim();
        }
      } else {
        const cityCandidate = afterPostcode.replace(/[,，]/g, "").trim();
        if (cityCandidate && !/\d/.test(cityCandidate)) result.city = cityCandidate;
      }
    }

    // V2.1.26补充4: Split address into line1 and line2 (Issue 1)
    // Remove postcode, city, state from the full address to get the street portion
    let streetPart = fullAddress;
    if (result.postcode) streetPart = streetPart.replace(new RegExp(`\\b${result.postcode}\\b`), "");
    if (result.city) streetPart = streetPart.replace(new RegExp(result.city, "gi"), "");
    if (result.state) streetPart = streetPart.replace(new RegExp(result.state, "gi"), "");
    streetPart = streetPart.replace(/[,，]/g, " ").replace(/\s+/g, " ").trim();
    // V2.1.26补充4: Also strip any remaining Name:/Phone:/Hp:/etc labels from street part (Issue 1)
    streetPart = streetPart.replace(/^\s*(name|phone|hp|tel|contact|receiver|recipient|收件人|姓名|电话|联络|手机)\s*[:：]?\s*/i, "").trim();

    if (streetPart) {
      // Split by comma or into two roughly equal parts
      const streetSegments = streetPart.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      if (streetSegments.length >= 2) {
        result.addressLine1 = streetSegments[0];
        result.addressLine2 = streetSegments.slice(1).join(", ");
      } else {
        // No comma to split on — put everything in line1
        result.addressLine1 = streetPart;
      }
    }
  }

  // V2.0.79: Default country for Malaysian addresses
  if (result.state && !result.area) {
    if (["Sabah", "Sarawak", "Labuan"].includes(result.state)) {
      result.area = "East Malaysia";
    } else {
      result.area = "West Malaysia";
    }
  }

  return result;
}

// ============================================================================
// V2.2: AI Smart Parse - Use LLM to parse customer address text
// ============================================================================

export async function aiSmartParse(text: string) {
  // First try rule-based parsing
  const ruleParsed = parseSmartPaste(text);
  
  // If we got good enough data, return it
  // V2.0.63: Also accept if we have name + phone + address (postcode may be missing in some addresses)
  if (ruleParsed.customerName && ruleParsed.contactNumber && (ruleParsed.postcode || ruleParsed.addressLine1)) {
    return { ...ruleParsed, rawText: text, method: "rule" };
  }
  
  // Otherwise, use LLM for smarter parsing
  try {
    const { invokeLLM } = await import("./_core/llm.js");
    const prompt = `Parse this Malaysian customer address text. Return JSON only, no explanation.
Extract: customerName, contactNumber, addressLine1, addressLine2, postcode, city, state, area ("West Malaysia" or "East Malaysia").
Sabah/Sarawak/Labuan = East Malaysia, all others = West Malaysia.
IMPORTANT: Remove any labels like "Name:", "Phone:", "Hp:", "Tel:", "Receiver:", "Address:", "ADD:" etc. from the values. Only return the actual data, not the labels.
IMPORTANT: Do NOT put the entire address in addressLine1. Split it properly: street address in addressLine1, additional info in addressLine2, postcode in postcode, city in city, state in state.

Text:
${text}`;
    
    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "customer_address",
          strict: true,
          schema: {
            type: "object",
            properties: {
              customerName: { type: "string" },
              contactNumber: { type: "string" },
              addressLine1: { type: "string" },
              addressLine2: { type: "string" },
              postcode: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              area: { type: "string", enum: ["West Malaysia", "East Malaysia"] },
            },
            required: ["customerName", "contactNumber", "addressLine1", "addressLine2", "postcode", "city", "state", "area"],
            additionalProperties: false,
          },
        },
      },
      maxCompletionTokens: 500,
      reasoning: { effort: "minimal" },
    });
    
    const content = typeof response.choices?.[0]?.message?.content === "string"
      ? response.choices[0].message.content
      : "{}";
    const aiParsedRaw = JSON.parse(content);
    // V2.0.63: Normalize field names — LLM may return snake_case or different field names
    const aiParsed: any = {};
    if (aiParsedRaw.customerName || aiParsedRaw.customer_name || aiParsedRaw.name) aiParsed.customerName = aiParsedRaw.customerName || aiParsedRaw.customer_name || aiParsedRaw.name;
    if (aiParsedRaw.contactNumber || aiParsedRaw.contact_number || aiParsedRaw.phone || aiParsedRaw.phoneNumber) aiParsed.contactNumber = aiParsedRaw.contactNumber || aiParsedRaw.contact_number || aiParsedRaw.phone || aiParsedRaw.phoneNumber;
    if (aiParsedRaw.addressLine1 || aiParsedRaw.address_line_1 || aiParsedRaw.address1) aiParsed.addressLine1 = aiParsedRaw.addressLine1 || aiParsedRaw.address_line_1 || aiParsedRaw.address1;
    if (aiParsedRaw.addressLine2 || aiParsedRaw.address_line_2 || aiParsedRaw.address2) aiParsed.addressLine2 = aiParsedRaw.addressLine2 || aiParsedRaw.address_line_2 || aiParsedRaw.address2;
    if (aiParsedRaw.postcode || aiParsedRaw.postalCode || aiParsedRaw.postal_code || aiParsedRaw.zip) aiParsed.postcode = aiParsedRaw.postcode || aiParsedRaw.postalCode || aiParsedRaw.postal_code || aiParsedRaw.zip;
    if (aiParsedRaw.city) aiParsed.city = aiParsedRaw.city;
    if (aiParsedRaw.state) aiParsed.state = aiParsedRaw.state;
    if (aiParsedRaw.area) aiParsed.area = aiParsedRaw.area;
    return { ...aiParsed, rawText: text, method: "ai" };
  } catch (error) {
    // Fallback to rule-based result
    return { ...ruleParsed, rawText: text, method: "rule_fallback" };
  }
}

// ============================================================================
// V2.2: Customer Credit functions
// ============================================================================

export async function useCustomerCredit(customerId: number, amount: number, orderId: number, orderNumber?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("Customer not found");
  const balance = parseFloat(customer.creditBalance?.toString() || "0");
  if (balance < amount) throw new Error(`Insufficient credit: ${balance} < ${amount}`);
  const newBalance = balance - amount;
  await db.update(customers).set({
    creditBalance: newBalance.toFixed(2),
  }).where(eq(customers.id, customerId));
  // Write ledger record
  await db.insert(customerCreditLedger).values({
    customerId,
    amount: (-amount).toFixed(2),
    balanceAfter: newBalance.toFixed(2),
    type: "order_use",
    reason: orderNumber ? `扣除订单 ${orderNumber}` : `扣除订单 #${orderId}`,
    orderId,
    orderNumber: orderNumber || null,
    performedBy: "System",
  });
  await logOrderOperation(orderId, "credit_used", `Used customer credit: RM${amount.toFixed(2)}`);
  return { remainingCredit: newBalance.toFixed(2) };
}

export async function refundCustomerCredit(customerId: number, amount: number, orderId: number, orderNumber?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("Customer not found");
  const balance = parseFloat(customer.creditBalance?.toString() || "0");
  const newBalance = balance + amount;
  await db.update(customers).set({
    creditBalance: newBalance.toFixed(2),
  }).where(eq(customers.id, customerId));
  // Write ledger record
  await db.insert(customerCreditLedger).values({
    customerId,
    amount: amount.toFixed(2),
    balanceAfter: newBalance.toFixed(2),
    type: "order_refund",
    reason: orderNumber ? `退回订单 ${orderNumber}` : `退回订单 #${orderId}`,
    orderId,
    orderNumber: orderNumber || null,
    performedBy: "System",
  });
  await logOrderOperation(orderId, "credit_refunded", `Refunded customer credit: RM${amount.toFixed(2)}`);
  return { newBalance: newBalance.toFixed(2) };
}

// V2.3: Adjust customer credit (add/deduct) from customer management
export async function adjustCustomerCredit(customerId: number, amount: number, reason: string, adminId: number, adminName?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("Customer not found");
  const balance = parseFloat(customer.creditBalance?.toString() || "0");
  const newBalance = balance + amount;
  if (newBalance < 0) throw new Error(`Insufficient credit: balance ${balance.toFixed(2)} < ${Math.abs(amount).toFixed(2)}`);
  await db.update(customers).set({
    creditBalance: newBalance.toFixed(2),
  }).where(eq(customers.id, customerId));
  // Write ledger record
  const ledgerType = amount >= 0 ? "admin_add" : "admin_deduct";
  await db.insert(customerCreditLedger).values({
    customerId,
    amount: amount.toFixed(2),
    balanceAfter: newBalance.toFixed(2),
    type: ledgerType,
    reason: reason || (amount >= 0 ? "Admin 增加 Credit" : "Admin 扣除 Credit"),
    performedBy: adminName || `Admin #${adminId}`,
    adminId,
  });
  return { newBalance: newBalance.toFixed(2), oldBalance: balance.toFixed(2) };
}

// ============================================================================
// V2.0.78: Customer Credit Ledger query
// ============================================================================

export async function getCustomerCreditLedger(customerId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ledger = await db.select().from(customerCreditLedger)
    .where(eq(customerCreditLedger.customerId, customerId))
    .orderBy(desc(customerCreditLedger.createdAt))
    .limit(limit);
  return ledger;
}

// ============================================================================
// V2.2: West Malaysia shipping fee calculation
// ============================================================================

export function calculateWestMalaysiaShipping(totalWeight: number, orderTotal: number = 0): { shippingFee: number; freeShipping: boolean; extraWeightCharge: number } {
  // V2.2 West Malaysia shipping rules per requirement document:
  // Order total >= RM150: first 10kg free, extra RM3/kg
  // Order total < RM150: first 10kg RM15, extra RM3/kg
  const { freeShippingThreshold, includedWeightKg, baseFeeBelowThreshold, additionalKgFee } = WEST_MALAYSIA_V22_SHIPPING;
  
  if (totalWeight <= 0) return { shippingFee: 0, freeShipping: orderTotal >= freeShippingThreshold, extraWeightCharge: 0 };
  
  const isFreeShipping = orderTotal >= freeShippingThreshold;
  const baseFee = isFreeShipping ? 0 : baseFeeBelowThreshold;
  
  if (totalWeight <= includedWeightKg) {
    return { shippingFee: baseFee, freeShipping: isFreeShipping, extraWeightCharge: 0 };
  }
  
  const extraWeight = Math.ceil(totalWeight - includedWeightKg);
  const extraCharge = extraWeight * additionalKgFee;
  return { shippingFee: baseFee + extraCharge, freeShipping: isFreeShipping, extraWeightCharge: extraCharge };
}

/**
 * Split product rows from a local physical order. Stock was reserved at
 * original order creation; this only moves order ownership. When the order
 * already has confirmed payment, the operator must explicitly allocate it
 * between the original and new order. Receipt evidence always remains on the
 * original payment records.
 */
export async function splitUnpaidPhysicalOrder(input: {
  orderId: number;
  items: Array<{ orderItemId: number; quantity: number }>;
  newOrderAllocatedPayment?: number;
  newOrderAllocatedCredit?: number;
  operator: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const requestedQuantities = new Map<number, number>();
  for (const selection of input.items) {
    if (!Number.isInteger(selection.orderItemId) || selection.orderItemId <= 0 || !Number.isInteger(selection.quantity) || selection.quantity <= 0) {
      throw new Error("请选择有效的商品与拆分数量");
    }
    if (requestedQuantities.has(selection.orderItemId)) throw new Error("同一商品不能重复选择");
    requestedQuantities.set(selection.orderItemId, selection.quantity);
  }
  if (requestedQuantities.size === 0) throw new Error("请选择要拆出的商品");
  const [source] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!source) throw new Error("订单不存在");
  if (source.orderType !== "physical" || source.orderCategory === "import") throw new Error("目前只支持本地实体订单拆单");
  if (!['pending', 'receipt_uploaded', 'partial_payment', 'hold_order'].includes(source.physicalStatus || '')) throw new Error("只有未付款、部分汇款或保留中的订单可以拆单");
  if (Number(source.discountAmount || 0) > 0 || Number(source.promotionDiscount || 0) > 0 || Number(source.extraCharge || 0) > 0) {
    throw new Error("含订单级折扣、促销或额外收费的订单不可拆单，请先处理金额后再拆单");
  }

  const toCents = (value: unknown) => Math.round(Number(value || 0) * 100);
  const formatCents = (value: number) => (value / 100).toFixed(2);
  const sourcePaidCents = toCents(source.paidAmount);
  const sourceCreditCents = toCents(source.creditUsed);
  const newOrderAllocatedPaymentCents = toCents(input.newOrderAllocatedPayment ?? 0);
  const newOrderAllocatedCreditCents = toCents(input.newOrderAllocatedCredit ?? 0);
  if (!Number.isFinite(newOrderAllocatedPaymentCents) || newOrderAllocatedPaymentCents < 0) {
    throw new Error("新订单分配的已收款金额必须为有效的非负数");
  }
  if (!Number.isFinite(newOrderAllocatedCreditCents) || newOrderAllocatedCreditCents < 0) {
    throw new Error("新订单分配的 Credit 金额必须为有效的非负数");
  }
  if (newOrderAllocatedPaymentCents > sourcePaidCents) throw new Error("新订单分配的已收款金额不可超过原订单已收款");
  if (newOrderAllocatedCreditCents > sourceCreditCents) throw new Error("新订单分配的 Credit 不可超过原订单已使用 Credit");

  const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, source.id));
  const knownItemIds = new Set(allItems.map((item) => item.id));
  if (Array.from(requestedQuantities.keys()).some((itemId) => !knownItemIds.has(itemId))) throw new Error("选择的商品不属于此订单或已更新");
  if (allItems.some((item) => (requestedQuantities.get(item.id) || 0) > item.quantity)) throw new Error("拆分数量不可超过原订单商品数量");

  const projectItemQuantity = (item: typeof allItems[number], quantity: number) => ({
    ...item,
    quantity,
    // Preserve the original per-unit price snapshot and prorate only row-level values.
    subtotal: ((Number(item.subtotal || 0) / item.quantity) * quantity).toFixed(2),
    discount: ((Number(item.discount || 0) / item.quantity) * quantity).toFixed(2),
  });
  const movedItems = allItems
    .filter((item) => requestedQuantities.has(item.id))
    .map((item) => projectItemQuantity(item, requestedQuantities.get(item.id)!));
  const retainedItems = allItems
    .filter((item) => item.quantity - (requestedQuantities.get(item.id) || 0) > 0)
    .map((item) => projectItemQuantity(item, item.quantity - (requestedQuantities.get(item.id) || 0)));
  if (retainedItems.length === 0) throw new Error("请至少保留一项商品在原订单");

  const calculateTotals = (items: typeof allItems) => {
    const price = calculateOrderPriceBreakdown(items);
    const totalWeight = items.reduce((sum, item) => sum + Number(item.unitWeight || 0) * item.quantity, 0);
    const shippingFee = source.shippingMethod === "west_malaysia"
      ? calculateWestMalaysiaShipping(totalWeight, price.freeShippingEligibleSubtotal).shippingFee
      : source.shippingMethod === "east_malaysia_poslaju" ? 50
        : source.shippingMethod === "lalamove" ? (price.freeShippingEligibleSubtotal >= WEST_MALAYSIA_V22_SHIPPING.freeShippingThreshold ? 0 : 15)
          : 0;
    return { physicalSubtotal: price.physicalSubtotal, membershipSubtotal: price.membershipSubtotal, totalWeight, shippingFee, totalAmount: price.physicalSubtotal + price.membershipSubtotal + shippingFee };
  };
  const retainedTotals = calculateTotals(retainedItems);
  const splitTotals = calculateTotals(movedItems);
  const newOrderNetTotalCents = toCents(splitTotals.totalAmount) - newOrderAllocatedCreditCents;
  const originalOrderRetainedCreditCents = sourceCreditCents - newOrderAllocatedCreditCents;
  const originalOrderNetTotalCents = toCents(retainedTotals.totalAmount) - originalOrderRetainedCreditCents;
  const originalOrderRetainedPaymentCents = sourcePaidCents - newOrderAllocatedPaymentCents;
  if (newOrderNetTotalCents < 0 || originalOrderNetTotalCents < 0) {
    throw new Error("Credit 分配不可超过对应拆分订单的应付金额");
  }
  if (newOrderAllocatedPaymentCents > newOrderNetTotalCents || originalOrderRetainedPaymentCents > originalOrderNetTotalCents) {
    throw new Error("已收款分配不可超过对应订单的应付金额，请重新调整分配金额");
  }

  const resolveSplitPaymentStatus = (currentStatus: string | null, paidCents: number, totalCents: number, isNewOrder: boolean) => {
    if (paidCents >= totalCents && totalCents > 0) {
      if (currentStatus === "hold_order") return "hold_order" as const;
      return source.shippingMethod === "self_pickup" ? "completed" as const : "packing" as const;
    }
    if (paidCents > 0) return "partial_payment" as const;
    if (!isNewOrder && currentStatus === "receipt_uploaded") return "receipt_uploaded" as const;
    return currentStatus === "hold_order" ? "hold_order" as const : "pending" as const;
  };
  const originalOrderStatus = resolveSplitPaymentStatus(source.physicalStatus || null, originalOrderRetainedPaymentCents, originalOrderNetTotalCents, false);
  const newOrderStatus = resolveSplitPaymentStatus(source.physicalStatus || null, newOrderAllocatedPaymentCents, newOrderNetTotalCents, true);
  const newOrderNumber = await generateOrderNumber("XT");
  const secureToken = generateSecureToken();
  const splitAt = new Date();
  let newOrderId = 0;

  await db.transaction(async (tx) => {
    const result = await tx.insert(orders).values({
      orderNumber: newOrderNumber, customerId: source.customerId, facebookName: source.facebookName, facebookId: source.facebookId, messengerId: source.messengerId,
      orderType: source.orderType, salesChannel: source.salesChannel, physicalSubtotal: splitTotals.physicalSubtotal.toFixed(2), membershipSubtotal: splitTotals.membershipSubtotal.toFixed(2),
      shippingFee: splitTotals.shippingFee.toFixed(2), totalAmount: formatCents(newOrderNetTotalCents), paidAmount: formatCents(newOrderAllocatedPaymentCents), creditUsed: formatCents(newOrderAllocatedCreditCents), physicalStatus: newOrderStatus,
      shippingAddress: source.shippingAddress, shippingMethod: source.shippingMethod, paymentMethodId: source.paymentMethodId, paymentMethodName: source.paymentMethodName,
      orderSource: source.orderSource, sourceName: source.sourceName, totalWeight: splitTotals.totalWeight.toFixed(2), orderCategory: source.orderCategory, orderNature: source.orderNature,
      recipientName: source.recipientName, recipientPhone: source.recipientPhone, addressLine1: source.addressLine1, addressLine2: source.addressLine2, postcode: source.postcode,
      recipientCity: source.recipientCity, recipientState: source.recipientState, recipientPostcode: source.recipientPostcode, recipientCountry: source.recipientCountry,
      parentOrderId: source.id, secureToken, checkoutLink: `/order/${newOrderNumber}/${secureToken}`, notificationStatus: "pending",
      fullPaymentConfirmedAt: ["packing", "completed"].includes(newOrderStatus) ? splitAt : null,
    });
    newOrderId = Number((result as any)[0]?.insertId);
    if (!newOrderId) throw new Error("无法建立拆分后的订单");
    for (const item of allItems) {
      const movedQuantity = requestedQuantities.get(item.id) || 0;
      if (movedQuantity === 0) continue;
      const movedItem = projectItemQuantity(item, movedQuantity);
      if (movedQuantity === item.quantity) {
        await tx.update(orderItems).set({ orderId: newOrderId }).where(and(eq(orderItems.orderId, source.id), eq(orderItems.id, item.id)));
        continue;
      }

      const retainedItem = projectItemQuantity(item, item.quantity - movedQuantity);
      await tx.update(orderItems).set({
        quantity: retainedItem.quantity,
        subtotal: retainedItem.subtotal,
        discount: retainedItem.discount,
      }).where(and(eq(orderItems.orderId, source.id), eq(orderItems.id, item.id)));
      await tx.insert(orderItems).values({
        orderId: newOrderId,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        productType: item.productType,
        giftSlot: item.giftSlot,
        variationId: item.variationId,
        variationName: item.variationName,
        facebookKeyword: item.facebookKeyword,
        quantity: movedItem.quantity,
        unitPrice: item.unitPrice,
        discount: movedItem.discount,
        subtotal: movedItem.subtotal,
        unitWeight: item.unitWeight,
        itemSource: item.itemSource,
        salesMode: item.salesMode,
        priceType: item.priceType,
        unitCost: item.unitCost,
        originalUnitPrice: item.originalUnitPrice,
        marketingCampaignId: item.marketingCampaignId,
        marketingRuleId: item.marketingRuleId,
        marketingSource: item.marketingSource,
        marketingDiscount: item.marketingDiscount,
        marketingSnapshot: item.marketingSnapshot,
      });
    }
    await tx.update(orders).set({
      physicalSubtotal: retainedTotals.physicalSubtotal.toFixed(2), membershipSubtotal: retainedTotals.membershipSubtotal.toFixed(2), shippingFee: retainedTotals.shippingFee.toFixed(2),
      totalWeight: retainedTotals.totalWeight.toFixed(2), totalAmount: formatCents(originalOrderNetTotalCents), paidAmount: formatCents(originalOrderRetainedPaymentCents), creditUsed: formatCents(originalOrderRetainedCreditCents),
      physicalStatus: originalOrderStatus,
      fullPaymentConfirmedAt: ["packing", "completed"].includes(originalOrderStatus) ? (source.fullPaymentConfirmedAt || splitAt) : source.fullPaymentConfirmedAt,
    }).where(eq(orders.id, source.id));

    // Keep the original receipt-bearing payment records on the original order.
    // A paired, receipt-free ledger transfer makes both order-level paidAmount
    // values durable when later payment edits trigger recalculateOrderBalance.
    const approvedPayments = await tx.select().from(orderPayments)
      .where(and(eq(orderPayments.orderId, source.id), eq(orderPayments.reviewStatus, "approved")));
    const approvedPaymentCents = approvedPayments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
    const reconciliationCents = sourcePaidCents - approvedPaymentCents;
    if (reconciliationCents !== 0) {
      await tx.insert(orderPayments).values({
        orderId: source.id,
        amount: formatCents(reconciliationCents),
        paymentDate: splitAt,
        purpose: "拆单前已收款余额校正",
        operatorName: input.operator,
        notes: "用于使历史订单已收款金额与付款流水一致；不含付款凭据。",
        paymentSource: "order_split_reconciliation",
        reviewStatus: "approved",
      });
    }
    if (newOrderAllocatedPaymentCents > 0) {
      await tx.insert(orderPayments).values({
        orderId: source.id,
        amount: formatCents(-newOrderAllocatedPaymentCents),
        paymentDate: splitAt,
        purpose: "拆单已收款分配（转出）",
        operatorName: input.operator,
        notes: `已分配 RM${formatCents(newOrderAllocatedPaymentCents)} 至拆分订单 ${newOrderNumber}；原付款凭据仍只保留在本订单。`,
        paymentSource: "order_split_allocation",
        reviewStatus: "approved",
      });
      await tx.insert(orderPayments).values({
        orderId: newOrderId,
        amount: formatCents(newOrderAllocatedPaymentCents),
        paymentDate: splitAt,
        purpose: "拆单已收款分配（转入）",
        operatorName: input.operator,
        notes: `由原订单 ${source.orderNumber} 分配；付款凭据仍只保留在原订单。`,
        paymentSource: "order_split_allocation",
        reviewStatus: "approved",
      });
    }
  });

  const splitAuditItems = movedItems.map((item) => ({ orderItemId: item.id, quantity: item.quantity, productName: item.productName }));
  const paymentAllocation = {
    originalPaidAmount: formatCents(sourcePaidCents),
    newOrderAllocatedPayment: formatCents(newOrderAllocatedPaymentCents),
    originalOrderRetainedPayment: formatCents(originalOrderRetainedPaymentCents),
    originalCreditUsed: formatCents(sourceCreditCents),
    newOrderAllocatedCredit: formatCents(newOrderAllocatedCreditCents),
    originalOrderRetainedCredit: formatCents(originalOrderRetainedCreditCents),
    receiptEvidence: "retained_on_original_order_only",
  };
  await logOrderOperation(source.id, "split", `订单拆单：已移出 ${movedItems.length} 项商品至 ${newOrderNumber}；已收款保留 RM${formatCents(originalOrderRetainedPaymentCents)}`, JSON.stringify({ newOrderId, newOrderNumber, items: splitAuditItems, paymentAllocation }), input.operator);
  await logOrderOperation(newOrderId, "split", `由订单 ${source.orderNumber} 拆分建立；已收款带入 RM${formatCents(newOrderAllocatedPaymentCents)}`, JSON.stringify({ parentOrderId: source.id, items: splitAuditItems, paymentAllocation }), input.operator);
  broadcastChanges(["orders", "dashboard", "customers"]);
  return { originalOrderId: source.id, originalOrderNumber: source.orderNumber, newOrderId, newOrderNumber, paymentAllocation };
}

/**
 * Lists other genuinely unpaid local XT orders that an administrator may
 * select as a manual merge target.  The target may belong to another customer:
 * this supports joint payment and delivery arrangements such as siblings
 * placing separate orders. XTC remains excluded because its merge rules depend
 * on a live-window context rather than the local-order flow.
 */
export async function getManualOrderMergeCandidates(sourceOrderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [source] = await db.select({ id: orders.id })
    .from(orders).where(eq(orders.id, sourceOrderId)).limit(1);
  if (!source) throw new Error("订单不存在");

  return unwrapMySqlRows<any>(await db.execute(sql`
    SELECT o.id, o.orderNumber, o.customerId,
           COALESCE(NULLIF(c.displayName, ''), NULLIF(c.name, ''), NULLIF(c.facebookName, ''), NULLIF(o.facebookName, ''), CONCAT('Customer #', o.customerId)) AS customerName,
           o.physicalStatus, o.totalAmount, o.creditUsed, o.shippingMethod,
           o.shippingAddress, o.createdAt
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customerId
    WHERE o.id <> ${sourceOrderId}
      AND o.orderCategory = 'local'
      AND o.orderType = 'physical'
      AND o.physicalStatus IN ('pending', 'hold_order')
      AND COALESCE(o.paidAmount, 0) = 0
      AND COALESCE(o.discountAmount, 0) = 0
      AND COALESCE(o.promotionDiscount, 0) = 0
      AND COALESCE(o.extraCharge, 0) = 0
      AND o.receiptUrl IS NULL
      AND o.paymentUploadedAt IS NULL
      AND o.paymentConfirmedAt IS NULL
      AND COALESCE(o.cancelProtection, 0) = 0
      AND NOT EXISTS (
        SELECT 1 FROM order_payments op
        WHERE op.orderId = o.id AND op.reviewStatus IN ('pending', 'approved')
      )
    ORDER BY o.createdAt DESC, o.id DESC
  `));
}

/**
 * Combines one pending local XT order into another. Inventory stays reserved
 * exactly once because existing order-item snapshots are moved rather than
 * recreated. The target remains the final payer and recipient even when the
 * source belongs to a different customer; the source is kept as a zero-value
 * cancelled audit record instead of being deleted.
 */
export async function mergeUnpaidLocalOrders(input: {
  sourceOrderId: number;
  targetOrderId: number;
  creditDisposition?: "carry_forward" | "return_to_source";
  operator: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (input.sourceOrderId === input.targetOrderId) throw new Error("请选择另一张订单作为合单目标");

  const selected = await db.select().from(orders).where(inArray(orders.id, [input.sourceOrderId, input.targetOrderId]));
  const source = selected.find((order) => order.id === input.sourceOrderId);
  const target = selected.find((order) => order.id === input.targetOrderId);
  const validate = async (order: typeof orders.$inferSelect | undefined, label: string) => {
    if (!order) throw new Error(`${label}不存在`);
    if (order.orderType !== "physical" || order.orderCategory !== "local") throw new Error(`${label}必须是本地实体订单`);
    if (!["pending", "hold_order"].includes(order.physicalStatus || "")) throw new Error(`${label}不是可合并的未付款订单`);
    if (Number(order.paidAmount || 0) > 0) throw new Error(`${label}已有已确认付款，不能合单`);
    if (Number(order.discountAmount || 0) > 0 || Number(order.promotionDiscount || 0) > 0 || Number(order.extraCharge || 0) > 0) {
      throw new Error(`${label}含订单级折扣、促销或额外收费，不能直接合单`);
    }
    if (order.receiptUrl || order.paymentUploadedAt || order.paymentConfirmedAt || order.cancelProtection) throw new Error(`${label}已有付款凭证或取消保护，不能合单`);
    const payments = await db.select({ id: orderPayments.id }).from(orderPayments).where(and(
      eq(orderPayments.orderId, order.id),
      inArray(orderPayments.reviewStatus, ["pending", "approved"]),
    )).limit(1);
    if (payments.length > 0) throw new Error(`${label}已有付款凭证或已确认付款，不能合单`);
  };

  await validate(source, "原订单");
  await validate(target, "目标订单");
  const sourceCreditUsed = Number(source!.creditUsed || 0);
  const targetCreditUsed = Number(target!.creditUsed || 0);
  const creditDisposition = sourceCreditUsed > 0 ? input.creditDisposition : "carry_forward";
  if (sourceCreditUsed > 0 && !creditDisposition) {
    throw new Error("原订单已使用客户 Credit，请选择带入保留订单或退回来源客户余额");
  }
  if (sourceCreditUsed > 0 && !source!.customerId) {
    throw new Error("原订单缺少客户资料，无法处理已使用的 Credit");
  }
  const sourceItems = await db.select({ id: orderItems.id, productName: orderItems.productName, quantity: orderItems.quantity })
    .from(orderItems).where(eq(orderItems.orderId, input.sourceOrderId));
  if (sourceItems.length === 0) throw new Error("原订单没有可合并的商品");

  await db.transaction(async (tx) => {
    await tx.update(orderItems).set({ orderId: input.targetOrderId }).where(eq(orderItems.orderId, input.sourceOrderId));
    await tx.update(orders).set({
      physicalStatus: "cancelled",
      physicalSubtotal: "0.00",
      membershipSubtotal: "0.00",
      shippingFee: "0.00",
      totalWeight: "0.00",
      totalAmount: "0.00",
      creditUsed: "0.00",
    }).where(eq(orders.id, input.sourceOrderId));
  });

  const recalculatedTarget = await recalculateOrderTotals(input.targetOrderId);
  let creditCarriedForward = 0;
  let creditReturnedToSource = 0;
  if (sourceCreditUsed > 0 && creditDisposition === "carry_forward") {
    // The retained order may only use Credit up to its remaining payable amount.
    // Any unused portion is returned to the original customer below.
    creditCarriedForward = Math.min(sourceCreditUsed, Math.max(0, Number(recalculatedTarget?.totalAmount || 0)));
    if (creditCarriedForward > 0) {
      await db.update(orders).set({
        creditUsed: (targetCreditUsed + creditCarriedForward).toFixed(2),
      }).where(eq(orders.id, input.targetOrderId));
      await recalculateOrderTotals(input.targetOrderId);
    }
  }
  if (sourceCreditUsed > 0) {
    creditReturnedToSource = creditDisposition === "return_to_source"
      ? sourceCreditUsed
      : sourceCreditUsed - creditCarriedForward;
    if (creditReturnedToSource > 0) {
      await refundCustomerCredit(source!.customerId!, creditReturnedToSource, input.sourceOrderId, source!.orderNumber || undefined);
    }
  }
  const itemSummary = sourceItems.map((item) => ({ orderItemId: item.id, productName: item.productName, quantity: item.quantity }));
  const creditAudit = {
    sourceCreditUsed: sourceCreditUsed.toFixed(2),
    targetCreditUsed: targetCreditUsed.toFixed(2),
    creditDisposition: sourceCreditUsed > 0 ? creditDisposition : "not_applicable",
    creditCarriedForward: creditCarriedForward.toFixed(2),
    creditReturnedToSource: creditReturnedToSource.toFixed(2),
  };
  await logOrderOperation(input.sourceOrderId, "manual_order_merge", `订单已合并至 ${target!.orderNumber}`, JSON.stringify({ targetOrderId: input.targetOrderId, targetOrderNumber: target!.orderNumber, sourceCustomerId: source!.customerId, targetCustomerId: target!.customerId, items: itemSummary, credit: creditAudit }), input.operator);
  await logOrderOperation(input.targetOrderId, "manual_order_merge", `已合并订单 ${source!.orderNumber}`, JSON.stringify({ sourceOrderId: input.sourceOrderId, sourceOrderNumber: source!.orderNumber, sourceCustomerId: source!.customerId, targetCustomerId: target!.customerId, items: itemSummary, credit: creditAudit }), input.operator);
  return { sourceOrderId: input.sourceOrderId, sourceOrderNumber: source!.orderNumber, targetOrderId: input.targetOrderId, targetOrderNumber: target!.orderNumber, movedItemCount: sourceItems.length, creditDisposition: creditAudit.creditDisposition, creditCarriedForward: creditAudit.creditCarriedForward, creditReturnedToSource: creditAudit.creditReturnedToSource };
}

// ============================================================================
// PACKING & SHIPPING MODULE (包货发货模块)
// ============================================================================

// --- Packing Workbench: Get orders by status ---
export async function getPackingOrders(status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // V2.1.26: Support both local orders (physicalStatus) and import orders (importStatus)
  // Local orders: orderCategory='local' (or null) with physicalStatus matching
  // Import orders: orderCategory='import' with importStatus matching
  const statusConditions = [];
  // Local orders by physicalStatus
  statusConditions.push(
    and(
      eq(orders.physicalStatus, status as any),
      sql`(orders.orderCategory IS NULL OR orders.orderCategory = 'local')`
    )
  );
  // Import orders by importStatus (map packing→ready_to_ship, shipped→shipped, etc.)
  const importStatusMap: Record<string, string[]> = {
    packing: ["ready_to_ship"],
    shipped: ["shipped"],
    partial_shipped: ["partial_shipped"],
    completed: ["completed"],
  };
  const importStatuses = importStatusMap[status] || [status];
  if (importStatuses.length > 0) {
    statusConditions.push(
      and(
        eq(orders.orderCategory, "import" as any),
        sql`orders.importStatus IN (${sql.raw(importStatuses.map(s => `'${s}'`).join(","))})`
      )
    );
  }

  const result = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    customerId: orders.customerId,
    customerName: customers.name,
    customerPhone: customers.phoneNumber,
    shippingAddress: orders.shippingAddress,
    shippingMethod: orders.shippingMethod,
    totalAmount: orders.totalAmount,
    paidAmount: orders.paidAmount,
    totalWeight: orders.totalWeight,
    createdAt: orders.createdAt,
    paymentConfirmedAt: orders.paymentConfirmedAt,
    // V2.1.26: Add shipping fee fields
    shippingFee: orders.shippingFee,
    customerPaidShipping: orders.customerPaidShipping,
    physicalSubtotal: orders.physicalSubtotal,
    orderCategory: orders.orderCategory,
    importStatus: orders.importStatus,
    physicalStatus: orders.physicalStatus,
    scheduledShippingDate: orders.scheduledShippingDate,
  }).from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(or(...statusConditions))
    .orderBy(desc(orders.createdAt));
  
  // Get item count and types for each order
  const enriched = await Promise.all(result.map(async (o) => {
    const items = await db.select({
      id: orderItems.id,
      quantity: orderItems.quantity,
      productName: orderItems.productName,
    }).from(orderItems).where(eq(orderItems.orderId, o.id));
    
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
    const itemTypes = items.length;
    
    // Check for special labels
    let specialLabel = "";
    if (o.shippingMethod === "lalamove") specialLabel = "LALAMOVE";
    else if (o.shippingMethod === "east_malaysia_shopee") specialLabel = "东马 SHOPEE";
    else if (o.shippingMethod === "east_malaysia_poslaju") specialLabel = "东马 POSLAJU";
    
    // V2.1.26: Determine effective status (import orders use importStatus)
    const effectiveStatus = o.orderCategory === "import" ? o.importStatus : o.physicalStatus;
    
    // V2.1.26: Calculate isFreeShipping
    const physicalSubtotalNum = parseFloat(o.physicalSubtotal || "0");
    // V2.1.26补充5: Free shipping only for west_malaysia and lalamove (>=RM150), not east Malaysia
    const isFreeShipping = (o.shippingMethod === 'west_malaysia' || o.shippingMethod === 'lalamove') && physicalSubtotalNum >= 150;
    
    return { ...o, totalQuantity: totalQty, itemTypes, specialLabel, effectiveStatus, isFreeShipping };
  }));
  
  return enriched;
}

// --- Packing Detail: Get full order with items and product images ---
export async function getPackingDetail(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const order = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    customerId: orders.customerId,
    customerName: customers.name,
    customerPhone: customers.phoneNumber,
    // 发货资料未在订单写入时，包货界面以客户档案作安全回退。
    customerAddress: customers.address,
    customerPostalCode: customers.postalCode,
    facebookName: orders.facebookName,
    recipientName: orders.recipientName,
    recipientPhone: orders.recipientPhone,
    addressLine1: orders.addressLine1,
    addressLine2: orders.addressLine2,
    postcode: orders.postcode,
    recipientCity: orders.recipientCity,
    recipientState: orders.recipientState,
    recipientPostcode: orders.recipientPostcode,
    recipientCountry: orders.recipientCountry,
    shippingAddress: orders.shippingAddress,
    shippingMethod: orders.shippingMethod,
    deliveryRemark: orders.shippingAddress,
    totalAmount: orders.totalAmount,
    paidAmount: orders.paidAmount,
    shippingFee: orders.shippingFee,
    discountAmount: orders.discountAmount,
    totalWeight: orders.totalWeight,
    physicalStatus: orders.physicalStatus,
    shippedAt: orders.shippedAt,
    notificationStatus: orders.notificationStatus,
    // V2.1.26: Add orderCategory, importStatus, physicalSubtotal
    orderCategory: orders.orderCategory,
    importStatus: orders.importStatus,
    physicalSubtotal: orders.physicalSubtotal,
    createdAt: orders.createdAt,
    paymentConfirmedAt: orders.paymentConfirmedAt,
    estimatedWeight: orders.estimatedWeight,
    customerPaidShipping: orders.customerPaidShipping,
    actualWeight: orders.actualWeight,
    actualShippingFee: orders.actualShippingFee,
    shippingDifference: orders.shippingDifference,
    isSpecialOrder: orders.isSpecialOrder,
    specialOrderType: orders.specialOrderType,
    specialOrderStatus: orders.specialOrderStatus,
    // V2.1.26补充4: Add extraCharge, creditUsed, extraChargeDescription, discountReason for A5 slip
    extraCharge: orders.extraCharge,
    extraChargeDescription: orders.extraChargeDescription,
    creditUsed: orders.creditUsed,
    discountReason: orders.discountReason,
  }).from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, orderId))
    .limit(1);
  
  if (order.length === 0) return null;
  
  const items = await db.select({
    id: orderItems.id,
    productId: orderItems.productId,
    productName: orderItems.productName,
    productSku: orderItems.productSku,
    variationId: orderItems.variationId,
    variationName: orderItems.variationName,
    quantity: orderItems.quantity,
    unitPrice: orderItems.unitPrice,
    discount: orderItems.discount,
    subtotal: orderItems.subtotal,
    productType: orderItems.productType,
  }).from(orderItems).where(eq(orderItems.orderId, orderId));
  
  // Get product images for each item
  const enrichedItems = await Promise.all(items.map(async (i) => {
    const images = await db.select({
      imageUrl: productImages.url,
    }).from(productImages)
      .where(eq(productImages.productId, i.productId))
      .orderBy(asc(productImages.sortOrder))
      .limit(5);
    
    // Also get cover image from products table
    const product = await db.select({
      coverImageUrl: products.coverImageUrl,
      keyword: products.keyword,
    }).from(products).where(eq(products.id, i.productId)).limit(1);
    
    return {
      ...i,
      coverImageUrl: product[0]?.coverImageUrl || null,
      keyword: product[0]?.keyword || null,
      images: images.map(img => img.imageUrl),
    };
  }));
  
  // Get existing packages
  const existingPackages = await db.select().from(packages).where(eq(packages.orderId, orderId)).orderBy(asc(packages.packageNumber));
  
  return {
    ...order[0],
    items: enrichedItems,
    packages: existingPackages,
  };
}

// --- A5 Packing Slip Data ---
export async function getPackingSlipData(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const detail = await getPackingDetail(orderId);
  if (!detail) return null;
  
  // Calculate summary
  const regularItems = detail.items.filter((i: any) => i.productType === "physical" && parseFloat(i.discount) === 0);
  const discountItems = detail.items.filter((i: any) => i.productType === "physical" && parseFloat(i.discount) > 0);
  const giftItems = detail.items.filter((i: any) => i.productType === "gift");
  
  const regularTotal = regularItems.reduce((sum: number, i: any) => sum + parseFloat(i.subtotal), 0);
  const discountTotal = discountItems.reduce((sum: number, i: any) => sum + parseFloat(i.subtotal), 0);
  const discountCount = discountItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
  
  const paidAmount = parseFloat(detail.paidAmount || "0");
  const totalAmount = parseFloat(detail.totalAmount || "0");
  const shippingFee = parseFloat(detail.shippingFee || "0");
  const discountAmount = parseFloat(detail.discountAmount || "0");
  const balance = totalAmount - paidAmount;
  
  // Determine special label for A5 header
  let specialLabel = "";
  if (detail.shippingMethod === "lalamove") specialLabel = "LALAMOVE";
  else if (detail.shippingMethod === "east_malaysia_shopee") specialLabel = "东马 SHOPEE";
  else if (detail.shippingMethod === "east_malaysia_poslaju") specialLabel = "东马 POSLAJU";
  
  // V3.0: Fetch all order remarks for A5 slip (unified: repotting, desired_delivery_date, other)
  const allRemarks = await getOrderRemarks(orderId);

  // V2.1.26补充6: Fix isFreeShipping - only for west_malaysia and lalamove (Issue 6)
  const physicalSubtotal = parseFloat((detail as any).physicalSubtotal || "0");
  const shippingMethod = (detail as any).shippingMethod || "";
  const isFreeShipping = (shippingMethod === "west_malaysia" || shippingMethod === "lalamove") && physicalSubtotal >= 150;
  // V2.1.26: Determine shipping method label (including 西马)
  let shippingMethodLabel = "";
  if (detail.shippingMethod === "lalamove") shippingMethodLabel = "LALAMOVE";
  else if (detail.shippingMethod === "east_malaysia_shopee") shippingMethodLabel = "东马 SHOPEE";
  else if (detail.shippingMethod === "east_malaysia_poslaju") shippingMethodLabel = "东马 POSLAJU";
  else shippingMethodLabel = "西马";

  // V2.1.26补充4: Add extraCharge, creditUsed, extraChargeDescription, discountReason for A5 slip
  const extraCharge = parseFloat((detail as any).extraCharge || "0");
  const creditUsed = parseFloat((detail as any).creditUsed || "0");
  const extraChargeDescription = (detail as any).extraChargeDescription || "";
  const discountReason = (detail as any).discountReason || "";

  return {
    orderNumber: detail.orderNumber,
    customerName: detail.customerName,
    customerPhone: detail.customerPhone,
    facebookName: (detail as any).facebookName,
    recipientName: (detail as any).recipientName,
    recipientPhone: (detail as any).recipientPhone,
    addressLine1: (detail as any).addressLine1,
    addressLine2: (detail as any).addressLine2,
    postcode: (detail as any).postcode,
    recipientCity: (detail as any).recipientCity,
    recipientState: (detail as any).recipientState,
    recipientPostcode: (detail as any).recipientPostcode,
    shippingAddress: detail.shippingAddress,
    shippingMethod: detail.shippingMethod,
    paymentConfirmedAt: detail.paymentConfirmedAt,
    items: detail.items,
    giftItems,
    remarks: allRemarks,
    // V2.1.26补充6: Add customerRemark and adminRemarks for A5 slip (Issue 4)
    customerRemark: allRemarks.filter((r: any) => r.type === "customer").map((r: any) => r.content).join("\n"),
    adminRemarks: allRemarks.filter((r: any) => r.type === "internal" || r.remarkCategory === "repotting" || r.remarkCategory === "desired_delivery_date" || r.remarkCategory === "other"),
    summary: {
      itemTypes: detail.items.length,
      regularTotal: regularTotal.toFixed(2),
      discountTotal: discountTotal.toFixed(2),
      discountCount,
      shippingFee: shippingFee.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      paidAmount: paidAmount.toFixed(2),
      balance: balance.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      physicalSubtotal: physicalSubtotal.toFixed(2),
      isFreeShipping,
      // V2.1.26补充4: Additional amount details for A5 slip
      extraCharge: extraCharge.toFixed(2),
      extraChargeDescription,
      creditUsed: creditUsed.toFixed(2),
      discountReason,
    },
    specialLabel,
    shippingMethodLabel,
  };
}

// --- Create Package (包裹) ---
export async function createPackage(data: {
  orderId: number;
  courier: string;
  shippingType: "auto" | "manual";
  trackingNumber?: string;
  shippingLabelUrl?: string;
  providerOrderId?: string;
  weight?: string;
  shippingCost?: string;
  itemIds?: number[]; // For partial shipping: which order items are in this package
  itemQuantities?: { itemId: string; quantity: number }[]; // V2.1.26补充4: Per-item shipped quantity (Issue 7)
  // V3.3: Every physical package is also a fulfilment batch. Merged packages
  // retain a primary order for legacy callers and use package_order_links for
  // the full set of participating orders.
  batchNo?: number;
  isMerged?: boolean;
  mergedOrderIds?: number[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get next package number
  const existing = await db.select().from(packages).where(eq(packages.orderId, data.orderId));
  const packageNumber = existing.length + 1;
  
  const result = await db.insert(packages).values({
    orderId: data.orderId,
    packageNumber,
    batchNo: data.batchNo ?? packageNumber,
    isMerged: data.isMerged ?? false,
    mergedOrderIds: data.mergedOrderIds?.length ? JSON.stringify(data.mergedOrderIds) : null,
    courier: data.courier,
    shippingType: data.shippingType,
    trackingNumber: data.trackingNumber || null,
    shippingLabelUrl: data.shippingLabelUrl || null,
    providerOrderId: data.providerOrderId || null,
    weight: data.weight || "0",
    shippingCost: data.shippingCost || null,
    status: "shipped",
    shippedAt: new Date(),
  });
  
  const packageId = (result as any)[0].insertId;
  
  // If item IDs provided (partial shipping), link them
  if (data.itemIds && data.itemIds.length > 0) {
    for (const itemId of data.itemIds) {
      // Get the order item to know quantity
      const item = await db.select().from(orderItems).where(eq(orderItems.id, itemId)).limit(1);
      if (item.length > 0) {
        // V2.1.26补充4: Use per-item quantity if provided, otherwise full quantity
        const qtyEntry = data.itemQuantities?.find(q => q.itemId === String(itemId));
        const shippedQty = qtyEntry ? qtyEntry.quantity : item[0].quantity;
        await db.insert(packageItems).values({
          packageId,
          orderItemId: itemId,
          quantity: shippedQty,
        });
      }
    }
  }
  
  return { packageId, packageNumber };
}

export type ShipmentSummaryPackage = {
  courier?: string | null;
  trackingNumber?: string | null;
  weight?: string | number | null;
  shippingCost?: string | number | null;
  shippedAt?: Date | null;
};

/**
 * 订单区域8仅保留一份物流摘要：最近包裹的快递／追踪号、所有包裹的重量及实际运费合计。
 * AWB原始链接始终保存在packages表，订单详情从最新带标签的包裹读取。
 */
export function calculateShipmentSummary(packagesForOrder: ShipmentSummaryPackage[]) {
  const latest = [...packagesForOrder].reverse().find((pkg) =>
    Boolean(String(pkg.trackingNumber || "").trim() || String(pkg.courier || "").trim()),
  );
  const numericValues = (field: "weight" | "shippingCost") => packagesForOrder
    .map((pkg) => pkg[field])
    .filter((value): value is string | number => value !== null && value !== undefined && String(value).trim() !== "")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const weights = numericValues("weight");
  const shippingCosts = numericValues("shippingCost");
  const shippedTimes = packagesForOrder
    .map((pkg) => pkg.shippedAt)
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    courierCompany: latest?.courier?.trim() || undefined,
    trackingNumber: latest?.trackingNumber?.trim() || undefined,
    actualWeight: weights.length ? weights.reduce((sum, value) => sum + value, 0) : undefined,
    actualShippingFee: shippingCosts.length ? shippingCosts.reduce((sum, value) => sum + value, 0) : undefined,
    firstShippedAt: shippedTimes[0],
  };
}

async function syncOrderShipmentSummary(db: any, orderId: number, physicalStatus: "partial_shipped" | "shipped") {
  const packageRows = await getPackagesForOrderDb(db, orderId, {
    courier: packages.courier,
    trackingNumber: packages.trackingNumber,
    weight: packages.weight,
    shippingCost: packages.shippingCost,
    shippedAt: packages.shippedAt,
  });
  const summary = calculateShipmentSummary(packageRows as unknown as ShipmentSummaryPackage[]);
  const update: Record<string, unknown> = { physicalStatus };
  // Once any part of an order has shipped, expiry/automatic cancellation must
  // never release its reservation. It remains protected after full shipment.
  if (physicalStatus === "partial_shipped") update.cancelProtection = true;
  if (summary.courierCompany) update.courierCompany = summary.courierCompany;
  if (summary.trackingNumber) update.trackingNumber = summary.trackingNumber;
  if (summary.actualWeight !== undefined) update.actualWeight = String(summary.actualWeight);
  if (summary.actualShippingFee !== undefined) update.actualShippingFee = String(summary.actualShippingFee);
  if (summary.firstShippedAt) update.shippedAt = summary.firstShippedAt;
  await db.update(orders).set(update).where(eq(orders.id, orderId));
  return summary;
}

/**
 * Gets direct packages and packages linked through merged delivery without
 * duplicating the primary order package. The package_items table remains the
 * only source of truth for item-level dispatched quantities.
 */
async function getPackagesForOrderDb<T extends Record<string, unknown>>(
  db: any,
  orderId: number,
  selection: T,
): Promise<T[]> {
  const selectionWithId = { ...selection, _packageId: packages.id };
  const direct = await db.select(selectionWithId).from(packages).where(eq(packages.orderId, orderId));
  const linked = await db.select(selectionWithId)
    .from(packageOrderLinks)
    .innerJoin(packages, eq(packageOrderLinks.packageId, packages.id))
    .where(eq(packageOrderLinks.orderId, orderId));
  const unique = new Map<number, T>();
  for (const row of [...direct, ...linked]) {
    const { _packageId, ...selected } = row as any;
    unique.set(Number(_packageId), selected as T);
  }
  return Array.from(unique.values());
}

async function getOrderFulfilmentQuantitiesDb(db: any, orderId: number) {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const packageRows = await getPackagesForOrderDb(db, orderId, { id: packages.id });
  const packageIds = packageRows.map((row: any) => row.id).filter(Boolean);
  const quantities = new Map<number, number>();
  if (packageIds.length) {
    const rows = await db.select().from(packageItems).where(inArray(packageItems.packageId, packageIds));
    for (const row of rows) quantities.set(row.orderItemId, (quantities.get(row.orderItemId) || 0) + Number(row.quantity || 0));
  }
  return { items, quantities };
}

async function syncOrderFulfilmentStateDb(db: any, orderId: number) {
  const { items, quantities } = await getOrderFulfilmentQuantitiesDb(db, orderId);
  const allShipped = items.length > 0 && items.every((item: any) => (quantities.get(item.id) || 0) >= item.quantity);
  await syncOrderShipmentSummary(db, orderId, allShipped ? "shipped" : "partial_shipped");
  return { allShipped, quantities };
}

// --- Full Shipping: Mark order as shipped ---
export async function fullShipping(orderId: number, packageList: Array<{
  courier: string;
  shippingType: "auto" | "manual";
  trackingNumber?: string;
  shippingLabelUrl?: string;
  providerOrderId?: string;
  weight?: string;
  shippingCost?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const orderRows = await db.select({
    id: orders.id,
    physicalStatus: orders.physicalStatus,
  }).from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = orderRows[0];
  if (!order) throw new Error("PACKING_ORDER_NOT_FOUND");
  if (order.physicalStatus !== "packing") {
    throw new Error("PACKING_ORDER_NOT_READY_FOR_FULL_SHIPMENT");
  }
  if (packageList.length === 0) throw new Error("PACKING_PACKAGE_REQUIRED");
  
  // Get all order items for linking to packages
  const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const allItemIds = allItems.map((item) => item.id);
  
  // Create all packages and link all items to the first (or only) package
  for (let i = 0; i < packageList.length; i++) {
    const pkg = packageList[i];
    // Link all items to the first package; subsequent packages get no items (multi-box scenario)
    const itemIds = i === 0 ? allItemIds : undefined;
    await createPackage({
      orderId,
      ...pkg,
      itemIds,
    });
  }
  
  await syncOrderShipmentSummary(db, orderId, "shipped");
  
  return { success: true };
}

// --- Partial Shipping: Ship selected items only ---
export async function partialShipping(orderId: number, itemIds: number[], packageData: {
  courier: string;
  shippingType: "auto" | "manual";
  trackingNumber?: string;
  shippingLabelUrl?: string;
  providerOrderId?: string;
  weight?: string;
  shippingCost?: string;
}, itemQuantities?: { itemId: string; quantity: number }[]) {
  // V2.1.26补充4: itemQuantities maps orderItemId -> shipped quantity (Issue 7)
  // If not provided, defaults to full quantity for each item
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const orderRows = await db.select({
    id: orders.id,
    physicalStatus: orders.physicalStatus,
  }).from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = orderRows[0];
  if (!order) throw new Error("PACKING_ORDER_NOT_FOUND");
  if (order.physicalStatus !== "packing" && order.physicalStatus !== "partial_shipped") {
    throw new Error("PACKING_ORDER_NOT_READY_FOR_PARTIAL_SHIPMENT");
  }
  if (itemIds.length === 0) throw new Error("PACKING_ITEM_REQUIRED");

  const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const orderItemIds = new Set(allItems.map((item) => item.id));
  if (itemIds.some((itemId) => !orderItemIds.has(itemId))) {
    throw new Error("PACKING_ITEM_NOT_IN_ORDER");
  }

  // V2.1.26补充4: Check already shipped quantities (not just IDs)
  const existingPackages = await getPackagesForOrderDb(db, orderId, { id: packages.id });
  const alreadyShippedQty: Map<number, number> = new Map();
  for (const pkg of existingPackages) {
    const pkgItems = await db.select().from(packageItems).where(eq(packageItems.packageId, pkg.id));
    for (const pi of pkgItems) {
      alreadyShippedQty.set(pi.orderItemId, (alreadyShippedQty.get(pi.orderItemId) || 0) + pi.quantity);
    }
  }
  // Validate: total shipped qty (existing + new) must not exceed order qty
  for (const itemId of itemIds) {
    const orderItem = allItems.find((it) => it.id === itemId);
    if (!orderItem) continue;
    const alreadyShipped = alreadyShippedQty.get(itemId) || 0;
    const qtyEntry = itemQuantities?.find(q => q.itemId === String(itemId));
    const newQty = qtyEntry ? qtyEntry.quantity : orderItem.quantity;
    if (alreadyShipped + newQty > orderItem.quantity) {
      throw new Error(`PACKING_QUANTITY_EXCEEDED: item ${itemId} already shipped ${alreadyShipped}, trying to ship ${newQty}, total ${orderItem.quantity}`);
    }
  }

  // Create package with selected items and quantities
  await createPackage({
    orderId,
    ...packageData,
    itemIds,
    itemQuantities,
  });
  
  const { allShipped } = await syncOrderFulfilmentStateDb(db, orderId);
  
  return { success: true, allShipped };
}

// --- Get packages for an order ---
export async function getOrderPackages(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const pkgs = await getPackagesForOrderDb(db, orderId, {
    id: packages.id,
    orderId: packages.orderId,
    packageNumber: packages.packageNumber,
    batchNo: packages.batchNo,
    isMerged: packages.isMerged,
    mergedOrderIds: packages.mergedOrderIds,
    courier: packages.courier,
    shippingType: packages.shippingType,
    trackingNumber: packages.trackingNumber,
    shippingLabelUrl: packages.shippingLabelUrl,
    providerOrderId: packages.providerOrderId,
    weight: packages.weight,
    shippingCost: packages.shippingCost,
    status: packages.status,
    shippedAt: packages.shippedAt,
    createdAt: packages.createdAt,
  });
  pkgs.sort((a: any, b: any) => Number(a.batchNo || a.packageNumber || 0) - Number(b.batchNo || b.packageNumber || 0));
  
  // Get items for each package
  const enriched = await Promise.all(pkgs.map(async (p) => {
    const items = await db.select({
      packageItemId: packageItems.id,
      orderItemId: packageItems.orderItemId,
      quantity: packageItems.quantity,
      productName: orderItems.productName,
      variationName: orderItems.variationName,
    }).from(packageItems)
      .leftJoin(orderItems, eq(packageItems.orderItemId, orderItems.id))
      .where(eq(packageItems.packageId, p.id));
    
    const linkedOrders = await db.select().from(packageOrderLinks).where(eq(packageOrderLinks.packageId, p.id));
    return { ...p, items, linkedOrders };
  }));
  
  return enriched;
}

/**
 * 建立一个跨订单的实体包裹。所有参与订单必须是同一客户、相同配送方式和地址；
 * 每张订单仍按本订单商品的实际发货数量维护状态，运费只作为包裹关联的分摊审计值。
 */
export async function shipMergedOrders(data: {
  orderIds: number[];
  itemQuantities: { itemId: string; quantity: number }[];
  packageData: {
    courier: string;
    shippingType: "auto" | "manual";
    trackingNumber?: string;
    shippingLabelUrl?: string;
    providerOrderId?: string;
    weight?: string;
    shippingCost?: string;
  };
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const orderIds = Array.from(new Set(data.orderIds.map(Number).filter(Number.isInteger)));
  if (orderIds.length < 2) throw new Error("PACKING_MERGE_REQUIRES_TWO_ORDERS");
  if (!data.itemQuantities.length) throw new Error("PACKING_MERGE_ITEMS_REQUIRED");

  const selectedOrders = await db.select().from(orders).where(inArray(orders.id, orderIds));
  if (selectedOrders.length !== orderIds.length) throw new Error("PACKING_MERGE_ORDER_NOT_FOUND");
  const first = selectedOrders[0];
  if (!selectedOrders.every(order => order.customerId === first.customerId && order.shippingMethod === first.shippingMethod && (order.shippingAddress || "") === (first.shippingAddress || ""))) {
    throw new Error("PACKING_MERGE_RECIPIENT_MISMATCH");
  }
  if (!selectedOrders.every(order => order.physicalStatus === "packing" || order.physicalStatus === "partial_shipped")) {
    throw new Error("PACKING_MERGE_ORDER_NOT_READY");
  }

  const requestedItemIds = Array.from(new Set(data.itemQuantities.map(item => Number(item.itemId)).filter(Number.isInteger)));
  const selectedItems = await db.select().from(orderItems).where(inArray(orderItems.id, requestedItemIds));
  if (!requestedItemIds.length || selectedItems.length !== requestedItemIds.length || selectedItems.some(item => !orderIds.includes(item.orderId))) {
    throw new Error("PACKING_MERGE_ITEM_NOT_IN_ORDER");
  }
  const requestedQuantities = new Map(data.itemQuantities.map(item => [Number(item.itemId), Math.trunc(Number(item.quantity))]));
  if (Array.from(requestedQuantities.values()).some(quantity => !Number.isFinite(quantity) || quantity <= 0)) throw new Error("PACKING_QUANTITY_REQUIRED");
  for (const orderId of orderIds) {
    const { quantities } = await getOrderFulfilmentQuantitiesDb(db, orderId);
    for (const item of selectedItems.filter(row => row.orderId === orderId)) {
      const quantity = requestedQuantities.get(item.id) || 0;
      if ((quantities.get(item.id) || 0) + quantity > item.quantity) throw new Error(`PACKING_QUANTITY_EXCEEDED: item ${item.id}`);
    }
  }

  const cost = Math.max(0, Number(data.packageData.shippingCost || 0));
  const orderValue = new Map<number, number>();
  for (const item of selectedItems) {
    const value = Number(item.unitPrice || 0) * (requestedQuantities.get(item.id) || 0);
    orderValue.set(item.orderId, (orderValue.get(item.orderId) || 0) + value);
  }
  const totalValue = Array.from(orderValue.values()).reduce((sum, value) => sum + value, 0);
  const shares = new Map<number, number>();
  let allocated = 0;
  orderIds.forEach((orderId, index) => {
    const share = index === orderIds.length - 1
      ? Math.max(0, cost - allocated)
      : Number((cost * ((orderValue.get(orderId) || 0) / (totalValue || orderIds.length))).toFixed(2));
    shares.set(orderId, share);
    allocated += share;
  });

  const created = await createPackage({
    orderId: orderIds[0],
    ...data.packageData,
    itemIds: requestedItemIds,
    itemQuantities: data.itemQuantities,
    isMerged: true,
    mergedOrderIds: orderIds,
  });
  for (const orderId of orderIds) {
    const shippingCostShare = (shares.get(orderId) || 0).toFixed(2);
    await db.insert(packageOrderLinks).values({ packageId: created.packageId, orderId, shippingCostShare });
    await syncOrderFulfilmentStateDb(db, orderId);
  }
  return { success: true, packageId: created.packageId, batchNo: created.packageNumber, shippingCostShares: Object.fromEntries(shares) };
}

export async function getOrderFulfilmentSummary(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { items, quantities } = await getOrderFulfilmentQuantitiesDb(db, orderId);
  return items.map((item: any) => ({
    orderItemId: item.id,
    orderedQuantity: item.quantity,
    shippedQuantity: quantities.get(item.id) || 0,
    remainingQuantity: Math.max(0, item.quantity - (quantities.get(item.id) || 0)),
  }));
}

// Orders may only share an AWB when the recipient and delivery method are
// identical. Return remaining quantities from package_items so the UI never
// proposes a quantity that has already shipped in an earlier batch.
export async function getMergeShippingCandidates(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sourceRows = await db.select({
    id: orders.id,
    customerId: orders.customerId,
    shippingAddress: orders.shippingAddress,
    shippingMethod: orders.shippingMethod,
  }).from(orders).where(eq(orders.id, orderId)).limit(1);
  const source = sourceRows[0];
  if (!source) throw new Error("订单不存在");
  // Historical walk-in / incomplete orders cannot be merged safely because
  // recipient equality cannot be established from an empty address/method.
  if (!source.shippingMethod || !source.shippingAddress) return [];

  const candidates = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    physicalStatus: orders.physicalStatus,
    totalAmount: orders.totalAmount,
  }).from(orders).where(and(
    eq(orders.customerId, source.customerId),
    eq(orders.shippingMethod, source.shippingMethod),
    eq(orders.shippingAddress, source.shippingAddress),
    or(eq(orders.physicalStatus, "packing"), eq(orders.physicalStatus, "partial_shipped")),
  )).orderBy(desc(orders.createdAt));

  const compatible = await Promise.all(candidates.map(async (candidate) => {
    const { items, quantities } = await getOrderFulfilmentQuantitiesDb(db, candidate.id);
    const remainingItems = items.map((item: any) => ({
      id: item.id,
      productName: item.productName,
      variationName: item.variationName,
      orderedQuantity: item.quantity,
      shippedQuantity: quantities.get(item.id) || 0,
      remainingQuantity: Math.max(0, item.quantity - (quantities.get(item.id) || 0)),
    })).filter((item: { remainingQuantity: number }) => item.remainingQuantity > 0);
    return { ...candidate, items: remainingItems };
  }));

  return compatible.filter((candidate) => candidate.items.length > 0);
}

// --- Customer Order Tracking (public) ---
export async function getCustomerOrderTracking(orderNumber: string, contactNumber?: string) {
  const db = await getDb();
  if (!db) return null;
  
  const order = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    physicalStatus: orders.physicalStatus,
    importStatus: (orders as any).importStatus,
    orderCategory: orders.orderCategory,
    totalAmount: orders.totalAmount,
    paidAmount: orders.paidAmount,
    shippingFee: orders.shippingFee,
    discountAmount: orders.discountAmount,
    shippingAddress: orders.shippingAddress,
    shippingMethod: orders.shippingMethod,
    customerName: customers.name,
    customerPhone: customers.phoneNumber,
    createdAt: orders.createdAt,
  }).from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  
  if (order.length === 0) return null;
  
  // Verify phone if provided
  if (contactNumber && order[0].customerPhone !== contactNumber) return null;
  
  const items = await db.select({
    productName: orderItems.productName,
    variationName: orderItems.variationName,
    quantity: orderItems.quantity,
    unitPrice: orderItems.unitPrice,
    productType: orderItems.productType,
    productId: orderItems.productId,
  }).from(orderItems).where(eq(orderItems.orderId, order[0].id));
  
  // Get product images for items
  const enrichedItems = await Promise.all(items.map(async (i) => {
    const product = await db.select({
      coverImageUrl: products.coverImageUrl,
    }).from(products).where(eq(products.id, i.productId)).limit(1);
    return { ...i, coverImageUrl: product[0]?.coverImageUrl || null };
  }));
  
  // Get packages
  const pkgs = await getOrderPackages(order[0].id);
  
  // Get order remarks (customer-visible: repotting, desired_delivery_date, other)
  const remarks = await db.select().from(orderRemarks)
    .where(eq(orderRemarks.orderId, order[0].id))
    .orderBy(desc(orderRemarks.createdAt));
  
    // Map status to customer-friendly labels
  const localStatusMap: Record<string, string> = {
    "pending": "未汇款",
    "receipt_uploaded": "付款审核中",
    "partial_payment": "部分汇款",
    "hold_order": "保留订单",
    "packing": "待包货",
    "shipped": "已发货",
    "partial_shipped": "部分发货",
    "completed": "已完成",
    "cancelled": "已取消",
  };
  // V2.0.99: XTC import order status map
  const importStatusMap: Record<string, string> = {
    "pending": "挂单",
    "receipt_uploaded": "待审核付款凭证",
    "partial_payment": "部分汇款",
    "waiting_stock": "待备货",
    "ready_to_ship": "待发货",
    "scheduled_ship": "预约发货",
    "partial_shipped": "部分发货",
    "shipped": "已发货",
    "completed": "已完成",
    "cancelled": "取消",
  };
  const isImport = order[0].orderCategory === 'import';
  const activeStatus = isImport ? (order[0].importStatus || 'pending') : (order[0].physicalStatus || 'pending');
  const customerStatus = isImport
    ? (importStatusMap[activeStatus] || activeStatus)
    : (localStatusMap[activeStatus] || activeStatus);
  return {
    ...order[0],
    customerStatus,
    items: enrichedItems,
    packages: pkgs,
    remarks: remarks,
  };
}

// ============================================================================
// LIVE ORDER CAPTURE (直播捉单)
// ============================================================================

// --- Parse comment keywords ---
export function parseCommentKeywords(comment: string): Array<{ keyword: string; quantity: number }> {
  const results: Array<{ keyword: string; quantity: number }> = [];
  // Match patterns like: ABS+2, ABS +2, ABS+ 2, pot+1, etc.
  // Also match: ABS (default quantity 1)
  const lines = comment.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
  
  for (const line of lines) {
    // Pattern: KEYWORD+NUMBER or KEYWORD +NUMBER or KEYWORD + NUMBER
    const match = line.match(/^([A-Za-z0-9]+)\s*\+\s*(\d+)$/);
    if (match) {
      results.push({ keyword: match[1].toUpperCase(), quantity: parseInt(match[2]) });
    } else {
      // Single keyword without quantity (default 1)
      const single = line.match(/^([A-Za-z0-9]+)$/);
      if (single) {
        results.push({ keyword: single[1].toUpperCase(), quantity: 1 });
      }
    }
  }
  
  return results;
}

// --- Match keywords to products ---
export async function matchKeywordsToProducts(keywords: Array<{ keyword: string; quantity: number }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const matched: Array<{ keyword: string; quantity: number; productId: number; productName: string; productSku: string; unitPrice: string; coverImageUrl: string | null }> = [];
  const unmatched: Array<{ keyword: string; quantity: number }> = [];
  
  for (const { keyword, quantity } of keywords) {
    // Try to match product keyword
    const product = await db.select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      sellingPrice: products.sellingPrice,
      coverImageUrl: products.coverImageUrl,
      keyword: products.keyword,
      status: products.status,
    }).from(products).where(eq(products.keyword, keyword)).limit(1);
    
    if (product.length > 0 && product[0].status !== "out_of_stock" && product[0].status !== "inactive") {
      matched.push({
        keyword,
        quantity,
        productId: product[0].id,
        productName: product[0].name,
        productSku: product[0].sku || "",
        unitPrice: product[0].sellingPrice || "0",
        coverImageUrl: product[0].coverImageUrl || null,
      });
    } else {
      // Try variant keyword
      const variant = await db.select({
        id: variants.id,
        productId: variants.productId,
        variationName: variants.name,
        sellingPrice: variants.sellingPrice,
        keyword: variants.keyword,
      }).from(variants).where(eq(variants.keyword, keyword)).limit(1);
      
      if (variant.length > 0) {
        const parentProduct = await db.select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          coverImageUrl: products.coverImageUrl,
          status: products.status,
        }).from(products).where(eq(products.id, variant[0].productId)).limit(1);
        
        if (parentProduct.length > 0 && parentProduct[0].status !== "out_of_stock" && parentProduct[0].status !== "inactive") {
          matched.push({
            keyword,
            quantity,
            productId: parentProduct[0].id,
            productName: `${parentProduct[0].name} - ${variant[0].variationName}`,
            productSku: parentProduct[0].sku || "",
            unitPrice: variant[0].sellingPrice || "0",
            coverImageUrl: parentProduct[0].coverImageUrl || null,
          });
        } else {
          unmatched.push({ keyword, quantity });
        }
      } else {
        unmatched.push({ keyword, quantity });
      }
    }
  }
  
  return { matched, unmatched };
}

// --- Match keywords to Campaign-specific products only ---
export async function matchKeywordsToCampaignProducts(
  keywords: Array<{ keyword: string; quantity: number }>,
  campaignId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all product IDs bound to this Campaign via campaign_buttons
  const buttons = await db.select({
    productId: campaignButtons.productId,
  }).from(campaignButtons)
    .where(eq(campaignButtons.campaignId, campaignId));

  const campaignProductIds = buttons.map((b: any) => b.productId);

  // Also get product IDs from campaign_flows that have associated buttons
  const flowButtons = await db.select({
    productId: campaignButtons.productId,
  }).from(campaignButtons)
    .innerJoin(campaignFlows, eq(campaignButtons.flowId, campaignFlows.id))
    .where(eq(campaignFlows.campaignId, campaignId));

  flowButtons.forEach((b: any) => {
    if (!campaignProductIds.includes(b.productId)) {
      campaignProductIds.push(b.productId);
    }
  });

  const matched: Array<{ keyword: string; quantity: number; productId: number; productName: string; productSku: string; unitPrice: string; coverImageUrl: string | null }> = [];
  const unmatched: Array<{ keyword: string; quantity: number }> = [];

  for (const { keyword, quantity } of keywords) {
    // Try to match product keyword within Campaign products only
    let product: any[] = [];
    if (campaignProductIds.length > 0) {
      product = await db.select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        sellingPrice: products.sellingPrice,
        coverImageUrl: products.coverImageUrl,
        keyword: products.keyword,
        status: products.status,
      }).from(products)
        .where(and(eq(products.keyword, keyword), inArray(products.id, campaignProductIds)))
        .limit(1);
    }

    if (product.length > 0 && product[0].status !== "out_of_stock" && product[0].status !== "inactive") {
      matched.push({
        keyword, quantity,
        productId: product[0].id,
        productName: product[0].name,
        productSku: product[0].sku || "",
        unitPrice: product[0].sellingPrice || "0",
        coverImageUrl: product[0].coverImageUrl || null,
      });
    } else {
      // Try variant keyword within Campaign products
      let variant: any[] = [];
      if (campaignProductIds.length > 0) {
        variant = await db.select({
          id: variants.id,
          productId: variants.productId,
          variationName: variants.name,
          sellingPrice: variants.sellingPrice,
          keyword: variants.keyword,
        }).from(variants)
          .where(and(eq(variants.keyword, keyword), inArray(variants.productId, campaignProductIds)))
          .limit(1);
      }

      if (variant.length > 0) {
        const parentProduct = await db.select({
          id: products.id, name: products.name, sku: products.sku, coverImageUrl: products.coverImageUrl, status: products.status,
        }).from(products).where(eq(products.id, variant[0].productId)).limit(1);

        if (parentProduct.length > 0 && parentProduct[0].status !== "out_of_stock" && parentProduct[0].status !== "inactive") {
          matched.push({
            keyword, quantity,
            productId: parentProduct[0].id,
            productName: `${parentProduct[0].name} - ${variant[0].variationName}`,
            productSku: parentProduct[0].sku || "",
            unitPrice: variant[0].sellingPrice || "0",
            coverImageUrl: parentProduct[0].coverImageUrl || null,
          });
        } else {
          unmatched.push({ keyword, quantity });
        }
      } else {
        // Keyword not in Campaign products — do NOT fallback to global
        unmatched.push({ keyword, quantity });
      }
    }
  }

  return { matched, unmatched };
}

// --- Create order from live capture ---
export async function createOrderFromLiveCapture(data: {
  commenterName: string;
  commenterPsid?: string;
  commentMessage: string;
  commentId?: string;
  postId?: string;
  liveVideoId?: string;
  liveRoomId?: number;
  liveType?: string;
  matchedProducts: Array<{
    keyword: string;
    quantity: number;
    productId: number;
    productName: string;
    productSku: string;
    unitPrice: string;
    liveRoomProductId?: number;
    isPreorder?: boolean;
    priceType?: "retail" | "special";
    originalUnitPrice?: string | null;
  }>;
  sourceName?: string;
  campaignId?: number;
  campaignName?: string;
  sourceType?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 不接受直播前端自行决定特价分类：以商品资料库内已启用的特价设定为准，
  // 把特价价及原售价一并固定为订单快照，供订单明细与 V2.2 免邮资格统一使用。
  const matchedProductIds = Array.from(new Set(data.matchedProducts.map((item) => item.productId).filter(Boolean)));
  if (matchedProductIds.length > 0) {
    const productPriceRows = await db.select({
      id: products.id,
      sellingPrice: products.sellingPrice,
      isSpecial: products.isSpecial,
      specialPrice: products.specialPrice,
    }).from(products).where(inArray(products.id, matchedProductIds));
    const priceByProductId = new Map(productPriceRows.map((product) => [product.id, product]));
    for (const item of data.matchedProducts) {
      const product = priceByProductId.get(item.productId);
      const specialPrice = Number(product?.specialPrice || 0);
      if (product?.isSpecial && specialPrice > 0) {
        item.unitPrice = specialPrice.toFixed(2);
        item.priceType = "special";
        item.originalUnitPrice = product.sellingPrice ? String(product.sellingPrice) : null;
      } else {
        item.priceType = "retail";
        item.originalUnitPrice = null;
      }
    }
  }

  // 商品级预售仍使用同一原子库存账本扣减，库存可显示为负数；不再维护直播房专属预售数量。
  const reservableProducts = data.matchedProducts.map((p) => ({ productId: p.productId, quantity: p.quantity }));

  for (const p of reservableProducts) {
    const productRows = await db.select({
      id: products.id,
      stockQuantity: products.stockQuantity,
      name: products.name,
      allowPresale: products.allowPresale,
      allowOversold: products.allowOversold,
    }).from(products).where(eq(products.id, p.productId)).limit(1);
    if (productRows.length > 0) {
      const product = productRows[0];
      const allowsPresale = Boolean(product.allowPresale || product.allowOversold);
      if (!allowsPresale && product.stockQuantity !== null && product.stockQuantity < p.quantity) {
        throw new Error(`STOCK_INSUFFICIENT: ${product.name} 库存不足，目前最多可下单 ${product.stockQuantity} 件`);
      }
    }
  }

  // Idempotency guard: Facebook may retry webhook delivery. If we already
  // processed this comment, return the existing order instead of creating a
  // duplicate.
  if (data.commentId) {
    const existing = await db.select({ orderId: liveOrderCaptures.orderId })
      .from(liveOrderCaptures)
      .where(eq(liveOrderCaptures.commentId, data.commentId))
      .limit(1);
    if (existing.length > 0 && existing[0].orderId) {
      const existingOrder = await db.select().from(orders).where(eq(orders.id, existing[0].orderId)).limit(1);
      if (existingOrder.length > 0) {
        return {
          orderNumber: existingOrder[0].orderNumber,
          totalAmount: existingOrder[0].totalAmount,
          orderId: existingOrder[0].id,
          duplicate: true,
          secureToken: existingOrder[0].secureToken || null,
        };
      }
    }
  }
  
  // Find or create customer
  const customer = await findOrCreateCustomer({
    name: data.commenterName,
    phoneNumber: "", // Will be updated via Messenger
    facebookName: data.commenterName,
    messengerId: data.commenterPsid,
  });
  // 黑名单客户可保留既有客户资料，但绝不可通过直播留言建立或合并订单。
  // 该检查必须在库存预留、订单合并及任何订单写入前执行。
  if (customer.isBlacklisted) {
    throw new Error(`CUSTOMER_BLACKLISTED: ${customer.displayName || customer.name || data.commenterName} 已被列入黑名单，无法捉单`);
  }
  
  // Calculate totals
  const subtotal = data.matchedProducts.reduce((sum, p) => sum + parseFloat(p.unitPrice) * p.quantity, 0);
  const totalWeight = data.matchedProducts.reduce((sum, p) => sum + 0.5 * p.quantity, 0);
  
  // Check for existing open order from same customer in same live room (for order merging)
  // Same customer + same live room + same orderCategory + order not yet closed = merge into existing order
  // V2.1.04: Use resolveOrderCategory for unified routing — product orderCategory takes priority
  const productIds = data.matchedProducts.map(p => p.productId);
  const orderCategory = await resolveOrderCategory({
    productIds,
    liveType: data.liveType,
  });
  const isImportOrder = orderCategory === 'import';
  if (isImportOrder) await assertImportLiveOrderWindow(data.liveRoomId);
  const mergeTarget = isImportOrder
    ? await findMergeableUnpaidImportLiveOrder(customer.id, data.liveRoomId!)
    : await findMergeableUnpaidLocalOrder(customer.id);
  const existingOrderId = mergeTarget?.id ?? null;
  
  if (existingOrderId) {
    // Merge via the shared service. The original order keeps its checkout
    // identity; each appended line retains its Facebook Live / post source.
    const mergedOrder = await appendItemsToUnpaidLocalOrder({
      customerId: customer.id,
      targetOrderId: existingOrderId,
      expectedOrderCategory: isImportOrder ? "import" : "local",
      items: data.matchedProducts.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        productSku: p.productSku || null,
        productType: "physical" as const,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        subtotal: (parseFloat(p.unitPrice) * p.quantity).toFixed(2),
        facebookKeyword: p.keyword,
        itemSource: "facebook_live" as const,
        salesMode: isImportOrder ? "import_preorder" as const : "normal" as const,
        priceType: p.priceType || "retail",
        originalUnitPrice: p.originalUnitPrice || null,
      })),
      operationType: isImportOrder ? "import_live_merge" : "cross_channel_merge",
      operationBy: data.sourceType === "facebook_post" ? "Facebook Post" : "Facebook Live",
      allocateFifoCost: true,
    });
    
    // Create live capture record linked to existing order
    await db.insert(liveOrderCaptures).values({
      commentId: data.commentId || null,
      commenterName: data.commenterName,
      commenterPsid: data.commenterPsid || null,
      commentMessage: data.commentMessage,
      postId: data.postId || null,
      liveVideoId: data.liveVideoId || null,
      parsedKeywords: JSON.stringify(data.matchedProducts.map(p => ({ keyword: p.keyword, quantity: p.quantity }))),
      matchedProducts: JSON.stringify(data.matchedProducts),
      status: "order_merged",
      orderId: existingOrderId,
      commentDate: new Date(),
    });
    await syncLiveRoomProductCounts(data.liveRoomId, data.matchedProducts);

    return { ...mergedOrder, merged: true };
  }
  
  // Create new order
  // V2.0.78: Auto-deduct credit from customer balance
  const customerCreditBalance = parseFloat(customer.creditBalance?.toString() || "0");
  const autoCreditUsed = Math.min(customerCreditBalance, Math.max(0, subtotal));
  const finalTotal = subtotal - autoCreditUsed;

  // V2.1.02: Use XTC prefix for import_preorder live rooms, XT for normal live rooms
  await reserveProductStocksForOrder(reservableProducts);
  const prefix = isImportOrder ? "XTC" : "XT";
  const orderNumber = await generateOrderNumber(prefix);
  const secureToken = generateSecureToken();
  const checkoutLink = `/order/${orderNumber}/${secureToken}`;
  const orderResult = await db.insert(orders).values({
    orderNumber,
    secureToken,
    checkoutLink,
    customerId: customer.id,
    facebookName: data.commenterName,
    messengerId: data.commenterPsid || null,
    orderType: "physical",
    physicalSubtotal: subtotal.toFixed(2),
    membershipSubtotal: "0.00",
    shippingFee: "0.00",
    totalAmount: finalTotal.toFixed(2),
    totalWeight: totalWeight.toFixed(2),
    physicalStatus: "pending",
    importStatus: isImportOrder ? "pending" : null,
    orderSource: "facebook_live",
    orderCategory: orderCategory as any,
    liveRoomId: data.liveRoomId || null,
    sourceName: data.sourceName || "Facebook Live",
    originalCustomerComment: data.commentMessage,
    commentDate: new Date(),
    campaignId: data.campaignId || null,
    campaignName: data.campaignName || null,
    sourceType: data.sourceType || null,
    creditUsed: autoCreditUsed.toFixed(2),
    // V2.1.29: Auto-sync customer's existing address to order
    recipientName: customer.name || customer.facebookName || data.commenterName || null,
    recipientPhone: customer.phoneNumber || null,
    addressLine1: customer.addressLine1 || null,
    addressLine2: customer.addressLine2 || null,
    postcode: customer.postcode || customer.postalCode || null,
    recipientCity: customer.city || null,
    recipientState: customer.state || null,
    recipientPostcode: customer.postcode || customer.postalCode || null,
    recipientCountry: customer.country || null,
  });
  
    const orderId = (orderResult as any)[0].insertId;
    // Create order items
  for (const p of data.matchedProducts) {
    const itemSubtotal = (parseFloat(p.unitPrice) * p.quantity).toFixed(2);
    await db.insert(orderItems).values({
      orderId,
      productId: p.productId,
      productName: p.productName,
      productSku: p.productSku || null,
      productType: "physical",
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      subtotal: itemSubtotal,
      facebookKeyword: p.keyword,
      discount: "0.00",
      itemSource: "facebook_live",
      salesMode: isImportOrder ? "import_preorder" : "normal",
      priceType: p.priceType || "retail",
      originalUnitPrice: p.originalUnitPrice || null,
    });
    // Product stock was atomically reserved before order creation.
    if (p.productId && !p.isPreorder) {
      await allocateFifoCostForSale({ orderId, productId: p.productId, quantity: p.quantity, createdBy: "facebook_live" });
    }
  }
  // V2.0.78: Auto-deduct credit and write ledger
  if (autoCreditUsed > 0) {
    await useCustomerCredit(customer.id, autoCreditUsed, orderId, orderNumber);
  }

  // Create live capture record
  await db.insert(liveOrderCaptures).values({
    commentId: data.commentId || null,
    commenterName: data.commenterName,
    commenterPsid: data.commenterPsid || null,
    commentMessage: data.commentMessage,
    postId: data.postId || null,
    liveVideoId: data.liveVideoId || null,
    parsedKeywords: JSON.stringify(data.matchedProducts.map(p => ({ keyword: p.keyword, quantity: p.quantity }))),
    matchedProducts: JSON.stringify(data.matchedProducts),
    status: "order_created",
    orderId,
    commentDate: new Date(),
  });
  await syncLiveRoomProductCounts(
    data.liveRoomId,
    data.matchedProducts,
  );
  
  broadcastChanges(["orders", "inventory", "dashboard", "customers"]);
  return { orderId, orderNumber, totalAmount: finalTotal.toFixed(2), secureToken, creditUsed: autoCreditUsed.toFixed(2) };
}

/**
 * 每次直播成功捉单都会进入同一数量账本。商品级预售只决定统一库存
 * 预留能否穿透零库存；它不会再创建第二套直播数量、库存或订单统计逻辑。
 */
async function syncLiveRoomProductCounts(
  liveRoomId: number | undefined,
  items: Array<{ liveRoomProductId?: number; productId: number; quantity: number }>,
) {
  if (!liveRoomId) return;
  const db = await getDb();
  if (!db) return;

  for (const item of items) {
    if (!item.liveRoomProductId) continue;
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const updated = await db.update(liveRoomProducts).set({
      orderedCount: sql`${liveRoomProducts.orderedCount} + ${quantity}`,
      reservedCount: sql`${liveRoomProducts.reservedCount} + ${quantity}`,
      preorderCount: sql`${liveRoomProducts.preorderCount}`,
      // 直播卡片可售数不显示为负数；实际主商品库存会由统一预留账本显示负数。
      availableStock: sql`GREATEST(0, ${liveRoomProducts.availableStock} - ${quantity})`,
      status: sql`CASE WHEN ${liveRoomProducts.availableStock} - ${quantity} <= 0 AND ${liveRoomProducts.allowPreorder} = false THEN 'sold_out' ELSE ${liveRoomProducts.status} END`,
    }).where(and(
      eq(liveRoomProducts.id, item.liveRoomProductId),
      eq(liveRoomProducts.liveRoomId, liveRoomId),
    ));

    const affectedRows = Number((updated as any)?.[0]?.affectedRows ?? (updated as any)?.affectedRows ?? 0);
    if (affectedRows < 1) {
      console.warn(`[Live] Could not sync live-room product ${item.liveRoomProductId} after order capture`);
    }
  }
}

// --- Get live order captures (admin) ---
export async function getLiveOrderCaptures(limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(liveOrderCaptures).orderBy(desc(liveOrderCaptures.createdAt)).limit(limit);
}

// ============================================================================
// V1.1: Dashboard Stats (仪表板统计)
// ============================================================================

type DashboardCashReceiptRow = {
  orderCategory: string | null;
  total: string | number | null;
};

type DashboardCashRefundRow = DashboardCashReceiptRow;

/**
 * Dashboard cash cards are cash-receipt indicators, not order-value indicators.
 * They only aggregate payment rows that have completed review, grouped by the
 * same local/import category used by the existing dashboard.
 */
export function summarizeDashboardCashReceipts(
  rows: DashboardCashReceiptRow[],
  refundRows: DashboardCashRefundRow[] = [],
) {
  let localReceivedMonth = 0;
  let importReceivedMonth = 0;
  let localRefundedMonth = 0;
  let importRefundedMonth = 0;

  for (const row of rows) {
    const amount = Number(row.total || 0);
    if (row.orderCategory === "import") {
      importReceivedMonth += amount;
    } else if (row.orderCategory === "local") {
      localReceivedMonth += amount;
    }
  }

  for (const row of refundRows) {
    const amount = Number(row.total || 0);
    if (row.orderCategory === "import") {
      importRefundedMonth += amount;
    } else if (row.orderCategory === "local") {
      localRefundedMonth += amount;
    }
  }

  const totalReceivedMonth = localReceivedMonth + importReceivedMonth;
  const totalRefundedMonth = localRefundedMonth + importRefundedMonth;

  return {
    localReceivedMonth: localReceivedMonth.toFixed(2),
    importReceivedMonth: importReceivedMonth.toFixed(2),
    totalReceivedMonth: totalReceivedMonth.toFixed(2),
    localRefundedMonth: localRefundedMonth.toFixed(2),
    importRefundedMonth: importRefundedMonth.toFixed(2),
    totalRefundedMonth: totalRefundedMonth.toFixed(2),
    localNetReceivedMonth: (localReceivedMonth - localRefundedMonth).toFixed(2),
    importNetReceivedMonth: (importReceivedMonth - importRefundedMonth).toFixed(2),
    totalNetReceivedMonth: (totalReceivedMonth - totalRefundedMonth).toFixed(2),
  };
}

/**
 * Financial audit trail used by Payment Record. A refund row is created only
 * after the refund/Credit action is executed, therefore it represents a
 * completed refund and is recorded by refundDate (falling back to createdAt).
 */
export async function getPaymentRecords(input: {
  from: Date;
  to: Date;
  type?: "all" | "payment" | "refund";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { from, to, type = "all" } = input;
  const customerName = sql<string>`COALESCE(${customers.displayName}, ${customers.name}, ${customers.facebookName}, ${orders.facebookName}, '')`;
  const orderCategory = (orders as any).orderCategory;
  const records: Array<{
    id: number;
    orderId: number;
    orderNumber: string | null;
    orderCategory: string | null;
    customerName: string;
    amount: string | number;
    type: "payment" | "refund";
    occurredAt: Date | string | null;
    method: string | null;
    source: string | null;
    operatorName: string | null;
    notes: string | null;
    receiptUrl: string | null;
  }> = [];

  if (type !== "refund") {
    const paymentRows = await db.select({
      id: orderPayments.id,
      orderId: orderPayments.orderId,
      orderNumber: orders.orderNumber,
      orderCategory,
      customerName,
      amount: orderPayments.amount,
      occurredAt: sql<Date>`COALESCE(${orderPayments.paymentDate}, ${orderPayments.createdAt})`,
      method: orderPayments.paymentMethod,
      source: orderPayments.paymentSource,
      operatorName: orderPayments.operatorName,
      notes: orderPayments.notes,
      receiptUrl: orderPayments.receiptUrl,
    }).from(orderPayments)
      .innerJoin(orders, eq(orderPayments.orderId, orders.id))
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(and(
        eq(orderPayments.reviewStatus, "approved"),
        sql`COALESCE(${orderPayments.paymentDate}, ${orderPayments.createdAt}) >= ${from}`,
        sql`COALESCE(${orderPayments.paymentDate}, ${orderPayments.createdAt}) < ${to}`,
      ));
    records.push(...paymentRows.map((row) => ({ ...row, type: "payment" as const })));
  }

  if (type !== "payment") {
    const refundRows = await db.select({
      id: orderRefunds.id,
      orderId: orderRefunds.orderId,
      orderNumber: orders.orderNumber,
      orderCategory,
      customerName,
      amount: orderRefunds.amount,
      occurredAt: sql<Date>`COALESCE(${orderRefunds.refundDate}, ${orderRefunds.createdAt})`,
      method: orderRefunds.refundMethod,
      operatorName: orderRefunds.operatorName,
      notes: orderRefunds.notes,
      receiptUrl: orderRefunds.receiptUrl,
    }).from(orderRefunds)
      .innerJoin(orders, eq(orderRefunds.orderId, orders.id))
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(and(
        sql`${orderRefunds.status} IN ('processed', 'awaiting_return')`,
        sql`COALESCE(${orderRefunds.refundDate}, ${orderRefunds.createdAt}) >= ${from}`,
        sql`COALESCE(${orderRefunds.refundDate}, ${orderRefunds.createdAt}) < ${to}`,
      ));
    records.push(...refundRows.map((row) => ({ ...row, type: "refund" as const, source: null })));
  }

  return records.sort((a, b) => {
    const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
    const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
    return bTime - aTime || b.id - a.id;
  });
}

export async function getDashboardV11Stats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Row 1: Today's tasks
  const pendingPayment = await db.select({ count: sql`COUNT(*)` }).from(orders)
    .where(eq(orders.physicalStatus, 'receipt_uploaded')) as any[];
  const pendingShipment = await db.select({ count: sql`COUNT(*)` }).from(orders)
    .where(eq(orders.physicalStatus, 'packing')) as any[];
  const partialShipped = await db.select({ count: sql`COUNT(*)` }).from(orders)
    .where(eq(orders.physicalStatus, 'partial_shipped')) as any[];

  // Row 2: Orders
  const unpaidOrders = await db.select({ count: sql`COUNT(*)` }).from(orders)
    .where(eq(orders.physicalStatus, 'pending')) as any[];
  const paidThisMonth = await db.select({ count: sql`COUNT(*)` }).from(orders)
    .where(and(eq(orders.physicalStatus, 'packing'), gte(orders.createdAt, firstOfMonth))) as any[];
  const holdOrders = await db.select({ count: sql`COUNT(*)` }).from(orders)
    .where(eq(orders.physicalStatus, 'hold_order')) as any[];

  // Row 3: Inventory
  const lowStock = await db.select({ count: sql`COUNT(*)` }).from(products)
    .where(and(eq(products.type, 'physical'), lte(products.stockQuantity, 10), gt(products.stockQuantity, 0))) as any[];
  const outOfStock = await db.select({ count: sql`COUNT(*)` }).from(products)
    .where(and(eq(products.type, 'physical'), eq(products.stockQuantity, 0))) as any[];

  // Row 4: Business stats
  const todayOrders = await db.select({ count: sql`COUNT(*)` }).from(orders)
    .where(gte(orders.createdAt, today)) as any[];
  const todayShipped = await db.select({ count: sql`COUNT(*)` }).from(orders)
    .where(and(eq(orders.physicalStatus, 'shipped'), gte(orders.shippedAt, today))) as any[];
  const todaySales = await db.select({ total: sql`COALESCE(SUM(totalAmount), 0)` }).from(orders)
    .where(gte(orders.createdAt, today)) as any[];
  const monthSales = await db.select({ total: sql`COALESCE(SUM(totalAmount), 0)` }).from(orders)
    .where(gte(orders.createdAt, firstOfMonth)) as any[];
  // 合单按追加审计动作而非订单建立次数统计。一张 XT 或合资格 XTC 订单
  // 可在同一天收到多次不同来源的追加；XTC 审计只会在既有截止日期守卫通过后写入。
  const dashboardMergeOperationTypes = [
    "cross_channel_merge",
    "import_ai_merge",
    "import_manual_merge",
    "import_mall_merge",
    "import_live_merge",
  ] as const;
  const todayCrossChannelMergeRows = await db.select({
    orderId: orderOperationLogs.orderId,
    changes: orderOperationLogs.changes,
  }).from(orderOperationLogs)
    .where(and(
      inArray(orderOperationLogs.operationType, dashboardMergeOperationTypes as any),
      gte(orderOperationLogs.createdAt, today),
      lt(orderOperationLogs.createdAt, tomorrow),
    ));
  const todayCrossChannelMerge = todayCrossChannelMergeRows.reduce((summary, row) => {
    try {
      const changes = JSON.parse(row.changes || "{}") as {
        addedAmount?: string | number;
        items?: Array<{ quantity?: number; unitPrice?: string | number }>;
      };
      const fallbackItemAmount = (changes.items || []).reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
        0,
      );
      summary.addedAmount += Number(changes.addedAmount ?? fallbackItemAmount) || 0;
    } catch {
      // Historical or malformed audit payloads remain countable. Their amount
      // is intentionally omitted instead of making the whole Dashboard fail.
    }
    summary.count += 1;
    return summary;
  }, { count: 0, addedAmount: 0 });

  // Cash receipts: only approved payment records, allocated by payment date.
  // This deliberately does not infer payment from an order status or totalAmount.
  const monthlyApprovedPayments = await db.select({
    orderCategory: (orders as any).orderCategory,
    total: sql<string>`COALESCE(SUM(${orderPayments.amount}), 0)`,
  }).from(orderPayments)
    .innerJoin(orders, eq(orderPayments.orderId, orders.id))
    .where(and(
      eq(orderPayments.reviewStatus, "approved"),
      sql`COALESCE(${orderPayments.paymentDate}, ${orderPayments.createdAt}) >= ${firstOfMonth}`,
      sql`COALESCE(${orderPayments.paymentDate}, ${orderPayments.createdAt}) < ${firstOfNextMonth}`,
      sql`${(orders as any).orderCategory} IN ('local', 'import')`,
    ))
    .groupBy((orders as any).orderCategory) as DashboardCashReceiptRow[];
  const monthlyCompletedRefunds = await db.select({
    orderCategory: (orders as any).orderCategory,
    total: sql<string>`COALESCE(SUM(${orderRefunds.amount}), 0)`,
  }).from(orderRefunds)
    .innerJoin(orders, eq(orderRefunds.orderId, orders.id))
    .where(and(
      sql`${orderRefunds.status} IN ('processed', 'awaiting_return')`,
      sql`COALESCE(${orderRefunds.refundDate}, ${orderRefunds.createdAt}) >= ${firstOfMonth}`,
      sql`COALESCE(${orderRefunds.refundDate}, ${orderRefunds.createdAt}) < ${firstOfNextMonth}`,
      sql`${(orders as any).orderCategory} IN ('local', 'import')`,
    ))
    .groupBy((orders as any).orderCategory) as DashboardCashRefundRow[];
  const cashReceiptBreakdown = summarizeDashboardCashReceipts(monthlyApprovedPayments, monthlyCompletedRefunds);

  // V2.1.12: Row 5: Scheduled shipping today — unified query matching getScheduledShippingOrders
  const scheduledValidStatuses = ['pending', 'packing', 'hold_order', 'receipt_uploaded', 'partial_payment', 'waiting_stock', 'ready_to_ship', 'scheduled_ship'];
  const scheduledTodayFromRemarks = await db.select({ count: sql`COUNT(DISTINCT ${orderRemarks.orderId})` }).from(orderRemarks)
    .leftJoin(orders, eq(orderRemarks.orderId, orders.id))
    .where(and(
      sql`${orderRemarks.remarkCategory} = 'desired_delivery_date'`,
      sql`DATE(${orderRemarks.desiredDeliveryDate}) = ${today}`,
      sql`${orders.physicalStatus} IN (${sql.join(scheduledValidStatuses.map(s => sql`${s}`), sql`,`)})`,
      sql`${orders.scheduledShippingDate} IS NULL`
    )) as any[];
  const scheduledTodayFromOrders = await db.select({ count: sql`COUNT(*)` }).from(orders)
    .where(and(
      sql`${orders.scheduledShippingDate} IS NOT NULL`,
      sql`DATE(${orders.scheduledShippingDate}) = ${today}`,
      sql`${orders.physicalStatus} IN (${sql.join(scheduledValidStatuses.map(s => sql`${s}`), sql`,`)})`
    )) as any[];
  const scheduledTodayTotal = Number(scheduledTodayFromRemarks[0]?.count || 0) + Number(scheduledTodayFromOrders[0]?.count || 0);

    // Order alerts
  const repotOrders = await db.select({ count: sql`COUNT(DISTINCT orderId)` }).from(orderItemRepots) as any[];
  const holdExpiring = await db.select({ count: sql`COUNT(*)` }).from(orders)
    .where(eq(orders.physicalStatus, 'hold_order')) as any[];
  // V2.0.51: Notification stats (this month)
  const notifSentCount = await db.select({ count: sql`COUNT(*)` }).from(notificationLogs)
    .where(and(eq(notificationLogs.status, 'sent'), sql`${notificationLogs.createdAt} >= ${firstOfMonth}`)) as any[];
  const notifFailedCount = await db.select({ count: sql`COUNT(*)` }).from(notificationLogs)
    .where(and(eq(notificationLogs.status, 'failed'), sql`${notificationLogs.createdAt} >= ${firstOfMonth}`)) as any[];
  const refundManagementPending = await db.select({
    count: sql<string>`COUNT(*)`,
    amount: sql<string>`COALESCE(SUM(${orderRefunds.requestedAmount}), 0)`,
  }).from(orderRefunds)
    .where(eq(orderRefunds.status, 'pending')) as any[];
  const refundManagementAwaitingReturn = await db.select({ count: sql<string>`COUNT(*)` }).from(orderRefunds)
    .where(eq(orderRefunds.status, 'awaiting_return')) as any[];
  return {
    row1: {
      pendingPayment: Number(pendingPayment[0]?.count || 0),
      pendingShipment: Number(pendingShipment[0]?.count || 0),
      partialShipped: Number(partialShipped[0]?.count || 0),
    },
    row2: {
      unpaidOrders: Number(unpaidOrders[0]?.count || 0),
      paidThisMonth: Number(paidThisMonth[0]?.count || 0),
      holdOrders: Number(holdOrders[0]?.count || 0),
    },
    row3: {
      lowStock: Number(lowStock[0]?.count || 0),
      outOfStock: Number(outOfStock[0]?.count || 0),
    },
    row4: {
      todayOrders: Number(todayOrders[0]?.count || 0),
      todayShipped: Number(todayShipped[0]?.count || 0),
      todaySales: todaySales[0]?.total || "0.00",
      monthSales: monthSales[0]?.total || "0.00",
    },
    crossChannelMerge: {
      count: todayCrossChannelMerge.count,
      addedAmount: todayCrossChannelMerge.addedAmount.toFixed(2),
    },
    // Dashboard cash view: confirmed payment rows in the selected calendar month.
    cashReceiptBreakdown,
    refundManagement: {
      pendingCount: Number(refundManagementPending[0]?.count || 0),
      pendingAmount: String(refundManagementPending[0]?.amount || "0.00"),
      awaitingReturnCount: Number(refundManagementAwaitingReturn[0]?.count || 0),
    },
    row5: {
      scheduledToday: scheduledTodayTotal,
    },
    alerts: {
      repotOrders: Number(repotOrders[0]?.count || 0),
      scheduledToday: scheduledTodayTotal,
      holdExpiring: Number(holdExpiring[0]?.count || 0),
      pendingPayment: Number(pendingPayment[0]?.count || 0),
    },
    // Recent remarks (latest 10 across all orders)
    recentRemarks: await getRecentRemarkSummaries(10),
    // AI Agent pending notifications (status = 'pending')
    pendingNotifications: await getPendingNotifications(10),
    // V2.0: Import Pre-order stats
    importPreorderStats: await getImportPreorderStatsSafe(),
    // V2.0.51: Notification stats
    notificationStats: {
      sentThisMonth: Number(notifSentCount[0]?.count || 0),
      failedThisMonth: Number(notifFailedCount[0]?.count || 0),
      totalThisMonth: Number(notifSentCount[0]?.count || 0) + Number(notifFailedCount[0]?.count || 0),
      successRate: (() => {
        const total = Number(notifSentCount[0]?.count || 0) + Number(notifFailedCount[0]?.count || 0);
        return total > 0 ? Math.round((Number(notifSentCount[0]?.count || 0) / total) * 100) : 0;
      })(),
    },
    // V2.1.25: Membership manual follow-up count (待人工发送)
    membershipManualFollowUp: Number((await db.select({ count: sql`COUNT(*)` }).from(orders)
      .where(eq(orders.membershipStatus, 'manual_follow_up')) as any[])[0]?.count || 0),
  };
}

// Helper: get import pre-order stats safely (always returns a structure)
async function getImportPreorderStatsSafe() {
  try {
    const stats = await getImportPreorderStats();
    if (!stats) return { totalPaidAmount: "0.00", totalUnpaidAmount: "0.00", specialOrdersCount: 0, activeBatchesCount: 0 };
    return {
      totalPaidAmount: (stats as any).paidSales || "0.00",
      totalUnpaidAmount: String((stats as any).unpaidCount || 0),
      specialOrdersCount: (stats as any).specialOrders || 0,
      activeBatchesCount: (stats as any).activeBatches || 0,
    };
  } catch {
    return { totalPaidAmount: "0.00", totalUnpaidAmount: "0.00", specialOrdersCount: 0, activeBatchesCount: 0 };
  }
}

// Helper: get recent remark summaries (live + customer + internal)
async function getRecentRemarkSummaries(limit: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: orderRemarks.id,
    orderId: orderRemarks.orderId,
    type: orderRemarks.type,
    content: orderRemarks.content,
    createdBy: orderRemarks.createdBy,
    createdAt: orderRemarks.createdAt,
    orderNumber: orders.orderNumber,
    facebookName: orders.facebookName,
  }).from(orderRemarks)
    .leftJoin(orders, eq(orderRemarks.orderId, orders.id))
    .orderBy(desc(orderRemarks.createdAt))
    .limit(limit);
  return rows;
}

// Helper: get pending notifications (AI Agent awaiting manual action)
async function getPendingNotifications(limit: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: notificationLogs.id,
    orderId: notificationLogs.orderId,
    customerId: notificationLogs.customerId,
    type: notificationLogs.type,
    channel: notificationLogs.channel,
    message: notificationLogs.message,
    status: notificationLogs.status,
    errorMessage: notificationLogs.errorMessage,
    createdAt: notificationLogs.createdAt,
    orderNumber: orders.orderNumber,
    facebookName: orders.facebookName,
  }).from(notificationLogs)
    .leftJoin(orders, eq(notificationLogs.orderId, orders.id))
    .where(eq(notificationLogs.status, 'pending'))
    .orderBy(desc(notificationLogs.createdAt))
    .limit(limit);
  return rows;
}

// Helper: gt
function gt(field: any, value: any) {
  return sql`${field} > ${value}`;
}

// ============================================================================
// V1.1: Order Remarks (订单备注 - 3种类型)
// ============================================================================

export async function getOrderRemarks(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(orderRemarks)
    .where(eq(orderRemarks.orderId, orderId))
    .orderBy(desc(orderRemarks.createdAt));
}

export async function createOrderRemark(data: {
  orderId: number;
  type: "live" | "customer" | "internal";
  content: string;
  createdBy?: string;
  remarkCategory?: string;
  desiredDeliveryDate?: string;
  desiredDeliveryReason?: string;
  repottingData?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(orderRemarks).values({
    orderId: data.orderId,
    type: data.type,
    content: data.content,
    createdBy: data.createdBy || null,
    remarkCategory: (data.remarkCategory as any) || null,
    desiredDeliveryDate: data.desiredDeliveryDate ? new Date(data.desiredDeliveryDate) : null,
    desiredDeliveryReason: data.desiredDeliveryReason || null,
    repottingData: data.repottingData || null,
  });

  broadcastChanges(["orders", "dashboard"]);
}

// V3.0: Update order remark (Admin can modify content)
export async function updateOrderRemark(id: number, data: {
  content?: string;
  remarkCategory?: string;
  desiredDeliveryDate?: string;
  desiredDeliveryReason?: string;
  repottingData?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = {};
  if (data.content !== undefined) updateData.content = data.content;
  if (data.remarkCategory !== undefined) updateData.remarkCategory = data.remarkCategory as any;
  if (data.desiredDeliveryDate !== undefined) updateData.desiredDeliveryDate = data.desiredDeliveryDate ? new Date(data.desiredDeliveryDate) : null;
  if (data.desiredDeliveryReason !== undefined) updateData.desiredDeliveryReason = data.desiredDeliveryReason || null;
  if (data.repottingData !== undefined) updateData.repottingData = data.repottingData || null;
  await db.update(orderRemarks).set(updateData).where(eq(orderRemarks.id, id));
  broadcastChanges(["orders", "dashboard"]);
}

// V2.0.53: Get orders with remarks for Dashboard — exclude shipped/completed orders
export async function getOrdersWithRemarks() {
  const db = await getDb();
  if (!db) return [];
  // V2.0.53: Exclude shipped and completed orders from Dashboard remarks
  const activeStatuses = ['pending', 'paid', 'packing', 'hold_order'];
  const rows = await db.select({
    remarkId: orderRemarks.id,
    orderId: orderRemarks.orderId,
    orderNumber: orders.orderNumber,
    customerName: customers.name,
    facebookName: orders.facebookName,
    orderSource: orders.orderSource,
    physicalStatus: orders.physicalStatus,
    remarkCategory: orderRemarks.remarkCategory,
    content: orderRemarks.content,
    repottingData: orderRemarks.repottingData,
    desiredDeliveryDate: orderRemarks.desiredDeliveryDate,
    desiredDeliveryReason: orderRemarks.desiredDeliveryReason,
    createdBy: orderRemarks.createdBy,
    createdAt: orderRemarks.createdAt,
  }).from(orderRemarks)
    .leftJoin(orders, eq(orderRemarks.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(sql`${orders.physicalStatus} IN (${sql.join(activeStatuses.map(s => sql`${s}`), sql`,`)})`)
    .orderBy(desc(orderRemarks.createdAt));
  // Group by orderId: return all remarks so frontend can show multiple tags per order
  return rows;
}

// V3.0: Get all remarks with order info (for remark list page)
export async function getAllRemarksWithOrder(limit?: number) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({
    remarkId: orderRemarks.id,
    orderId: orderRemarks.orderId,
    orderNumber: orders.orderNumber,
    customerName: customers.name,
    facebookName: orders.facebookName,
    orderSource: orders.orderSource,
    physicalStatus: orders.physicalStatus,
    type: orderRemarks.type,
    remarkCategory: orderRemarks.remarkCategory,
    content: orderRemarks.content,
    repottingData: orderRemarks.repottingData,
    desiredDeliveryDate: orderRemarks.desiredDeliveryDate,
    desiredDeliveryReason: orderRemarks.desiredDeliveryReason,
    createdBy: orderRemarks.createdBy,
    createdAt: orderRemarks.createdAt,
  }).from(orderRemarks)
    .leftJoin(orders, eq(orderRemarks.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .orderBy(desc(orderRemarks.createdAt));
  if (limit) {
    return await query.limit(limit);
  }
  return await query;
}

// V3.0: Get today's desired delivery count for Dashboard
export async function getTodayScheduledShippingCount() {
  const db = await getDb();
  if (!db) return 0;
  const today = new Date().toISOString().split('T')[0];
  const rows = await db.select({ count: sql`COUNT(*)` }).from(orderRemarks)
    .where(and(
      eq(orderRemarks.remarkCategory, "desired_delivery_date"),
      eq(orderRemarks.desiredDeliveryDate, today as any),
    ));
  return Number(rows[0]?.count || 0);
}

export async function deleteOrderRemark(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(orderRemarks).where(eq(orderRemarks.id, id));
}

// ============================================================================
// V1.1: Order Item Repots (换盆功能)
// ============================================================================

export async function getOrderItemRepots(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(orderItemRepots)
    .where(eq(orderItemRepots.orderId, orderId))
    .orderBy(asc(orderItemRepots.createdAt));
}

export async function createOrderItemRepot(data: {
  orderItemId: number;
  orderId: number;
  productId: number;
  productName: string;
  potProductId: number;
  potProductName: string;
  quantity: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Validate: total repot quantity for this order item must not exceed the item's purchased quantity
  const existingRepots = await db.select().from(orderItemRepots)
    .where(eq(orderItemRepots.orderItemId, data.orderItemId));
  const totalRepotQty = existingRepots.reduce((sum, r) => sum + r.quantity, 0);

  // Get the order item to check purchased quantity
  const itemResult = await db.select().from(orderItems)
    .where(eq(orderItems.id, data.orderItemId)).limit(1);
  if (itemResult.length === 0) throw new Error("Order item not found");
  const purchasedQty = itemResult[0].quantity;

  if (totalRepotQty + data.quantity > purchasedQty) {
    throw new Error(`换盆数量超过购买数量。剩余可安排: ${purchasedQty - totalRepotQty}`);
  }

  // Insert repot record
  await db.insert(orderItemRepots).values({
    orderItemId: data.orderItemId,
    orderId: data.orderId,
    productId: data.productId,
    productName: data.productName,
    potProductId: data.potProductId,
    potProductName: data.potProductName,
    quantity: data.quantity,
  });

  // Deduct pot product stock
  await db.update(products)
    .set({ stockQuantity: sql`stockQuantity - ${data.quantity}` })
    .where(eq(products.id, data.potProductId));

  // V2.1.08: System actions go to Activity Log, not remarks
  await logOrderOperation(data.orderId, "repotting_added", `换盆：${data.productName} → ${data.potProductName} x ${data.quantity}`, null, "system");
}

export async function deleteOrderItemRepot(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the repot record to restore stock
  const repot = await db.select().from(orderItemRepots).where(eq(orderItemRepots.id, id)).limit(1);
  if (repot.length > 0) {
    // Restore pot product stock
    await db.update(products)
      .set({ stockQuantity: sql`stockQuantity + ${repot[0].quantity}` })
      .where(eq(products.id, repot[0].potProductId));
  }

  // V2.1.08: System actions go to Activity Log, not remarks
  if (repot.length > 0) {
    await logOrderOperation(repot[0].orderId, "repotting_cancelled", `取消换盆：${repot[0].productName} → ${repot[0].potProductName} x ${repot[0].quantity}`, null, "system");
  }

  await db.delete(orderItemRepots).where(eq(orderItemRepots.id, id));
}

// ============================================================================
// V1.1: Scheduled Shipping (预约发货)
// ============================================================================

export async function setScheduledShippingDate(orderId: number, date: Date | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders)
    .set({ scheduledShippingDate: date })
    .where(eq(orders.id, orderId));
}

export async function getTodayScheduledShipping() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return await db.select().from(orders)
    .where(and(eq(orders.physicalStatus, 'packing'), eq(orders.scheduledShippingDate, today)))
    .orderBy(desc(orders.createdAt));
}

// V1.1: Auto-complete orders 7 days after shipping
export async function autoCompleteShippedOrders() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // Find shipped orders older than 7 days that haven't been completed yet
  const candidates = await db.select().from(orders)
    .where(and(
      eq(orders.physicalStatus, 'shipped'),
      sql`${orders.shippedAt} IS NOT NULL`,
      sql`${orders.shippedAt} <= ${sevenDaysAgo}`,
      sql`${orders.autoCompleteAt} IS NULL`,
    ));
  let completed = 0;
  for (const order of candidates) {
    await db.update(orders)
      .set({ physicalStatus: 'completed', completedAt: new Date(), autoCompleteAt: new Date() })
      .where(eq(orders.id, order.id));
    completed++;
  }
  return { completed, checked: candidates.length };
}

// V1.1: Flow reminder - find reviews where flow was sent but Telegram link not clicked after 24h
export async function getPendingFlowReminders() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return await db.select().from(membershipFeeReviews)
    .where(and(
      eq(membershipFeeReviews.reviewStatus, 'approved'),
      eq(membershipFeeReviews.flowStatus, 'sent'),
      eq(membershipFeeReviews.telegramLinkClicked, false),
      eq(membershipFeeReviews.needsManualFollowUp, false),
      sql`${membershipFeeReviews.flowSentAt} IS NOT NULL`,
      sql`${membershipFeeReviews.flowSentAt} <= ${twentyFourHoursAgo}`,
    ));
}

// V1.1: Mark a review as needing manual follow-up (after reminder sent)
export async function markFlowReminderSent(reviewId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(membershipFeeReviews)
    .set({
      followUpCount: sql`followUpCount + 1`,
      needsManualFollowUp: true,
    })
    .where(eq(membershipFeeReviews.id, reviewId));
}

export async function getScheduledShippingOrders(filter?: { dateFrom?: Date; dateTo?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // V2.1.12: Unified query — includes both orders with scheduledShippingDate AND orders with desired_delivery_date remarks
  // Also includes both local (XT) and import (XTC) orders
  const validStatuses = ['pending', 'packing', 'hold_order', 'receipt_uploaded', 'partial_payment', 'waiting_stock', 'ready_to_ship', 'scheduled_ship'];
  const dateConditions: any[] = [];
  if (filter?.dateFrom) {
    const from = new Date(filter.dateFrom); from.setHours(0, 0, 0, 0);
    dateConditions.push(sql`${orders.scheduledShippingDate} >= ${from}`);
  }
  if (filter?.dateTo) {
    const to = new Date(filter.dateTo); to.setHours(23, 59, 59, 999);
    dateConditions.push(sql`${orders.scheduledShippingDate} <= ${to}`);
  }
  // Query 1: Orders with scheduledShippingDate set (physicalStatus in valid statuses)
  const orderConditions = [
    sql`${orders.scheduledShippingDate} IS NOT NULL`,
    sql`${orders.physicalStatus} IN (${sql.join(validStatuses.map(s => sql`${s}`), sql`,`)})`,
    ...dateConditions,
  ];
  const ordersWithDate = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    customerId: orders.customerId,
    customerName: customers.name,
    customerPhone: customers.phoneNumber,
    shippingAddress: orders.shippingAddress,
    shippingMethod: orders.shippingMethod,
    totalAmount: orders.totalAmount,
    paidAmount: orders.paidAmount,
    totalWeight: orders.totalWeight,
    createdAt: orders.createdAt,
    paymentConfirmedAt: orders.paymentConfirmedAt,
    scheduledShippingDate: orders.scheduledShippingDate,
    physicalStatus: orders.physicalStatus,
    orderCategory: (orders as any).orderCategory,
    importStatus: (orders as any).importStatus,
  }).from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...orderConditions))
    .orderBy(asc(orders.scheduledShippingDate)) as any[];
  // Query 2: Orders with desired_delivery_date remarks (no scheduledShippingDate set yet)
  const remarkDateConditions: any[] = [
    sql`${orderRemarks.remarkCategory} = 'desired_delivery_date'`,
    sql`${orderRemarks.desiredDeliveryDate} IS NOT NULL`,
    sql`${orders.scheduledShippingDate} IS NULL`, // avoid duplicates with ordersWithDate
    sql`${orders.physicalStatus} IN (${sql.join(validStatuses.map(s => sql`${s}`), sql`,`)})`,
  ];
  if (filter?.dateFrom) {
    const from = new Date(filter.dateFrom); from.setHours(0, 0, 0, 0);
    remarkDateConditions.push(sql`DATE(${orderRemarks.desiredDeliveryDate}) >= ${from}`);
  }
  if (filter?.dateTo) {
    const to = new Date(filter.dateTo); to.setHours(23, 59, 59, 999);
    remarkDateConditions.push(sql`DATE(${orderRemarks.desiredDeliveryDate}) <= ${to}`);
  }
  const ordersWithRemarks = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    customerId: orders.customerId,
    customerName: customers.name,
    customerPhone: customers.phoneNumber,
    shippingAddress: orders.shippingAddress,
    shippingMethod: orders.shippingMethod,
    totalAmount: orders.totalAmount,
    paidAmount: orders.paidAmount,
    totalWeight: orders.totalWeight,
    createdAt: orders.createdAt,
    paymentConfirmedAt: orders.paymentConfirmedAt,
    scheduledShippingDate: orderRemarks.desiredDeliveryDate, // use remark date as scheduled date
    physicalStatus: orders.physicalStatus,
    orderCategory: (orders as any).orderCategory,
    importStatus: (orders as any).importStatus,
  }).from(orderRemarks)
    .leftJoin(orders, eq(orderRemarks.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...remarkDateConditions))
    .orderBy(asc(orderRemarks.desiredDeliveryDate)) as any[];
  // Merge and deduplicate
  const seen = new Set<number>();
  const merged = [...ordersWithDate, ...ordersWithRemarks].filter(o => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
  // Sort by scheduledShippingDate ascending
  merged.sort((a, b) => {
    const aDate = a.scheduledShippingDate ? new Date(a.scheduledShippingDate).getTime() : Infinity;
    const bDate = b.scheduledShippingDate ? new Date(b.scheduledShippingDate).getTime() : Infinity;
    return aDate - bDate;
  });
  // Enrich with item counts
  const enriched = await Promise.all(merged.map(async (o) => {
    const items = await db.select({
      id: orderItems.id,
      quantity: orderItems.quantity,
      productName: orderItems.productName,
    }).from(orderItems).where(eq(orderItems.orderId, o.id));
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
    const itemTypes = items.length;
    let specialLabel = "";
    if (o.shippingMethod === "lalamove") specialLabel = "LALAMOVE";
    else if (o.shippingMethod === "east_malaysia_shopee") specialLabel = "东马 SHOPEE";
    else if (o.shippingMethod === "east_malaysia_poslaju") specialLabel = "东马 POSLAJU";
    return { ...o, totalQuantity: totalQty, itemTypes, specialLabel };
  }));
  return enriched;
}

// ============================================================================
// V1.1: Pot Products (花盆商品)
// ============================================================================

export async function getPotProducts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(products)
    .where(and(eq(products.isPot, true), eq(products.status, 'active')))
    .orderBy(asc(products.name));
}

// ============================================================================
// User Language Preference (用户语言偏好)
// ============================================================================
export async function updateUserLanguage(openId: string, language: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users)
    .set({ preferredLanguage: language as 'zh' | 'en' })
    .where(eq(users.openId, openId));
}

// ============================================================================
// V1.2: Order Exception Helpers (订单异常处理)
// ============================================================================

export async function getOrderExceptions(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ exception: orderExceptions, refund: orderRefunds })
    .from(orderExceptions)
    .leftJoin(orderRefunds, eq(orderExceptions.refundId, orderRefunds.id))
    .where(eq(orderExceptions.orderId, orderId));
  return await Promise.all(rows.map(async ({ exception, refund }) => ({
    ...exception,
    items: await db.select().from(orderExceptionItems).where(eq(orderExceptionItems.exceptionId, exception.id)),
    linkedRefund: refund ? {
      id: refund.id,
      refundNumber: refund.refundNumber,
      status: refund.status,
      requestedAmount: refund.requestedAmount,
      customerRefundDetails: refund.customerRefundDetails,
      attachmentUrls: refund.attachmentUrls,
    } : null,
  })));
}

export async function createOrderException(data: {
  orderId: number;
  orderItemId?: number | null;
  exceptionType: 'out_of_stock' | 'quality_issue' | 'overcharged_shipping' | 'delivery_delay' | 'cancelled_item' | 'other';
  description?: string;
  createdBy?: string;
  // V2.1.26补充4: New fields for enhanced exception handling
  quantity?: number;
  customerAction?: 'replace_product' | 'wait_restock' | 'refund' | 'pending';
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(orderExceptions).values({
    orderId: data.orderId,
    orderItemId: data.orderItemId ?? null,
    exceptionType: data.exceptionType,
    description: data.description ?? null,
    createdBy: data.createdBy ?? null,
    // V2.1.26补充4: New fields
    quantity: data.quantity ?? 0,
    customerAction: data.customerAction ?? 'pending',
    itemLevel: Boolean(data.orderItemId),
    waitingForRestock: false,
  });
  const newId = (inserted as any).insertId;
  let created: typeof orderExceptions.$inferSelect | undefined;
  if (!newId || isNaN(Number(newId))) {
    // Fallback: query the latest record for this order
    const rows = await db.select().from(orderExceptions)
      .where(eq(orderExceptions.orderId, data.orderId))
      .orderBy(desc(orderExceptions.id))
      .limit(1);
    created = rows[0];
  } else {
    const rows = await db.select().from(orderExceptions).where(eq(orderExceptions.id, Number(newId))).limit(1);
    created = rows[0];
  }
  if (created && data.orderItemId && Number(data.quantity || 0) > 0) {
    const item = await db.select().from(orderItems).where(eq(orderItems.id, data.orderItemId)).limit(1);
    if (item[0]) {
      await db.insert(orderExceptionItems).values({
        exceptionId: created.id,
        orderItemId: item[0].id,
        productId: item[0].productId,
        productName: item[0].productName,
        quantity: Number(data.quantity),
        unitCost: String(item[0].unitCost || 0),
        totalScrapCost: '0',
        isScrapped: false,
      });
    }
  }
  // 开放包货异常（包括等待补货、替换与待退款）须由管理员明确处理，
  // 因此一律启用订单级取消保护，避免付款期限任务误取消原有库存占用。
  await db.update(orders).set({ cancelProtection: true }).where(eq(orders.id, data.orderId));
  return created;
}

/**
 * Updates a pending exception's descriptive fields only. Inventory, order-line and
 * credit mutations remain exclusively in resolveOrderException, so editing a record
 * cannot accidentally create a duplicate exception or settle it for a second time.
 */
export async function updateOrderException(
  exceptionId: number,
  data: {
    orderItemId?: number | null;
    exceptionType?: 'out_of_stock' | 'quality_issue' | 'overcharged_shipping' | 'delivery_delay' | 'cancelled_item' | 'other';
    description?: string;
    quantity?: number;
    customerAction?: 'replace_product' | 'wait_restock' | 'refund' | 'pending';
  },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, unknown> = {};
  if (data.orderItemId !== undefined) updateData.orderItemId = data.orderItemId;
  if (data.exceptionType !== undefined) updateData.exceptionType = data.exceptionType;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.customerAction !== undefined) updateData.customerAction = data.customerAction;
  if (Object.keys(updateData).length === 0) throw new Error("No exception fields to update");

  await db.update(orderExceptions).set(updateData as any).where(eq(orderExceptions.id, exceptionId));
  const rows = await db.select().from(orderExceptions).where(eq(orderExceptions.id, exceptionId)).limit(1);
  if (!rows[0]) throw new Error("Exception record not found");
  broadcastChanges(["orders", "dashboard"]);
  return rows[0];
}

export async function resolveOrderException(
  exceptionId: number,
  resolutionType: 'replace' | 'wait_restock' | 'refund',
  resolvedBy: string,
  options?: {
    scrapCost?: number;
    refundAmount?: number;
    // V2.1.26补充4: Replacement product info
    replacementProductId?: number;
    replacementProductName?: string;
    replacementQuantity?: number;
    replacementUnitPrice?: number;
    // V2.1.26补充4: Refund method (credit/tng/cash)
    refundMethod?: 'credit' | 'tng' | 'cash';
    // V2.1.26补充4: Customer action
    customerAction?: 'replace_product' | 'wait_restock' | 'refund' | 'pending';
    quantity?: number;
    // V2.1.26补充6: orderId for quantity sync and credit refund
    orderId?: number;
    customerRefundDetails?: string;
    customerRefundQrUrl?: string;
    attachmentUrls?: string;
    internalNotes?: string;
  },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 订单原有库存占用持续有效；等待补货不是库存扣减或退款结算。
  // 实际补货入库后由 allocateRestockedOrderException 执行可追溯的分配关闭。
  if (resolutionType === 'wait_restock') {
    const current = await db.select().from(orderExceptions).where(eq(orderExceptions.id, exceptionId)).limit(1);
    const exception = current[0];
    const quantity = Number(options?.quantity ?? exception?.quantity ?? 0);
    if (!exception) throw new Error('异常记录不存在');
    if (!exception.orderItemId || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('等待补货必须选择商品并填写正整数数量');
    }
    await db.update(orderExceptions).set({
      itemLevel: true,
      quantity,
      resolutionType: 'wait_restock',
      customerAction: 'wait_restock',
      waitingForRestock: true,
      status: 'open',
      resolvedAt: null,
      resolvedBy: null,
      closedAt: null,
      closedBy: null,
    }).where(eq(orderExceptions.id, exceptionId));
    await createOrderSpecialStatus({
      orderId: exception.orderId,
      type: 'stock_exception',
      reason: `等待补货 - 异常#${exceptionId}`,
      source: 'manual',
      createdBy: resolvedBy,
    });
    await logOrderOperation(exception.orderId, 'packing_exception', `包货异常 #${exceptionId} 标记等待补货（数量 ${quantity}）`, null, resolvedBy);
    broadcastChanges(['orders', 'dashboard']);
    return (await db.select().from(orderExceptions).where(eq(orderExceptions.id, exceptionId)).limit(1))[0];
  }
  if (resolutionType === 'refund') {
    const refund = await createPackingExceptionRefund({
      exceptionId,
      requestedBy: resolvedBy,
      refundAmount: options?.refundAmount,
      refundMethod: options?.refundMethod,
      customerRefundDetails: options?.customerRefundDetails,
      customerRefundQrUrl: options?.customerRefundQrUrl,
      attachmentUrls: options?.attachmentUrls,
      internalNotes: options?.internalNotes,
    });
    const rows = await db.select().from(orderExceptions).where(eq(orderExceptions.id, exceptionId)).limit(1);
    return { ...rows[0], linkedRefund: { id: refund.id, refundNumber: refund.refundNumber, status: 'pending' } };
  }
  const updateData: any = {
    resolutionType,
    status: 'resolved',
    resolvedBy,
    resolvedAt: new Date(),
    scrapCost: (options?.scrapCost ?? 0).toString(),
    refundAmount: (options?.refundAmount ?? 0).toString(),
  };
  // V2.1.26补充4: Set new fields if provided
  if (options?.replacementProductId) {
    updateData.replacementProductId = options.replacementProductId;
    updateData.replacementProductName = options.replacementProductName ?? null;
    updateData.replacementQuantity = options.replacementQuantity ?? 0;
    updateData.replacementUnitPrice = (options.replacementUnitPrice ?? 0).toString();
  }
  if (options?.refundMethod) {
    updateData.refundMethod = options.refundMethod;
  }
  if (options?.customerAction) {
    updateData.customerAction = options.customerAction;
  }
  if (options?.quantity !== undefined) {
    updateData.quantity = options.quantity;
  }
  await db.update(orderExceptions).set(updateData).where(eq(orderExceptions.id, exceptionId));

  // V2.1.26补充6: Issue 3+7 - Sync quantity and auto refund credit
  const exception = await db.select().from(orderExceptions).where(eq(orderExceptions.id, exceptionId)).limit(1);
  if (exception.length > 0 && exception[0].orderId) {
    const orderId = exception[0].orderId;
    const excQuantity = options?.quantity || exception[0].quantity || 0;
    const customerAction = options?.customerAction || exception[0].customerAction || 'pending';

    // Shipping overcharge has no product line. Settle its stated refund amount directly
    // instead of entering the product-quantity refund branch below.
    if (exception[0].exceptionType === 'overcharged_shipping' && customerAction === 'refund') {
      const refundAmount = Number(options?.refundAmount ?? exception[0].refundAmount ?? 0);
      if (refundAmount <= 0) throw new Error('运费退款金额必须大于 0');
      if (options?.refundMethod === 'credit') {
        const order = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        if (!order[0]?.customerId) throw new Error('订单未关联客户，无法退款至 Credit');
        await refundCustomerCredit(order[0].customerId, refundAmount, orderId, order[0].orderNumber || undefined);
      }
    }

    // Issue 3: For refund - reduce order item quantity by exception quantity
    if (customerAction === 'refund' && excQuantity > 0 && exception[0].orderItemId) {
      const orderItem = await db.select().from(orderItems).where(eq(orderItems.id, exception[0].orderItemId)).limit(1);
      if (orderItem.length > 0) {
        const newQty = orderItem[0].quantity - excQuantity;
        if (newQty <= 0) {
          // Delete the order item if quantity reaches 0
          await db.delete(orderItems).where(eq(orderItems.id, exception[0].orderItemId!));
        } else {
          // Update quantity and subtotal
          const unitPrice = Number(orderItem[0].unitPrice || 0);
          await db.update(orderItems).set({
            quantity: newQty,
            subtotal: (unitPrice * newQty).toString(),
          }).where(eq(orderItems.id, exception[0].orderItemId!));
        }
        // Recalculate order totals
        await recalculateOrderTotals(orderId);

        // V2.1.30补充2: Create inventory adjustment for refund (record stock reduction for original product)
        const adjustmentType = exception[0].exceptionType === 'quality_issue' ? 'quality_issue' : 'other';
        const productCost = await db.select({ cost: products.cost }).from(products)
          .where(eq(products.id, orderItem[0].productId)).limit(1);
        const unitCost = productCost[0] ? Number(productCost[0].cost || 0) : 0;
        await createInventoryAdjustment({
          productId: orderItem[0].productId,
          adjustmentType: adjustmentType as any,
          quantityChange: -excQuantity,
          unitCost,
          totalCost: unitCost * excQuantity,
          orderExceptionId: exceptionId,
          adjustedBy: resolvedBy,
          reason: `异常处理退款 - ${exception[0].exceptionType}`,
        });

        // Issue 7: Auto refund to credit if refundMethod is credit
        if (options?.refundMethod === 'credit') {
          const order = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
          if (order.length > 0 && order[0].customerId) {
            const unitPrice = Number(orderItem[0].unitPrice || 0);
            const refundAmount = unitPrice * excQuantity;
            if (refundAmount > 0) {
              await refundCustomerCredit(order[0].customerId, refundAmount, orderId, order[0].orderNumber || undefined);
            }
          }
        }
      }
    }

    // Issue 3: For replace_product - reduce original item qty, add replacement item, deduct stock
    if (customerAction === 'replace_product' && excQuantity > 0 && exception[0].orderItemId) {
      const orderItem = await db.select().from(orderItems).where(eq(orderItems.id, exception[0].orderItemId)).limit(1);
      if (orderItem.length > 0) {
        const newQty = orderItem[0].quantity - excQuantity;
        if (newQty <= 0) {
          await db.delete(orderItems).where(eq(orderItems.id, exception[0].orderItemId!));
        } else {
          const unitPrice = Number(orderItem[0].unitPrice || 0);
          await db.update(orderItems).set({
            quantity: newQty,
            subtotal: (unitPrice * newQty).toString(),
          }).where(eq(orderItems.id, exception[0].orderItemId!));
        }

        // V2.1.30补充2: Create inventory adjustment for original product (record stock reduction)
        const adjustmentType = exception[0].exceptionType === 'quality_issue' ? 'quality_issue' : 'other';
        const productCost = await db.select({ cost: products.cost }).from(products)
          .where(eq(products.id, orderItem[0].productId)).limit(1);
        const unitCost = productCost[0] ? Number(productCost[0].cost || 0) : 0;
        await createInventoryAdjustment({
          productId: orderItem[0].productId,
          adjustmentType: adjustmentType as any,
          quantityChange: -excQuantity,
          unitCost,
          totalCost: unitCost * excQuantity,
          orderExceptionId: exceptionId,
          adjustedBy: resolvedBy,
          reason: `异常处理更换商品 - 原商品${orderItem[0].productName}`,
        });

        // Add replacement product as new order item
        if (options?.replacementProductId) {
          const replacementQty = options.replacementQuantity || excQuantity;
          const replacementPrice = options.replacementUnitPrice || 0;
          const replacementSubtotal = replacementPrice * replacementQty;

          // Check if replacement product already exists in order items
          const existingItem = await db.select().from(orderItems).where(
            and(eq(orderItems.orderId, orderId), eq(orderItems.productId, options.replacementProductId))
          ).limit(1);
          if (existingItem.length > 0) {
            // Increase quantity of existing item
            const updatedQty = existingItem[0].quantity + replacementQty;
            const updatedSubtotal = Number(existingItem[0].unitPrice || 0) * updatedQty;
            await db.update(orderItems).set({
              quantity: updatedQty,
              subtotal: updatedSubtotal.toString(),
            }).where(eq(orderItems.id, existingItem[0].id));
          } else {
            // Add new order item
            await db.insert(orderItems).values({
              orderId,
              productId: options.replacementProductId,
              productName: options.replacementProductName || "替换商品",
              quantity: replacementQty,
              unitPrice: replacementPrice.toString(),
              subtotal: replacementSubtotal.toString(),
              productType: "physical" as any,
            });
          }

          // Deduct replacement product stock
          await createInventoryAdjustment({
            productId: options.replacementProductId,
            adjustmentType: 'other',
            quantityChange: -replacementQty,
            adjustedBy: resolvedBy,
            reason: '异常处理更换商品',
          });
        }

        // Recalculate order totals
        await recalculateOrderTotals(orderId);

        // Handle price difference refund if replacement is cheaper
        if (options?.replacementProductId && options?.refundMethod === 'credit') {
          const originalUnitPrice = Number(orderItem[0].unitPrice || 0);
          const replacementUnitPrice = options.replacementUnitPrice || 0;
          const priceDiff = (originalUnitPrice - replacementUnitPrice) * excQuantity;
          if (priceDiff > 0) {
            const order = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
            if (order.length > 0 && order[0].customerId) {
              await refundCustomerCredit(order[0].customerId, priceDiff, orderId, order[0].orderNumber || undefined);
            }
          }
        }
      }
    }

    // Issue 8: For wait_restock - create special status for dashboard sync
    if (customerAction === 'wait_restock') {
      // V2.1.30补充2: Create inventory adjustment for wait_restock (record stock reduction)
      if (excQuantity > 0 && exception[0].orderItemId) {
        const orderItem = await db.select().from(orderItems).where(eq(orderItems.id, exception[0].orderItemId)).limit(1);
        if (orderItem.length > 0) {
          const productCost = await db.select({ cost: products.cost }).from(products)
            .where(eq(products.id, orderItem[0].productId)).limit(1);
          const unitCost = productCost[0] ? Number(productCost[0].cost || 0) : 0;
          await createInventoryAdjustment({
            productId: orderItem[0].productId,
            adjustmentType: 'other',
            quantityChange: -excQuantity,
            unitCost,
            totalCost: unitCost * excQuantity,
            orderExceptionId: exceptionId,
            adjustedBy: resolvedBy,
            reason: `异常处理等待补货 - ${orderItem[0].productName}`,
          });
        }
      }
      await createOrderSpecialStatus({
        orderId,
        type: 'stock_exception',
        reason: `等待补货 - 异常#${exceptionId}`,
        source: 'manual',
        createdBy: resolvedBy,
      });
    }
  }

  broadcastChanges(["orders", "dashboard"]);
  const rows = await db.select().from(orderExceptions).where(eq(orderExceptions.id, exceptionId)).limit(1);
  return rows[0];
}

/** 补货实际入库后，将指定等待补货数量明确分配给原订单并关闭对应异常。 */
export async function allocateRestockedOrderException(exceptionId: number, allocatedBy: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db.select().from(orderExceptions).where(eq(orderExceptions.id, exceptionId)).limit(1);
  const exception = rows[0];
  if (!exception) throw new Error('异常记录不存在');
  if (!exception.waitingForRestock || exception.status !== 'open') {
    throw new Error('此异常并非等待补货状态，不能重复分配');
  }
  if (!exception.orderItemId || Number(exception.quantity || 0) <= 0) {
    throw new Error('等待补货异常缺少商品或数量');
  }

  await db.update(orderExceptions).set({
    waitingForRestock: false,
    status: 'resolved',
    resolutionType: 'wait_restock',
    customerAction: 'wait_restock',
    resolvedBy: allocatedBy,
    resolvedAt: new Date(),
    closedBy: allocatedBy,
    closedAt: new Date(),
  }).where(eq(orderExceptions.id, exceptionId));
  const statuses = await db.select().from(orderSpecialStatuses).where(and(
    eq(orderSpecialStatuses.orderId, exception.orderId),
    eq(orderSpecialStatuses.type, 'stock_exception'),
    eq(orderSpecialStatuses.status, 'pending'),
  ));
  for (const status of statuses.filter(status => String(status.reason || '').includes(`异常#${exceptionId}`))) {
    await resolveOrderSpecialStatus({
      specialStatusId: status.id,
      resolutionMethod: 'data_corrected',
      resolutionRemark: `补货已分配给等待补货异常 #${exceptionId}`,
      resolvedBy: allocatedBy,
    });
  }
  await logOrderOperation(exception.orderId, 'packing_exception', `包货异常 #${exceptionId} 已完成补货分配（数量 ${exception.quantity}）`, null, allocatedBy);
  broadcastChanges(['orders', 'dashboard']);
  return (await db.select().from(orderExceptions).where(eq(orderExceptions.id, exceptionId)).limit(1))[0];
}

/**
 * 将一笔实际补货的数量依时间顺序分配给同商品的等待补货异常。
 * 仅当一条异常的完整缺货数量能够满足时才关闭该异常；不足部分保留开放状态，
 * 由下一笔补货继续分配，避免把未到齐的商品错误标记为可发货。
 */
export async function autoAllocateWaitingRestockForProduct(
  productId: number,
  incomingQuantity: number,
  allocatedBy: string,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  let remainingQuantity = Math.max(0, Math.floor(Number(incomingQuantity) || 0));
  const allocatedExceptionIds: number[] = [];
  if (remainingQuantity < 1) {
    return { allocatedExceptionIds, allocatedQuantity: 0, remainingQuantity };
  }

  const [rows] = await db.execute(sql`
    SELECT oe.id AS id, oe.quantity AS quantity
    FROM order_exceptions oe
    INNER JOIN order_exception_items oei ON oei.exceptionId = oe.id
    WHERE oe.waitingForRestock = 1
      AND oe.status = 'open'
      AND oei.productId = ${productId}
      AND oe.quantity > 0
    GROUP BY oe.id, oe.quantity, oe.createdAt
    ORDER BY oe.createdAt ASC, oe.id ASC
  `);
  const candidates = rows as unknown as Array<{ id: number; quantity: number | string }>;
  for (const candidate of candidates) {
    const requiredQuantity = Math.max(0, Math.floor(Number(candidate.quantity) || 0));
    if (!requiredQuantity || requiredQuantity > remainingQuantity) continue;
    await allocateRestockedOrderException(Number(candidate.id), allocatedBy);
    allocatedExceptionIds.push(Number(candidate.id));
    remainingQuantity -= requiredQuantity;
  }

  return {
    allocatedExceptionIds,
    allocatedQuantity: Math.max(0, Math.floor(Number(incomingQuantity) || 0) - remainingQuantity),
    remainingQuantity,
  };
}

// V3.3: Packing exceptions are part of the fulfilment audit trail. They are
// cancelled instead of physically deleted so later refunds, stock entries and
// operator actions remain traceable.
export async function cancelOrderException(exceptionId: number, cancelledBy: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [exception] = await db.select({ id: orderExceptions.id, status: orderExceptions.status })
    .from(orderExceptions)
    .where(eq(orderExceptions.id, exceptionId))
    .limit(1);
  if (!exception) throw new Error("异常记录不存在");
  if (exception.status === "resolved") throw new Error("已完成的异常不可取消，请通过退款或库存更正流程处理");
  if (exception.status === "cancelled") return;

  await db.update(orderExceptions)
    .set({
      status: "cancelled",
      waitingForRestock: false,
      closedAt: new Date(),
      closedBy: cancelledBy,
    })
    .where(eq(orderExceptions.id, exceptionId));
  broadcastChanges(["orders", "dashboard"]);
}

// Backward-compatible name for older callers. It intentionally no longer
// removes a record from the database.
export async function deleteOrderException(exceptionId: number): Promise<void> {
  await cancelOrderException(exceptionId, "Legacy cancellation");
}

// V2.1.26补充6: Add an order item (used by exception replacement logic)
export async function addOrderItem(data: {
  orderId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  productType?: string;
  productSku?: string;
  variationId?: number;
  variationName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(orderItems).values({
    orderId: data.orderId,
    productId: data.productId,
    productName: data.productName,
    quantity: data.quantity,
    unitPrice: data.unitPrice.toString(),
    subtotal: data.subtotal.toString(),
    productType: (data.productType || "physical") as any,
    productSku: data.productSku || null,
    variationId: data.variationId || null,
    variationName: data.variationName || null,
  });
  broadcastChanges(["orders"]);
}

export async function createOrderExceptionItem(data: {
  exceptionId: number;
  orderItemId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitCost?: number;
  totalScrapCost?: number;
  isScrapped?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orderExceptionItems).values({
    exceptionId: data.exceptionId,
    orderItemId: data.orderItemId,
    productId: data.productId,
    productName: data.productName,
    quantity: data.quantity,
    unitCost: (data.unitCost ?? 0).toString(),
    totalScrapCost: (data.totalScrapCost ?? 0).toString(),
    isScrapped: data.isScrapped ?? false,
  });
  const id = (result as any).insertId;
  const rows = await db.select().from(orderExceptionItems).where(eq(orderExceptionItems.id, Number(id))).limit(1);
  return rows[0];
}

export async function createOrderExceptionReplacement(data: {
  exceptionId: number;
  originalOrderItemId: number;
  originalProductId: number;
  originalProductName: string;
  originalQuantity: number;
  newProductId: number;
  newProductName: string;
  newQuantity: number;
  newUnitPrice: number;
  newSubtotal: number;
  newOrderItemId?: number;
  createdBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orderExceptionReplacements).values({
    exceptionId: data.exceptionId,
    originalOrderItemId: data.originalOrderItemId,
    originalProductId: data.originalProductId,
    originalProductName: data.originalProductName,
    originalQuantity: data.originalQuantity,
    newProductId: data.newProductId,
    newProductName: data.newProductName,
    newQuantity: data.newQuantity,
    newUnitPrice: data.newUnitPrice.toString(),
    newSubtotal: data.newSubtotal.toString(),
    newOrderItemId: data.newOrderItemId ?? null,
    createdBy: data.createdBy ?? null,
  });
  const id = (result as any).insertId;
  const rows = await db.select().from(orderExceptionReplacements).where(eq(orderExceptionReplacements.id, Number(id))).limit(1);
  return rows[0];
}

export async function getOrderExceptionReplacements(exceptionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(orderExceptionReplacements).where(eq(orderExceptionReplacements.exceptionId, exceptionId));
}

// ============================================================================
// V1.2: Inventory Adjustment Helpers (库存手动扣减)
// ============================================================================

export async function getInventoryAdjustments(filters?: { productId?: number; adjustmentType?: string; dateFrom?: Date; dateTo?: Date }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.productId) conditions.push(eq(inventoryAdjustments.productId, filters.productId));
  if (filters?.adjustmentType) conditions.push(eq(inventoryAdjustments.adjustmentType, filters.adjustmentType as any));
  let adjustments: any[];
  if (conditions.length > 0) {
    adjustments = await db.select().from(inventoryAdjustments).where(and(...conditions));
  } else {
    adjustments = await db.select().from(inventoryAdjustments);
  }
  if (adjustments.length === 0) return [];

  const productRows = await db.select({ id: products.id, name: products.name })
    .from(products)
    .where(inArray(products.id, Array.from(new Set(adjustments.map((item) => item.productId)))));
  const productNameById = new Map(productRows.map((product) => [product.id, product.name]));
  const correctionDeltaByOriginalId = new Map<number, number>();
  for (const adjustment of adjustments) {
    if (!adjustment.correctsAdjustmentId) continue;
    const originalId = Number(adjustment.correctsAdjustmentId);
    correctionDeltaByOriginalId.set(
      originalId,
      (correctionDeltaByOriginalId.get(originalId) ?? 0) + Number(adjustment.quantityChange),
    );
  }
  return adjustments.map((adjustment) => {
    const isCorrection = Boolean(adjustment.correctsAdjustmentId);
    const correctionDelta = isCorrection ? 0 : (correctionDeltaByOriginalId.get(adjustment.id) ?? 0);
    return {
      ...adjustment,
      isCorrection,
      correctionCount: isCorrection ? 0 : Array.from(correctionDeltaByOriginalId.keys()).includes(adjustment.id) ? 1 : 0,
      effectiveQuantityChange: Number(adjustment.quantityChange) + correctionDelta,
      productName: productNameById.get(adjustment.productId) || `商品 #${adjustment.productId}`,
    };
  });
}

export async function createInventoryAdjustment(data: {
  productId: number;
  supplierId?: number;
  supplierName?: string;
  adjustmentType: 'quality_issue' | 'plant_death' | 'pest_disease' | 'human_damage' | 'unhealthy' | 'lost' | 'other';
  quantityChange: number;
  unitCost?: number;
  totalCost?: number;
  orderExceptionId?: number;
  correctsAdjustmentId?: number;
  adjustedBy?: string;
  reason?: string;
  remark?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. 原子更新商品库存。扣减不允许穿透正式库存或 AI 草稿预留，
  //    以免人工操作再次造成负库存／超卖。
  const quantityChange = Math.trunc(Number(data.quantityChange));
  if (!Number.isFinite(quantityChange) || quantityChange === 0) {
    throw new Error("库存变动数量必须非 0");
  }
  const stockUpdate = await db.update(products).set({
    stockQuantity: sql`${products.stockQuantity} + ${quantityChange}`,
  }).where(and(
    eq(products.id, data.productId),
    quantityChange < 0
      ? sql`${products.stockQuantity} - COALESCE(${products.reservedQuantity}, 0) >= ${Math.abs(quantityChange)}`
      : sql`1 = 1`,
  ));
  const affectedRows = Number((stockUpdate as any)?.[0]?.affectedRows ?? (stockUpdate as any)?.affectedRows ?? 0);
  if (affectedRows < 1) {
    const [product] = await db.select({ name: products.name, stockQuantity: products.stockQuantity, reservedQuantity: products.reservedQuantity })
      .from(products).where(eq(products.id, data.productId)).limit(1);
    const available = Math.max(0, Number(product?.stockQuantity ?? 0) - Number(product?.reservedQuantity ?? 0));
    throw new Error(`STOCK_INSUFFICIENT: ${product?.name || `商品 #${data.productId}`} 库存不足，目前最多可扣减 ${available} 件`);
  }

  // 2. 写入成本与厂家快照；利润报告会使用该日志的 totalCost 汇总损耗。
  const result = await db.insert(inventoryAdjustments).values({
    productId: data.productId,
    supplierId: data.supplierId ?? null,
    supplierName: data.supplierName ?? null,
    adjustmentType: data.adjustmentType,
    quantityChange: data.quantityChange,
    unitCost: (data.unitCost ?? 0).toString(),
    totalCost: (data.totalCost ?? 0).toString(),
    orderExceptionId: data.orderExceptionId ?? null,
    correctsAdjustmentId: data.correctsAdjustmentId ?? null,
    adjustedBy: data.adjustedBy ?? null,
    reason: data.reason ?? null,
    remark: data.remark ?? null,
  });
  const id = (result as any).insertId;

  const rows = await db.select().from(inventoryAdjustments).where(eq(inventoryAdjustments.id, Number(id))).limit(1);
  const [product] = await db.select({ name: products.name }).from(products).where(eq(products.id, data.productId)).limit(1);
  return { ...rows[0], productName: product?.name || `商品 #${data.productId}` };
}

/**
 * Correct a historical manual stock adjustment without rewriting it. A signed
 * correction row brings the original record's effective quantity to the requested
 * final amount; its signed cost reverses or extends the historical loss impact.
 */
export async function correctInventoryAdjustment(data: {
  adjustmentId: number;
  desiredQuantityChange: number;
  reason: string;
  adjustedBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const desiredQuantityChange = Math.trunc(Number(data.desiredQuantityChange));
  if (!Number.isFinite(desiredQuantityChange)) {
    throw new Error("更正后的库存数量必须为整数");
  }
  const [original] = await db.select().from(inventoryAdjustments)
    .where(eq(inventoryAdjustments.id, data.adjustmentId)).limit(1);
  if (!original) throw new Error("找不到要更正的库存记录");
  if (original.correctsAdjustmentId) throw new Error("更正记录不可再次直接更正，请回到原始记录操作");
  if (original.orderExceptionId) throw new Error("订单异常产生的库存记录请在订单异常流程中处理");

  const priorCorrections = await db.select().from(inventoryAdjustments)
    .where(eq(inventoryAdjustments.correctsAdjustmentId, original.id));
  const currentEffectiveQuantity = Number(original.quantityChange) + priorCorrections.reduce(
    (total, correction) => total + Number(correction.quantityChange),
    0,
  );
  const correctionDelta = desiredQuantityChange - currentEffectiveQuantity;
  if (correctionDelta === 0) throw new Error("更正后的数量与当前有效数量相同");

  const unitCost = Number(original.unitCost ?? 0);
  return await createInventoryAdjustment({
    productId: original.productId,
    supplierId: original.supplierId ?? undefined,
    supplierName: original.supplierName ?? undefined,
    adjustmentType: "other",
    quantityChange: correctionDelta,
    // Positive delta restores stock and must reverse the corresponding loss cost.
    totalCost: -correctionDelta * unitCost,
    unitCost,
    correctsAdjustmentId: original.id,
    adjustedBy: data.adjustedBy,
    reason: data.reason.trim(),
    remark: `更正库存记录 #${original.id}：原有效数量 ${currentEffectiveQuantity}，更正为 ${desiredQuantityChange}`,
  });
}

// ============================================================================
// V1.2: Profit Analysis Report (利润分析报告)
// ============================================================================

export async function getProfitAnalysisReport(dateRange: { start: Date; end: Date }) {
  const db = await getDb();
  if (!db) return null;
  const startAt = toReportTimestamp(dateRange.start);
  const endAt = toReportTimestamp(dateRange.end);

  // Sales revenue
  const [revenueRows] = await db.execute(sql`
    SELECT
      COALESCE(SUM(o.physicalSubtotal), 0) as sales_revenue,
      COALESCE(SUM(o.shippingFee), 0) as shipping_income
    FROM orders o
    WHERE o.createdAt >= ${startAt} AND o.createdAt <= ${endAt}
      AND COALESCE(o.physicalStatus, '') <> 'cancelled'
      AND COALESCE(o.orderType, '') <> 'membership'
  `);

  // FIFO cost
  const [fifoRows] = await db.execute(sql`
    SELECT COALESCE(SUM(ABS(quantity_change) * unit_cost), 0) as product_cost
    FROM inventory_ledger
    WHERE transaction_type = 'sale'
      AND created_at >= ${startAt} AND created_at <= ${endAt}
  `);

  // Shipping cost (from shipments)
  const [shippingCostRows] = await db.execute(sql`
    SELECT COALESCE(SUM(shippingCost), 0) as shipping_cost
    FROM shipments
    WHERE createdAt >= ${startAt} AND createdAt <= ${endAt}
  `);

  // Scrap cost (from order_exceptions)
  const [scrapRows] = await db.execute(sql`
    SELECT COALESCE(SUM(scrapCost), 0) as scrap_cost
    FROM order_exceptions
    WHERE status = 'resolved'
      AND createdAt >= ${startAt} AND createdAt <= ${endAt}
  `);

  // Refund loss (from customer_refunds)
  const [refundRows] = await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0) as refund_loss
    FROM customer_refunds
    WHERE refundDate >= ${startAt} AND refundDate <= ${endAt}
  `);

  const rev = (revenueRows as unknown as any[])[0] ?? {};
  const fifo = (fifoRows as unknown as any[])[0] ?? {};
  const ship = (shippingCostRows as unknown as any[])[0] ?? {};
  const scrap = (scrapRows as unknown as any[])[0] ?? {};
  const refund = (refundRows as unknown as any[])[0] ?? {};

  const salesRevenue = Number(rev.sales_revenue) || 0;
  const shippingIncome = Number(rev.shipping_income) || 0;
  const productCost = Number(fifo.product_cost) || 0;
  const shippingCost = Number(ship.shipping_cost) || 0;
  const shippingDiff = shippingIncome - shippingCost;
  const scrapLoss = Number(scrap.scrap_cost) || 0;
  const refundLoss = Number(refund.refund_loss) || 0;
  const actualGrossProfit = salesRevenue - productCost + shippingDiff - scrapLoss - refundLoss;
  const grossMargin = salesRevenue > 0 ? (actualGrossProfit / salesRevenue) * 100 : 0;

  return {
    salesRevenue,
    productCost,
    shippingIncome,
    shippingCost,
    shippingDiff,
    scrapLoss,
    refundLoss,
    actualGrossProfit,
    grossMargin: Math.round(grossMargin * 100) / 100,
  };
}

// ============================================================================
// V1.2: Loss Analysis Report (损耗分析报告)
// ============================================================================

export async function getLossAnalysisReport(dateRange: { start: Date; end: Date }) {
  const db = await getDb();
  if (!db) return null;
  const startAt = toReportTimestamp(dateRange.start);
  const endAt = toReportTimestamp(dateRange.end);

  // Summary by adjustment type
  const [typeRows] = await db.execute(sql`
    SELECT
      adjustmentType,
      COALESCE(SUM(ABS(quantityChange)), 0) as total_units,
      COALESCE(SUM(totalCost), 0) as total_cost
    FROM inventory_adjustments
    WHERE createdAt >= ${startAt} AND createdAt <= ${endAt}
      AND quantityChange < 0
    GROUP BY adjustmentType
  `);

  // Product loss ranking
  const [productRows] = await db.execute(sql`
    SELECT
      ia.productId,
      p.name as product_name,
      COALESCE(SUM(ABS(ia.quantityChange)), 0) as loss_units,
      COALESCE(SUM(ia.totalCost), 0) as loss_cost
    FROM inventory_adjustments ia
    LEFT JOIN products p ON ia.productId = p.id
    WHERE ia.createdAt >= ${startAt} AND ia.createdAt <= ${endAt}
      AND ia.quantityChange < 0
    GROUP BY ia.productId, p.name
    ORDER BY loss_cost DESC
    LIMIT 20
  `);

  // Category loss ranking
  const [categoryRows] = await db.execute(sql`
    SELECT
      c.nameZh as category_name,
      COALESCE(SUM(ABS(ia.quantityChange)), 0) as loss_units,
      COALESCE(SUM(ia.totalCost), 0) as loss_cost
    FROM inventory_adjustments ia
    LEFT JOIN products p ON ia.productId = p.id
    LEFT JOIN categories c ON p.categoryId = c.id
    WHERE ia.createdAt >= ${startAt} AND ia.createdAt <= ${endAt}
      AND ia.quantityChange < 0
    GROUP BY c.id, c.nameZh
    ORDER BY loss_cost DESC
    LIMIT 20
  `);

  // Total stock for loss rate calculation
  const [stockRows] = await db.execute(sql`
    SELECT COALESCE(SUM(stockQuantity), 0) as total_stock
    FROM products
    WHERE type = 'physical' AND status = 'active'
  `);

  const types = (typeRows as unknown as any[]).map((r: any) => ({
    adjustmentType: r.adjustmentType,
    lossUnits: Number(r.total_units) || 0,
    lossCost: Number(r.total_cost) || 0,
  }));

  const totalLossUnits = types.reduce((sum, t) => sum + t.lossUnits, 0);
  const totalLossCost = types.reduce((sum, t) => sum + t.lossCost, 0);
  const totalStock = Number((stockRows as unknown as any[])[0]?.total_stock) || 0;
  const lossRate = totalStock > 0 ? (totalLossUnits / totalStock) * 100 : 0;

  return {
    summary: types,
    totalLossUnits,
    totalLossCost,
    lossRate: Math.round(lossRate * 100) / 100,
    productRanking: (productRows as unknown as any[]).map((r: any) => ({
      productId: r.productId,
      productName: r.product_name,
      lossUnits: Number(r.loss_units) || 0,
      lossCost: Number(r.loss_cost) || 0,
    })),
    categoryRanking: (categoryRows as unknown as any[]).map((r: any) => ({
      categoryName: r.category_name,
      lossUnits: Number(r.loss_units) || 0,
      lossCost: Number(r.loss_cost) || 0,
    })),
  };
}

// ============================================================================
// V1.2: Shipping Fee Calculation Engine (运费计算引擎)
// ============================================================================

/**
 * Calculate shipping fee for normal products based on XLCS rules:
 * - If subtotal >= RM150: first 10kg free, excess at RM3/kg
 * - If subtotal < RM150: first 10kg RM15, excess at RM15 + RM3/kg
 * V2.1: Special price items (isSpecial) are EXCLUDED from the RM150 free shipping threshold
 */
export function calculateNormalShippingFee(itemsSubtotal: number, totalWeightKg: number, nonSpecialSubtotal?: number): {
  chargeableWeight: number;
  shippingFee: number;
  isFreeShipping: boolean;
} {
  // V2.1: Use nonSpecialSubtotal for free shipping threshold if provided
  const thresholdSubtotal = nonSpecialSubtotal !== undefined ? nonSpecialSubtotal : itemsSubtotal;
  const isFreeShipping = thresholdSubtotal >= 150;
  const baseWeight = 10; // 10kg base
  const excessWeight = Math.max(0, totalWeightKg - baseWeight);
  const chargeableWeight = totalWeightKg; // actual weight is chargeable

  let shippingFee: number;
  if (isFreeShipping) {
    // Free shipping for first 10kg, RM3/kg for excess
    shippingFee = excessWeight * 3;
  } else {
    // RM15 for first 10kg, RM15 + RM3/kg for excess
    shippingFee = 15 + excessWeight * 3;
  }

  return { chargeableWeight, shippingFee, isFreeShipping };
}

/**
 * Calculate shipping fee for standalone shipping products
 */
export function calculateStandaloneShippingFee(
  method: "fixed_fee" | "free_shipping",
  fixedFee: number
): number {
  return method === "free_shipping" ? 0 : fixedFee;
}

// ============================================================================
// V1.2: Auto Split Order Logic (自动拆单)
// ============================================================================

/**
 * Split order items into sub-orders based on standalone shipping flag.
 * Returns array of sub-order groups.
 */
export function splitOrderItems(items: Array<{
  productId: number;
  quantity: number;
  unitPrice: number;
  allowStandaloneShipping: boolean;
  standaloneShippingMethod: "fixed_fee" | "free_shipping" | null;
  standaloneShippingFee: number | null;
  weight: number | null;
}>): {
  normalItems: typeof items;
  standaloneItems: typeof items;
  needsSplit: boolean;
} {
  const normalItems = items.filter(i => !i.allowStandaloneShipping);
  const standaloneItems = items.filter(i => i.allowStandaloneShipping);
  const needsSplit = standaloneItems.length > 0 && normalItems.length > 0;

  return { normalItems, standaloneItems, needsSplit };
}

// ============================================================================
// V1.2: Actual Weight Processing (实际重量处理)
// ============================================================================

/**
 * V2.0.80: Process actual weight for East Malaysia PosLaju.
 * Calls ParcelKing API to get real shipping cost, adds RM5 handling fee.
 * Compares with customer prepaid RM50 and determines if special order is needed.
 */
export async function processEastMalaysiaPosLajuWeight(
  actualWeightKg: number,
  customerPaidShipping: number,
  shippingAddress: string,
  shippingPostcode: string,
  shippingState: string,
): Promise<{
  actualShippingFee: number;
  apiShippingFee: number;
  handlingFee: number;
  difference: number;
  needsSpecialOrder: boolean;
  specialOrderType: "pending_shipping" | "pending_refund" | null;
}> {
  const HANDLING_FEE = 5;
  let apiShippingFee = 0;
  let actualShippingFee = 0;

  try {
    // Use ParcelDaily API for real shipping rate (V2.1.28: switched from ParcelKing to ParcelDaily)
    const { getQuote, isParcelDailyConfigured } = await import("./parceldaily");
    if (isParcelDailyConfigured()) {
      const quoteResult = await getQuote({
        fromPostcode: "11700", // Origin: Gelugor, Pulau Pinang
        toPostcode: shippingPostcode || "",
        kg: actualWeightKg,
      });
      // ParcelDaily returns poslajuPrice directly in the response
      if (quoteResult.success && quoteResult.success.poslajuPrice) {
        apiShippingFee = Number(quoteResult.success.poslajuPrice);
      } else {
        console.warn("[processEastMalaysiaPosLajuWeight] No Poslaju price found in ParcelDaily quote result");
      }
    }
  } catch (error) {
    console.error("[processEastMalaysiaPosLajuWeight] ParcelDaily API error:", error);
  }

  // Fallback: if API didn't return a price, use weight-based estimate
  if (apiShippingFee <= 0) {
    // Estimate: RM15 base (2kg) + RM8/kg excess
    apiShippingFee = 15 + (actualWeightKg <= 2 ? 0 : Math.ceil(actualWeightKg - 2) * 8);
  }

  actualShippingFee = apiShippingFee + HANDLING_FEE;
  const difference = actualShippingFee - customerPaidShipping;
  const needsSpecialOrder = Math.abs(difference) > 0.01;
  let specialOrderType: "pending_shipping" | "pending_refund" | null = null;
  if (needsSpecialOrder) {
    specialOrderType = difference > 0 ? "pending_shipping" : "pending_refund";
  }

  return {
    actualShippingFee,
    apiShippingFee,
    handlingFee: HANDLING_FEE,
    difference,
    needsSpecialOrder,
    specialOrderType,
  };
}

/**
 * Recalculate shipping fee based on actual weight and determine if special order is needed.
 * Returns the difference and whether a special order should be created.
 */
export function processActualWeight(
  actualWeightKg: number,
  customerPaidShipping: number,
  itemsSubtotal: number,
  isStandalone: boolean,
  standaloneMethod: "fixed_fee" | "free_shipping" | null,
  standaloneFixedFee: number
): {
  actualShippingFee: number;
  difference: number;
  needsSpecialOrder: boolean;
  specialOrderType: "pending_shipping" | "pending_refund" | null;
} {
  let actualShippingFee: number;

  if (isStandalone && standaloneMethod) {
    // Standalone: actual fee is from courier, but customer paid fixed fee or 0
    // The difference is recorded as profit/loss but NOT charged to customer
    actualShippingFee = calculateStandaloneShippingFee(standaloneMethod, standaloneFixedFee);
    const difference = customerPaidShipping - actualShippingFee;
    return {
      actualShippingFee,
      difference,
      needsSpecialOrder: false, // Standalone doesn't trigger special order
      specialOrderType: null,
    };
  }

  // Normal product: recalculate based on actual weight
  const { shippingFee } = calculateNormalShippingFee(itemsSubtotal, actualWeightKg);
  actualShippingFee = shippingFee;

  const difference = actualShippingFee - customerPaidShipping;
  // V2.1.26: Remove actualWeightKg > 10 condition - any difference should trigger special order
  const needsSpecialOrder = Math.abs(difference) > 0.01;

  let specialOrderType: "pending_shipping" | "pending_refund" | null = null;
  if (needsSpecialOrder) {
    specialOrderType = difference > 0 ? "pending_shipping" : "pending_refund";
  }

  return { actualShippingFee, difference, needsSpecialOrder, specialOrderType };
}

// ============================================================================
// V1.2: Special Order Actions (特别订单处理)
// ============================================================================

export async function createSpecialOrderAction(
  orderId: number,
  actionType: "notify_shortage" | "confirm_received" | "refund" | "company_bear" | "remark" | "convert_to_credit",
  amount: number,
  performedBy: string,
  remark?: string
) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(specialOrderActions).values({
    orderId,
    actionType,
    amount: amount.toString(),
    performedBy,
    remark,
  });
  return { success: true };
}

export async function getSpecialOrderActions(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  const actions = await db.select().from(specialOrderActions)
    .where(eq(specialOrderActions.orderId, orderId))
    .orderBy(desc(specialOrderActions.createdAt));
  return actions;
}

export async function getSpecialOrders(params: { status?: string; type?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [eq(orders.isSpecialOrder, true)];
  if (params.status && params.status !== "all") {
    conditions.push(eq(orders.specialOrderStatus, params.status as any));
  }
  if (params.type && params.type !== "all") {
    conditions.push(eq(orders.specialOrderType, params.type as any));
  }
  const where = and(...conditions);
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const items = await db.select().from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);
  const countResult = await db.select({ count: sql`count(*)` }).from(orders).where(where);
  const total = Number(countResult[0]?.count) || 0;
  return { items, total };
}

// ============================================================================
// V1.2: Sub Orders (子订单管理)
// ============================================================================

export async function getSubOrders(parentOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  const subs = await db.select().from(orderSubOrders)
    .where(eq(orderSubOrders.parentOrderId, parentOrderId))
    .orderBy(asc(orderSubOrders.id));
  return subs;
}

export async function updateSubOrderActualWeight(
  subOrderId: number,
  actualWeight: number,
  actualShippingFee: number
) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(orderSubOrders).set({
    actualWeight: actualWeight.toString(),
    actualShippingFee: actualShippingFee.toString(),
  }).where(eq(orderSubOrders.id, subOrderId));
  return { success: true };
}

export async function updateOrderActualWeight(
  orderId: number,
  actualWeight: number,
  actualShippingFee: number,
  shippingDifference: number,
  shippingProfit: number | null,
  shippingLoss: number | null,
  isSpecialOrder: boolean,
  specialOrderType: string | null
) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(orders).set({
    actualWeight: actualWeight.toString(),
    actualShippingFee: actualShippingFee.toString(),
    shippingDifference: shippingDifference.toString(),
    shippingProfit: shippingProfit !== null ? shippingProfit.toString() : null,
    shippingLoss: shippingLoss !== null ? shippingLoss.toString() : null,
    isSpecialOrder,
    specialOrderType: specialOrderType as any,
    specialOrderStatus: isSpecialOrder ? "pending" as any : undefined,
  }).where(eq(orders.id, orderId));
  return { success: true };
}

// ============================================================================
// V2.0: Live Rooms (直播房间)
// ============================================================================

export async function getLiveRooms(filters?: {
  status?: string;
  liveType?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(liveRooms);
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(liveRooms.status, filters.status as any));
  if (filters?.liveType) conditions.push(eq(liveRooms.liveType, filters.liveType as any));
  if (conditions.length > 0) {
    query = query.where(conditions[0]) as any;
    for (let i = 1; i < conditions.length; i++) {
      query = (query as any).andWhere(conditions[i]);
    }
  }
  query = (query as any).orderBy(liveRooms.liveDate) as any;
  if (filters?.limit) query = (query as any).limit(filters.limit) as any;
  if (filters?.offset) query = (query as any).offset(filters.offset) as any;
  return await query;
}

export async function getLiveRoomById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(liveRooms).where(eq(liveRooms.id, id));
  return result[0];
}

export async function createLiveRoom(data: {
  name: string;
  liveDate: Date;
  facebookLiveUrl?: string;
  facebookVideoId?: string;
  liveType?: string;
  importBatchId?: number;
  preorderStartDate?: Date;
  preorderEndDate?: Date;
  estimatedWaitDays?: string;
  status?: string;
  notes?: string;
  streamerName?: string;
  facebookPageId?: string;
  estimatedStartTime?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(liveRooms).values({
    name: data.name,
    liveDate: data.liveDate,
    facebookLiveUrl: data.facebookLiveUrl,
    facebookVideoId: data.facebookVideoId,
    liveType: (data.liveType as any) || 'normal',
    importBatchId: data.importBatchId,
    preorderStartDate: data.preorderStartDate,
    preorderEndDate: data.preorderEndDate,
    estimatedWaitDays: data.estimatedWaitDays,
    status: (data.status as any) || 'preparing',
    notes: data.notes,
    streamerName: data.streamerName || null,
    facebookPageId: data.facebookPageId || null,
    estimatedStartTime: data.estimatedStartTime || null,
  });
  return { id: result[0].insertId };
}

export async function updateLiveRoom(id: number, data: Partial<{
  name: string;
  liveDate: Date;
  facebookLiveUrl: string;
  facebookVideoId: string;
  liveType: string;
  importBatchId: number;
  preorderStartDate: Date;
  preorderEndDate: Date;
  estimatedWaitDays: string;
  status: string;
  notes: string;
  streamerName: string;
  facebookPageId: string;
  estimatedStartTime: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(liveRooms).set(data as any).where(eq(liveRooms.id, id));
  broadcastChange('liveRooms');
  return { success: true };
}

export async function deleteLiveRoom(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(liveRooms).where(eq(liveRooms.id, id));
  return { success: true };
}

// ============================================================================
// V2.0: Import Batches (采购批次)
// ============================================================================

export async function getImportBatches(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(importBatches);
  if (filters?.status) {
    query = query.where(eq(importBatches.status, filters.status as any)) as any;
  }
  query = (query as any).orderBy(importBatches.createdAt) as any;
  if (filters?.limit) query = (query as any).limit(filters.limit) as any;
  if (filters?.offset) query = (query as any).offset(filters.offset) as any;
  return await query;
}

export async function getImportBatchById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(importBatches).where(eq(importBatches.id, id));
  return result[0];
}

export async function createImportBatch(data: {
  batchNumber: string;
  batchName: string;
  sourceCountry?: string;
  supplierName?: string;
  liveRoomId?: number;
  preorderStartDate?: Date;
  preorderEndDate?: Date;
  shippingMethod?: string;
  chinaShippingCost?: string;
  status?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(importBatches).values({
    batchNumber: data.batchNumber,
    batchName: data.batchName,
    sourceCountry: data.sourceCountry || '中国',
    supplierName: data.supplierName,
    liveRoomId: data.liveRoomId,
    preorderStartDate: data.preorderStartDate,
    preorderEndDate: data.preorderEndDate,
    shippingMethod: (data.shippingMethod as any) || 'air',
    chinaShippingCost: data.chinaShippingCost || '0',
    status: (data.status as any) || 'in_progress',
    notes: data.notes,
  });
  return { id: result[0].insertId };
}

export async function updateImportBatch(id: number, data: Partial<{
  batchName: string;
  sourceCountry: string;
  supplierName: string;
  supplierOrderNumber: string | null;
  chinaTrackingNumber: string | null;
  liveRoomId: number;
  preorderStartDate: Date;
  preorderEndDate: Date;
  actualPurchaseDate: Date;
  shippingMethod: string;
  chinaShippingCost: string;
  otherFees: string;
  status: string;
  notes: string | null;
}>, operatorId?: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const batch = await getImportBatchById(id);
  if (!batch) throw new Error('采购单不存在');
  if ((batch as any).documentType === 'ib' && (batch as any).isLocked) {
    throw new Error('IB 已锁定；请先填写解锁原因后再修改。');
  }
  const allowedFields = ['batchName', 'sourceCountry', 'supplierName', 'supplierOrderNumber', 'chinaTrackingNumber', 'liveRoomId', 'preorderStartDate', 'preorderEndDate', 'actualPurchaseDate', 'shippingMethod', 'chinaShippingCost', 'otherFees', 'status', 'notes'];
  const values: Record<string, unknown> = {};
  const auditRows: Array<{ ibId: number; field: string; oldValue: string | null; newValue: string | null; changedBy: number | null }> = [];
  for (const field of allowedFields) {
    if (!(field in data)) continue;
    const oldValue = (batch as any)[field];
    const newValue = (data as any)[field];
    const normalizedOld = oldValue instanceof Date ? oldValue.toISOString() : String(oldValue ?? '');
    const normalizedNew = newValue instanceof Date ? newValue.toISOString() : String(newValue ?? '');
    if (normalizedOld === normalizedNew) continue;
    values[field] = newValue;
    if ((batch as any).documentType === 'ib') {
      auditRows.push({ ibId: id, field, oldValue: oldValue == null ? null : normalizedOld, newValue: newValue == null ? null : normalizedNew, changedBy: operatorId ?? null });
    }
  }
  if (Object.keys(values).length === 0) return { success: true, changes: 0 };
  await db.update(importBatches).set(values as any).where(eq(importBatches.id, id));
  if (auditRows.length) await db.insert(importBatchChangeLogs).values(auditRows);
  broadcastChange('importBatches');
  return { success: true, changes: auditRows.length };
}

type CNStage = 'ordered' | 'paid' | 'completed';

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function calculateCnPaymentDeadline(endDate: string) {
  const deadline = new Date(`${endDate}T00:00:00.000Z`);
  deadline.setUTCDate(deadline.getUTCDate() + 2);
  return toDateOnly(deadline);
}

/** Returns eligible China-preorder live sessions within the administrator's selected inclusive date range. */
export async function getCNEligibleLiveSessions(startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  const sessions = await db.select().from(liveRooms).where(and(
    eq(liveRooms.liveType, 'import_preorder'),
    gte(liveRooms.liveDate, start),
    lte(liveRooms.liveDate, end),
  )).orderBy(desc(liveRooms.liveDate));
  const ids = sessions.map(session => session.id);
  if (ids.length === 0) return sessions.map(session => ({ ...session, productCount: 0 }));
  const productRows = await db.select({ liveRoomId: liveRoomProducts.liveRoomId })
    .from(liveRoomProducts).where(inArray(liveRoomProducts.liveRoomId, ids));
  const counts = new Map<number, number>();
  for (const row of productRows) counts.set(row.liveRoomId, (counts.get(row.liveRoomId) || 0) + 1);
  return sessions.map(session => ({ ...session, productCount: counts.get(session.id) || 0 }));
}

/**
 * Merges products from selected China-preorder live sessions. Stage counts are calculated from
 * the selected sessions' import orders and are mutually exclusive, including partial shipments.
 */
export async function getCNMergedProducts(liveSessionIds: number[]) {
  const db = await getDb();
  if (!db || liveSessionIds.length === 0) return [];
  const selectedProducts = await db.select({
    liveRoomId: liveRoomProducts.liveRoomId,
    liveRoomName: liveRooms.name,
    productId: liveRoomProducts.productId,
    variantId: liveRoomProducts.variationId,
    displayName: liveRoomProducts.displayName,
    productName: products.name,
    coverImageUrl: products.coverImageUrl,
    salesMode: products.salesMode,
    allowImportOrder: products.allowImportOrder,
  }).from(liveRoomProducts)
    .innerJoin(liveRooms, eq(liveRoomProducts.liveRoomId, liveRooms.id))
    .innerJoin(products, eq(liveRoomProducts.productId, products.id))
    .where(inArray(liveRoomProducts.liveRoomId, liveSessionIds));

  const merged = new Map<string, any>();
  for (const row of selectedProducts) {
    const key = `${row.productId}:${row.variantId ?? 'base'}`;
    const existing = merged.get(key) || {
      productId: row.productId,
      variantId: row.variantId,
      productName: row.productName || row.displayName,
      coverImageUrl: row.coverImageUrl,
      salesMode: row.salesMode,
      allowImportOrder: Boolean(row.allowImportOrder),
      liveSessionCount: 0,
      orderedQuantity: 0,
      paidQuantity: 0,
      completedQuantity: 0,
      sessions: [],
    };
    if (!existing.sessions.some((session: any) => session.liveRoomId === row.liveRoomId)) {
      existing.liveSessionCount += 1;
      existing.sessions.push({
        liveRoomId: row.liveRoomId,
        liveRoomName: row.liveRoomName,
        orderedQuantity: 0,
        paidQuantity: 0,
        completedQuantity: 0,
      });
    }
    merged.set(key, existing);
  }

  const orderRows = unwrapMySqlRows<any>(await db.execute(sql`
    SELECT oi.productId, oi.variationId, oi.quantity, o.liveRoomId, o.importStatus,
      o.physicalStatus, COALESCE(shipped_items.shippedQty, 0) AS shippedQty
    FROM order_items oi
    JOIN orders o ON o.id = oi.orderId
    LEFT JOIN (
      SELECT pi.orderItemId, COALESCE(SUM(pi.quantity), 0) AS shippedQty
      FROM package_items pi
      JOIN packages pkg ON pkg.id = pi.packageId
      WHERE pkg.status = 'shipped'
      GROUP BY pi.orderItemId
    ) shipped_items ON shipped_items.orderItemId = oi.id
    WHERE o.orderCategory = 'import'
      AND o.physicalStatus <> 'cancelled'
      AND o.importStatus <> 'cancelled'
      AND o.liveRoomId IN (${sql.join(liveSessionIds, sql`, `)})
  `));

  for (const row of orderRows) {
    const key = `${row.productId}:${row.variationId ?? 'base'}`;
    const product = merged.get(key);
    if (!product) continue;
    const session = product.sessions.find((item: any) => item.liveRoomId === Number(row.liveRoomId));
    if (!session) continue;
    const quantity = Number(row.quantity) || 0;
    const shippedQuantity = Math.max(0, Math.min(quantity, Number(row.shippedQty) || 0));
    const status = String(row.importStatus || row.physicalStatus || 'pending');
    let stage: CNStage | null = null;
    let stageQuantity = quantity;
    if (['pending', 'receipt_uploaded', 'partial_payment'].includes(status)) stage = 'ordered';
    else if (['waiting_stock', 'ready_to_ship', 'scheduled_ship'].includes(status)) stage = 'paid';
    else if (status === 'partial_shipped') {
      stage = 'paid';
      stageQuantity = quantity - shippedQuantity;
      session.completedQuantity += shippedQuantity;
      product.completedQuantity += shippedQuantity;
    } else if (['shipped', 'completed'].includes(status)) stage = 'completed';
    if (!stage || stageQuantity <= 0) continue;
    if (stage === 'ordered') {
      session.orderedQuantity += stageQuantity;
      product.orderedQuantity += stageQuantity;
    } else if (stage === 'paid') {
      session.paidQuantity += stageQuantity;
      product.paidQuantity += stageQuantity;
    } else {
      session.completedQuantity += stageQuantity;
      product.completedQuantity += stageQuantity;
    }
  }
  return Array.from(merged.values()).sort((a, b) => a.productName.localeCompare(b.productName, 'zh'));
}

/** Creates one CN and its initial linked IB. Additional IBs are only created for split arrivals. */
export async function createChinaPreorderWithAutoIB(data: {
  startDate: string;
  endDate: string;
  paymentDeadline?: string;
  batchName?: string;
  supplierName?: string;
  supplierOrderNumber?: string;
  chinaTrackingNumber?: string;
  chinaShippingCost?: string;
  otherFees?: string;
  notes?: string;
  liveSessionIds: number[];
  items: Array<{
    productId: number;
    productName: string;
    variantId?: number | null;
    variantName?: string | null;
    paidQuantity: number;
    finalPurchaseQuantity: number;
    unitPurchaseCost?: string;
    notes?: string;
  }>;
  operatorId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (data.liveSessionIds.length === 0) throw new Error('请至少选择一场中国代购直播。');
  if (data.items.length === 0) throw new Error('请至少选择一个要采购的商品。');
  if (data.items.some(item => item.finalPurchaseQuantity < 0)) throw new Error('采购数量不可小于零。');
  const cnNumber = await generateCnNumber();
  const deadline = data.paymentDeadline || calculateCnPaymentDeadline(data.endDate);
  const firstLiveRoomId = data.liveSessionIds[0];
  const cnInsert = await db.insert(importBatches).values({
    documentType: 'cn',
    batchNumber: cnNumber,
    batchName: data.batchName || `${cnNumber} 中国代购`,
    sourceCountry: '中国',
    supplierName: data.supplierName,
    supplierOrderNumber: data.supplierOrderNumber,
    chinaTrackingNumber: data.chinaTrackingNumber,
    liveRoomId: firstLiveRoomId,
    startDate: data.startDate,
    endDate: data.endDate,
    paymentDeadline: deadline,
    preorderStartDate: new Date(`${data.startDate}T00:00:00.000Z`),
    preorderEndDate: new Date(`${data.endDate}T23:59:59.999Z`),
    chinaShippingCost: data.chinaShippingCost || '0',
    otherFees: data.otherFees || '0',
    status: 'purchased',
    ibGenerated: true,
    notes: data.notes,
  } as any);
  const cnId = Number(cnInsert[0].insertId);
  const ibInsert = await db.insert(importBatches).values({
    documentType: 'ib',
    cnId,
    batchNumber: `IB-${cnNumber}`,
    batchName: `${cnNumber} · 等待到货`,
    sourceCountry: '中国',
    supplierName: data.supplierName,
    supplierOrderNumber: data.supplierOrderNumber,
    chinaTrackingNumber: data.chinaTrackingNumber,
    liveRoomId: firstLiveRoomId,
    startDate: data.startDate,
    endDate: data.endDate,
    paymentDeadline: deadline,
    chinaShippingCost: data.chinaShippingCost || '0',
    otherFees: data.otherFees || '0',
    status: 'in_progress',
    notes: `自动关联 ${cnNumber}${data.notes ? `\n${data.notes}` : ''}`,
  } as any);
  const ibId = Number(ibInsert[0].insertId);
  const itemValues = data.items.map(item => ({
    batchId: cnId,
    productId: item.productId,
    productName: item.productName,
    variantId: item.variantId ?? null,
    variantName: item.variantName ?? null,
    paidQuantity: item.paidQuantity,
    finalPurchaseQuantity: item.finalPurchaseQuantity,
    unitPurchaseCost: item.unitPurchaseCost,
    notes: item.notes,
  }));
  await db.insert(importBatchItems).values(itemValues as any);
  await db.insert(importBatchItems).values(itemValues.map(item => ({ ...item, batchId: ibId })) as any);
  await db.update(importBatches).set({ autoIbId: ibId } as any).where(eq(importBatches.id, cnId));

  // A CN is created from completed live-session selections. Bind only previously unbound,
  // still-valid import orders so this CN's payment deadline can safely drive expiry checks
  // without stealing orders that were already assigned to another CN.
  const linkedOrdersResult = await db.update(orders).set({ importBatchId: cnId } as any).where(and(
    eq(orders.orderCategory, 'import'),
    inArray(orders.liveRoomId, data.liveSessionIds),
    isNull(orders.importBatchId),
    or(isNull(orders.physicalStatus), ne(orders.physicalStatus, 'cancelled')),
    or(isNull(orders.importStatus), ne(orders.importStatus, 'cancelled')),
  ));
  const linkedOrderCount = Number((linkedOrdersResult as any)?.[0]?.affectedRows ?? (linkedOrdersResult as any)?.affectedRows ?? 0);
  await db.insert(cnChangeLogs).values({
    cnId,
    field: 'created',
    oldValue: null,
    newValue: JSON.stringify({ startDate: data.startDate, endDate: data.endDate, paymentDeadline: deadline, liveSessionIds: data.liveSessionIds, itemCount: data.items.length, autoIbId: ibId, linkedOrderCount }),
    changedBy: data.operatorId ?? null,
  });
  broadcastChanges(['importBatches', 'inventory']);
  return { cnId, cnNumber, ibId, ibNumber: `IB-${cnNumber}`, paymentDeadline: deadline, linkedOrderCount };
}

/** Creates an additional IB only when a CN has a genuine split arrival. The first IB is always automatic. */
export async function createSplitArrivalImportBatch(cnId: number, operatorId?: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const cn = await getImportBatchById(cnId);
  if (!cn || (cn as any).documentType !== 'cn') throw new Error('CN 单据不存在。');
  const existingIbs = await db.select().from(importBatches).where(eq(importBatches.cnId, cnId));
  const sequence = existingIbs.length + 1;
  const batchNumber = `IB-${(cn as any).batchNumber}-${sequence}`;
  const inserted = await db.insert(importBatches).values({
    documentType: 'ib',
    cnId,
    batchNumber,
    batchName: `${(cn as any).batchNumber} · 分批到货 ${sequence}`,
    sourceCountry: (cn as any).sourceCountry || '中国',
    supplierName: (cn as any).supplierName,
    supplierOrderNumber: (cn as any).supplierOrderNumber,
    chinaTrackingNumber: (cn as any).chinaTrackingNumber,
    liveRoomId: (cn as any).liveRoomId,
    startDate: (cn as any).startDate,
    endDate: (cn as any).endDate,
    paymentDeadline: (cn as any).paymentDeadline,
    shippingMethod: (cn as any).shippingMethod || 'air',
    chinaShippingCost: '0',
    otherFees: '0',
    status: 'in_progress',
    notes: `分批到货 IB，关联 ${(cn as any).batchNumber}`,
  } as any);
  const ibId = Number(inserted[0].insertId);
  const cnItems = await getImportBatchItems(cnId);
  if (cnItems.length > 0) {
    await db.insert(importBatchItems).values(cnItems.map((item: any) => ({
      batchId: ibId,
      productId: item.productId,
      productName: item.productName,
      variantId: item.variantId,
      variantName: item.variantName,
      paidQuantity: item.paidQuantity,
      finalPurchaseQuantity: 0,
      unitPurchaseCost: item.unitPurchaseCost,
      notes: `来自 ${String((cn as any).batchNumber)} 的分批到货项目`,
    })) as any);
  }
  await db.insert(cnChangeLogs).values({
    cnId,
    field: 'splitArrivalIB.created',
    oldValue: null,
    newValue: JSON.stringify({ ibId, batchNumber, itemCount: cnItems.length }),
    changedBy: operatorId ?? null,
  });
  broadcastChange('importBatches');
  return { ibId, batchNumber };
}

/** Updates a CN while preserving one audit row per changed field. */
export async function updateCNWithAudit(cnId: number, changes: Record<string, unknown>, operatorId?: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const current = await getImportBatchById(cnId);
  if (!current || (current as any).documentType !== 'cn') throw new Error('CN 单据不存在。');
  const allowedFields = ['batchName', 'supplierName', 'supplierOrderNumber', 'chinaTrackingNumber', 'startDate', 'endDate', 'paymentDeadline', 'chinaShippingCost', 'otherFees', 'notes', 'status'];
  const updateValues: Record<string, unknown> = {};
  const auditRows: Array<{ cnId: number; field: string; oldValue: string | null; newValue: string | null; changedBy: number | null }> = [];
  for (const field of allowedFields) {
    if (!(field in changes)) continue;
    const oldValue = (current as any)[field];
    const newValue = changes[field];
    if (String(oldValue ?? '') === String(newValue ?? '')) continue;
    updateValues[field] = newValue;
    auditRows.push({ cnId, field, oldValue: oldValue == null ? null : String(oldValue), newValue: newValue == null ? null : String(newValue), changedBy: operatorId ?? null });
  }
  if (Object.keys(updateValues).length === 0) return { success: true, changes: 0 };
  await db.update(importBatches).set(updateValues as any).where(eq(importBatches.id, cnId));
  await db.insert(cnChangeLogs).values(auditRows);
  broadcastChange('importBatches');
  return { success: true, changes: auditRows.length };
}

export async function getCNChangeLogs(cnId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(cnChangeLogs).where(eq(cnChangeLogs.cnId, cnId)).orderBy(desc(cnChangeLogs.changedAt));
}

export async function lockImportBatch(ibId: number, operatorId?: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const batch = await getImportBatchById(ibId);
  if (!batch || (batch as any).documentType !== 'ib') throw new Error('IB 单据不存在。');
  await db.update(importBatches).set({ isLocked: true, lockedAt: new Date(), lockedBy: operatorId ?? null, unlockReason: null } as any).where(eq(importBatches.id, ibId));
  await db.insert(cnChangeLogs).values({ cnId: (batch as any).cnId || ibId, field: `IB#${ibId}.lock`, oldValue: String((batch as any).isLocked), newValue: 'true', changedBy: operatorId ?? null });
  broadcastChange('importBatches');
  return { success: true };
}

export async function unlockImportBatch(ibId: number, operatorId: number | undefined, reason: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (!reason.trim()) throw new Error('解锁 IB 必须填写原因。');
  const batch = await getImportBatchById(ibId);
  if (!batch || (batch as any).documentType !== 'ib') throw new Error('IB 单据不存在。');
  await db.update(importBatches).set({ isLocked: false, lockedAt: null, lockedBy: null, unlockReason: reason.trim() } as any).where(eq(importBatches.id, ibId));
  await db.insert(cnChangeLogs).values({ cnId: (batch as any).cnId || ibId, field: `IB#${ibId}.unlock`, oldValue: 'true', newValue: reason.trim(), changedBy: operatorId ?? null });
  await db.insert(importBatchChangeLogs).values({ ibId, field: 'lock', oldValue: 'true', newValue: 'false', changedBy: operatorId ?? null });
  await db.insert(importBatchChangeLogs).values({ ibId, field: 'unlockReason', oldValue: null, newValue: reason.trim(), changedBy: operatorId ?? null });
  broadcastChange('importBatches');
  return { success: true };
}

/** Global CN/IB workbench summary. It only reads persisted order links and expiry-run audit rows. */
export async function getCnIbDashboardSummary() {
  const db = await getDb();
  if (!db) return { linkedOrderCount: 0, activeLinkedOrderCount: 0, cnCount: 0, ibCount: 0, lastExpiryRun: null };
  const counts = unwrapMySqlRows<{
    linkedOrderCount: number | string;
    activeLinkedOrderCount: number | string;
    cnCount: number | string;
    ibCount: number | string;
  }>(await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM orders o INNER JOIN import_batches cn ON cn.id = o.importBatchId WHERE cn.documentType = 'cn' AND o.orderCategory = 'import') AS linkedOrderCount,
      (SELECT COUNT(*) FROM orders o INNER JOIN import_batches cn ON cn.id = o.importBatchId WHERE cn.documentType = 'cn' AND o.orderCategory = 'import' AND o.physicalStatus <> 'cancelled') AS activeLinkedOrderCount,
      (SELECT COUNT(*) FROM import_batches WHERE documentType = 'cn') AS cnCount,
      (SELECT COUNT(*) FROM import_batches WHERE documentType = 'ib') AS ibCount
  `))[0];
  const [lastExpiryRun] = await db.select().from(cnExpiryRunLogs).orderBy(desc(cnExpiryRunLogs.runAt)).limit(1);
  return {
    linkedOrderCount: Number(counts?.linkedOrderCount ?? 0),
    activeLinkedOrderCount: Number(counts?.activeLinkedOrderCount ?? 0),
    cnCount: Number(counts?.cnCount ?? 0),
    ibCount: Number(counts?.ibCount ?? 0),
    lastExpiryRun: lastExpiryRun ?? null,
  };
}

/** Idempotent expiry sweep: cancel only overdue import orders without a pending proof review. */
export async function processExpiredCNOrders() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const candidates = unwrapMySqlRows<{ id: number; orderNumber: string }>(await db.execute(sql`
    SELECT o.id, o.orderNumber
    FROM orders o
    JOIN import_batches cn ON cn.id = o.importBatchId
    WHERE cn.documentType = 'cn'
      AND cn.paymentDeadline IS NOT NULL
      AND cn.paymentDeadline < CURDATE()
      AND o.orderCategory = 'import'
      AND o.physicalStatus <> 'cancelled'
      AND o.importStatus IN ('pending', 'receipt_uploaded')
      AND NOT EXISTS (
        SELECT 1 FROM order_payments pending_proof
        WHERE pending_proof.orderId = o.id
          AND pending_proof.receiptUrl IS NOT NULL
          AND TRIM(pending_proof.receiptUrl) <> ''
          AND pending_proof.reviewStatus = 'pending'
      )
      AND (
        (COALESCE(o.receiptUrl, '') = '' AND o.paymentUploadedAt IS NULL)
        OR EXISTS (
          SELECT 1 FROM order_payments rejected_proof
          WHERE rejected_proof.orderId = o.id
            AND rejected_proof.reviewStatus = 'rejected'
        )
      )
  `));
  const cancelled: Array<{ id: number; orderNumber: string }> = [];
  const failed: Array<{ id: number; orderNumber: string }> = [];
  for (const order of candidates) {
    try {
      await cancelOrderWithReason(order.id, '超过中国代购汇款期限且未有有效付款凭证，系统自动取消', '系统自动');
      await db.update(orders).set({ importStatus: 'cancelled' as any }).where(eq(orders.id, order.id));
      cancelled.push(order);
    } catch (error) {
      console.error('[CN expiry] unable to cancel order', order.id, error);
      failed.push(order);
    }
  }
  const runAt = new Date();
  await db.insert(cnExpiryRunLogs).values({
    inspectedCount: candidates.length,
    cancelledCount: cancelled.length,
    failedCount: failed.length,
    cancelledOrderNumbers: cancelled.map(order => order.orderNumber),
    runAt,
  });
  broadcastChange('importBatches');
  return { inspected: candidates.length, cancelledCount: cancelled.length, failedCount: failed.length, cancelled, runAt };
}

/**
 * 本地订单付款期限巡检：仅处理下单满七天、仍未有效付款且未处于付款凭证待审核的订单。
 * 取消动作统一经 cancelOrderWithReason 执行，以维持库存释放、审计与通知的既有幂等语义。
 */
export async function processExpiredLocalOrders() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const candidates = unwrapMySqlRows<{ id: number; orderNumber: string }>(await db.execute(sql`
    SELECT o.id, o.orderNumber
    FROM orders o
    WHERE (o.orderCategory IS NULL OR o.orderCategory = 'local')
      AND o.createdAt < DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND o.physicalStatus IN ('pending', 'hold_order')
      AND COALESCE(o.cancelProtection, 0) = 0
      AND COALESCE(o.paidAmount, 0) <= 0
      AND (o.receiptUrl IS NULL OR TRIM(o.receiptUrl) = '')
      AND NOT EXISTS (
        SELECT 1 FROM order_payments pending_proof
        WHERE pending_proof.orderId = o.id
          AND pending_proof.receiptUrl IS NOT NULL
          AND TRIM(pending_proof.receiptUrl) <> ''
          AND pending_proof.reviewStatus = 'pending'
      )
      AND NOT EXISTS (
        SELECT 1 FROM order_payments approved_payment
        WHERE approved_payment.orderId = o.id
          AND approved_payment.reviewStatus = 'approved'
      )
  `));
  const cancelled: Array<{ id: number; orderNumber: string }> = [];
  const failed: Array<{ id: number; orderNumber: string }> = [];
  for (const order of candidates) {
    try {
      await cancelOrderWithReason(order.id, '本地订单下单满7天仍未有有效付款凭证，系统自动取消', '系统自动');
      cancelled.push(order);
    } catch (error) {
      console.error('[Local expiry] unable to cancel order', order.id, error);
      failed.push(order);
    }
  }
  return { inspected: candidates.length, cancelledCount: cancelled.length, failedCount: failed.length, cancelled, runAt: new Date() };
}

export async function deleteImportBatch(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(importBatchItems).where(eq(importBatchItems.batchId, id));
  await db.delete(importBatches).where(eq(importBatches.id, id));
  return { success: true };
}

// ============================================================================
// V2.0: Import Batch Items (采购批次商品明细)
// ============================================================================

export async function getImportBatchItems(batchId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(importBatchItems).where(eq(importBatchItems.batchId, batchId));
}

export async function upsertImportBatchItem(data: {
  batchId: number;
  productId: number;
  productName: string;
  variantId?: number;
  variantName?: string;
  paidQuantity?: number;
  finalPurchaseQuantity?: number;
  actualReceivedQty?: number;
  healthyQty?: number;
  damagedQty?: number;
  deadQty?: number;
  missingQty?: number;
  itemStatus?: string;
  unitPurchaseCost?: string;
  spotSaleEnabled?: boolean;
  spotSaleQty?: number;
  notes?: string;
}, operatorId?: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const batch = await getImportBatchById(data.batchId);
  if (!batch) throw new Error('采购单不存在');
  if ((batch as any).documentType === 'ib' && (batch as any).isLocked) throw new Error('IB 已锁定；请先填写解锁原因后再修改。');
  // Check if item already exists
  const existing = await db.select().from(importBatchItems)
    .where(eq(importBatchItems.batchId, data.batchId));
  const found = existing.find(i => i.productId === data.productId && i.variantId === data.variantId);
  if (found) {
    const updateValues = {
      paidQuantity: data.paidQuantity ?? found.paidQuantity,
      finalPurchaseQuantity: data.finalPurchaseQuantity ?? found.finalPurchaseQuantity,
      actualReceivedQty: data.actualReceivedQty ?? found.actualReceivedQty,
      healthyQty: data.healthyQty ?? found.healthyQty,
      damagedQty: data.damagedQty ?? found.damagedQty,
      deadQty: data.deadQty ?? found.deadQty,
      missingQty: data.missingQty ?? found.missingQty,
      itemStatus: (data.itemStatus as any) ?? found.itemStatus,
      unitPurchaseCost: data.unitPurchaseCost ?? found.unitPurchaseCost,
      spotSaleEnabled: data.spotSaleEnabled ?? found.spotSaleEnabled,
      spotSaleQty: data.spotSaleQty ?? found.spotSaleQty,
      notes: data.notes ?? found.notes,
    };
    await db.update(importBatchItems).set(updateValues).where(eq(importBatchItems.id, found.id));
    if ((batch as any).documentType === 'ib') {
      const editableFields = Object.keys(updateValues) as Array<keyof typeof updateValues>;
      const auditRows = editableFields.filter((field) => {
        const oldValue = (found as any)[field];
        const newValue = updateValues[field];
        return String(oldValue ?? '') !== String(newValue ?? '');
      }).map((field) => ({
        ibId: data.batchId,
        field: `item#${found.id}.${field}`,
        oldValue: (found as any)[field] == null ? null : String((found as any)[field]),
        newValue: updateValues[field] == null ? null : String(updateValues[field]),
        changedBy: operatorId ?? null,
      }));
      if (auditRows.length) await db.insert(importBatchChangeLogs).values(auditRows);
    }
    broadcastChange('importBatches');
    return { id: found.id };
  }
  const result = await db.insert(importBatchItems).values({
    batchId: data.batchId,
    productId: data.productId,
    productName: data.productName,
    variantId: data.variantId,
    variantName: data.variantName,
    paidQuantity: data.paidQuantity || 0,
    finalPurchaseQuantity: data.finalPurchaseQuantity || 0,
    actualReceivedQty: data.actualReceivedQty,
    healthyQty: data.healthyQty,
    damagedQty: data.damagedQty || 0,
    deadQty: data.deadQty || 0,
    missingQty: data.missingQty || 0,
    itemStatus: (data.itemStatus as any) || 'pending',
    unitPurchaseCost: data.unitPurchaseCost,
    spotSaleEnabled: data.spotSaleEnabled || false,
    spotSaleQty: data.spotSaleQty || 0,
    notes: data.notes,
  });
  const itemId = Number(result[0].insertId);
  if ((batch as any).documentType === 'ib') {
    await db.insert(importBatchChangeLogs).values({
      ibId: data.batchId,
      field: `item#${itemId}.created`,
      oldValue: null,
      newValue: JSON.stringify({ productId: data.productId, variantId: data.variantId ?? null, productName: data.productName, finalPurchaseQuantity: data.finalPurchaseQuantity ?? 0 }),
      changedBy: operatorId ?? null,
    });
  }
  broadcastChange('importBatches');
  return { id: itemId };
}

export async function deleteImportBatchItem(id: number, operatorId?: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const item = (await db.select().from(importBatchItems).where(eq(importBatchItems.id, id)))[0];
  if (!item) throw new Error('采购商品不存在');
  const batch = await getImportBatchById(item.batchId);
  if ((batch as any)?.documentType === 'ib' && (batch as any).isLocked) throw new Error('IB 已锁定；请先填写解锁原因后再修改。');
  await db.delete(importBatchItems).where(eq(importBatchItems.id, id));
  if ((batch as any)?.documentType === 'ib') {
    await db.insert(importBatchChangeLogs).values({ ibId: item.batchId, field: `item#${id}.deleted`, oldValue: JSON.stringify(item), newValue: null, changedBy: operatorId ?? null });
  }
  broadcastChange('importBatches');
  return { success: true };
}

export async function getImportBatchChangeLogs(ibId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(importBatchChangeLogs).where(eq(importBatchChangeLogs.ibId, ibId)).orderBy(desc(importBatchChangeLogs.changedAt));
}

// ============================================================================
// V2.0: Allocate China shipping cost to batch items
// ============================================================================

export async function allocateShippingCost(batchId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const batch = await getImportBatchById(batchId);
  if (!batch) throw new Error('Batch not found');
  const items = await getImportBatchItems(batchId);
  if (items.length === 0) return { allocated: 0 };
  const totalQty = items.reduce((sum, i) => sum + (i.finalPurchaseQuantity || i.paidQuantity || 0), 0);
  if (totalQty === 0) return { allocated: 0 };
  const totalShipping = parseFloat(batch.chinaShippingCost?.toString() || '0');
  const perUnit = totalShipping / totalQty;
  for (const item of items) {
    const qty = item.finalPurchaseQuantity || item.paidQuantity || 0;
    const unitCost = parseFloat(item.unitPurchaseCost?.toString() || '0');
    const allocated = perUnit * qty;
    const totalUnitCost = (unitCost + perUnit).toFixed(2);
    await db.update(importBatchItems).set({
      allocatedShippingCost: perUnit.toFixed(2),
      totalUnitCost: totalUnitCost as any,
    }).where(eq(importBatchItems.id, item.id));
  }
  return { allocated: perUnit, totalQty, totalShipping };
}

// ============================================================================
// V2.0: Get import preorder statistics for dashboard
// ============================================================================

export async function getImportPreorderStats() {
  const db = await getDb();
  if (!db) return { paidSales: 0, unpaidCount: 0, specialOrders: 0, activeBatches: 0 };
  // Get all import_preorder orders
  const importOrders = await db.select().from(orders).where(eq((orders as any).orderCategory, 'import' as any));
  const paidOrders = importOrders.filter(o => o.physicalStatus !== 'pending' && o.physicalStatus !== 'cancelled');
  const unpaidOrders = importOrders.filter(o => o.physicalStatus === 'pending');
  const specialOrders = importOrders.filter(o => o.isSpecialOrder);
  const paidSales = paidOrders.reduce((sum, o) => sum + parseFloat(o.paidAmount?.toString() || '0'), 0);
  // Get active batches count
  const batches = await db.select().from(importBatches);
  const activeBatches = batches.filter(b => b.status !== 'completed').length;
  return {
    paidSales: paidSales.toFixed(2),
    unpaidCount: unpaidOrders.length,
    specialOrders: specialOrders.length,
    activeBatches,
  };
}

// ============================================================================
// V2.0: Get import preorder profit analysis
// ============================================================================

export async function getImportPreorderProfitAnalysis(filters?: {
  batchId?: number;
  liveRoomId?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return null;
  // Get import orders
  let importOrdersList = await db.select().from(orders).where(eq((orders as any).orderCategory, 'import' as any));
  if (filters?.batchId) {
    importOrdersList = importOrdersList.filter(o => o.importBatchId === filters.batchId);
  }
  if (filters?.liveRoomId) {
    importOrdersList = importOrdersList.filter(o => o.liveRoomId === filters.liveRoomId);
  }
  if (filters?.startDate) {
    importOrdersList = importOrdersList.filter(o => new Date(o.createdAt) >= filters.startDate!);
  }
  if (filters?.endDate) {
    importOrdersList = importOrdersList.filter(o => new Date(o.createdAt) <= filters.endDate!);
  }
  const paidOrders = importOrdersList.filter(o => o.physicalStatus !== 'pending' && o.physicalStatus !== 'cancelled');
  const totalSales = paidOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount?.toString() || '0'), 0);
  const customerShipping = paidOrders.reduce((sum, o) => sum + parseFloat(o.customerPaidShipping?.toString() || '0'), 0);
  // Get batch costs
  let batchCosts = 0;
  let chinaShipping = 0;
  let localCourierCost = 0;
  let scrapLoss = 0;
  let refundLoss = 0;
  for (const order of paidOrders) {
    if (order.importBatchId) {
      const items = await getImportBatchItems(order.importBatchId);
      for (const item of items) {
        const qty = item.finalPurchaseQuantity || item.paidQuantity || 0;
        const unitCost = parseFloat(item.unitPurchaseCost?.toString() || '0');
        batchCosts += unitCost * qty;
      }
      const batch = await getImportBatchById(order.importBatchId);
      if (batch) {
        chinaShipping += parseFloat(batch.chinaShippingCost?.toString() || '0');
      }
    }
    localCourierCost += parseFloat(order.actualShippingFee?.toString() || '0');
    // Get exceptions for scrap/refund
    const exceptions = await db.select().from(orderExceptions).where(eq(orderExceptions.orderId, order.id));
    for (const exc of exceptions) {
      scrapLoss += parseFloat(exc.scrapCost?.toString() || '0');
      refundLoss += parseFloat(exc.refundAmount?.toString() || '0');
    }
  }
  const companyBearShipping = paidOrders.reduce((sum, o) => sum + parseFloat(o.shippingLoss?.toString() || '0'), 0);
  const grossProfit = totalSales + customerShipping - batchCosts - chinaShipping - localCourierCost - scrapLoss - refundLoss;
  const grossMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
  return {
    totalSales: totalSales.toFixed(2),
    customerShipping: customerShipping.toFixed(2),
    batchCosts: batchCosts.toFixed(2),
    chinaShipping: chinaShipping.toFixed(2),
    localCourierCost: localCourierCost.toFixed(2),
    companyBearShipping: companyBearShipping.toFixed(2),
    scrapLoss: scrapLoss.toFixed(2),
    refundLoss: refundLoss.toFixed(2),
    grossProfit: grossProfit.toFixed(2),
    grossMargin: grossMargin.toFixed(1),
    orderCount: paidOrders.length,
  };
}

// ============================================================================
// V2.1: Special Price Product Profit Analysis (特价商品利润分析)
// ============================================================================

export async function getSpecialPriceProductProfit(dateRange: { start: Date; end: Date }) {
  const db = await getDb();
  if (!db) return {
    totalSpecialRevenue: 0,
    totalNormalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    grossMargin: 0,
    specialSaleCount: 0,
    normalSaleCount: 0,
    details: [],
  };

  const { start, end } = dateRange;
  const startMs = start.getTime();
  const endMs = end.getTime();

  // Get order items for products that are marked as special (isSpecial = true)
  const [rows] = await db.execute(sql`
    SELECT 
      oi.productId,
      oi.productName,
      oi.quantity,
      oi.unitPrice as unit_price,
      oi.subtotal,
      p.isSpecial as is_special,
      p.specialPrice as special_price,
      p.sellingPrice as selling_price,
      p.currentCost as current_cost,
      p.cost,
      o.orderNumber as order_number,
      o.createdAt
    FROM order_items oi
    INNER JOIN orders o ON oi.orderId = o.id
    INNER JOIN products p ON oi.productId = p.id
    WHERE o.createdAt >= ${startMs} AND o.createdAt <= ${endMs}
      AND o.physicalStatus != 'cancelled'
      AND oi.productType = 'physical'
      AND p.isSpecial = 1
    ORDER BY o.createdAt DESC
  `);

  const items = rows as unknown as any[];
  let totalSpecialRevenue = 0;
  let totalNormalRevenue = 0;
  let totalCost = 0;
  let specialSaleCount = 0;
  let normalSaleCount = 0;
  const details: any[] = [];

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const subtotal = Number(item.subtotal) || 0;
    const specialPrice = Number(item.special_price) || 0;
    const sellingPrice = Number(item.selling_price) || 0;
    const cost = Number(item.current_cost) || Number(item.cost) || 0;

    // Determine if this sale was at special price or normal price
    const isSpecialSale = specialPrice > 0 && Math.abs(unitPrice - specialPrice) < 0.01;
    const itemCost = cost * qty;
    const itemProfit = subtotal - itemCost;

    if (isSpecialSale) {
      totalSpecialRevenue += subtotal;
      specialSaleCount += qty;
    } else {
      totalNormalRevenue += subtotal;
      normalSaleCount += qty;
    }
    totalCost += itemCost;

    details.push({
      productId: item.productId,
      productName: item.productName,
      orderNumber: item.order_number,
      quantity: qty,
      unitPrice: unitPrice.toFixed(2),
      isSpecialSale,
      specialPrice: specialPrice.toFixed(2),
      sellingPrice: sellingPrice.toFixed(2),
      cost: cost.toFixed(2),
      subtotal: subtotal.toFixed(2),
      itemCost: itemCost.toFixed(2),
      profit: itemProfit.toFixed(2),
      date: new Date(item.createdAt).toLocaleDateString(),
    });
  }

  const totalRevenue = totalSpecialRevenue + totalNormalRevenue;
  const totalProfit = totalRevenue - totalCost;
  const grossMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 10000) / 100 : 0;

  return {
    totalSpecialRevenue: totalSpecialRevenue.toFixed(2),
    totalNormalRevenue: totalNormalRevenue.toFixed(2),
    totalCost: totalCost.toFixed(2),
    totalProfit: totalProfit.toFixed(2),
    grossMargin,
    specialSaleCount,
    normalSaleCount,
    details,
  };
}

// ============================================================================
// V2.2: Special Order Follow-up (特别订单待跟进)
// ============================================================================

export async function getSpecialOrderFollowUpStats() {
  const db = await getDb();
  if (!db) return {
    pendingShippingCount: 0,
    pendingRefundCount: 0,
    logisticsErrorCount: 0,
    incompleteInfoCount: 0,
    notificationFailedCount: 0,
    stockExceptionCount: 0,
    overdueCount: 0,
    partialPaymentCount: 0,
    overPaymentCount: 0,
    amountChangedCount: 0,
    otherCount: 0,
    totalPending: 0,
  };
  const specialFollowUpTypeSql = sql.join(
    SPECIAL_ORDER_FOLLOW_UP_TYPES.map((type) => sql`${type}`),
    sql`, `,
  );
  // V3.2: Read directly from orders.specialOrderType — single source of truth
  // V2.1.19: Query from order_special_statuses table (new multi-status system)
  const [ssRows] = await db.execute(sql`
    SELECT 
      oss.type,
      COUNT(*) as cnt
    FROM order_special_statuses oss
    JOIN orders o ON o.id = oss.orderId
    WHERE oss.status = 'pending'
      AND oss.type != 'notification_failed'
      AND oss.type IN (${specialFollowUpTypeSql})
      AND o.physicalStatus NOT IN ('shipped', 'completed', 'cancelled')
    GROUP BY oss.type
  `);
  const typeCounts: Record<string, number> = {};
  (ssRows as unknown as any[]).forEach((r: any) => {
    typeCounts[r.type] = Number(r.cnt) || 0;
  });
  // V2.1.29: Also count from orders table for backward compatibility (legacy single-status)
  // Add legacy counts to order_special_statuses counts, excluding orders already tracked in the new table
  const [legacyRows] = await db.execute(sql`
    SELECT 
      o.specialOrderType,
      COUNT(*) as cnt
    FROM orders o
    WHERE o.isSpecialOrder = 1
      AND o.specialOrderStatus = 'pending'
      AND COALESCE(o.specialOrderType, '') != 'notification_failed'
      AND o.specialOrderType IN (${specialFollowUpTypeSql})
      AND o.physicalStatus != 'cancelled'
      AND NOT EXISTS (
        SELECT 1 FROM order_special_statuses oss 
        WHERE oss.orderId = o.id 
          AND oss.type = o.specialOrderType 
          AND oss.status = 'pending'
      )
    GROUP BY o.specialOrderType
  `);
  (legacyRows as unknown as any[]).forEach((r: any) => {
    const key = r.specialOrderType;
    if (!isSpecialOrderFollowUpType(key)) return;
    typeCounts[key] = (typeCounts[key] || 0) + (Number(r.cnt) || 0);
  });
  const pendingShippingCount = typeCounts['pending_shipping'] || 0;
  const pendingRefundCount = typeCounts['pending_refund'] || 0;
  const logisticsErrorCount = typeCounts['logistics_error'] || 0;
  const incompleteInfoCount = typeCounts['incomplete_info'] || 0;
  const notificationFailedCount = typeCounts['notification_failed'] || 0;
  const stockExceptionCount = typeCounts['stock_exception'] || 0;
  const overdueCount = typeCounts['overdue'] || 0;
  const partialPaymentCount = typeCounts['partial_payment'] || 0;
  const overPaymentCount = typeCounts['over_payment'] || 0;
  const amountChangedCount = typeCounts['amount_changed'] || 0;
  const otherCount = typeCounts['other'] || 0;
  const totalPending = Object.values(typeCounts).reduce((a, b) => a + b, 0);
  return {
    pendingShippingCount,
    pendingRefundCount,
    logisticsErrorCount,
    incompleteInfoCount,
    notificationFailedCount,
    stockExceptionCount,
    overdueCount,
    partialPaymentCount,
    overPaymentCount,
    amountChangedCount,
    otherCount,
    totalPending,
  };
}

export async function getSpecialOrderFollowUpList(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  const specialFollowUpTypeSql = sql.join(
    SPECIAL_ORDER_FOLLOW_UP_TYPES.map((type) => sql`${type}`),
    sql`, `,
  );
  // V3.2: Read directly from orders table — single source of truth
  const [rows] = await db.execute(sql`
    SELECT 
      o.id as order_id,
      o.orderNumber,
      o.parentOrderId,
      o.specialOrderType,
      o.specialOrderStatus,
      o.specialOrderSource,
      o.specialOrderReason,
      o.shippingDifference,
      o.customerPaidShipping,
      o.actualShippingFee,
      o.physicalStatus,
      o.orderCategory,
      o.importStatus,
      o.createdAt,
      o.shippingAddress,
      c.id as customer_id,
      c.name as customer_name,
      c.phoneNumber as customer_phone,
      c.facebookName,
      (SELECT remark FROM special_order_actions sa 
       WHERE sa.orderId = o.id AND sa.remark IS NOT NULL AND sa.remark != ''
       ORDER BY sa.createdAt DESC LIMIT 1) as last_remark,
      (SELECT performedBy FROM special_order_actions sa 
       WHERE sa.orderId = o.id 
       ORDER BY sa.createdAt DESC LIMIT 1) as last_handler
    FROM orders o
    LEFT JOIN customers c ON o.customerId = c.id
    WHERE o.physicalStatus != 'cancelled'
      AND o.isSpecialOrder = 1
      AND o.specialOrderStatus = 'pending'
      AND COALESCE(o.specialOrderType, '') != 'notification_failed'
      AND o.specialOrderType IN (${specialFollowUpTypeSql})
    ORDER BY o.createdAt ASC
    LIMIT ${limit}
  `);

  const items = rows as unknown as any[];
  
  // Get sub-orders for each parent order
  const result: any[] = [];
  for (const item of items) {
    const createdAt = new Date(item.createdAt);
    const waitTimeMs = now - createdAt.getTime();
    const waitHours = Math.floor(waitTimeMs / (60 * 60 * 1000));
    const isOverdue = waitTimeMs > 24 * 60 * 60 * 1000;

    // Get sub-orders if this is a parent order
    let subOrders: any[] = [];
    if (item.parentOrderId) {
      const [subs] = await db.execute(sql`
        SELECT subOrderNumber, status, awbNumber, trackingNumber, shippingFee
        FROM order_sub_orders
        WHERE parentOrderId = ${item.parentOrderId}
      `);
      subOrders = (subs as unknown as any[]).map((s: any) => ({
        subOrderNumber: s.subOrderNumber,
        status: s.status,
        awbNumber: s.awbNumber,
        trackingNumber: s.trackingNumber,
        shippingFee: s.shippingFee,
      }));
    }

        // V3.2: Determine special type label — all 7 unified types
    let specialTypeLabel = '';
    let specialTypeColor = '';
    switch (item.specialOrderType) {
      case 'pending_shipping':
        specialTypeLabel = '待补运费';
        specialTypeColor = 'orange';
        break;
      case 'pending_refund':
        specialTypeLabel = '待退款';
        specialTypeColor = 'red';
        break;
      case 'company_bear':
        specialTypeLabel = '公司承担';
        specialTypeColor = 'blue';
        break;
      case 'logistics_error':
        specialTypeLabel = '物流异常';
        specialTypeColor = 'yellow';
        break;
      case 'incomplete_info':
        specialTypeLabel = '资料异常';
        specialTypeColor = 'blue';
        break;
      case 'stock_exception':
        specialTypeLabel = '库存异常';
        specialTypeColor = 'amber';
        break;
      case 'overdue':
        specialTypeLabel = '超时未处理';
        specialTypeColor = 'red';
        break;
      case 'partial_payment':
        specialTypeLabel = '部分汇款';
        specialTypeColor = 'orange';
        break;
      case 'over_payment':
        specialTypeLabel = '多汇款';
        specialTypeColor = 'red';
        break;
      case 'amount_changed':
        specialTypeLabel = '金额异常';
        specialTypeColor = 'red';
        break;
      case 'other':
        specialTypeLabel = '其他';
        specialTypeColor = 'gray';
        break;
      default:
        specialTypeLabel = '未分类特别状态';
        specialTypeColor = 'gray';
    }

    // Calculate amount
    const amount = item.specialOrderType === 'pending_refund'
      ? Math.abs(Number(item.shippingDifference) || 0)
      : Number(item.shippingDifference) || 0;

    result.push({
      orderId: item.order_id,
      orderNumber: item.orderNumber,
      parentOrderId: item.parentOrderId,
      customerName: item.customer_name || item.facebook_name || '未知',
      customerPhone: item.customer_phone || '',
      specialType: item.specialOrderType,
      specialOrderSource: item.specialOrderSource || 'manual',
      specialOrderReason: item.specialOrderReason || '',
      specialTypeLabel,
      specialTypeColor,
      amount: amount.toFixed(2),
      waitHours,
      isOverdue,
      lastRemark: item.last_remark || '',
      lastHandler: item.last_handler || '',
      subOrders,
      physicalStatus: item.physicalStatus,
      orderCategory: item.orderCategory || 'local',
      importStatus: item.importStatus || null,
    });
  }

  return result;
}

// ============================================================================
// V3.1: Product Bundle (组合包管理) DB Helpers
// ============================================================================

// Get all bundles with optional filters
export async function getProductBundles(filters?: {
  status?: string;
  showInMall?: boolean;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(productBundles);
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(productBundles.status, filters.status as any));
  if (filters?.showInMall !== undefined) conditions.push(eq(productBundles.showInMall, filters.showInMall));
  if (filters?.search) {
    conditions.push(or(
      like(productBundles.name, `%${filters.search}%`),
      like(productBundles.keyword, `%${filters.search}%`)
    ));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return await query.orderBy(desc(productBundles.createdAt));
}

// Attach the current product cover image to bundle component rows for display only.
// The persisted bundle composition, stock, price and checkout logic remain unchanged.
async function attachBundleItemImages(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, items: any[]) {
  if (items.length === 0) return items;
  const productIds = Array.from(new Set(items.map((item) => Number(item.productId)).filter((id) => Number.isInteger(id) && id > 0)));
  if (productIds.length === 0) return items;

  const imageRows = await db.select({
    id: products.id,
    imageUrl: products.coverImageUrl,
  }).from(products).where(inArray(products.id, productIds));
  const imageByProductId = new Map(imageRows.map((row) => [row.id, row.imageUrl]));

  return items.map((item) => ({
    ...item,
    imageUrl: imageByProductId.get(item.productId) || undefined,
  }));
}

// Get single bundle with items
export async function getBundleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const bundle = (await db.select().from(productBundles).where(eq(productBundles.id, id)).limit(1))[0];
  if (!bundle) return undefined;
  const items = await db.select().from(productBundleItems).where(eq(productBundleItems.bundleId, id));
  return { ...bundle, items: await attachBundleItemImages(db, items) };
}

// Get bundle items only
export async function getBundleItems(bundleId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(productBundleItems).where(eq(productBundleItems.bundleId, bundleId));
}

// Get bundle stock logs
export async function getBundleStockLogs(bundleId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(bundleStockLogs)
    .where(eq(bundleStockLogs.bundleId, bundleId))
    .orderBy(desc(bundleStockLogs.createdAt));
}

// Calculate max bundle quantity based on item stock
export async function calculateMaxBundleQty(items: Array<{ productId: number; qtyPerBundle: number }>) {
  const db = await getDb();
  if (!db) return 0;
  let maxQty = Infinity;
  const breakdown: Array<{ productId: number; productName: string; availableStock: number; qtyPerBundle: number; maxBundles: number }> = [];
  
  for (const item of items) {
    const product = (await db.select().from(products).where(eq(products.id, item.productId)).limit(1))[0];
    if (!product) {
      breakdown.push({
        productId: item.productId,
        productName: 'Unknown',
        availableStock: 0,
        qtyPerBundle: item.qtyPerBundle,
        maxBundles: 0,
      });
      maxQty = 0;
      continue;
    }
    const availableStock = (product as any).stockQuantity || 0;
    const maxBundles = Math.floor(availableStock / item.qtyPerBundle);
    breakdown.push({
      productId: item.productId,
      productName: product.name,
      availableStock,
      qtyPerBundle: item.qtyPerBundle,
      maxBundles,
    });
    if (maxBundles < maxQty) maxQty = maxBundles;
  }
  
  return { maxQty: maxQty === Infinity ? 0 : maxQty, breakdown };
}

// Create bundle with items and transfer stock from single items
export async function createBundleWithStock(data: {
  name: string;
  nameEn?: string;
  keyword: string;
  sellingPrice: string;
  originalTotalPrice?: string;
  specialPrice?: string;
  coverImage?: string;
  description?: string;
  status?: string;
  showInMall?: boolean;
  weight?: string;
  internalNotes?: string;
  items: Array<{
    productId: number;
    variantId?: number;
    productName: string;
    variantName?: string;
    qtyPerBundle: number;
    unitCost: string;
    unitPrice: string;
  }>;
  bundleQty: number; // How many bundles to create
  operator?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Verify stock availability
  const calcResult = await calculateMaxBundleQty(
    data.items.map(i => ({ productId: i.productId, qtyPerBundle: i.qtyPerBundle }))
  );
  const maxQty = typeof calcResult === 'number' ? 0 : calcResult.maxQty;
  const breakdown = typeof calcResult === 'number' ? [] : calcResult.breakdown;
  if (data.bundleQty > maxQty) {
    const limiting = breakdown.find((b: any) => b.maxBundles < data.bundleQty);
    throw new Error(
      `库存不足。${limiting?.productName || '某商品'}目前只有${limiting?.availableStock || 0}个，` +
      `每组需要${limiting?.qtyPerBundle || 1}个，最多只能组成${maxQty}组。`
    );
  }

  // 2. Calculate totals
  const totalCost = data.items.reduce((sum, i) => sum + Number(i.unitCost) * i.qtyPerBundle, 0);
  const originalTotal = data.originalTotalPrice 
    ? Number(data.originalTotalPrice) 
    : data.items.reduce((sum, i) => sum + Number(i.unitPrice) * i.qtyPerBundle, 0);

  // 3. Insert bundle
  const result = await db.insert(productBundles).values({
    name: data.name,
    nameEn: data.nameEn,
    keyword: data.keyword,
    sellingPrice: data.sellingPrice,
    originalTotalPrice: String(originalTotal),
    specialPrice: data.specialPrice,
    coverImage: data.coverImage,
    description: data.description,
    status: (data.status as any) || 'active',
    showInMall: data.showInMall ?? true,
    weight: data.weight || '0',
    internalNotes: data.internalNotes,
    bundleStock: data.bundleQty,
    totalCost: String(totalCost),
  });
  
  const bundleId = (result as any)[0].insertId || (result as any).insertId;

  // 4. Insert bundle items
  for (const item of data.items) {
    await db.insert(productBundleItems).values({
      bundleId,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      variantName: item.variantName,
      qtyPerBundle: item.qtyPerBundle,
      unitCost: item.unitCost,
      unitPrice: item.unitPrice,
    });
  }

  // 5. Deduct stock from single items
  for (const item of data.items) {
    const product = (await db.select().from(products).where(eq(products.id, item.productId)).limit(1))[0];
    if (product) {
      const currentStock = (product as any).stockQuantity || 0;
      const deductQty = item.qtyPerBundle * data.bundleQty;
      const newStock = currentStock - deductQty;
      await db.update(products)
        .set({ stockQuantity: newStock } as any)
        .where(eq(products.id, item.productId));
      
      // Log single item stock change
      await db.insert(bundleStockLogs).values({
        bundleId,
        actionType: 'create',
        qtyChange: -deductQty,
        stockBefore: currentStock,
        stockAfter: newStock,
        affectedProducts: item.productName,
        operator: data.operator || 'system',
        notes: `转入组合包: ${data.name} (×${data.bundleQty}组)`,
      });
    }
  }

  // 6. Log bundle stock creation
  await db.insert(bundleStockLogs).values({
    bundleId,
    actionType: 'create',
    qtyChange: data.bundleQty,
    stockBefore: 0,
    stockAfter: data.bundleQty,
    affectedProducts: data.items.map(i => i.productName).join(', '),
    operator: data.operator || 'system',
    notes: `建立组合库存 ${data.bundleQty} 组`,
  });

  return { bundleId, bundleStock: data.bundleQty, totalCost, originalTotal };
}

// Restock bundle (补充组合) - deduct more from single items, add to bundle stock
export async function restockBundle(data: {
  bundleId: number;
  restockQty: number;
  operator?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const bundle = (await db.select().from(productBundles).where(eq(productBundles.id, data.bundleId)).limit(1))[0];
  if (!bundle) throw new Error("Bundle not found");

  const items = await db.select().from(productBundleItems).where(eq(productBundleItems.bundleId, data.bundleId));
  
  // Verify stock
  const calcResult = await calculateMaxBundleQty(
    items.map(i => ({ productId: i.productId, qtyPerBundle: i.qtyPerBundle }))
  );
  const maxQty = typeof calcResult === 'number' ? 0 : calcResult.maxQty;
  const breakdown = typeof calcResult === 'number' ? [] : calcResult.breakdown;
  if (data.restockQty > maxQty) {
    const limiting = breakdown.find((b: any) => b.maxBundles < data.restockQty);
    throw new Error(
      `库存不足。${limiting?.productName || '某商品'}目前只有${limiting?.availableStock || 0}个，` +
      `每组需要${limiting?.qtyPerBundle || 1}个，最多只能补充${maxQty}组。`
    );
  }

  const oldBundleStock = bundle.bundleStock;
  const newBundleStock = oldBundleStock + data.restockQty;

  // Deduct from single items
  for (const item of items) {
    const product = (await db.select().from(products).where(eq(products.id, item.productId)).limit(1))[0];
    if (product) {
      const currentStock = (product as any).stockQuantity || 0;
      const deductQty = item.qtyPerBundle * data.restockQty;
      const newStock = currentStock - deductQty;
      await db.update(products)
        .set({ stockQuantity: newStock } as any)
        .where(eq(products.id, item.productId));
      
      await db.insert(bundleStockLogs).values({
        bundleId: data.bundleId,
        actionType: 'restock',
        qtyChange: -deductQty,
        stockBefore: currentStock,
        stockAfter: newStock,
        affectedProducts: item.productName,
        operator: data.operator || 'system',
        notes: `补充组合包扣减: ${bundle.name} (+${data.restockQty}组)`,
      });
    }
  }

  // Update bundle stock
  await db.update(productBundles)
    .set({ bundleStock: newBundleStock } as any)
    .where(eq(productBundles.id, data.bundleId));

  // Log bundle stock addition
  await db.insert(bundleStockLogs).values({
    bundleId: data.bundleId,
    actionType: 'restock',
    qtyChange: data.restockQty,
    stockBefore: oldBundleStock,
    stockAfter: newBundleStock,
    affectedProducts: items.map(i => i.productName).join(', '),
    operator: data.operator || 'system',
    notes: `补充组合库存 ${data.restockQty} 组`,
  });

  return { newBundleStock };
}

// Disassemble bundle (拆除组合) - return items to single item stock
export async function disassembleBundle(data: {
  bundleId: number;
  disassembleQty: number;
  reason: string;
  damagedProducts?: number[]; // Product IDs that are damaged (go to waste, not back to stock)
  operator?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const bundle = (await db.select().from(productBundles).where(eq(productBundles.id, data.bundleId)).limit(1))[0];
  if (!bundle) throw new Error("Bundle not found");
  if (data.disassembleQty > bundle.bundleStock) {
    throw new Error(`拆除数量不能大于剩余组合库存 (${bundle.bundleStock}组)`);
  }

  const items = await db.select().from(productBundleItems).where(eq(productBundleItems.bundleId, data.bundleId));
  const oldBundleStock = bundle.bundleStock;
  const newBundleStock = oldBundleStock - data.disassembleQty;

  // Return items to single item stock (unless damaged)
  for (const item of items) {
    const product = (await db.select().from(products).where(eq(products.id, item.productId)).limit(1))[0];
    if (product) {
      const currentStock = (product as any).stockQuantity || 0;
      const returnQty = item.qtyPerBundle * data.disassembleQty;
      const isDamaged = data.damagedProducts?.includes(item.productId);
      
      if (isDamaged) {
        // Damaged items go to waste - log but don't add back to stock
        await db.insert(bundleStockLogs).values({
          bundleId: data.bundleId,
          actionType: 'disassemble',
          qtyChange: 0,
          stockBefore: currentStock,
          stockAfter: currentStock,
          affectedProducts: item.productName,
          reason: data.reason,
          operator: data.operator || 'system',
          notes: `拆除组合: ${returnQty}个 ${item.productName} 损坏报废`,
        });
      } else {
        // Normal items return to stock
        const newStock = currentStock + returnQty;
        await db.update(products)
          .set({ stockQuantity: newStock } as any)
          .where(eq(products.id, item.productId));
        
        await db.insert(bundleStockLogs).values({
          bundleId: data.bundleId,
          actionType: 'disassemble',
          qtyChange: returnQty,
          stockBefore: currentStock,
          stockAfter: newStock,
          affectedProducts: item.productName,
          reason: data.reason,
          operator: data.operator || 'system',
          notes: `拆除组合退回: ${bundle.name} (-${data.disassembleQty}组)`,
        });
      }
    }
  }

  // Update bundle stock
  await db.update(productBundles)
    .set({ bundleStock: newBundleStock } as any)
    .where(eq(productBundles.id, data.bundleId));

  // Log bundle stock removal
  await db.insert(bundleStockLogs).values({
    bundleId: data.bundleId,
    actionType: 'disassemble',
    qtyChange: -data.disassembleQty,
    stockBefore: oldBundleStock,
    stockAfter: newBundleStock,
    affectedProducts: items.map(i => i.productName).join(', '),
    reason: data.reason,
    operator: data.operator || 'system',
    notes: `拆除组合库存 ${data.disassembleQty} 组`,
  });

  return { newBundleStock };
}

// Update bundle (only metadata - name, price, image, etc. NOT items if stock exists)
export async function updateBundle(id: number, data: {
  name?: string;
  nameEn?: string;
  keyword?: string;
  sellingPrice?: string;
  originalTotalPrice?: string;
  specialPrice?: string;
  coverImage?: string;
  description?: string;
  status?: string;
  showInMall?: boolean;
  weight?: string;
  internalNotes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.nameEn !== undefined) updateData.nameEn = data.nameEn;
  if (data.keyword !== undefined) updateData.keyword = data.keyword;
  if (data.sellingPrice !== undefined) updateData.sellingPrice = data.sellingPrice;
  if (data.originalTotalPrice !== undefined) updateData.originalTotalPrice = data.originalTotalPrice;
  if (data.specialPrice !== undefined) updateData.specialPrice = data.specialPrice;
  if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.showInMall !== undefined) updateData.showInMall = data.showInMall;
  if (data.weight !== undefined) updateData.weight = data.weight;
  if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
  
  await db.update(productBundles).set(updateData).where(eq(productBundles.id, id));
  return await getBundleById(id);
}

// Delete bundle (must have 0 stock)
export async function deleteBundle(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const bundle = (await db.select().from(productBundles).where(eq(productBundles.id, id)).limit(1))[0];
  if (!bundle) throw new Error("Bundle not found");
  if (bundle.bundleStock > 0) {
    throw new Error("组合包还有剩余库存，请先拆除组合后再删除。");
  }
  
  await db.delete(productBundleItems).where(eq(productBundleItems.bundleId, id));
  await db.delete(bundleStockLogs).where(eq(bundleStockLogs.bundleId, id));
  await db.delete(productBundles).where(eq(productBundles.id, id));
  return true;
}

// Get bundles for mall display
export async function getMallBundles() {
  const db = await getDb();
  if (!db) return [];
  const bundles = await db.select().from(productBundles)
    .where(and(
      eq(productBundles.status, 'active'),
      eq(productBundles.showInMall, true)
    ));
  
  const result = [];
  for (const bundle of bundles) {
    if (bundle.bundleStock <= 0) continue;
    const items = await db.select().from(productBundleItems).where(eq(productBundleItems.bundleId, bundle.id));
    result.push({ ...bundle, items: await attachBundleItemImages(db, items) });
  }
  return result;
}

// Deduct bundle stock on sale (only bundle stock, NOT single items)
export async function deductBundleStock(bundleId: number, qty: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const bundle = (await db.select().from(productBundles).where(eq(productBundles.id, bundleId)).limit(1))[0];
  if (!bundle) throw new Error("Bundle not found");
  if (bundle.bundleStock < qty) {
    throw new Error(`组合包库存不足 (剩余 ${bundle.bundleStock} 组)`);
  }
  
  const oldStock = bundle.bundleStock;
  const newStock = oldStock - qty;
  
  await db.update(productBundles)
    .set({ bundleStock: newStock } as any)
    .where(eq(productBundles.id, bundleId));
  
  await db.insert(bundleStockLogs).values({
    bundleId,
    actionType: 'sell',
    qtyChange: -qty,
    stockBefore: oldStock,
    stockAfter: newStock,
    operator: 'system',
    notes: `销售组合包 ×${qty}组`,
  });
  
  return { newStock };
}

// Get bundle profit analysis
export async function getBundleProfitAnalysis(filters?: {
  startDate?: string;
  endDate?: string;
}) {
  const db = await getDb();
  if (!db) return { totalSales: 0, totalCost: 0, totalProfit: 0, profitMargin: 0, bundles: [] };
  
  // Get all bundles
  const allBundles = await db.select().from(productBundles);
  
  // For now, return basic info - actual sales data would come from order_items with bundle references
  const result = allBundles.map((b: any) => ({
    id: b.id,
    name: b.name,
    keyword: b.keyword,
    sellingPrice: Number(b.sellingPrice),
    totalCost: Number(b.totalCost),
    bundleStock: b.bundleStock,
    profit: Number(b.sellingPrice) - Number(b.totalCost),
    profitMargin: Number(b.totalCost) > 0 
      ? ((Number(b.sellingPrice) - Number(b.totalCost)) / Number(b.sellingPrice) * 100).toFixed(2) 
      : '0',
  }));
  
  return {
    bundles: result,
    totalBundles: result.length,
  };
}

// ============================================================================
// V2.0 Phase 2: Live Room Products (直播商品管理)
// ============================================================================

// @realtime-broadcast: liveRooms
export async function getLiveRoomProducts(liveRoomId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(liveRoomProducts)
    .where(eq(liveRoomProducts.liveRoomId, liveRoomId))
    .orderBy(asc(liveRoomProducts.sortOrder));
  // Fetch product-level info from products table for grouping
  const productIds = Array.from(new Set(rows.map((r: any) => r.productId)));
  const productInfos: Record<number, any> = {};
  for (const pid of productIds) {
    const pRows = await db.select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      keyword: products.keyword,
      coverImageUrl: products.coverImageUrl,
      productMode: products.productMode,
      sellingPrice: products.sellingPrice,
      stockQuantity: products.stockQuantity,
      status: products.status,
      isPreOrder: products.isPreOrder,
      allowPresale: products.allowPresale,
      categoryId: products.categoryId,
      aiTags: products.aiTags,
      aiSellingPoints: products.aiSellingPoints,
    }).from(products).where(eq(products.id, pid)).limit(1);
    if (pRows.length > 0) {
      const p = pRows[0];
      // If coverImageUrl is null, try product_images table as fallback
      if (!p.coverImageUrl) {
        const imgRows = await db.select({ url: productImages.url })
          .from(productImages)
          .where(eq(productImages.productId, pid))
          .orderBy(asc(productImages.sortOrder))
          .limit(1);
        if (imgRows.length > 0) p.coverImageUrl = imgRows[0].url;
      }
      productInfos[pid] = p;
    }
  }
  // Single source of truth: only render records whose referenced product still exists.
  // Product identity, image, keyword, price, stock, status and AI metadata always come
  // directly from products; live_room_products keeps only live-specific controls.
  const grouped: Record<number, any> = {};
  for (const row of rows) {
    const pid = row.productId;
    const product = productInfos[pid];
    if (!product) continue;
    if (!grouped[pid]) {
      grouped[pid] = {
        productId: pid,
        productName: product.name,
        coverImageUrl: product.coverImageUrl,
        productMode: product.productMode,
        productSku: product.sku,
        productKeyword: product.keyword,
        productSellingPrice: product.sellingPrice,
        productStockQuantity: product.stockQuantity,
        productStatus: product.status,
        productIsPreOrder: product.isPreOrder,
        productAllowPresale: product.allowPresale,
        productCategoryId: product.categoryId,
        productAiTags: product.aiTags,
        productAiSellingPoints: product.aiSellingPoints,
        variations: [] as any[],
      };
    }
    grouped[pid].variations.push(row);
  }
  return Object.values(grouped);
}

// @realtime-broadcast: liveRooms
export async function addLiveRoomProduct(data: {
  liveRoomId: number;
  productId: number;
  variationId?: number | null;
  keyword: string;
  displayName: string;
  price: string | number;
  stock: number;
  imageUrl?: string | null;
  specImage?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get next sort order
  const existing = await db.select().from(liveRoomProducts)
    .where(eq(liveRoomProducts.liveRoomId, data.liveRoomId));
  const nextSort = existing.length;
  const result = await db.insert(liveRoomProducts).values({
    liveRoomId: data.liveRoomId,
    productId: data.productId,
    variationId: data.variationId || null,
    keyword: data.keyword,
    displayName: data.displayName,
    price: String(data.price),
    startStock: data.stock,
    reservedCount: 0,
    availableStock: data.stock,
    orderedCount: 0,
    allowPreorder: false,
    preorderCount: 0,
    status: "active",
    sortOrder: nextSort,
    imageUrl: data.imageUrl || null,
    specImage: data.specImage || null,
  });
  broadcastChange("liveRooms");
  return { id: result[0].insertId };
}

// @realtime-broadcast: liveRooms
export async function updateLiveRoomProduct(id: number, data: {
  keyword?: string;
  displayName?: string;
  price?: string | number;
  stock?: number;
  status?: "active" | "paused" | "sold_out";
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = {};
  if (data.keyword !== undefined) updateData.keyword = data.keyword;
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.price !== undefined) updateData.price = String(data.price);
  if (data.stock !== undefined) updateData.stock = data.stock;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  await db.update(liveRoomProducts).set(updateData).where(eq(liveRoomProducts.id, id));
  broadcastChange("liveRooms");
  return { success: true };
}

// @realtime-broadcast: liveRooms
export async function deleteLiveRoomProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(liveRoomProducts).where(eq(liveRoomProducts.id, id));
  broadcastChange("liveRooms");
  return { success: true };
}

// @realtime-broadcast: liveRooms,inventory
export async function adjustLiveRoomProductStock(id: number, data: {
  quantityChange: number;
  reason?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const product = await db.select().from(liveRoomProducts)
    .where(eq(liveRoomProducts.id, id)).limit(1);
  if (product.length === 0) throw new Error("Live room product not found");
  const newStartStock = Math.max(0, product[0].startStock + data.quantityChange);
  // Existing successful orders must remain reserved, but manual downward
  // adjustments must never expose a negative sellable quantity in the live UI.
  const newAvailableStock = Math.max(0, newStartStock - product[0].reservedCount);
  await db.update(liveRoomProducts).set({ startStock: newStartStock, availableStock: newAvailableStock })
    .where(eq(liveRoomProducts.id, id));
  // Sync main product stock (increase/decrease accordingly)
  if (product[0].variationId) {
    // For products with variations, update variation stock
    await db.update(productVariations)
      .set({ stockQuantity: sql`GREATEST(0, stockQuantity + ${data.quantityChange})` })
      .where(eq(productVariations.id, product[0].variationId));
  } else {
    // For products without variations, update product stock
    await db.update(products)
      .set({ stockQuantity: sql`GREATEST(0, stockQuantity + ${data.quantityChange})` })
      .where(eq(products.id, product[0].productId));
  }
  // Every live-stock change must be auditable in the main product inventory log.
  // The live UI uses reasons that differ from the strict inventory enum, so map
  // them to the nearest allowed audit category and retain the original reason.
  const liveReason = data.reason || "other";
  const adjustmentType = ({
    damaged: "human_damage",
    scrap: "lost",
    restock: "other",
    correction: "other",
    other: "other",
  } as Record<string, "quality_issue" | "plant_death" | "pest_disease" | "human_damage" | "unhealthy" | "lost" | "other">)[liveReason] || "other";
  await db.insert(inventoryAdjustments).values({
    productId: product[0].productId,
    adjustmentType,
    quantityChange: data.quantityChange,
    unitCost: "0",
    reason: `直播库存调整｜直播商品 #${id}｜原因：${liveReason}`,
    remark: "由直播管理库存调整同步写入",
    adjustedBy: "live_management",
  });
  broadcastChanges(["liveRooms", "inventory"]);
  return { success: true, startStock: newStartStock, availableStock: newAvailableStock };
}

// @realtime-broadcast: liveRooms
export async function reorderLiveRoomProducts(liveRoomId: number, orderedIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(liveRoomProducts).set({ sortOrder: i })
      .where(eq(liveRoomProducts.id, orderedIds[i]));
  }
  broadcastChange("liveRooms");
  return { success: true };
}

// Get live room performance stats (喊单业绩)
export async function getLiveRoomStats(liveRoomId: number) {
  const db = await getDb();
  if (!db) return { productCount: 0, orderCount: 0, totalItems: 0, totalRevenue: "0.00" };
  const products = await db.select().from(liveRoomProducts)
    .where(eq(liveRoomProducts.liveRoomId, liveRoomId));
  const productCount = products.length;
  const totalOrdered = products.reduce((sum: number, p: any) => sum + Number(p.orderedCount || 0), 0);
  const totalRevenue = products.reduce((sum: number, p: any) =>
    sum + Number(p.orderedCount || 0) * Number(p.price || 0), 0);
  // Count distinct orders from live_order_captures linked to this room
  const captures = await db.select().from(liveOrderCaptures)
    .where(eq(liveOrderCaptures.status, "order_created"));
  const orderCount = captures.filter((c: any) => c.orderId != null).length;
  return {
    productCount,
    orderCount,
    totalItems: totalOrdered,
    totalRevenue: totalRevenue.toFixed(2),
  };
}

// Batch stats for list view
export async function getLiveRoomStatsBatch(liveRoomIds: number[]) {
  const db = await getDb();
  if (!db || liveRoomIds.length === 0) return {};
  const result: Record<number, any> = {};
  for (const roomId of liveRoomIds) {
    const products = await db.select().from(liveRoomProducts)
      .where(eq(liveRoomProducts.liveRoomId, roomId));
    const productCount = products.length;
    const totalOrdered = products.reduce((sum: number, p: any) => sum + Number(p.orderedCount || 0), 0);
    const totalRevenue = products.reduce((sum: number, p: any) =>
      sum + Number(p.orderedCount || 0) * Number(p.price || 0), 0);
    result[roomId] = {
      productCount,
      orderCount: 0, // Will be enriched from captures if needed
      totalItems: totalOrdered,
      totalRevenue: totalRevenue.toFixed(2),
    };
  }
  return result;
}

// Generate keyword copy text for a live room product
export async function generateKeywordCopyText(liveRoomProductId: number, liveCommentFooter?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const product = await db.select().from(liveRoomProducts)
    .where(eq(liveRoomProducts.id, liveRoomProductId)).limit(1);
  if (product.length === 0) throw new Error("Product not found");
  const p = product[0];
  // Fetch canonical product data from products table
  const pRows = await db.select().from(products).where(eq(products.id, p.productId)).limit(1);
  const productData = pRows.length > 0 ? pRows[0] as any : null;
  const keyword = productData?.keyword || p.keyword || p.displayName;
  const name = productData?.name || p.displayName;
  // Check if product has variants (same productId, different variationId)
  const siblings = await db.select().from(liveRoomProducts)
    .where(eq(liveRoomProducts.liveRoomId, p.liveRoomId));
  const sameProduct = siblings.filter((s: any) => s.productId === p.productId);
  const footer = liveCommentFooter || "👇 留言关键词即可自动下单";
  if (sameProduct.length <= 1) {
    // No variants — single product format
    return `🌸 ${name}\n💰 RM${Number(p.price).toFixed(0)}\n📝 关键词：\n${keyword}+1\n\n${footer}`;
  }
  // Has variants — check if same price or different prices
  const allSamePrice = sameProduct.every((s: any) => Number(s.price) === Number(p.price));
  const lines = sameProduct.map((s: any) => {
    const colorMatch = s.displayName.match(/[🔴❤️🩷💛💚💙🟣⚪️⚫️🟤]+\s*(\S+)/);
    const colorName = colorMatch ? colorMatch[1] : s.displayName;
    if (allSamePrice) {
      return `${colorName}｜RM${Number(s.price).toFixed(0)}｜${s.keyword}+1`;
    }
    return `${colorName}｜RM${Number(s.price).toFixed(0)}｜${s.keyword}+1`;
  });
  // Use the base product name (without variant suffix)
  const baseName = name.replace(/[🔴❤️🩷💛💚💙🟣⚪️⚫️🟤]+\s*\S+/, "").trim() || name;
  return `🌸 ${baseName}\n\n${lines.join("\n")}\n\n${footer}`;
}

// Get live room orders (orders created from this live room's captures)
export async function getLiveRoomOrders(liveRoomId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  // Get orders directly linked to this live room
  const orderRows = await db.select().from(orders)
    .where(eq(orders.liveRoomId, liveRoomId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  const result: any[] = [];
  for (const order of orderRows) {
    const customerRows = await db.select().from(customers)
      .where(eq(customers.id, order.customerId)).limit(1);
    const itemRows = await db.select().from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    result.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      secureToken: order.secureToken,
      customerId: order.customerId,
      customerName: customerRows[0]?.name || '',
      facebookName: customerRows[0]?.facebookName || '',
      facebookId: customerRows[0]?.facebookId || '',
      items: itemRows.map((item: any) => ({
        productName: item.productName,
        productType: item.productType,
        variationName: item.variationName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
        priceType: item.priceType,
        originalUnitPrice: item.originalUnitPrice,
      })),
      totalAmount: Number(order.totalAmount),
      physicalStatus: order.physicalStatus,
      paymentStatus: (order as any).paymentStatus,
      orderNature: (order as any).orderNature,
      createdAt: order.createdAt,
    });
  }
  return result;
}

// Group orders by product for the live control center order panel
export async function getLiveRoomOrdersByProduct(liveRoomId: number) {
  const db = await getDb();
  if (!db) return [];
  const orderRows = await db.select().from(orders)
    .where(eq(orders.liveRoomId, liveRoomId))
    .orderBy(desc(orders.createdAt));
  // Build product → variation → orders mapping
  const productMap: Record<string, any> = {};
  for (const order of orderRows) {
    const itemRows = await db.select().from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const customerRows = await db.select().from(customers)
      .where(eq(customers.id, order.customerId)).limit(1);
    const customerName = customerRows[0]?.name || '';
    for (const item of itemRows) {
      const key = `${item.productName}__${item.variationName || ''}`;
      if (!productMap[key]) {
        productMap[key] = {
          productName: item.productName,
          variationName: item.variationName || '',
          orders: [] as any[],
          totalQuantity: 0,
        };
      }
      productMap[key].orders.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        physicalStatus: order.physicalStatus,
        paymentStatus: (order as any).paymentStatus,
      });
      productMap[key].totalQuantity += item.quantity;
    }
  }
  return Object.values(productMap);
}

// ============================================================================
// Live AI Flows (直播 AI 客服) - CRUD + Semantic Matching
// ============================================================================

// List all AI flows (sorted by sortOrder)
export async function getLiveAiFlows() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(liveAiFlows)
    .orderBy(asc(liveAiFlows.sortOrder), desc(liveAiFlows.createdAt));
  return result;
}

// Get single AI flow by id
export async function getLiveAiFlowById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(liveAiFlows).where(eq(liveAiFlows.id, id)).limit(1);
  return result[0] || null;
}

// Create new AI flow
export async function createLiveAiFlow(data: {
  name: string;
  triggerKeywords: string; // JSON array
  replyContent: string;
  isEnabled?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get max sortOrder
  const allFlows = await db.select().from(liveAiFlows);
  const maxSort = allFlows.reduce((max, f) => Math.max(max, f.sortOrder), 0);
  const result = await db.insert(liveAiFlows).values({
    name: data.name,
    triggerKeywords: data.triggerKeywords,
    replyContent: data.replyContent,
    isEnabled: data.isEnabled ?? true,
    sortOrder: maxSort + 1,
  });
  broadcastChange("liveAiFlows");
  return { id: result[0].insertId };
}

// Update AI flow
export async function updateLiveAiFlow(id: number, data: {
  name?: string;
  triggerKeywords?: string;
  replyContent?: string;
  isEnabled?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.triggerKeywords !== undefined) updateData.triggerKeywords = data.triggerKeywords;
  if (data.replyContent !== undefined) updateData.replyContent = data.replyContent;
  if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
  await db.update(liveAiFlows).set(updateData).where(eq(liveAiFlows.id, id));
  broadcastChange("liveAiFlows");
  return { success: true };
}

// Delete AI flow
export async function deleteLiveAiFlow(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(liveAiFlows).where(eq(liveAiFlows.id, id));
  broadcastChange("liveAiFlows");
  return { success: true };
}

// Duplicate AI flow
export async function duplicateLiveAiFlow(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const original = await db.select().from(liveAiFlows).where(eq(liveAiFlows.id, id)).limit(1);
  if (original.length === 0) throw new Error("Flow not found");
  const orig = original[0];
  const allFlows = await db.select().from(liveAiFlows);
  const maxSort = allFlows.reduce((max, f) => Math.max(max, f.sortOrder), 0);
  const result = await db.insert(liveAiFlows).values({
    name: `${orig.name} (副本)`,
    triggerKeywords: orig.triggerKeywords,
    replyContent: orig.replyContent,
    isEnabled: false, // Duplicated flows start disabled
    sortOrder: maxSort + 1,
  });
  broadcastChange("liveAiFlows");
  return { id: result[0].insertId };
}

// Reorder AI flows
export async function reorderLiveAiFlows(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (let i = 0; i < ids.length; i++) {
    await db.update(liveAiFlows).set({ sortOrder: i + 1 }).where(eq(liveAiFlows.id, ids[i]));
  }
  broadcastChange("liveAiFlows");
  return { success: true };
}

export interface LiveAiFlowMatch {
  flowId: number;
  reply: string;
  matchedKeyword: string;
  matchType: "keyword" | "semantic";
}

// Semantic matching: check if a comment message matches any AI flow.
// Returns the true flow identity together with the reply, so callers can log real execution.
export async function matchLiveAiFlowWithMetadata(commentMessage: string): Promise<LiveAiFlowMatch | null> {
  const db = await getDb();
  if (!db) return null;
  const flows = await db.select().from(liveAiFlows)
    .where(eq(liveAiFlows.isEnabled, true))
    .orderBy(asc(liveAiFlows.sortOrder));

  const lowerMsg = commentMessage.toLowerCase().trim();
  for (const flow of flows) {
    try {
      const keywords: string[] = JSON.parse(flow.triggerKeywords);
      for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase().trim();
        if (lowerMsg.includes(lowerKeyword)) {
          return { flowId: flow.id, reply: flow.replyContent, matchedKeyword: keyword, matchType: "keyword" };
        }
        const msgTokens = lowerMsg.split(/\s+/).filter((t: string) => t.length > 0);
        const keywordTokens = lowerKeyword.split(/\s+/).filter((t: string) => t.length > 0);
        if (keywordTokens.length > 0 && msgTokens.length > 0) {
          const overlap = keywordTokens.filter((t: string) => msgTokens.some((m: string) => m.includes(t) || t.includes(m)));
          if (overlap.length === keywordTokens.length) {
            return { flowId: flow.id, reply: flow.replyContent, matchedKeyword: keyword, matchType: "semantic" };
          }
        }
      }
    } catch {
      // Ignore malformed flow keywords and continue to later enabled flows.
    }
  }
  return null;
}

// Compatibility wrapper for existing callers that only need a reply string.
export async function matchLiveAiFlow(commentMessage: string): Promise<string | null> {
  const match = await matchLiveAiFlowWithMetadata(commentMessage);
  return match?.reply ?? null;
}
// ============================================================================
// V4: Wholesale & Agent Report helpers
// ============================================================================

export async function getWholesaleAgentReport(dateRange: { start: Date; end: Date }) {
  const db = await getDb();
  if (!db) return { wholesale: { orderCount: 0, totalAmount: "0", paidAmount: "0" }, agent: { orderCount: 0, totalAmount: "0", paidAmount: "0" }, byCustomer: [] };

  // Wholesale orders
  const wholesaleOrders = await db.select({
    count: sql`COUNT(*)`,
    totalAmount: sql`COALESCE(SUM(${orders.totalAmount}), 0)`,
    paidAmount: sql`COALESCE(SUM(${orders.paidAmount}), 0)`,
  }).from(orders)
    .where(and(
      eq((orders as any).salesChannel, "wholesale"),
      gte(orders.createdAt, dateRange.start),
      sql`${orders.createdAt} <= ${dateRange.end}`
    ));

  // Agent orders
  const agentOrders = await db.select({
    count: sql`COUNT(*)`,
    totalAmount: sql`COALESCE(SUM(${orders.totalAmount}), 0)`,
    paidAmount: sql`COALESCE(SUM(${orders.paidAmount}), 0)`,
  }).from(orders)
    .where(and(
      eq((orders as any).salesChannel, "agent"),
      gte(orders.createdAt, dateRange.start),
      sql`${orders.createdAt} <= ${dateRange.end}`
    ));

  // By customer breakdown
  const byCustomer = await db.select({
    customerId: orders.customerId,
    customerName: customers.name,
    customerType: (customers as any).customerType,
    orderCount: sql`COUNT(*)`,
    totalAmount: sql`COALESCE(SUM(${orders.totalAmount}), 0)`,
    paidAmount: sql`COALESCE(SUM(${orders.paidAmount}), 0)`,
  }).from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(
      sql`${(orders as any).salesChannel} IN ('wholesale', 'agent')`,
      gte(orders.createdAt, dateRange.start),
      sql`${orders.createdAt} <= ${dateRange.end}`
    ))
    .groupBy(orders.customerId, customers.name, (customers as any).customerType)
    .orderBy(desc(sql`SUM(${orders.totalAmount})`));

  return {
    wholesale: {
      orderCount: wholesaleOrders[0]?.count || 0,
      totalAmount: String(wholesaleOrders[0]?.totalAmount || "0"),
      paidAmount: String(wholesaleOrders[0]?.paidAmount || "0"),
    },
    agent: {
      orderCount: agentOrders[0]?.count || 0,
      totalAmount: String(agentOrders[0]?.totalAmount || "0"),
      paidAmount: String(agentOrders[0]?.paidAmount || "0"),
    },
    byCustomer: byCustomer.map((r: any) => ({
      ...r,
      totalAmount: String(r.totalAmount),
      paidAmount: String(r.paidAmount),
    })),
  };
}

export async function getCustomerTypeStats() {
  const db = await getDb();
  if (!db) return { retail: 0, wholesale: 0, agent: 0, total: 0 };

  const result = await db.select({
    customerType: (customers as any).customerType,
    count: sql`COUNT(*)`,
  }).from(customers)
    .groupBy((customers as any).customerType);

  const stats: any = { retail: 0, wholesale: 0, agent: 0, total: 0 };
  for (const r of result as any[]) {
    stats[r.customerType || "retail"] = r.count;
    stats.total += r.count;
  }
  return stats;
}

// ============================================================================
// Phase 3: Live Management - Product Search, Preorder, Stock Calculation
// ============================================================================

// @realtime-broadcast: liveRooms
export async function searchProductsForLiveRoom(liveRoomId: number, query: string, categoryId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const likePattern = `%${query}%`;
  let whereClause = sql`(${products.name} LIKE ${likePattern} OR ${products.sku} LIKE ${likePattern} OR ${products.keyword} LIKE ${likePattern} OR ${products.keywords} LIKE ${likePattern})`;
  if (categoryId) {
    whereClause = sql`(${products.name} LIKE ${likePattern} OR ${products.sku} LIKE ${likePattern} OR ${products.keyword} LIKE ${likePattern} OR ${products.keywords} LIKE ${likePattern}) AND ${products.categoryId} = ${categoryId}`;
  }
  // Get already added productIds for this live room
  const existing = await db.select({ productId: liveRoomProducts.productId }).from(liveRoomProducts)
    .where(eq(liveRoomProducts.liveRoomId, liveRoomId));
  const addedIds = new Set(existing.map((r: any) => r.productId));
  const results = await db.select({
    id: products.id,
    name: products.name,
    sku: products.sku,
    keyword: products.keyword,
    keywords: products.keywords,
    coverImageUrl: products.coverImageUrl,
    sellingPrice: products.sellingPrice,
    stockQuantity: products.stockQuantity,
    reservedQuantity: products.reservedQuantity,
    categoryId: products.categoryId,
    productStatus: products.status,
    isPreOrder: products.isPreOrder,
    aiTags: products.aiTags,
    aiSellingPoints: products.aiSellingPoints,
    hasVariants: sql`EXISTS(SELECT 1 FROM ${variants} v WHERE v.productId = ${products.id})`,
  }).from(products)
    .where(whereClause)
    .limit(20);
  // Add alreadyAdded flag
  return results.map((r: any) => ({ ...r, alreadyAdded: addedIds.has(r.id) }));
}

// @realtime-broadcast: liveRooms
export async function batchAddProductsToLiveRoom(liveRoomId: number, items: Array<{
  productId: number;
  variationId?: number;
  livePrice?: number; // optional override; if not provided, use product sellingPrice
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(liveRoomProducts)
    .where(eq(liveRoomProducts.liveRoomId, liveRoomId));
  const nextSort = existing.length;
  const existingProductIds = new Set(existing.map((r: any) => r.productId));
  const inserted: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const data = items[i];
    // Skip if already added
    if (existingProductIds.has(data.productId)) continue;
    // Fetch product data from products table
    const pRows = await db.select().from(products).where(eq(products.id, data.productId)).limit(1);
    if (pRows.length === 0) continue;
    const p = pRows[0] as any;
    const price = data.livePrice != null ? String(data.livePrice) : String(p.sellingPrice || 0);
    const result = await db.insert(liveRoomProducts).values({
      liveRoomId,
      productId: data.productId,
      variationId: data.variationId || null,
      keyword: p.keyword || p.name,
      displayName: p.name,
      price,
      startStock: Number(p.stockQuantity || 0),
      reservedCount: 0,
      availableStock: Number(p.stockQuantity || 0),
      orderedCount: 0,
      allowPreorder: Boolean(p.allowPresale),
      preorderCount: 0,
      status: "active",
      sortOrder: nextSort + i,
      imageUrl: p.coverImageUrl || null,
      specImage: null,
    });
    inserted.push(result[0].insertId);
  }
  broadcastChange("liveRooms");
  return { insertedIds: inserted, count: inserted.length };
}

// @realtime-broadcast: liveRooms
export async function toggleLiveRoomProductPreorder(id: number, allowPreorder: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const roomProduct = await db.select({ productId: liveRoomProducts.productId })
    .from(liveRoomProducts).where(eq(liveRoomProducts.id, id)).limit(1);
  if (!roomProduct[0]) throw new Error("Live room product not found");
  // 直播中的开关即更新商品主档，其他下单入口立即遵循相同预售规则。
  await db.update(products).set({ allowPresale: allowPreorder, allowOversold: allowPreorder })
    .where(eq(products.id, roomProduct[0].productId));
  await db.update(liveRoomProducts).set({ allowPreorder })
    .where(eq(liveRoomProducts.productId, roomProduct[0].productId));
  broadcastChange("liveRooms");
  return { success: true };
}

// @realtime-broadcast: liveRooms
export async function getLiveRoomProductDetails(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const product = await db.select().from(liveRoomProducts)
    .where(eq(liveRoomProducts.id, id)).limit(1);
  if (product.length === 0) throw new Error("Live room product not found");
  return product[0];
}

// @realtime-broadcast: liveRooms
export async function updateLiveRoomProductStock(id: number, newStartStock: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const product = await db.select().from(liveRoomProducts)
    .where(eq(liveRoomProducts.id, id)).limit(1);
  if (product.length === 0) throw new Error("Live room product not found");
  const diff = newStartStock - product[0].startStock;
  const newAvailableStock = newStartStock - product[0].reservedCount;
  await db.update(liveRoomProducts).set({
    startStock: newStartStock,
    availableStock: newAvailableStock,
  }).where(eq(liveRoomProducts.id, id));
  if (diff < 0 && reason) {
    await db.insert(inventoryAdjustments).values({
      productId: product[0].productId,
      adjustmentType: reason as any,
      quantityChange: diff,
      unitCost: "0",
      reason: `Live room stock adjustment (ID: ${id})`,
      adjustedBy: "live_management",
    });
  }
  broadcastChanges(["liveRooms", "inventory"]);
  return { success: true, startStock: newStartStock, availableStock: newAvailableStock };
}

// ============================================================================
// Phase 3: Live Comments (直播留言记录)
// ============================================================================

// @realtime-broadcast: liveRooms
export async function recordLiveComment(data: {
  liveRoomId: number;
  commentId?: string;
  commenterName: string;
  commenterPsid?: string;
  commenterAvatarUrl?: string;
  commentMessage: string;
  parsedKeyword?: string;
  parsedQuantity?: number;
  matchResult?: string;
  matchedProductId?: number;
  matchedProductName?: string;
  matchedLiveRoomProductId?: number;
  orderId?: number;
  orderNumber?: string;
  messengerStatus?: string;
  aiFlowId?: number;
  aiReplyContent?: string;
  commentDate?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check for duplicate commentId
  if (data.commentId) {
    const existing = await db.select({ id: liveComments.id }).from(liveComments)
      .where(eq(liveComments.commentId, data.commentId)).limit(1);
    if (existing.length > 0) return { id: existing[0].id, duplicate: true };
  }
  const result = await db.insert(liveComments).values({
    liveRoomId: data.liveRoomId,
    commentId: data.commentId || null,
    commenterName: data.commenterName,
    commenterPsid: data.commenterPsid || null,
    commenterAvatarUrl: data.commenterAvatarUrl || null,
    commentMessage: data.commentMessage,
    parsedKeyword: data.parsedKeyword || null,
    parsedQuantity: data.parsedQuantity || 0,
    matchResult: (data.matchResult as any) || "no_match",
    matchedProductId: data.matchedProductId || null,
    matchedProductName: data.matchedProductName || null,
    matchedLiveRoomProductId: data.matchedLiveRoomProductId || null,
    orderId: data.orderId || null,
    orderNumber: data.orderNumber || null,
    messengerStatus: (data.messengerStatus as any) || "not_needed",
    aiFlowId: data.aiFlowId || null,
    aiReplyContent: data.aiReplyContent || null,
    commentDate: data.commentDate || null,
  });
  broadcastChange("liveRooms");
  return { id: result[0].insertId, duplicate: false };
}

export async function getLiveComments(liveRoomId: number, filters?: {
  search?: string;
  matchResult?: string;
  messengerStatus?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [eq(liveComments.liveRoomId, liveRoomId)];
  if (filters?.search) {
    const likePattern = `%${filters.search}%`;
    conditions.push(sql`(commenterName LIKE ${likePattern} OR commentMessage LIKE ${likePattern} OR parsedKeyword LIKE ${likePattern} OR orderNumber LIKE ${likePattern} OR EXISTS(SELECT 1 FROM ${liveRoomProducts} lrp WHERE lrp.id = ${liveComments}.matchedLiveRoomProductId AND lrp.displayName LIKE ${likePattern}))`);
  }
  if (filters?.matchResult && filters.matchResult !== "all") {
    conditions.push(eq(liveComments.matchResult, filters.matchResult as any));
  }
  if (filters?.messengerStatus && filters.messengerStatus !== "all") {
    conditions.push(eq(liveComments.messengerStatus, filters.messengerStatus as any));
  }
  const limit = filters?.limit || 100;
  const offset = filters?.offset || 0;
  const results = await db.select().from(liveComments)
    .where(and(...conditions))
    .orderBy(desc(liveComments.createdAt)).limit(limit).offset(offset);

  const psids = Array.from(new Set(results.map((comment) => comment.commenterPsid).filter((psid): psid is string => Boolean(psid))));
  if (psids.length === 0) {
    return results.map((comment) => ({ ...comment, customerId: null, isCustomerBlacklisted: false }));
  }

  const customerRows = await db.select({
    id: customers.id,
    messengerId: customers.messengerId,
    isBlacklisted: customers.isBlacklisted,
  }).from(customers).where(inArray(customers.messengerId, psids));
  const customersByPsid = new Map(customerRows
    .filter((customer) => customer.messengerId)
    .map((customer) => [customer.messengerId as string, customer]));

  return results.map((comment) => {
    const customer = comment.commenterPsid ? customersByPsid.get(comment.commenterPsid) : undefined;
    return {
      ...comment,
      customerId: customer?.id || null,
      isCustomerBlacklisted: Boolean(customer?.isBlacklisted),
    };
  });
}

export async function getLiveCommentStats(liveRoomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const stats = await db.select({
    matchResult: liveComments.matchResult,
    count: sql`count(*)`,
  }).from(liveComments)
    .where(eq(liveComments.liveRoomId, liveRoomId))
    .groupBy(liveComments.matchResult);
  const messengerStats = await db.select({
    messengerStatus: liveComments.messengerStatus,
    count: sql`count(*)`,
  }).from(liveComments)
    .where(eq(liveComments.liveRoomId, liveRoomId))
    .groupBy(liveComments.messengerStatus);
  return { matchResultStats: stats, messengerStats };
}

// @realtime-broadcast: liveRooms
export async function updateLiveCommentMessengerStatus(commentId: number, status: string, error?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(liveComments).set({
    messengerStatus: status as any,
    messengerError: error || null,
  }).where(eq(liveComments.id, commentId));
  broadcastChange("liveRooms");
  return { success: true };
}

// @realtime-broadcast: liveRooms
export async function markLiveCommentHandled(commentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(liveComments).set({ isHandled: true })
    .where(eq(liveComments.id, commentId));
  broadcastChange("liveRooms");
  return { success: true };
}

// ============================================================================
// Phase 3: Live Room Report (直播报告)
// ============================================================================

export async function getLiveRoomReport(liveRoomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Total comments
  const totalComments = await db.select({ count: sql`count(*)` })
    .from(liveComments).where(eq(liveComments.liveRoomId, liveRoomId));
  // Matched comments (valid keywords)
  const matchedComments = await db.select({ count: sql`count(*)` })
    .from(liveComments).where(sql`liveRoomId = ${liveRoomId} AND matchResult = 'matched'`);
  // Orders for this live room
  const ordersData = await db.select({
    count: sql`count(*)`,
    totalAmount: sql`COALESCE(SUM(totalAmount), 0)`,
    paidCount: sql`SUM(CASE WHEN paymentStatus = 'paid' THEN 1 ELSE 0 END)`,
    cancelledCount: sql`SUM(CASE WHEN physicalStatus = 'cancelled' THEN 1 ELSE 0 END)`,
    refundedCount: sql`SUM(CASE WHEN paymentStatus = 'refunded' THEN 1 ELSE 0 END)`,
  }).from(orders).where(eq(orders.liveRoomId, liveRoomId));
  // Product sales
  const productSales = await db.select({
    productName: liveRoomProducts.displayName,
    keyword: liveRoomProducts.keyword,
    orderedCount: liveRoomProducts.orderedCount,
    price: liveRoomProducts.price,
    revenue: sql`${liveRoomProducts.orderedCount} * ${liveRoomProducts.price}`,
  }).from(liveRoomProducts)
    .where(eq(liveRoomProducts.liveRoomId, liveRoomId))
    .orderBy(desc(liveRoomProducts.orderedCount));
  // New customers (customers whose first order was from this live room)
  const newCustomers = await db.select({ count: sql`count(DISTINCT customerId)` })
    .from(orders).where(sql`liveRoomId = ${liveRoomId} AND customerId NOT IN (
      SELECT customerId FROM orders WHERE liveRoomId != ${liveRoomId} AND createdAt < (SELECT MIN(createdAt) FROM orders WHERE liveRoomId = ${liveRoomId})
    )`);
  // Messenger success rate
  const messengerSent = await db.select({ count: sql`count(*)` })
    .from(liveComments).where(sql`liveRoomId = ${liveRoomId} AND messengerStatus = 'sent'`);
  const messengerFailed = await db.select({ count: sql`count(*)` })
    .from(liveComments).where(sql`liveRoomId = ${liveRoomId} AND messengerStatus = 'failed'`);
  // Total items sold (sum of orderedCount across all room products)
  const totalItems = await db.select({ total: sql`COALESCE(SUM(orderedCount), 0)` })
    .from(liveRoomProducts).where(eq(liveRoomProducts.liveRoomId, liveRoomId));
  // Capture count (捉单数 = matched comments)
  const captureCount = matchedComments[0]?.count || 0;
  // Get live room data for start/end times
  const roomData = await db.select({
    liveStartTime: liveRooms.liveStartTime,
    liveEndTime: liveRooms.liveEndTime,
  }).from(liveRooms).where(eq(liveRooms.id, liveRoomId)).limit(1);
  const startTime = roomData[0]?.liveStartTime;
  const endTime = roomData[0]?.liveEndTime;
  // Calculate duration in minutes
  let durationMinutes = 0;
  if (startTime && endTime) {
    durationMinutes = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);
  }
  return {
    totalComments: Number(totalComments[0]?.count || 0),
    matchedComments: Number(matchedComments[0]?.count || 0),
    captureCount: Number(captureCount),
    totalOrders: Number(ordersData[0]?.count || 0),
    totalItems: Number(totalItems[0]?.total || 0),
    totalRevenue: Number(ordersData[0]?.totalAmount || 0),
    paidOrders: Number(ordersData[0]?.paidCount || 0),
    cancelledOrders: Number(ordersData[0]?.cancelledCount || 0),
    refundedOrders: Number(ordersData[0]?.refundedCount || 0),
    productSales: productSales.map((p: any) => ({
      ...p,
      revenue: Number(p.revenue),
    })),
    newCustomers: Number(newCustomers[0]?.count || 0),
    messengerSent: Number(messengerSent[0]?.count || 0),
    messengerFailed: Number(messengerFailed[0]?.count || 0),
    liveStartTime: startTime || null,
    liveEndTime: endTime || null,
    durationMinutes,
  };
}

// ============================================================================
// V4.0: AI Customer Service — Chat & Handover DB Helpers
// ============================================================================

// Get or create conversation for a customer on a platform
export async function getOrCreateConversation(customerId: number | null, platform: string, platformId: string): Promise<any> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Try to find existing conversation
  const existing = await db.select().from(chatConversations)
    .where(and(
      eq(chatConversations.platform, platform as any),
      eq(chatConversations.platformId, platformId)
    ))
    .limit(1);
  
  if (existing.length > 0) return existing[0];
  
  // Create new conversation
  await db.insert(chatConversations).values({
    customerId,
    platform: platform as any,
    platformId,
    aiReplyEnabled: true,
    unreadCount: 0,
    handoverStatus: "none",
  });
  
  const created = await db.select().from(chatConversations)
    .where(and(
      eq(chatConversations.platform, platform as any),
      eq(chatConversations.platformId, platformId)
    ))
    .limit(1);
  
  return created[0];
}

/** Get an existing chat conversation by primary key for AI delivery retries. */
export async function getChatConversationById(conversationId: number): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;
  const [conversation] = await db.select().from(chatConversations)
    .where(eq(chatConversations.id, conversationId))
    .limit(1);
  return conversation ?? null;
}

// List conversations with filters
export async function listChatConversations(filters: {
  platform?: string;
  unreadOnly?: boolean;
  needsHuman?: boolean;
  aiDisabled?: boolean;
  hasOrder?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select({
    id: chatConversations.id,
    customerId: chatConversations.customerId,
    platform: chatConversations.platform,
    platformId: chatConversations.platformId,
    lastMessagePreview: chatConversations.lastMessagePreview,
    lastMessageAt: chatConversations.lastMessageAt,
    unreadCount: chatConversations.unreadCount,
    aiReplyEnabled: chatConversations.aiReplyEnabled,
    handoverStatus: chatConversations.handoverStatus,
    handoverClaimedBy: chatConversations.handoverClaimedBy,
    createdAt: chatConversations.createdAt,
    // Customer info
    customerName: customers.name,
    customerPhone: customers.phoneNumber,
    whatsappPhone: customers.whatsappPhone,
    facebookName: customers.facebookName,
    messengerId: customers.messengerId,
    customerType: customers.customerType,
    creditBalance: customers.creditBalance,
  })
  .from(chatConversations)
  .leftJoin(customers, eq(chatConversations.customerId, customers.id))
  .$dynamic();
  
  const conditions: any[] = [];
  
  if (filters.platform && filters.platform !== "all") {
    conditions.push(eq(chatConversations.platform, filters.platform as any));
  }
  if (filters.unreadOnly) {
    conditions.push(sql`${chatConversations.unreadCount} > 0`);
  }
  if (filters.needsHuman) {
    conditions.push(eq(chatConversations.handoverStatus, "pending"));
  }
  if (filters.aiDisabled) {
    conditions.push(eq(chatConversations.aiReplyEnabled, false));
  }
  if (filters.search) {
    conditions.push(or(
      like(customers.name, `%${filters.search}%`),
      like(customers.whatsappPhone, `%${filters.search}%`),
      like(customers.facebookName, `%${filters.search}%`),
      like(customers.messengerId, `%${filters.search}%`),
      like(chatConversations.platformId, `%${filters.search}%`)
    ));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  
  return await query
    .orderBy(desc(chatConversations.lastMessageAt))
    .limit(limit)
    .offset(offset);
}

// Get messages for a conversation
export async function getChatMessages(conversationId: number, limit: number = 100, offset: number = 0): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(asc(chatMessages.createdAt))
    .limit(limit)
    .offset(offset);
}

// Add a message to a conversation
export async function addChatMessage(data: {
  conversationId: number;
  senderType: string;
  senderName?: string;
  messageType?: string;
  content?: string;
  mediaUrl?: string;
  platformMessageId?: string;
  status?: string;
  errorMessage?: string;
  aiResponseSource?: string;
}): Promise<any> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [insertResult] = await db.insert(chatMessages).values({
    conversationId: data.conversationId,
    senderType: data.senderType as any,
    senderName: data.senderName,
    messageType: (data.messageType || "text") as any,
    content: data.content,
    mediaUrl: data.mediaUrl,
    platformMessageId: data.platformMessageId,
    status: (data.status || "sent") as any,
    errorMessage: data.errorMessage,
    aiResponseSource: data.aiResponseSource,
  });
  const messageId = (insertResult as any).insertId ?? null;
  
  // Update conversation's last message preview
  const preview = (data.content || "").substring(0, 100);
  await db.update(chatConversations)
    .set({
      lastMessagePreview: preview,
      lastMessageAt: new Date(),
      unreadCount: data.senderType === "customer" ? sql`${chatConversations.unreadCount} + 1` : sql`${chatConversations.unreadCount}`,
    })
    .where(eq(chatConversations.id, data.conversationId));
  
  broadcastChange("chat" as any);
  return { success: true, messageId };
}

/** Synchronize a stored AI chat message after a delivery retry completes. */
export async function updateChatMessageDelivery(
  messageId: number,
  updates: { status: "sent" | "failed"; platformMessageId?: string | null; errorMessage?: string | null },
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(chatMessages)
    .set({
      status: updates.status,
      platformMessageId: updates.platformMessageId,
      errorMessage: updates.errorMessage,
    })
    .where(eq(chatMessages.id, messageId));
  broadcastChange("chat" as any);
}

// Mark conversation messages as read (reset unread count)
export async function markConversationRead(conversationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(chatConversations)
    .set({ unreadCount: 0 })
    .where(eq(chatConversations.id, conversationId));
  
  broadcastChange("chat" as any);
}

// Toggle AI reply for a conversation
export async function toggleConversationAI(conversationId: number, enabled: boolean, operatorName: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(chatConversations)
    .set({
      aiReplyEnabled: enabled,
      aiToggledBy: operatorName,
      aiToggledAt: new Date(),
    })
    .where(eq(chatConversations.id, conversationId));
  
  broadcastChange("chat" as any);
}

// Resume AI reply for a conversation (after human handover)
export async function resumeConversationAI(conversationId: number, operatorName: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(chatConversations)
    .set({
      handoverStatus: "none",
      handoverClaimedBy: null,
      handoverClaimedAt: null,
      aiReplyEnabled: true,
      aiToggledBy: operatorName,
      aiToggledAt: new Date(),
    })
    .where(eq(chatConversations.id, conversationId));
  
  broadcastChange("chat" as any);
}

// Human handover — claim a conversation
export async function claimHandover(conversationId: number, operatorName: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Update conversation
  await db.update(chatConversations)
    .set({
      handoverStatus: "claimed",
      handoverClaimedBy: operatorName,
      handoverClaimedAt: new Date(),
      aiReplyEnabled: false,
      aiToggledBy: operatorName,
      aiToggledAt: new Date(),
      unreadCount: 0,
    })
    .where(eq(chatConversations.id, conversationId));
  
  // Update handover requests
  await db.update(aiHandoverRequests)
    .set({
      status: "claimed",
      claimedBy: operatorName,
      claimedAt: new Date(),
    })
    .where(and(
      eq(aiHandoverRequests.conversationId, conversationId),
      eq(aiHandoverRequests.status, "pending")
    ));
  
  broadcastChange("chat" as any);
}

// Create AI handover request
export async function createHandoverRequest(data: {
  conversationId: number;
  customerId: number | null;
  platform: string;
  platformId: string;
  customerName: string;
  reason: string;
  aiSummary?: string;
  priority?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Check if there's already a pending handover for this conversation
  const existing = await db.select().from(aiHandoverRequests)
    .where(and(
      eq(aiHandoverRequests.conversationId, data.conversationId),
      eq(aiHandoverRequests.status, "pending")
    ))
    .limit(1);
  
  if (existing.length > 0) return; // Already pending
  
  await db.insert(aiHandoverRequests).values({
    conversationId: data.conversationId,
    customerId: data.customerId,
    platform: data.platform as any,
    platformId: data.platformId,
    customerName: data.customerName,
    reason: data.reason,
    aiSummary: data.aiSummary,
    priority: (data.priority || "medium") as any,
    status: "pending",
    lastMessageAt: new Date(),
  });
  
  // Update conversation handover status
  await db.update(chatConversations)
    .set({ handoverStatus: "pending" })
    .where(eq(chatConversations.id, data.conversationId));
  
  broadcastChange("chat" as any);
}

// List handover requests
export async function listHandoverRequests(status?: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(aiHandoverRequests).$dynamic();
  
  if (status) {
    query = query.where(eq(aiHandoverRequests.status, status as any));
  }
  
  return await query
    .orderBy(desc(aiHandoverRequests.createdAt))
    .limit(100);
}

type PendingHandoverQueueItem = {
  createdAt: Date | string;
  priority?: "low" | "medium" | "high" | null;
};

/**
 * Summarise the active human-handover queue from one shared source of truth.
 * The wait is measured from the original handover request, not from the last
 * customer message, so staff can see how long the request itself has remained
 * unclaimed.
 */
export function summarizePendingHandoverQueue(
  pending: PendingHandoverQueueItem[],
  nowMs = Date.now(),
) {
  const priorityRank = { low: 1, medium: 2, high: 3 } as const;
  let oldestWaitMinutes = 0;
  let over24HoursCount = 0;
  let highestPriority: "low" | "medium" | "high" | null = null;

  for (const request of pending) {
    const createdAtMs = new Date(request.createdAt).getTime();
    const waitMinutes = Number.isFinite(createdAtMs)
      ? Math.max(0, Math.floor((nowMs - createdAtMs) / 60_000))
      : 0;
    oldestWaitMinutes = Math.max(oldestWaitMinutes, waitMinutes);
    if (waitMinutes >= 24 * 60) over24HoursCount += 1;

    const priority = request.priority || "medium";
    if (!highestPriority || priorityRank[priority] > priorityRank[highestPriority]) {
      highestPriority = priority;
    }
  }

  return {
    pendingCount: pending.length,
    oldestWaitMinutes,
    over24HoursCount,
    highestPriority,
  };
}

// Get handover stats for Dashboard
export async function getHandoverStats(): Promise<any> {
  const db = await getDb();
  if (!db) {
    return {
      pendingCount: 0,
      oldestWaitMinutes: 0,
      over24HoursCount: 0,
      highestPriority: null,
      recentHandovers: [],
    };
  }
  
  const pending = await db.select().from(aiHandoverRequests)
    .where(eq(aiHandoverRequests.status, "pending"))
    .orderBy(desc(aiHandoverRequests.createdAt));
  
  const queueSummary = summarizePendingHandoverQueue(pending);
  
  return {
    ...queueSummary,
    recentHandovers: pending.slice(0, 5),
  };
}

// Get customer info for chat right panel
export async function getChatCustomerInfo(customerId: number): Promise<any> {
  const db = await getDb();
  if (!db) return null;
  
  const customer = await db.select({
    id: customers.id,
    name: customers.name,
    phone: customers.phoneNumber,
    whatsappPhone: customers.whatsappPhone,
    facebookName: customers.facebookName,
    facebookId: customers.facebookId,
    messengerId: customers.messengerId,
    customerType: customers.customerType,
    creditBalance: customers.creditBalance,
    shippingAddress: customers.address,
  })
  .from(customers)
  .where(eq(customers.id, customerId))
  .limit(1);
  
  if (customer.length === 0) return null;
  
  const orderSummaryColumns = {
    id: orders.id,
    orderNumber: orders.orderNumber,
    secureToken: orders.secureToken,
    totalAmount: orders.totalAmount,
    customerStatus: orders.physicalStatus,
    createdAt: orders.createdAt,
    specialOrderType: orders.specialOrderType,
    specialOrderReason: orders.specialOrderReason,
    shippingMethod: orders.shippingMethod,
    courierCompany: orders.courierCompany,
    trackingNumber: orders.trackingNumber,
  };

  // Keep the existing recent-order card, then provide focused operational
  // lists so staff do not need to scan historical orders in a live chat.
  const recentOrders = await db.select(orderSummaryColumns)
  .from(orders)
  .where(eq(orders.customerId, customerId))
  .orderBy(desc(orders.createdAt))
  .limit(5);

  const [unpaidOrders, shippedOrders, creditTransactions] = await Promise.all([
    db.select(orderSummaryColumns)
      .from(orders)
      .where(and(
        eq(orders.customerId, customerId),
        inArray(orders.physicalStatus, ["pending", "receipt_uploaded", "partial_payment", "hold_order"])
      ))
      .orderBy(desc(orders.createdAt))
      .limit(5),
    db.select(orderSummaryColumns)
      .from(orders)
      .where(and(
        eq(orders.customerId, customerId),
        inArray(orders.physicalStatus, ["partial_shipped", "shipped", "completed"])
      ))
      .orderBy(desc(orders.createdAt))
      .limit(5),
    db.select({
      id: customerCreditLedger.id,
      amount: customerCreditLedger.amount,
      balanceAfter: customerCreditLedger.balanceAfter,
      type: customerCreditLedger.type,
      reason: customerCreditLedger.reason,
      orderNumber: customerCreditLedger.orderNumber,
      performedBy: customerCreditLedger.performedBy,
      createdAt: customerCreditLedger.createdAt,
    })
      .from(customerCreditLedger)
      .where(eq(customerCreditLedger.customerId, customerId))
      .orderBy(desc(customerCreditLedger.createdAt))
      .limit(5),
  ]);

  // Get remarks for these orders
  const orderIds = recentOrders.map((o: any) => o.id);
  let orderRemarks: any[] = [];
  if (orderIds.length > 0) {
    const { orderRemarks: orderRemarksTable } = require("../drizzle/schema");
    const { inArray } = require("drizzle-orm");
    orderRemarks = await db.select().from(orderRemarksTable)
      .where(inArray(orderRemarksTable.orderId, orderIds))
      .orderBy(desc(orderRemarksTable.createdAt));
  }

  // Group remarks by orderId
  const remarksByOrder: Record<number, any[]> = {};
  for (const r of orderRemarks) {
    if (!remarksByOrder[r.orderId]) remarksByOrder[r.orderId] = [];
    remarksByOrder[r.orderId].push(r);
  }

  // Attach remarks to orders
  const ordersWithRemarks = recentOrders.map((o: any) => ({
    ...o,
    remarks: remarksByOrder[o.id] || [],
  }));

  return {
    ...customer[0],
    recentOrders: ordersWithRemarks,
    unpaidOrders,
    shippedOrders,
    creditTransactions,
  };
}

// Store incoming Messenger message to chat
export async function storeIncomingMessengerMessage(psid: string, text: string, attachments?: any[]): Promise<{ conversationId: number; customerMessageId: number | null; customerId: number | null; customerName: string | null }> {
  const db = await getDb();
  if (!db) return { conversationId: 0, customerMessageId: null, customerId: null, customerName: null };
  
  // Find or create customer by messengerId (PSID)
  // This ensures every Messenger user gets a customer record, even if they just say "Hi"
  let customer: any[] = await db.select().from(customers)
    .where(eq(customers.messengerId, psid))
    .limit(1);
  let customerId: number | null;
  if (customer.length > 0) {
    customerId = customer[0].id;
  } else {
    // Customer not found — create one so Admin can search for them later
    try {
      const newCustomer = await findOrCreateCustomer({
        messengerId: psid,
        name: psid, // Will be updated when we get their profile name
      });
      customerId = newCustomer.id;
      customer = [newCustomer];
    } catch (err) {
      console.error("[storeIncomingMessengerMessage] Failed to create customer for PSID:", psid, err);
      customerId = null;
    }
  }
  // Get or create conversation
  const conversation = await getOrCreateConversation(customerId, "messenger", psid);
  
  let customerMessageId: number | null = null;
  // Add text message
  if (text) {
    const msgResult = await addChatMessage({
      conversationId: conversation.id,
      senderType: "customer",
      messageType: "text",
      content: text,
      status: "delivered",
    });
    customerMessageId = msgResult?.messageId ?? null;
  }
  
  // Add attachment messages
  if (attachments) {
    for (const att of attachments) {
      const msgType = att.type === "image" ? "image" :
                     att.type === "audio" ? "audio" :
                     att.type === "video" ? "video" :
                     att.type === "file" ? "file" : "text";
      await addChatMessage({
        conversationId: conversation.id,
        senderType: "customer",
        messageType: msgType,
        content: att.title || att.type,
        mediaUrl: att.payload?.url,
        status: "delivered",
            });
    }
  }
  // Broadcast chat change for real-time SSE push
  broadcastChange("chat" as any);
  return {
    conversationId: conversation.id,
    customerMessageId,
    customerId,
    customerName: customer.length > 0 ? (customer[0] as any).name ?? null : null,
  };
}
// ===========================================================================
// AI Engine — Reply Rules CRUD
// ===========================================================================

export async function getAllReplyRules() {
  const database = await getDb();
  if (!database) return [];
  const { replyRules } = await import("../drizzle/schema");
  const rows = await database.select().from(replyRules).orderBy(replyRules.priority);
  return rows;
}

export async function createReplyRule(data: {
  name: string;
  triggerKeywords: string;
  replyContent: string;
  priority?: number;
  channels?: string;
  isEnabled?: boolean;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const { replyRules } = await import("../drizzle/schema");
  const [row] = await database.insert(replyRules).values({
    name: data.name,
    triggerKeywords: data.triggerKeywords,
    replyContent: data.replyContent,
    priority: data.priority ?? 100,
    channels: data.channels ?? '["messenger","whatsapp"]',
    isEnabled: data.isEnabled ?? true,
  });
  return row;
}

export async function updateReplyRule(id: number, data: {
  name?: string;
  triggerKeywords?: string;
  replyContent?: string;
  priority?: number;
  channels?: string;
  isEnabled?: boolean;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const { replyRules } = await import("../drizzle/schema");
  await database.update(replyRules).set(data).where(eq(replyRules.id, id));
  return { success: true };
}

export async function deleteReplyRule(id: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const { replyRules } = await import("../drizzle/schema");
  await database.delete(replyRules).where(eq(replyRules.id, id));
  return { success: true };
}

// ===========================================================================
// AI Engine — Knowledge Base CRUD
// ===========================================================================

export async function getAllAiKnowledge() {
  const database = await getDb();
  if (!database) return [];
  const { aiKnowledge } = await import("../drizzle/schema");
  const rows = await database.select().from(aiKnowledge).orderBy(aiKnowledge.priority);
  return rows;
}

export async function createAiKnowledge(data: {
  category: string;
  topic: string;
  triggerKeywords: string;
  content: string;
  priority?: number;
  useLLM?: boolean;
  isEnabled?: boolean;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const { aiKnowledge } = await import("../drizzle/schema");
  const [row] = await database.insert(aiKnowledge).values({
    category: data.category,
    topic: data.topic,
    triggerKeywords: data.triggerKeywords,
    content: data.content,
    priority: data.priority ?? 100,
    useLLM: data.useLLM ?? false,
    isEnabled: data.isEnabled ?? true,
  });
  return row;
}

/** Save a staff-corrected AI reply as a non-live knowledge draft with source context. */
export async function createChatTrainingFeedback(data: {
  conversationId: number;
  messageId: number;
  category: string;
  topic: string;
  triggerKeywords: string;
  content: string;
  sourceNote?: string;
  staffName?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const messages = await database.select({
    id: chatMessages.id,
    senderType: chatMessages.senderType,
    content: chatMessages.content,
  })
    .from(chatMessages)
    .where(and(eq(chatMessages.id, data.messageId), eq(chatMessages.conversationId, data.conversationId)))
    .limit(1);
  const message = messages[0];
  if (!message) throw new Error("找不到对应聊天消息");
  if (message.senderType !== "ai") throw new Error("只有 AI 回复可保存为训练反馈");

  const [result] = await database.insert(aiKnowledge).values({
    category: data.category.trim(),
    topic: data.topic.trim(),
    triggerKeywords: data.triggerKeywords.trim(),
    content: data.content.trim(),
    priority: 100,
    useLLM: false,
    isEnabled: false,
    status: "draft",
    sourceNote: `聊天训练草稿｜会话 #${data.conversationId}｜AI消息 #${data.messageId}｜提交人 ${data.staffName || "Staff"}${data.sourceNote ? `｜${data.sourceNote.trim()}` : ""}`,
  });
  return { success: true, insertId: (result as any).insertId ?? null, status: "draft" as const };
}

export async function updateAiKnowledge(id: number, data: {
  category?: string;
  topic?: string;
  triggerKeywords?: string;
  content?: string;
  priority?: number;
  useLLM?: boolean;
  isEnabled?: boolean;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const { aiKnowledge } = await import("../drizzle/schema");
  await database.update(aiKnowledge).set(data).where(eq(aiKnowledge.id, id));
  return { success: true };
}

/** Publish an audited chat-training draft. Arbitrary knowledge entries keep using the existing edit workflow. */
export async function approveChatTrainingFeedback(id: number, approverName: string) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const { aiKnowledge } = await import("../drizzle/schema");
  const rows = await database.select({
    id: aiKnowledge.id,
    status: aiKnowledge.status,
    sourceNote: aiKnowledge.sourceNote,
  }).from(aiKnowledge).where(eq(aiKnowledge.id, id)).limit(1);
  const trainingDraft = rows[0];
  if (!trainingDraft || trainingDraft.status !== "draft" || !trainingDraft.sourceNote?.startsWith("聊天训练草稿｜")) {
    throw new Error("仅可审核发布来自聊天训练的草稿");
  }

  await database.update(aiKnowledge).set({
    status: "published",
    isEnabled: true,
    approvedBy: approverName,
    approvedAt: new Date(),
  }).where(eq(aiKnowledge.id, id));
  return { success: true, status: "published" as const };
}

export async function deleteAiKnowledge(id: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const { aiKnowledge } = await import("../drizzle/schema");
  await database.delete(aiKnowledge).where(eq(aiKnowledge.id, id));
  return { success: true };
}


// ===========================================================================
// AI Brain — Persona, Status, Stats, Alerts
// ===========================================================================

export async function getAiPersona() {
  const database = await getDb();
  if (!database) return null;
  const { aiPersona } = await import("../drizzle/schema");
  const rows = await database.select().from(aiPersona).limit(1);
  return rows.length > 0 ? rows[0] : null;
}

export async function updateAiPersona(data: {
  aiName?: string;
  brandName?: string;
  aiSelfReference?: string;
  customerAddress?: string;
  replyTone?: string;
  defaultLanguage?: string;
  supportedLanguages?: string;
  emojiLevel?: string;
  replyLength?: string;
  proactiveRecommend?: boolean;
  proactiveInquire?: boolean;
  enableCTA?: boolean;
  ctaTemplate?: string;
  customPrompt?: string;
  replyPrinciples?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const { aiPersona } = await import("../drizzle/schema");
  const existing = await database.select().from(aiPersona).limit(1);
  if (existing.length > 0) {
    await database.update(aiPersona).set(data).where(eq(aiPersona.id, existing[0].id));
  } else {
    await database.insert(aiPersona).values({
      aiName: data.aiName || "小田",
      brandName: data.brandName || "心田 Xintian",
      aiSelfReference: data.aiSelfReference || "小田",
      customerAddress: data.customerAddress || "亲爱的",
      replyTone: data.replyTone || "warm",
      defaultLanguage: data.defaultLanguage || "zh",
      supportedLanguages: data.supportedLanguages || '["zh","en","ms"]',
      emojiLevel: data.emojiLevel || "low",
      replyLength: data.replyLength || "medium",
      proactiveRecommend: data.proactiveRecommend ?? true,
      proactiveInquire: data.proactiveInquire ?? true,
      enableCTA: data.enableCTA ?? true,
      ctaTemplate: data.ctaTemplate || "还有什么小田可以帮到你的吗？",
      customPrompt: data.customPrompt,
      replyPrinciples: data.replyPrinciples,
    });
  }
  return { success: true };
}

export async function getAiBrainStatus() {
  const database = await getDb();
  const status: Record<string, { state: "ok" | "error" | "unconfigured"; detail?: string }> = {};

  // Messenger
  const hasPageToken = !!process.env.FB_PAGE_ACCESS_TOKEN;
  const hasPageId = !!process.env.FB_PAGE_ID;
  if (hasPageToken && hasPageId) {
    status.messenger = { state: "ok", detail: "Page token & ID configured" };
  } else if (hasPageToken || hasPageId) {
    status.messenger = { state: "error", detail: "Partial configuration" };
  } else {
    status.messenger = { state: "unconfigured", detail: "No FB Page token or ID" };
  }

  // WhatsApp — not configured in this system
  status.whatsapp = { state: "unconfigured", detail: "WhatsApp Business API not yet integrated" };

  // Chat
  if (database) {
    try {
      const { chatConversations } = await import("../drizzle/schema");
      const count = await database.select({ c: sql`count(*)` }).from(chatConversations);
      status.chat = { state: "ok", detail: `${count[0]?.c || 0} conversations` };
    } catch {
      status.chat = { state: "error", detail: "Cannot query chat tables" };
    }
  } else {
    status.chat = { state: "error", detail: "Database not available" };
  }

  // Flow Engine
  if (database) {
    try {
      const { liveAiFlows } = await import("../drizzle/schema");
      const flows = await database.select().from(liveAiFlows);
      const enabled = flows.filter((f: any) => f.isEnabled).length;
      status.flowEngine = { state: "ok", detail: `${enabled} active flows (${flows.length} total)` };
    } catch {
      status.flowEngine = { state: "error", detail: "Cannot query flow tables" };
    }
  } else {
    status.flowEngine = { state: "error", detail: "Database not available" };
  }

  // Reply Rule Engine
  if (database) {
    try {
      const rules = await getAllReplyRules();
      const enabled = rules.filter((r: any) => r.isEnabled).length;
      status.replyRuleEngine = { state: "ok", detail: `${enabled} active rules (${rules.length} total)` };
    } catch {
      status.replyRuleEngine = { state: "error", detail: "Cannot query reply rules" };
    }
  } else {
    status.replyRuleEngine = { state: "error", detail: "Database not available" };
  }

  // Knowledge Engine
  if (database) {
    try {
      const knowledge = await getAllAiKnowledge();
      const enabled = knowledge.filter((k: any) => k.isEnabled).length;
      status.knowledgeEngine = { state: "ok", detail: `${enabled} active entries (${knowledge.length} total)` };
    } catch {
      status.knowledgeEngine = { state: "error", detail: "Cannot query knowledge base" };
    }
  } else {
    status.knowledgeEngine = { state: "error", detail: "Database not available" };
  }

  // Webhook — check if FB_VERIFY_TOKEN is set (webhook subscription requires it)
  const hasVerifyToken = !!process.env.FB_VERIFY_TOKEN;
  if (hasVerifyToken && (hasPageToken || hasPageId)) {
    status.webhook = { state: "ok", detail: "Webhook verify token configured" };
  } else if (hasVerifyToken) {
    status.webhook = { state: "ok", detail: "Verify token set (Page config incomplete)" };
  } else {
    status.webhook = { state: "unconfigured", detail: "FB_VERIFY_TOKEN not set" };
  }

  // SSE
  status.sse = { state: "ok", detail: "SSE endpoint /api/sse active" };

  // Database
  status.database = database
    ? { state: "ok", detail: "Connected" }
    : { state: "error", detail: "Not connected" };

  return status;
}

export async function getAiBrainStats() {
  const database = await getDb();
  if (!database) {
    return {
      todayConversations: 0,
      aiReplies: 0,
      staffReplies: 0,
      handoverCount: 0,
      aiUnanswered: 0,
      flowTriggers: 0,
      replyRuleTriggers: 0,
      knowledgeTriggers: 0,
    };
  }

  const { chatMessages, chatConversations, aiHandoverRequests } = await import("../drizzle/schema");

  // Today's date range (UTC)
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(startOfDay.getTime() + 86400000);

  // Today's conversations (conversations with messages today)
  const todayMessages = await database.select({
    conversationId: chatMessages.conversationId,
    senderType: chatMessages.senderType,
  })
  .from(chatMessages)
  .where(and(
    sql`${chatMessages.createdAt} >= ${startOfDay}`,
    sql`${chatMessages.createdAt} < ${endOfDay}`
  ));

  const uniqueConversations = new Set(todayMessages.map((m: any) => m.conversationId));
  const todayConversations = uniqueConversations.size;

  const aiReplies = todayMessages.filter((m: any) => m.senderType === "ai").length;
  const staffReplies = todayMessages.filter((m: any) => m.senderType === "staff").length;

  // Today's handover requests
  const todayHandovers = await database.select()
    .from(aiHandoverRequests)
    .where(and(
      sql`${aiHandoverRequests.createdAt} >= ${startOfDay}`,
      sql`${aiHandoverRequests.createdAt} < ${endOfDay}`
    ));
  const handoverCount = todayHandovers.length;

  // AI unanswered = handover requests with reason containing "无法" or "unable"
  const aiUnanswered = todayHandovers.filter((h: any) =>
    h.reason && (h.reason.includes("无法") || h.reason.includes("unable") || h.reason.includes("cannot"))
  ).length;

  // Flow triggers — count messages with messageType=flow today
  const flowCountResult = await database.select({ c: sql`count(*)` })
    .from(chatMessages)
    .where(and(
      sql`${chatMessages.createdAt} >= ${startOfDay}`,
      sql`${chatMessages.createdAt} < ${endOfDay}`,
      eq(chatMessages.messageType, "flow")
    ));
  const flowTriggers: number = Number(flowCountResult[0]?.c || 0);

  // Real trigger counts from aiResponseSource on AI messages
  const replyRuleTriggersResult = await database.select({ c: sql`count(*)` })
    .from(chatMessages)
    .where(and(
      sql`${chatMessages.createdAt} >= ${startOfDay}`,
      sql`${chatMessages.createdAt} < ${endOfDay}`,
      eq(chatMessages.senderType, "ai"),
      eq(chatMessages.aiResponseSource, "reply_rule")
    ));
  const replyRuleTriggers: number = Number(replyRuleTriggersResult[0]?.c || 0);

  const knowledgeTriggersResult = await database.select({ c: sql`count(*)` })
    .from(chatMessages)
    .where(and(
      sql`${chatMessages.createdAt} >= ${startOfDay}`,
      sql`${chatMessages.createdAt} < ${endOfDay}`,
      eq(chatMessages.senderType, "ai"),
      eq(chatMessages.aiResponseSource, "knowledge")
    ));
  const knowledgeTriggers: number = Number(knowledgeTriggersResult[0]?.c || 0);

  const productTriggersResult = await database.select({ c: sql`count(*)` })
    .from(chatMessages)
    .where(and(
      sql`${chatMessages.createdAt} >= ${startOfDay}`,
      sql`${chatMessages.createdAt} < ${endOfDay}`,
      eq(chatMessages.senderType, "ai"),
      eq(chatMessages.aiResponseSource, "product")
    ));
  const productTriggers: number = Number(productTriggersResult[0]?.c || 0);

  // AI auto-resolved rate: AI replies that did NOT result in handover / total AI replies
  const totalAiReplies = aiReplies || 0;
  const aiResolved = totalAiReplies - handoverCount;
  const aiResolvedRate = totalAiReplies > 0 ? Math.round((aiResolved / totalAiReplies) * 100) : 0;
  // Human handover rate: handovers / (AI replies + handovers)
  const totalHandled = totalAiReplies + handoverCount;
  const handoverRate = totalHandled > 0 ? Math.round((handoverCount / totalHandled) * 100) : 0;

  return {
    todayConversations,
    aiReplies,
    staffReplies,
    handoverCount,
    aiUnanswered,
    flowTriggers,
    replyRuleTriggers,
    knowledgeTriggers,
    productTriggers,
    aiResolvedRate,
    handoverRate,
  };
}

export async function getAiBrainAlerts() {
  const database = await getDb();
  const alerts: Array<{ level: "warning" | "info" | "error"; title: string; detail: string }> = [];

  if (!database) {
    alerts.push({ level: "error", title: "数据库未连接", detail: "系统无法连接到数据库" });
    return alerts;
  }

  // Check for unpublished knowledge entries (drafts)
  try {
    const knowledge = await getAllAiKnowledge();
    const unpublished = knowledge.filter((k: any) => !k.isEnabled).length;
    if (unpublished > 0) {
      alerts.push({ level: "info", title: "知识库草稿未发布", detail: `${unpublished} 条知识库条目未启用` });
    }
  } catch { /* ignore */ }

  // Check for unpublished reply rules (drafts)
  try {
    const rules = await getAllReplyRules();
    const unpublishedRules = rules.filter((r: any) => !r.isEnabled).length;
    if (unpublishedRules > 0) {
      alerts.push({ level: "info", title: "固定回复草稿未发布", detail: `${unpublishedRules} 条固定回复规则未启用` });
    }
  } catch { /* ignore */ }

  // Check for AI unanswered (pending handover requests)
  try {
    const { aiHandoverRequests } = await import("../drizzle/schema");
    const pending = await database.select()
      .from(aiHandoverRequests)
      .where(eq(aiHandoverRequests.status, "pending"));
    if (pending.length > 0) {
      alerts.push({ level: "warning", title: "待处理转人工", detail: `${pending.length} 个待处理转人工请求` });
    }
  } catch { /* ignore */ }

  // Check Messenger token status
  if (!process.env.FB_PAGE_ACCESS_TOKEN) {
    alerts.push({ level: "error", title: "Messenger Token 未配置", detail: "FB_PAGE_ACCESS_TOKEN 未设置" });
  }

  // Check webhook verify token
  if (!process.env.FB_VERIFY_TOKEN) {
    alerts.push({ level: "warning", title: "Webhook 未配置", detail: "FB_VERIFY_TOKEN 未设置，Webhook 无法验证" });
  }

  return alerts;
}

// ============================================================
// AI Log Center - Phase 2 Task 1
// ============================================================

import type { AiLogRecord } from "./aiLogContext";

/** Create a main AI log record. Returns the inserted id. */
export async function createAiLog(record: AiLogRecord): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [result] = await db.insert(aiLogs).values({
      conversationId: record.conversationId,
      customerId: record.customerId,
      customerName: record.customerName,
      platform: record.platform as any,
      sourceType: record.sourceType as any,
      sourceEventId: record.sourceEventId ?? null,
      sourceBindingId: record.sourceBindingId ?? null,
      customerMessageId: record.customerMessageId,
      aiReplyMessageId: record.aiReplyMessageId,
      customerMessage: record.customerMessage,
      receivedAt: record.receivedAt,
      aiEnabled: record.aiEnabled,
      handoverStatus: record.handoverStatus as any,
      processingSteps: record.processingSteps,
      finalSource: record.finalSource as any,
      matchedRuleId: record.matchedRuleId,
      matchedKnowledgeId: record.matchedKnowledgeId,
      matchedProductId: record.matchedProductId,
      matchedFlowId: record.matchedFlowId,
      aiReply: record.aiReply,
      sendStatus: record.sendStatus as any,
      platformMessageId: record.platformMessageId,
      retryCount: record.retryCount,
      errorCode: record.errorCode,
      errorStage: record.errorStage,
      errorMessage: record.errorMessage,
      isHandover: record.isHandover,
      handoverReason: record.handoverReason,
      processingTimeMs: record.processingTimeMs,
      detectedIntent: (record as any).detectedIntent || null,
      handoverSummary: (record as any).handoverSummary ? JSON.stringify((record as any).handoverSummary) : null,
    });
    const insertResult = result as any;
    const aiLogId = insertResult.insertId ?? null;
    if (aiLogId) {
      broadcastChange("aiLog");
    }
    return aiLogId;
  } catch (err) {
    console.error("[AI Log] Failed to create AI log:", err);
    return null;
  }
}

/** Update an AI log record after send attempt completes. */
export async function updateAiLogAfterSend(
  aiLogId: number,
  updates: {
    sendStatus: string;
    platformMessageId?: string | null;
    aiReplyMessageId?: number | null;
    errorCode?: string | null;
    errorStage?: string | null;
    errorMessage?: string | null;
    retryCount?: number;
    lastRetryAt?: Date;
    processingTimeMs?: number;
    processingSteps?: AiLogRecord["processingSteps"];
  },
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const updateData: any = { sendStatus: updates.sendStatus };
    if (updates.platformMessageId !== undefined) updateData.platformMessageId = updates.platformMessageId;
    if (updates.aiReplyMessageId !== undefined) updateData.aiReplyMessageId = updates.aiReplyMessageId;
    if (updates.errorCode !== undefined) updateData.errorCode = updates.errorCode;
    if (updates.errorStage !== undefined) updateData.errorStage = updates.errorStage;
    if (updates.errorMessage !== undefined) updateData.errorMessage = updates.errorMessage;
    if (updates.retryCount !== undefined) updateData.retryCount = updates.retryCount;
    if (updates.lastRetryAt !== undefined) updateData.lastRetryAt = updates.lastRetryAt;
    if (updates.processingTimeMs !== undefined) updateData.processingTimeMs = updates.processingTimeMs;
    if (updates.processingSteps !== undefined) updateData.processingSteps = updates.processingSteps;
    await db.update(aiLogs).set(updateData).where(eq(aiLogs.id, aiLogId));
    broadcastChange("aiLog");
  } catch (err) {
    console.error("[AI Log] Failed to update AI log:", err);
  }
}

/** Add a delivery attempt record. */
export async function addDeliveryAttempt(
  aiLogId: number,
  attemptNumber: number,
  sendStatus: string,
  extra?: { platformMessageId?: string; errorCode?: string; errorMessage?: string },
): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [result] = await db.insert(aiLogDeliveryAttempts).values({
      aiLogId,
      attemptNumber,
      sendStatus: sendStatus as any,
      platformMessageId: extra?.platformMessageId,
      errorCode: extra?.errorCode,
      errorMessage: extra?.errorMessage,
    });
    const attemptId = (result as any).insertId ?? null;
    broadcastChange("aiLog");
    return attemptId;
  } catch (err) {
    console.error("[AI Log] Failed to add delivery attempt:", err);
    return null;
  }
}

/** Update a delivery attempt record after send result is known. */
export async function updateDeliveryAttempt(
  attemptId: number,
  updates: {
    sendStatus: string;
    platformMessageId?: string;
    errorCode?: string;
    errorMessage?: string;
  },
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const updateData: any = { sendStatus: updates.sendStatus };
    if (updates.platformMessageId !== undefined) updateData.platformMessageId = updates.platformMessageId;
    if (updates.errorCode !== undefined) updateData.errorCode = updates.errorCode;
    if (updates.errorMessage !== undefined) updateData.errorMessage = updates.errorMessage;
    await db.update(aiLogDeliveryAttempts).set(updateData).where(eq(aiLogDeliveryAttempts.id, attemptId));
  } catch (err) {
    console.error("[AI Log] Failed to update delivery attempt:", err);
  }
}

/** Get AI logs with filtering and pagination. */
export async function getAiLogs(params: {
  page: number;
  pageSize: number;
  dateFrom?: string;
  dateTo?: string;
  customerName?: string;
  platform?: string;
  sourceType?: string;
  finalSource?: string;
  sendStatus?: string;
  isHandover?: boolean;
  errorStage?: string;
  keyword?: string;
}): Promise<{ items: any[]; total: number; page: number; pageSize: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0, page: params.page, pageSize: params.pageSize };

  const conditions: any[] = [];

  if (params.dateFrom) {
    conditions.push(gte(aiLogs.createdAt, new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    const endOfDay = new Date(params.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(aiLogs.createdAt, endOfDay));
  }
  if (params.customerName) {
    conditions.push(like(aiLogs.customerName, `%${params.customerName}%`));
  }
  if (params.platform && params.platform !== "all") {
    conditions.push(eq(aiLogs.platform, params.platform as any));
  }
  if (params.sourceType && params.sourceType !== "all") {
    conditions.push(eq(aiLogs.sourceType, params.sourceType as any));
  }
  if (params.finalSource && params.finalSource !== "all") {
    conditions.push(eq(aiLogs.finalSource, params.finalSource as any));
  }
  if (params.sendStatus && params.sendStatus !== "all") {
    conditions.push(eq(aiLogs.sendStatus, params.sendStatus as any));
  }
  if (params.isHandover !== undefined) {
    conditions.push(eq(aiLogs.isHandover, params.isHandover));
  }
  if (params.errorStage && params.errorStage !== "all") {
    conditions.push(eq(aiLogs.errorStage, params.errorStage));
  }
  if (params.keyword) {
    conditions.push(
      or(
        like(aiLogs.customerMessage, `%${params.keyword}%`),
        like(aiLogs.aiReply, `%${params.keyword}%`),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const offset = (params.page - 1) * params.pageSize;

  const [items, countResult] = await Promise.all([
    db.select({
      id: aiLogs.id,
      conversationId: aiLogs.conversationId,
      customerId: aiLogs.customerId,
      customerName: aiLogs.customerName,
      platform: aiLogs.platform,
      sourceType: aiLogs.sourceType,
      sourceEventId: aiLogs.sourceEventId,
      sourceBindingId: aiLogs.sourceBindingId,
      customerMessage: aiLogs.customerMessage,
      finalSource: aiLogs.finalSource,
      sendStatus: aiLogs.sendStatus,
      retryCount: aiLogs.retryCount,
      isHandover: aiLogs.isHandover,
      errorCode: aiLogs.errorCode,
      errorStage: aiLogs.errorStage,
      processingTimeMs: aiLogs.processingTimeMs,
      createdAt: aiLogs.createdAt,
    })
    .from(aiLogs)
    .where(whereClause)
    .orderBy(desc(aiLogs.createdAt))
    .limit(params.pageSize)
    .offset(offset),
    db.select({ count: sql`COUNT(*)` }).from(aiLogs).where(whereClause),
  ]);

  return {
    items,
    total: (countResult[0] as any)?.count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

/** Get a single AI log with full detail including processing steps. */
export async function getAiLogDetail(id: number): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;

  const [log] = await db.select().from(aiLogs).where(eq(aiLogs.id, id));
  if (!log) return null;

  const attempts = await db.select()
    .from(aiLogDeliveryAttempts)
    .where(eq(aiLogDeliveryAttempts.aiLogId, id))
    .orderBy(aiLogDeliveryAttempts.attemptNumber);

  return { ...log, deliveryAttempts: attempts };
}

/** Get AI log statistics for the dashboard. */
export async function getAiLogStats(days: number = 1): Promise<{
  total: number;
  sent: number;
  failed: number;
  handover: number;
  bySource: Record<string, number>;
  avgProcessingMs: number;
  errorByStage: Record<string, number>;
}> {
  const db = await getDb();
  if (!db) return { total: 0, sent: 0, failed: 0, handover: 0, bySource: {}, avgProcessingMs: 0, errorByStage: {} };

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const allLogs = await db.select({
    finalSource: aiLogs.finalSource,
    sendStatus: aiLogs.sendStatus,
    isHandover: aiLogs.isHandover,
    processingTimeMs: aiLogs.processingTimeMs,
    errorStage: aiLogs.errorStage,
  })
  .from(aiLogs)
  .where(gte(aiLogs.createdAt, since));

  const bySource: Record<string, number> = {};
  const errorByStage: Record<string, number> = {};
  let sent = 0, failed = 0, handover = 0, totalProcessingMs = 0;

  for (const log of allLogs) {
    bySource[log.finalSource] = (bySource[log.finalSource] ?? 0) + 1;
    if (log.sendStatus === "sent") sent++;
    if (log.sendStatus === "failed") failed++;
    if (log.isHandover) handover++;
    if (log.processingTimeMs) totalProcessingMs += log.processingTimeMs;
    if (log.errorStage) errorByStage[log.errorStage] = (errorByStage[log.errorStage] ?? 0) + 1;
  }

  return {
    total: allLogs.length,
    sent,
    failed,
    handover,
    bySource,
    avgProcessingMs: allLogs.length > 0 ? Math.round(totalProcessingMs / allLogs.length) : 0,
    errorByStage,
  };
}

/** Cleanup old AI logs based on retention days. Returns count of deleted records. */
export async function cleanupOldAiLogs(): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;
    const retentionDays = ENV.aiLogRetentionDays;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    // Delete delivery attempts first (though CASCADE should handle it)
    const oldLogIds = await db.select({ id: aiLogs.id })
      .from(aiLogs)
      .where(lt(aiLogs.createdAt, cutoff));

    if (oldLogIds.length === 0) return 0;

    const oldIds = oldLogIds.map((r: any) => r.id);

    // Delete main logs (CASCADE will remove delivery attempts)
    await db.delete(aiLogs).where(inArray(aiLogs.id, oldIds));

    console.log(`[AI Log] Cleaned up ${oldIds.length} logs older than ${retentionDays} days`);
    return oldIds.length;
  } catch (err) {
    console.error("[AI Log] Cleanup failed:", err);
    return 0;
  }
}

// ============================================================================
// AI Test Center — Database helpers (completely isolated from ai_logs)
// ============================================================================

export async function getTestRuns(params: {
  page?: number;
  pageSize?: number;
  finalSource?: string;
  platform?: string;
  testedBy?: string;
}): Promise<{ items: any[]; total: number }> {
  try {
    const db = await getDb();
    if (!db) return { items: [], total: 0 };
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = db.select().from(aiTestRuns).$dynamic();
    const conditions: any[] = [];

    if (params.finalSource) {
      conditions.push(eq(aiTestRuns.finalSource, params.finalSource as any));
    }
    if (params.platform) {
      conditions.push(eq(aiTestRuns.platform, params.platform as any));
    }
    if (params.testedBy) {
      conditions.push(eq(aiTestRuns.testedBy, params.testedBy));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const items = await query
      .orderBy(desc(aiTestRuns.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Get total count
    let countQuery = db.select({ count: sql`count(*)` }).from(aiTestRuns).$dynamic();
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const [{ count }] = await countQuery;

    return { items, total: Number(count) };
  } catch (err) {
    console.error("[AI Test] getTestRuns failed:", err);
    return { items: [], total: 0 };
  }
}

export async function getTestRunDetail(id: number): Promise<any | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(aiTestRuns).where(eq(aiTestRuns.id, id)).limit(1);
    return row || null;
  } catch (err) {
    console.error("[AI Test] getTestRunDetail failed:", err);
    return null;
  }
}

export async function deleteTestRun(id: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    await db.delete(aiTestRuns).where(eq(aiTestRuns.id, id));
    return true;
  } catch (err) {
    console.error("[AI Test] deleteTestRun failed:", err);
    return false;
  }
}

export async function batchDeleteTestRuns(ids: number[]): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;
    const result = await db.delete(aiTestRuns).where(inArray(aiTestRuns.id, ids));
    return (result as any)?.affectedRows || ids.length;
  } catch (err) {
    console.error("[AI Test] batchDeleteTestRuns failed:", err);
    return 0;
  }
}

export async function cleanupOldTestRuns(): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;
    const retentionDays = 180; // Test records retained for 180 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const oldRuns = await db.select({ id: aiTestRuns.id })
      .from(aiTestRuns)
      .where(lt(aiTestRuns.createdAt, cutoff));

    if (oldRuns.length === 0) return 0;

    const oldIds = oldRuns.map((r: any) => r.id);
    await db.delete(aiTestRuns).where(inArray(aiTestRuns.id, oldIds));

    console.log(`[AI Test] Cleaned up ${oldIds.length} test runs older than ${retentionDays} days`);
    return oldIds.length;
  } catch (err) {
    console.error("[AI Test] Cleanup failed:", err);
    return 0;
  }
}

export async function checkDuplicateKnowledge(
  triggerKeywords: string,
  content: string
): Promise<{ isDuplicate: boolean; existingId?: number; existingTopic?: string }> {
  try {
    const db = await getDb();
    if (!db) return { isDuplicate: false };

    // Check by trigger keywords overlap
    const entries = await db.select().from(aiKnowledge);
    const newKeywords = triggerKeywords.toLowerCase().split(",").map((k: string) => k.trim()).filter(Boolean);

    for (const entry of entries) {
      const existingKeywords = (entry.triggerKeywords || "")
        .toLowerCase()
        .split(",")
        .map((k: string) => k.trim())
        .filter(Boolean);

      const hasOverlap = newKeywords.some((kw: string) => existingKeywords.includes(kw));
      if (hasOverlap) {
        return { isDuplicate: true, existingId: entry.id, existingTopic: entry.topic };
      }
    }

    return { isDuplicate: false };
  } catch (err) {
    console.error("[AI Test] checkDuplicateKnowledge failed:", err);
    return { isDuplicate: false };
  }
}

export async function createKnowledgeDraft(data: {
  category: string;
  topic: string;
  triggerKeywords: string;
  content: string;
  sourceAiTestRunId: number;
  sourceNote?: string;
}): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const [row] = await db.insert(aiKnowledge).values({
      category: data.category,
      topic: data.topic,
      triggerKeywords: data.triggerKeywords,
      content: data.content,
      priority: 100,
      useLLM: false,
      isEnabled: false, // Draft is disabled by default
      status: "draft",
      sourceAiTestRunId: data.sourceAiTestRunId,
      sourceNote: data.sourceNote || null,
    });

    return (row as any)?.insertId || null;
  } catch (err) {
    console.error("[AI Test] createKnowledgeDraft failed:", err);
    return null;
  }
}


// ============================================================================
// AI Analysis Center — Statistics queries for AI performance analysis
// All queries read from ai_logs (production) and exclude ai_test_runs
// ============================================================================

/** Get AI Analysis Dashboard overview stats */
export async function getAiAnalysisDashboard(days: number = 1): Promise<{
  totalReplies: number;
  hitRate: number;
  handoverRate: number;
  failureRate: number;
  avgProcessingMs: number;
  llmCallCount: number;
  bySource: Record<string, number>;
  totalBySource: Record<string, number>;
  sentCount: number;
  failedCount: number;
  handoverCount: number;
  noMatchCount: number;
}> {
  const db = await getDb();
  if (!db) return { totalReplies: 0, hitRate: 0, handoverRate: 0, failureRate: 0, avgProcessingMs: 0, llmCallCount: 0, bySource: {}, totalBySource: {}, sentCount: 0, failedCount: 0, handoverCount: 0, noMatchCount: 0 };

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const allLogs = await db.select({
    finalSource: aiLogs.finalSource,
    sendStatus: aiLogs.sendStatus,
    isHandover: aiLogs.isHandover,
    processingTimeMs: aiLogs.processingTimeMs,
  })
  .from(aiLogs)
  .where(gte(aiLogs.createdAt, since));

  const bySource: Record<string, number> = {};
  let sent = 0, failed = 0, handover = 0, noMatch = 0, totalProcessingMs = 0;
  let llmCalls = 0;

  for (const log of allLogs) {
    bySource[log.finalSource] = (bySource[log.finalSource] ?? 0) + 1;
    if (log.sendStatus === "sent") sent++;
    if (log.sendStatus === "failed") failed++;
    if (log.isHandover) handover++;
    if (log.finalSource === "no_match") noMatch++;
    if (log.processingTimeMs) totalProcessingMs += log.processingTimeMs;
    if (log.finalSource === "llm") llmCalls++;
  }

  const total = allLogs.length;
  const hitCount = total - noMatch;

  return {
    totalReplies: total,
    hitRate: total > 0 ? Math.round((hitCount / total) * 100) : 0,
    handoverRate: total > 0 ? Math.round((handover / total) * 100) : 0,
    failureRate: total > 0 ? Math.round((failed / total) * 100) : 0,
    avgProcessingMs: total > 0 ? Math.round(totalProcessingMs / total) : 0,
    llmCallCount: llmCalls,
    bySource,
    totalBySource: bySource,
    sentCount: sent,
    failedCount: failed,
    handoverCount: handover,
    noMatchCount: noMatch,
  };
}

/** Get source distribution analysis */
export async function getSourceAnalysis(days: number = 7): Promise<{
  sources: { source: string; count: number; percentage: number }[];
  total: number;
}> {
  const db = await getDb();
  if (!db) return { sources: [], total: 0 };

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const allLogs = await db.select({ finalSource: aiLogs.finalSource })
    .from(aiLogs)
    .where(gte(aiLogs.createdAt, since));

  const sourceMap: Record<string, number> = {};
  for (const log of allLogs) {
    sourceMap[log.finalSource] = (sourceMap[log.finalSource] ?? 0) + 1;
  }

  const total = allLogs.length;
  const sources = Object.entries(sourceMap)
    .map(([source, count]) => ({ source, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  return { sources, total };
}

/** Get knowledge base analysis */
export async function getKnowledgeAnalysis(): Promise<{
  usageRanking: { id: number; topic: string; category: string; usageCount: number; lastMatchedAt: Date | null; isEnabled: boolean; status: string }[];
  neverUsed: { id: number; topic: string; category: string; isEnabled: boolean; status: string }[];
  disabled: { id: number; topic: string; category: string; status: string }[];
  drafts: { id: number; topic: string; category: string; sourceAiTestRunId: number | null; sourceNote: string | null }[];
  total: number;
  publishedCount: number;
  draftCount: number;
}> {
  const db = await getDb();
  if (!db) return { usageRanking: [], neverUsed: [], disabled: [], drafts: [], total: 0, publishedCount: 0, draftCount: 0 };

  const allKnowledge = await db.select({
    id: aiKnowledge.id,
    topic: aiKnowledge.topic,
    category: aiKnowledge.category,
    usageCount: aiKnowledge.usageCount,
    lastMatchedAt: aiKnowledge.lastMatchedAt,
    isEnabled: aiKnowledge.isEnabled,
    status: aiKnowledge.status,
    sourceAiTestRunId: aiKnowledge.sourceAiTestRunId,
    sourceNote: aiKnowledge.sourceNote,
  })
  .from(aiKnowledge);

  const usageRanking = allKnowledge
    .filter(k => k.status === "published" && k.isEnabled)
    .sort((a, b) => b.usageCount - a.usageCount)
    .map(k => ({ id: k.id, topic: k.topic, category: k.category, usageCount: k.usageCount, lastMatchedAt: k.lastMatchedAt, isEnabled: k.isEnabled, status: k.status }));

  const neverUsed = allKnowledge
    .filter(k => k.status === "published" && k.isEnabled && k.usageCount === 0)
    .map(k => ({ id: k.id, topic: k.topic, category: k.category, isEnabled: k.isEnabled, status: k.status }));

  const disabled = allKnowledge
    .filter(k => !k.isEnabled && k.status === "published")
    .map(k => ({ id: k.id, topic: k.topic, category: k.category, status: k.status }));

  const drafts = allKnowledge
    .filter(k => k.status === "draft")
    .map(k => ({ id: k.id, topic: k.topic, category: k.category, sourceAiTestRunId: k.sourceAiTestRunId, sourceNote: k.sourceNote }));

  return {
    usageRanking,
    neverUsed,
    disabled,
    drafts,
    total: allKnowledge.length,
    publishedCount: allKnowledge.filter(k => k.status === "published").length,
    draftCount: drafts.length,
  };
}

/** Get reply rule analysis */
export async function getReplyRuleAnalysis(): Promise<{
  topHits: { id: number; name: string; usageCount: number; lastMatchedAt: Date | null; isEnabled: boolean }[];
  lowHits: { id: number; name: string; usageCount: number; lastMatchedAt: Date | null; isEnabled: boolean }[];
  neverUsed: { id: number; name: string; isEnabled: boolean }[];
  total: number;
  enabledCount: number;
}> {
  const db = await getDb();
  if (!db) return { topHits: [], lowHits: [], neverUsed: [], total: 0, enabledCount: 0 };

  const { replyRules } = await import("../drizzle/schema");
  const allRules = await db.select({
    id: replyRules.id,
    name: replyRules.name,
    usageCount: replyRules.usageCount,
    lastMatchedAt: replyRules.lastMatchedAt,
    isEnabled: replyRules.isEnabled,
  })
  .from(replyRules);

  const sorted = [...allRules].sort((a, b) => b.usageCount - a.usageCount);
  const topHits = sorted.slice(0, 10).map(r => ({ ...r }));
  const lowHits = sorted.filter(r => r.isEnabled && r.usageCount > 0).slice(-10).map(r => ({ ...r }));
  const neverUsed = allRules.filter(r => r.isEnabled && r.usageCount === 0).map(r => ({ id: r.id, name: r.name, isEnabled: r.isEnabled }));

  return {
    topHits,
    lowHits,
    neverUsed,
    total: allRules.length,
    enabledCount: allRules.filter(r => r.isEnabled).length,
  };
}

/** Get no-match analysis (questions AI couldn't answer) */
export async function getNoMatchAnalysis(days: number = 7, limit: number = 20): Promise<{
  topQuestions: { message: string; count: number; lastAskedAt: Date | null }[];
  total: number;
}> {
  const db = await getDb();
  if (!db) return { topQuestions: [], total: 0 };

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const noMatchLogs = await db.select({
    customerMessage: aiLogs.customerMessage,
    createdAt: aiLogs.createdAt,
  })
  .from(aiLogs)
  .where(and(
    eq(aiLogs.finalSource, "no_match"),
    gte(aiLogs.createdAt, since)
  ));

  // Group by normalized message
  const messageMap: Record<string, { count: number; lastAskedAt: Date | null }> = {};
  for (const log of noMatchLogs) {
    const msg = (log.customerMessage || "").trim().toLowerCase().substring(0, 200);
    if (!msg) continue;
    if (!messageMap[msg]) {
      messageMap[msg] = { count: 0, lastAskedAt: null };
    }
    messageMap[msg].count++;
    const logDate = log.createdAt ? new Date(log.createdAt as any) : null;
    if (logDate && (!messageMap[msg].lastAskedAt || logDate > messageMap[msg].lastAskedAt)) {
      messageMap[msg].lastAskedAt = logDate;
    }
  }

  const topQuestions = Object.entries(messageMap)
    .map(([message, data]) => ({ message, count: data.count, lastAskedAt: data.lastAskedAt }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return { topQuestions, total: noMatchLogs.length };
}

/** Get handover analysis */
export async function getHandoverAnalysis(days: number = 7): Promise<{
  total: number;
  byReason: { reason: string; count: number }[];
  recentHandovers: { id: number; customerName: string | null; reason: string; priority: string; status: string; createdAt: Date | null }[];
}> {
  const db = await getDb();
  if (!db) return { total: 0, byReason: [], recentHandovers: [] };

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const handoverLogs = await db.select({
    handoverReason: aiLogs.handoverReason,
  })
  .from(aiLogs)
  .where(and(
    eq(aiLogs.isHandover, true),
    gte(aiLogs.createdAt, since)
  ));

  const reasonMap: Record<string, number> = {};
  for (const log of handoverLogs) {
    const reason = log.handoverReason || "未分类";
    reasonMap[reason] = (reasonMap[reason] ?? 0) + 1;
  }

  const byReason = Object.entries(reasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // Also get handover requests
  const recentRequests = await db.select({
    id: aiHandoverRequests.id,
    customerName: aiHandoverRequests.customerName,
    reason: aiHandoverRequests.reason,
    priority: aiHandoverRequests.priority,
    status: aiHandoverRequests.status,
    createdAt: aiHandoverRequests.createdAt,
  })
  .from(aiHandoverRequests)
  .where(gte(aiHandoverRequests.createdAt, since))
  .orderBy(desc(aiHandoverRequests.createdAt))
  .limit(10);

  const recentHandovers = recentRequests.map((r: any) => ({
    id: r.id,
    customerName: r.customerName,
    reason: r.reason,
    priority: r.priority,
    status: r.status,
    createdAt: r.createdAt ? new Date(r.createdAt as any) : null,
  }));

  return {
    total: handoverLogs.length,
    byReason,
    recentHandovers,
  };
}

/** Get LLM analysis */
export async function getLlmAnalysis(days: number = 7): Promise<{
  totalCalls: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  avgProcessingMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  byModel: { model: string; count: number }[];
}> {
  const db = await getDb();
  if (!db) return { totalCalls: 0, successCount: 0, failedCount: 0, successRate: 0, avgProcessingMs: 0, avgInputTokens: 0, avgOutputTokens: 0, byModel: [] };

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  // LLM calls are tracked in ai_logs where finalSource involves LLM
  // Also check processingSteps for LLM usage
  const llmLogs = await db.select({
    finalSource: aiLogs.finalSource,
    processingTimeMs: aiLogs.processingTimeMs,
    processingSteps: aiLogs.processingSteps,
    errorCode: aiLogs.errorCode,
  })
  .from(aiLogs)
  .where(and(
    gte(aiLogs.createdAt, since),
    or(
      eq(aiLogs.finalSource, "llm"),
      eq(aiLogs.finalSource, "knowledge"),
    )
  ));

  let totalCalls = 0, successCount = 0, failedCount = 0, totalProcessingMs = 0;
  let totalInputTokens = 0, totalOutputTokens = 0;
  const modelMap: Record<string, number> = {};

  for (const log of llmLogs) {
    // Check if LLM was actually called by examining processing steps
    const steps = log.processingSteps as any[];
    if (!Array.isArray(steps)) continue;

    const llmStep = steps.find((s: any) => s.step === "llm_generate" || s.step === "llm");
    if (!llmStep || llmStep.result !== "hit") continue;

    totalCalls++;
    if (log.errorCode) {
      failedCount++;
    } else {
      successCount++;
    }
    if (log.processingTimeMs) totalProcessingMs += log.processingTimeMs;
    if (llmStep.inputTokens) totalInputTokens += llmStep.inputTokens;
    if (llmStep.outputTokens) totalOutputTokens += llmStep.outputTokens;
    if (llmStep.model) modelMap[llmStep.model] = (modelMap[llmStep.model] ?? 0) + 1;
  }

  const byModel = Object.entries(modelMap)
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCalls,
    successCount,
    failedCount,
    successRate: totalCalls > 0 ? Math.round((successCount / totalCalls) * 100) : 0,
    avgProcessingMs: totalCalls > 0 ? Math.round(totalProcessingMs / totalCalls) : 0,
    avgInputTokens: totalCalls > 0 ? Math.round(totalInputTokens / totalCalls) : 0,
    avgOutputTokens: totalCalls > 0 ? Math.round(totalOutputTokens / totalCalls) : 0,
    byModel,
  };
}

/** Get AI improvement suggestions (auto-generated) */
export async function getAiSuggestions(): Promise<{
  suggestions: { type: string; severity: string; title: string; description: string; action: string }[];
}> {
  const db = await getDb();
  if (!db) return { suggestions: [] };

  const suggestions: { type: string; severity: string; title: string; description: string; action: string }[] = [];

  // 1. Check for high-frequency no-match questions
  const noMatchAnalysis = await getNoMatchAnalysis(7, 5);
  for (const q of noMatchAnalysis.topQuestions) {
    if (q.count >= 3) {
      suggestions.push({
        type: "no_match",
        severity: "high",
        title: `「${q.message.substring(0, 30)}${q.message.length > 30 ? "..." : ""}」被问及 ${q.count} 次，AI无法回答`,
        description: `过去7天内有 ${q.count} 位客户询问此问题，但知识库和固定回复均未命中。建议建立对应知识库条目或固定回复规则。`,
        action: "建立知识库条目",
      });
    }
  }

  // 2. Check for never-used reply rules (30+ days)
  const ruleAnalysis = await getReplyRuleAnalysis();
  for (const rule of ruleAnalysis.neverUsed) {
    suggestions.push({
      type: "rule_unused",
      severity: "medium",
      title: `固定回复规则「${rule.name}」从未被命中`,
      description: `该规则已启用但使用次数为0，可能需要优化关键词或考虑停用。`,
      action: "优化关键词或停用",
    });
  }

  // 3. Check for never-used knowledge entries
  const knowledgeAnalysis = await getKnowledgeAnalysis();
  for (const k of knowledgeAnalysis.neverUsed) {
    suggestions.push({
      type: "knowledge_unused",
      severity: "medium",
      title: `知识库条目「${k.topic}」从未被命中`,
      description: `该知识条目已发布且已启用，但使用次数为0。可能需要优化关键词或内容。`,
      action: "优化关键词或内容",
    });
  }

  // 4. Check for high handover rate
  const handoverAnalysis = await getHandoverAnalysis(7);
  const dashboard = await getAiAnalysisDashboard(7);
  if (dashboard.totalReplies > 0 && dashboard.handoverRate > 30) {
    suggestions.push({
      type: "high_handover",
      severity: "high",
      title: `转人工率偏高（${dashboard.handoverRate}%）`,
      description: `过去7天AI回复中转人工率超过30%，建议检查高频转人工原因并优化AI知识库覆盖范围。`,
      action: "查看转人工分析",
    });
  }

  // 5. Check for high failure rate
  if (dashboard.totalReplies > 0 && dashboard.failureRate > 20) {
    suggestions.push({
      type: "high_failure",
      severity: "high",
      title: `回复失败率偏高（${dashboard.failureRate}%）`,
      description: `过去7天AI回复发送失败率超过20%，建议检查Messenger API连接或Token状态。`,
      action: "检查API连接",
    });
  }

  // 6. Check for draft knowledge entries
  if (knowledgeAnalysis.draftCount > 0) {
    suggestions.push({
      type: "draft_pending",
      severity: "low",
      title: `有 ${knowledgeAnalysis.draftCount} 条知识库草稿待发布`,
      description: `这些草稿来自AI测试中心，尚未发布。发布后将参与正式引擎匹配。`,
      action: "查看知识库草稿",
    });
  }

  // 7. Check for high-usage knowledge (optimization opportunity)
  for (const k of knowledgeAnalysis.usageRanking.slice(0, 3)) {
    if (k.usageCount >= 10) {
      suggestions.push({
        type: "knowledge_optimize",
        severity: "low",
        title: `知识库「${k.topic}」过去命中 ${k.usageCount} 次，可考虑优化内容`,
        description: `高频使用的知识条目，优化内容质量可进一步提升客户满意度。`,
        action: "编辑知识条目",
      });
    }
  }

  return { suggestions };
}

// ---------------------------------------------------------------------------
// AI Replay — Get AI log data for replay into test center
// ---------------------------------------------------------------------------

export async function getAiLogForReplay(logId: number): Promise<{
  id: number;
  customerMessage: string | null;
  platform: string;
  sourceType: string;
  aiEnabled: boolean;
  handoverStatus: string;
  finalSource: string;
  matchedRuleId: number | null;
  matchedKnowledgeId: number | null;
  matchedProductId: number | null;
  aiReply: string | null;
  isHandover: boolean;
  handoverReason: string | null;
  processingTimeMs: number | null;
  processingSteps: any;
  errorCode: string | null;
  errorStage: string | null;
  errorMessage: string | null;
  customerName: string | null;
  createdAt: Date;
} | null> {
  const db = await getDb();
  if (!db) return null;

  const [log] = await db.select({
    id: aiLogs.id,
    customerMessage: aiLogs.customerMessage,
    platform: aiLogs.platform,
    sourceType: aiLogs.sourceType,
    aiEnabled: aiLogs.aiEnabled,
    handoverStatus: aiLogs.handoverStatus,
    finalSource: aiLogs.finalSource,
    matchedRuleId: aiLogs.matchedRuleId,
    matchedKnowledgeId: aiLogs.matchedKnowledgeId,
    matchedProductId: aiLogs.matchedProductId,
    aiReply: aiLogs.aiReply,
    isHandover: aiLogs.isHandover,
    handoverReason: aiLogs.handoverReason,
    processingTimeMs: aiLogs.processingTimeMs,
    processingSteps: aiLogs.processingSteps,
    errorCode: aiLogs.errorCode,
    errorStage: aiLogs.errorStage,
    errorMessage: aiLogs.errorMessage,
    customerName: aiLogs.customerName,
    createdAt: aiLogs.createdAt,
  })
  .from(aiLogs)
  .where(eq(aiLogs.id, logId))
  .limit(1);

  return log || null;
}

// ============================================================================
// AI Regression Test — Database Helpers
// ============================================================================

// --- Regression Sets ---

export async function getRegressionSets() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(regressionSets).orderBy(desc(regressionSets.createdAt));
}

export async function getRegressionSetById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [set] = await db.select().from(regressionSets).where(eq(regressionSets.id, id)).limit(1);
  return set || null;
}

export async function createRegressionSet(data: { name: string; description?: string; category?: string; createdBy: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(regressionSets).values({
    name: data.name,
    description: data.description || null,
    category: data.category || null,
    createdBy: data.createdBy,
  });
  const id = (result as any).insertId;
  const [set] = await db.select().from(regressionSets).where(eq(regressionSets.id, id)).limit(1);
  return set;
}

export async function updateRegressionSet(id: number, data: { name?: string; description?: string; category?: string; isEnabled?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(regressionSets).set(data).where(eq(regressionSets.id, id));
}

export async function deleteRegressionSet(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete questions first
  await db.delete(regressionQuestions).where(eq(regressionQuestions.setId, id));
  await db.delete(regressionSets).where(eq(regressionSets.id, id));
}

// --- Regression Questions ---

export async function getRegressionQuestions(setId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(regressionQuestions)
    .where(eq(regressionQuestions.setId, setId))
    .orderBy(asc(regressionQuestions.sortOrder));
}

export async function addRegressionQuestion(data: {
  setId: number;
  question: string;
  expectedSource?: string;
  expectedKeywords?: string;
  expectedReply?: string;
  category?: string;
  priority?: "low" | "medium" | "high";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [q] = await db.insert(regressionQuestions).values({
    setId: data.setId,
    question: data.question,
    expectedSource: data.expectedSource || null,
    expectedKeywords: data.expectedKeywords || null,
    expectedReply: data.expectedReply || null,
    category: data.category || null,
    priority: data.priority || "medium",
  });
  return q;
}

export async function updateRegressionQuestion(id: number, data: Partial<{
  question: string;
  expectedSource: string;
  expectedKeywords: string;
  expectedReply: string;
  category: string;
  priority: "low" | "medium" | "high";
  isEnabled: boolean;
  sortOrder: number;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(regressionQuestions).set(data).where(eq(regressionQuestions.id, id));
}

export async function deleteRegressionQuestion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(regressionQuestions).where(eq(regressionQuestions.id, id));
}

// --- Regression Runs ---

export async function getRegressionRuns(setId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(regressionRuns)
    .where(eq(regressionRuns.setId, setId))
    .orderBy(desc(regressionRuns.createdAt));
}

export async function getRegressionRunById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [run] = await db.select().from(regressionRuns).where(eq(regressionRuns.id, id)).limit(1);
  return run || null;
}

export async function createRegressionRun(data: {
  setId: number;
  versionId?: number;
  isBaseline: boolean;
  baselineRunId?: number;
  totalQuestions: number;
  runBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(regressionRuns).values({
    setId: data.setId,
    versionId: data.versionId || null,
    isBaseline: data.isBaseline,
    baselineRunId: data.baselineRunId || null,
    totalQuestions: data.totalQuestions,
    runBy: data.runBy,
  });
  const id = (result as any).insertId;
  const [run] = await db.select().from(regressionRuns).where(eq(regressionRuns.id, id)).limit(1);
  return run;
}

export async function updateRegressionRun(id: number, data: Partial<{
  status: "running" | "completed" | "failed";
  passedCount: number;
  failedCount: number;
  accuracy: string;
  avgProcessingMs: number;
  newHits: number;
  lostHits: number;
  sourceChanged: number;
  replyChanged: number;
  noMatchIncreased: number;
  noMatchDecreased: number;
  handoverIncreased: number;
  llmIncreased: number;
  llmDecreased: number;
  errorMessage: string;
  completedAt: Date;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(regressionRuns).set(data).where(eq(regressionRuns.id, id));
}

// --- Regression Run Details ---

export async function createRegressionRunDetail(data: {
  runId: number;
  questionId: number;
  question: string;
  finalSource: string;
  matchedRuleId?: number;
  matchedKnowledgeId?: number;
  matchedProductId?: number;
  aiReply?: string;
  shouldHandover: boolean;
  processingTimeMs: number;
  llmCalled: boolean;
  processingSteps: any;
  baselineSource?: string;
  baselineReply?: string;
  baselineRuleId?: number;
  baselineKnowledgeId?: number;
  baselineProductId?: number;
  baselineIsHandover?: boolean;
  isPassed: boolean;
  differences: any;
  suggestion?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(regressionRunDetails).values(data);
}

export async function getRegressionRunDetails(runId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(regressionRunDetails)
    .where(eq(regressionRunDetails.runId, runId))
    .orderBy(asc(regressionRunDetails.id));
}

// --- AI Versions ---

export async function getAiVersions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiVersions).orderBy(desc(aiVersions.createdAt));
}

export async function getAiVersionById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [ver] = await db.select().from(aiVersions).where(eq(aiVersions.id, id)).limit(1);
  return ver || null;
}

export async function getLatestPublishedVersion() {
  const db = await getDb();
  if (!db) return null;
  const [ver] = await db.select().from(aiVersions)
    .where(eq(aiVersions.status, "published"))
    .orderBy(desc(aiVersions.publishedAt))
    .limit(1);
  return ver || null;
}

export async function createAiVersion(data: {
  versionNumber: string;
  label?: string;
  description?: string;
  knowledgeCount: number;
  ruleCount: number;
  personaId?: number;
  personaSnapshot?: any;
  knowledgeSnapshot?: any;
  rulesSnapshot?: any;
  regressionRunId?: number;
  regressionAccuracy?: string;
  createdBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [ver] = await db.insert(aiVersions).values({
    versionNumber: data.versionNumber,
    label: data.label || null,
    description: data.description || null,
    knowledgeCount: data.knowledgeCount,
    ruleCount: data.ruleCount,
    personaId: data.personaId || null,
    personaSnapshot: data.personaSnapshot || null,
    knowledgeSnapshot: data.knowledgeSnapshot || null,
    rulesSnapshot: data.rulesSnapshot || null,
    regressionRunId: data.regressionRunId || null,
    regressionAccuracy: data.regressionAccuracy || null,
    createdBy: data.createdBy,
  });
  return ver;
}

export async function publishAiVersion(id: number, publishedBy: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Archive all currently published versions
  await db.update(aiVersions).set({ status: "archived" }).where(eq(aiVersions.status, "published"));
  // Publish the new version
  await db.update(aiVersions).set({
    status: "published",
    publishedBy,
    publishedAt: new Date(),
  }).where(eq(aiVersions.id, id));
}

export async function rollbackToVersion(id: number, rolledBackBy: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Archive all currently published versions
  await db.update(aiVersions).set({ status: "archived" }).where(eq(aiVersions.status, "published"));
  // Publish the target version again
  await db.update(aiVersions).set({
    status: "published",
    publishedBy: rolledBackBy,
    publishedAt: new Date(),
  }).where(eq(aiVersions.id, id));
}

// ============================================================================
// V2.0: Live Studio + Order Security Link Functions
// ============================================================================

import { randomBytes } from "crypto";

/**
 * Generate a cryptographically secure random token for order access.
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Get order by order number and secure token (public access, no auth required).
 * Returns sanitized order data safe for public exposure.
 */
export async function getOrderBySecureToken(orderNumber: string, token: string) {
  const db = await getDb();
  if (!db) return null;

  const order = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    physicalStatus: orders.physicalStatus,
    importStatus: (orders as any).importStatus,
    orderCategory: orders.orderCategory,
    totalAmount: orders.totalAmount,
    paidAmount: orders.paidAmount,
    shippingFee: orders.shippingFee,
    discountAmount: orders.discountAmount,
    discountReason: orders.discountReason,
    extraCharge: orders.extraCharge,
    extraChargeDescription: orders.extraChargeDescription,
    creditUsed: orders.creditUsed,
    physicalSubtotal: orders.physicalSubtotal,
    shippingAddress: orders.shippingAddress,
    shippingMethod: orders.shippingMethod,
    courierCompany: orders.courierCompany,
    trackingNumber: orders.trackingNumber,
    paymentMethodName: orders.paymentMethodName,
    receiptUrl: orders.receiptUrl,
    createdAt: orders.createdAt,
    secureToken: orders.secureToken,
    customerName: customers.name,
    customerPhone: customers.phoneNumber,
    customerEmail: customers.email,
    customerAddress: customers.address,
    customerCity: customers.city,
    customerState: customers.state,
    customerPostalCode: customers.postalCode,
  }).from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);

  if (order.length === 0) return null;

  // Verify token matches
  if (!order[0].secureToken || order[0].secureToken !== token) return null;

  const orderData = order[0];

  // Get order items
  const items = await db.select({
    productName: orderItems.productName,
    variationName: orderItems.variationName,
    quantity: orderItems.quantity,
    unitPrice: orderItems.unitPrice,
    subtotal: orderItems.subtotal,
    productType: orderItems.productType,
    productId: orderItems.productId,
  }).from(orderItems).where(eq(orderItems.orderId, orderData.id));

  // Enrich with product images
  const enrichedItems = await Promise.all(items.map(async (i) => {
    const product = await db.select({
      coverImageUrl: products.coverImageUrl,
      isPot: products.isPot,
    }).from(products).where(eq(products.id, i.productId)).limit(1);
    return { ...i, coverImageUrl: product[0]?.coverImageUrl || null, isPot: product[0]?.isPot || false };
  }));

  // Get packages
  const pkgs = await getOrderPackages(orderData.id);

    // Map status to customer-friendly labels
  const localStatusMap: Record<string, string> = {
    "pending": "Pending Payment",
    "receipt_uploaded": "Payment Review",
    "partial_payment": "Partial Payment",
    "hold_order": "Hold Order",
    "packing": "Payment Confirmed",
    "shipped": "Shipped",
    "partial_shipped": "Partial Shipped",
    "completed": "Completed",
    "cancelled": "Cancelled",
  };
  // V2.0.99: XTC import order status map
  const importStatusMap: Record<string, string> = {
    "pending": "Pending Payment",
    "receipt_uploaded": "Payment Review",
    "partial_payment": "Partial Payment",
    "waiting_stock": "Preparing Goods",
    "ready_to_ship": "Preparing Goods",
    "scheduled_ship": "Scheduled Ship",
    "partial_shipped": "Partial Shipped",
    "shipped": "Shipped",
    "completed": "Completed",
    "cancelled": "Cancelled",
  };
  const isImport = orderData.orderCategory === 'import';
  const activeStatus = isImport ? (orderData.importStatus || 'pending') : (orderData.physicalStatus || 'pending');
  const customerStatus = isImport
    ? (importStatusMap[activeStatus] || activeStatus)
    : (localStatusMap[activeStatus] || activeStatus);
  // V2.0.2: Compute amount due for customer-facing display
  const totalNum = parseFloat(orderData.totalAmount || "0");
  const paidNum = parseFloat(orderData.paidAmount || "0");
  const amountDue = Math.max(0, totalNum - paidNum).toFixed(2);
  return {
    ...orderData,
    customerStatus,
    items: enrichedItems,
    packages: pkgs,
    amountDue,
  };
}

/**
 * V2.0.3: Public update shipping address + recalculate shipping fee
 * Called by customer from the public order page (no login required, uses secureToken)
 */
export async function updateOrderShippingAddress(orderNumber: string, token: string, address: string, phone: string, shippingMethod: string) {
  const db = await getDb();
  if (!db) return null;

  // Verify token
  const order = await db.select({
    id: orders.id,
    secureToken: orders.secureToken,
    physicalSubtotal: orders.physicalSubtotal,
    totalAmount: orders.totalAmount,
    creditUsed: orders.creditUsed,
    extraCharge: orders.extraCharge,
    discountAmount: orders.discountAmount,
  }).from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);

  if (order.length === 0) return null;
  if (!order[0].secureToken || order[0].secureToken !== token) return null;

  const orderId = order[0].id;

  // Get order items to calculate weight
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const totalWeight = items.reduce((sum, i) => sum + 0.5 * i.quantity, 0);

  // V2.1: Free shipping threshold excludes special-price items
  const specialSubtotal = items.filter((i: any) => i.priceType === 'special').reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const normalSubtotal = items.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const thresholdSubtotal = normalSubtotal - specialSubtotal;

  // Calculate shipping fee
  let shippingFee = 0;
  if (shippingMethod === 'west_malaysia') {
    if (thresholdSubtotal >= 150) {
      shippingFee = totalWeight <= 10 ? 0 : Math.ceil(totalWeight - 10) * 3;
    } else {
      shippingFee = 15 + (totalWeight <= 10 ? 0 : Math.ceil(totalWeight - 10) * 3);
    }
  } else if (shippingMethod === 'east_malaysia' || shippingMethod === 'east_malaysia_shopee') {
    // V2.0.84: 东马 Shopee 运费固定 RM0
    shippingFee = 0;
  } else if (shippingMethod === 'self_pickup') {
    shippingFee = 0;
  } else if (shippingMethod === 'lalamove') {
    // V2.0.84: Lalamove — 满 RM150 公司承担，未满收 RM15
    shippingFee = thresholdSubtotal >= 150 ? 0 : 15;
  }

  // Recalculate total
  const subtotal = parseFloat(order[0].physicalSubtotal || '0');
  const creditUsed = parseFloat(order[0].creditUsed || '0');
  const extraCharge = parseFloat(order[0].extraCharge || '0');
  const discountAmount = parseFloat(order[0].discountAmount || '0');
  const newTotal = subtotal - discountAmount + extraCharge + shippingFee - creditUsed;

  await db.update(orders).set({
    shippingAddress: address,
    shippingMethod: shippingMethod as any,
    shippingFee: shippingFee.toFixed(2),
    totalAmount: newTotal.toFixed(2),
  }).where(eq(orders.id, orderId));

  // Also update customer phone if provided
  if (phone) {
    const customerRow = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, orderId)).limit(1);
    if (customerRow.length > 0 && customerRow[0].customerId) {
      await db.update(customers).set({ phoneNumber: phone }).where(eq(customers.id, customerRow[0].customerId));
    }
  }

  broadcastChanges(['orders', 'dashboard']);

  // Return updated order
  return await getOrderBySecureToken(orderNumber, token);
}

/**
 * Toggle customer blacklist status.
 */
export async function toggleCustomerBlacklist(customerId: number, isBlacklisted: boolean, reason: string, operatorName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (isBlacklisted) {
    await db.update(customers).set({
      isBlacklisted: true,
      blacklistReason: reason,
      blacklistAt: new Date(),
      blacklistBy: null, // Could store operator ID if available
    }).where(eq(customers.id, customerId));
  } else {
    await db.update(customers).set({
      isBlacklisted: false,
      blacklistReason: null,
      unblacklistAt: new Date(),
      unblacklistBy: null,
    }).where(eq(customers.id, customerId));
  }
  broadcastChanges(["customers"]);
  return { success: true };
}

/**
 * Get customer by commenter PSID or name (for blacklist check from live comments).
 */
export async function getCustomerByCommenter(commenterName: string, commenterPsid?: string) {
  const db = await getDb();
  if (!db) return null;

  if (commenterPsid) {
    const byPsid = await db.select().from(customers)
      .where(eq(customers.messengerId, commenterPsid))
      .limit(1);
    if (byPsid.length > 0) return byPsid[0];
  }

  const byName = await db.select().from(customers)
    .where(eq(customers.facebookName, commenterName))
    .limit(1);
  return byName[0] || null;
}

/** Resolve a live commenter through the same PSID path used by live capture, then blacklist the resolved customer. */
export async function blacklistLiveCommenter(input: {
  commenterName: string;
  commenterPsid?: string | null;
  reason: string;
  operatorName: string;
}) {
  const customer = await findOrCreateCustomer({
    name: input.commenterName,
    phoneNumber: "",
    facebookName: input.commenterName,
    messengerId: input.commenterPsid || undefined,
  });
  await toggleCustomerBlacklist(customer.id, true, input.reason, input.operatorName);
  return { success: true, customerId: customer.id };
}

// ============================================================================
// Live Comment Notes (Staff Note) CRUD
// ============================================================================

export async function getLiveCommentNotes(liveCommentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(liveCommentNotes)
    .where(eq(liveCommentNotes.liveCommentId, liveCommentId))
    .orderBy(desc(liveCommentNotes.createdAt));
}

export async function getLiveRoomNotes(liveRoomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(liveCommentNotes)
    .where(eq(liveCommentNotes.liveRoomId, liveRoomId))
    .orderBy(desc(liveCommentNotes.createdAt));
}

export async function createLiveCommentNote(data: {
  liveCommentId: number;
  liveRoomId: number;
  orderId?: number;
  customerId?: number;
  content: string;
  createdBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(liveCommentNotes).values({
    liveCommentId: data.liveCommentId,
    liveRoomId: data.liveRoomId,
    orderId: data.orderId || null,
    customerId: data.customerId || null,
    content: data.content,
    createdBy: data.createdBy || null,
  });
  broadcastChanges(["liveRooms"]);
  return { id: (result as any)[0].insertId, ...data };
}

export async function deleteLiveCommentNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(liveCommentNotes).where(eq(liveCommentNotes.id, id));
  broadcastChanges(["liveRooms"]);
  return { success: true };
}

/**
 * Send a comment on a Facebook Live video via Graph API.
 * Uses the Page Access Token to post as the page.
 */
export async function sendLiveComment(videoId: string, message: string): Promise<{ success: boolean; commentId?: string; error?: string }> {
  const pageAccessToken = ENV.fbPageAccessToken;
  if (!pageAccessToken) {
    return { success: false, error: "Facebook Page Access Token not configured" };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${videoId}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          access_token: pageAccessToken,
        }),
      }
    );
    const data = await response.json();
    if (data.error) {
      return { success: false, error: data.error.message };
    }
    return { success: true, commentId: data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}


// =============================================================================
// Unified Facebook Auto Order Engine
// Shared by: Facebook Live, Messenger, Post, Reel, Video
// =============================================================================

/**
 * Execute auto order capture — the unified entry point for all Facebook sources.
 * Flow: parse keywords → match products → check stock → create/merge order → deduct stock → return result
 * Caller is responsible for sending the notification (reply to comment or Messenger message).
 */
export async function executeAutoOrderCapture(params: {
  customerName: string;
  customerPsid?: string;
  message: string;
  commentId?: string;
  postId?: string;
  liveVideoId?: string;
  liveRoomId?: number;
  liveType?: string;
  sourceType?: "facebook_live" | "facebook_post" | "facebook_reel" | "messenger" | "campaign_button";
  sourceName?: string;
  campaignId?: number;
  campaignName?: string;
  // For campaign button clicks: pre-matched product (skip keyword parsing)
  preMatchedProducts?: Array<{ keyword: string; quantity: number; productId: number; productName: string; productSku: string; unitPrice: string }>;
}): Promise<{
  success: boolean;
  matched: boolean;
  orderNumber?: string;
  orderId?: number;
  totalAmount?: string;
  secureToken?: string | null;
  merged?: boolean;
  duplicate?: boolean;
  matchedProducts?: Array<{ keyword: string; quantity: number; productName: string; unitPrice: string }>;
  unmatchedKeywords?: string[];
  replyMessage?: string;
}> {
  const { parseCommentKeywords, matchKeywordsToProducts, createOrderFromLiveCapture } = exports;

  // If pre-matched products (e.g., from campaign button click), skip keyword parsing
  let matchedProducts: Array<{
    keyword: string;
    quantity: number;
    productId: number;
    productName: string;
    productSku: string;
    unitPrice: string;
    priceType?: "retail" | "special";
    originalUnitPrice?: string | null;
  }> = [];
  let unmatchedKeywords: string[] = [];

  if (params.preMatchedProducts && params.preMatchedProducts.length > 0) {
    matchedProducts = params.preMatchedProducts;
  } else {
    // Parse keywords from message
    const keywords = (parseCommentKeywords as typeof import("./db").parseCommentKeywords)(params.message);
    if (keywords.length === 0) {
      return { success: false, matched: false };
    }

    // Match keywords to products
    const result = await (matchKeywordsToProducts as typeof import("./db").matchKeywordsToProducts)(keywords);
    matchedProducts = result.matched;
    unmatchedKeywords = result.unmatched.map((u: any) => u.keyword);

    if (matchedProducts.length === 0) {
      return {
        success: false,
        matched: false,
        unmatchedKeywords,
        replyMessage: `抱歉，未找到对应商品。请确认关键词是否正确。`,
      };
    }
  }

  // V2.0.78: Black List check — block AI auto-order for blacklisted customers
  if (params.customerPsid) {
    const customer = await getCustomerByCommenter(params.customerName, params.customerPsid);
    if (customer && customer.isBlacklisted) {
      return {
        success: false,
        matched: true,
        replyMessage: `抱歉，您的账号目前无法自动下单。如有疑问，请直接联系客服。`,
      };
    }
  }

  // Create or merge order
  const orderResult = await (createOrderFromLiveCapture as typeof import("./db").createOrderFromLiveCapture)({
    commenterName: params.customerName,
    commenterPsid: params.customerPsid,
    commentMessage: params.message,
    commentId: params.commentId,
    postId: params.postId,
    liveVideoId: params.liveVideoId,
    liveRoomId: params.liveRoomId,
    liveType: params.liveType,
    matchedProducts,
    sourceName: params.sourceName || "Facebook",
    campaignId: params.campaignId,
    campaignName: params.campaignName,
    sourceType: params.sourceType,
  });

  // Build reply message with order details. The checkout action itself stays a
  // Messenger button so every customer receives their own secure order link.
  const itemList = matchedProducts.map((m) => `${m.priceType === "special" ? "【特价】" : "【普通】"}${m.productName} x${m.quantity} (RM${m.unitPrice})`).join("\n");
  const notificationBreakdown = calculateMerchandiseNotificationBreakdown(
    matchedProducts.map((item) => ({
      productType: "physical" as const,
      priceType: item.priceType || "retail",
      quantity: item.quantity,
      subtotal: Number(item.unitPrice || 0) * item.quantity,
      originalUnitPrice: item.originalUnitPrice || null,
    })),
  );
  const totalAmount = (notificationBreakdown.normalSubtotal + notificationBreakdown.specialSubtotal).toFixed(2);
  const amountBreakdown = [
    `普通商品小计：RM${notificationBreakdown.normalSubtotal.toFixed(2)}`,
    `特价商品小计：RM${notificationBreakdown.specialSubtotal.toFixed(2)}（不计入 RM150 免邮）`,
    `免邮计算基数：RM${notificationBreakdown.freeShippingEligibleSubtotal.toFixed(2)}`,
    "运费：待填写配送资料后计算（目前金额未含运费）",
  ].join("\n");
  const settings = await getSystemSettings();
  const liveWinNoticeTemplate = String((settings as any)?.liveWinNoticeTemplate || "").trim() || [
    "🎉 得标通知！",
    "",
    "{item_list}",
    "",
    "{amount_breakdown}",
    "",
    "请点击下方【查询订单及结账】按钮查看订单详情并完成付款。",
  ].join("\n");
  const templateWithRequiredBreakdown = liveWinNoticeTemplate.includes("{amount_breakdown}")
    || (liveWinNoticeTemplate.includes("{normal_subtotal}")
      && liveWinNoticeTemplate.includes("{special_subtotal}")
      && liveWinNoticeTemplate.includes("{free_shipping_eligible_subtotal}"))
    ? liveWinNoticeTemplate
    : `${liveWinNoticeTemplate}\n\n{amount_breakdown}`;
  const replyMessage = templateWithRequiredBreakdown
    .replace(/\{customer_name\}/g, params.customerName || "")
    .replace(/\{order_number\}/g, orderResult.orderNumber || "")
    .replace(/\{item_list\}/g, itemList)
    .replace(/\{total_amount\}/g, String(totalAmount))
    .replace(/\{normal_subtotal\}/g, notificationBreakdown.normalSubtotal.toFixed(2))
    .replace(/\{special_subtotal\}/g, notificationBreakdown.specialSubtotal.toFixed(2))
    .replace(/\{free_shipping_eligible_subtotal\}/g, notificationBreakdown.freeShippingEligibleSubtotal.toFixed(2))
    .replace(/\{shipping_status\}/g, "待填写配送资料后计算（目前金额未含运费）")
    .replace(/\{amount_breakdown\}/g, amountBreakdown)
    .replace(/\{checkout_link\}/g, "下方【查询订单及结账】按钮");

  return {
    success: true,
    matched: true,
    orderNumber: orderResult.orderNumber,
    orderId: orderResult.orderId,
    totalAmount,
    secureToken: orderResult.secureToken ?? null,
    merged: (orderResult as any).merged || false,
    duplicate: (orderResult as any).duplicate || false,
    matchedProducts: matchedProducts.map((m) => ({ keyword: m.keyword, quantity: m.quantity, productName: m.productName, unitPrice: m.unitPrice })),
    unmatchedKeywords,
    replyMessage,
  };
}

// =============================================================================
// Campaign CRUD helpers
// =============================================================================

export async function getCampaigns(includeArchived = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let query = db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  if (!includeArchived) {
    query = query.where(ne(campaigns.status, "archived" as any)) as any;
  }
  return await query;
}

/**
 * Get aggregated statistics for a single Campaign.
 * Returns: commentCount, messengerCount, autoOrderCount, mergedOrderCount,
 *          totalQuantity, totalRevenue
 */
export async function getCampaignStats(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Aggregate orders linked to this campaign
  const stats = await db.select({
    autoOrderCount: sql`COUNT(CASE WHEN ${orders.sourceType} IS NOT NULL AND ${orders.sourceType} != 'manual' THEN 1 END)`,
    mergedOrderCount: sql`COUNT(CASE WHEN ${orders.sourceType} IS NOT NULL AND ${orders.sourceType} != 'manual' AND ${orders.physicalStatus} != 'pending' THEN 1 END)`,
    totalQuantity: sql`COALESCE(SUM((SELECT COALESCE(SUM(${orderItems.quantity}), 0) FROM ${orderItems} WHERE ${orderItems.orderId} = ${orders.id})), 0)`,
    totalRevenue: sql`COALESCE(SUM(${orders.totalAmount}), 0)`,
  }).from(orders).where(eq(orders.campaignId, campaignId));
  return stats[0] || { autoOrderCount: 0, mergedOrderCount: 0, totalQuantity: 0, totalRevenue: '0' };
}

/**
 * Get statistics for all campaigns in a single query.
 * Returns array of { campaignId, autoOrderCount, mergedOrderCount, totalQuantity, totalRevenue }
 */
export async function getAllCampaignStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const stats = await db.select({
    campaignId: orders.campaignId,
    autoOrderCount: sql`COUNT(*)`,
    mergedOrderCount: sql`COUNT(CASE WHEN ${orders.physicalStatus} != 'pending' THEN 1 END)`,
    totalQuantity: sql`COALESCE(SUM((SELECT COALESCE(SUM(${orderItems.quantity}), 0) FROM ${orderItems} WHERE ${orderItems.orderId} = ${orders.id})), 0)`,
    totalRevenue: sql`COALESCE(SUM(${orders.totalAmount}), 0)`,
  }).from(orders)
    .where(sql`${orders.campaignId} IS NOT NULL`)
    .groupBy(orders.campaignId);
  return stats;
}

export async function getCampaignById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return result[0] || null;
}

/**
 * Parse a Facebook URL to extract Post ID, Video ID, Page ID, and content type.
 * Supports formats:
 * - https://www.facebook.com/{page}/posts/{post_id}
 * - https://www.facebook.com/{page}/videos/{video_id}
 * - https://www.facebook.com/{page}/reel/{reel_id}
 * - https://fb.watch/{short_code}/
 * - https://www.facebook.com/share/v/{share_code}
 * - https://www.facebook.com/{page}/posts/pfbid{post_fbid}
 */
export function parseFacebookLink(link: string): {
  facebookPostId: string | null;
  facebookVideoId: string | null;
  facebookPageId: string | null;
  contentType: "post" | "reel" | "video";
  hasPostAndReel: boolean;
} {
  const result = {
    facebookPostId: null as string | null,
    facebookVideoId: null as string | null,
    facebookPageId: null as string | null,
    contentType: "post" as "post" | "reel" | "video",
    hasPostAndReel: false,
  };
  if (!link) return result;
  try {
    const url = new URL(link);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Extract page name/id from first path segment
    if (pathParts.length > 0) {
      result.facebookPageId = pathParts[0];
    }
    // Check for /posts/{id} pattern
    const postsIdx = pathParts.indexOf("posts");
    if (postsIdx >= 0 && pathParts[postsIdx + 1]) {
      result.facebookPostId = pathParts[postsIdx + 1];
      result.contentType = "post";
    }
    // Check for /videos/{id} pattern
    const videosIdx = pathParts.indexOf("videos");
    if (videosIdx >= 0 && pathParts[videosIdx + 1]) {
      result.facebookVideoId = pathParts[videosIdx + 1];
      result.contentType = "video";
    }
    // Check for /reel/{id} pattern
    const reelIdx = pathParts.indexOf("reel");
    if (reelIdx >= 0 && pathParts[reelIdx + 1]) {
      result.facebookVideoId = pathParts[reelIdx + 1];
      result.contentType = "reel";
    }
    // Check for /share/v/{code} pattern (often Reels)
    const shareIdx = pathParts.indexOf("share");
    if (shareIdx >= 0 && pathParts[shareIdx + 1] === "v" && pathParts[shareIdx + 2]) {
      result.facebookVideoId = pathParts[shareIdx + 2];
      result.contentType = "reel";
      result.hasPostAndReel = true; // Share links may be post or reel
    }
    // Check for fb.watch short links
    if (url.hostname === "fb.watch") {
      result.facebookVideoId = pathParts[0] || null;
      result.contentType = "video";
    }
    // Check for /permalink.php or story_fbid pattern
    const storyFbid = url.searchParams.get("story_fbid");
    if (storyFbid) {
      result.facebookPostId = storyFbid;
      result.contentType = "post";
    }
    const pageIdParam = url.searchParams.get("id");
    if (pageIdParam) {
      result.facebookPageId = pageIdParam;
    }
  } catch {
    // Not a valid URL, return defaults
  }
  return result;
}

export async function createCampaign(data: {
  name: string;
  type?: "post" | "reel" | "video";
  facebookLink?: string;
  facebookPostId?: string;
  startDate?: Date;
  endDate?: Date;
  autoReplyEnabled?: boolean;
  autoReplyText?: string;
  messengerFlowEnabled?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Auto-parse Facebook Link if provided
  let type = data.type || "post";
  let facebookPostId = data.facebookPostId || null;
  let facebookVideoId: string | null = null;
  let facebookPageId: string | null = null;
  if (data.facebookLink) {
    const parsed = parseFacebookLink(data.facebookLink);
    if (parsed.facebookPostId) facebookPostId = parsed.facebookPostId;
    if (parsed.facebookVideoId) facebookVideoId = parsed.facebookVideoId;
    if (parsed.facebookPageId) facebookPageId = parsed.facebookPageId;
    if (parsed.contentType) type = parsed.contentType;
  }
  const result = await db.insert(campaigns).values({
    name: data.name,
    type,
    facebookLink: data.facebookLink || null,
    facebookPostId,
    facebookVideoId,
    facebookPageId,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    status: "draft",
    autoReplyEnabled: data.autoReplyEnabled ?? true,
    autoReplyText: data.autoReplyText || null,
    messengerFlowEnabled: data.messengerFlowEnabled ?? true,
  });
  const insertId = (result as any)[0].insertId;
  // Auto-create content ID binding from parsed link
  if (data.facebookLink) {
    const parsed = parseFacebookLink(data.facebookLink);
    const contentId = parsed.facebookPostId || parsed.facebookVideoId;
    if (contentId) {
      await db.insert(campaignContentIds).values({
        campaignId: insertId,
        contentType: parsed.contentType,
        contentId,
        facebookLink: data.facebookLink,
      }).catch(() => {}); // Ignore duplicate errors
    }
  }
  broadcastChanges(["campaigns"]);
  return { id: insertId };
}

// --- Campaign Content IDs management ---
export async function getCampaignContentIds(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(campaignContentIds).where(eq(campaignContentIds.campaignId, campaignId)).orderBy(asc(campaignContentIds.id));
}

export async function addCampaignContentId(data: {
  campaignId: number;
  contentType: "post" | "reel" | "video";
  contentId: string;
  facebookLink?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
 // Parse link if provided to auto-detect type and ID
  let contentType = data.contentType;
  let contentId = data.contentId;
  let facebookLink = data.facebookLink || null;
  if (data.facebookLink) {
    const parsed = parseFacebookLink(data.facebookLink);
    if (parsed.facebookPostId) contentId = parsed.facebookPostId;
    else if (parsed.facebookVideoId) contentId = parsed.facebookVideoId;
    if (parsed.contentType) contentType = parsed.contentType;
  }
  await db.insert(campaignContentIds).values({
    campaignId: data.campaignId,
    contentType,
    contentId,
    facebookLink,
  }).catch(() => {}); // Ignore duplicate errors
  broadcastChanges(["campaigns"]);
  return { success: true };
}

export async function removeCampaignContentId(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(campaignContentIds).where(eq(campaignContentIds.id, id));
  broadcastChanges(["campaigns"]);
  return { success: true };
}

// Find campaign by any content ID (Post ID, Video ID, Reel ID)
export async function findCampaignByContentId(contentId: string): Promise<any | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db.select({
    campaign: campaigns,
  }).from(campaignContentIds)
    .innerJoin(campaigns, eq(campaignContentIds.campaignId, campaigns.id))
    .where(eq(campaignContentIds.contentId, contentId))
    .limit(1);
  return results[0]?.campaign || null;
}

export async function updateCampaign(id: number, data: Partial<{
  name: string;
  type: "post" | "reel" | "video";
  facebookLink: string;
  facebookPostId: string;
  facebookVideoId: string;
  facebookPageId: string;
  startDate: Date;
  endDate: Date;
  status: "draft" | "active" | "ended" | "archived";
  autoReplyEnabled: boolean;
  autoReplyText: string;
  messengerFlowEnabled: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Auto-parse Facebook Link if provided but no explicit IDs
  const updateData: any = { ...data };
  if (data.facebookLink && !data.facebookPostId && !data.type) {
    const parsed = parseFacebookLink(data.facebookLink);
    if (parsed.facebookPostId) updateData.facebookPostId = parsed.facebookPostId;
    if (parsed.facebookVideoId) updateData.facebookVideoId = parsed.facebookVideoId;
    if (parsed.facebookPageId) updateData.facebookPageId = parsed.facebookPageId;
    if (parsed.contentType) updateData.type = parsed.contentType;
  }
  await db.update(campaigns).set(updateData).where(eq(campaigns.id, id));
  broadcastChanges(["campaigns"]);
  return { success: true };
}

export async function deleteCampaign(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related content IDs, flows and buttons first
  await db.delete(campaignContentIds).where(eq(campaignContentIds.campaignId, id));
  await db.delete(campaignButtons).where(eq(campaignButtons.campaignId, id));
  await db.delete(campaignFlows).where(eq(campaignFlows.campaignId, id));
  await db.delete(campaigns).where(eq(campaigns.id, id));
  broadcastChanges(["campaigns"]);
  return { success: true };
}

export async function duplicateCampaign(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const original = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!original[0]) throw new Error("Campaign not found");

  const orig = original[0];
  const newCampaign = await db.insert(campaigns).values({
    name: `${orig.name} (副本)`,
    type: orig.type,
    facebookLink: orig.facebookLink,
    facebookPostId: orig.facebookPostId,
    startDate: null,
    endDate: null,
    status: "draft",
    autoReplyEnabled: orig.autoReplyEnabled,
    autoReplyText: orig.autoReplyText,
    messengerFlowEnabled: orig.messengerFlowEnabled,
  });
  const newCampaignId = (newCampaign as any)[0].insertId;

  // Copy flows
  const flows = await db.select().from(campaignFlows).where(eq(campaignFlows.campaignId, id));
  const flowIdMap = new Map<number, number>();
  for (const flow of flows) {
    const newFlow = await db.insert(campaignFlows).values({
      campaignId: newCampaignId,
      sortOrder: flow.sortOrder,
      type: flow.type,
      text: flow.text,
      mediaUrl: flow.mediaUrl,
      mediaType: flow.mediaType,
      buttonConfig: flow.buttonConfig,
      productId: flow.productId,
    });
    const newFlowId = (newFlow as any)[0].insertId;
    flowIdMap.set(flow.id, newFlowId);
  }

  // Copy buttons
  const buttons = await db.select().from(campaignButtons).where(eq(campaignButtons.campaignId, id));
  for (const btn of buttons) {
    await db.insert(campaignButtons).values({
      campaignId: newCampaignId,
      flowId: btn.flowId ? (flowIdMap.get(btn.flowId) || null) : null,
      name: btn.name,
      productId: btn.productId,
      variantId: btn.variantId,
      quantity: btn.quantity,
      sortOrder: btn.sortOrder,
      isActive: btn.isActive,
    });
  }

  broadcastChanges(["campaigns"]);
  return { id: newCampaignId };
}

// --- Campaign Flow helpers ---

export async function getCampaignFlows(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(campaignFlows)
    .where(eq(campaignFlows.campaignId, campaignId))
    .orderBy(campaignFlows.sortOrder);
}

export async function createCampaignFlow(data: {
  campaignId: number;
  sortOrder: number;
  type: "text" | "image" | "video" | "audio" | "file" | "product_intro" | "button";
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
  buttonConfig?: string;
  productId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(campaignFlows).values({
    campaignId: data.campaignId,
    sortOrder: data.sortOrder,
    type: data.type,
    text: data.text || null,
    mediaUrl: data.mediaUrl || null,
    mediaType: data.mediaType || null,
    buttonConfig: data.buttonConfig || null,
    productId: data.productId || null,
  });
  broadcastChanges(["campaigns"]);
  return { id: (result as any)[0].insertId };
}

export async function updateCampaignFlow(id: number, data: Partial<{
  sortOrder: number;
  type: "text" | "image" | "video" | "audio" | "file" | "product_intro" | "button";
  text: string;
  mediaUrl: string;
  mediaType: string;
  buttonConfig: string;
  productId: number;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(campaignFlows).set(data as any).where(eq(campaignFlows.id, id));
  broadcastChanges(["campaigns"]);
  return { success: true };
}

export async function deleteCampaignFlow(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related buttons
  await db.delete(campaignButtons).where(eq(campaignButtons.flowId, id));
  await db.delete(campaignFlows).where(eq(campaignFlows.id, id));
  broadcastChanges(["campaigns"]);
  return { success: true };
}

// --- Campaign Button helpers ---

export async function getCampaignButtons(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(campaignButtons)
    .where(eq(campaignButtons.campaignId, campaignId))
    .orderBy(campaignButtons.sortOrder);
}

export async function createCampaignButton(data: {
  campaignId: number;
  flowId?: number;
  name: string;
  productId: number;
  variantId?: number;
  quantity: number;
  sortOrder: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(campaignButtons).values({
    campaignId: data.campaignId,
    flowId: data.flowId || null,
    name: data.name,
    productId: data.productId,
    variantId: data.variantId || null,
    quantity: data.quantity,
    sortOrder: data.sortOrder,
    isActive: true,
  });
  broadcastChanges(["campaigns"]);
  return { id: (result as any)[0].insertId };
}

export async function updateCampaignButton(id: number, data: Partial<{
  name: string;
  productId: number;
  variantId: number;
  quantity: number;
  sortOrder: number;
  isActive: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(campaignButtons).set(data as any).where(eq(campaignButtons.id, id));
  broadcastChanges(["campaigns"]);
  return { success: true };
}

export async function deleteCampaignButton(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(campaignButtons).where(eq(campaignButtons.id, id));
  broadcastChanges(["campaigns"]);
  return { success: true };
}

// ============================================================================
// V2.0.97: CN/IB System - New functions for China Purchase Order & Arrival Inspection
// ============================================================================

// Generate CN number (CN00001, CN00002, ...)
export async function generateCnNumber() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const batches = await db.select().from(importBatches)
    .where(eq(importBatches.documentType, 'cn'))
    .orderBy(importBatches.id);
  const nextNum = batches.length + 1;
  return `CN${String(nextNum).padStart(5, '0')}`;
}

// Confirm CN (change status from draft to purchased, auto-generate IB items)
export async function confirmCn(batchId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const batch = await getImportBatchById(batchId);
  if (!batch) throw new Error('Batch not found');

  // Update batch status to purchased
  await db.update(importBatches).set({
    status: 'purchased' as any,
    ibGenerated: true,
    actualPurchaseDate: new Date(),
  } as any).where(eq(importBatches.id, batchId));

  // Auto-calculate total estimated cost
  const items = await getImportBatchItems(batchId);
  let totalPurchaseCost = 0;
  for (const item of items) {
    const qty = item.finalPurchaseQuantity || item.paidQuantity || 0;
    const unitCost = parseFloat(item.unitPurchaseCost?.toString() || '0');
    totalPurchaseCost += unitCost * qty;
  }
  const shippingCost = parseFloat(batch.chinaShippingCost?.toString() || '0');
  const otherFees = parseFloat((batch as any).otherFees?.toString() || '0');
  const totalEstimated = totalPurchaseCost + shippingCost + otherFees;
  await db.update(importBatches).set({
    totalEstimatedCost: totalEstimated.toFixed(2) as any,
  } as any).where(eq(importBatches.id, batchId));

  return { success: true, totalEstimatedCost: totalEstimated.toFixed(2) };
}

// Complete IB verification (after all items verified, update stock and auto-match XTC orders)
export async function completeIbVerification(batchId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const batch = await getImportBatchById(batchId);
  if (!batch) throw new Error('Batch not found');

  const items = await getImportBatchItems(batchId);

  // Calculate total actual cost
  let totalActualCost = 0;
  for (const item of items) {
    const receivedQty = (item.healthyQty || 0);
    const unitCost = parseFloat(item.unitPurchaseCost?.toString() || '0');
    const allocatedShipping = parseFloat(item.allocatedShippingCost?.toString() || '0');
    const allocatedOther = parseFloat((item as any).allocatedOtherFees?.toString() || '0');
    const totalUnitCost = unitCost + allocatedShipping + allocatedOther;
    totalActualCost += totalUnitCost * receivedQty;

    // Update item totalUnitCost
    await db.update(importBatchItems).set({
      totalUnitCost: totalUnitCost.toFixed(2) as any,
    }).where(eq(importBatchItems.id, item.id));
  }

  // Update batch status and actual cost
  const allArrived = items.every(i => i.itemStatus === 'all_arrived');
  const anyArrived = items.some(i => i.itemStatus === 'all_arrived' || i.itemStatus === 'partial_arrived');
  const newStatus = allArrived ? 'all_arrived' : (anyArrived ? 'partial_arrived' : 'in_transit');

  await db.update(importBatches).set({
    status: newStatus as any,
    totalActualCost: totalActualCost.toFixed(2) as any,
  } as any).where(eq(importBatches.id, batchId));

  // Update product stock (On Hand) based on healthy items
  for (const item of items) {
    if (item.healthyQty && item.healthyQty > 0) {
      // Find product variation and update stock
      if (item.variantId) {
        const variations = await db.select().from(productVariations).where(eq(productVariations.id, item.variantId));
        if (variations.length > 0) {
          const currentStock = parseInt(variations[0].stockQuantity?.toString() || '0');
          await db.update(productVariations).set({
            stockQuantity: (currentStock + item.healthyQty) as any,
          }).where(eq(productVariations.id, item.variantId));
        }
      }
    }
  }

  // Auto-match XTC orders
  await autoMatchXtcOrders(batchId);

  return { success: true, totalActualCost: totalActualCost.toFixed(2), newStatus };
}

/**
 * Orders are linked to their CN, not to its automatic or split-arrival IB.
 * Legacy standalone IBs retain their own ID as the order-link target.
 */
async function getImportOrderLinkBatchId(batchId: number): Promise<number> {
  const batch = await getImportBatchById(batchId);
  if (!batch) throw new Error('Batch not found');
  return (batch as any).documentType === 'ib' && (batch as any).cnId
    ? Number((batch as any).cnId)
    : batchId;
}

// Auto-match XTC orders after IB verification
export async function autoMatchXtcOrders(batchId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Automatic and split-arrival IBs must read the orders linked to their CN.
  const orderLinkBatchId = await getImportOrderLinkBatchId(batchId);
  const batchOrders = await db.select().from(orders).where(
    eq((orders as any).importBatchId, orderLinkBatchId as any)
  );

  // Get batch items once for matching
  const batchItems = await getImportBatchItems(batchId);

  const results: Array<{ orderId: number; orderNumber: string; status: string; matchedItems: number; totalItems: number }> = [];

  for (const order of batchOrders) {
    if (order.physicalStatus === 'cancelled' || order.physicalStatus === 'completed') continue;

    // Get order items
    const orderItemsList = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

    let allFulfilled = true;
    let matchedCount = 0;

    for (const oi of orderItemsList) {
      // Check if this product variant has enough stock in the batch
      const batchItem = batchItems.find(
        (bi: any) => bi.productId === oi.productId && bi.variantId === oi.variationId
      );
      if (batchItem) {
        const healthyQty = (batchItem as any).healthyQty || 0;
        const orderQty = oi.quantity || 0;
        if (healthyQty >= orderQty) {
          matchedCount++;
        } else {
          allFulfilled = false;
        }
      } else {
        allFulfilled = false;
      }
    }

        // Update XTC import status
    let newImportStatus: string;
    if (allFulfilled && matchedCount === orderItemsList.length) {
      // Check if order has scheduled shipping date
      const orderData = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
      if (orderData[0]?.scheduledShippingDate) {
        newImportStatus = 'scheduled_ship';
      } else {
        newImportStatus = 'ready_to_ship';
      }
    } else {
      newImportStatus = 'waiting_stock';
    }
    await db.update(orders).set({
      importStatus: newImportStatus as any,
    }).where(eq(orders.id, order.id));
    results.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: newImportStatus,
      matchedItems: matchedCount,
      totalItems: orderItemsList.length,
    });
  }

  return results;
}

// Allocate all costs (shipping + other fees) to batch items
export async function allocateAllCosts(batchId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const batch = await getImportBatchById(batchId);
  if (!batch) throw new Error('Batch not found');
  const items = await getImportBatchItems(batchId);
  if (items.length === 0) return { allocated: 0 };

  const totalQty = items.reduce((sum, i) => sum + (i.finalPurchaseQuantity || i.paidQuantity || 0), 0);
  if (totalQty === 0) return { allocated: 0 };

  const totalShipping = parseFloat(batch.chinaShippingCost?.toString() || '0');
  const totalOtherFees = parseFloat((batch as any).otherFees?.toString() || '0');
  const perUnitShipping = totalShipping / totalQty;
  const perUnitOther = totalOtherFees / totalQty;

  for (const item of items) {
    const qty = item.finalPurchaseQuantity || item.paidQuantity || 0;
    const unitCost = parseFloat(item.unitPurchaseCost?.toString() || '0');
    const totalUnitCost = (unitCost + perUnitShipping + perUnitOther).toFixed(2);
    await db.update(importBatchItems).set({
      allocatedShippingCost: perUnitShipping.toFixed(2) as any,
      allocatedOtherFees: perUnitOther.toFixed(2) as any,
      totalUnitCost: totalUnitCost as any,
    } as any).where(eq(importBatchItems.id, item.id));
  }

  return { perUnitShipping, perUnitOther, totalQty, totalShipping, totalOtherFees };
}

// Get CN/IB batch detail with items and linked orders
export async function getCnIbBatchDetail(batchId: number) {
  const db = await getDb();
  if (!db) return null;
  const batch = await getImportBatchById(batchId);
  if (!batch) return null;
  const items = await getImportBatchItems(batchId);

  // CN owns the order relationship; automatic/split IBs inherit it through cnId.
  const orderLinkBatchId = await getImportOrderLinkBatchId(batchId);
  const linkedOrders = await db.select().from(orders).where(
    eq((orders as any).importBatchId, orderLinkBatchId as any)
  );

  return {
    batch,
    items,
    linkedOrders: linkedOrders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.facebookName || '-',
      physicalStatus: o.physicalStatus,
      importStatus: o.importStatus,
      totalAmount: o.totalAmount,
      paidAmount: o.paidAmount,
    })),
  };
}

// ============================================================================
// V2.0.97: CN/IB Cost-Profit Analysis (CN/IB 成本利润分析)
// ============================================================================

export async function getCnIbCostProfit(batchId: number) {
  const db = await getDb();
  if (!db) return null;

  const batch = await getImportBatchById(batchId);
  if (!batch) return null;

  const items = await getImportBatchItems(batchId);

  // CN estimated cost: sum of (unitPurchaseCost * finalPurchaseQuantity) + chinaShippingCost + otherFees
  let cnEstimatedCost = 0;
  for (const item of items) {
    const qty = item.finalPurchaseQuantity || item.paidQuantity || 0;
    const unitCost = parseFloat(item.unitPurchaseCost?.toString() || '0');
    cnEstimatedCost += unitCost * qty;
  }
  cnEstimatedCost += parseFloat(batch.chinaShippingCost?.toString() || '0');
  cnEstimatedCost += parseFloat((batch as any).otherFees?.toString() || '0');

  // IB actual cost: sum of (unitPurchaseCost * healthyQty) + allocatedShippingCost + allocatedOtherFees
  let ibActualCost = 0;
  let totalHealthyQty = 0;
  let totalDamagedQty = 0;
  let totalDeadQty = 0;
  let totalMissingQty = 0;
  let totalWrongItemQty = 0;
  for (const item of items) {
    const healthy = item.healthyQty || 0;
    const unitCost = parseFloat(item.unitPurchaseCost?.toString() || '0');
    const allocatedShipping = parseFloat(item.allocatedShippingCost?.toString() || '0');
    const allocatedOther = parseFloat((item as any).allocatedOtherFees?.toString() || '0');
    ibActualCost += unitCost * healthy + allocatedShipping + allocatedOther;
    totalHealthyQty += healthy;
    totalDamagedQty += item.damagedQty || 0;
    totalDeadQty += item.deadQty || 0;
    totalMissingQty += item.missingQty || 0;
    totalWrongItemQty += (item as any).wrongItemQty || 0;
  }

  // CN owns the order relationship; automatic/split IBs inherit it through cnId.
  const orderLinkBatchId = await getImportOrderLinkBatchId(batchId);
  const linkedOrders = await db.select().from(orders).where(
    eq((orders as any).importBatchId, orderLinkBatchId as any)
  );

  let totalRevenue = 0;
  let totalPaidAmount = 0;
  let matchedOrderCount = 0;
  for (const o of linkedOrders) {
    totalRevenue += parseFloat(o.totalAmount?.toString() || '0');
    totalPaidAmount += parseFloat(o.paidAmount?.toString() || '0');
    if (o.physicalStatus !== 'pending' && o.physicalStatus !== 'cancelled') {
      matchedOrderCount++;
    }
  }

  // Calculate profit
  const grossProfit = totalRevenue - ibActualCost;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Scrap loss (damaged + dead + missing)
  let scrapLoss = 0;
  for (const item of items) {
    const unitCost = parseFloat(item.unitPurchaseCost?.toString() || '0');
    scrapLoss += unitCost * ((item.damagedQty || 0) + (item.deadQty || 0) + (item.missingQty || 0));
  }

  return {
    batchInfo: {
      batchNumber: batch.batchNumber,
      batchName: batch.batchName,
      status: batch.status,
      ibGenerated: (batch as any).ibGenerated || false,
    },
    cnEstimatedCost: cnEstimatedCost.toFixed(2),
    ibActualCost: ibActualCost.toFixed(2),
    totalRevenue: totalRevenue.toFixed(2),
    totalPaidAmount: totalPaidAmount.toFixed(2),
    grossProfit: grossProfit.toFixed(2),
    grossMargin: grossMargin.toFixed(1),
    matchedOrderCount,
    totalOrders: linkedOrders.length,
    scrapLoss: scrapLoss.toFixed(2),
    quantitySummary: {
      healthy: totalHealthyQty,
      damaged: totalDamagedQty,
      dead: totalDeadQty,
      missing: totalMissingQty,
      wrongItem: totalWrongItemQty,
    },
    items: items.map(item => ({
      productName: item.productName,
      paidQuantity: item.paidQuantity,
      finalPurchaseQuantity: item.finalPurchaseQuantity,
      healthyQty: item.healthyQty || 0,
      damagedQty: item.damagedQty || 0,
      deadQty: item.deadQty || 0,
      missingQty: item.missingQty || 0,
      wrongItemQty: (item as any).wrongItemQty || 0,
      unitPurchaseCost: item.unitPurchaseCost?.toString() || '0',
      allocatedShippingCost: item.allocatedShippingCost?.toString() || '0',
      allocatedOtherFees: (item as any).allocatedOtherFees?.toString() || '0',
      totalUnitCost: item.totalUnitCost?.toString() || '0',
      itemStatus: item.itemStatus,
      differenceReason: (item as any).differenceReason || 'none',
    })),
  };
}

// ============================================================================
// V2.0.98: CN/IB 4 Key Rules + Priority Stock Allocation
// ============================================================================

// Rule 1: Priority-based stock allocation (by fullPaymentConfirmedAt)
export async function allocateStockByPriority(batchId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const batch = await getImportBatchById(batchId);
  if (!batch) throw new Error('Batch not found');

  const batchItems = await getImportBatchItems(batchId);

  // CN owns the order relationship; automatic/split IBs inherit it through cnId.
  const orderLinkBatchId = await getImportOrderLinkBatchId(batchId);
  const linkedOrders = await db.select().from(orders).where(
    eq((orders as any).importBatchId, orderLinkBatchId as any)
  );

  // Filter orders that need stock (not cancelled/completed)
  const activeOrders = linkedOrders.filter(
    o => o.physicalStatus !== 'cancelled' && o.physicalStatus !== 'completed'
  );

  // Sort by fullPaymentConfirmedAt ascending (earliest full payment first)
  // If no fullPaymentConfirmedAt, sort by paymentConfirmedAt, then by createdAt as fallback
  activeOrders.sort((a, b) => {
    const aTime = (a as any).fullPaymentConfirmedAt || (a as any).paymentConfirmedAt || a.createdAt;
    const bTime = (b as any).fullPaymentConfirmedAt || (b as any).paymentConfirmedAt || b.createdAt;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });

  const allocations: Array<{
    orderId: number;
    orderNumber: string;
    productId: number;
    variantId: number | null;
    allocatedQty: number;
    requestedQty: number;
    shortQty: number;
  }> = [];

  for (const bi of batchItems) {
    const availableQty = bi.healthyQty || 0;
    if (availableQty <= 0) continue;

    // Collect all order items matching this batch item
    const orderItemRequests: Array<{
      orderId: number;
      orderNumber: string;
      productId: number;
      variantId: number | null;
      requestedQty: number;
    }> = [];

    for (const order of activeOrders) {
      const orderItemsList = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      for (const oi of orderItemsList) {
        if (oi.productId === bi.productId && (oi.variationId || null) === (bi.variantId || null)) {
          orderItemRequests.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            productId: oi.productId,
            variantId: oi.variationId || null,
            requestedQty: oi.quantity || 0,
          });
        }
      }
    }

    // Sort requests by priority (already sorted by fullPaymentConfirmedAt)
    // Allocate stock in priority order
    let remainingStock = availableQty;
    for (const req of orderItemRequests) {
      const allocated = Math.min(remainingStock, req.requestedQty);
      const short = req.requestedQty - allocated;

      if (allocated > 0) {
        // Record allocation
        await db.insert(stockAllocations).values({
          batchId,
          orderId: req.orderId,
          orderNumber: req.orderNumber,
          productId: req.productId,
          variantId: req.variantId,
          allocatedQty: allocated,
          allocationType: 'auto',
        } as any);

        remainingStock -= allocated;
      }

      allocations.push({
        orderId: req.orderId,
        orderNumber: req.orderNumber,
        productId: req.productId,
        variantId: req.variantId,
        allocatedQty: allocated,
        requestedQty: req.requestedQty,
        shortQty: short,
      });
    }
  }

    // Update XTC import status based on allocation results
  for (const order of activeOrders) {
    const orderAllocations = allocations.filter(a => a.orderId === order.id);
    const allFulfilled = orderAllocations.length > 0 && orderAllocations.every(a => a.shortQty === 0);
    let newImportStatus: string;
    if (allFulfilled) {
      // Check if order has scheduled shipping date
      const orderData = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
      if (orderData[0]?.scheduledShippingDate) {
        newImportStatus = 'scheduled_ship';
      } else {
        newImportStatus = 'ready_to_ship';
      }
    } else {
      newImportStatus = 'waiting_stock';
    }
    await db.update(orders).set({
      importStatus: newImportStatus as any,
    }).where(eq(orders.id, order.id));
  }

  return allocations;
}

// Rule 2: Create IB difference record
export async function createIbDifference(data: {
  batchId: number;
  cnBatchNumber?: string;
  supplierName?: string;
  productId: number;
  productName: string;
  variantId?: number;
  variantName?: string;
  cnPurchaseQty: number;
  ibReceivedQty: number;
  differenceType: string;
  reason?: string;
  evidenceUrl?: string;
  needsReplenish?: boolean;
  needsRefund?: boolean;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const differenceQty = data.cnPurchaseQty - data.ibReceivedQty;

  const [record] = await db.insert(ibDifferences).values({
    batchId: data.batchId,
    cnBatchNumber: data.cnBatchNumber || null,
    supplierName: data.supplierName || null,
    productId: data.productId,
    productName: data.productName,
    variantId: data.variantId || null,
    variantName: data.variantName || null,
    cnPurchaseQty: data.cnPurchaseQty,
    ibReceivedQty: data.ibReceivedQty,
    differenceQty,
    differenceType: data.differenceType as any,
    reason: data.reason || null,
    evidenceUrl: data.evidenceUrl || null,
    needsReplenish: data.needsReplenish || false,
    needsRefund: data.needsRefund || false,
    processStatus: 'pending',
    notes: data.notes || null,
  } as any).$returningId();

  return record;
}

// Get IB differences for a batch
export async function getIbDifferences(batchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ibDifferences).where(eq(ibDifferences.batchId, batchId));
}

// Rule 3: Link multiple CNs to the same XTC batch (parent-child relationship)
export async function linkCnToParentBatch(batchId: number, parentBatchId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.update(importBatches).set({
    parentBatchId,
  } as any).where(eq(importBatches.id, batchId));

  return { success: true };
}

// Get all CNs linked to the same parent batch
export async function getLinkedCns(parentBatchId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get the parent batch itself + all child batches
  const parent = await getImportBatchById(parentBatchId);
  const children = await db.select().from(importBatches).where(
    eq((importBatches as any).parentBatchId, parentBatchId as any)
  );

  return [parent, ...children].filter(Boolean);
}

// Rule 4: Complete stock-in and lock costs
export async function completeStockIn(batchId: number, operatorName?: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const batch = await getImportBatchById(batchId);
  if (!batch) throw new Error('Batch not found');

  // Verify all IB items have been verified
  const items = await getImportBatchItems(batchId);
  const unverified = items.filter(i => !i.itemStatus || i.itemStatus === 'pending');
  if (unverified.length > 0) {
    throw new Error(`仍有 ${unverified.length} 项商品未完成验货`);
  }

  // Lock the costs
  await db.update(importBatches).set({
    costLocked: true,
    costLockedAt: new Date(),
    isLocked: true,
    lockedAt: new Date(),
    lockedBy: null,
    status: 'all_arrived',
  } as any).where(eq(importBatches.id, batchId));

  if ((batch as any).documentType === 'ib') {
    await db.insert(cnChangeLogs).values({
      cnId: (batch as any).cnId || batchId,
      field: `IB#${batchId}.stock_in_lock`,
      oldValue: String((batch as any).isLocked),
      newValue: 'true',
      changedBy: null,
    });
  }

  // Run priority-based stock allocation
  const allocations = await allocateStockByPriority(batchId);

  // Log the operation
  await logOrderOperation(
    batchId,
    'stock_in',
    `完成入库 - 成本已锁定，执行优先分货 ${allocations.length} 项`,
    null,
    operatorName
  );

  return {
    success: true,
    costLocked: true,
    allocations,
    allocationCount: allocations.length,
  };
}

// Rule 4: Unlock costs (requires reason)
export async function unlockCosts(batchId: number, reason: string, operatorName: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const batch = await getImportBatchById(batchId);
  if (!batch) throw new Error('Batch not found');

  if (!(batch as any).costLocked) {
    throw new Error('成本未锁定，无需解锁');
  }

  // Record the unlock in cost adjustment log
  await db.insert(costAdjustmentLogs).values({
    batchId,
    fieldName: 'cost_unlock',
    oldValue: 'locked',
    newValue: 'unlocked',
    reason,
    operatorName,
  } as any);

  // Unlock the costs
  await db.update(importBatches).set({
    costLocked: false,
    costLockedAt: null,
    isLocked: false,
    lockedAt: null,
    lockedBy: null,
    unlockReason: reason,
  } as any).where(eq(importBatches.id, batchId));

  if ((batch as any).documentType === 'ib') {
    await db.insert(cnChangeLogs).values({
      cnId: (batch as any).cnId || batchId,
      field: `IB#${batchId}.unlock`,
      oldValue: 'true',
      newValue: reason,
      changedBy: null,
    });
  }

  return { success: true, unlocked: true };
}

// Rule 4: Re-lock costs after modification
export async function relockCosts(batchId: number, operatorName: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const batch = await getImportBatchById(batchId);
  if (!batch) throw new Error('Batch not found');

  await db.update(importBatches).set({
    costLocked: true,
    costLockedAt: new Date(),
    isLocked: true,
    lockedAt: new Date(),
    unlockReason: null,
  } as any).where(eq(importBatches.id, batchId));

  if ((batch as any).documentType === 'ib') {
    await db.insert(cnChangeLogs).values({
      cnId: (batch as any).cnId || batchId,
      field: `IB#${batchId}.relock`,
      oldValue: 'false',
      newValue: 'true',
      changedBy: null,
    });
  }

  return { success: true, locked: true };
}

// Manual stock allocation adjustment (Admin override)
export async function manualAdjustAllocation(data: {
  batchId: number;
  fromOrderId: number;
  toOrderId: number;
  productId: number;
  variantId?: number;
  qty: number;
  reason: string;
  operatorName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get original allocation
  const originalAlloc = await db.select().from(stockAllocations).where(
    eq(stockAllocations.batchId, data.batchId)
  );

  const fromAlloc = originalAlloc.find(
    a => a.orderId === data.fromOrderId &&
         a.productId === data.productId &&
         (a.variantId || null) === (data.variantId || null)
  );

  if (!fromAlloc) throw new Error('找不到原分配记录');

  // Reduce from original
  const newFromQty = fromAlloc.allocatedQty - data.qty;
  await db.update(stockAllocations).set({
    allocatedQty: newFromQty,
  }).where(eq(stockAllocations.id, fromAlloc.id));

  // Create new manual allocation for target order
  await db.insert(stockAllocations).values({
    batchId: data.batchId,
    orderId: data.toOrderId,
    orderNumber: '', // Will be filled by caller
    productId: data.productId,
    variantId: data.variantId || null,
    allocatedQty: data.qty,
    allocationType: 'manual',
    originalOrderId: data.fromOrderId,
    originalOrderNumber: '',
    adjustmentReason: data.reason,
    operatorName: data.operatorName,
  } as any);

  return { success: true };
}

// Update addOrderPayment to set fullPaymentConfirmedAt when fully paid
export async function checkAndSetFullPaymentConfirmed(orderId: number) {
  const db = await getDb();
  if (!db) return;

  const order = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (order.length === 0) return;

  const totalAmount = parseFloat(String(order[0].totalAmount));
  const paidAmount = parseFloat(String(order[0].paidAmount || '0'));

  // If fully paid and fullPaymentConfirmedAt not yet set
  if (paidAmount >= totalAmount && !(order[0] as any).fullPaymentConfirmedAt) {
    await db.update(orders).set({
      fullPaymentConfirmedAt: new Date(),
    } as any).where(eq(orders.id, orderId));
  }
}

// Get stock allocation summary for a batch
export async function getStockAllocationSummary(batchId: number) {
  const db = await getDb();
  if (!db) return null;

  const allocations = await db.select().from(stockAllocations).where(
    eq(stockAllocations.batchId, batchId)
  );

  // Group by product/variant
  const summary: Record<string, {
    productId: number;
    variantId: number | null;
    totalAllocated: number;
    orders: Array<{
      orderId: number;
      orderNumber: string;
      allocatedQty: number;
      allocationType: string;
    }>;
  }> = {};

  for (const alloc of allocations) {
    const key = `${alloc.productId}-${alloc.variantId || 0}`;
    if (!summary[key]) {
      summary[key] = {
        productId: alloc.productId,
        variantId: alloc.variantId,
        totalAllocated: 0,
        orders: [],
      };
    }
    summary[key].totalAllocated += alloc.allocatedQty;
    summary[key].orders.push({
      orderId: alloc.orderId,
      orderNumber: alloc.orderNumber,
      allocatedQty: alloc.allocatedQty,
      allocationType: alloc.allocationType,
    });
  }

  return Object.values(summary);
}

// ============================================================================
// V5.0: Marketing Center (营销中心)
// ============================================================================

export type MarketingCampaignDraft = {
  campaignCode: string;
  name: string;
  description?: string | null;
  status?: "draft" | "scheduled" | "active" | "paused" | "ended";
  startAt?: Date | null;
  endAt?: Date | null;
  orderCategories?: string[];
  orderSources?: string[];
  customerAudience?: "all" | "member" | "non_member" | "new_customer" | "segment";
  customerSegmentId?: number | null;
  showInMall?: boolean;
  allowMemberPriceStack?: boolean;
  allowBundlePriceStack?: boolean;
  allowCouponStack?: boolean;
  allowPointsEarn?: boolean;
  perCustomerLimit?: number | null;
  perOrderLimit?: number | null;
  usageLimit?: number | null;
  createdBy?: string | null;
};

export type MarketingRuleDraft = {
  campaignId: number;
  ruleType: "quantity_gift" | "nth_item_discount" | "order_threshold" | "spin_eligibility" | "add_on" | "product_discount" | "category_discount" | "clearance" | "live_lottery" | "member_offer";
  name: string;
  description?: string | null;
  status?: "draft" | "active" | "paused" | "ended";
  priority?: number;
  stackable?: boolean;
  config: Record<string, unknown>;
  usageLimit?: number | null;
  scopes?: Array<{
    scopeType: "trigger_product" | "eligible_product" | "eligible_category" | "gift_product" | "add_on_product";
    productId?: number | null;
    categoryId?: number | null;
    quantity?: number;
  }>;
};

function serializeMarketingArray(value: string[] | undefined): string | null {
  return value?.length ? JSON.stringify(value) : null;
}

export async function listMarketingCampaigns() {
  const database = await getDb();
  if (!database) return [];
  const campaigns = await database.select().from(marketingCampaigns).orderBy(desc(marketingCampaigns.createdAt));
  if (!campaigns.length) return [];
  const campaignIds = campaigns.map((campaign) => campaign.id);
  const rules = await database.select().from(marketingRules).where(inArray(marketingRules.campaignId, campaignIds)).orderBy(asc(marketingRules.priority), asc(marketingRules.id));
  const ruleIds = rules.map((rule) => rule.id);
  const scopes = ruleIds.length
    ? await database.select().from(marketingRuleScopes).where(inArray(marketingRuleScopes.ruleId, ruleIds))
    : [];
  return campaigns.map((campaign) => ({
    ...campaign,
    rules: rules.filter((rule) => rule.campaignId === campaign.id).map((rule) => ({
      ...rule,
      scopes: scopes.filter((scope) => scope.ruleId === rule.id),
    })),
  }));
}

export async function getMarketingCampaign(campaignId: number) {
  const campaigns = await listMarketingCampaigns();
  return campaigns.find((campaign) => campaign.id === campaignId) ?? null;
}

export async function getActiveMarketingCampaigns(now = new Date()) {
  const database = await getDb();
  if (!database) return [];
  const campaignRows = await database.select().from(marketingCampaigns).where(and(
    eq(marketingCampaigns.status, "active"),
    or(isNull(marketingCampaigns.startAt), lte(marketingCampaigns.startAt, now)),
    or(isNull(marketingCampaigns.endAt), gte(marketingCampaigns.endAt, now)),
  ));
  if (!campaignRows.length) return [];
  const allCampaigns = await listMarketingCampaigns();
  return allCampaigns.filter((campaign) => campaignRows.some((row) => row.id === campaign.id));
}

export async function createMarketingCampaign(input: MarketingCampaignDraft) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const result = await database.insert(marketingCampaigns).values({
    campaignCode: input.campaignCode.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    status: input.status ?? "draft",
    startAt: input.startAt ?? null,
    endAt: input.endAt ?? null,
    orderCategories: serializeMarketingArray(input.orderCategories),
    orderSources: serializeMarketingArray(input.orderSources),
    customerAudience: input.customerAudience ?? "all",
    customerSegmentId: input.customerSegmentId ?? null,
    showInMall: input.showInMall ?? false,
    allowMemberPriceStack: input.allowMemberPriceStack ?? false,
    allowBundlePriceStack: input.allowBundlePriceStack ?? false,
    allowCouponStack: input.allowCouponStack ?? false,
    allowPointsEarn: input.allowPointsEarn ?? true,
    perCustomerLimit: input.perCustomerLimit ?? null,
    perOrderLimit: input.perOrderLimit ?? null,
    usageLimit: input.usageLimit ?? null,
    createdBy: input.createdBy ?? null,
  });
  return Number(result[0].insertId);
}

export async function updateMarketingCampaign(campaignId: number, input: Partial<MarketingCampaignDraft>) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const patch: Record<string, unknown> = {};
  if (input.campaignCode !== undefined) patch.campaignCode = input.campaignCode.trim().toUpperCase();
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  for (const key of ["status", "startAt", "endAt", "customerAudience", "customerSegmentId", "showInMall", "allowMemberPriceStack", "allowBundlePriceStack", "allowCouponStack", "allowPointsEarn", "perCustomerLimit", "perOrderLimit", "usageLimit"] as const) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  if (input.orderCategories !== undefined) patch.orderCategories = serializeMarketingArray(input.orderCategories);
  if (input.orderSources !== undefined) patch.orderSources = serializeMarketingArray(input.orderSources);
  if (!Object.keys(patch).length) return;
  await database.update(marketingCampaigns).set(patch as any).where(eq(marketingCampaigns.id, campaignId));
}

export async function createMarketingRule(input: MarketingRuleDraft) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  return await database.transaction(async (tx) => {
    const result = await tx.insert(marketingRules).values({
      campaignId: input.campaignId,
      ruleType: input.ruleType,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: input.status ?? "draft",
      priority: input.priority ?? 100,
      stackable: input.stackable ?? false,
      config: input.config as any,
      usageLimit: input.usageLimit ?? null,
    });
    const ruleId = Number(result[0].insertId);
    if (input.scopes?.length) {
      await tx.insert(marketingRuleScopes).values(input.scopes.map((scope) => ({
        ruleId,
        scopeType: scope.scopeType,
        productId: scope.productId ?? null,
        categoryId: scope.categoryId ?? null,
        quantity: scope.quantity ?? 1,
      })) as any);
    }
    return ruleId;
  });
}

export async function updateMarketingRule(ruleId: number, input: Partial<Omit<MarketingRuleDraft, "campaignId">>) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.transaction(async (tx) => {
    const patch: Record<string, unknown> = {};
    for (const key of ["ruleType", "status", "priority", "stackable", "config", "usageLimit"] as const) {
      if (input[key] !== undefined) patch[key] = input[key];
    }
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) patch.description = input.description?.trim() || null;
    if (Object.keys(patch).length) await tx.update(marketingRules).set(patch as any).where(eq(marketingRules.id, ruleId));
    if (input.scopes !== undefined) {
      await tx.delete(marketingRuleScopes).where(eq(marketingRuleScopes.ruleId, ruleId));
      if (input.scopes.length) {
        await tx.insert(marketingRuleScopes).values(input.scopes.map((scope) => ({
          ruleId,
          scopeType: scope.scopeType,
          productId: scope.productId ?? null,
          categoryId: scope.categoryId ?? null,
          quantity: scope.quantity ?? 1,
        })) as any);
      }
    }
  });
}

export async function deleteMarketingRule(ruleId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.transaction(async (tx) => {
    await tx.delete(marketingRuleScopes).where(eq(marketingRuleScopes.ruleId, ruleId));
    await tx.delete(marketingRules).where(eq(marketingRules.id, ruleId));
  });
}

export async function recordMarketingOrderApplication(input: {
  orderId: number;
  campaignId: number;
  ruleId?: number | null;
  customerId: number;
  applicationType: "discount" | "gift" | "add_on" | "free_shipping" | "points" | "lottery" | "coupon";
  originalAmount?: number;
  discountAmount?: number;
  shippingSubsidy?: number;
  pointsGranted?: number;
  snapshot: Record<string, unknown>;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  // The unique key makes repeated checkout/webhook processing idempotent per rule.
  await database.insert(marketingOrderApplications).values({
    ...input,
    ruleId: input.ruleId ?? null,
    originalAmount: (input.originalAmount ?? 0).toFixed(2),
    discountAmount: (input.discountAmount ?? 0).toFixed(2),
    shippingSubsidy: (input.shippingSubsidy ?? 0).toFixed(2),
    pointsGranted: input.pointsGranted ?? 0,
    snapshot: input.snapshot as any,
  } as any).onDuplicateKeyUpdate({ set: { status: "applied", snapshot: input.snapshot as any } });
}

export async function recordMarketingCampaignUsage(input: {
  campaignId: number;
  ruleId?: number | null;
  customerId: number;
  orderId: number;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  // A customer may not consume the same campaign twice through a duplicate order callback.
  await database.insert(marketingCampaignUsages).values({
    ...input,
    ruleId: input.ruleId ?? null,
  } as any).onDuplicateKeyUpdate({ set: { status: "used", reversedAt: null } });
}

export async function createMarketingLotteryEntry(input: {
  campaignId: number;
  ruleId?: number | null;
  customerId: number;
  orderId?: number | null;
  liveRoomId?: number | null;
  entrySource: "order_threshold" | "live_keyword" | "live_answer" | "live_interaction" | "admin" | "live_order";
  reason?: string | null;
  entryCount?: number;
  status?: "pending_payment" | "eligible" | "drawn" | "expired" | "cancelled";
  expiresAt?: Date | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const result = await database.insert(marketingLotteryEntries).values({
    ...input,
    ruleId: input.ruleId ?? null,
    orderId: input.orderId ?? null,
    liveRoomId: input.liveRoomId ?? null,
    reason: input.reason ?? null,
    entryCount: input.entryCount ?? 1,
    status: input.status ?? "pending_payment",
    expiresAt: input.expiresAt ?? null,
    eligibleAt: input.status === "eligible" ? new Date() : null,
  } as any);
  return Number(result[0].insertId);
}

export async function listAvailableMarketingLotteryPrizes(campaignId: number) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(marketingLotteryPrizes).where(and(
    eq(marketingLotteryPrizes.campaignId, campaignId),
    eq(marketingLotteryPrizes.status, "active"),
    or(isNull(marketingLotteryPrizes.quantityLimit), sql`${marketingLotteryPrizes.quantityAwarded} < ${marketingLotteryPrizes.quantityLimit}`),
  ));
}

export async function createMarketingLotteryPrize(input: {
  campaignId: number;
  name: string;
  prizeType: "physical_product" | "coupon" | "points" | "membership_days" | "free_shipping" | "no_prize";
  productId?: number | null;
  productQuantity?: number;
  couponCode?: string | null;
  pointsValue?: number;
  membershipDays?: number;
  probabilityWeight?: number;
  quantityLimit?: number | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  if (input.prizeType === "physical_product" && !input.productId) throw new Error("实体奖品必须选择商品");
  const result = await database.insert(marketingLotteryPrizes).values({
    ...input,
    productId: input.productId ?? null,
    productQuantity: input.productQuantity ?? 1,
    couponCode: input.couponCode ?? null,
    pointsValue: input.pointsValue ?? 0,
    membershipDays: input.membershipDays ?? 0,
    probabilityWeight: Math.max(1, input.probabilityWeight ?? 1),
    quantityLimit: input.quantityLimit ?? null,
  } as any);
  return Number(result[0].insertId);
}

export async function listMarketingLotteryEntries(campaignId: number, limit = 200) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(marketingLotteryEntries)
    .where(eq(marketingLotteryEntries.campaignId, campaignId))
    .orderBy(desc(marketingLotteryEntries.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
}

/** Draws one available prize for one usable entry. It records an unclaimed draw;
 * physical stock is not touched until the administrator/customer merges it into an order. */
export async function drawMarketingLotteryPrize(input: { entryId: number; randomValue?: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  return database.transaction(async (tx) => {
    const [entry] = await tx.select().from(marketingLotteryEntries).where(eq(marketingLotteryEntries.id, input.entryId)).limit(1);
    if (!entry || entry.status !== "eligible" || entry.usedCount >= entry.entryCount) throw new Error("抽奖资格不存在、尚未生效或已使用");
    const consumption = await tx.update(marketingLotteryEntries)
      .set({ usedCount: sql`${marketingLotteryEntries.usedCount} + 1`, status: "drawn" })
      .where(and(eq(marketingLotteryEntries.id, entry.id), eq(marketingLotteryEntries.status, "eligible"), sql`${marketingLotteryEntries.usedCount} < ${marketingLotteryEntries.entryCount}`));
    if (!Number((consumption as any)[0]?.affectedRows ?? 0)) throw new Error("抽奖资格已被其他操作使用，请重新刷新");

    const prizes = await tx.select().from(marketingLotteryPrizes).where(and(
      eq(marketingLotteryPrizes.campaignId, entry.campaignId),
      eq(marketingLotteryPrizes.status, "active"),
      or(isNull(marketingLotteryPrizes.quantityLimit), sql`${marketingLotteryPrizes.quantityAwarded} < ${marketingLotteryPrizes.quantityLimit}`),
    ));
    if (!prizes.length) throw new Error("目前没有可用奖品");
    const totalWeight = prizes.reduce((sum, prize) => sum + Math.max(1, prize.probabilityWeight), 0);
    let cursor = Math.min(Math.max(input.randomValue ?? Math.random(), 0), 0.999999) * totalWeight;
    let prize = prizes[prizes.length - 1];
    for (const candidate of prizes) {
      cursor -= Math.max(1, candidate.probabilityWeight);
      if (cursor < 0) { prize = candidate; break; }
    }
    const award = await tx.update(marketingLotteryPrizes)
      .set({ quantityAwarded: sql`${marketingLotteryPrizes.quantityAwarded} + 1` })
      .where(and(eq(marketingLotteryPrizes.id, prize.id), or(isNull(marketingLotteryPrizes.quantityLimit), sql`${marketingLotteryPrizes.quantityAwarded} < ${marketingLotteryPrizes.quantityLimit}`)));
    if (!Number((award as any)[0]?.affectedRows ?? 0)) throw new Error("该奖品刚刚派完，请重新抽取");
    const drawResult = await tx.insert(marketingLotteryDraws).values({
      entryId: entry.id,
      prizeId: prize.id,
      customerId: entry.customerId,
      sourceOrderId: entry.orderId ?? null,
      status: prize.prizeType === "no_prize" ? "forfeited" : "pending_claim",
      prizeSnapshot: JSON.stringify({ ...prize, quantityAwarded: prize.quantityAwarded + 1 }),
    } as any);
    return { drawId: Number(drawResult[0].insertId), prize, entry };
  });
}

export async function claimMarketingLotteryPhysicalPrize(input: { drawId: number; orderId: number; unitPrice?: number }) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const [draw] = await database.select().from(marketingLotteryDraws).where(eq(marketingLotteryDraws.id, input.drawId)).limit(1);
  if (!draw || draw.status !== "pending_claim" || !draw.prizeId) throw new Error("奖品不存在、不可领取或已领取");
  const [prize] = await database.select().from(marketingLotteryPrizes).where(eq(marketingLotteryPrizes.id, draw.prizeId)).limit(1);
  if (!prize || prize.prizeType !== "physical_product" || !prize.productId) throw new Error("此奖品不是可加入订单的实体商品");
  const orderItemId = await addMarketingPhysicalItemToOrder({
    orderId: input.orderId,
    productId: prize.productId,
    quantity: prize.productQuantity,
    unitPrice: input.unitPrice ?? 0,
    campaignId: prize.campaignId,
    source: "lottery_prize",
    snapshot: { drawId: draw.id, prizeId: prize.id, prizeName: prize.name },
  });
  await database.update(marketingLotteryDraws).set({ status: "merged", mergedOrderId: input.orderId, orderItemId, claimedAt: new Date() }).where(and(eq(marketingLotteryDraws.id, draw.id), eq(marketingLotteryDraws.status, "pending_claim")));
  return { orderItemId, drawId: draw.id };
}

/**
 * Appends a physical marketing item to the original order only after the same
 * atomic stock reservation used by every other sale channel has succeeded.
 */
export async function addMarketingPhysicalItemToOrder(input: {
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  campaignId: number;
  ruleId?: number | null;
  source: "campaign_gift" | "add_on" | "lottery_prize";
  snapshot: Record<string, unknown>;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const [order] = await database.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order || order.physicalStatus === "cancelled") throw new Error("订单不存在或已取消，不能加入营销商品");
  const [product] = await database.select().from(products).where(eq(products.id, input.productId)).limit(1);
  if (!product) throw new Error("营销商品不存在");
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error("营销商品数量必须大于 0");
  if (input.source === "campaign_gift") {
    if (input.quantity !== 1) throw new Error("每张订单只能赠送一件赠品");
    const existingGift = await database
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(and(eq(orderItems.orderId, input.orderId), eq(orderItems.productType, "gift")))
      .limit(1);
    if (existingGift.length > 0) throw new Error("此订单已有赠品，不能重复建立直播赠品");
  }
  await reserveProductStocksForOrder([{ productId: input.productId, quantity: input.quantity }]);
  try {
    const unitPrice = Math.max(0, input.unitPrice);
    const result = await database.insert(orderItems).values({
      orderId: input.orderId,
      productId: product.id,
      productName: product.name,
      productSku: product.sku || null,
      productType: input.source === "campaign_gift" ? "gift" : "physical",
      giftSlot: input.source === "campaign_gift" ? 1 : null,
      quantity: input.quantity,
      unitPrice: unitPrice.toFixed(2),
      subtotal: (unitPrice * input.quantity).toFixed(2),
      unitWeight: String((product as any).weight ?? 0),
      itemSource: "admin",
      priceType: "special",
      unitCost: String((product as any).costPrice ?? 0),
      originalUnitPrice: String((product as any).price ?? unitPrice),
      marketingCampaignId: input.campaignId,
      marketingRuleId: input.ruleId ?? null,
      marketingSource: input.source,
      marketingDiscount: Math.max(0, Number((product as any).price ?? unitPrice) - unitPrice).toFixed(2),
      marketingSnapshot: JSON.stringify(input.snapshot),
    } as any);
    await recalculateOrderTotals(input.orderId);
    return Number(result[0].insertId);
  } catch (error) {
    // Do not leave a stock hold behind when the order-item write fails.
    await database.update(products).set({ stockQuantity: sql`${products.stockQuantity} + ${input.quantity}` }).where(eq(products.id, input.productId));
    throw error;
  }
}

export async function getMarketingAutomationRuleById(ruleId: number) {
  const database = await getDb();
  if (!database) return null;
  const rows = await database.select().from(marketingAutomationRules).where(eq(marketingAutomationRules.id, ruleId)).limit(1);
  return rows[0] ?? null;
}

export async function getMarketingAutomationRuleByScheduleTaskUid(taskUid: string) {
  const database = await getDb();
  if (!database) return null;
  const rows = await database.select().from(marketingAutomationRules).where(eq(marketingAutomationRules.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0] ?? null;
}

export async function getMarketingMessageTemplateById(templateId: number) {
  const database = await getDb();
  if (!database) return null;
  const [template] = await database.select().from(marketingMessageTemplates).where(eq(marketingMessageTemplates.id, templateId)).limit(1);
  return template || null;
}

export async function getMarketingSegmentById(segmentId: number) {
  const database = await getDb();
  if (!database) return null;
  const [segment] = await database.select().from(marketingSegments).where(eq(marketingSegments.id, segmentId)).limit(1);
  return segment || null;
}

/**
 * Resolve a marketing segment from customer data only. A Messenger recipient is
 * eligible for automatic delivery only with a PSID, no blacklist, and a recent
 * customer interaction. Older recipients remain available as manual-copy rows.
 */
export async function resolveMarketingSegmentCustomers(input: {
  segmentId?: number | null;
  customerIds?: number[];
  limit?: number;
}) {
  const database = await getDb();
  if (!database) return [];
  let filter: Record<string, unknown> = {};
  if (input.segmentId) {
    const segment = await getMarketingSegmentById(input.segmentId);
    if (!segment?.isActive) return [];
    filter = (segment.filterConfig || {}) as Record<string, unknown>;
  }
  const sourceCustomers = input.customerIds?.length
    ? await database.select().from(customers).where(inArray(customers.id, input.customerIds)).limit(input.limit || 500)
    : await database.select().from(customers).limit(input.limit || 500);
  const inactiveDays = Number(filter.inactiveDays || 0);
  const minSpent = Number(filter.minSpent || 0);
  const membershipLevels = Array.isArray(filter.membershipLevels) ? filter.membershipLevels.map(String) : null;
  const cutoff = inactiveDays > 0 ? new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000) : null;
  return sourceCustomers.filter((customer) => {
    if (customer.isBlacklisted || customer.mergedIntoCustomerId) return false;
    if (minSpent > 0 && Number(customer.totalSpent || 0) < minSpent) return false;
    if (membershipLevels?.length && !membershipLevels.includes(String(customer.membershipLevel))) return false;
    if (cutoff && (!customer.lastOrderAt || customer.lastOrderAt > cutoff)) return false;
    return true;
  });
}

export async function createMarketingMessageDelivery(input: {
  automationRuleId?: number | null;
  campaignId?: number | null;
  templateId?: number | null;
  customerId: number;
  orderId?: number | null;
  channel: "messenger" | "manual_copy";
  status: "queued" | "sent" | "failed" | "skipped";
  renderedContent: string;
  trackingToken: string;
  errorMessage?: string | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const result = await database.insert(marketingMessageDeliveries).values({
    ...input,
    automationRuleId: input.automationRuleId ?? null,
    campaignId: input.campaignId ?? null,
    templateId: input.templateId ?? null,
    orderId: input.orderId ?? null,
    errorMessage: input.errorMessage ?? null,
  } as any);
  return Number(result[0].insertId);
}

export async function claimMarketingMessageDelivery(input: Parameters<typeof createMarketingMessageDelivery>[0]) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  if (!input.automationRuleId) {
    const deliveryId = await createMarketingMessageDelivery(input);
    return { claimed: true, deliveryId };
  }
  const existing = await database.select({ id: marketingMessageDeliveries.id })
    .from(marketingMessageDeliveries)
    .where(and(eq(marketingMessageDeliveries.automationRuleId, input.automationRuleId), eq(marketingMessageDeliveries.customerId, input.customerId)))
    .limit(1);
  if (existing[0]) return { claimed: false, deliveryId: existing[0].id };
  try {
    const deliveryId = await createMarketingMessageDelivery(input);
    return { claimed: true, deliveryId };
  } catch (error) {
    const afterRace = await database.select({ id: marketingMessageDeliveries.id })
      .from(marketingMessageDeliveries)
      .where(and(eq(marketingMessageDeliveries.automationRuleId, input.automationRuleId), eq(marketingMessageDeliveries.customerId, input.customerId)))
      .limit(1);
    if (afterRace[0]) return { claimed: false, deliveryId: afterRace[0].id };
    throw error;
  }
}

export async function updateMarketingMessageDelivery(input: {
  deliveryId: number;
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string | null;
  errorMessage?: string | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.update(marketingMessageDeliveries).set({
    status: input.status,
    providerMessageId: input.providerMessageId ?? null,
    errorMessage: input.errorMessage ?? null,
    sentAt: input.status === "sent" ? new Date() : null,
  } as any).where(eq(marketingMessageDeliveries.id, input.deliveryId));
}

export async function listMarketingMessageDeliveries(limit = 100) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(marketingMessageDeliveries).orderBy(desc(marketingMessageDeliveries.createdAt)).limit(limit);
}

export async function listMarketingSegments() {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(marketingSegments).orderBy(desc(marketingSegments.updatedAt));
}

export async function createMarketingSegment(input: {
  name: string; description?: string | null; filterConfig: Record<string, unknown>; isActive?: boolean; createdBy?: string | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const result = await database.insert(marketingSegments).values({ ...input, description: input.description ?? null, createdBy: input.createdBy ?? null } as any);
  return Number(result[0].insertId);
}

export async function updateMarketingSegment(segmentId: number, input: Partial<{ name: string; description: string | null; filterConfig: Record<string, unknown>; isActive: boolean; }>) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.update(marketingSegments).set(input as any).where(eq(marketingSegments.id, segmentId));
}

export async function listMarketingMessageTemplates() {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(marketingMessageTemplates).orderBy(desc(marketingMessageTemplates.updatedAt));
}

export async function createMarketingMessageTemplate(input: {
  name: string; channel?: "messenger" | "manual_copy"; subject?: string | null; content: string; buttonLabel?: string | null; buttonUrl?: string | null; isActive?: boolean; createdBy?: string | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const result = await database.insert(marketingMessageTemplates).values({
    ...input, channel: input.channel ?? "messenger", subject: input.subject ?? null, buttonLabel: input.buttonLabel ?? null, buttonUrl: input.buttonUrl ?? null, createdBy: input.createdBy ?? null,
  } as any);
  return Number(result[0].insertId);
}

export async function updateMarketingMessageTemplate(templateId: number, input: Partial<{ name: string; channel: "messenger" | "manual_copy"; subject: string | null; content: string; buttonLabel: string | null; buttonUrl: string | null; isActive: boolean; }>) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.update(marketingMessageTemplates).set(input as any).where(eq(marketingMessageTemplates.id, templateId));
}

export async function listMarketingAutomationRules() {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(marketingAutomationRules).orderBy(desc(marketingAutomationRules.updatedAt));
}

export async function createMarketingAutomationRule(input: {
  campaignId?: number | null; name: string; triggerType: "segment" | "campaign_start" | "campaign_ending" | "restock" | "lottery_eligible" | "manual_batch"; segmentId?: number | null; templateId: number; scheduleType?: "once" | "cron" | "event"; scheduledAt?: Date | null; filterConfig?: Record<string, unknown> | null; createdBy?: string | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const result = await database.insert(marketingAutomationRules).values({
    ...input, campaignId: input.campaignId ?? null, segmentId: input.segmentId ?? null, status: "paused", scheduleType: input.scheduleType ?? "event", scheduledAt: input.scheduledAt ?? null, filterConfig: input.filterConfig ?? null, createdBy: input.createdBy ?? null,
  } as any);
  return Number(result[0].insertId);
}

export async function updateMarketingAutomationRule(ruleId: number, input: Partial<{ campaignId: number | null; name: string; triggerType: "segment" | "campaign_start" | "campaign_ending" | "restock" | "lottery_eligible" | "manual_batch"; segmentId: number | null; templateId: number; status: "paused" | "active" | "ended"; scheduleType: "once" | "cron" | "event"; scheduledAt: Date | null; filterConfig: Record<string, unknown> | null; lastRunAt: Date | null; heartbeatJobId: string | null; scheduleCronTaskUid: string | null; }>) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.update(marketingAutomationRules).set(input as any).where(eq(marketingAutomationRules.id, ruleId));
}

/**
 * Marketing reporting is deliberately derived from immutable campaign applications,
 * actual orders and delivery audits only. Credit balances never enter this calculation
 * as a discount or revenue source.
 */
export async function getMarketingEffectSummary() {
  const database = await getDb();
  if (!database) return { campaigns: [], totals: { attributedOrders: 0, revenue: 0, discount: 0, shippingSubsidy: 0, messagesSent: 0, clicks: 0, conversions: 0 } };

  const [campaignRows, applicationRows, deliveryRows, eventRows] = await Promise.all([
    database.select().from(marketingCampaigns).orderBy(desc(marketingCampaigns.updatedAt)),
    database.select().from(marketingOrderApplications),
    database.select().from(marketingMessageDeliveries),
    database.select().from(marketingMessageEvents),
  ]);

  const appliedByCampaign = new Map<number, typeof applicationRows>();
  applicationRows.filter((row) => row.status === "applied").forEach((row) => {
    const entries = appliedByCampaign.get(row.campaignId) || [];
    entries.push(row);
    appliedByCampaign.set(row.campaignId, entries);
  });
  const deliveriesByCampaign = new Map<number, typeof deliveryRows>();
  deliveryRows.forEach((row) => {
    if (!row.campaignId) return;
    const entries = deliveriesByCampaign.get(row.campaignId) || [];
    entries.push(row);
    deliveriesByCampaign.set(row.campaignId, entries);
  });
  const deliveryEvents = new Map<number, typeof eventRows>();
  eventRows.forEach((row) => {
    const entries = deliveryEvents.get(row.deliveryId) || [];
    entries.push(row);
    deliveryEvents.set(row.deliveryId, entries);
  });

  const campaigns = campaignRows.map((campaign) => {
    const applications = appliedByCampaign.get(campaign.id) || [];
    const orderIds = applications
      .map((row) => row.orderId)
      .filter((orderId, index, values) => values.indexOf(orderId) === index);
    const deliveries = deliveriesByCampaign.get(campaign.id) || [];
    const campaignEvents = deliveries.flatMap((delivery) => deliveryEvents.get(delivery.id) || []);
    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: campaign.status,
      attributedOrders: orderIds.length,
      revenue: applications.reduce((sum, row) => sum + Number(row.originalAmount || 0), 0),
      discount: applications.reduce((sum, row) => sum + Number(row.discountAmount || 0), 0),
      shippingSubsidy: applications.reduce((sum, row) => sum + Number(row.shippingSubsidy || 0), 0),
      messagesSent: deliveries.filter((row) => row.status === "sent").length,
      clicks: campaignEvents.filter((row) => row.eventType === "clicked").length,
      conversions: campaignEvents.filter((row) => row.eventType === "ordered" || row.eventType === "paid").length,
    };
  });
  const totals = campaigns.reduce((total, row) => ({
    attributedOrders: total.attributedOrders + row.attributedOrders,
    revenue: total.revenue + row.revenue,
    discount: total.discount + row.discount,
    shippingSubsidy: total.shippingSubsidy + row.shippingSubsidy,
    messagesSent: total.messagesSent + row.messagesSent,
    clicks: total.clicks + row.clicks,
    conversions: total.conversions + row.conversions,
  }), { attributedOrders: 0, revenue: 0, discount: 0, shippingSubsidy: 0, messagesSent: 0, clicks: 0, conversions: 0 });
  return { campaigns, totals };
}
