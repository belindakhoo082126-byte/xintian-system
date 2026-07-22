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
// Phase 1: Product Core Module - Categories (商品分类)
// ============================================================================

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  nameZh: varchar("nameZh", { length: 100 }).notNull(),
  nameEn: varchar("nameEn", { length: 100 }).notNull(),
  descZh: text("descZh"),
  descEn: text("descEn"),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  showInStore: boolean("showInStore").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }),
  iconUrl: varchar("iconUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// ============================================================================
// Phase 1: Product Core Module - Units (销售单位)
// ============================================================================

export const units = mysqlTable("units", {
  id: int("id").autoincrement().primaryKey(),
  nameZh: varchar("nameZh", { length: 20 }).notNull(),
  nameEn: varchar("nameEn", { length: 20 }).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
});

export type Unit = typeof units.$inferSelect;
export type InsertUnit = typeof units.$inferInsert;

// ============================================================================
// Products (商品主表 - Phase 1 enhanced)
// ============================================================================

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),

  // Product category (physical / membership / gift)
  type: mysqlEnum("type", ["physical", "membership", "gift"]).notNull(),

  // Product mode (simple / variant) - Phase 1
  productMode: mysqlEnum("productMode", ["simple", "variant"]).default("simple").notNull(),

  // Category & Unit
  categoryId: int("categoryId"),
  unitId: int("unitId"),

  // Keyword & SKU (Phase 1)
  keyword: varchar("keyword", { length: 50 }).notNull().unique(),
  sku: varchar("sku", { length: 30 }).notNull().unique(),

  // Status & Visibility (Phase 1)
  status: mysqlEnum("status", ["draft", "active", "inactive", "out_of_stock"]).default("draft").notNull(),
  visibility: mysqlEnum("visibility", ["public", "link_only", "hidden"]).default("public").notNull(),
  priceVisibility: mysqlEnum("priceVisibility", ["show", "hide", "member_link"]).default("show").notNull(),

  // Descriptions (bilingual - Phase 1)
  shortDescZh: text("shortDescZh"),
  shortDescEn: text("shortDescEn"),
  fullDescZh: text("fullDescZh"),
  fullDescEn: text("fullDescEn"),
  careZh: text("careZh"),
  careEn: text("careEn"),

  // Legacy description (kept for backward compatibility)
  description: text("description"),
  coverImageUrl: varchar("coverImageUrl", { length: 500 }),
  images: text("images"), // JSON array of URLs (legacy, will be replaced by product_images table)

  // Pricing (Phase 1 - three prices)
  sellingPrice: decimal("sellingPrice", { precision: 10, scale: 2 }),
  compareAtPrice: decimal("compareAtPrice", { precision: 10, scale: 2 }),
  memberPrice: decimal("memberPrice", { precision: 10, scale: 2 }),

  // Cost (Phase 1 - estimated + current for FIFO)
  estimatedCost: decimal("estimatedCost", { precision: 10, scale: 2 }),
  currentCost: decimal("currentCost", { precision: 10, scale: 2 }),

  // Legacy cost field (kept for backward compatibility, will be migrated to estimatedCost)
  cost: decimal("cost", { precision: 10, scale: 2 }),
  regularPrice: decimal("regularPrice", { precision: 10, scale: 2 }),
  originalPrice: decimal("originalPrice", { precision: 10, scale: 2 }),
  specialPrice: decimal("specialPrice", { precision: 10, scale: 2 }),

  // Dimensions (Phase 1 - user adjustment #1)
  dimensions: json("dimensions"), // { diameter, height, length, width }

  // Inventory
  weightKg: decimal("weightKg", { precision: 8, scale: 2 }),
  stockQuantity: int("stockQuantity").default(0),
  isPreOrder: boolean("isPreOrder").default(false),

  // Sales strategy
  isListed: boolean("isListed").default(true),
  isSpecialItem: boolean("isSpecialItem").default(false),
  allowFreeShipping: boolean("allowFreeShipping").default(true),

  // Featured (Phase 1 - user adjustment #5)
  isFeatured: boolean("isFeatured").default(false).notNull(),
  featuredSortOrder: int("featuredSortOrder").default(0).notNull(),

  // Legacy categories & keywords
  categories: text("categories"), // JSON array (legacy)
  keywords: varchar("keywords", { length: 500 }),
  videoUrl: varchar("videoUrl", { length: 500 }),

  // Membership-specific fields
  membershipIntro: text("membershipIntro"),
  telegramFlowLink: varchar("telegramFlowLink", { length: 500 }),
  facebookFlowId: varchar("facebookFlowId", { length: 255 }),
  allowStandalonePurchase: boolean("allowStandalonePurchase").default(true),
  allowMixedCheckout: boolean("allowMixedCheckout").default(true),

  // SEO (reserved)
  seoTitle: varchar("seoTitle", { length: 200 }),
  seoDesc: text("seoDesc"),

  // Internal notes
  notes: text("notes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ============================================================================
// Phase 1: Product Images (商品图片)
// ============================================================================

export const productImages = mysqlTable("product_images", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  fileKey: varchar("fileKey", { length: 300 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isMain: boolean("isMain").default(false).notNull(),
  altText: varchar("altText", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductImage = typeof productImages.$inferSelect;
export type InsertProductImage = typeof productImages.$inferInsert;

// ============================================================================
// Phase 1: Product Videos (商品影片 - user adjustment #3)
// ============================================================================

export const productVideos = mysqlTable("product_videos", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  fileKey: varchar("fileKey", { length: 300 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isMain: boolean("isMain").default(false).notNull(),
  thumbnailUrl: varchar("thumbnailUrl", { length: 500 }),
  duration: int("duration"), // seconds
  altText: varchar("altText", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductVideo = typeof productVideos.$inferSelect;
export type InsertProductVideo = typeof productVideos.$inferInsert;

// ============================================================================
// Phase 1: Variants (商品规格 - replaces productVariations)
// ============================================================================

export const variants = mysqlTable("variants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  keyword: varchar("keyword", { length: 50 }).notNull(),
  sku: varchar("sku", { length: 30 }).notNull().unique(),

  // Price override (NULL = inherit from product)
  sellingPrice: decimal("sellingPrice", { precision: 10, scale: 2 }),
  compareAtPrice: decimal("compareAtPrice", { precision: 10, scale: 2 }),
  memberPrice: decimal("memberPrice", { precision: 10, scale: 2 }),
  estimatedCost: decimal("estimatedCost", { precision: 10, scale: 2 }),
  currentCost: decimal("currentCost", { precision: 10, scale: 2 }),

  // Physical attributes override
  weight: decimal("weight", { precision: 8, scale: 2 }),
  dimensions: json("dimensions"),

  // Status
  status: mysqlEnum("status", ["active", "inactive", "hidden"]).default("active").notNull(),
  visibility: mysqlEnum("visibility", ["public", "link_only", "hidden"]).default("public").notNull(),

  // Display
  sortOrder: int("sortOrder").default(0).notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }),

  // Inventory
  stockQuantity: int("stockQuantity").default(0),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Variant = typeof variants.$inferSelect;
export type InsertVariant = typeof variants.$inferInsert;

// ============================================================================
// Phase 1: Member Links (安全会员购买链接)
// ============================================================================

export const memberLinks = mysqlTable("member_links", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MemberLink = typeof memberLinks.$inferSelect;
export type InsertMemberLink = typeof memberLinks.$inferInsert;

// ============================================================================
// Phase 1: Product Attributes (商品属性 - user adjustment #6, reserved for filtering)
// ============================================================================

export const productAttributes = mysqlTable("product_attributes", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  attributeName: varchar("attributeName", { length: 100 }).notNull(), // e.g. "光照需求"
  attributeValue: varchar("attributeValue", { length: 255 }).notNull(), // e.g. "半日照"
  sortOrder: int("sortOrder").default(0).notNull(),
  isFilterable: boolean("isFilterable").default(false).notNull(), // reserved for future filtering
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductAttribute = typeof productAttributes.$inferSelect;
export type InsertProductAttribute = typeof productAttributes.$inferInsert;

// ============================================================================
// Legacy: Product Categories (kept for backward compatibility)
// ============================================================================

export const productCategories = mysqlTable("product_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  parentId: int("parentId"),
  sortOrder: int("sortOrder").default(0),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = typeof productCategories.$inferInsert;

// ============================================================================
// Suppliers (进货供应商)
// ============================================================================

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactPerson: varchar("contactPerson", { length: 100 }),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  bankAccount: varchar("bankAccount", { length: 255 }),
  notes: text("notes"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// ============================================================================
// Purchase Orders (进货单)
// ============================================================================

export const purchaseOrders = mysqlTable("purchase_orders", {
  id: int("id").autoincrement().primaryKey(),
  poNumber: varchar("poNumber", { length: 50 }).notNull().unique(),
  supplierId: int("supplierId").notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["draft", "ordered", "received", "cancelled"]).default("draft").notNull(),
  notes: text("notes"),
  orderedAt: timestamp("orderedAt"),
  receivedAt: timestamp("receivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;

// ============================================================================
// Purchase Order Items (进货明细)
// ============================================================================

export const purchaseOrderItems = mysqlTable("purchase_order_items", {
  id: int("id").autoincrement().primaryKey(),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  productId: int("productId").notNull(),
  quantity: int("quantity").notNull(),
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;

// ============================================================================
// Legacy: Product Variations (kept for backward compatibility)
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

  // XLCS V1.0 Module 3: Human-readable Customer ID (C000001)
  customerId: varchar("customerId", { length: 20 }).notNull().unique(),

  // Facebook identity (use facebookId as unique FB identity, not facebookName)
  facebookId: varchar("facebookId", { length: 255 }),
  facebookName: varchar("facebookName", { length: 255 }),
  messengerId: varchar("messengerId", { length: 255 }),

  // Display Name (admin-facing, defaults to facebookName)
  displayName: varchar("displayName", { length: 255 }),

  // Contact info
  name: varchar("name", { length: 255 }),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  whatsappPhone: varchar("whatsappPhone", { length: 20 }),
  email: varchar("email", { length: 255 }),

  // Legacy address fields (kept for backward compat; new addresses go to customer_addresses)
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  country: varchar("country", { length: 100 }),

  // Avatars
  avatarUrl: varchar("avatarUrl", { length: 500 }), // Facebook avatar (auto-fetched)
  overrideAvatarUrl: varchar("overrideAvatarUrl", { length: 500 }), // Admin-uploaded override

  // Customer source tracking
  customerSource: mysqlEnum("customerSource", [
    "facebook_live", "facebook_messenger", "whatsapp", "store", "admin"
  ]).default("admin").notNull(),

  shopLinkIdentifier: varchar("shopLinkIdentifier", { length: 255 }),

  // Statistics (auto-calculated)
  totalOrders: int("totalOrders").default(0),
  totalSpent: decimal("totalSpent", { precision: 12, scale: 2 }).default("0"),
  membershipLevel: mysqlEnum("membershipLevel", ["regular", "member", "vip"]).default("regular"),
  pointsBalance: int("pointsBalance").default(0),

  // Blacklist (enhanced with audit fields)
  isBlacklisted: boolean("isBlacklisted").default(false),
  blacklistReason: text("blacklistReason"),
  blacklistAt: timestamp("blacklistAt"),
  blacklistBy: int("blacklistBy"),
  unblacklistAt: timestamp("unblacklistAt"),
  unblacklistBy: int("unblacklistBy"),

  // Merge support
  mergedIntoCustomerId: int("mergedIntoCustomerId"),

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastOrderAt: timestamp("lastOrderAt"),
  lastInteractionAt: timestamp("lastInteractionAt"),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ============================================================================
// Orders
// ============================================================================

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull().unique(),
  orderSource: mysqlEnum("orderSource", [
    "facebook_live", "facebook_comment", "facebook_messenger",
    "whatsapp", "store", "backend"
  ]).default("backend").notNull(),
  customerId: int("customerId").notNull(),
  facebookName: varchar("facebookName", { length: 255 }),
  facebookId: varchar("facebookId", { length: 255 }),
  messengerId: varchar("messengerId", { length: 255 }),
  orderType: mysqlEnum("orderType", ["physical", "membership", "mixed"]).notNull(),
  physicalSubtotal: decimal("physicalSubtotal", { precision: 10, scale: 2 }).default("0"),
  membershipSubtotal: decimal("membershipSubtotal", { precision: 10, scale: 2 }).default("0"),
  shippingFee: decimal("shippingFee", { precision: 10, scale: 2 }).default("0"),
  estimatedShippingFee: decimal("estimatedShippingFee", { precision: 10, scale: 2 }).default("0"),
  actualShippingFee: decimal("actualShippingFee", { precision: 10, scale: 2 }),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }).default("0"),
  physicalStatus: mysqlEnum("physicalStatus", [
    "pending", "receipt_uploaded", "payment_confirmed",
    "packing", "shipped", "completed", "cancelled"
  ]).default("pending"),
  membershipStatus: mysqlEnum("membershipStatus", [
    "pending", "receipt_uploaded", "pending_review",
    "fee_confirmed", "flow_sent", "flow_failed",
    "manual_follow_up", "completed", "cancelled"
  ]).default("pending"),
  shippingAddress: text("shippingAddress"),
  shippingMethod: mysqlEnum("shippingMethod", [
    "west_malaysia", "east_malaysia_shopee",
    "east_malaysia_poslaju", "self_pickup", "lalamove"
  ]),
  courierCompany: varchar("courierCompany", { length: 100 }),
  courierId: int("courierId"),
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  paymentMethod: mysqlEnum("paymentMethod", ["online_banking", "tng"]),
  receiptUrl: varchar("receiptUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  reservedAt: timestamp("reservedAt"),
  paymentUploadedAt: timestamp("paymentUploadedAt"),
  paymentConfirmedAt: timestamp("paymentConfirmedAt"),
  shippedAt: timestamp("shippedAt"),
  shipmentDate: timestamp("shipmentDate"),
  completedAt: timestamp("completedAt"),
  cancelledAt: timestamp("cancelledAt"),
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
  productName: varchar("productName", { length: 255 }),
  productType: mysqlEnum("productType", ["physical", "membership", "gift"]),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  variationId: int("variationId"),
  variantId: int("variantId"), // Phase 1 variants.id
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
  receiptFileUrl: varchar("receiptFileUrl", { length: 500 }),
  receiptUploadedAt: timestamp("receiptUploadedAt").notNull(),
  reviewedByStaffId: int("reviewedByStaffId"),
  reviewStatus: mysqlEnum("reviewStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewNotes: text("reviewNotes"),
  reviewedAt: timestamp("reviewedAt"),
  flowSentAt: timestamp("flowSentAt"),
  flowStatus: mysqlEnum("flowStatus", ["pending", "sent", "failed"]).default("pending").notNull(),
  flowErrorMessage: text("flowErrorMessage"),
  flowTemplateId: int("flowTemplateId"),
  telegramLinkClicked: boolean("telegramLinkClicked").default(false),
  telegramLinkClickedAt: timestamp("telegramLinkClickedAt"),
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
  messageContent: text("messageContent").notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }),
  videoUrl: varchar("videoUrl", { length: 500 }),
  buttonName: varchar("buttonName", { length: 100 }).default("进入心田会员系统"),
  buttonLink: varchar("buttonLink", { length: 500 }),
  reminderEnabled: boolean("reminderEnabled").default(true),
  reminderDelayHours: int("reminderDelayHours").default(24),
  reminderMessage: text("reminderMessage"),
  reminderMaxCount: int("reminderMaxCount").default(3),
  followUpEnabled: boolean("followUpEnabled").default(true),
  followUpDelayHours: int("followUpDelayHours").default(72),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MessengerFlowTemplate = typeof messengerFlowTemplates.$inferSelect;
export type InsertMessengerFlowTemplate = typeof messengerFlowTemplates.$inferInsert;

// ============================================================================
// Flow Steps
// ============================================================================

export const flowSteps = mysqlTable("flow_steps", {
  id: int("id").autoincrement().primaryKey(),
  flowTemplateId: int("flowTemplateId").notNull(),
  stepOrder: int("stepOrder").notNull(),
  stepName: varchar("stepName", { length: 255 }).notNull(),
  messageType: mysqlEnum("messageType", ["text", "image", "video", "button", "contact_support"]).notNull(),
  messageContent: text("messageContent"),
  mediaUrl: varchar("mediaUrl", { length: 500 }),
  buttonName: varchar("buttonName", { length: 100 }),
  buttonLink: varchar("buttonLink", { length: 500 }),
  delaySeconds: int("delaySeconds").default(0),
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
  matchReasons: text("matchReasons"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "auto_merged"]).default("pending").notNull(),
  reviewedByStaffId: int("reviewedByStaffId"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerMergeSuggestion = typeof customerMergeSuggestions.$inferSelect;
export type InsertCustomerMergeSuggestion = typeof customerMergeSuggestions.$inferInsert;

// ============================================================================
// Flow Send Logs
// ============================================================================

export const flowSendLogs = mysqlTable("flow_send_logs", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull(),
  flowTemplateId: int("flowTemplateId").notNull(),
  stepOrder: int("stepOrder").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  messageContent: text("messageContent"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FlowSendLog = typeof flowSendLogs.$inferSelect;
export type InsertFlowSendLog = typeof flowSendLogs.$inferInsert;

// ============================================================================
// XLCS V1.0: Couriers (快递公司管理)
// ============================================================================

export const couriers = mysqlTable("couriers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Courier = typeof couriers.$inferSelect;
export type InsertCourier = typeof couriers.$inferInsert;

// ============================================================================
// XLCS V1.0: Order Payments (付款纪录 - 每张订单可有多笔)
// ============================================================================

export const orderPayments = mysqlTable("order_payments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("paymentDate").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", [
    "online_banking", "tng", "cash", "shopee", "bank_transfer", "other"
  ]).notNull(),
  receiptUrl: varchar("receiptUrl", { length: 500 }),
  purpose: varchar("purpose", { length: 200 }), // 用途: 商品/运费/补运费等
  operatorId: int("operatorId"), // 操作人员 (users.id)
  operatorName: varchar("operatorName", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderPayment = typeof orderPayments.$inferSelect;
export type InsertOrderPayment = typeof orderPayments.$inferInsert;

// ============================================================================
// XLCS V1.0: Order Notifications (通知历史)
// ============================================================================

export const orderNotifications = mysqlTable("order_notifications", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  notificationType: mysqlEnum("notificationType", [
    "order_link", "shipping_notice", "payment_reminder", "custom"
  ]).notNull(),
  messengerStatus: mysqlEnum("messengerStatus", ["pending", "sent", "failed", "skipped"]).default("pending").notNull(),
  messengerErrorMessage: text("messengerErrorMessage"),
  whatsappStatus: mysqlEnum("whatsappStatus", ["pending", "sent", "failed", "skipped"]).default("pending").notNull(),
  whatsappErrorMessage: text("whatsappErrorMessage"),
  isManualNotified: boolean("isManualNotified").default(false).notNull(),
  manualNotifiedAt: timestamp("manualNotifiedAt"),
  operatorId: int("operatorId"),
  operatorName: varchar("operatorName", { length: 100 }),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderNotification = typeof orderNotifications.$inferSelect;
export type InsertOrderNotification = typeof orderNotifications.$inferInsert;

// ============================================================================
// XLCS V1.0: Order Audit Logs (审计日志)
// ============================================================================

export const orderAuditLogs = mysqlTable("order_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // e.g. "update_order", "merge_order", "cancel_order"
  fieldName: varchar("fieldName", { length: 100 }),
  oldValue: text("oldValue"),
  newValue: text("newValue"),
  operatorId: int("operatorId"),
  operatorName: varchar("operatorName", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderAuditLog = typeof orderAuditLogs.$inferSelect;
export type InsertOrderAuditLog = typeof orderAuditLogs.$inferInsert;

// ============================================================================
// XLCS V1.0 Module 3: Customer Management - Enhanced customers table
// ============================================================================

// Add new columns to existing customers table via ALTER TABLE in migration.
// New fields documented here for reference (added via SQL migration):
//   customerId       varchar(20)  - Human-readable Customer ID (C000001)
//   displayName      varchar(255) - Admin-facing display name (defaults to facebookName)
//   whatsappPhone    varchar(20)  - WhatsApp phone number
//   avatarUrl        varchar(500) - Facebook avatar URL (auto-fetched)
//   overrideAvatarUrl varchar(500) - Admin-uploaded avatar (overrides FB)
//   customerSource   enum         - Where customer was created
//   lastInteractionAt timestamp   - Last interaction (message, order, etc.)
//   blacklistAt      timestamp    - When blacklisted
//   blacklistBy      int          - Admin user ID who blacklisted
//   unblacklistAt    timestamp    - When unblacklisted
//   unblacklistBy    int          - Admin user ID who unblacklisted

// ============================================================================
// XLCS V1.0 Module 3: Customer Addresses (多地址管理)
// ============================================================================

export const customerAddresses = mysqlTable("customer_addresses", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(), // links to customers.id
  label: varchar("label", { length: 50 }).notNull(), // e.g. "Home", "Office", "Parents"
  recipientName: varchar("recipientName", { length: 255 }).notNull(),
  recipientPhone: varchar("recipientPhone", { length: 20 }).notNull(),
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  country: varchar("country", { length: 100 }).default("Malaysia").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type InsertCustomerAddress = typeof customerAddresses.$inferInsert;

// ============================================================================
// XLCS V1.0 Module 3: Customer Credit Ledger (Credit 纪录)
// ============================================================================

export const customerCreditLedger = mysqlTable("customer_credit_ledger", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // positive = add, negative = deduct
  balanceAfter: decimal("balanceAfter", { precision: 10, scale: 2 }).notNull(),
  type: mysqlEnum("type", ["topup", "refund", "adjustment", "order_deduction", "manual"]).notNull(),
  reason: text("reason"),
  orderId: int("orderId"), // related order if applicable
  operatorId: int("operatorId"),
  operatorName: varchar("operatorName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomerCreditLedger = typeof customerCreditLedger.$inferSelect;
export type InsertCustomerCreditLedger = typeof customerCreditLedger.$inferInsert;

// ============================================================================
// XLCS V1.0 Module 3: Customer Refunds (退款纪录)
// ============================================================================

export const customerRefunds = mysqlTable("customer_refunds", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  orderId: int("orderId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  refundMethod: mysqlEnum("refundMethod", [
    "bank_transfer", "tng", "cash", "store_credit", "other"
  ]).notNull(),
  reason: text("reason"),
  operatorId: int("operatorId"),
  operatorName: varchar("operatorName", { length: 255 }),
  refundDate: timestamp("refundDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomerRefund = typeof customerRefunds.$inferSelect;
export type InsertCustomerRefund = typeof customerRefunds.$inferInsert;

// ============================================================================
// XLCS V1.0 Module 3: Customer Timeline (客户时间轴)
// ============================================================================

export const customerTimeline = mysqlTable("customer_timeline", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  eventType: mysqlEnum("eventType", [
    "order_created", "order_shipped", "order_completed", "order_cancelled",
    "payment_received", "refund_issued", "credit_topup", "credit_deduction",
    "blacklist_added", "blacklist_removed", "address_added", "address_updated",
    "profile_updated", "messenger_message", "whatsapp_message",
    "notification_sent", "notification_failed", "live_comment", "other"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  orderId: int("orderId"),
  paymentId: int("paymentId"),
  metadata: text("metadata"), // JSON string for extra data
  operatorId: int("operatorId"),
  operatorName: varchar("operatorName", { length: 255 }),
  eventDate: timestamp("eventDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomerTimeline = typeof customerTimeline.$inferSelect;
export type InsertCustomerTimeline = typeof customerTimeline.$inferInsert;

// ============================================================================
// XLCS V1.0 Module 3: Customer Audit Logs (客户审计日志)
// ============================================================================

export const customerAuditLogs = mysqlTable("customer_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  fieldName: varchar("fieldName", { length: 100 }),
  oldValue: text("oldValue"),
  newValue: text("newValue"),
  operatorId: int("operatorId"),
  operatorName: varchar("operatorName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomerAuditLog = typeof customerAuditLogs.$inferSelect;
export type InsertCustomerAuditLog = typeof customerAuditLogs.$inferInsert;

// ============================================================================
// XLCS V1.0: Sales Sessions (Facebook 直播/贴文/Reel 销售场次)
// ============================================================================

export const salesSessions = mysqlTable("sales_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionCode: varchar("session_code", { length: 50 }).notNull().unique(),
  sessionType: mysqlEnum("session_type", ["facebook_live", "facebook_post", "facebook_reel"]).notNull(),
  facebookPageId: varchar("facebook_page_id", { length: 100 }),
  facebookPostId: varchar("facebook_post_id", { length: 200 }),
  facebookLiveVideoId: varchar("facebook_live_video_id", { length: 200 }),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["not_listening", "comments_only", "order_capture_active", "paused", "ended"]).default("not_listening").notNull(),
  commentSyncEnabled: boolean("comment_sync_enabled").default(false).notNull(),
  orderCaptureEnabled: boolean("order_capture_enabled").default(false).notNull(),
  autoDetectEnabled: boolean("auto_detect_enabled").default(true).notNull(),
  autoSyncComments: boolean("auto_sync_comments").default(true).notNull(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SalesSession = typeof salesSessions.$inferSelect;
export type InsertSalesSession = typeof salesSessions.$inferInsert;

// ============================================================================
// XLCS V1.0: Facebook Comments (留言同步 + 关键词捉单记录)
// ============================================================================

export const facebookComments = mysqlTable("facebook_comments", {
  id: int("id").autoincrement().primaryKey(),
  facebookCommentId: varchar("facebook_comment_id", { length: 200 }).notNull().unique(),
  facebookPostId: varchar("facebook_post_id", { length: 200 }).notNull(),
  sessionId: int("session_id"),
  facebookUserId: varchar("facebook_user_id", { length: 200 }).notNull(),
  customerId: int("customer_id"),
  messageOriginal: text("message_original").notNull(),
  messageNormalized: text("message_normalized"),
  commentCreatedAt: timestamp("comment_created_at"),
  keywordDetected: varchar("keyword_detected", { length: 100 }),
  quantityDetected: int("quantity_detected"),
  processingStatus: mysqlEnum("processing_status", ["pending", "matched", "no_match", "failed", "duplicate", "blacklisted", "out_of_stock", "preorder_full"]).default("pending").notNull(),
  failureReason: text("failure_reason"),
  orderId: int("order_id"),
  orderItemId: int("order_item_id"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FacebookComment = typeof facebookComments.$inferSelect;
export type InsertFacebookComment = typeof facebookComments.$inferInsert;

// ============================================================================
// XLCS V1.0: Order Notes (订单备注 - 3 种类型)
// ============================================================================

export const orderNotes = mysqlTable("order_notes", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  customerId: int("customer_id"),
  noteType: mysqlEnum("note_type", ["customer_note", "internal_note", "checkout_note"]).notNull(),
  visibility: mysqlEnum("visibility", ["customer", "internal"]).default("internal").notNull(),
  content: text("content").notNull(),
  source: mysqlEnum("source", ["facebook_live", "facebook_post", "facebook_reel", "messenger", "whatsapp", "store_checkout", "admin", "customer_service"]).default("admin").notNull(),
  sourceReferenceId: varchar("source_reference_id", { length: 200 }),
  needsAction: boolean("needs_action").default(false).notNull(),
  createdBy: int("created_by"),
  createdByName: varchar("created_by_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type OrderNote = typeof orderNotes.$inferSelect;
export type InsertOrderNote = typeof orderNotes.$inferInsert;

// ============================================================================
// XLCS V1.0: Action Items (需要处理事项)
// ============================================================================

export const actionItems = mysqlTable("action_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id"),
  customerId: int("customer_id"),
  noteId: int("note_id"),
  sessionId: int("session_id"),
  facebookCommentId: varchar("facebook_comment_id", { length: 200 }),
  source: mysqlEnum("source", ["facebook_live", "facebook_post", "facebook_reel", "messenger", "whatsapp", "store_checkout", "admin", "customer_service"]).default("admin").notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["pending", "completed"]).default("pending").notNull(),
  createdBy: int("created_by"),
  createdByName: varchar("created_by_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedBy: int("completed_by"),
  completedByName: varchar("completed_by_name", { length: 255 }),
  completedAt: timestamp("completed_at"),
});

export type ActionItem = typeof actionItems.$inferSelect;
export type InsertActionItem = typeof actionItems.$inferInsert;

// ============================================================================
// XLCS V1.0: Session Products (场次商品 + 预售管理)
// ============================================================================

export const sessionProducts = mysqlTable("session_products", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("session_id").notNull(),
  productId: int("product_id").notNull(),
  variantId: int("variant_id"),
  keyword: varchar("keyword", { length: 100 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  physicalStockAtStart: int("physical_stock_at_start").default(0).notNull(),
  physicalSoldQuantity: int("physical_sold_quantity").default(0).notNull(),
  preorderEnabled: boolean("preorder_enabled").default(false).notNull(),
  preorderLimit: int("preorder_limit"),
  preorderSoldQuantity: int("preorder_sold_quantity").default(0).notNull(),
  sellingStatus: mysqlEnum("selling_status", ["available", "stopped"]).default("available").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SessionProduct = typeof sessionProducts.$inferSelect;
export type InsertSessionProduct = typeof sessionProducts.$inferInsert;

// ============================================================================
// XLCS V1.0: AI Agent - Settings (AI 行为配置)
// ============================================================================

export const aiSettings = mysqlTable("ai_settings", {
  id: int("id").autoincrement().primaryKey(),
  autoReplyEnabled: boolean("auto_reply_enabled").default(true).notNull(),
  learningMode: mysqlEnum("learning_mode", ["suggestion", "draft", "disabled"]).default("suggestion").notNull(),
  minConfidenceThreshold: decimal("min_confidence_threshold", { precision: 5, scale: 2 }).default("70.00").notNull(),
  messengerAiEnabled: boolean("messenger_ai_enabled").default(true).notNull(),
  whatsappAiEnabled: boolean("whatsapp_ai_enabled").default(true).notNull(),
  facebookCommentsOrderOnly: boolean("facebook_comments_order_only").default(false).notNull(),
  plantDiagnosticForceHuman: boolean("plant_diagnostic_force_human").default(true).notNull(),
  paymentRequiresHumanConfirm: boolean("payment_requires_human_confirm").default(true).notNull(),
  parcelAnomalyDays: int("parcel_anomaly_days").default(5).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  updatedBy: text("updated_by"),
});

export type AiSetting = typeof aiSettings.$inferSelect;
export type InsertAiSetting = typeof aiSettings.$inferInsert;

// ============================================================================
// XLCS V1.0: AI Agent - Reply Logs (AI 回复记录)
// ============================================================================

export const aiReplyLogs = mysqlTable("ai_reply_logs", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customer_id"),
  customerName: text("customer_name"),
  platform: mysqlEnum("platform", ["messenger", "whatsapp", "facebook_comment", "internal"]),
  aiModule: mysqlEnum("ai_module", ["order", "parcel", "plant_diagnostic", "faq", "knowledge", "payment", "content", "unknown"]),
  userMessage: text("user_message"),
  aiReply: text("ai_reply"),
  flowUsed: text("flow_used"),
  faqUsed: text("faq_used"),
  knowledgeUsed: text("knowledge_used"),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
  transferredToHuman: boolean("transferred_to_human").default(false).notNull(),
  humanReply: text("human_reply"),
  humanRepliedAt: timestamp("human_replied_at"),
  humanRepliedBy: text("human_replied_by"),
  chatSessionId: int("chat_session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AiReplyLog = typeof aiReplyLogs.$inferSelect;
export type InsertAiReplyLog = typeof aiReplyLogs.$inferInsert;

// ============================================================================
// XLCS V1.0: AI Agent - Review Items (AI 学习建议)
// ============================================================================

export const aiReviewItems = mysqlTable("ai_review_items", {
  id: int("id").autoincrement().primaryKey(),
  replyLogId: int("reply_log_id"),
  customerQuestion: text("customer_question").notNull(),
  humanReply: text("human_reply"),
  aiSuggestion: text("ai_suggestion").notNull(),
  suggestionType: mysqlEnum("suggestion_type", ["faq", "knowledge", "flow"]),
  suggestedCategory: text("suggested_category"),
  suggestedContent: text("suggested_content"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "modified", "ignored"]).default("pending").notNull(),
  adminNote: text("admin_note"),
  modifiedReply: text("modified_reply"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AiReviewItem = typeof aiReviewItems.$inferSelect;
export type InsertAiReviewItem = typeof aiReviewItems.$inferInsert;

// ============================================================================
// XLCS V1.0: AI Agent - FAQ Entries (FAQ 管理)
// ============================================================================

export const faqEntries = mysqlTable("faq_entries", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 100 }).notNull(),
  keywords: text("keywords"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  pdfUrl: text("pdf_url"),
  productId: int("product_id"),
  sortOrder: int("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type FaqEntry = typeof faqEntries.$inferSelect;
export type InsertFaqEntry = typeof faqEntries.$inferInsert;

// ============================================================================
// XLCS V1.0: AI Agent - Knowledge Entries (Knowledge 管理)
// ============================================================================

export const knowledgeEntries = mysqlTable("knowledge_entries", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id"),
  topic: varchar("topic", { length: 200 }).notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  pdfUrl: text("pdf_url"),
  tags: text("tags"),
  sortOrder: int("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type InsertKnowledgeEntry = typeof knowledgeEntries.$inferInsert;

// ============================================================================
// XLCS V1.0: AI Agent - Plant Diagnostic Tickets (植物诊断工单)
// ============================================================================

export const plantDiagnosticTickets = mysqlTable("plant_diagnostic_tickets", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customer_id"),
  customerName: text("customer_name"),
  platform: mysqlEnum("platform", ["messenger", "whatsapp", "internal"]),
  // Environment info collected by AI
  placement: varchar("placement", { length: 50 }),
  lightingHours: text("lighting_hours"),
  wateringFrequency: text("watering_frequency"),
  soilDryDays: text("soil_dry_days"),
  recentFertilized: boolean("recent_fertilized"),
  fertilizerType: text("fertilizer_type"),
  recentRepotted: boolean("recent_repotted"),
  recentSprayed: boolean("recent_sprayed"),
  hasPests: boolean("has_pests"),
  leafCondition: text("leaf_condition"),
  branchCondition: text("branch_condition"),
  rootCondition: text("root_condition"),
  photoUrls: text("photo_urls"),
  // Status
  status: mysqlEnum("status", ["collecting", "pending_human", "in_progress", "resolved", "closed"]).default("collecting").notNull(),
  assignedTo: text("assigned_to"),
  humanReply: text("human_reply"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
  chatSessionId: int("chat_session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PlantDiagnosticTicket = typeof plantDiagnosticTickets.$inferSelect;
export type InsertPlantDiagnosticTicket = typeof plantDiagnosticTickets.$inferInsert;

// ============================================================================
// XLCS V1.0: AI Agent - Chat Sessions (AI 对话会话)
// ============================================================================

export const aiChatSessions = mysqlTable("ai_chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customer_id"),
  customerName: text("customer_name"),
  platform: mysqlEnum("platform", ["messenger", "whatsapp", "facebook_comment", "internal"]),
  status: mysqlEnum("status", ["active", "transferred", "closed"]).default("active").notNull(),
  messageCount: int("message_count").default(0).notNull(),
  lastMessageAt: timestamp("last_message_at"),
  transferredAt: timestamp("transferred_at"),
  transferredTo: text("transferred_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type AiChatSession = typeof aiChatSessions.$inferSelect;
export type InsertAiChatSession = typeof aiChatSessions.$inferInsert;

// ============================================================================
// XLCS V1.0: Session Product Variants (场次 Variant 绑定 + 独立关键词)
// ============================================================================

export const sessionProductVariants = mysqlTable("session_product_variants", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("session_id").notNull(),
  sessionProductId: int("session_product_id").notNull(),
  productId: int("product_id").notNull(),
  variantId: int("variant_id").notNull(),
  keyword: varchar("keyword", { length: 100 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  physicalStockAtStart: int("physical_stock_at_start").default(0).notNull(),
  physicalSoldQuantity: int("physical_sold_quantity").default(0).notNull(),
  preorderEnabled: boolean("preorder_enabled").default(false).notNull(),
  preorderLimit: int("preorder_limit"),
  preorderSoldQuantity: int("preorder_sold_quantity").default(0).notNull(),
  sellingStatus: mysqlEnum("selling_status", ["available", "stopped"]).default("available").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SessionProductVariant = typeof sessionProductVariants.$inferSelect;
export type InsertSessionProductVariant = typeof sessionProductVariants.$inferInsert;
