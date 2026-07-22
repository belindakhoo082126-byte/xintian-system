import { eq, ne, and, or, desc, asc, sql, gte, lte, isNull, like } from "drizzle-orm";
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
} from "../drizzle/schema";
import { ENV } from './_core/env';

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
  if (filters?.search) conditions.push(like(products.name, `%${filters.search}%`));
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
        like(customers.email, `%${search}%`)
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

  // Create new
  const result = await db.insert(customers).values({
    facebookId: data.facebookId || null,
    facebookName: data.facebookName || null,
    messengerId: data.messengerId || null,
    name: data.name || null,
    phoneNumber: data.phoneNumber || null,
    email: data.email || null,
    shopLinkIdentifier: data.shopLinkIdentifier || null,
  });
  const inserted = await db.select().from(customers)
    .where(eq(customers.id, (result as any).insertId)).limit(1);
  return inserted[0];
}

export async function updateCustomer(id: number, data: Partial<typeof customers.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customers).set(data).where(eq(customers.id, id));
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
}) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(orders);
  const conditions: any[] = [];
  if (filters?.physicalStatus) conditions.push(eq(orders.physicalStatus, filters.physicalStatus as any));
  if (filters?.membershipStatus) conditions.push(eq(orders.membershipStatus, filters.membershipStatus as any));
  if (filters?.orderType) conditions.push(eq(orders.orderType, filters.orderType as any));
  if (filters?.search) {
    conditions.push(or(
      like(orders.orderNumber, `%${filters.search}%`),
      like(orders.facebookName, `%${filters.search}%`)
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
  }>;
  shippingAddress?: string;
  shippingMethod?: string;
  paymentMethodId?: number;
  paymentMethodName?: string;
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

  // Calculate shipping for physical + gift items (both have weight)
  // Gift items count toward free-shipping threshold even though they are free
  let shippingFee = 0;
  if (hasPhysical && data.shippingMethod === "west_malaysia") {
    // Simplified weight calc: each physical/gift item counts as 0.5kg minimum
    const totalWeight = data.items
      .filter(i => i.productType === "physical" || i.productType === "gift")
      .reduce((sum, i) => sum + 0.5 * i.quantity, 0);
    shippingFee = totalWeight <= 10 ? 15 : 15 + Math.ceil(totalWeight - 10) * 3;
  }

  const totalAmount = physicalSubtotal + membershipSubtotal + shippingFee;
  const orderNumber = `XT${Date.now()}${Math.floor(Math.random() * 1000)}`;

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
  });

  const orderId = (orderResult as any).insertId;

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
    });
  }

  // Update customer stats
  await db.update(customers).set({
    totalOrders: sql`${customers.totalOrders} + 1`,
    totalSpent: sql`${customers.totalSpent} + ${totalAmount.toFixed(2)}`,
    lastOrderAt: new Date(),
  }).where(eq(customers.id, data.customerId));

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

  const poId = (poResult as any).insertId;

  for (const item of data.items) {
    await db.insert(purchaseOrderItems).values({
      purchaseOrderId: poId,
      productId: item.productId,
      quantity: item.quantity,
      unitCost: item.unitCost,
      subtotal: item.subtotal,
    });

    // Update product cost immediately (latest purchase cost)
    // Stock is NOT increased here - only when the PO is received
    await db.update(products).set({
      cost: item.unitCost,
    }).where(eq(products.id, item.productId));
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
    await db.update(products).set({
      stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
    }).where(eq(products.id, item.productId));
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
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [];
  if (params.search) {
    conditions.push(like(products.name, `%${params.search}%`));
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
  return { items, total };
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
  estimatedCost?: string;
  currentCost?: string;
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
    estimatedCost: data.estimatedCost,
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
  });
  return { id: result[0].insertId, sku };
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
  estimatedCost: string;
  currentCost: string;
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
}>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const updateData: any = { ...data };
  if (data.keyword) {
    updateData.keyword = data.keyword.toUpperCase().replace(/\s+/g, '');
  }
  await db.update(products).set(updateData).where(eq(products.id, id));
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
    conditions.push(like(products.name, `%${params.search}%`));
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
  const rows = await db.execute(sql`
    SELECT h.*, o.orderNumber, o.customerId, o.totalAmount, o.paidAmount
    FROM hold_order_infos h
    LEFT JOIN orders o ON h.orderId = o.id
    WHERE o.customerId = ${customerId} AND h.isActive = 1
    AND o.physicalStatus = 'hold_order'
    ORDER BY h.holdCreatedAt DESC
  `);
  return rows as any[];
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
  const rows = await db.execute(sql`
    SELECT h.*, o.orderNumber, o.totalAmount, o.paidAmount, o.physicalSubtotal, o.shippingFee, o.discountAmount
    FROM hold_order_infos h
    LEFT JOIN orders o ON h.orderId = o.id
    WHERE o.customerId = ${customerId} 
    AND h.isActive = 1 
    AND h.allowAutoMerge = 1
    AND o.physicalStatus = 'hold_order'
    ORDER BY h.holdCreatedAt DESC
    LIMIT 1
  `);
  return (rows as any[])[0] ?? null;
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

  // If merging into existing hold order
  if (data.mergeIntoOrderId) {
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
      physicalStatus: paidAmount > 0 && paidAmount < newTotal ? "partial_payment" : "receipt_uploaded",
    }).where(eq(orders.id, data.mergeIntoOrderId));

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

  const orderId = (orderResult as any).insertId;

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
  
  return {
    orderNumber: detail.orderNumber,
    customerName: detail.customerName,
    customerPhone: detail.customerPhone,
    shippingAddress: detail.shippingAddress,
    paymentConfirmedAt: detail.paymentConfirmedAt,
    items: detail.items,
    giftItems,
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
  
  const packageId = (result as any).insertId;
  
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
  
  // Create all packages
  for (const pkg of packageList) {
    await createPackage({
      orderId,
      ...pkg,
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
  
  // Create package with selected items
  await createPackage({
    orderId,
    ...packageData,
    itemIds,
  });
  
  // Check if all items are now shipped
  const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
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
  
  // Create order
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
  
  const orderId = (orderResult as any).insertId;
  
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
  
  return { orderId, orderNumber, totalAmount: subtotal.toFixed(2) };
}

// --- Get live order captures (admin) ---
export async function getLiveOrderCaptures(limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(liveOrderCaptures).orderBy(desc(liveOrderCaptures.createdAt)).limit(limit);
}
