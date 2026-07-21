import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// Products
// ============================================================================

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["physical", "membership", "virtual", "gift"]).notNull(),

  // Basic info
  description: text("description"),
  coverImageUrl: varchar("coverImageUrl", { length: 500 }),
  images: text("images"), // JSON array of URLs

  // Pricing
  cost: decimal("cost", { precision: 10, scale: 2 }),
  regularPrice: decimal("regularPrice", { precision: 10, scale: 2 }),
  memberPrice: decimal("memberPrice", { precision: 10, scale: 2 }),
  originalPrice: decimal("originalPrice", { precision: 10, scale: 2 }),
  specialPrice: decimal("specialPrice", { precision: 10, scale: 2 }),

  // Inventory
  weightKg: decimal("weightKg", { precision: 8, scale: 2 }),
  stockQuantity: int("stockQuantity").default(0),
  isPreOrder: boolean("isPreOrder").default(false),

  // Sales strategy
  isListed: boolean("isListed").default(true),
  isSpecialItem: boolean("isSpecialItem").default(false),
  allowFreeShipping: boolean("allowFreeShipping").default(true),

  // Categories & keywords
  categories: text("categories"), // JSON array
  keywords: varchar("keywords", { length: 500 }),
  videoUrl: varchar("videoUrl", { length: 500 }),

  // Membership-specific fields
  membershipIntro: text("membershipIntro"),
  telegramFlowLink: varchar("telegramFlowLink", { length: 500 }),
  facebookFlowId: varchar("facebookFlowId", { length: 255 }),
  allowStandalonePurchase: boolean("allowStandalonePurchase").default(true),
  allowMixedCheckout: boolean("allowMixedCheckout").default(true),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ============================================================================
// Product Variations
// ============================================================================

export const productVariations = mysqlTable("product_variations", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: int("stockQuantity").default(0),
  keywords: varchar("keywords", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductVariation = typeof productVariations.$inferSelect;
export type InsertProductVariation = typeof productVariations.$inferInsert;

// ============================================================================
// Customers
// ============================================================================

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),

  // Facebook identity
  facebookId: varchar("facebookId", { length: 255 }),
  facebookName: varchar("facebookName", { length: 255 }),
  messengerId: varchar("messengerId", { length: 255 }),

  // Personal info
  name: varchar("name", { length: 255 }),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  email: varchar("email", { length: 255 }),

  // Address
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  country: varchar("country", { length: 100 }),

  // Shop link identifier
  shopLinkIdentifier: varchar("shopLinkIdentifier", { length: 255 }),

  // Stats
  totalOrders: int("totalOrders").default(0),
  totalSpent: decimal("totalSpent", { precision: 12, scale: 2 }).default("0"),

  // Membership & points
  membershipLevel: mysqlEnum("membershipLevel", ["regular", "member", "vip"]).default("regular"),
  pointsBalance: int("pointsBalance").default(0),

  // Blacklist
  isBlacklisted: boolean("isBlacklisted").default(false),
  blacklistReason: text("blacklistReason"),

  // Merged customer reference (if this customer was merged into another)
  mergedIntoCustomerId: int("mergedIntoCustomerId"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastOrderAt: timestamp("lastOrderAt"),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ============================================================================
// Orders
// ============================================================================

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull().unique(),

  // Customer
  customerId: int("customerId").notNull(),
  facebookName: varchar("facebookName", { length: 255 }),
  facebookId: varchar("facebookId", { length: 255 }),
  messengerId: varchar("messengerId", { length: 255 }),

  // Order type
  orderType: mysqlEnum("orderType", ["physical", "membership", "mixed"]).notNull(),

  // Amounts
  physicalSubtotal: decimal("physicalSubtotal", { precision: 10, scale: 2 }).default("0"),
  membershipSubtotal: decimal("membershipSubtotal", { precision: 10, scale: 2 }).default("0"),
  shippingFee: decimal("shippingFee", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }).default("0"),

  // Physical order status
  physicalStatus: mysqlEnum("physicalStatus", [
    "pending", "receipt_uploaded", "payment_confirmed",
    "packing", "shipped", "completed", "cancelled"
  ]).default("pending"),

  // Membership order status
  membershipStatus: mysqlEnum("membershipStatus", [
    "pending", "receipt_uploaded", "pending_review",
    "fee_confirmed", "flow_sent", "flow_failed",
    "manual_follow_up", "completed", "cancelled"
  ]).default("pending"),

  // Shipping
  shippingAddress: text("shippingAddress"),
  shippingMethod: mysqlEnum("shippingMethod", [
    "west_malaysia", "east_malaysia_shopee",
    "east_malaysia_poslaju", "self_pickup", "lalamove"
  ]),
  courierCompany: varchar("courierCompany", { length: 100 }),
  trackingNumber: varchar("trackingNumber", { length: 100 }),

  // Payment
  paymentMethod: mysqlEnum("paymentMethod", ["online_banking", "tng"]),
  receiptUrl: varchar("receiptUrl", { length: 500 }),

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  paymentUploadedAt: timestamp("paymentUploadedAt"),
  paymentConfirmedAt: timestamp("paymentConfirmedAt"),
  shippedAt: timestamp("shippedAt"),
  completedAt: timestamp("completedAt"),
  autoCompleteAt: timestamp("autoCompleteAt"),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ============================================================================
// Order Items
// ============================================================================

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId").notNull(),

  // Snapshot
  productName: varchar("productName", { length: 255 }),
  productType: mysqlEnum("productType", ["physical", "membership", "virtual", "gift"]),

  // Quantity & price
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),

  // Variation
  variationId: int("variationId"),
  variationName: varchar("variationName", { length: 255 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ============================================================================
// Membership Fee Reviews
// ============================================================================

export const membershipFeeReviews = mysqlTable("membership_fee_reviews", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),

  // Receipt
  receiptFileUrl: varchar("receiptFileUrl", { length: 500 }),
  receiptUploadedAt: timestamp("receiptUploadedAt").notNull(),

  // Review
  reviewedByStaffId: int("reviewedByStaffId"),
  reviewStatus: mysqlEnum("reviewStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewNotes: text("reviewNotes"),
  reviewedAt: timestamp("reviewedAt"),

  // Flow tracking
  flowSentAt: timestamp("flowSentAt"),
  flowStatus: mysqlEnum("flowStatus", ["pending", "sent", "failed"]).default("pending").notNull(),
  flowErrorMessage: text("flowErrorMessage"),
  flowTemplateId: int("flowTemplateId"),

  // Customer interaction
  telegramLinkClicked: boolean("telegramLinkClicked").default(false),
  telegramLinkClickedAt: timestamp("telegramLinkClickedAt"),

  // Manual follow-up
  needsManualFollowUp: boolean("needsManualFollowUp").default(false),
  followUpNotes: text("followUpNotes"),
  followUpCount: int("followUpCount").default(0),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MembershipFeeReview = typeof membershipFeeReviews.$inferSelect;
export type InsertMembershipFeeReview = typeof membershipFeeReviews.$inferInsert;

// ============================================================================
// Messenger Flow Templates
// ============================================================================

export const messengerFlowTemplates = mysqlTable("messenger_flow_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  // Default message content
  messageContent: text("messageContent").notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }),
  videoUrl: varchar("videoUrl", { length: 500 }),

  // Button config
  buttonName: varchar("buttonName", { length: 100 }).default("进入心田会员系统"),
  buttonLink: varchar("buttonLink", { length: 500 }),

  // Reminder config
  reminderEnabled: boolean("reminderEnabled").default(true),
  reminderDelayHours: int("reminderDelayHours").default(24),
  reminderMessage: text("reminderMessage"),
  reminderMaxCount: int("reminderMaxCount").default(3),

  // Follow-up
  followUpEnabled: boolean("followUpEnabled").default(true),
  followUpDelayHours: int("followUpDelayHours").default(72),

  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MessengerFlowTemplate = typeof messengerFlowTemplates.$inferSelect;
export type InsertMessengerFlowTemplate = typeof messengerFlowTemplates.$inferInsert;

// ============================================================================
// Flow Steps (multi-step flow configuration)
// ============================================================================

export const flowSteps = mysqlTable("flow_steps", {
  id: int("id").autoincrement().primaryKey(),
  flowTemplateId: int("flowTemplateId").notNull(),
  stepOrder: int("stepOrder").notNull(),
  stepName: varchar("stepName", { length: 255 }).notNull(),

  // Content
  messageType: mysqlEnum("messageType", ["text", "image", "video", "button", "contact_support"]).notNull(),
  messageContent: text("messageContent"),
  mediaUrl: varchar("mediaUrl", { length: 500 }),
  buttonName: varchar("buttonName", { length: 100 }),
  buttonLink: varchar("buttonLink", { length: 500 }),

  // Timing
  delaySeconds: int("delaySeconds").default(0),

  // Condition (e.g., only send if previous link not clicked)
  conditionType: mysqlEnum("conditionType", ["always", "if_not_clicked", "if_clicked"]),
  conditionValue: text("conditionValue"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FlowStep = typeof flowSteps.$inferSelect;
export type InsertFlowStep = typeof flowSteps.$inferInsert;

// ============================================================================
// Customer Merge Suggestions
// ============================================================================

export const customerMergeSuggestions = mysqlTable("customer_merge_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  customerAId: int("customerAId").notNull(),
  customerBId: int("customerBId").notNull(),

  // Match reasons (JSON array of match dimensions)
  matchReasons: text("matchReasons"),

  // Status
  status: mysqlEnum("status", ["pending", "approved", "rejected", "auto_merged"]).default("pending").notNull(),
  reviewedByStaffId: int("reviewedByStaffId"),
  reviewedAt: timestamp("reviewedAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerMergeSuggestion = typeof customerMergeSuggestions.$inferSelect;
export type InsertCustomerMergeSuggestion = typeof customerMergeSuggestions.$inferInsert;

// ============================================================================
// Flow Send Logs (track each individual Flow message sent)
// ============================================================================

export const flowSendLogs = mysqlTable("flow_send_logs", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull(),
  flowTemplateId: int("flowTemplateId").notNull(),
  stepOrder: int("stepOrder").notNull(),

  // Send status
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),

  // Content snapshot
  messageContent: text("messageContent"),
  sentAt: timestamp("sentAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FlowSendLog = typeof flowSendLogs.$inferSelect;
export type InsertFlowSendLog = typeof flowSendLogs.$inferInsert;
