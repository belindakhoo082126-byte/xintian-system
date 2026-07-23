import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, uniqueIndex } from "drizzle-orm/mysql-core";

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

  // Mall sync (Phase: Mall module)
  syncToMall: boolean("syncToMall").default(false).notNull(),
  mallSortOrder: int("mallSortOrder").default(0).notNull(),

  // V1.1: Pot product support (换盆功能)
  isPot: boolean("isPot").default(false).notNull(),
  potCapacity: varchar("potCapacity", { length: 100 }),

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
  facebookId: varchar("facebookId", { length: 255 }),
  facebookName: varchar("facebookName", { length: 255 }),
  messengerId: varchar("messengerId", { length: 255 }),
  name: varchar("name", { length: 255 }),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  country: varchar("country", { length: 100 }),
  shopLinkIdentifier: varchar("shopLinkIdentifier", { length: 255 }),
  totalOrders: int("totalOrders").default(0),
  totalSpent: decimal("totalSpent", { precision: 12, scale: 2 }).default("0"),
  membershipLevel: mysqlEnum("membershipLevel", ["regular", "member", "vip"]).default("regular"),
  pointsBalance: int("pointsBalance").default(0),
  isBlacklisted: boolean("isBlacklisted").default(false),
  blacklistReason: text("blacklistReason"),
  /** Internal customer profile remark; never exposed by public storefront APIs. */
  notes: text("notes"),
  mergedIntoCustomerId: int("mergedIntoCustomerId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastOrderAt: timestamp("lastOrderAt"),
  // Existing XLCS customer profile fields
  customerId: varchar("customerId", { length: 20 }).notNull(),
  displayName: varchar("displayName", { length: 255 }),
  whatsappPhone: varchar("whatsappPhone", { length: 20 }),
  avatarUrl: varchar("avatarUrl", { length: 500 }),
  overrideAvatarUrl: varchar("overrideAvatarUrl", { length: 500 }),
  customerSource: mysqlEnum("customerSource", ["facebook_live", "facebook_messenger", "whatsapp", "store", "admin"]).notNull().default("admin"),
  lastInteractionAt: timestamp("lastInteractionAt"),
  blacklistAt: timestamp("blacklistAt"),
  blacklistBy: int("blacklistBy"),
  unblacklistAt: timestamp("unblacklistAt"),
  unblacklistBy: int("unblacklistBy"),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ============================================================================
// Orders
// ============================================================================

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull().unique(),
  customerId: int("customerId").notNull(),
  facebookName: varchar("facebookName", { length: 255 }),
  facebookId: varchar("facebookId", { length: 255 }),
  messengerId: varchar("messengerId", { length: 255 }),
  orderType: mysqlEnum("orderType", ["physical", "membership", "mixed"]).notNull(),
  physicalSubtotal: decimal("physicalSubtotal", { precision: 10, scale: 2 }).default("0"),
  membershipSubtotal: decimal("membershipSubtotal", { precision: 10, scale: 2 }).default("0"),
  shippingFee: decimal("shippingFee", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }).default("0"),
  physicalStatus: mysqlEnum("physicalStatus", [
    "pending",           // 挂单 - waiting for payment
    "receipt_uploaded",  // 确认汇款 - customer uploaded payment proof
    "partial_payment",   // 部分汇款 - customer paid partially
    "hold_order",        // 保留订单 - customer requested hold
    "packing",           // 待包货 - ready for packing
    "shipped",           // 已发货 - all parcels shipped
    "partial_shipped",   // 部分发货 - some items shipped
    "completed",         // 完成订单
    "cancelled",         // 已取消
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
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  paymentMethodId: int("paymentMethodId"),
  paymentMethodName: varchar("paymentMethodName", { length: 100 }),
  receiptUrl: varchar("receiptUrl", { length: 500 }),
  // Order source tracking
  orderSource: mysqlEnum("orderSource", [
    "facebook_live", "facebook_post", "facebook_reel",
    "messenger", "store", "manual"
  ]).default("manual"),
  sourceName: varchar("sourceName", { length: 255 }),
  // Facebook comment tracking
  originalCustomerComment: text("originalCustomerComment"),
  commentDate: timestamp("commentDate"),
  // Total weight for shipping calculation
  totalWeight: decimal("totalWeight", { precision: 8, scale: 2 }).default("0"),
  // Discount
  discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  paymentUploadedAt: timestamp("paymentUploadedAt"),
  paymentConfirmedAt: timestamp("paymentConfirmedAt"),
  shippedAt: timestamp("shippedAt"),
  completedAt: timestamp("completedAt"),
  autoCompleteAt: timestamp("autoCompleteAt"),
  // V1.1: Scheduled shipping date (预约发货日期)
  scheduledShippingDate: timestamp("scheduledShippingDate"),
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
  // Snapshot fields (permanent record, never changes after order creation)
  productName: varchar("productName", { length: 255 }).notNull(),
  productSku: varchar("productSku", { length: 100 }),
  productType: mysqlEnum("productType", ["physical", "membership", "gift"]),
  // Variant snapshot
  variationId: int("variationId"),
  variationName: varchar("variationName", { length: 255 }),
  // Facebook keyword that triggered this item
  facebookKeyword: varchar("facebookKeyword", { length: 100 }),
  // Pricing
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  // Weight per unit (for shipping calculation)
  unitWeight: decimal("unitWeight", { precision: 8, scale: 2 }).default("0"),
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
// System Settings - Company Profile (公司资料)
// ============================================================================

export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  // Company info
  companyName: varchar("companyName", { length: 255 }),
  companyLogoUrl: varchar("companyLogoUrl", { length: 500 }),
  companyAddress: text("companyAddress"),
  companyPhone: varchar("companyPhone", { length: 50 }),
  companyEmail: varchar("companyEmail", { length: 255 }),
  companyWebsite: varchar("companyWebsite", { length: 255 }),
  businessRegNo: varchar("businessRegNo", { length: 100 }),
  // Default shipping address
  defaultShipFromAddress: text("defaultShipFromAddress"),
  defaultShipFromPhone: varchar("defaultShipFromPhone", { length: 50 }),
  defaultShipFromName: varchar("defaultShipFromName", { length: 255 }),
  defaultShipFromPostcode: varchar("defaultShipFromPostcode", { length: 10 }),
  defaultShipFromState: varchar("defaultShipFromState", { length: 100 }),
  defaultShipFromCity: varchar("defaultShipFromCity", { length: 100 }),
  // Currency & Timezone
  currency: varchar("currency", { length: 10 }).default("MYR").notNull(),
  timezone: varchar("timezone", { length: 50 }).default("Asia/Kuala_Lumpur").notNull(),
  // Numbering rules
  orderPrefix: varchar("orderPrefix", { length: 20 }).default("ORD").notNull(),
  orderNumberPadding: int("orderNumberPadding").default(6).notNull(),
  poPrefix: varchar("poPrefix", { length: 20 }).default("PO").notNull(),
  poNumberPadding: int("poNumberPadding").default(6).notNull(),
  customerPrefix: varchar("customerPrefix", { length: 20 }).default("CUS").notNull(),
  customerNumberPadding: int("customerNumberPadding").default(6).notNull(),
  skuPrefix: varchar("skuPrefix", { length: 20 }).default("SKU").notNull(),
  skuNumberPadding: int("skuNumberPadding").default(6).notNull(),
  // Notification settings
  notifyOnNewOrder: boolean("notifyOnNewOrder").default(true).notNull(),
  notifyOnPayment: boolean("notifyOnPayment").default(true).notNull(),
  notifyOnShipment: boolean("notifyOnShipment").default(true).notNull(),
  notifyEmail: varchar("notifyEmail", { length: 255 }),
  // Security
  requireStaffLogin: boolean("requireStaffLogin").default(true).notNull(),
  autoCompleteDays: int("autoCompleteDays").default(7).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

// ============================================================================
// Shipping Rules (运费规则)
// ============================================================================

export const shippingRules = mysqlTable("shipping_rules", {
  id: int("id").autoincrement().primaryKey(),
  // Shipping zone: west_malaysia, east_malaysia, self_pickup, lalamove
  zone: mysqlEnum("zone", ["west_malaysia", "east_malaysia", "self_pickup", "lalamove"]).notNull(),
  // Display name
  displayName: varchar("displayName", { length: 100 }).notNull(),
  // Free shipping threshold (RM)
  freeShippingThreshold: decimal("freeShippingThreshold", { precision: 10, scale: 2 }),
  // Free shipping max weight (kg)
  freeShippingMaxWeight: decimal("freeShippingMaxWeight", { precision: 8, scale: 2 }),
  // Additional weight price per kg (RM)
  additionalKgPrice: decimal("additionalKgPrice", { precision: 10, scale: 2 }),
  // Default courier for zone
  defaultCourier: varchar("defaultCourier", { length: 50 }),
  // For east malaysia: max weight to calculate (e.g. 2kg)
  maxCalculateWeight: decimal("maxCalculateWeight", { precision: 8, scale: 2 }),
  // Special instructions
  specialInstruction: text("specialInstruction"),
  // Is enabled
  isEnabled: boolean("isEnabled").default(true).notNull(),
  // Sort order
  sortOrder: int("sortOrder").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShippingRule = typeof shippingRules.$inferSelect;
export type InsertShippingRule = typeof shippingRules.$inferInsert;

// ============================================================================
// Shipping Providers (物流供应商配置)
// ============================================================================

export const shippingProviders = mysqlTable("shipping_providers", {
  id: int("id").autoincrement().primaryKey(),
  // Provider key: parceldaily, parcel_king, manual
  providerKey: varchar("providerKey", { length: 50 }).notNull().unique(),
  // Display name
  displayName: varchar("displayName", { length: 100 }).notNull(),
  // Is enabled
  isEnabled: boolean("isEnabled").default(false).notNull(),
  // Environment: sandbox / production
  environment: mysqlEnum("environment", ["sandbox", "production"]).default("production").notNull(),
  // Credentials stored as JSON (merchant_id, token, etc.) - NOT exposed to frontend
  credentials: text("credentials"), // JSON string, server-side only
  // Supported couriers (JSON array)
  supportedCouriers: text("supportedCouriers"), // JSON array: ["line_clear", "spx", "poslaju", ...]
  // Last sync timestamp
  lastSyncAt: timestamp("lastSyncAt"),
  // Account balance (cached)
  accountBalance: decimal("accountBalance", { precision: 12, scale: 2 }),
  // Additional config (JSON)
  config: text("config"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShippingProvider = typeof shippingProviders.$inferSelect;
export type InsertShippingProvider = typeof shippingProviders.$inferInsert;

// ============================================================================
// Shipments (物流运单)
// ============================================================================

export const shipments = mysqlTable("shipments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  // Provider
  providerKey: varchar("providerKey", { length: 50 }).notNull(),
  // Courier selected (e.g. spx, poslaju, line_clear)
  courier: varchar("courier", { length: 50 }).notNull(),
  // ParcelDaily order ID
  providerOrderId: varchar("providerOrderId", { length: 100 }),
  // Tracking number
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  // Consignment note URL (AWB)
  consignmentNoteUrl: varchar("consignmentNoteUrl", { length: 500 }),
  // Weight
  actualWeight: decimal("actualWeight", { precision: 8, scale: 2 }).notNull(),
  // Shipping cost (from provider)
  shippingCost: decimal("shippingCost", { precision: 10, scale: 2 }),
  // Status
  status: mysqlEnum("status", ["created", "checked_out", "in_transit", "delivered", "failed", "cancelled"]).default("created").notNull(),
  // Raw API response (JSON)
  rawResponse: text("rawResponse"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  checkedOutAt: timestamp("checkedOutAt"),
  shippedAt: timestamp("shippedAt"),
  deliveredAt: timestamp("deliveredAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;

// ============================================================================
// Payment Methods (付款方式设定)
// ============================================================================

export const paymentMethods = mysqlTable("payment_methods", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  // Type: qr_code, bank_transfer, cash, other
  type: mysqlEnum("type", ["qr_code", "bank_transfer", "cash", "other"]).default("qr_code").notNull(),
  // QR Code image URL (for qr_code type)
  qrImageUrl: varchar("qrImageUrl", { length: 500 }),
  // Bank details (for bank_transfer type)
  bankName: varchar("bankName", { length: 100 }),
  accountHolder: varchar("accountHolder", { length: 255 }),
  accountNumber: varchar("accountNumber", { length: 50 }),
  // Payment instruction shown to customer
  paymentInstruction: text("paymentInstruction"),
  // Remark (internal note)
  remark: text("remark"),
  // Status
  isEnabled: boolean("isEnabled").default(true).notNull(),
  // Display order
  displayOrder: int("displayOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

// ============================================================================
// Order Status Log (订单状态变更记录)
// ============================================================================

export const orderStatusLogs = mysqlTable("order_status_logs", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  // Status before change
  fromStatus: varchar("fromStatus", { length: 50 }),
  // Status after change
  toStatus: varchar("toStatus", { length: 50 }).notNull(),
  // Who made the change
  changedBy: varchar("changedBy", { length: 255 }),
  // Reason/notes for the change
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderStatusLog = typeof orderStatusLogs.$inferSelect;
export type InsertOrderStatusLog = typeof orderStatusLogs.$inferInsert;

// ============================================================================
// Hold Order Info (保留订单信息)
// ============================================================================

export const holdOrderInfos = mysqlTable("hold_order_infos", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().unique(),
  // Hold type
  holdType: mysqlEnum("holdType", [
    "wait_next_live",      // 等待下次直播加单
    "scheduled_shipping",  // 指定日期发货
    "wait_stock",          // 等待缺货商品
    "other",               // 其他
  ]).notNull(),
  // Scheduled shipping date (for scheduled_shipping type)
  scheduledShippingDate: timestamp("scheduledShippingDate"),
  // Allow auto merge with new orders from same customer
  allowAutoMerge: boolean("allowAutoMerge").default(true).notNull(),
  // Hold remark
  holdRemark: text("holdRemark"),
  // Staff who placed the hold
  holdBy: varchar("holdBy", { length: 255 }),
  // When the hold was created
  holdCreatedAt: timestamp("holdCreatedAt").defaultNow().notNull(),
  // When the hold was released
  holdReleasedAt: timestamp("holdReleasedAt"),
  // Is the hold still active
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HoldOrderInfo = typeof holdOrderInfos.$inferSelect;
export type InsertHoldOrderInfo = typeof holdOrderInfos.$inferInsert;

// ============================================================================
// Notification Log (通知发送记录)
// ============================================================================

export const notificationLogs = mysqlTable("notification_logs", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId"),
  customerId: int("customerId"),
  // Notification type: payment_confirmed, hold_order, shipped, etc.
  type: varchar("type", { length: 50 }).notNull(),
  // Channel: messenger, whatsapp, email
  channel: mysqlEnum("channel", ["messenger", "whatsapp", "email"]).default("messenger").notNull(),
  // Message content
  message: text("message"),
  // Status: sent, failed, pending
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  // Error message if failed
  errorMessage: text("errorMessage"),
  // External message ID (from Messenger API)
  externalMessageId: varchar("externalMessageId", { length: 255 }),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = typeof notificationLogs.$inferInsert;

// ============================================================================
// Mall Module - Mall Settings (商城设置)
// ============================================================================

export const mallSettings = mysqlTable("mall_settings", {
  id: int("id").autoincrement().primaryKey(),
  // Basic Information
  shopName: varchar("shopName", { length: 200 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  logoUrl: varchar("logoUrl", { length: 500 }),
  faviconUrl: varchar("faviconUrl", { length: 500 }),
  slogan: varchar("slogan", { length: 500 }),
  seoTitle: varchar("seoTitle", { length: 200 }),
  seoDescription: text("seoDescription"),
  // Future reserved
  facebookPixel: varchar("facebookPixel", { length: 100 }),
  googleAnalytics: varchar("googleAnalytics", { length: 100 }),
  // Policies
  shippingPolicy: text("shippingPolicy"),
  refundPolicy: text("refundPolicy"),
  serviceTerms: text("serviceTerms"),
  // Contact Information
  companyName: varchar("companyName", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  email: varchar("email", { length: 200 }),
  facebook: varchar("facebook", { length: 500 }),
  address: text("address"),
  wazeLink: varchar("wazeLink", { length: 500 }),
  googleMapLink: varchar("googleMapLink", { length: 500 }),
  // Active theme
  activeTheme: varchar("activeTheme", { length: 50 }).default("xintian_nature").notNull(),
  // Custom theme colors (JSON: { primary, secondary, button, background, font })
  customThemeColors: json("customThemeColors"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MallSetting = typeof mallSettings.$inferSelect;
export type InsertMallSetting = typeof mallSettings.$inferInsert;

// ============================================================================
// Mall Module - Banners (商城横幅)
// ============================================================================

export const mallBanners = mysqlTable("mall_banners", {
  id: int("id").autoincrement().primaryKey(),
  // Banner type: home_16x9, home_9x16, home_1x1, marketing_16x9, marketing_1x1, marketing_9x16
  type: mysqlEnum("type", ["home_16x9", "home_9x16", "home_1x1", "marketing_16x9", "marketing_1x1", "marketing_9x16"]).notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }).notNull(),
  linkUrl: varchar("linkUrl", { length: 500 }),
  displayOrder: int("displayOrder").default(0).notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MallBanner = typeof mallBanners.$inferSelect;
export type InsertMallBanner = typeof mallBanners.$inferInsert;

// ============================================================================
// Mall Module - Quick Contact Buttons (快捷联系按钮)
// ============================================================================

export const mallQuickContacts = mysqlTable("mall_quick_contacts", {
  id: int("id").autoincrement().primaryKey(),
  // Button type: whatsapp, messenger, facebook_page, waze, google_map
  type: mysqlEnum("type", ["whatsapp", "messenger", "facebook_page", "waze", "google_map"]).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }),
  linkUrl: varchar("linkUrl", { length: 500 }).notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MallQuickContact = typeof mallQuickContacts.$inferSelect;
export type InsertMallQuickContact = typeof mallQuickContacts.$inferInsert;

// ============================================================================
// Mall Module - Notices (首页公告)
// ============================================================================

export const mallNotices = mysqlTable("mall_notices", {
  id: int("id").autoincrement().primaryKey(),
  announcement: varchar("announcement", { length: 500 }).notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MallNotice = typeof mallNotices.$inferSelect;
export type InsertMallNotice = typeof mallNotices.$inferInsert;

// ============================================================================
// Mall Module - Theme Scheduler (主题排程)
// ============================================================================

export const mallThemeSchedules = mysqlTable("mall_theme_schedules", {
  id: int("id").autoincrement().primaryKey(),
  themeKey: varchar("themeKey", { length: 50 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MallThemeSchedule = typeof mallThemeSchedules.$inferSelect;
export type InsertMallThemeSchedule = typeof mallThemeSchedules.$inferInsert;

// ============================================================================
// Mall Module - Product Detail Images (商品详情图片)
// ============================================================================

export const mallProductDetailImages = mysqlTable("mall_product_detail_images", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }).notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MallProductDetailImage = typeof mallProductDetailImages.$inferSelect;
export type InsertMallProductDetailImage = typeof mallProductDetailImages.$inferInsert;

// ============================================================================
// Packages (包裹) - Multi-package shipping support
// ============================================================================

export const packages = mysqlTable("packages", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  // Package number within the order (1, 2, 3...)
  packageNumber: int("packageNumber").notNull(),
  // Courier selection
  courier: varchar("courier", { length: 100 }).notNull(),
  // Shipping method: auto (ParcelDaily API) or manual
  shippingType: mysqlEnum("shippingType", ["auto", "manual"]).default("manual").notNull(),
  // Tracking number (manual entry or auto from ParcelDaily)
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  // Shipping label URL (auto-generated from ParcelDaily)
  shippingLabelUrl: varchar("shippingLabelUrl", { length: 500 }),
  // ParcelDaily order ID (if auto)
  providerOrderId: varchar("providerOrderId", { length: 100 }),
  // Weight of this package
  weight: decimal("weight", { precision: 8, scale: 2 }).default("0"),
  // Shipping cost
  shippingCost: decimal("shippingCost", { precision: 10, scale: 2 }),
  // Package status
  status: mysqlEnum("status", ["pending", "shipped", "delivered"]).default("pending").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  shippedAt: timestamp("shippedAt"),
  deliveredAt: timestamp("deliveredAt"),
});

export type Package = typeof packages.$inferSelect;
export type InsertPackage = typeof packages.$inferInsert;

// ============================================================================
// Package Items (包裹商品) - For partial shipping tracking
// ============================================================================

export const packageItems = mysqlTable("package_items", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  orderItemId: int("orderItemId").notNull(),
  // Quantity of this item in this package
  quantity: int("quantity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PackageItem = typeof packageItems.$inferSelect;
export type InsertPackageItem = typeof packageItems.$inferInsert;

// ============================================================================
// Live Order Captures (直播捉单记录)
// ============================================================================

export const liveOrderCaptures = mysqlTable("live_order_captures", {
  id: int("id").autoincrement().primaryKey(),
  // Facebook comment info
  commentId: varchar("commentId", { length: 255 }),
  commenterName: varchar("commenterName", { length: 255 }).notNull(),
  commenterPsid: varchar("commenterPsid", { length: 255 }),
  commentMessage: text("commentMessage").notNull(),
  postId: varchar("postId", { length: 255 }),
  liveVideoId: varchar("liveVideoId", { length: 255 }),
  // Parsed keywords
  parsedKeywords: text("parsedKeywords"),
  // Matched products (JSON array of { productId, keyword, quantity })
  matchedProducts: text("matchedProducts"),
  // Status: matched, no_match, order_created, failed
  status: mysqlEnum("status", ["matched", "no_match", "order_created", "failed"]).default("matched").notNull(),
  // Created order ID (if order was created)
  orderId: int("orderId"),
  // Error message (if failed)
  errorMessage: text("errorMessage"),
  // Timestamps
  commentDate: timestamp("commentDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // Prevents duplicate order creation when Facebook retries webhook delivery.
  commentIdUnique: uniqueIndex("uq_comment_id").on(table.commentId),
}));

export type LiveOrderCapture = typeof liveOrderCaptures.$inferSelect;
export type InsertLiveOrderCapture = typeof liveOrderCaptures.$inferInsert;

// ============================================================================
// V1.1: Order Item Repots (换盆功能 - 订单商品换盆记录)
// ============================================================================
export const orderItemRepots = mysqlTable("order_item_repots", {
  id: int("id").autoincrement().primaryKey(),
  orderItemId: int("orderItemId").notNull(),
  orderId: int("orderId").notNull(),
  // Original product (the plant)
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  // Pot product (the replacement pot)
  potProductId: int("potProductId").notNull(),
  potProductName: varchar("potProductName", { length: 255 }).notNull(),
  // How many units of this product get this pot
  quantity: int("quantity").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type OrderItemRepot = typeof orderItemRepots.$inferSelect;
export type InsertOrderItemRepot = typeof orderItemRepots.$inferInsert;

// ============================================================================
// V1.1: Order Remarks (订单备注 - 3种类型: 直播/客户/内部)
// ============================================================================
export const orderRemarks = mysqlTable("order_remarks", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  // Type: live (直播备注), customer (客户备注), internal (内部备注)
  type: mysqlEnum("type", ["live", "customer", "internal"]).notNull(),
  content: text("content").notNull(),
  // Who created this remark
  createdBy: varchar("createdBy", { length: 255 }),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type OrderRemark = typeof orderRemarks.$inferSelect;
export type InsertOrderRemark = typeof orderRemarks.$inferInsert;
