import { eq, ne, and, or, desc, asc, sql, gte, lte, isNull, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  products, productVariations,
  customers, orders, orderItems,
  membershipFeeReviews, messengerFlowTemplates, flowSteps,
  customerMergeSuggestions, flowSendLogs,
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
    productType: "physical" | "membership" | "virtual" | "gift";
    quantity: number;
    unitPrice: string;
    subtotal: string;
    variationId?: number;
    variationName?: string;
  }>;
  shippingAddress?: string;
  shippingMethod?: string;
  paymentMethod?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const hasPhysical = data.items.some(i => i.productType === "physical");
  const hasMembership = data.items.some(i => i.productType === "membership");
  const orderType = hasPhysical && hasMembership ? "mixed" : hasMembership ? "membership" : "physical";

  const physicalSubtotal = data.items
    .filter(i => i.productType === "physical")
    .reduce((sum, i) => sum + parseFloat(i.subtotal), 0);

  const membershipSubtotal = data.items
    .filter(i => i.productType === "membership")
    .reduce((sum, i) => sum + parseFloat(i.subtotal), 0);

  // Calculate shipping for physical items only
  let shippingFee = 0;
  if (hasPhysical && data.shippingMethod === "west_malaysia") {
    const totalWeight = data.items
      .filter(i => i.productType === "physical")
      .reduce((sum, i) => sum + (parseFloat(i.subtotal) > 0 ? 0.5 : 0), 0); // simplified
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
    paymentMethod: (data.paymentMethod as any) || null,
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
  paymentMethod?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = {};
  if (data.physicalStatus) updateData.physicalStatus = data.physicalStatus;
  if (data.membershipStatus) updateData.membershipStatus = data.membershipStatus;
  if (data.courierCompany !== undefined) updateData.courierCompany = data.courierCompany;
  if (data.trackingNumber !== undefined) updateData.trackingNumber = data.trackingNumber;
  if (data.receiptUrl !== undefined) updateData.receiptUrl = data.receiptUrl;
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;

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
