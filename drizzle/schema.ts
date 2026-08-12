import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, uniqueIndex, index, date, bigint } from "drizzle-orm/mysql-core";

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
  preferredLanguage: mysqlEnum("preferredLanguage", ["zh", "en"]).default("zh").notNull(),
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
  // Business AI: Reserved quantity (for draft orders and change requests)
  reservedQuantity: int("reservedQuantity").default(0).notNull(),
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
  // Keyword applicable channels: JSON array of ["fb_live", "fb_post", "fb_reel", "messenger", "whatsapp"]
  keywordChannels: text("keywordChannels"),
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

  // V2: Special price product (特价商品)
  isSpecial: boolean("isSpecial").default(false).notNull(),
  // specialPrice already exists above (legacy field, repurposed)

  // V2: Pre-sale support (预售)
  allowPresale: boolean("allowPresale").default(false).notNull(),

  // V2: Standalone shipping (单颗邮寄)
  allowStandaloneShipping: boolean("allowStandaloneShipping").default(false).notNull(),
  // V1.2: Standalone shipping method & fee
  standaloneShippingMethod: mysqlEnum("standaloneShippingMethod", ["fixed_fee", "free_shipping"]).default("fixed_fee"),
  standaloneShippingFee: decimal("standaloneShippingFee", { precision: 10, scale: 2 }).default("0"),

  // V2: Structured care description (结构化养护说明)
  lightDesc: text("lightDesc"),
  waterDesc: text("waterDesc"),
  fertilizerDesc: text("fertilizerDesc"),
  pruningDesc: text("pruningDesc"),

  // V2.0: Sales mode (销售模式)
  salesMode: mysqlEnum("salesMode", ["normal", "presale", "import_preorder"]).default("normal").notNull(),
  // V2.1: Order category — determines whether product belongs to local (XT) or import (XTC) orders
  orderCategory: mysqlEnum("orderCategory", ["local", "import"]).default("local").notNull(),
  // V2.0: Preorder wait days (预计等待时间, e.g. "30~45天")
  preorderWaitDays: varchar("preorderWaitDays", { length: 100 }),
  // V2.0: Allow mixed checkout with normal products (允许与普通商品一起Checkout)
  // Note: allowMixedCheckout already exists above, repurposed for V2.0
  // V2.0: Spot sale after arrival (到货后现货销售)
  spotSaleEnabled: boolean("spotSaleEnabled").default(false).notNull(),
  spotSaleQty: int("spotSaleQty").default(0).notNull(),
  // V2.0: Linked import batch (for preorder products)
  linkedBatchId: int("linkedBatchId"),

  // V4: Wholesale price (auto-calculated as sellingPrice × 50%, admin can override)
  wholesalePrice: decimal("wholesalePrice", { precision: 10, scale: 2 }),
  // V4: Agent price (auto-calculated as sellingPrice × 70%, admin can override)
  agentPrice: decimal("agentPrice", { precision: 10, scale: 2 }),
  // V4: Minimum order quantity for wholesale
  moq: int("moq").default(0).notNull(),
  // V4: Visibility — which customer types can see this product (JSON array: ["retail","member","wholesale","agent"])
  visibleTo: text("visibleTo"), // JSON array, default ["retail","member","wholesale","agent"]
  // V4: Special price date range
  specialPriceStartDate: timestamp("specialPriceStartDate"),
  specialPriceEndDate: timestamp("specialPriceEndDate"),

  // V5: AI Tags — for AI product recommendation matching (JSON array of strings)
  aiTags: text("aiTags"), // JSON array, e.g. ["办公室","耐阴","新手","送礼"]
  // V5: AI Selling Points — for AI reply enrichment (free text, not used for filtering)
  aiSellingPoints: text("aiSellingPoints"),

  // V2.1.30补充4: Allow oversold — if true, stock can go negative
  allowOversold: boolean("allowOversold").default(false).notNull(),

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
  // V2.1: Variant-level purchase support
  variantId: int("variantId"),
  variantName: varchar("variantName", { length: 100 }),
  variantKeyword: varchar("variantKeyword", { length: 50 }),
  sellingPrice: decimal("sellingPrice", { precision: 10, scale: 2 }),
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
  // V2.1.21: Structured address fields for customer profile
  addressLine1: varchar("addressLine1", { length: 500 }),
  addressLine2: varchar("addressLine2", { length: 500 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  postcode: varchar("postcode", { length: 20 }),
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
  // V4: Customer type (retail / wholesale / agent)
  customerType: mysqlEnum("customerType", ["retail", "wholesale", "agent"]).default("retail").notNull(),
  // V2.2: Customer credit balance (客户Credit余额)
  creditBalance: decimal("creditBalance", { precision: 10, scale: 2 }).default("0").notNull(),
  // V4: Wholesale/agent account credentials
  accountEmail: varchar("accountEmail", { length: 255 }),
  accountPasswordHash: varchar("accountPasswordHash", { length: 255 }),
  // V4: Login enabled flag
  canLogin: boolean("canLogin").default(false).notNull(),
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
  // V4: Sales channel (retail / wholesale / agent / import_preorder)
  salesChannel: mysqlEnum("salesChannel", ["retail", "wholesale", "agent", "import_preorder"]).default("retail").notNull(),
  physicalSubtotal: decimal("physicalSubtotal", { precision: 10, scale: 2 }).default("0"),
  membershipSubtotal: decimal("membershipSubtotal", { precision: 10, scale: 2 }).default("0"),
  shippingFee: decimal("shippingFee", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }).default("0"),
  // V2.1.15: Overpayment and refund tracking
  overpaidAmount: decimal("overpaidAmount", { precision: 10, scale: 2 }).default("0"),
  refundedAmount: decimal("refundedAmount", { precision: 10, scale: 2 }).default("0"),
  // V2.1.18: Resolved overpayment tracking (Credit/TNG/Cash processed amount)
  resolvedOverpaymentAmount: decimal("resolvedOverpaymentAmount", { precision: 10, scale: 2 }).default("0"),
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
    "scheduled",         // 预约发货 - scheduled shipping
    "special",           // 特别订单 - special order
  ]).default("pending"),
  membershipStatus: mysqlEnum("membershipStatus", [
    "pending",           // 待汇款
    "fee_confirmed",     // 已汇款
    "manual_follow_up",  // 待人工发送
    "completed",         // 已完成
    "rejected",          // 已拒绝
    "cancelled"          // 已取消
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
  // V2.2: Order source tracking (订单来源: FB直播/FB贴文/FB Reel/Messenger/商城/Admin手动)
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
  // V2.2: Promotion / discount / extra charge fields
  discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }).default("0"),
  discountReason: varchar("discountReason", { length: 500 }),
  promotionId: int("promotionId"),
  promotionName: varchar("promotionName", { length: 255 }),
  promotionDiscount: decimal("promotionDiscount", { precision: 10, scale: 2 }).default("0"),
  extraCharge: decimal("extraCharge", { precision: 10, scale: 2 }).default("0"),
  extraChargeDescription: varchar("extraChargeDescription", { length: 500 }),
  creditUsed: decimal("creditUsed", { precision: 10, scale: 2 }).default("0"),
  creditRefunded: decimal("creditRefunded", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  paymentUploadedAt: timestamp("paymentUploadedAt"),
  paymentConfirmedAt: timestamp("paymentConfirmedAt"),
  // V2.0.98: Full payment confirmed at (when paidAmount >= totalAmount and confirmed by admin)
  fullPaymentConfirmedAt: timestamp("fullPaymentConfirmedAt"),
  shippedAt: timestamp("shippedAt"),
  completedAt: timestamp("completedAt"),
  autoCompleteAt: timestamp("autoCompleteAt"),
  // V1.1: Scheduled shipping date (预约发货日期)
  scheduledShippingDate: timestamp("scheduledShippingDate"),
  // V1.2: Shipping weight & fee fields
  estimatedWeight: decimal("estimatedWeight", { precision: 8, scale: 2 }).default("0"),
  estimatedChargeableWeight: decimal("estimatedChargeableWeight", { precision: 8, scale: 2 }).default("0"),
  customerPaidShipping: decimal("customerPaidShipping", { precision: 10, scale: 2 }).default("0"),
  actualWeight: decimal("actualWeight", { precision: 8, scale: 2 }),
  actualChargeableWeight: decimal("actualChargeableWeight", { precision: 8, scale: 2 }),
  actualShippingFee: decimal("actualShippingFee", { precision: 10, scale: 2 }),
  shippingDifference: decimal("shippingDifference", { precision: 10, scale: 2 }),
  shippingProfit: decimal("shippingProfit", { precision: 10, scale: 2 }),
  shippingLoss: decimal("shippingLoss", { precision: 10, scale: 2 }),
  // V1.2: Special order flag
  isSpecialOrder: boolean("isSpecialOrder").default(false).notNull(),
  specialOrderType: mysqlEnum("specialOrderType", [
    "pending_shipping",      // 待补运费
    "pending_refund",        // 待退款
    "company_bear",         // 公司承担
    "logistics_error",      // 物流异常
    "incomplete_info",      // 资料异常
    "notification_failed",  // 通知失败
    "stock_exception",      // 库存异常
    "overdue",              // 超时未处理
    "partial_payment",      // 部分汇款
    "over_payment",         // 多汇款
    "amount_changed",       // 付款金额变更
    "other",                // 其他（Admin手动）
  ]),
  specialOrderStatus: mysqlEnum("specialOrderStatus", ["pending", "resolved", "cancelled"]).default("pending"),
  // V3.2: Special status source (system auto vs manual)
  specialOrderSource: mysqlEnum("specialOrderSource", ["system", "manual"]).default("manual"),
  // V3.2: Special status reason (why it was set/modified)
  specialOrderReason: text("specialOrderReason"),
  // V3.2: Who set/modified the special status
  specialOrderBy: varchar("specialOrderBy", { length: 255 }),
  // V3.2: When the special status was last modified
  specialOrderUpdatedAt: timestamp("specialOrderUpdatedAt"),
  // V1.2: Parent order for split orders
  parentOrderId: int("parentOrderId"),
  // V2.2: Order category (订单分类: local=本地 / import=中国代购)
  orderCategory: mysqlEnum("orderCategory", ["local", "import"]).default("local").notNull(),
  // V2.2: Order nature (订单性质: retail/wholesale/agent)
  orderNature: mysqlEnum("orderNature", ["retail", "wholesale", "agent"]).default("retail").notNull(),
  // V2.0: Linked import batch (for import_preorder orders)
  importBatchId: int("importBatchId"),
  // V2.1: Cancel reason and operator
  cancelReason: varchar("cancelReason", { length: 255 }),
  cancelledBy: varchar("cancelledBy", { length: 255 }),
  // V2.0: Linked live room
  liveRoomId: int("liveRoomId"),
  // V2.0: Import preorder status (代购订单状态流程)
  importStatus: mysqlEnum("importStatus", [
    "pending",              // 挂单（未汇款）
    "receipt_uploaded",    // 待审核付款凭证
    "partial_payment",      // 部分汇款
    "waiting_stock",        // 待备货（等待IB验货齐货）
    "ready_to_ship",       // 待发货（齐货可发货）
    "scheduled_ship",      // 预约发货
    "partial_shipped",     // 部分发货
    "shipped",             // 已发货
    "completed",           // 完成
    "cancelled",           // 取消
  ]).default("pending"),
  // V2.0.85: Recipient info (stored on order for display)
  recipientName: varchar("recipientName", { length: 255 }),
  recipientPhone: varchar("recipientPhone", { length: 50 }),
  // V2.1.21: Structured address fields (matching customer table)
  addressLine1: varchar("addressLine1", { length: 500 }),
  addressLine2: varchar("addressLine2", { length: 500 }),
  postcode: varchar("postcode", { length: 20 }),
  recipientCity: varchar("recipientCity", { length: 100 }),
  recipientState: varchar("recipientState", { length: 100 }),
  recipientPostcode: varchar("recipientPostcode", { length: 20 }),
  recipientCountry: varchar("recipientCountry", { length: 100 }),
  // V2.0: Secure token for public order access (customer order page)
  secureToken: varchar("secureToken", { length: 64 }).unique(),
  // V2.0.26: Campaign tracking (订单来源 Campaign 记录)
    campaignId: int("campaignId"),
  campaignName: varchar("campaignName", { length: 255 }),
  sourceType: varchar("sourceType", { length: 50 }),
  // V2.0.33: Checkout Link & Notification tracking
  checkoutLink: varchar("checkoutLink", { length: 255 }),
  notificationStatus: mysqlEnum("notificationStatus", ["pending", "sent", "failed"]).default("pending"),
  notificationError: text("notificationError"),
  notificationSentAt: timestamp("notificationSentAt"),
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
  // V2.0: Item source (标记商品来自哪个渠道)
  itemSource: mysqlEnum("itemSource", ["admin", "facebook_live", "messenger", "mall"]).default("admin"),
  // V2.0: Sales mode snapshot
  salesMode: mysqlEnum("salesMode", ["normal", "presale", "import_preorder"]).default("normal"),
  // V2.1: Price snapshot fields (利润快照)
  priceType: mysqlEnum("priceType", ["retail", "wholesale", "agent", "special", "manual"]).default("retail"),
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }).default("0"),
  originalUnitPrice: decimal("originalUnitPrice", { precision: 10, scale: 2 }),
  // Marketing snapshot: preserves the promotion decision that created this item.
  marketingCampaignId: int("marketingCampaignId"),
  marketingRuleId: int("marketingRuleId"),
  marketingSource: mysqlEnum("marketingSource", ["campaign_discount", "campaign_gift", "add_on", "lottery_prize", "clearance"]),
  marketingDiscount: decimal("marketingDiscount", { precision: 10, scale: 2 }).default("0"),
  marketingSnapshot: text("marketingSnapshot"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ============================================================================
// V5.0: Marketing Center (营销中心)
// ============================================================================

/** A campaign is the mandatory parent for every marketing rule. */
export const marketingCampaigns = mysqlTable("marketing_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  campaignCode: varchar("campaignCode", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "scheduled", "active", "paused", "ended"]).default("draft").notNull(),
  startAt: timestamp("startAt"),
  endAt: timestamp("endAt"),
  orderCategories: text("orderCategories"),
  orderSources: text("orderSources"),
  customerAudience: mysqlEnum("customerAudience", ["all", "member", "non_member", "new_customer", "segment"]).default("all").notNull(),
  customerSegmentId: int("customerSegmentId"),
  showInMall: boolean("showInMall").default(false).notNull(),
  allowMemberPriceStack: boolean("allowMemberPriceStack").default(false).notNull(),
  allowBundlePriceStack: boolean("allowBundlePriceStack").default(false).notNull(),
  allowCouponStack: boolean("allowCouponStack").default(false).notNull(),
  allowPointsEarn: boolean("allowPointsEarn").default(true).notNull(),
  perCustomerLimit: int("perCustomerLimit"),
  perOrderLimit: int("perOrderLimit"),
  usageLimit: int("usageLimit"),
  usageCount: int("usageCount").default(0).notNull(),
  createdBy: varchar("createdBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = typeof marketingCampaigns.$inferInsert;

/** Generic, versioned configuration for quantity, Nth-item, threshold, add-on, clearance and member offers. */
export const marketingRules = mysqlTable("marketing_rules", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  ruleType: mysqlEnum("ruleType", [
    "quantity_gift", "nth_item_discount", "order_threshold", "spin_eligibility",
    "add_on", "product_discount", "category_discount", "clearance", "live_lottery", "member_offer",
  ]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "active", "paused", "ended"]).default("draft").notNull(),
  priority: int("priority").default(100).notNull(),
  stackable: boolean("stackable").default(false).notNull(),
  config: json("config").notNull(),
  usageLimit: int("usageLimit"),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MarketingRule = typeof marketingRules.$inferSelect;
export type InsertMarketingRule = typeof marketingRules.$inferInsert;

/** Explicit product/category scope prevents newly listed products being discounted unintentionally. */
export const marketingRuleScopes = mysqlTable("marketing_rule_scopes", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("ruleId").notNull(),
  scopeType: mysqlEnum("scopeType", ["trigger_product", "eligible_product", "eligible_category", "gift_product", "add_on_product"]).notNull(),
  productId: int("productId"),
  categoryId: int("categoryId"),
  quantity: int("quantity").default(1).notNull(),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MarketingRuleScope = typeof marketingRuleScopes.$inferSelect;
export type InsertMarketingRuleScope = typeof marketingRuleScopes.$inferInsert;

/** Immutable activity application snapshot for reconciliation and marketing-profit reporting. */
export const marketingOrderApplications = mysqlTable("marketing_order_applications", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  campaignId: int("campaignId").notNull(),
  ruleId: int("ruleId"),
  customerId: int("customerId").notNull(),
  applicationType: mysqlEnum("applicationType", ["discount", "gift", "add_on", "free_shipping", "points", "lottery", "coupon"]).notNull(),
  status: mysqlEnum("status", ["applied", "reversed", "expired"]).default("applied").notNull(),
  originalAmount: decimal("originalAmount", { precision: 12, scale: 2 }).default("0").notNull(),
  discountAmount: decimal("discountAmount", { precision: 12, scale: 2 }).default("0").notNull(),
  shippingSubsidy: decimal("shippingSubsidy", { precision: 12, scale: 2 }).default("0").notNull(),
  pointsGranted: int("pointsGranted").default(0).notNull(),
  snapshot: json("snapshot").notNull(),
  appliedAt: timestamp("appliedAt").defaultNow().notNull(),
  reversedAt: timestamp("reversedAt"),
}, (table) => ({
  orderCampaignRule: uniqueIndex("uq_marketing_order_campaign_rule").on(table.orderId, table.campaignId, table.ruleId),
}));
export type MarketingOrderApplication = typeof marketingOrderApplications.$inferSelect;
export type InsertMarketingOrderApplication = typeof marketingOrderApplications.$inferInsert;

/** Per-customer campaign usage enforces customer and order limits without relying on client state. */
export const marketingCampaignUsages = mysqlTable("marketing_campaign_usages", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  ruleId: int("ruleId"),
  customerId: int("customerId").notNull(),
  orderId: int("orderId").notNull(),
  status: mysqlEnum("status", ["used", "reversed"]).default("used").notNull(),
  usedAt: timestamp("usedAt").defaultNow().notNull(),
  reversedAt: timestamp("reversedAt"),
}, (table) => ({
  campaignCustomerOrder: uniqueIndex("uq_marketing_campaign_customer_order").on(table.campaignId, table.customerId, table.orderId),
}));
export type MarketingCampaignUsage = typeof marketingCampaignUsages.$inferSelect;
export type InsertMarketingCampaignUsage = typeof marketingCampaignUsages.$inferInsert;

export const marketingLotteryPrizes = mysqlTable("marketing_lottery_prizes", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  ruleId: int("ruleId"),
  name: varchar("name", { length: 255 }).notNull(),
  prizeType: mysqlEnum("prizeType", ["physical_product", "coupon", "points", "membership_days", "free_shipping", "no_prize"]).notNull(),
  productId: int("productId"),
  productQuantity: int("productQuantity").default(1).notNull(),
  couponCode: varchar("couponCode", { length: 100 }),
  pointsValue: int("pointsValue").default(0).notNull(),
  membershipDays: int("membershipDays").default(0).notNull(),
  probabilityWeight: int("probabilityWeight").default(1).notNull(),
  quantityLimit: int("quantityLimit"),
  quantityAwarded: int("quantityAwarded").default(0).notNull(),
  status: mysqlEnum("status", ["active", "paused", "depleted"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MarketingLotteryPrize = typeof marketingLotteryPrizes.$inferSelect;
export type InsertMarketingLotteryPrize = typeof marketingLotteryPrizes.$inferInsert;

/** Covers spend-based and live-interaction lottery opportunities. */
export const marketingLotteryEntries = mysqlTable("marketing_lottery_entries", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  ruleId: int("ruleId"),
  customerId: int("customerId").notNull(),
  orderId: int("orderId"),
  liveRoomId: int("liveRoomId"),
  entrySource: mysqlEnum("entrySource", ["order_threshold", "live_keyword", "live_answer", "live_interaction", "admin", "live_order"]).notNull(),
  reason: varchar("reason", { length: 500 }),
  entryCount: int("entryCount").default(1).notNull(),
  usedCount: int("usedCount").default(0).notNull(),
  status: mysqlEnum("status", ["pending_payment", "eligible", "drawn", "expired", "cancelled"]).default("pending_payment").notNull(),
  eligibleAt: timestamp("eligibleAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MarketingLotteryEntry = typeof marketingLotteryEntries.$inferSelect;
export type InsertMarketingLotteryEntry = typeof marketingLotteryEntries.$inferInsert;

export const marketingLotteryDraws = mysqlTable("marketing_lottery_draws", {
  id: int("id").autoincrement().primaryKey(),
  entryId: int("entryId").notNull(),
  prizeId: int("prizeId"),
  customerId: int("customerId").notNull(),
  sourceOrderId: int("sourceOrderId"),
  mergedOrderId: int("mergedOrderId"),
  orderItemId: int("orderItemId"),
  status: mysqlEnum("status", ["drawn", "pending_claim", "merged", "claimed_in_store", "forfeited"]).default("drawn").notNull(),
  prizeSnapshot: json("prizeSnapshot").notNull(),
  drawnAt: timestamp("drawnAt").defaultNow().notNull(),
  claimedAt: timestamp("claimedAt"),
});
export type MarketingLotteryDraw = typeof marketingLotteryDraws.$inferSelect;
export type InsertMarketingLotteryDraw = typeof marketingLotteryDraws.$inferInsert;

export const marketingSegments = mysqlTable("marketing_segments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  filterConfig: json("filterConfig").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: varchar("createdBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MarketingSegment = typeof marketingSegments.$inferSelect;
export type InsertMarketingSegment = typeof marketingSegments.$inferInsert;

export const marketingMessageTemplates = mysqlTable("marketing_message_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  channel: mysqlEnum("channel", ["messenger", "manual_copy"]).default("messenger").notNull(),
  subject: varchar("subject", { length: 255 }),
  content: text("content").notNull(),
  buttonLabel: varchar("buttonLabel", { length: 100 }),
  buttonUrl: varchar("buttonUrl", { length: 500 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: varchar("createdBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MarketingMessageTemplate = typeof marketingMessageTemplates.$inferSelect;
export type InsertMarketingMessageTemplate = typeof marketingMessageTemplates.$inferInsert;

/** Rules remain paused until an administrator explicitly enables them. */
export const marketingAutomationRules = mysqlTable("marketing_automation_rules", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId"),
  name: varchar("name", { length: 255 }).notNull(),
  triggerType: mysqlEnum("triggerType", ["segment", "campaign_start", "campaign_ending", "restock", "lottery_eligible", "manual_batch"]).notNull(),
  segmentId: int("segmentId"),
  templateId: int("templateId").notNull(),
  status: mysqlEnum("status", ["paused", "active", "ended"]).default("paused").notNull(),
  scheduleType: mysqlEnum("scheduleType", ["once", "cron", "event"]).default("event").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  heartbeatJobId: varchar("heartbeatJobId", { length: 255 }),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  filterConfig: json("filterConfig"),
  lastRunAt: timestamp("lastRunAt"),
  createdBy: varchar("createdBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  scheduleTaskUid: uniqueIndex("uq_marketing_automation_schedule_task").on(table.scheduleCronTaskUid),
}));
export type MarketingAutomationRule = typeof marketingAutomationRules.$inferSelect;
export type InsertMarketingAutomationRule = typeof marketingAutomationRules.$inferInsert;

export const marketingMessageDeliveries = mysqlTable("marketing_message_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  automationRuleId: int("automationRuleId"),
  campaignId: int("campaignId"),
  templateId: int("templateId"),
  customerId: int("customerId").notNull(),
  orderId: int("orderId"),
  channel: mysqlEnum("channel", ["messenger", "manual_copy"]).default("messenger").notNull(),
  status: mysqlEnum("status", ["queued", "sent", "failed", "skipped"]).default("queued").notNull(),
  renderedContent: text("renderedContent").notNull(),
  trackingToken: varchar("trackingToken", { length: 100 }).notNull().unique(),
  providerMessageId: varchar("providerMessageId", { length: 255 }),
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ruleCustomerDelivery: uniqueIndex("uq_marketing_rule_customer_delivery").on(table.automationRuleId, table.customerId),
}));
export type MarketingMessageDelivery = typeof marketingMessageDeliveries.$inferSelect;
export type InsertMarketingMessageDelivery = typeof marketingMessageDeliveries.$inferInsert;

export const marketingMessageEvents = mysqlTable("marketing_message_events", {
  id: int("id").autoincrement().primaryKey(),
  deliveryId: int("deliveryId").notNull(),
  eventType: mysqlEnum("eventType", ["opened", "clicked", "ordered", "paid"]).notNull(),
  orderId: int("orderId"),
  metadata: json("metadata"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, (table) => ({
  deliveryEvent: uniqueIndex("uq_marketing_delivery_event_order").on(table.deliveryId, table.eventType, table.orderId),
}));
export type MarketingMessageEvent = typeof marketingMessageEvents.$inferSelect;
export type InsertMarketingMessageEvent = typeof marketingMessageEvents.$inferInsert;

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
  localOrderPrefix: varchar("localOrderPrefix", { length: 20 }).default("XT").notNull(),
  importOrderPrefix: varchar("importOrderPrefix", { length: 20 }).default("XTC").notNull(),
  orderNumberPadding: int("orderNumberPadding").default(5).notNull(),
  poPrefix: varchar("poPrefix", { length: 20 }).default("PO").notNull(),
  poNumberPadding: int("poNumberPadding").default(5).notNull(),
  customerPrefix: varchar("customerPrefix", { length: 20 }).default("CUS").notNull(),
  customerNumberPadding: int("customerNumberPadding").default(5).notNull(),
  skuPrefix: varchar("skuPrefix", { length: 20 }).default("SKU").notNull(),
  skuNumberPadding: int("skuNumberPadding").default(5).notNull(),
  // Notification settings
  notifyOnNewOrder: boolean("notifyOnNewOrder").default(true).notNull(),
  notifyOnPayment: boolean("notifyOnPayment").default(true).notNull(),
  notifyOnShipment: boolean("notifyOnShipment").default(true).notNull(),
  notifyEmail: varchar("notifyEmail", { length: 255 }),
  // Security
  requireStaffLogin: boolean("requireStaffLogin").default(true).notNull(),
  autoCompleteDays: int("autoCompleteDays").default(7).notNull(),
  // Live comment footer (used in keyword copy & live post)
  liveCommentFooter: text("liveCommentFooter"),
  // V2.0.42: Custom checkout message template (supports {link} placeholder)
  checkoutMessageTemplate: text("checkoutMessageTemplate"),
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
  status: mysqlEnum("status", ["matched", "no_match", "order_created", "order_merged", "failed"]).default("matched").notNull(),
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
  // V3.0: Remark category (备注类别: repotting/desired_delivery_date/other)
  remarkCategory: mysqlEnum("remarkCategory", [
    "repotting",              // 换盆
    "desired_delivery_date",  // 希望收货日期
    "select_tree",            // 选树
    "other",                  // 其他
    "customer_other",         // 客户自定义备注
  ]),
  content: text("content").notNull(),
  // V3.0: Scheduled shipping date (legacy field, kept for backward compat)
  scheduledShippingDate: date("scheduledShippingDate"),
  // V3.0: Desired delivery date (希望收货日期)
  desiredDeliveryDate: date("desiredDeliveryDate"),
  // V3.0: Desired delivery reason (希望收货日期原因)
  desiredDeliveryReason: varchar("desiredDeliveryReason", { length: 255 }),
  // V3.0: Repotting data (换盆关联: JSON array of {plantProductId, plantName, potProductId, potName, quantity})
  repottingData: text("repottingData"),
  // Who created this remark
  createdBy: varchar("createdBy", { length: 255 }),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type OrderRemark = typeof orderRemarks.$inferSelect;
export type InsertOrderRemark = typeof orderRemarks.$inferInsert;

// ============================================================================
// V1.2: Order Exceptions (订单异常处理 - 待发货阶段)
// ============================================================================
export const orderExceptions = mysqlTable("order_exceptions", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  orderItemId: int("orderItemId"), // specific item if applicable
  // Exception type
  exceptionType: mysqlEnum("exceptionType", [
    "out_of_stock",       // 商品缺货
    "quality_issue",      // 植物品质异常
    "overcharged_shipping", // 运费多收
    "other",              // 其他异常
  ]).notNull(),
  // Customer resolution preference (for quality_issue)
  resolutionType: mysqlEnum("resolutionType", [
    "replace",    // 更换商品
    "wait_restock", // 等待补货
    "refund",     // 退款
    "pending",    // 待选择
  ]).default("pending"),
  // Status of the exception handling
  status: mysqlEnum("status", [
    "open",       // 异常已记录，待处理
    "resolved",   // 已解决（更换/补货/退款完成）
    "cancelled",  // 已取消
  ]).default("open").notNull(),
  // Scrap cost (cost of the discarded plant)
  scrapCost: decimal("scrapCost", { precision: 10, scale: 2 }).default("0"),
  // Refund amount (if refund)
  refundAmount: decimal("refundAmount", { precision: 10, scale: 2 }).default("0"),
  // Description of the quality issue
  description: text("description"),
  // V2.1.26补充4: Quantity of affected items (Issue 6a/6c/6e)
  quantity: int("quantity").default(0),
  // V2.1.26补充4: Customer action for out_of_stock/other (Issue 6b/6f)
  customerAction: mysqlEnum("customerAction", [
    "replace_product", // 更换商品
    "wait_restock",     // 等待补货
    "refund",           // 退款
    "pending",          // 待选择
  ]).default("pending"),
  // V2.1.26补充4: Replacement product info (Issue 6g)
  replacementProductId: int("replacementProductId"),
  replacementProductName: varchar("replacementProductName", { length: 255 }),
  replacementQuantity: int("replacementQuantity").default(0),
  replacementUnitPrice: decimal("replacementUnitPrice", { precision: 10, scale: 2 }).default("0"),
  // V2.1.26补充4: Refund method (Issue 6j): credit/tng/cash
  refundMethod: mysqlEnum("refundMethod", [
    "credit", // 退款到Credit
    "tng",    // 退款TNG
    "cash",   // 退款Cash
  ]),
  // Who created this exception
  createdBy: varchar("createdBy", { length: 255 }),
  // Who resolved it
  resolvedBy: varchar("resolvedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});
export type OrderException = typeof orderExceptions.$inferSelect;
export type InsertOrderException = typeof orderExceptions.$inferInsert;

// ============================================================================
// V1.2: Order Exception Items (异常涉及的商品明细)
// ============================================================================
export const orderExceptionItems = mysqlTable("order_exception_items", {
  id: int("id").autoincrement().primaryKey(),
  exceptionId: int("exceptionId").notNull(),
  orderItemId: int("orderItemId").notNull(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  // Cost per unit at time of scrap
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }).default("0"),
  totalScrapCost: decimal("totalScrapCost", { precision: 10, scale: 2 }).default("0"),
  // Whether this item was scrapped (品质报废)
  isScrapped: boolean("isScrapped").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type OrderExceptionItem = typeof orderExceptionItems.$inferSelect;
export type InsertOrderExceptionItem = typeof orderExceptionItems.$inferInsert;

// ============================================================================
// V1.2: Order Exception Replacements (更换商品记录)
// ============================================================================
export const orderExceptionReplacements = mysqlTable("order_exception_replacements", {
  id: int("id").autoincrement().primaryKey(),
  exceptionId: int("exceptionId").notNull(),
  // Original item being replaced
  originalOrderItemId: int("originalOrderItemId").notNull(),
  originalProductId: int("originalProductId").notNull(),
  originalProductName: varchar("originalProductName", { length: 255 }).notNull(),
  originalQuantity: int("originalQuantity").notNull(),
  // New replacement item
  newProductId: int("newProductId").notNull(),
  newProductName: varchar("newProductName", { length: 255 }).notNull(),
  newQuantity: int("newQuantity").notNull(),
  newUnitPrice: decimal("newUnitPrice", { precision: 10, scale: 2 }).notNull(),
  newSubtotal: decimal("newSubtotal", { precision: 10, scale: 2 }).notNull(),
  // New order item created for the replacement
  newOrderItemId: int("newOrderItemId"),
  createdBy: varchar("createdBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type OrderExceptionReplacement = typeof orderExceptionReplacements.$inferSelect;
export type InsertOrderExceptionReplacement = typeof orderExceptionReplacements.$inferInsert;

// ============================================================================
// V1.2: Inventory Adjustments (库存手动扣减日志)
// ============================================================================
export const inventoryAdjustments = mysqlTable("inventory_adjustments", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  // 发生调整时对应的厂家与名称快照，用于追溯成本来源。
  supplierId: int("supplierId"),
  supplierName: varchar("supplierName", { length: 255 }),
  // Adjustment type
  adjustmentType: mysqlEnum("adjustmentType", [
    "quality_issue",    // 植物品质异常
    "plant_death",      // 植物死亡
    "pest_disease",     // 病虫害
    "human_damage",     // 人为损坏
    "unhealthy",        // 不健康
    "lost",             // 遗失
    "other",            // 其他
  ]).notNull(),
  // Quantity adjusted (negative for stock reduction)
  quantityChange: int("quantityChange").notNull(),
  // Cost impact
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }).default("0"),
  totalCost: decimal("totalCost", { precision: 10, scale: 2 }).default("0"),
  // Related exception (if triggered from order exception)
  orderExceptionId: int("orderExceptionId"),
  // Who made the adjustment
  adjustedBy: varchar("adjustedBy", { length: 255 }),
  // Reason note
  reason: text("reason"),
  remark: text("remark"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InventoryAdjustment = typeof inventoryAdjustments.$inferSelect;
export type InsertInventoryAdjustment = typeof inventoryAdjustments.$inferInsert;

// ============================================================================
// V1.2: Sub Orders (子订单 - 自动拆单)
// ============================================================================

export const orderSubOrders = mysqlTable("order_sub_orders", {
  id: int("id").autoincrement().primaryKey(),
  // Parent order ID
  parentOrderId: int("parentOrderId").notNull(),
  // Sub order number (e.g. XL1023-A, XL1023-B)
  subOrderNumber: varchar("subOrderNumber", { length: 60 }).notNull().unique(),
  // Type: normal (普通商品) or standalone (单独邮寄商品)
  subOrderType: mysqlEnum("subOrderType", ["normal", "standalone"]).notNull(),
  // Items subtotal for this sub-order
  itemsSubtotal: decimal("itemsSubtotal", { precision: 10, scale: 2 }).default("0"),
  // Shipping method for this sub-order
  shippingMethod: mysqlEnum("shippingMethod", ["normal_rule", "fixed_fee", "free_shipping"]).default("normal_rule").notNull(),
  // Shipping fee charged to customer
  shippingFee: decimal("shippingFee", { precision: 10, scale: 2 }).default("0"),
  // Total for this sub-order
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).default("0"),
  // Actual weight (filled at packing stage)
  actualWeight: decimal("actualWeight", { precision: 8, scale: 2 }),
  // Actual shipping fee from courier
  actualShippingFee: decimal("actualShippingFee", { precision: 10, scale: 2 }),
  // AWB number
  awbNumber: varchar("awbNumber", { length: 100 }),
  // Tracking number
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  // Courier company
  courierCompany: varchar("courierCompany", { length: 100 }),
  // Sub-order status
  status: mysqlEnum("status", ["pending", "ready_to_ship", "shipped", "cancelled"]).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrderSubOrder = typeof orderSubOrders.$inferSelect;
export type InsertOrderSubOrder = typeof orderSubOrders.$inferInsert;

// ============================================================================
// V1.2: Special Order Actions (特别订单处理记录)
// ============================================================================

export const specialOrderActions = mysqlTable("special_order_actions", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  // Action type: notify_shortage / confirm_received / refund / company_bear / remark
  actionType: mysqlEnum("actionType", [
    "notify_shortage",    // 通知补运费
    "confirm_received",   // 确认收到补运费
    "refund",             // 退款
    "company_bear",       // 公司承担
    "remark",             // 备注
    "convert_to_credit",  // V2.0.80: 运费差额转 Credit
  ]).notNull(),
  // Amount involved
  amount: decimal("amount", { precision: 10, scale: 2 }).default("0"),
  // Who performed the action
  performedBy: varchar("performedBy", { length: 255 }).notNull(),
  // Remark/note
  remark: text("remark"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SpecialOrderAction = typeof specialOrderActions.$inferSelect;
export type InsertSpecialOrderAction = typeof specialOrderActions.$inferInsert;

// ============================================================================
// V2.1.19: Order Special Statuses (订单特别状态 - 多状态支持)
// ============================================================================

export const orderSpecialStatuses = mysqlTable("order_special_statuses", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  type: mysqlEnum("type", [
    "pending_shipping",      // 待补运费
    "pending_refund",        // 待退款
    "company_bear",         // 公司承担
    "logistics_error",      // 物流异常
    "incomplete_info",      // 资料异常
    "notification_failed",  // 通知失败
    "stock_exception",      // 库存异常
    "overdue",              // 超时未处理
    "over_payment",         // 多汇款
    "amount_changed",       // 付款金额变更
    "amount_anomaly",       // 金额异常
    "other",                // 其他
  ]).notNull(),
  status: mysqlEnum("status", ["pending", "resolved", "cancelled", "false_positive"]).default("pending").notNull(),
  reason: text("reason"),
  amount: decimal("amount", { precision: 10, scale: 2 }).default("0"),
  source: mysqlEnum("source", ["system", "manual"]).default("system").notNull(),
  resolution: varchar("resolution", { length: 255 }),
  resolutionMethod: mysqlEnum("resolutionMethod", [
    "credit", "tng", "cash", "bank_transfer", "other",
    "data_corrected", "company_bear", "false_positive"
  ]),
  resolutionRemark: text("resolutionRemark"),
  createdBy: varchar("createdBy", { length: 255 }),
  resolvedBy: varchar("resolvedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrderSpecialStatus = typeof orderSpecialStatuses.$inferSelect;
export type InsertOrderSpecialStatus = typeof orderSpecialStatuses.$inferInsert;


// ============================================================================
// V2.0: Live Rooms (直播房间)
// ============================================================================

export const liveRooms = mysqlTable("live_rooms", {
  id: int("id").autoincrement().primaryKey(),
  // Live room name
  name: varchar("name", { length: 255 }).notNull(),
  // Live date
  liveDate: timestamp("liveDate").notNull(),
  // Facebook Live video URL
  facebookLiveUrl: varchar("facebookLiveUrl", { length: 500 }),
  // Facebook Live video ID (for replay embedding)
  facebookVideoId: varchar("facebookVideoId", { length: 255 }),
  // Live type: normal or import_preorder
  liveType: mysqlEnum("liveType", ["normal", "import_preorder"]).default("normal").notNull(),
  // For import_preorder: linked batch ID
  importBatchId: int("importBatchId"),
  // Preorder window
  preorderStartDate: timestamp("preorderStartDate"),
  preorderEndDate: timestamp("preorderEndDate"),
  // Estimated wait days (e.g. "30~45天")
  estimatedWaitDays: varchar("estimatedWaitDays", { length: 100 }),
  // Live room status: preparing (准备中), live (直播中), ended (已结束), closed (已关闭)
  status: mysqlEnum("status", ["preparing", "live", "ended", "closed"]).default("preparing").notNull(),
  // Streamer name (optional)
  streamerName: varchar("streamerName", { length: 255 }),
  // Facebook Page ID (which page is streaming)
  facebookPageId: varchar("facebookPageId", { length: 255 }),
  // Estimated start time (optional)
  estimatedStartTime: varchar("estimatedStartTime", { length: 50 }),
  // Notes
  notes: text("notes"),
  // V2.0: AI Reply enabled for this live room (auto-reply to FAQ comments)
  aiReplyEnabled: boolean("aiReplyEnabled").default(true).notNull(),
  // V2.0: Continue monitoring comments after live ends (up to 30 days)
  continueMonitor: boolean("continueMonitor").default(true).notNull(),
  // V2.0.6: Auto-recorded live start/end times
  liveStartTime: timestamp("liveStartTime"),
  liveEndTime: timestamp("liveEndTime"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LiveRoom = typeof liveRooms.$inferSelect;
export type InsertLiveRoom = typeof liveRooms.$inferInsert;

// ============================================================================
// V2.0 Phase 2: Live Room Products (直播商品)
// ============================================================================

export const liveRoomProducts = mysqlTable("live_room_products", {
  id: int("id").autoincrement().primaryKey(),
  // Linked live room
  liveRoomId: int("liveRoomId").notNull(),
  // Linked product (from products table)
  productId: int("productId").notNull(),
  // Linked variation (if product has variants)
  variationId: int("variationId"),
  // Keyword for live comment ordering (e.g. "PRR", "MP1")
  keyword: varchar("keyword", { length: 50 }).notNull(),
  // Display name (product name or variation name)
  displayName: varchar("displayName", { length: 255 }).notNull(),
  // Price for this live session
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  // Stock at live start (initial stock when product was added to live room)
  startStock: int("startStock").default(0).notNull(),
  // Reserved count (orders created but not yet fulfilled)
  reservedCount: int("reservedCount").default(0).notNull(),
  // Available stock (startStock - reservedCount, or negative if preorder)
  availableStock: int("availableStock").default(0).notNull(),
  // Ordered count (total orders captured for this product in this live)
  orderedCount: int("orderedCount").default(0).notNull(),
  // Preorder enabled (allow ordering even when stock is 0)
  allowPreorder: boolean("allowPreorder").default(false).notNull(),
  // Preorder count (how many preordered units)
  preorderCount: int("preorderCount").default(0).notNull(),
  // Status: active, paused, sold_out
  status: mysqlEnum("status", ["active", "paused", "sold_out"]).default("active").notNull(),
  // Sort order for display
  sortOrder: int("sortOrder").default(0).notNull(),
  // Image URL (cached from product)
  imageUrl: varchar("imageUrl", { length: 500 }),
  // Spec image URL (for variant products)
  specImage: varchar("specImage", { length: 500 }),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LiveRoomProduct = typeof liveRoomProducts.$inferSelect;
export type InsertLiveRoomProduct = typeof liveRoomProducts.$inferInsert;

// ============================================================================
// V2.0 Phase 2.5: Live AI Flows (直播 AI 客服)
// ============================================================================

export const liveAiFlows = mysqlTable("live_ai_flows", {
  id: int("id").autoincrement().primaryKey(),
  // Flow name (e.g. "营业地点", "运费", "付款方式")
  name: varchar("name", { length: 255 }).notNull(),
  // Trigger keywords (JSON array of strings, e.g. ["你们在哪里", "店在哪里", "营业时间"])
  triggerKeywords: text("triggerKeywords").notNull(),
  // Auto reply content (supports text, emoji, URLs, line breaks)
  replyContent: text("replyContent").notNull(),
  // Is enabled
  isEnabled: boolean("isEnabled").default(true).notNull(),
  // Sort order
  sortOrder: int("sortOrder").default(0).notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LiveAiFlow = typeof liveAiFlows.$inferSelect;
export type InsertLiveAiFlow = typeof liveAiFlows.$inferInsert;

// ============================================================================
// V2.0 Phase 3: Live Comments (直播留言记录)
// ============================================================================

export const liveComments = mysqlTable("live_comments", {
  id: int("id").autoincrement().primaryKey(),
  // Linked live room
  liveRoomId: int("liveRoomId").notNull(),
  // Facebook comment info
  commentId: varchar("commentId", { length: 255 }),
  commenterName: varchar("commenterName", { length: 255 }).notNull(),
  commenterPsid: varchar("commenterPsid", { length: 255 }),
  commenterAvatarUrl: varchar("commenterAvatarUrl", { length: 500 }),
  commentMessage: text("commentMessage").notNull(),
  // Parsed info
  parsedKeyword: varchar("parsedKeyword", { length: 100 }),
  parsedQuantity: int("parsedQuantity").default(0),
  // Match result: matched, no_match, paused, sold_out, preorder, duplicate, ignored, ai_replied
  matchResult: mysqlEnum("matchResult", ["matched", "no_match", "paused", "sold_out", "preorder", "duplicate", "ignored", "ai_replied"]).default("no_match").notNull(),
  // Matched product info
  matchedProductId: int("matchedProductId"),
  matchedProductName: varchar("matchedProductName", { length: 255 }),
  matchedLiveRoomProductId: int("matchedLiveRoomProductId"),
  // Order info
  orderId: int("orderId"),
  orderNumber: varchar("orderNumber", { length: 50 }),
  // Messenger send status: pending, sent, failed, not_needed, manually_handled
  messengerStatus: mysqlEnum("messengerStatus", ["pending", "sent", "failed", "not_needed", "manually_handled"]).default("not_needed"),
  messengerError: text("messengerError"),
  // AI Flow match (if matched by AI Flow)
  aiFlowId: int("aiFlowId"),
  aiReplyContent: text("aiReplyContent"),
  // Whether admin has manually handled this comment
  isHandled: boolean("isHandled").default(false).notNull(),
  // Timestamps
  commentDate: timestamp("commentDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // Prevents duplicate entries when Facebook retries webhook delivery
  commentIdUnique: uniqueIndex("uq_live_comment_id").on(table.commentId),
}));

export type LiveComment = typeof liveComments.$inferSelect;
export type InsertLiveComment = typeof liveComments.$inferInsert;

// ============================================================================
// V2.0: Live Comment Notes (Staff Note 工作人员备注)
// ============================================================================

export const liveCommentNotes = mysqlTable("live_comment_notes", {
  id: int("id").autoincrement().primaryKey(),
  // Linked live comment
  liveCommentId: int("liveCommentId").notNull(),
  // Linked live room (for quick filtering)
  liveRoomId: int("liveRoomId").notNull(),
  // Optional: linked order (if note relates to an order)
  orderId: int("orderId"),
  // Optional: linked customer (if note relates to a customer)
  customerId: int("customerId"),
  // Note content
  content: text("content").notNull(),
  // Who created this note
  createdBy: varchar("createdBy", { length: 255 }),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type LiveCommentNote = typeof liveCommentNotes.$inferSelect;
export type InsertLiveCommentNote = typeof liveCommentNotes.$inferInsert;

// ============================================================================
// V2.0: Import Batches (采购批次)
// ============================================================================

export const importBatches = mysqlTable("import_batches", {
  id: int("id").autoincrement().primaryKey(),
  // CN is the procurement document; IB is its linked arrival-inspection document.
  // Existing historical rows are treated as CN documents by the database default.
  documentType: mysqlEnum("documentType", ["cn", "ib"]).default("cn").notNull(),
  // For an IB, the parent CN. For a CN, autoIbId points at its first auto-created IB.
  cnId: int("cnId"),
  // CN number (e.g. CN00001)
  batchNumber: varchar("batchNumber", { length: 50 }).notNull().unique(),
  // Batch name
  batchName: varchar("batchName", { length: 255 }).notNull(),
  // Source country
  sourceCountry: varchar("sourceCountry", { length: 100 }).default("中国").notNull(),
  // Supplier name
  supplierName: varchar("supplierName", { length: 255 }),
  // Supplier order number (for tracking with supplier)
  supplierOrderNumber: varchar("supplierOrderNumber", { length: 100 }),
  // China tracking number (for shipping tracking)
  chinaTrackingNumber: varchar("chinaTrackingNumber", { length: 255 }),
  // Linked live room
  liveRoomId: int("liveRoomId"),
  // Preorder window
  preorderStartDate: timestamp("preorderStartDate"),
  preorderEndDate: timestamp("preorderEndDate"),
  // CN date selection window and the associated order-payment deadline.
  startDate: date("startDate"),
  endDate: date("endDate"),
  paymentDeadline: date("paymentDeadline"),
  autoIbId: int("autoIbId"),
  // Actual purchase date
  actualPurchaseDate: timestamp("actualPurchaseDate"),
  // Shipping method: air or sea
  shippingMethod: mysqlEnum("shippingMethod", ["air", "sea"]),
  // China shipping cost (total, in RM)
  chinaShippingCost: decimal("chinaShippingCost", { precision: 12, scale: 2 }).default("0"),
  // Other purchase fees (packaging, handling, etc.)
  otherFees: decimal("otherFees", { precision: 12, scale: 2 }).default("0"),
  // Total estimated cost (purchase + shipping + other fees)
  totalEstimatedCost: decimal("totalEstimatedCost", { precision: 12, scale: 2 }).default("0"),
  // Total actual cost (after IB verification)
  totalActualCost: decimal("totalActualCost", { precision: 12, scale: 2 }).default("0"),
  // Batch status
  status: mysqlEnum("status", [
    "draft",          // 草稿（建立中）
    "in_progress",    // 进行中（已确认采购）
    "closed",         // 已截止
    "purchased",      // 已采购（CN确认）
    "preparing",      // 备货中（供应商备货）
    "in_transit",     // 运输中
    "partial_arrived", // 部分到货（IB部分验货）
    "all_arrived",    // 全部到货（IB验货完成）
    "completed",      // 完成
  ]).default("draft").notNull(),
  // IB generated flag (auto-generated when CN confirmed)
  ibGenerated: boolean("ibGenerated").default(false).notNull(),
  // V2.0.98: Cost locked (after IB completion/入库, cost is locked)
  costLocked: boolean("costLocked").default(false).notNull(),
  // V2.0.98: Cost locked at timestamp
  costLockedAt: timestamp("costLockedAt"),
  // IB business lock. An arrival-completed IB cannot be edited until explicitly unlocked.
  isLocked: boolean("isLocked").default(false).notNull(),
  lockedAt: timestamp("lockedAt"),
  lockedBy: int("lockedBy"),
  unlockReason: text("unlockReason"),
  // V2.0.98: Parent batch ID (for multi-CN追加进货, links additional CN to original batch)
  parentBatchId: int("parentBatchId"),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ImportBatch = typeof importBatches.$inferSelect;
export type InsertImportBatch = typeof importBatches.$inferInsert;

// ============================================================================
// CN change audit (all editable CN fields retain before/after values)
// ============================================================================
export const cnChangeLogs = mysqlTable("cn_change_logs", {
  id: int("id").autoincrement().primaryKey(),
  cnId: int("cnId").notNull(),
  field: varchar("field", { length: 100 }).notNull(),
  oldValue: text("oldValue"),
  newValue: text("newValue"),
  changedBy: int("changedBy"),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
});

export type CnChangeLog = typeof cnChangeLogs.$inferSelect;

// ============================================================================
// CN payment-expiry execution log (one durable row per scheduled/manual sweep)
// ============================================================================
export const cnExpiryRunLogs = mysqlTable("cn_expiry_run_logs", {
  id: int("id").autoincrement().primaryKey(),
  inspectedCount: int("inspectedCount").default(0).notNull(),
  cancelledCount: int("cancelledCount").default(0).notNull(),
  failedCount: int("failedCount").default(0).notNull(),
  cancelledOrderNumbers: json("cancelledOrderNumbers").$type<string[] | null>(),
  runAt: timestamp("runAt").defaultNow().notNull(),
}, (table) => ({
  runAtIdx: index("cn_expiry_run_logs_run_at_idx").on(table.runAt),
}));

export type CnExpiryRunLog = typeof cnExpiryRunLogs.$inferSelect;

// ============================================================================
// IB change audit (all editable IB header/item fields retain before/after values)
// ============================================================================
export const importBatchChangeLogs = mysqlTable("import_batch_change_logs", {
  id: int("id").autoincrement().primaryKey(),
  ibId: int("ibId").notNull(),
  field: varchar("field", { length: 160 }).notNull(),
  oldValue: text("oldValue"),
  newValue: text("newValue"),
  changedBy: int("changedBy"),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
}, (table) => ({
  ibChangedAtIdx: index("import_batch_change_logs_ibId_changedAt_idx").on(table.ibId, table.changedAt),
}));

export type ImportBatchChangeLog = typeof importBatchChangeLogs.$inferSelect;

// ============================================================================
// V2.0: Import Batch Items (采购批次商品明细 - 采购汇总与到货验收)
// ============================================================================

export const importBatchItems = mysqlTable("import_batch_items", {
  id: int("id").autoincrement().primaryKey(),
  // Batch ID (CN/IB shared)
  batchId: int("batchId").notNull(),
  // Product ID
  productId: int("productId").notNull(),
  // Product name (snapshot)
  productName: varchar("productName", { length: 255 }).notNull(),
  // Variant ID (if applicable)
  variantId: int("variantId"),
  variantName: varchar("variantName", { length: 255 }),
  // Customer demand quantity (auto-calculated from paid XTC orders)
  paidQuantity: int("paidQuantity").default(0).notNull(),
  // Final purchase quantity (admin can adjust, e.g. paid 100 + spare 5 = 105)
  finalPurchaseQuantity: int("finalPurchaseQuantity").default(0).notNull(),
  // Arrival verification (IB fields)
  actualReceivedQty: int("actualReceivedQty"),
  healthyQty: int("healthyQty"),
  damagedQty: int("damagedQty").default(0),
  deadQty: int("deadQty").default(0),
  missingQty: int("missingQty").default(0),
  wrongItemQty: int("wrongItemQty").default(0),
  // Difference reason (for supplier tracking)
  differenceReason: mysqlEnum("differenceReason", [
    "none",              // 无差异
    "supplier_short",    // 供应商少货
    "over_supply",      // 多货
    "damaged",          // 损坏
    "dead",            // 死亡
    "wrong_item",      // 错货
    "not_arrived",     // 未到货
    "other",           // 其他
  ]).default("none"),
  differenceNotes: text("differenceNotes"),
  // Item status
  itemStatus: mysqlEnum("itemStatus", [
    "pending",         // 待到货
    "all_arrived",     // 全部到货
    "partial_arrived", // 部分到货
    "shortage",        // 数量不足
    "damaged",         // 损坏
    "dead",            // 死亡
    "missing",         // 遗漏
    "wrong_item",      // 错货
  ]).default("pending"),
  // Unit purchase cost (from supplier)
  unitPurchaseCost: decimal("unitPurchaseCost", { precision: 10, scale: 2 }),
  // Allocated China shipping cost per unit (auto-calculated)
  allocatedShippingCost: decimal("allocatedShippingCost", { precision: 10, scale: 2 }),
  // Allocated other fees per unit (auto-calculated)
  allocatedOtherFees: decimal("allocatedOtherFees", { precision: 10, scale: 2 }),
  // Total actual cost (unit + shipping + other fees)
  totalUnitCost: decimal("totalUnitCost", { precision: 10, scale: 2 }),
  // Spot sale enabled after arrival
  spotSaleEnabled: boolean("spotSaleEnabled").default(false).notNull(),
  // Spot sale quantity (remaining stock after fulfilling preorders)
  spotSaleQty: int("spotSaleQty").default(0).notNull(),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ImportBatchItem = typeof importBatchItems.$inferSelect;
export type InsertImportBatchItem = typeof importBatchItems.$inferInsert;

// ============================================================================
// V2.0.98: IB Differences (IB差异记录)
// ============================================================================

export const ibDifferences = mysqlTable("ib_differences", {
  id: int("id").autoincrement().primaryKey(),
  // IB batch ID
  batchId: int("batchId").notNull(),
  // CN batch number (for reference)
  cnBatchNumber: varchar("cnBatchNumber", { length: 50 }),
  // Supplier name
  supplierName: varchar("supplierName", { length: 255 }),
  // Product ID and snapshot
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  variantId: int("variantId"),
  variantName: varchar("variantName", { length: 255 }),
  // CN purchase quantity
  cnPurchaseQty: int("cnPurchaseQty").default(0).notNull(),
  // IB actual received quantity
  ibReceivedQty: int("ibReceivedQty").default(0).notNull(),
  // Difference quantity (cnPurchaseQty - ibReceivedQty, negative = over-supply)
  differenceQty: int("differenceQty").default(0).notNull(),
  // Difference type
  differenceType: mysqlEnum("differenceType", [
    "shortage",       // 少货
    "over_supply",    // 多货
    "damaged",        // 损坏
    "dead",           // 死亡
    "wrong_item",     // 错货
    "not_arrived",     // 未到货
    "other",          // 其他
  ]).default("shortage").notNull(),
  // Reason
  reason: text("reason"),
  // Photo/evidence URL
  evidenceUrl: varchar("evidenceUrl", { length: 500 }),
  // Needs supplier replenishment
  needsReplenish: boolean("needsReplenish").default(false).notNull(),
  // Needs refund
  needsRefund: boolean("needsRefund").default(false).notNull(),
  // Processing status
  processStatus: mysqlEnum("processStatus", [
    "pending",        // 待处理
    "in_progress",    // 处理中
    "resolved",       // 已解决
    "no_action",      // 无需处理
  ]).default("pending").notNull(),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IbDifference = typeof ibDifferences.$inferSelect;
export type InsertIbDifference = typeof ibDifferences.$inferInsert;

// ============================================================================
// V2.0.98: Stock Allocations (库存分配记录)
// ============================================================================

export const stockAllocations = mysqlTable("stock_allocations", {
  id: int("id").autoincrement().primaryKey(),
  // Batch ID (IB that triggered allocation)
  batchId: int("batchId").notNull(),
  // Order ID (XTC order receiving allocation)
  orderId: int("orderId").notNull(),
  // Order number (snapshot)
  orderNumber: varchar("orderNumber", { length: 50 }).notNull(),
  // Product ID and variant
  productId: int("productId").notNull(),
  variantId: int("variantId"),
  // Allocated quantity
  allocatedQty: int("allocatedQty").default(0).notNull(),
  // Allocation type: auto or manual
  allocationType: mysqlEnum("allocationType", ["auto", "manual"]).default("auto").notNull(),
  // For manual adjustments: original allocation info
  originalOrderId: int("originalOrderId"),
  originalOrderNumber: varchar("originalOrderNumber", { length: 50 }),
  // Adjustment reason (for manual adjustments)
  adjustmentReason: text("adjustmentReason"),
  // Operator
  operatorName: varchar("operatorName", { length: 255 }),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StockAllocation = typeof stockAllocations.$inferSelect;
export type InsertStockAllocation = typeof stockAllocations.$inferInsert;

// ============================================================================
// V2.0.98: Cost Adjustment Log (成本调整记录)
// ============================================================================

export const costAdjustmentLogs = mysqlTable("cost_adjustment_logs", {
  id: int("id").autoincrement().primaryKey(),
  // Batch ID
  batchId: int("batchId").notNull(),
  // Field changed
  fieldName: varchar("fieldName", { length: 100 }).notNull(),
  // Item ID (if specific item)
  itemId: int("itemId"),
  // Old value
  oldValue: varchar("oldValue", { length: 255 }),
  // New value
  newValue: varchar("newValue", { length: 255 }),
  // Reason
  reason: text("reason").notNull(),
  // Operator
  operatorName: varchar("operatorName", { length: 255 }),
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CostAdjustmentLog = typeof costAdjustmentLogs.$inferSelect;
export type InsertCostAdjustmentLog = typeof costAdjustmentLogs.$inferInsert;

// ============================================================================
// V3.1: Product Bundles (组合包管理)
// ============================================================================

export const productBundles = mysqlTable("product_bundles", {
  id: int("id").autoincrement().primaryKey(),
  // Display name (e.g. "J5 营养组合")
  name: varchar("name", { length: 200 }).notNull(),
  // English name (optional)
  nameEn: varchar("nameEn", { length: 200 }),
  // Keyword for live/post ordering (e.g. "J5C")
  keyword: varchar("keyword", { length: 50 }).notNull().unique(),
  // Bundle selling price
  sellingPrice: decimal("sellingPrice", { precision: 10, scale: 2 }).notNull(),
  // Original total price (sum of single items)
  originalTotalPrice: decimal("originalTotalPrice", { precision: 10, scale: 2 }).default("0").notNull(),
  // Special price display (if bundle is on special)
  specialPrice: decimal("specialPrice", { precision: 10, scale: 2 }),
  // Cover image URL
  coverImage: varchar("coverImage", { length: 500 }),
  // Mall description
  description: text("description"),
  // Status: active or inactive
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  // Show in mall
  showInMall: boolean("showInMall").default(true).notNull(),
  // Bundle weight (for shipping calculation)
  weight: decimal("weight", { precision: 8, scale: 2 }).default("0").notNull(),
  // Internal notes
  internalNotes: text("internalNotes"),
  // Current bundle stock (how many bundles can be sold)
  bundleStock: int("bundleStock").default(0).notNull(),
  // Total cost of items in bundle (auto-calculated from item costs)
  totalCost: decimal("totalCost", { precision: 10, scale: 2 }).default("0").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductBundle = typeof productBundles.$inferSelect;
export type InsertProductBundle = typeof productBundles.$inferInsert;

export const productBundleItems = mysqlTable("product_bundle_items", {
  id: int("id").autoincrement().primaryKey(),
  // Bundle ID
  bundleId: int("bundleId").notNull(),
  // Product ID (single item)
  productId: int("productId").notNull(),
  // Variant ID (optional, if product has variants)
  variantId: int("variantId"),
  // Product name (snapshot for display)
  productName: varchar("productName", { length: 200 }).notNull(),
  // Variant name (snapshot, optional)
  variantName: varchar("variantName", { length: 100 }),
  // Quantity per bundle (e.g. 2 means 2 packs per bundle)
  qtyPerBundle: int("qtyPerBundle").default(1).notNull(),
  // Unit cost (snapshot from product/variant at time of bundle creation)
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }).default("0").notNull(),
  // Unit selling price (snapshot from product/variant)
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductBundleItem = typeof productBundleItems.$inferSelect;
export type InsertProductBundleItem = typeof productBundleItems.$inferInsert;

// Bundle stock log (组合包库存日志)
export const bundleStockLogs = mysqlTable("bundle_stock_logs", {
  id: int("id").autoincrement().primaryKey(),
  // Bundle ID
  bundleId: int("bundleId").notNull(),
  // Action type
  actionType: mysqlEnum("actionType", [
    "create",       // 建立组合库存
    "restock",      // 补充组合
    "disassemble",  // 拆除组合
    "sell",         // 销售扣减
    "adjust",       // 手动调整
  ]).notNull(),
  // Quantity change (positive = add, negative = remove)
  qtyChange: int("qtyChange").notNull(),
  // Stock before action
  stockBefore: int("stockBefore").notNull(),
  // Stock after action
  stockAfter: int("stockAfter").notNull(),
  // Affected product IDs (comma-separated for single item stock logs)
  affectedProducts: text("affectedProducts"),
  // Reason (for disassemble: 改为单品出售/修改组合内容/组合活动结束/商品替换/商品损坏/其他)
  reason: varchar("reason", { length: 100 }),
  // Operator
  operator: varchar("operator", { length: 100 }),
  // Notes
  notes: text("notes"),
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BundleStockLog = typeof bundleStockLogs.$inferSelect;
export type InsertBundleStockLog = typeof bundleStockLogs.$inferInsert;

// ============================================================================
// Order Payments (订单付款记录 - 支持多次汇款)
// ============================================================================

export const orderPayments = mysqlTable("order_payments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  // Payment amount for this record
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  // Payment date (when customer made the transfer)
  paymentDate: timestamp("paymentDate"),
  // Payment method used
  paymentMethod: varchar("paymentMethod", { length: 100 }),
  // Receipt proof URL (uploaded image/file)
  receiptUrl: varchar("receiptUrl", { length: 500 }),
  // Purpose / notes about this payment
  purpose: varchar("purpose", { length: 255 }),
  // Who recorded this payment (operator)
  operatorId: int("operatorId"),
  operatorName: varchar("operatorName", { length: 255 }),
  // Notes
  notes: text("notes"),
  // V2.1.11: Payment source and review status
  paymentSource: varchar("paymentSource", { length: 50 }).notNull().default("admin_manual"),
  reviewStatus: varchar("reviewStatus", { length: 20 }).notNull().default("approved"),
  reviewedBy: varchar("reviewedBy", { length: 255 }),
  reviewedAt: bigint("reviewedAt", { mode: "number" }),
  rejectReason: text("rejectReason"),
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderPayment = typeof orderPayments.$inferSelect;
export type InsertOrderPayment = typeof orderPayments.$inferInsert;

// ============================================================================
// Order Refunds (订单退款记录)
// ============================================================================

export const orderRefunds = mysqlTable("order_refunds", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  // 独立退款编号；旧记录允许为空，新的退款管理记录必须生成编号。
  refundNumber: varchar("refundNumber", { length: 50 }).unique(),
  // 未处理不影响库存及正式利润；待退货确认表示款项已完成但实物处理未完成。
  status: mysqlEnum("status", ["pending", "processed", "awaiting_return", "rejected", "cancelled"]).default("processed").notNull(),
  requestedAmount: decimal("requestedAmount", { precision: 10, scale: 2 }).default("0").notNull(),
  // amount 保留为实际已完成退款金额，兼容既有退款流水与财务报表。
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  refundMethod: varchar("refundMethod", { length: 100 }).notNull(),
  refundDate: timestamp("refundDate"),
  receiptUrl: varchar("receiptUrl", { length: 500 }),
  refundReason: varchar("refundReason", { length: 255 }),
  issueDescription: text("issueDescription"),
  customerRefundDetails: text("customerRefundDetails"), // JSON: QR / TNG / bank recipient data
  attachmentUrls: text("attachmentUrls"), // JSON: customer issue photos / chat screenshots
  internalNotes: text("internalNotes"),
  notes: text("notes"),
  operatorName: varchar("operatorName", { length: 255 }),
  requestedBy: varchar("requestedBy", { length: 255 }),
  processedBy: varchar("processedBy", { length: 255 }),
  processedAt: timestamp("processedAt"),
  rejectedBy: varchar("rejectedBy", { length: 255 }),
  rejectedAt: timestamp("rejectedAt"),
  cancelledBy: varchar("cancelledBy", { length: 255 }),
  cancelledAt: timestamp("cancelledAt"),
  creditLedgerId: int("creditLedgerId"),
  inventoryFinalizedAt: timestamp("inventoryFinalizedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderRefund = typeof orderRefunds.$inferSelect;
export type InsertOrderRefund = typeof orderRefunds.$inferInsert;

// ============================================================================
// Refund Items (退款商品逐项明细与库存处理审计)
// ============================================================================

export const orderRefundItems = mysqlTable("order_refund_items", {
  id: int("id").autoincrement().primaryKey(),
  refundId: int("refundId").notNull(),
  orderItemId: int("orderItemId"),
  productId: int("productId"),
  productName: varchar("productName", { length: 255 }).notNull(),
  productSku: varchar("productSku", { length: 100 }),
  refundQuantity: int("refundQuantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0").notNull(),
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }).default("0").notNull(),
  refundAmount: decimal("refundAmount", { precision: 10, scale: 2 }).default("0").notNull(),
  inventoryTreatment: mysqlEnum("inventoryTreatment", ["return_to_sale", "write_off", "none", "pending_return"]).default("none").notNull(),
  inventoryActionStatus: mysqlEnum("inventoryActionStatus", ["not_required", "pending", "returned", "written_off", "reversed"]).default("not_required").notNull(),
  inventoryAdjustmentId: int("inventoryAdjustmentId"),
  inventoryHandledBy: varchar("inventoryHandledBy", { length: 255 }),
  inventoryHandledAt: timestamp("inventoryHandledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrderRefundItem = typeof orderRefundItems.$inferSelect;
export type InsertOrderRefundItem = typeof orderRefundItems.$inferInsert;

// ============================================================================
// Order Operation Logs (订单操作日志 - 完整操作记录)
// ============================================================================

export const orderOperationLogs = mysqlTable("order_operation_logs", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  // Operation type: create, update, payment, ship, notify, complete, cancel, status_change, item_add, item_remove, item_edit
  operationType: varchar("operationType", { length: 50 }).notNull(),
  // Operation description
  description: text("description"),
  // JSON snapshot of changed fields { field: { old, new } }
  changes: text("changes"),
  // Who performed the operation
  operator: varchar("operator", { length: 255 }),
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderOperationLog = typeof orderOperationLogs.$inferSelect;
export type InsertOrderOperationLog = typeof orderOperationLogs.$inferInsert;

// ============================================================================
// V4.0: AI Customer Service — Chat & Handover
// ============================================================================

// Chat Conversations — one per customer per platform
export const chatConversations = mysqlTable("chat_conversations", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId"),
  // Platform: messenger, whatsapp
  platform: mysqlEnum("platform", ["messenger", "whatsapp"]).notNull(),
  // Platform-specific ID (PSID for Messenger, phone number for WhatsApp)
  platformId: varchar("platformId", { length: 255 }),
  // Last message preview
  lastMessagePreview: text("lastMessagePreview"),
  lastMessageAt: timestamp("lastMessageAt"),
  // Unread count (messages from customer not yet seen by staff)
  unreadCount: int("unreadCount").default(0).notNull(),
  // AI auto-reply enabled for this customer
  aiReplyEnabled: boolean("aiReplyEnabled").default(true).notNull(),
  // Who toggled AI and when
  aiToggledBy: varchar("aiToggledBy", { length: 255 }),
  aiToggledAt: timestamp("aiToggledAt"),
  // Handover status: none, pending, claimed
  handoverStatus: mysqlEnum("handoverStatus", ["none", "pending", "claimed"]).default("none").notNull(),
  handoverClaimedBy: varchar("handoverClaimedBy", { length: 255 }),
  handoverClaimedAt: timestamp("handoverClaimedAt"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = typeof chatConversations.$inferInsert;

// Chat Messages — individual messages in a conversation
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  // Sender type: customer, ai, staff, system
  senderType: mysqlEnum("senderType", ["customer", "ai", "staff", "system"]).notNull(),
  // Sender name (staff name or "AI")
  senderName: varchar("senderName", { length: 255 }),
  // Message type: text, image, audio, video, file, flow, order_action, handover
  messageType: mysqlEnum("messageType", ["text", "image", "audio", "video", "file", "flow", "order_action", "handover"]).default("text").notNull(),
  // Message content (text or caption)
  content: text("content"),
  // Media URL (for image/audio/video/file)
  mediaUrl: text("mediaUrl"),
  // Platform message ID (for dedup and status tracking)
  platformMessageId: varchar("platformMessageId", { length: 255 }),
  // Delivery status: sent, delivered, read, failed
  status: mysqlEnum("status", ["sent", "delivered", "read", "failed"]).default("sent").notNull(),
  // Error message if failed
  errorMessage: text("errorMessage"),
  // Source engine for AI messages: product, reply_rule, knowledge or flow
  aiResponseSource: varchar("aiResponseSource", { length: 32 }),
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// AI Handover Requests — when AI determines a customer needs human assistance
export const aiHandoverRequests = mysqlTable("ai_handover_requests", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId"),
  customerId: int("customerId"),
  // Platform
  platform: mysqlEnum("platform", ["messenger", "whatsapp"]).notNull(),
  // Platform ID (PSID or phone)
  platformId: varchar("platformId", { length: 255 }),
  // Customer name (snapshot)
  customerName: varchar("customerName", { length: 255 }),
  // Reason for handover
  reason: text("reason").notNull(),
  // AI-generated summary
  aiSummary: text("aiSummary"),
  // Priority: low, medium, high
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  // Status: pending, claimed
  status: mysqlEnum("status", ["pending", "claimed"]).default("pending").notNull(),
  claimedBy: varchar("claimedBy", { length: 255 }),
  claimedAt: timestamp("claimedAt"),
  // Last message time (for calculating wait time)
  lastMessageAt: timestamp("lastMessageAt"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiHandoverRequest = typeof aiHandoverRequests.$inferSelect;
export type InsertAiHandoverRequest = typeof aiHandoverRequests.$inferInsert;

// ============================================================================
// AI Engine — Independent modules for customer service AI
// ============================================================================

// Reply Rules — Fixed reply rules (replaces hardcoded keyword replies)
// Admin can maintain via backend UI. Used by Reply Rule Engine.
export const replyRules = mysqlTable("reply_rules", {
  id: int("id").autoincrement().primaryKey(),
  // Rule name (for admin identification)
  name: varchar("name", { length: 255 }).notNull(),
  // Trigger keywords (JSON array of strings, case-insensitive match)
  triggerKeywords: text("triggerKeywords").notNull(),
  // Reply content (text sent to customer)
  replyContent: text("replyContent").notNull(),
  // Whether to also send a button/template after the text
  actionType: mysqlEnum("actionType", ["text_only", "button", "template"]).default("text_only").notNull(),
  actionData: text("actionData"), // JSON: button config or template config
  // Priority (lower = higher priority, checked first)
  priority: int("priority").default(100).notNull(),
  // Channel scope: which platforms this rule applies to
  channels: text("channels").notNull().default('["messenger","whatsapp"]'), // JSON array
  // Enabled toggle
  isEnabled: boolean("isEnabled").default(true).notNull(),
  // Real usage metrics, incremented by the Reply Rule Engine after a match
  usageCount: int("usageCount").default(0).notNull(),
  lastMatchedAt: timestamp("lastMatchedAt"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ReplyRule = typeof replyRules.$inferSelect;
export type InsertReplyRule = typeof replyRules.$inferInsert;

// AI Knowledge Base — Independent knowledge entries for AI matching
// Separate from live_ai_flows (which are for FB Live/Post/Reel only)
// Used by Knowledge Engine for Messenger/WhatsApp private chat
export const aiKnowledge = mysqlTable("ai_knowledge", {
  id: int("id").autoincrement().primaryKey(),
  // Category for grouping (e.g., "shipping", "membership", "product", "faq")
  category: varchar("category", { length: 100 }).notNull(),
  // Topic/title for admin identification
  topic: varchar("topic", { length: 255 }).notNull(),
  // Trigger keywords (JSON array, case-insensitive)
  triggerKeywords: text("triggerKeywords").notNull(),
  // Knowledge content (the reply text sent to customer)
  content: text("content").notNull(),
  // Priority (lower = checked first)
  priority: int("priority").default(100).notNull(),
  // Whether this knowledge requires AI LLM processing (true) or is a direct reply (false)
  useLLM: boolean("useLLM").default(false).notNull(),
  // Enabled toggle
  isEnabled: boolean("isEnabled").default(true).notNull(),
  // Real usage metrics, incremented by the Knowledge Engine after a match
  usageCount: int("usageCount").default(0).notNull(),
  lastMatchedAt: timestamp("lastMatchedAt"),
  // Draft/published status — draft entries are excluded from engine matching
  status: mysqlEnum("status", ["draft", "published"]).default("published").notNull(),
  // Source tracking: if this knowledge was created from an AI test run
  sourceAiTestRunId: int("sourceAiTestRunId"),
  sourceNote: text("sourceNote"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiKnowledge = typeof aiKnowledge.$inferSelect;
export type InsertAiKnowledge = typeof aiKnowledge.$inferInsert;

// ============================================================================
// AI Persona — AI personality/branding settings for AI Brain
// ============================================================================
export const aiPersona = mysqlTable("ai_persona", {
  id: int("id").autoincrement().primaryKey(),
  // AI display name
  aiName: varchar("aiName", { length: 100 }).default("小田").notNull(),
  // Brand name
  brandName: varchar("brandName", { length: 200 }).default("心田 Xintian").notNull(),
  // How AI refers to itself
  aiSelfReference: varchar("aiSelfReference", { length: 50 }).default("小田").notNull(),
  // How AI addresses the customer
  customerAddress: varchar("customerAddress", { length: 50 }).default("亲爱的").notNull(),
  // Reply tone: friendly, professional, casual, warm
  replyTone: varchar("replyTone", { length: 50 }).default("warm").notNull(),
  // Default language
  defaultLanguage: varchar("defaultLanguage", { length: 20 }).default("zh").notNull(),
  // Supported languages (JSON array)
  supportedLanguages: text("supportedLanguages").default('["zh","en","ms"]').notNull(),
  // Emoji usage level: none, low, medium, high
  emojiLevel: varchar("emojiLevel", { length: 20 }).default("low").notNull(),
  // Reply length: short, medium, long
  replyLength: varchar("replyLength", { length: 20 }).default("medium").notNull(),
  // Whether to proactively recommend products
  proactiveRecommend: boolean("proactiveRecommend").default(true).notNull(),
  // Whether to proactively ask about customer needs
  proactiveInquire: boolean("proactiveInquire").default(true).notNull(),
  // Whether to add CTA at end of replies
  enableCTA: boolean("enableCTA").default(true).notNull(),
  // CTA text template
  ctaTemplate: text("ctaTemplate").default("还有什么小田可以帮到你的吗？😊"),
  // Custom system prompt additions (optional, for advanced users)
  customPrompt: text("customPrompt"),
  // Brand and service principles that guide AI reply consistency
  replyPrinciples: text("replyPrinciples"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiPersona = typeof aiPersona.$inferSelect;
export type InsertAiPersona = typeof aiPersona.$inferInsert;

/**
 * AI Log Center - records every AI processing event for audit and analytics.
 */
export const aiLogs = mysqlTable("ai_logs", {
  id: int("id").autoincrement().primaryKey(),
  // Association (conversationId is nullable for future Flow events that may not have a chat conversation)
  conversationId: int("conversationId"),
  customerId: int("customerId"),
  customerName: varchar("customerName", { length: 255 }),
  platform: mysqlEnum("platform", ["messenger", "whatsapp", "other"]).notNull(),
  // Source type for future Flow event support (Phase 2 only uses private_chat)
  sourceType: mysqlEnum("sourceType", ["private_chat", "facebook_live", "facebook_post", "facebook_reel"]).default("private_chat").notNull(),
  sourceEventId: varchar("sourceEventId", { length: 255 }),
  sourceBindingId: int("sourceBindingId"),
  // Message ID precise association to chat_messages.id
  customerMessageId: int("customerMessageId"),
  aiReplyMessageId: int("aiReplyMessageId"),
  // Customer original message (truncated to 200 chars)
  customerMessage: text("customerMessage"),
  receivedAt: timestamp("receivedAt").notNull(),
  // AI status at time of message
  aiEnabled: boolean("aiEnabled").notNull(),
  handoverStatus: mysqlEnum("handoverStatus", ["none", "pending", "claimed"]).notNull(),
  // Complete processing trail (JSON array of steps, no hard step limit)
  processingSteps: json("processingSteps"),
  // Final matched source
  finalSource: mysqlEnum("finalSource", [
    "order_keyword", "product", "reply_rule", "knowledge", "llm",
    "flow", "human_handover", "no_match", "error", "ai_disabled", "human_claimed",
  ]).notNull(),
  matchedRuleId: int("matchedRuleId"),
  matchedKnowledgeId: int("matchedKnowledgeId"),
  matchedProductId: int("matchedProductId"),
  matchedFlowId: int("matchedFlowId"),
  // AI reply content
  aiReply: text("aiReply"),
  // Send status
  sendStatus: mysqlEnum("sendStatus", ["sent", "failed", "not_sent", "pending"]).default("not_sent").notNull(),
  platformMessageId: varchar("platformMessageId", { length: 255 }),
  // Retry tracking (main log level)
  retryCount: int("retryCount").default(0).notNull(),
  lastRetryAt: timestamp("lastRetryAt"),
  // Structured error
  errorCode: varchar("errorCode", { length: 50 }),
  errorStage: varchar("errorStage", { length: 50 }),
  errorMessage: text("errorMessage"),
  // Handover
  isHandover: boolean("isHandover").default(false).notNull(),
  handoverReason: text("handoverReason"),
  // Performance
  processingTimeMs: int("processingTimeMs"),
  // Business AI — intent classification and handover summary
  detectedIntent: varchar("detectedIntent", { length: 100 }),
  handoverSummary: text("handoverSummary"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiLog = typeof aiLogs.$inferSelect;
export type InsertAiLog = typeof aiLogs.$inferInsert;

/**
 * AI Log Delivery Attempts - records each send attempt (including retries).
 * aiLogId has ON DELETE CASCADE via migration SQL.
 */
export const aiLogDeliveryAttempts = mysqlTable("ai_log_delivery_attempts", {
  id: int("id").autoincrement().primaryKey(),
  aiLogId: int("aiLogId").notNull(),
  attemptNumber: int("attemptNumber").notNull(),
  sendStatus: mysqlEnum("sendStatus", ["sent", "failed", "pending"]).notNull(),
  platformMessageId: varchar("platformMessageId", { length: 255 }),
  errorCode: varchar("errorCode", { length: 50 }),
  errorMessage: text("errorMessage"),
  attemptedAt: timestamp("attemptedAt").defaultNow().notNull(),
});

export type AiLogDeliveryAttempt = typeof aiLogDeliveryAttempts.$inferSelect;
export type InsertAiLogDeliveryAttempt = typeof aiLogDeliveryAttempts.$inferInsert;

/**
 * AI Test Runs — Admin test execution records, completely isolated from ai_logs.
 * Test runs never send messages, create conversations, or affect production stats.
 */
export const aiTestRuns = mysqlTable("ai_test_runs", {
  id: int("id").autoincrement().primaryKey(),
  // Test configuration
  platform: mysqlEnum("platform", ["messenger", "whatsapp"]).notNull(),
  language: varchar("language", { length: 20 }).default("auto").notNull(),
  aiEnabled: boolean("aiEnabled").default(true).notNull(),
  handoverStatus: mysqlEnum("handoverStatus", ["none", "pending", "claimed"]).default("none").notNull(),
  enableLLM: boolean("enableLLM").default(true).notNull(),
  // Simulated customer scenario (reserved — not yet wired to engines)
  simulatedCustomerName: varchar("simulatedCustomerName", { length: 255 }),
  isMember: boolean("isMember").default(false).notNull(),
  hasOrder: boolean("hasOrder").default(false).notNull(),
  // Test input
  testMessage: text("testMessage").notNull(),
  // Processing results
  processingSteps: json("processingSteps"),
  finalSource: mysqlEnum("finalSource", [
    "order_keyword", "product", "reply_rule", "knowledge", "llm",
    "no_match", "error", "ai_disabled", "human_claimed",
  ]).notNull(),
  matchedRuleId: int("matchedRuleId"),
  matchedKnowledgeId: int("matchedKnowledgeId"),
  matchedProductId: int("matchedProductId"),
  aiReply: text("aiReply"),
  shouldHandover: boolean("shouldHandover").default(false).notNull(),
  handoverReason: text("handoverReason"),
  processingTimeMs: int("processingTimeMs"),
  errorCode: varchar("errorCode", { length: 50 }),
  errorStage: varchar("errorStage", { length: 50 }),
  errorMessage: text("errorMessage"),
  // LLM tracking
  llmCalled: boolean("llmCalled").default(false).notNull(),
  llmModel: varchar("llmModel", { length: 100 }),
  llmProcessingTimeMs: int("llmProcessingTimeMs"),
  llmSuccess: boolean("llmSuccess"),
  llmErrorStage: varchar("llmErrorStage", { length: 50 }),
  llmErrorCode: varchar("llmErrorCode", { length: 50 }),
  llmTimedOut: boolean("llmTimedOut").default(false).notNull(),
  llmInputTokens: int("llmInputTokens"),
  llmOutputTokens: int("llmOutputTokens"),
  // AI persona snapshot at time of test
  personaSnapshot: json("personaSnapshot"),
  // Admin management
  testedBy: varchar("testedBy", { length: 255 }).notNull(),
  notes: text("notes"),
  previousRunId: int("previousRunId"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiTestRun = typeof aiTestRuns.$inferSelect;
export type InsertAiTestRun = typeof aiTestRuns.$inferInsert;

// ============================================================================
// AI Regression Test — Regression Sets, Questions, Runs, Run Details
// ============================================================================

export const regressionSets = mysqlTable("regression_sets", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  createdBy: varchar("createdBy", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RegressionSet = typeof regressionSets.$inferSelect;
export type InsertRegressionSet = typeof regressionSets.$inferInsert;

export const regressionQuestions = mysqlTable("regression_questions", {
  id: int("id").autoincrement().primaryKey(),
  setId: int("setId").notNull(),
  question: text("question").notNull(),
  expectedSource: varchar("expectedSource", { length: 50 }),
  expectedKeywords: text("expectedKeywords"),
  expectedReply: text("expectedReply"),
  category: varchar("category", { length: 100 }),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RegressionQuestion = typeof regressionQuestions.$inferSelect;
export type InsertRegressionQuestion = typeof regressionQuestions.$inferInsert;

export const regressionRuns = mysqlTable("regression_runs", {
  id: int("id").autoincrement().primaryKey(),
  setId: int("setId").notNull(),
  versionId: int("versionId"),
  isBaseline: boolean("isBaseline").default(false).notNull(),
  baselineRunId: int("baselineRunId"),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  totalQuestions: int("totalQuestions").default(0).notNull(),
  passedCount: int("passedCount").default(0).notNull(),
  failedCount: int("failedCount").default(0).notNull(),
  accuracy: decimal("accuracy", { precision: 5, scale: 2 }).default("0").notNull(),
  avgProcessingMs: int("avgProcessingMs").default(0).notNull(),
  // Difference summary
  newHits: int("newHits").default(0).notNull(),
  lostHits: int("lostHits").default(0).notNull(),
  sourceChanged: int("sourceChanged").default(0).notNull(),
  replyChanged: int("replyChanged").default(0).notNull(),
  noMatchIncreased: int("noMatchIncreased").default(0).notNull(),
  noMatchDecreased: int("noMatchDecreased").default(0).notNull(),
  handoverIncreased: int("handoverIncreased").default(0).notNull(),
  llmIncreased: int("llmIncreased").default(0).notNull(),
  llmDecreased: int("llmDecreased").default(0).notNull(),
  // Metadata
  runBy: varchar("runBy", { length: 255 }).notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type RegressionRun = typeof regressionRuns.$inferSelect;
export type InsertRegressionRun = typeof regressionRuns.$inferInsert;

export const regressionRunDetails = mysqlTable("regression_run_details", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  questionId: int("questionId").notNull(),
  question: text("question").notNull(),
  // Current result
  finalSource: varchar("finalSource", { length: 50 }).notNull(),
  matchedRuleId: int("matchedRuleId"),
  matchedKnowledgeId: int("matchedKnowledgeId"),
  matchedProductId: int("matchedProductId"),
  aiReply: text("aiReply"),
  shouldHandover: boolean("shouldHandover").default(false).notNull(),
  processingTimeMs: int("processingTimeMs"),
  llmCalled: boolean("llmCalled").default(false).notNull(),
  processingSteps: json("processingSteps"),
  // Baseline comparison
  baselineSource: varchar("baselineSource", { length: 50 }),
  baselineReply: text("baselineReply"),
  baselineRuleId: int("baselineRuleId"),
  baselineKnowledgeId: int("baselineKnowledgeId"),
  baselineProductId: int("baselineProductId"),
  baselineIsHandover: boolean("baselineIsHandover"),
  // Pass/Fail
  isPassed: boolean("isPassed").default(false).notNull(),
  differences: json("differences"),
  suggestion: text("suggestion"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RegressionRunDetail = typeof regressionRunDetails.$inferSelect;
export type InsertRegressionRunDetail = typeof regressionRunDetails.$inferInsert;

// ============================================================================
// AI Version — Version management for AI configuration snapshots
// ============================================================================

export const aiVersions = mysqlTable("ai_versions", {
  id: int("id").autoincrement().primaryKey(),
  versionNumber: varchar("versionNumber", { length: 50 }).notNull(),
  label: varchar("label", { length: 255 }),
  description: text("description"),
  // Snapshot of AI configuration at publish time
  knowledgeCount: int("knowledgeCount").default(0).notNull(),
  ruleCount: int("ruleCount").default(0).notNull(),
  personaId: int("personaId"),
  personaSnapshot: json("personaSnapshot"),
  // Snapshot of all knowledge and rules (for rollback)
  knowledgeSnapshot: json("knowledgeSnapshot"),
  rulesSnapshot: json("rulesSnapshot"),
  // Regression result at publish time
  regressionRunId: int("regressionRunId"),
  regressionAccuracy: decimal("regressionAccuracy", { precision: 5, scale: 2 }),
  // Status
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  publishedBy: varchar("publishedBy", { length: 255 }),
  publishedAt: timestamp("publishedAt"),
  createdBy: varchar("createdBy", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiVersion = typeof aiVersions.$inferSelect;
export type InsertAiVersion = typeof aiVersions.$inferInsert;

// ===========================================================================
// Business AI Integration — Draft Orders, Order Change Requests, Reservations
// ===========================================================================

/**
 * Draft Orders — AI detects purchase intent, creates draft (not official order).
 * Staff approves → official order created, inventory converted.
 * Staff rejects → inventory released, draft closed.
 */
export const draftOrders = mysqlTable("draft_orders", {
  id: int("id").autoincrement().primaryKey(),
  draftNumber: varchar("draftNumber", { length: 50 }).notNull().unique(),
  customerId: int("customerId"),
  customerName: varchar("customerName", { length: 255 }),
  messengerId: varchar("messengerId", { length: 255 }),
  platform: mysqlEnum("platform", ["messenger", "whatsapp", "other"]).default("messenger").notNull(),
  // AI context
  aiLogId: int("aiLogId"),
  detectedIntent: varchar("detectedIntent", { length: 100 }),
  originalMessage: text("originalMessage"),
  // Items snapshot (JSON array of { productId, productName, quantity, price, variantId? })
  items: json("items").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).default("0").notNull(),
  // Status: waiting_approval / approved / rejected / invalid
  status: mysqlEnum("status", ["waiting_approval", "approved", "rejected", "expired", "invalid"]).default("waiting_approval").notNull(),
  // Approval tracking
  approvedBy: varchar("approvedBy", { length: 255 }),
  approvedAt: timestamp("approvedAt"),
  rejectedBy: varchar("rejectedBy", { length: 255 }),
  rejectedAt: timestamp("rejectedAt"),
  rejectReason: text("rejectReason"),
  // Link to official order once approved
  officialOrderId: int("officialOrderId"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DraftOrder = typeof draftOrders.$inferSelect;
export type InsertDraftOrder = typeof draftOrders.$inferInsert;

/**
 * Order Change Requests — AI detects modification request for existing order.
 * AI never modifies official order directly; creates change request for staff approval.
 */
export const orderChangeRequests = mysqlTable("order_change_requests", {
  id: int("id").autoincrement().primaryKey(),
  requestNumber: varchar("requestNumber", { length: 50 }).notNull().unique(),
  orderId: int("orderId").notNull(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull(),
  customerId: int("customerId"),
  customerName: varchar("customerName", { length: 255 }),
  // Change type
  requestType: mysqlEnum("requestType", [
    "add_item", "remove_item", "change_quantity",
    "change_address", "change_phone", "cancel_item", "other",
  ]).notNull(),
  // Change details (JSON — structure depends on requestType)
  changeDetails: json("changeDetails").notNull(),
  // AI context
  aiLogId: int("aiLogId"),
  detectedIntent: varchar("detectedIntent", { length: 100 }),
  originalMessage: text("originalMessage"),
  // Status: waiting_approval / approved / rejected / invalid
  status: mysqlEnum("status", ["waiting_approval", "approved", "rejected", "expired", "invalid"]).default("waiting_approval").notNull(),
  // Approval tracking
  approvedBy: varchar("approvedBy", { length: 255 }),
  approvedAt: timestamp("approvedAt"),
  rejectedBy: varchar("rejectedBy", { length: 255 }),
  rejectedAt: timestamp("rejectedAt"),
  rejectReason: text("rejectReason"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrderChangeRequest = typeof orderChangeRequests.$inferSelect;
export type InsertOrderChangeRequest = typeof orderChangeRequests.$inferInsert;

/**
 * Reservation Records — every inventory reservation is traceable.
 * Source: draft_order / change_request
 * When approved → converted to official allocation (status = converted).
 * When rejected → released (status = released).
 */
export const reservationRecords = mysqlTable("reservation_records", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 200 }),
  variantId: int("variantId"),
  quantity: int("quantity").notNull(),
  // Source: draft_order / change_request
  source: mysqlEnum("source", ["draft_order", "change_request"]).notNull(),
  // Reference number (draft order number or change request number)
  referenceNumber: varchar("referenceNumber", { length: 50 }).notNull(),
  referenceId: int("referenceId").notNull(),
  // Status: active / converted / released
  status: mysqlEnum("status", ["active", "converted", "released"]).default("active").notNull(),
  // Conversion tracking
  convertedAt: timestamp("convertedAt"),
  releasedAt: timestamp("releasedAt"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReservationRecord = typeof reservationRecords.$inferSelect;
export type InsertReservationRecord = typeof reservationRecords.$inferInsert;

// =============================================================================
// Facebook Campaign Module
// Manages Facebook Post / Reel / Video marketing campaigns with Messenger Flow
// and Product Button ordering. Shares the same Auto Order Engine with Live Studio.
// =============================================================================

// --- Campaigns table ---
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  type: mysqlEnum("type", ["post", "reel", "video"]).notNull().default("post"),
  facebookLink: varchar("facebookLink", { length: 500 }),
  facebookPostId: varchar("facebookPostId", { length: 200 }),
  facebookVideoId: varchar("facebookVideoId", { length: 200 }),
  facebookPageId: varchar("facebookPageId", { length: 200 }),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  status: mysqlEnum("status", ["draft", "active", "ended", "archived"]).notNull().default("draft"),
  // Auto-reply public comment when no keyword matched
  autoReplyEnabled: boolean("autoReplyEnabled").notNull().default(true),
  autoReplyText: text("autoReplyText"),
  // Send Messenger Flow when no keyword matched
  messengerFlowEnabled: boolean("messengerFlowEnabled").notNull().default(true),
  // Stats
  commentCount: int("commentCount").notNull().default(0),
  messengerCount: int("messengerCount").notNull().default(0),
  orderCount: int("orderCount").notNull().default(0),
  totalRevenue: decimal("totalRevenue", { precision: 12, scale: 2 }).default("0.00").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// --- Campaign Content IDs table ---
// One Campaign can bind multiple Facebook content IDs (Post ID, Reel ID, Video ID)
// All comments/messages from any bound content go to the same Campaign
export const campaignContentIds = mysqlTable("campaign_content_ids", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  contentType: mysqlEnum("contentType", ["post", "reel", "video"]).notNull(),
  contentId: varchar("contentId", { length: 200 }).notNull(),
  facebookLink: varchar("facebookLink", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CampaignContentId = typeof campaignContentIds.$inferSelect;

// --- Campaign Flows table ---
// Messenger Flow steps for a campaign (ordered sequence of messages)
export const campaignFlows = mysqlTable("campaign_flows", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  // Flow step type
  type: mysqlEnum("type", ["text", "image", "video", "audio", "file", "product_intro", "button"]).notNull(),
  // Content for text/product_intro/button types
  text: text("text"),
  // Media URL for image/video/audio/file types
  mediaUrl: varchar("mediaUrl", { length: 500 }),
  mediaType: varchar("mediaType", { length: 100 }),
  // For button type: JSON array of button configs
  buttonConfig: text("buttonConfig"),
  // For product_intro type: product ID to introduce
  productId: int("productId"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CampaignFlow = typeof campaignFlows.$inferSelect;
export type InsertCampaignFlow = typeof campaignFlows.$inferInsert;

// --- Campaign Buttons table ---
// Product buttons that customers can click to place orders directly
export const campaignButtons = mysqlTable("campaign_buttons", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  flowId: int("flowId"),
  // Button display name (free text)
  name: varchar("name", { length: 100 }).notNull(),
  // Bound product
  productId: int("productId").notNull(),
  // Bound variant (optional)
  variantId: int("variantId"),
  // Quantity to order when clicked
  quantity: int("quantity").notNull().default(1),
  // Button sort order within flow
  sortOrder: int("sortOrder").notNull().default(0),
  // Whether button is active
  isActive: boolean("isActive").notNull().default(true),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CampaignButton = typeof campaignButtons.$inferSelect;
export type InsertCampaignButton = typeof campaignButtons.$inferInsert;

// V2.0.43: Order number sequence counter
export const orderSeq = mysqlTable("order_seq", {
  id: int("id").autoincrement().primaryKey(),
  prefix: varchar("prefix", { length: 10 }).notNull(),
  nextNumber: int("next_number").notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type OrderSeq = typeof orderSeq.$inferSelect;
export type InsertOrderSeq = typeof orderSeq.$inferInsert;


// ============================================================================
// V2.0.78: Customer Credit Ledger (客户 Credit 变动记录)
// ============================================================================

export const customerCreditLedger = mysqlTable("customer_credit_ledger", {
  id: int("id").autoincrement().primaryKey(),
  // Customer reference
  customerId: int("customerId").notNull(),
  // Amount change: positive for add, negative for deduct/use
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  // Balance after this change
  balanceAfter: decimal("balanceAfter", { precision: 10, scale: 2 }).notNull(),
  // Type of change
  type: mysqlEnum("type", ["admin_add", "admin_deduct", "order_use", "order_refund"]).notNull(),
  // Reason / note
  reason: text("reason").notNull(),
  // Related order ID (for order_use / order_refund)
  orderId: int("orderId"),
  // Order number for display (e.g. XT00017)
  orderNumber: varchar("orderNumber", { length: 30 }),
  // Who performed the action (admin name or "System")
  performedBy: varchar("performedBy", { length: 255 }).notNull(),
  // Admin user ID (if performed by admin)
  adminId: int("adminId"),
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomerCreditLedger = typeof customerCreditLedger.$inferSelect;
export type InsertCustomerCreditLedger = typeof customerCreditLedger.$inferInsert;
