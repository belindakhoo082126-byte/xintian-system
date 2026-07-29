import { eq, ne, and, or, desc, asc, sql, gte, lte, isNull, like, inArray } from "drizzle-orm";
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
  paymentMethods, orderStatusLogs, holdOrderInfos, notificationLogs,
  // Mall imports
  mallSettings, mallBanners, mallQuickContacts, mallNotices, mallThemeSchedules, mallProductDetailImages,
  // Packing & Shipping imports
  packages, packageItems, liveOrderCaptures,
  // V1.1 imports
  orderItemRepots, orderRemarks,
  // V1.2 imports
  orderExceptions, orderExceptionItems, orderExceptionReplacements, inventoryAdjustments,
  orderSubOrders, specialOrderActions,
  // V2.0 imports
  liveRooms, importBatches, importBatchItems,
  // V2.0 Phase 2 imports - Live Room Products
  liveRoomProducts,
  // V2.0 Phase 2.5 imports - Live AI Flows
  liveAiFlows,
  liveComments,
  // V3.1 imports - Product Bundles
  productBundles, productBundleItems, bundleStockLogs,
  // V2.1 imports - Order Payments & Operation Logs
  orderPayments, orderOperationLogs,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { broadcastChange, broadcastChanges } from './_core/realtime';

let _db: ReturnType<typeof drizzle> | null = null;

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
    query = query.where(
      or(
        like(customers.name, `%${search}%`),
        like(customers.facebookName, `%${search}%`),
        like(customers.phoneNumber, `%${search}%`),
        like(customers.email, `%${search}%`),
        like(customers.facebookId, `%${search}%`),
        like(customers.messengerId, `%${search}%`),
        like(customers.customerId, `%${search}%`),
        like(customers.displayName, `%${search}%`),
        like(customers.whatsappPhone, `%${search}%`)
      )
    ) as any;
  }
  return await query.orderBy(desc(customers.createdAt));
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

export async function mergeCustomers(sourceId: number, targetId: number, staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Move all orders from source to target
  await db.update(orders).set({ customerId: targetId }).where(eq(orders.customerId, sourceId));
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
}) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(orders);
  const conditions: any[] = [];
  if (filters?.physicalStatus) conditions.push(eq(orders.physicalStatus, filters.physicalStatus as any));
  if (filters?.membershipStatus) conditions.push(eq(orders.membershipStatus, filters.membershipStatus as any));
  if (filters?.orderType) conditions.push(eq(orders.orderType, filters.orderType as any));
  if (filters?.orderNature) conditions.push(eq((orders as any).orderNature, filters.orderNature as any));
  if (filters?.orderCategory) conditions.push(eq((orders as any).orderCategory, filters.orderCategory as any));
  if (filters?.isSpecialOrder !== undefined) conditions.push(eq((orders as any).isSpecialOrder, filters.isSpecialOrder ? 1 : 0));
  if (filters?.specialOrderStatus) conditions.push(eq((orders as any).specialOrderStatus, filters.specialOrderStatus as any));
  if (filters?.specialOrderType && filters.specialOrderType !== "all") conditions.push(eq((orders as any).specialOrderType, filters.specialOrderType as any));
  if (filters?.salesChannel) conditions.push(eq((orders as any).salesChannel, filters.salesChannel as any));
  if (filters?.todayOnly) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    conditions.push(gte(orders.createdAt, today));
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
  return await query.orderBy(desc(orders.createdAt));
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
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

  // Physical and gift items both go through the physical order flow
  // Gift items have price=0 but still count toward shipping weight and free-shipping threshold
  const hasPhysical = data.items.some(i => i.productType === "physical" || i.productType === "gift");
  const hasMembership = data.items.some(i => i.productType === "membership");
  const orderType = hasPhysical && hasMembership ? "mixed" : hasMembership ? "membership" : "physical";

  // Physical subtotal includes gift items (which have price=0)
  const physicalSubtotal = data.items
    .filter(i => i.productType === "physical" || i.productType === "gift")
    .reduce((sum, i) => sum + parseFloat(i.subtotal), 0);

  const membershipSubtotal = data.items
    .filter(i => i.productType === "membership")
    .reduce((sum, i) => sum + parseFloat(i.subtotal), 0);

  // V2.2: Calculate shipping using new West Malaysia rules
  // Free shipping threshold is based on 商品结算金额 = subtotal - promotion - discount (not credit or extra charge)
  let shippingFee = 0;
  const promotionDiscountNum = parseFloat(data.promotionDiscount || "0");
  const discountAmountNum = parseFloat(data.discountAmount || "0");
  const extraChargeNum = parseFloat(data.extraCharge || "0");
  const creditUsedNum = parseFloat(data.creditUsed || "0");
  
  // 商品结算金额 = 商品小计 - 促销优惠 - 人工折扣 (Credit and extra charge don't affect free shipping threshold)
  const settledAmount = physicalSubtotal + membershipSubtotal - promotionDiscountNum - discountAmountNum;
  
  if (hasPhysical && data.shippingMethod === "west_malaysia") {
    const totalWeight = data.items
      .filter(i => i.productType === "physical" || i.productType === "gift")
      .reduce((sum, i) => sum + 0.5 * i.quantity, 0);
    const shipResult = calculateWestMalaysiaShipping(totalWeight, settledAmount);
    shippingFee = shipResult.shippingFee;
  }

  // V2.2: Total = 商品小计 - 促销优惠 - 人工折扣 + 额外收费 + 运费 - 使用Credit
  const totalAmount = physicalSubtotal + membershipSubtotal - promotionDiscountNum - discountAmountNum + extraChargeNum + shippingFee - creditUsedNum;
  
  // V2.2: Generate order number with XT/CXT prefix based on orderCategory
  const prefix = data.orderCategory === "import" ? "CXT" : "XT";
  const orderNumber = `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const orderResult = await db.insert(orders).values({
    orderNumber,
    customerId: data.customerId,
    facebookName: data.facebookName || null,
    facebookId: data.facebookId || null,
    messengerId: data.messengerId || null,
    orderType: orderType as any,
    physicalSubtotal: physicalSubtotal.toFixed(2),
    membershipSubtotal: membershipSubtotal.toFixed(2),
    shippingFee: shippingFee.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    physicalStatus: "pending",
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
    creditUsed: data.creditUsed || null,
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
  }

  // Update customer stats
  await db.update(customers).set({
    totalOrders: sql`${customers.totalOrders} + 1`,
    totalSpent: sql`${customers.totalSpent} + ${totalAmount.toFixed(2)}`,
    lastOrderAt: new Date(),
  }).where(eq(customers.id, data.customerId));

  broadcastChanges(["orders", "inventory", "dashboard", "customers"]);
  return { orderId, orderNumber, totalAmount: totalAmount.toFixed(2) };
}

export async function updateOrderStatus(id: number, data: {
  physicalStatus?: string;
  membershipStatus?: string;
  courierCompany?: string;
  trackingNumber?: string;
  receiptUrl?: string;
  paymentMethodId?: number;
  paymentMethodName?: string;
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

  if (data.physicalStatus === "receipt_uploaded") updateData.paymentUploadedAt = new Date();
  if (data.physicalStatus === "payment_confirmed") updateData.paymentConfirmedAt = new Date();
  if (data.physicalStatus === "shipped") updateData.shippedAt = new Date();
  if (data.physicalStatus === "completed") updateData.completedAt = new Date();

  await db.update(orders).set(updateData).where(eq(orders.id, id));

  // Log status change
  const oldOrder = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (oldOrder.length > 0) {
    await logOrderOperation(id, "status_change", `Status changed to ${data.physicalStatus || data.membershipStatus}`, null, null);
  }

  broadcastChanges(["orders", "dashboard"]);
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
  discountAmount?: string;
  discountReason?: string;
  extraCharge?: string;
  extraChargeDescription?: string;
  creditUsed?: string;
  promotionId?: number;
  promotionName?: string;
  promotionDiscount?: string;
  shippingFee?: string;
  totalAmount?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = {};
  if (data.shippingAddress !== undefined) updateData.shippingAddress = data.shippingAddress;
  if (data.shippingMethod !== undefined) updateData.shippingMethod = data.shippingMethod;
  if (data.orderNature !== undefined) updateData.orderNature = data.orderNature;
  if (data.orderSource !== undefined) updateData.orderSource = data.orderSource;
  if (data.orderCategory !== undefined) updateData.orderCategory = data.orderCategory;
  if (data.recipientName !== undefined) updateData.recipientName = data.recipientName;
  if (data.recipientPhone !== undefined) updateData.recipientPhone = data.recipientPhone;
  if (data.discountAmount !== undefined) updateData.discountAmount = data.discountAmount;
  if (data.discountReason !== undefined) updateData.discountReason = data.discountReason;
  if (data.extraCharge !== undefined) updateData.extraCharge = data.extraCharge;
  if (data.extraChargeDescription !== undefined) updateData.extraChargeDescription = data.extraChargeDescription;
  if (data.creditUsed !== undefined) updateData.creditUsed = data.creditUsed;
  if (data.promotionId !== undefined) updateData.promotionId = data.promotionId;
  if (data.promotionName !== undefined) updateData.promotionName = data.promotionName;
  if (data.promotionDiscount !== undefined) updateData.promotionDiscount = data.promotionDiscount;
  if (data.shippingFee !== undefined) updateData.shippingFee = data.shippingFee;
  if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;

  if (Object.keys(updateData).length > 0) {
    await db.update(orders).set(updateData).where(eq(orders.id, id));
    await logOrderOperation(id, "edit", `Order details updated by admin`, null, null);
  }

  broadcastChanges(["orders", "dashboard"]);
  return { success: true };
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
  paymentMethodId?: number;
  paymentMethodName?: string;
  receiptUrl?: string;
  paymentDate?: Date;
  recordedBy?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(orderPayments).values({
    orderId: data.orderId,
    amount: data.amount,
    paymentMethodId: data.paymentMethodId || null,
    paymentMethodName: data.paymentMethodName || null,
    receiptUrl: data.receiptUrl || null,
    paymentDate: data.paymentDate || new Date(),
    recordedBy: data.recordedBy || null,
    notes: data.notes || null,
  });

  // Update order paidAmount
  const allPayments = await db.select().from(orderPayments).where(eq(orderPayments.orderId, data.orderId));
  const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);
  const order = await db.select().from(orders).where(eq(orders.id, data.orderId)).limit(1);
  if (order.length > 0) {
    const totalAmount = parseFloat(String(order[0].totalAmount));
    let newStatus = order[0].physicalStatus;
    if (totalPaid >= totalAmount) {
      newStatus = "packing";
    } else if (totalPaid > 0) {
      newStatus = "partial_payment";
    }
    await db.update(orders).set({
      paidAmount: totalPaid.toFixed(2),
      physicalStatus: newStatus as any,
      paymentUploadedAt: new Date(),
    }).where(eq(orders.id, data.orderId));
  }

  await logOrderOperation(data.orderId, "payment", `Payment recorded: RM${data.amount}`, null, data.recordedBy);
  broadcastChanges(["orders", "dashboard"]);
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

  // Release reserved stock for live room products if this was a live order
  if (order[0].liveRoomId) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    for (const item of items) {
      if (item.variationId) {
        await db.update(productVariations).set({
          stockQuantity: sql`${productVariations.stockQuantity} + ${item.quantity}`,
        }).where(eq(productVariations.id, item.variationId));
      } else {
        await db.update(products).set({
          stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
        }).where(eq(products.id, item.productId));
      }
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
}) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(membershipFeeReviews);
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(membershipFeeReviews.reviewStatus, filters.status as any));
  if (filters?.flowStatus) conditions.push(eq(membershipFeeReviews.flowStatus, filters.flowStatus as any));
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

  // Needs follow-up
  const needsFollowUp = await db.select({ count: sql<number>`count(*)` })
    .from(membershipFeeReviews)
    .where(eq(membershipFeeReviews.needsManualFollowUp, true));

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
  const poNumber = `PO${Date.now()}${Math.floor(Math.random() * 1000)}`;

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
  stockFilter?: string;
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
  if (params.stockFilter === 'low') {
    conditions.push(eq(products.type, 'physical'));
    conditions.push(lte(products.stockQuantity, 10));
    conditions.push(gt(products.stockQuantity, 0));
  }
  if (params.stockFilter === 'out') {
    conditions.push(eq(products.type, 'physical'));
    conditions.push(eq(products.stockQuantity, 0));
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

  // Calculate pending (on-hold) quantity for each product: sum of order items in pending/checkout status
  const productIds = items.map((p: any) => p.id);
  let pendingMap: Record<number, number> = {};
  if (productIds.length > 0) {
    const pendingItems = await db.execute(sql`
      SELECT oi.productId, COALESCE(SUM(oi.quantity), 0) as pendingQty
      FROM order_items oi
      JOIN orders o ON o.id = oi.orderId
      WHERE o.status IN ('pending', 'checkout', 'confirmed')
      AND oi.productId IN (${sql.join(productIds, sql`, `)})
      GROUP BY oi.productId
    `);
    for (const row of pendingItems as any[]) {
      pendingMap[row.productId] = Number(row.pendingQty) || 0;
    }
  }
  const itemsWithPending = items.map((p: any) => ({
    ...p,
    pendingQuantity: pendingMap[p.id] || 0,
    availableQuantity: (p.stockQuantity || 0) - (pendingMap[p.id] || 0),
  }));

  return { items: itemsWithPending, total };
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
    sellingPrice: data.sellingPrice,
    compareAtPrice: data.compareAtPrice,
    memberPrice: data.memberPrice,
    specialPrice: data.specialPrice,
    currentCost: data.currentCost,
    dimensions: data.dimensions,
    weightKg: data.weightKg,
    stockQuantity: data.stockQuantity,
    isFeatured: data.isFeatured ?? false,
    featuredSortOrder: data.featuredSortOrder ?? 0,
    membershipIntro: data.membershipIntro,
    telegramFlowLink: data.telegramFlowLink,
    allowStandalonePurchase: data.allowStandalonePurchase,
    allowMixedCheckout: data.allowMixedCheckout,
    notes: data.notes,
    coverImageUrl: data.coverImageUrl,
    images: data.images,
    videoUrl: data.videoUrl,
    description: data.description,
    isSpecial: data.isSpecial ?? false,
    allowPresale: data.allowPresale ?? false,
    allowStandaloneShipping: data.allowStandaloneShipping ?? false,
    standaloneShippingMethod: (data.standaloneShippingMethod as any) || 'fixed_fee',
    standaloneShippingFee: data.standaloneShippingFee,
    lightDesc: data.lightDesc,
    waterDesc: data.waterDesc,
    fertilizerDesc: data.fertilizerDesc,
    pruningDesc: data.pruningDesc,
    syncToMall: data.syncToMall ?? false,
    mallSortOrder: data.mallSortOrder ?? 0,
    isPot: data.isPot ?? false,
    potCapacity: data.potCapacity,
    // V4: Wholesale & Agent
    wholesalePrice: data.wholesalePrice as any,
    agentPrice: data.agentPrice as any,
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
  notes: string;
  coverImageUrl: string;
  images: string;
  videoUrl: string;
  description: string;
  isSpecial: boolean;
  allowPresale: boolean;
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
  if (data.keyword) {
    updateData.keyword = data.keyword.toUpperCase().replace(/\s+/g, '');
  }
  // V4: Convert date strings to Date objects for timestamp fields
  if (updateData.specialPriceStartDate !== undefined) {
    (updateData as any).specialPriceStartDate = updateData.specialPriceStartDate ? new Date(updateData.specialPriceStartDate) : null;
  }
  if (updateData.specialPriceEndDate !== undefined) {
    (updateData as any).specialPriceEndDate = updateData.specialPriceEndDate ? new Date(updateData.specialPriceEndDate) : null;
  }
  await db.update(products).set(updateData as any).where(eq(products.id, id));
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
    stockQuantity: data.stockQuantity ?? 0,
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
  const startMs = start.getTime();
  const endMs = end.getTime();

  // 1. Total revenue (product subtotal only, no shipping, no cancelled, no test)
  const [revenueRows] = await db.execute(sql`
    SELECT 
      COALESCE(SUM(o.physical_subtotal), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN o.paid_amount > 0 THEN o.paid_amount ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(CASE WHEN o.physical_status != 'cancelled' THEN o.total_amount - o.paid_amount ELSE 0 END), 0) as total_unpaid,
      COUNT(*) as total_orders,
      SUM(CASE WHEN o.paid_amount > 0 AND o.paid_amount >= o.total_amount THEN 1 ELSE 0 END) as paid_orders,
      SUM(CASE WHEN o.paid_amount = 0 THEN 1 ELSE 0 END) as unpaid_orders,
      SUM(CASE WHEN o.physical_status = 'shipped' OR o.physical_status = 'completed' THEN 1 ELSE 0 END) as shipped_packages,
      COALESCE(SUM(o.shipping_fee), 0) as shipping_income
    FROM orders o
    WHERE o.created_at >= ${startMs} AND o.created_at <= ${endMs}
      AND o.physical_status != 'cancelled'
      AND o.order_type != 'membership'
  `);

  // 2. Refund total
  const [refundRows] = await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0) as total_refunds, COUNT(*) as refund_count
    FROM customer_refunds
    WHERE refund_date >= ${startMs} AND refund_date <= ${endMs}
  `);

  // 3. Order statistics
  const [orderStatRows] = await db.execute(sql`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN physical_status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN physical_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN paid_amount > 0 AND paid_amount >= total_amount THEN 1 ELSE 0 END) as paid,
      SUM(CASE WHEN paid_amount = 0 THEN 1 ELSE 0 END) as unpaid,
      SUM(CASE WHEN physical_status = 'shipped' THEN 1 ELSE 0 END) as shipped
    FROM orders
    WHERE created_at >= ${startMs} AND created_at <= ${endMs}
      AND order_type != 'membership'
  `);

  // 4. FIFO cost (from inventory_ledger where transaction_type = 'sale')
  const [fifoRows] = await db.execute(sql`
    SELECT COALESCE(SUM(ABS(quantity_change) * unit_cost), 0) as total_fifo_cost
    FROM inventory_ledger
    WHERE transaction_type = 'sale'
      AND created_at >= ${startMs} AND created_at <= ${endMs}
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
      oi.product_id,
      oi.product_name,
      oi.variation_name,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.subtotal) as total_sales
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at >= ${start.getTime()} AND o.created_at <= ${end.getTime()}
      AND o.physical_status != 'cancelled'
      AND oi.product_type = 'physical'
    GROUP BY oi.product_id, oi.variation_id
    ORDER BY total_quantity DESC
    LIMIT ${limit}
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    productId: r.product_id,
    productName: r.product_name,
    variantName: r.variation_name,
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
      oi.product_id,
      oi.product_name,
      oi.variation_name,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.subtotal) as total_sales
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at >= ${start.getTime()} AND o.created_at <= ${end.getTime()}
      AND o.physical_status != 'cancelled'
      AND oi.product_type = 'physical'
    GROUP BY oi.product_id, oi.variation_id
    ORDER BY total_sales DESC
    LIMIT ${limit}
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    productId: r.product_id,
    productName: r.product_name,
    variantName: r.variation_name,
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
      COALESCE(oi_sum.total_sales, 0) as total_sales,
      COALESCE(oi_sum.total_sales, 0) - SUM(ABS(il.quantity_change) * il.unit_cost) as gross_profit
    FROM inventory_ledger il
    LEFT JOIN products p ON il.product_id = p.id
    LEFT JOIN (
      SELECT oi.product_id, SUM(oi.subtotal) as total_sales
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ${start.getTime()} AND o.created_at <= ${end.getTime()}
        AND o.physical_status != 'cancelled'
        AND oi.product_type = 'physical'
      GROUP BY oi.product_id
    ) oi_sum ON il.product_id = oi_sum.product_id
    WHERE il.transaction_type = 'sale'
      AND il.created_at >= ${start.getTime()} AND il.created_at <= ${end.getTime()}
    GROUP BY il.product_id
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
      c.customer_id as customer_code,
      c.display_name,
      c.facebook_name,
      c.avatar_url,
      COUNT(o.id) as order_count,
      COALESCE(SUM(o.paid_amount), 0) as total_paid,
      MAX(o.created_at) as last_order_date
    FROM orders o
    INNER JOIN customers c ON o.customer_id = c.id
    WHERE o.created_at >= ${start.getTime()} AND o.created_at <= ${end.getTime()}
      AND o.physical_status != 'cancelled'
      AND o.order_type != 'membership'
    GROUP BY c.id
    ORDER BY total_paid DESC
    LIMIT ${limit}
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    customerId: r.id,
    customerCode: r.customer_code,
    displayName: r.display_name || r.facebook_name,
    avatarUrl: r.avatar_url,
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
      o.order_number,
      o.facebook_name,
      o.physical_subtotal,
      o.shipping_fee,
      o.total_amount,
      o.paid_amount,
      (o.total_amount - o.paid_amount) as balance,
      o.physical_status,
      o.payment_method,
      o.created_at,
      o.shipped_at,
      o.completed_at
    FROM orders o
    WHERE o.created_at >= ${start.getTime()} AND o.created_at <= ${end.getTime()}
      AND o.order_type != 'membership'
    ORDER BY o.created_at DESC
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    id: r.id,
    orderNumber: r.order_number,
    customerName: r.facebook_name,
    productSubtotal: Number(r.physical_subtotal) || 0,
    shippingFee: Number(r.shipping_fee) || 0,
    totalAmount: Number(r.total_amount) || 0,
    paidAmount: Number(r.paid_amount) || 0,
    balance: Number(r.balance) || 0,
    status: r.physical_status,
    paymentMethod: r.payment_method,
    createdAt: r.created_at,
    shippedAt: r.shipped_at,
    completedAt: r.completed_at,
  }));
}

// Product Sales Report
export async function getProductSalesReport(dateRange: DateRange) {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = dateRange;
  const [rows] = await db.execute(sql`
    SELECT 
      oi.product_id,
      oi.product_name,
      oi.variation_name,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.subtotal) as total_sales,
      COUNT(DISTINCT o.id) as order_count,
      COALESCE(il_sum.fifo_cost, 0) as fifo_cost,
      COALESCE(SUM(oi.subtotal), 0) - COALESCE(il_sum.fifo_cost, 0) as gross_profit
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    LEFT JOIN (
      SELECT product_id, SUM(ABS(quantity_change) * unit_cost) as fifo_cost
      FROM inventory_ledger
      WHERE transaction_type = 'sale'
        AND created_at >= ${start.getTime()} AND created_at <= ${end.getTime()}
      GROUP BY product_id
    ) il_sum ON oi.product_id = il_sum.product_id
    WHERE o.created_at >= ${start.getTime()} AND o.created_at <= ${end.getTime()}
      AND o.physical_status != 'cancelled'
      AND oi.product_type = 'physical'
    GROUP BY oi.product_id, oi.variation_id
    ORDER BY total_sales DESC
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    productId: r.product_id,
    productName: r.product_name,
    variantName: r.variation_name,
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
      c.customer_id as customer_code,
      c.display_name,
      c.facebook_name,
      c.phone,
      c.whatsapp_phone,
      COUNT(o.id) as order_count,
      COALESCE(SUM(o.total_amount), 0) as total_order_amount,
      COALESCE(SUM(o.paid_amount), 0) as total_paid,
      COALESCE(SUM(o.total_amount - o.paid_amount), 0) as total_unpaid,
      MAX(o.created_at) as last_order_date
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id
      AND o.created_at >= ${start.getTime()} AND o.created_at <= ${end.getTime()}
      AND o.physical_status != 'cancelled'
      AND o.order_type != 'membership'
    GROUP BY c.id
    HAVING order_count > 0
    ORDER BY total_paid DESC
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    customerId: r.id,
    customerCode: r.customer_code,
    displayName: r.display_name || r.facebook_name,
    phone: r.phone,
    whatsappPhone: r.whatsapp_phone,
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
      COALESCE(SUM(total_amount), 0) as total_amount,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count
    FROM purchase_orders
    WHERE purchase_date >= ${start.getTime()} AND purchase_date <= ${end.getTime()}
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
      cr.order_id,
      o.order_number,
      c.display_name,
      c.facebook_name,
      cr.amount,
      cr.refund_method,
      cr.reason,
      cr.operator_name,
      cr.refund_date,
      cr.created_at
    FROM customer_refunds cr
    LEFT JOIN orders o ON cr.order_id = o.id
    LEFT JOIN customers c ON cr.customer_id = c.id
    WHERE cr.refund_date >= ${start.getTime()} AND cr.refund_date <= ${end.getTime()}
    ORDER BY cr.refund_date DESC
  `);

  return (rows as unknown as any[]).map((r: any) => ({
    id: r.id,
    orderId: r.order_id,
    orderNumber: r.order_number,
    customerName: r.display_name || r.facebook_name,
    amount: Number(r.amount) || 0,
    refundMethod: r.refund_method,
    reason: r.reason,
    operatorName: r.operator_name,
    refundDate: r.refund_date,
    createdAt: r.created_at,
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

  // Update order status
  const updateData: any = { physicalStatus: toStatus as any };
  if (toStatus === "receipt_uploaded") updateData.paymentUploadedAt = new Date() as any;
  if (toStatus === "packing") updateData.paymentConfirmedAt = new Date() as any;
  if (toStatus === "shipped") updateData.shippedAt = new Date() as any;
  if (toStatus === "completed") updateData.completedAt = new Date() as any;

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
    AND o.physicalStatus = 'hold_order'
    ORDER BY h.holdCreatedAt DESC
    LIMIT 1
  `));
  return rows[0] ?? null;
}

export async function getMergeableHoldOrderById(customerId: number, orderId: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = unwrapMySqlRows<any>(await db.execute(sql`
    SELECT h.*, o.orderNumber, o.customerId, o.totalAmount, o.paidAmount
    FROM hold_order_infos h
    INNER JOIN orders o ON h.orderId = o.id
    WHERE h.orderId = ${orderId}
      AND o.customerId = ${customerId}
      AND h.isActive = 1
      AND h.allowAutoMerge = 1
      AND o.physicalStatus = 'hold_order'
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
  
  let subtotal = 0;
  let totalWeight = 0;
  let totalDiscount = 0;
  
  for (const item of items) {
    subtotal += Number(item.subtotal);
    totalWeight += Number(item.unitWeight) * item.quantity;
    totalDiscount += Number(item.discount || 0);
  }
  
  // Get current order for shipping fee
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order[0]) return null;
  
  const shippingFee = Number(order[0].shippingFee || 0);
  const paidAmount = Number(order[0].paidAmount || 0);
  const totalAmount = subtotal - totalDiscount + shippingFee;
  
  await db.update(orders).set({
    physicalSubtotal: subtotal.toString(),
    totalWeight: totalWeight.toString(),
    discountAmount: totalDiscount.toString(),
    totalAmount: totalAmount.toString(),
  }).where(eq(orders.id, orderId));
  
  // Determine new status based on payment
  let newStatus = order[0].physicalStatus;
  if (paidAmount < totalAmount && paidAmount > 0) {
    newStatus = "partial_payment" as any;
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
  return await db.select().from(categories).orderBy(asc(categories.sortOrder));
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
    productName: string;
    productSku?: string;
    variationId?: number;
    variationName?: string;
    facebookKeyword?: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
    discount?: string;
  }>;
  paymentMethodId?: number;
  paymentMethodName?: string;
  mergeIntoOrderId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find or create customer
  const customer = await findOrCreateCustomer({
    name: data.customerName,
    phoneNumber: data.contactNumber,
    email: data.email,
  });

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
  const totalWeight = data.items.reduce((sum, i) => sum + 0.5 * i.quantity, 0);

  // Calculate shipping fee based on method
  let shippingFee = 0;
  if (data.shippingMethod === "west_malaysia") {
    shippingFee = subtotal >= 150 ? (totalWeight <= 10 ? 0 : Math.ceil(totalWeight - 10) * 3) : 15;
  } else if (data.shippingMethod === "east_malaysia") {
    shippingFee = totalWeight <= 2 ? 15 : 15; // Base fee, remaining via Shopee
  } else if (data.shippingMethod === "self_pickup") {
    shippingFee = 0;
  } else if (data.shippingMethod === "lalamove") {
    shippingFee = 0; // Actual quote
  }

  const totalAmount = subtotal + shippingFee;

  // If merging into an existing hold order, only allow the current customer's active, mergeable hold.
  if (data.mergeIntoOrderId) {
    const mergeTarget = await getMergeableHoldOrderById(customer.id, data.mergeIntoOrderId);
    if (!mergeTarget) {
      throw new Error("Selected hold order is no longer available for this customer");
    }

    // Add items to existing order
    for (const item of data.items) {
      await db.insert(orderItems).values({
        orderId: data.mergeIntoOrderId,
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
      });
    }

    // Recalculate order totals
    const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, data.mergeIntoOrderId));
    const newSubtotal = allItems.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
    const newWeight = allItems.reduce((sum, i) => sum + 0.5 * i.quantity, 0);
    let newShippingFee = 0;
    const existingOrder = await getOrderById(data.mergeIntoOrderId);
    const method = existingOrder?.shippingMethod || data.shippingMethod;
    if (method === "west_malaysia") {
      newShippingFee = newSubtotal >= 150 ? (newWeight <= 10 ? 0 : Math.ceil(newWeight - 10) * 3) : 15;
    }
    const newTotal = newSubtotal + newShippingFee;
    const paidAmount = parseFloat((existingOrder as any)?.paidAmount || "0");

    await db.update(orders).set({
      physicalSubtotal: newSubtotal.toFixed(2),
      shippingFee: newShippingFee.toFixed(2),
      totalAmount: newTotal.toFixed(2),
      totalWeight: newWeight.toFixed(2),
    }).where(eq(orders.id, data.mergeIntoOrderId));

    const nextStatus = paidAmount > 0 && paidAmount < newTotal ? "partial_payment" : "receipt_uploaded";
    await transitionOrderStatus(
      data.mergeIntoOrderId,
      nextStatus,
      "Mall checkout",
      "Hold order merged; awaiting payment review",
    );
    await releaseHoldOrder(data.mergeIntoOrderId, "Mall checkout");

    return { orderId: data.mergeIntoOrderId, orderNumber: existingOrder?.orderNumber, merged: true, totalAmount: newTotal.toFixed(2) };
  }

  // Create new order
  const orderNumber = `XT${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const orderResult = await db.insert(orders).values({
    orderNumber,
    customerId: customer.id,
    orderType: "physical",
    physicalSubtotal: subtotal.toFixed(2),
    membershipSubtotal: "0.00",
    shippingFee: shippingFee.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    totalWeight: totalWeight.toFixed(2),
    physicalStatus: "pending",
    shippingAddress,
    shippingMethod: data.shippingMethod as any,
    orderSource: "store",
    paymentMethodId: (data.paymentMethodId as any) || null,
    paymentMethodName: (data.paymentMethodName as any) || null,
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
    });
  }

  // Deduct stock for each item
  for (const item of data.items) {
    if (item.variationId) {
      // Deduct from variant stock
      await db.update(productVariations).set({
        stockQuantity: sql`${productVariations.stockQuantity} - ${item.quantity}`,
      }).where(eq(productVariations.id, item.variationId));
    }
    // Deduct from product stock
    await db.update(products).set({
      stockQuantity: sql`${products.stockQuantity} - ${item.quantity}`,
    }).where(eq(products.id, item.productId));
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
      remarkCategory: "customer_other",
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

  // Malaysian postcode pattern (5 digits)
  const postcodeRegex = /\b(\d{5})\b/;
  // Phone number pattern (Malaysian format)
  const phoneRegex = /(\+?6?01[0-9]\s?\-?\s?\d{3,4}\s?\-?\s?\d{3,4}|\+?6?01[0-9]{8,9})/;

  for (const line of lines) {
    // Check for postcode + city pattern
    const postcodeMatch = line.match(postcodeRegex);
    if (postcodeMatch && !result.postcode) {
      result.postcode = postcodeMatch[1];
      // City is the rest of the line after postcode
      const cityPart = line.replace(postcodeRegex, "").trim();
      if (cityPart) result.city = cityPart;
      continue;
    }

    // Check for phone number
    const phoneMatch = line.match(phoneRegex);
    if (phoneMatch && !result.contactNumber) {
      result.contactNumber = phoneMatch[1].replace(/[\s\-]/g, "");
      continue;
    }

    // Check for Malaysian states
    const states = ["Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Penang", "Perak", "Perlis", "Sabah", "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Putrajaya", "Labuan", "Pulau Pinang"];
    const stateMatch = states.find(s => line.toLowerCase().includes(s.toLowerCase()));
    if (stateMatch && !result.state) {
      result.state = stateMatch;
      // Check if it's East or West Malaysia
      if (["Sabah", "Sarawak", "Labuan"].includes(stateMatch)) {
        result.area = "East Malaysia";
      } else {
        result.area = "West Malaysia";
      }
      continue;
    }

    // First non-matched line is usually the name
    if (!result.customerName && !postcodeMatch && !phoneMatch && !stateMatch) {
      result.customerName = line;
      continue;
    }

    // Second non-matched line is address
    if (!result.addressLine1 && result.customerName && !postcodeMatch && !phoneMatch && !stateMatch) {
      result.addressLine1 = line;
      continue;
    }

    // Third non-matched line is address line 2
    if (!result.addressLine2 && result.customerName && result.addressLine1 && !postcodeMatch && !phoneMatch && !stateMatch) {
      result.addressLine2 = line;
      continue;
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
  if (ruleParsed.customerName && ruleParsed.contactNumber && ruleParsed.postcode) {
    return { ...ruleParsed, rawText: text, method: "rule" };
  }
  
  // Otherwise, use LLM for smarter parsing
  try {
    const { invokeLLM } = await import("./_core/llm.js");
    const prompt = `Parse the following Malaysian customer address text and extract structured data. Return JSON only.
Extract: customerName, contactNumber, addressLine1, addressLine2, postcode, city, state, area (West/East Malaysia).
Malaysian states: Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang, Penang/Pulau Pinang, Perak, Perlis, Sabah, Sarawak, Selangor, Terengganu, Kuala Lumpur, Putrajaya, Labuan.
Sabah/Sarawak/Labuan = East Malaysia, others = West Malaysia.

Text:
${text}`;
    
    const response = await invokeLLM({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" },
    });
    
    const content = typeof response.choices?.[0]?.message?.content === "string"
      ? response.choices[0].message.content
      : "{}";
    const aiParsed = JSON.parse(content);
    return { ...aiParsed, rawText: text, method: "ai" };
  } catch (error) {
    // Fallback to rule-based result
    return { ...ruleParsed, rawText: text, method: "rule_fallback" };
  }
}

// ============================================================================
// V2.2: Customer Credit functions
// ============================================================================

export async function useCustomerCredit(customerId: number, amount: number, orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("Customer not found");
  const balance = parseFloat(customer.creditBalance?.toString() || "0");
  if (balance < amount) throw new Error(`Insufficient credit: ${balance} < ${amount}`);
  await db.update(customers).set({
    creditBalance: (balance - amount).toFixed(2),
  }).where(eq(customers.id, customerId));
  await logOrderOperation(orderId, "credit_used", `Used customer credit: RM${amount.toFixed(2)}`);
  return { remainingCredit: (balance - amount).toFixed(2) };
}

export async function refundCustomerCredit(customerId: number, amount: number, orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("Customer not found");
  const balance = parseFloat(customer.creditBalance?.toString() || "0");
  await db.update(customers).set({
    creditBalance: (balance + amount).toFixed(2),
  }).where(eq(customers.id, customerId));
  await logOrderOperation(orderId, "credit_refunded", `Refunded customer credit: RM${amount.toFixed(2)}`);
  return { newBalance: (balance + amount).toFixed(2) };
}

// ============================================================================
// V2.2: West Malaysia shipping fee calculation
// ============================================================================

export function calculateWestMalaysiaShipping(totalWeight: number, orderTotal: number = 0): { shippingFee: number; freeShipping: boolean; extraWeightCharge: number } {
  // V2.2 West Malaysia shipping rules per requirement document:
  // Order total >= RM150: first 10kg free, extra RM3/kg
  // Order total < RM150: first 10kg RM15, extra RM3/kg
  const FREE_SHIPPING_THRESHOLD = 150; // RM
  const BASE_WEIGHT = 10; // kg
  const BASE_FEE_UNDER = 15; // RM (when order < RM150)
  const EXTRA_PER_KG = 3; // RM
  
  if (totalWeight <= 0) return { shippingFee: 0, freeShipping: orderTotal >= FREE_SHIPPING_THRESHOLD, extraWeightCharge: 0 };
  
  const isFreeShipping = orderTotal >= FREE_SHIPPING_THRESHOLD;
  const baseFee = isFreeShipping ? 0 : BASE_FEE_UNDER;
  
  if (totalWeight <= BASE_WEIGHT) {
    return { shippingFee: baseFee, freeShipping: isFreeShipping, extraWeightCharge: 0 };
  }
  
  const extraWeight = Math.ceil(totalWeight - BASE_WEIGHT);
  const extraCharge = extraWeight * EXTRA_PER_KG;
  return { shippingFee: baseFee + extraCharge, freeShipping: isFreeShipping, extraWeightCharge: extraCharge };
}

// ============================================================================
// PACKING & SHIPPING MODULE (包货发货模块)
// ============================================================================

// --- Packing Workbench: Get orders by status ---
export async function getPackingOrders(status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  }).from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.physicalStatus, status as any))
    .orderBy(desc(orders.paymentConfirmedAt), desc(orders.createdAt));
  
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
    
    return { ...o, totalQuantity: totalQty, itemTypes, specialLabel };
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
    shippingAddress: orders.shippingAddress,
    shippingMethod: orders.shippingMethod,
    deliveryRemark: orders.shippingAddress,
    totalAmount: orders.totalAmount,
    paidAmount: orders.paidAmount,
    shippingFee: orders.shippingFee,
    discountAmount: orders.discountAmount,
    totalWeight: orders.totalWeight,
    physicalStatus: orders.physicalStatus,
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
  
  // V1.1: Fetch customer remarks (only customer type for A5 slip)
  const allRemarks = await getOrderRemarks(orderId);
  const customerRemarks = allRemarks.filter((r: any) => r.type === "customer");

  // V1.1: Fetch repots for A5 slip
  const repots = await getOrderItemRepots(orderId);

  return {
    orderNumber: detail.orderNumber,
    customerName: detail.customerName,
    customerPhone: detail.customerPhone,
    shippingAddress: detail.shippingAddress,
    paymentConfirmedAt: detail.paymentConfirmedAt,
    items: detail.items,
    giftItems,
    customerRemarks,
    repots,
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
    },
    specialLabel,
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get next package number
  const existing = await db.select().from(packages).where(eq(packages.orderId, data.orderId));
  const packageNumber = existing.length + 1;
  
  const result = await db.insert(packages).values({
    orderId: data.orderId,
    packageNumber,
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
        await db.insert(packageItems).values({
          packageId,
          orderItemId: itemId,
          quantity: item[0].quantity,
        });
      }
    }
  }
  
  return { packageId, packageNumber };
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
  
  // Update order status to shipped
  await db.update(orders).set({
    physicalStatus: "shipped",
    shippedAt: new Date(),
  }).where(eq(orders.id, orderId));
  
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
}) {
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

  const existingPackages = await db.select().from(packages).where(eq(packages.orderId, orderId));
  const alreadyPackedItemIds = new Set<number>();
  for (const pkg of existingPackages) {
    const pkgItems = await db.select().from(packageItems).where(eq(packageItems.packageId, pkg.id));
    for (const pi of pkgItems) {
      alreadyPackedItemIds.add(pi.orderItemId);
    }
  }
  if (itemIds.some((itemId) => alreadyPackedItemIds.has(itemId))) {
    throw new Error("PACKING_ITEM_ALREADY_SHIPPED");
  }
  
  // Create package with selected items
  await createPackage({
    orderId,
    ...packageData,
    itemIds,
  });
  
  // Check if all items are now shipped
  const allPackages = await db.select().from(packages).where(eq(packages.orderId, orderId));
  
  // Get all shipped item IDs
  const shippedItemIds = new Set<number>();
  for (const pkg of allPackages) {
    const pkgItems = await db.select().from(packageItems).where(eq(packageItems.packageId, pkg.id));
    for (const pi of pkgItems) {
      shippedItemIds.add(pi.orderItemId);
    }
  }
  
  // Check if all items are shipped
  const allShipped = allItems.every((item) => shippedItemIds.has(item.id));
  
  // Update order status
  await db.update(orders).set({
    physicalStatus: allShipped ? "shipped" : "partial_shipped",
    ...(allShipped ? { shippedAt: new Date() } : {}),
  }).where(eq(orders.id, orderId));
  
  return { success: true, allShipped };
}

// --- Get packages for an order ---
export async function getOrderPackages(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const pkgs = await db.select().from(packages).where(eq(packages.orderId, orderId)).orderBy(asc(packages.packageNumber));
  
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
    
    return { ...p, items };
  }));
  
  return enriched;
}

// --- Customer Order Tracking (public) ---
export async function getCustomerOrderTracking(orderNumber: string, contactNumber?: string) {
  const db = await getDb();
  if (!db) return null;
  
  const order = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    physicalStatus: orders.physicalStatus,
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
  
  // Map status to customer-friendly labels
  const statusMap: Record<string, string> = {
    "pending": "等待付款",
    "receipt_uploaded": "付款审核中",
    "partial_payment": "付款审核中",
    "hold_order": "等待付款",
    "packing": "已确认付款",
    "shipped": "已发货",
    "partial_shipped": "部分发货",
    "completed": "已完成",
    "cancelled": "已取消",
  };
  
  return {
    ...order[0],
    customerStatus: statusMap[order[0].physicalStatus || ""] || order[0].physicalStatus || "unknown",
    items: enrichedItems,
    packages: pkgs,
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

// --- Create order from live capture ---
export async function createOrderFromLiveCapture(data: {
  commenterName: string;
  commenterPsid?: string;
  commentMessage: string;
  commentId?: string;
  postId?: string;
  liveVideoId?: string;
  matchedProducts: Array<{ keyword: string; quantity: number; productId: number; productName: string; productSku: string; unitPrice: string }>;
  sourceName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

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
  
  // Calculate totals
  const subtotal = data.matchedProducts.reduce((sum, p) => sum + parseFloat(p.unitPrice) * p.quantity, 0);
  const totalWeight = data.matchedProducts.reduce((sum, p) => sum + 0.5 * p.quantity, 0);
  
  // Check for existing open order from same customer in same live room (for order merging)
  // Same customer + same live room + order not yet closed = merge into existing order
  let existingOrderId: number | null = null;
  if (data.liveVideoId) {
    const existingOrders = await db.select().from(orders)
      .where(sql`customerId = ${customer.id} AND orderSource = 'facebook_live' AND physicalStatus NOT IN ('closed', 'cancelled', 'completed')`)
      .orderBy(desc(orders.createdAt))
      .limit(1);
    if (existingOrders.length > 0) {
      // Check if this order is from the same live session (within 4 hours)
      const orderTime = new Date(existingOrders[0].createdAt).getTime();
      const now = Date.now();
      if (now - orderTime < 4 * 60 * 60 * 1000) {
        existingOrderId = existingOrders[0].id;
      }
    }
  }
  
  if (existingOrderId) {
    // Merge into existing order: add new items
    for (const p of data.matchedProducts) {
      const itemSubtotal = (parseFloat(p.unitPrice) * p.quantity).toFixed(2);
      await db.insert(orderItems).values({
        orderId: existingOrderId,
        productId: p.productId,
        productName: p.productName,
        productSku: p.productSku || null,
        productType: "physical",
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        subtotal: itemSubtotal,
        facebookKeyword: p.keyword,
        discount: "0.00",
      });
    }
    // Recalculate order total
    const allItems = await db.select({
      total: sql`COALESCE(SUM(subtotal), 0)`,
      weight: sql`COALESCE(SUM(quantity * 0.5), 0)`,
    }).from(orderItems).where(eq(orderItems.orderId, existingOrderId));
    await db.update(orders).set({
      physicalSubtotal: String(allItems[0]?.total || 0),
      totalAmount: String(allItems[0]?.total || 0),
      totalWeight: String(allItems[0]?.weight || 0),
    }).where(eq(orders.id, existingOrderId));
    
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
    
    broadcastChanges(["orders", "inventory", "dashboard"]);
    const existingOrder = await db.select().from(orders).where(eq(orders.id, existingOrderId)).limit(1);
    return { orderId: existingOrderId, orderNumber: existingOrder[0]?.orderNumber || "", totalAmount: String(allItems[0]?.total || 0), merged: true };
  }
  
  // Create new order
  const orderNumber = `XT${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const orderResult = await db.insert(orders).values({
    orderNumber,
    customerId: customer.id,
    facebookName: data.commenterName,
    messengerId: data.commenterPsid || null,
    orderType: "physical",
    physicalSubtotal: subtotal.toFixed(2),
    membershipSubtotal: "0.00",
    shippingFee: "0.00",
    totalAmount: subtotal.toFixed(2),
    totalWeight: totalWeight.toFixed(2),
    physicalStatus: "pending",
    orderSource: "facebook_live",
    sourceName: data.sourceName || "Facebook Live",
    originalCustomerComment: data.commentMessage,
    commentDate: new Date(),
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
    });
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
  
  broadcastChanges(["orders", "inventory", "dashboard"]);
  return { orderId, orderNumber, totalAmount: subtotal.toFixed(2) };
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

export async function getDashboardV11Stats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

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
    .where(and(eq(products.type, 'physical'), lte(products.stockQuantity, 5), gt(products.stockQuantity, 0))) as any[];
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

  // V2.3: Sales breakdown by order nature (local vs import pre-order)
  // Only count paid/shipped/completed orders (exclude pending, hold_order, cancelled)
  const paidStatuses = ['receipt_uploaded', 'packing', 'partial_shipped', 'shipped', 'completed'];
  const localSalesMonth = await db.select({ total: sql`COALESCE(SUM(totalAmount), 0)` }).from(orders)
    .where(and(
      eq((orders as any).orderCategory, 'local'),
      gte(orders.createdAt, firstOfMonth),
      sql`${orders.physicalStatus} IN (${sql.join(paidStatuses.map(s => sql`${s}`), sql`,`)})`
    )) as any[];
  const importSalesMonth = await db.select({ total: sql`COALESCE(SUM(totalAmount), 0)` }).from(orders)
    .where(and(
      eq((orders as any).orderCategory, 'import'),
      gte(orders.createdAt, firstOfMonth),
      sql`${orders.physicalStatus} IN (${sql.join(paidStatuses.map(s => sql`${s}`), sql`,`)})`
    )) as any[];
  const totalMonthSales = (Number(localSalesMonth[0]?.total || 0)) + (Number(importSalesMonth[0]?.total || 0));

  // Row 5: Scheduled shipping today
  const scheduledToday = await db.select({ count: sql`COUNT(*)` }).from(orders)
    .where(and(eq(orders.physicalStatus, 'packing'), eq(orders.scheduledShippingDate, today))) as any[];

  // Order alerts
  const repotOrders = await db.select({ count: sql`COUNT(DISTINCT orderId)` }).from(orderItemRepots) as any[];
  const holdExpiring = await db.select({ count: sql`COUNT(*)` }).from(orders)
    .where(eq(orders.physicalStatus, 'hold_order')) as any[];

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
    // V2.3: Sales breakdown
    salesBreakdown: {
      localSalesMonth: Number(localSalesMonth[0]?.total || 0).toFixed(2),
      importSalesMonth: Number(importSalesMonth[0]?.total || 0).toFixed(2),
      totalMonthSales: totalMonthSales.toFixed(2),
    },
    row5: {
      scheduledToday: Number(scheduledToday[0]?.count || 0),
    },
    alerts: {
      repotOrders: Number(repotOrders[0]?.count || 0),
      scheduledToday: Number(scheduledToday[0]?.count || 0),
      holdExpiring: Number(holdExpiring[0]?.count || 0),
      pendingPayment: Number(pendingPayment[0]?.count || 0),
    },
    // Recent remarks (latest 10 across all orders)
    recentRemarks: await getRecentRemarkSummaries(10),
    // AI Agent pending notifications (status = 'pending')
    pendingNotifications: await getPendingNotifications(10),
    // V2.0: Import Pre-order stats
    importPreorderStats: await getImportPreorderStatsSafe(),
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
  scheduledShippingDate?: string;
  repottingData?: string;
  selectTreeData?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(orderRemarks).values({
    orderId: data.orderId,
    type: data.type,
    content: data.content,
    createdBy: data.createdBy || null,
    remarkCategory: (data.remarkCategory as any) || null,
    scheduledShippingDate: data.scheduledShippingDate ? new Date(data.scheduledShippingDate) : null,
    repottingData: data.repottingData || null,
    selectTreeData: data.selectTreeData || null,
  });

  // If scheduled shipping date is set, update order status to scheduled
  if (data.remarkCategory === "scheduled_shipping" && data.scheduledShippingDate) {
    await db.update(orders).set({
      physicalStatus: "scheduled" as any,
    }).where(eq(orders.id, data.orderId));
    broadcastChanges(["orders", "dashboard"]);
  }

  broadcastChanges(["orders", "dashboard"]);
}

// V2.1: Process order remark (mark as processed)
export async function processOrderRemark(id: number, processedBy: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orderRemarks).set({
    processingStatus: "processed",
    processedBy,
    processedAt: new Date(),
  }).where(eq(orderRemarks.id, id));
  broadcastChanges(["orders", "dashboard"]);
}

// V2.1: Get pending remark orders for Dashboard
export async function getPendingRemarkOrders() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    remarkId: orderRemarks.id,
    orderId: orderRemarks.orderId,
    orderNumber: orders.orderNumber,
    facebookName: orders.facebookName,
    physicalStatus: orders.physicalStatus,
    remarkCategory: orderRemarks.remarkCategory,
    content: orderRemarks.content,
    repottingData: orderRemarks.repottingData,
    selectTreeData: orderRemarks.selectTreeData,
    scheduledShippingDate: orderRemarks.scheduledShippingDate,
    processingStatus: orderRemarks.processingStatus,
    createdBy: orderRemarks.createdBy,
    createdAt: orderRemarks.createdAt,
    processedBy: orderRemarks.processedBy,
    processedAt: orderRemarks.processedAt,
  }).from(orderRemarks)
    .leftJoin(orders, eq(orderRemarks.orderId, orders.id))
    .where(eq(orderRemarks.processingStatus, "pending"))
    .orderBy(desc(orderRemarks.createdAt));
  // Deduplicate by orderId (same order with multiple remarks counts as 1)
  const seen = new Set<number>();
  return rows.filter((r: any) => {
    if (seen.has(r.orderId)) return false;
    seen.add(r.orderId);
    return true;
  });
}

// V2.1: Get all remarks with order info (for remark list page)
export async function getAllRemarksWithOrder(limit?: number) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({
    remarkId: orderRemarks.id,
    orderId: orderRemarks.orderId,
    orderNumber: orders.orderNumber,
    facebookName: orders.facebookName,
    physicalStatus: orders.physicalStatus,
    type: orderRemarks.type,
    remarkCategory: orderRemarks.remarkCategory,
    content: orderRemarks.content,
    repottingData: orderRemarks.repottingData,
    selectTreeData: orderRemarks.selectTreeData,
    scheduledShippingDate: orderRemarks.scheduledShippingDate,
    processingStatus: orderRemarks.processingStatus,
    createdBy: orderRemarks.createdBy,
    createdAt: orderRemarks.createdAt,
    processedBy: orderRemarks.processedBy,
    processedAt: orderRemarks.processedAt,
  }).from(orderRemarks)
    .leftJoin(orders, eq(orderRemarks.orderId, orders.id))
    .orderBy(desc(orderRemarks.createdAt));
  if (limit) {
    return await query.limit(limit);
  }
  return await query;
}

// V2.1: Get today's scheduled shipping count for Dashboard
export async function getTodayScheduledShippingCount() {
  const db = await getDb();
  if (!db) return 0;
  const today = new Date().toISOString().split('T')[0];
  const rows = await db.select({ count: sql`COUNT(*)` }).from(orderRemarks)
    .where(and(
      eq(orderRemarks.remarkCategory, "scheduled_shipping"),
      eq(orderRemarks.processingStatus, "pending"),
      eq(orderRemarks.scheduledShippingDate, today as any),
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

  // Auto-create an internal remark so it shows on Dashboard
  await db.insert(orderRemarks).values({
    orderId: data.orderId,
    type: "internal",
    content: `换盆：${data.productName} → ${data.potProductName} x ${data.quantity}`,
    createdBy: "system",
  });
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

  // Auto-create an internal remark for the cancellation
  if (repot.length > 0) {
    await db.insert(orderRemarks).values({
      orderId: repot[0].orderId,
      type: "internal",
      content: `取消换盆：${repot[0].productName} → ${repot[0].potProductName} x ${repot[0].quantity}`,
      createdBy: "system",
    });
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
  const conditions = [
    eq(orders.physicalStatus, 'packing'),
    sql`${orders.scheduledShippingDate} IS NOT NULL`,
  ];
  if (filter?.dateFrom) {
    const from = new Date(filter.dateFrom); from.setHours(0, 0, 0, 0);
    conditions.push(sql`${orders.scheduledShippingDate} >= ${from}`);
  }
  if (filter?.dateTo) {
    const to = new Date(filter.dateTo); to.setHours(23, 59, 59, 999);
    conditions.push(sql`${orders.scheduledShippingDate} <= ${to}`);
  }
  return await db.select().from(orders)
    .where(and(...conditions))
    .orderBy(asc(orders.scheduledShippingDate));
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
  const rows = await db.select().from(orderExceptions).where(eq(orderExceptions.orderId, orderId));
  return rows;
}

export async function createOrderException(data: {
  orderId: number;
  orderItemId?: number | null;
  exceptionType: 'out_of_stock' | 'quality_issue' | 'overcharged_shipping' | 'other';
  description?: string;
  createdBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orderExceptions).values({
    orderId: data.orderId,
    orderItemId: data.orderItemId ?? null,
    exceptionType: data.exceptionType,
    description: data.description ?? null,
    createdBy: data.createdBy ?? null,
  });
  const id = (result as any).insertId;
  const rows = await db.select().from(orderExceptions).where(eq(orderExceptions.id, Number(id))).limit(1);
  return rows[0];
}

export async function resolveOrderException(
  exceptionId: number,
  resolutionType: 'replace' | 'wait_restock' | 'refund',
  resolvedBy: string,
  scrapCost?: number,
  refundAmount?: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orderExceptions).set({
    resolutionType,
    status: 'resolved',
    resolvedBy,
    resolvedAt: new Date(),
    scrapCost: (scrapCost ?? 0).toString(),
    refundAmount: (refundAmount ?? 0).toString(),
  }).where(eq(orderExceptions.id, exceptionId));
  const rows = await db.select().from(orderExceptions).where(eq(orderExceptions.id, exceptionId)).limit(1);
  return rows[0];
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
  if (conditions.length > 0) {
    return await db.select().from(inventoryAdjustments).where(and(...conditions));
  }
  return await db.select().from(inventoryAdjustments);
}

export async function createInventoryAdjustment(data: {
  productId: number;
  adjustmentType: 'quality_issue' | 'plant_death' | 'pest_disease' | 'human_damage' | 'unhealthy' | 'lost' | 'other';
  quantityChange: number;
  unitCost?: number;
  totalCost?: number;
  orderExceptionId?: number;
  adjustedBy?: string;
  reason?: string;
  remark?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Create the adjustment log
  const result = await db.insert(inventoryAdjustments).values({
    productId: data.productId,
    adjustmentType: data.adjustmentType,
    quantityChange: data.quantityChange,
    unitCost: (data.unitCost ?? 0).toString(),
    totalCost: (data.totalCost ?? 0).toString(),
    orderExceptionId: data.orderExceptionId ?? null,
    adjustedBy: data.adjustedBy ?? null,
    reason: data.reason ?? null,
    remark: data.remark ?? null,
  });
  const id = (result as any).insertId;

  // 2. Update product stock
  const productRows = await db.select().from(products).where(eq(products.id, data.productId)).limit(1);
  if (productRows[0]) {
    const currentStock = Number(productRows[0].stockQuantity ?? 0);
    const newStock = currentStock + data.quantityChange; // quantityChange is negative for reductions
    await db.update(products).set({ stockQuantity: newStock }).where(eq(products.id, data.productId));
  }

  const rows = await db.select().from(inventoryAdjustments).where(eq(inventoryAdjustments.id, Number(id))).limit(1);
  return rows[0];
}

// ============================================================================
// V1.2: Profit Analysis Report (利润分析报告)
// ============================================================================

export async function getProfitAnalysisReport(dateRange: { start: Date; end: Date }) {
  const db = await getDb();
  if (!db) return null;
  const startMs = dateRange.start.getTime();
  const endMs = dateRange.end.getTime();

  // Sales revenue
  const [revenueRows] = await db.execute(sql`
    SELECT
      COALESCE(SUM(o.physical_subtotal), 0) as sales_revenue,
      COALESCE(SUM(o.shipping_fee), 0) as shipping_income
    FROM orders o
    WHERE o.created_at >= ${startMs} AND o.created_at <= ${endMs}
      AND o.physical_status != 'cancelled'
      AND o.order_type != 'membership'
  `);

  // FIFO cost
  const [fifoRows] = await db.execute(sql`
    SELECT COALESCE(SUM(ABS(quantity_change) * unit_cost), 0) as product_cost
    FROM inventory_ledger
    WHERE transaction_type = 'sale'
      AND created_at >= ${startMs} AND created_at <= ${endMs}
  `);

  // Shipping cost (from shipments)
  const [shippingCostRows] = await db.execute(sql`
    SELECT COALESCE(SUM(shipping_cost), 0) as shipping_cost
    FROM shipments
    WHERE created_at >= ${startMs} AND created_at <= ${endMs}
  `);

  // Scrap cost (from order_exceptions)
  const [scrapRows] = await db.execute(sql`
    SELECT COALESCE(SUM(scrap_cost), 0) as scrap_cost
    FROM order_exceptions
    WHERE status = 'resolved'
      AND created_at >= ${startMs} AND created_at <= ${endMs}
  `);

  // Refund loss (from customer_refunds)
  const [refundRows] = await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0) as refund_loss
    FROM customer_refunds
    WHERE refund_date >= ${startMs} AND refund_date <= ${endMs}
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
  const startMs = dateRange.start.getTime();
  const endMs = dateRange.end.getTime();

  // Summary by adjustment type
  const [typeRows] = await db.execute(sql`
    SELECT
      adjustment_type,
      COALESCE(SUM(ABS(quantity_change)), 0) as total_units,
      COALESCE(SUM(total_cost), 0) as total_cost
    FROM inventory_adjustments
    WHERE created_at >= ${startMs} AND created_at <= ${endMs}
    GROUP BY adjustment_type
  `);

  // Product loss ranking
  const [productRows] = await db.execute(sql`
    SELECT
      ia.product_id,
      p.name as product_name,
      COALESCE(SUM(ABS(ia.quantity_change)), 0) as loss_units,
      COALESCE(SUM(ia.total_cost), 0) as loss_cost
    FROM inventory_adjustments ia
    LEFT JOIN products p ON ia.product_id = p.id
    WHERE ia.created_at >= ${startMs} AND ia.created_at <= ${endMs}
    GROUP BY ia.product_id, p.name
    ORDER BY loss_cost DESC
    LIMIT 20
  `);

  // Category loss ranking
  const [categoryRows] = await db.execute(sql`
    SELECT
      c.name_zh as category_name,
      COALESCE(SUM(ABS(ia.quantity_change)), 0) as loss_units,
      COALESCE(SUM(ia.total_cost), 0) as loss_cost
    FROM inventory_adjustments ia
    LEFT JOIN products p ON ia.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE ia.created_at >= ${startMs} AND ia.created_at <= ${endMs}
    GROUP BY c.id, c.name_zh
    ORDER BY loss_cost DESC
    LIMIT 20
  `);

  // Total stock for loss rate calculation
  const [stockRows] = await db.execute(sql`
    SELECT COALESCE(SUM(stock_quantity), 0) as total_stock
    FROM products
    WHERE type = 'physical' AND status = 'active'
  `);

  const types = (typeRows as unknown as any[]).map((r: any) => ({
    adjustmentType: r.adjustment_type,
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
      productId: r.product_id,
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
  const needsSpecialOrder = Math.abs(difference) > 0.01 && actualWeightKg > 10;

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
  actionType: "notify_shortage" | "confirm_received" | "refund" | "company_bear" | "remark",
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

export async function getSpecialOrders(params: { status?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [eq(orders.isSpecialOrder, true)];
  if (params.status && params.status !== "all") {
    conditions.push(eq(orders.specialOrderStatus, params.status as any));
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
  liveRoomId: number;
  preorderStartDate: Date;
  preorderEndDate: Date;
  actualPurchaseDate: Date;
  shippingMethod: string;
  chinaShippingCost: string;
  status: string;
  notes: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(importBatches).set(data as any).where(eq(importBatches.id, id));
  return { success: true };
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
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Check if item already exists
  const existing = await db.select().from(importBatchItems)
    .where(eq(importBatchItems.batchId, data.batchId));
  const found = existing.find(i => i.productId === data.productId && i.variantId === data.variantId);
  if (found) {
    await db.update(importBatchItems).set({
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
    }).where(eq(importBatchItems.id, found.id));
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
  return { id: result[0].insertId };
}

export async function deleteImportBatchItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(importBatchItems).where(eq(importBatchItems.id, id));
  return { success: true };
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
      oi.product_id,
      oi.product_name,
      oi.quantity,
      oi.unit_price,
      oi.subtotal,
      p.is_special,
      p.special_price,
      p.selling_price,
      p.current_cost,
      p.cost,
      o.order_number,
      o.created_at
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    INNER JOIN products p ON oi.product_id = p.id
    WHERE o.created_at >= ${startMs} AND o.created_at <= ${endMs}
      AND o.physical_status != 'cancelled'
      AND oi.product_type = 'physical'
      AND p.is_special = 1
    ORDER BY o.created_at DESC
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
      productId: item.product_id,
      productName: item.product_name,
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
      date: new Date(item.created_at).toLocaleDateString(),
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
    notificationFailedCount: 0,
    stockExceptionCount: 0,
    overdueCount: 0,
    totalPending: 0,
  };

  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  // Count special orders by type that are still pending
  const [rows] = await db.execute(sql`
    SELECT 
      specialOrderType,
      COUNT(*) as cnt
    FROM orders
    WHERE isSpecialOrder = 1
      AND specialOrderStatus = 'pending'
      AND physicalStatus != 'cancelled'
    GROUP BY specialOrderType
  `);

  const typeCounts: Record<string, number> = {};
  (rows as unknown as any[]).forEach((r: any) => {
    typeCounts[r.specialOrderType] = Number(r.cnt) || 0;
  });

  // Count overdue (>24h since creation, still pending)
  const [overdueRows] = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM orders
    WHERE isSpecialOrder = 1
      AND specialOrderStatus = 'pending'
      AND physicalStatus != 'cancelled'
      AND createdAt <= ${twentyFourHoursAgo}
  `);

  const overdueCount = Number((overdueRows as unknown as any[])[0]?.cnt) || 0;

  // Count logistics errors (orders with tracking issues - no AWB but status is ready_to_ship)
  const [logisticsRows] = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM order_sub_orders
    WHERE status = 'ready_to_ship'
      AND (awbNumber IS NULL OR awbNumber = '')
  `);

  const logisticsErrorCount = Number((logisticsRows as unknown as any[])[0]?.cnt) || 0;

  // Count orders with incomplete customer info
  const [incompleteRows] = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM orders o
    INNER JOIN customers c ON o.customerId = c.id
    WHERE o.isSpecialOrder = 0
      AND o.physicalStatus = 'pending'
      AND (c.phoneNumber IS NULL OR c.phoneNumber = '' 
           OR o.shippingAddress IS NULL OR o.shippingAddress = '')
  `);

  const incompleteInfoCount = Number((incompleteRows as unknown as any[])[0]?.cnt) || 0;

  // Count failed notifications (messenger/whatsapp/email) that need manual retry
  const [notificationFailedRows] = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM notification_logs
    WHERE status = 'failed'
  `);
  const notificationFailedCount = Number((notificationFailedRows as unknown as any[])[0]?.cnt) || 0;

  // Count open stock exceptions (out_of_stock and other unresolved exceptions)
  const [stockExceptionRows] = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM order_exceptions
    WHERE status = 'open'
  `);
  const stockExceptionCount = Number((stockExceptionRows as unknown as any[])[0]?.cnt) || 0;

  const pendingShippingCount = typeCounts['pending_shipping'] || 0;
  const pendingRefundCount = typeCounts['pending_refund'] || 0;
  const totalPending = pendingShippingCount + pendingRefundCount + (typeCounts['company_bear'] || 0);

  return {
    pendingShippingCount,
    pendingRefundCount,
    logisticsErrorCount: logisticsErrorCount + incompleteInfoCount,
    notificationFailedCount,
    stockExceptionCount,
    overdueCount,
    totalPending,
  };
}

export async function getSpecialOrderFollowUpList(limit = 50) {
  const db = await getDb();
  if (!db) return [];

  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  // Get special orders that are pending, with customer info and last remark
  // Also include orders with incomplete customer info (phone/address missing) that are not yet special orders
  const [rows] = await db.execute(sql`
    SELECT 
      o.id as order_id,
      o.orderNumber,
      o.parentOrderId,
      o.specialOrderType,
      o.specialOrderStatus,
      o.shippingDifference,
      o.customerPaidShipping,
      o.actualShippingFee,
      o.physicalStatus,
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
      AND (
        -- Special orders that are pending
        (o.isSpecialOrder = 1 AND o.specialOrderStatus = 'pending')
        OR
        -- Orders with incomplete customer info (counts as logistics error in stats)
        (o.isSpecialOrder = 0 AND o.physicalStatus = 'pending'
         AND (c.phoneNumber IS NULL OR c.phoneNumber = '' 
              OR o.shippingAddress IS NULL OR o.shippingAddress = ''))
      )
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

    // Determine special type label
    let specialTypeLabel = '';
    let specialTypeColor = '';
    switch (item.specialOrderType) {
      case 'pending_shipping':
        specialTypeLabel = '等待补运费';
        specialTypeColor = 'orange';
        break;
      case 'pending_refund':
        specialTypeLabel = '等待退款';
        specialTypeColor = 'red';
        break;
      case 'company_bear':
        specialTypeLabel = '公司承担';
        specialTypeColor = 'blue';
        break;
      default:
        specialTypeLabel = '其他特别处理';
        specialTypeColor = 'gray';
    }

    // Check for incomplete customer info
    const hasIncompleteInfo = !item.customer_phone || !item.shippingAddress;
    if (hasIncompleteInfo && !item.specialOrderType) {
      specialTypeLabel = '客户资料不完整';
      specialTypeColor = 'yellow';
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
      specialType: item.specialOrderType || (hasIncompleteInfo ? 'incomplete_info' : 'other'),
      specialTypeLabel,
      specialTypeColor,
      amount: amount.toFixed(2),
      waitHours,
      isOverdue,
      lastRemark: item.last_remark || '',
      lastHandler: item.last_handler || '',
      subOrders,
      physicalStatus: item.physicalStatus,
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

// Get single bundle with items
export async function getBundleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const bundle = (await db.select().from(productBundles).where(eq(productBundles.id, id)).limit(1))[0];
  if (!bundle) return undefined;
  const items = await db.select().from(productBundleItems).where(eq(productBundleItems.bundleId, id));
  return { ...bundle, items };
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
    result.push({ ...bundle, items });
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
  // Fetch product-level info (name, cover image) for grouping
  const productIds = Array.from(new Set(rows.map((r: any) => r.productId)));
  const productInfos: Record<number, any> = {};
  for (const pid of productIds) {
    const pRows = await db.select({
      id: products.id,
      name: products.name,
      coverImageUrl: products.coverImageUrl,
      productMode: products.productMode,
    }).from(products).where(eq(products.id, pid)).limit(1);
    if (pRows.length > 0) productInfos[pid] = pRows[0];
  }
  // Group by productId: products with variants show multiple rows as variations
  const grouped: Record<number, any> = {};
  for (const row of rows) {
    const pid = row.productId;
    if (!grouped[pid]) {
      grouped[pid] = {
        productId: pid,
        productName: productInfos[pid]?.name || row.displayName,
        coverImageUrl: productInfos[pid]?.coverImageUrl || row.imageUrl,
        productMode: productInfos[pid]?.productMode || 'simple',
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
  const newAvailableStock = newStartStock - product[0].reservedCount;
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
  // Write to inventory adjustments log for ALL changes (not just negative)
  if (data.reason) {
    await db.insert(inventoryAdjustments).values({
      productId: product[0].productId,
      adjustmentType: data.reason as any,
      quantityChange: data.quantityChange,
      unitCost: "0",
      reason: `Live room product stock adjustment (ID: ${id}, Reason: ${data.reason})`,
      adjustedBy: "live_management",
    });
  }
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
  // Check if product has variants (same productId, different variationId)
  const siblings = await db.select().from(liveRoomProducts)
    .where(eq(liveRoomProducts.liveRoomId, p.liveRoomId));
  const sameProduct = siblings.filter((s: any) => s.productId === p.productId);
  const footer = liveCommentFooter || "👇 留言关键词即可自动下单";
  if (sameProduct.length <= 1) {
    // No variants — single product format
    return `🌸 ${p.displayName}\n💰 RM${Number(p.price).toFixed(0)}\n📝 关键词：\n${p.keyword}+1\n\n${footer}`;
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
  const baseName = p.displayName.replace(/[🔴❤️🩷💛💚💙🟣⚪️⚫️🟤]+\s*\S+/, "").trim() || p.displayName;
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
      customerId: order.customerId,
      customerName: customerRows[0]?.name || '',
      facebookName: customerRows[0]?.facebookName || '',
      facebookId: customerRows[0]?.facebookId || '',
      items: itemRows.map((item: any) => ({
        productName: item.productName,
        variationName: item.variationName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
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

// Semantic matching: check if a comment message matches any AI flow
// Returns the matched flow's reply content, or null if no match
export async function matchLiveAiFlow(commentMessage: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  // Get all enabled flows, sorted by sortOrder (priority)
  const flows = await db.select().from(liveAiFlows)
    .where(eq(liveAiFlows.isEnabled, true))
    .orderBy(asc(liveAiFlows.sortOrder));
  
  if (flows.length === 0) return null;
  
  const lowerMsg = commentMessage.toLowerCase().trim();
  
  for (const flow of flows) {
    try {
      const keywords: string[] = JSON.parse(flow.triggerKeywords);
      for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase().trim();
        // Check if the comment contains the keyword (substring match)
        // Also check semantic similarity using simple token overlap
        if (lowerMsg.includes(lowerKeyword)) {
          return flow.replyContent;
        }
        // Token-based semantic matching: split both into tokens and check overlap
        const msgTokens = lowerMsg.split(/\s+/).filter((t: string) => t.length > 0);
        const keywordTokens = lowerKeyword.split(/\s+/).filter((t: string) => t.length > 0);
        if (keywordTokens.length > 0 && msgTokens.length > 0) {
          const overlap = keywordTokens.filter((t: string) => msgTokens.some((m: string) => m.includes(t) || t.includes(m)));
          // If all keyword tokens have a match in the message, trigger the flow
          if (overlap.length === keywordTokens.length) {
            return flow.replyContent;
          }
        }
      }
    } catch (e) {
      // Skip invalid JSON
      continue;
    }
  }
  
  return null;
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
  let whereClause = sql`(${products.name} LIKE ${likePattern} OR ${products.sku} LIKE ${likePattern} OR ${products.keyword} LIKE ${likePattern})`;
  if (categoryId) {
    whereClause = sql`(${products.name} LIKE ${likePattern} OR ${products.sku} LIKE ${likePattern} OR ${products.keyword} LIKE ${likePattern}) AND ${products.categoryId} = ${categoryId}`;
  }
  const results = await db.select({
    id: products.id,
    name: products.name,
    sku: products.sku,
    keyword: products.keyword,
    coverImageUrl: products.coverImageUrl,
    sellingPrice: products.sellingPrice,
    stockQuantity: products.stockQuantity,
    categoryId: products.categoryId,
    hasVariants: sql`EXISTS(SELECT 1 FROM ${variants} v WHERE v.productId = ${products.id})`,
  }).from(products)
    .where(whereClause)
    .limit(20);
  return results;
}

// @realtime-broadcast: liveRooms
export async function batchAddProductsToLiveRoom(liveRoomId: number, items: Array<{
  productId: number;
  variationId?: number;
  keyword: string;
  displayName: string;
  price: number;
  stock: number;
  imageUrl?: string;
  specImage?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(liveRoomProducts)
    .where(eq(liveRoomProducts.liveRoomId, liveRoomId));
  const nextSort = existing.length;
  const inserted: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const data = items[i];
    const result = await db.insert(liveRoomProducts).values({
      liveRoomId,
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
      sortOrder: nextSort + i,
      imageUrl: data.imageUrl || null,
      specImage: data.specImage || null,
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
  await db.update(liveRoomProducts).set({ allowPreorder }).where(eq(liveRoomProducts.id, id));
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
  return results;
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
  };
}
