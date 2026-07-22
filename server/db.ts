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
  paymentMethod?: string;
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
