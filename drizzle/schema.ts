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
  // V2.0: Preorder wait days (预计等待时间, e.g. "30~45天")
  preorderWaitDays: varchar("preorderWaitDays", { length: 100 }),
  // V2.0: Allow mixed checkout with normal products (允许与普通商品一起Checkout)
  // Note: allowMixedCheckout already exists above, repurposed for V2.0
  // V2.0: Spot sale after arrival (到货后现货销售)
  spotSaleEnabled: boolean("spotSaleEnabled").default(false).notNull(),
  spotSaleQty: int("spotSaleQty").default(0).notNull(),
  // V2.0: Linked import batch (for preorder products)
  linkedBatchId: int("linkedBatchId"),

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
  specialOrderType: mysqlEnum("specialOrderType", ["pending_shipping", "pending_refund", "company_bear"]),
  specialOrderStatus: mysqlEnum("specialOrderStatus", ["pending", "resolved", "cancelled"]).default("pending"),
  // V1.2: Parent order for split orders
  parentOrderId: int("parentOrderId"),
  // V2.0: Order nature (订单性质: normal or import_preorder)
  orderNature: mysqlEnum("orderNature", ["normal", "import_preorder"]).default("normal").notNull(),
  // V2.0: Linked import batch (for import_preorder orders)
  importBatchId: int("importBatchId"),
  // V2.0: Linked live room
  liveRoomId: int("liveRoomId"),
  // V2.0: Import preorder status (代购订单状态流程)
  importStatus: mysqlEnum("importStatus", [
    "waiting_payment",      // 等待付款
    "paid_waiting_close",   // 已付款（等待代购截止）
    "waiting_purchase",     // 等待统一采购
    "purchased",            // 已向中国采购
    "supplier_preparing",   // 供应商备货中
    "in_transit",           // 运输中
    "arriving_inspection",  // 到货验收中
    "ready_to_ship",        // 待发货
    "shipped",              // 已发货
    "completed",            // 完成
  ]).default("waiting_payment"),
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
  // Live comment footer (used in keyword copy & live post)
  liveCommentFooter: text("liveCommentFooter"),
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
  // Live room status
  status: mysqlEnum("status", ["scheduled", "live", "ended", "closed"]).default("scheduled").notNull(),
  // Notes
  notes: text("notes"),
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
  // Stock available for this live session
  stock: int("stock").default(0).notNull(),
  // Ordered count (how many times this keyword was captured)
  orderedCount: int("orderedCount").default(0).notNull(),
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
// V2.0: Import Batches (采购批次)
// ============================================================================

export const importBatches = mysqlTable("import_batches", {
  id: int("id").autoincrement().primaryKey(),
  // Batch number (e.g. CN-2026-08-01)
  batchNumber: varchar("batchNumber", { length: 50 }).notNull().unique(),
  // Batch name
  batchName: varchar("batchName", { length: 255 }).notNull(),
  // Source country
  sourceCountry: varchar("sourceCountry", { length: 100 }).default("中国").notNull(),
  // Supplier name
  supplierName: varchar("supplierName", { length: 255 }),
  // Linked live room
  liveRoomId: int("liveRoomId"),
  // Preorder window
  preorderStartDate: timestamp("preorderStartDate"),
  preorderEndDate: timestamp("preorderEndDate"),
  // Actual purchase date
  actualPurchaseDate: timestamp("actualPurchaseDate"),
  // Shipping method: air or sea
  shippingMethod: mysqlEnum("shippingMethod", ["air", "sea"]),
  // China shipping cost (total, in RM)
  chinaShippingCost: decimal("chinaShippingCost", { precision: 12, scale: 2 }).default("0"),
  // Batch status
  status: mysqlEnum("status", [
    "in_progress",    // 进行中
    "closed",         // 已截止
    "purchased",      // 已采购
    "preparing",      // 备货中
    "in_transit",     // 运输中
    "partial_arrived", // 部分到货
    "all_arrived",    // 全部到货
    "completed",      // 完成
  ]).default("in_progress").notNull(),
  // Notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ImportBatch = typeof importBatches.$inferSelect;
export type InsertImportBatch = typeof importBatches.$inferInsert;

// ============================================================================
// V2.0: Import Batch Items (采购批次商品明细 - 采购汇总与到货验收)
// ============================================================================

export const importBatchItems = mysqlTable("import_batch_items", {
  id: int("id").autoincrement().primaryKey(),
  // Batch ID
  batchId: int("batchId").notNull(),
  // Product ID
  productId: int("productId").notNull(),
  // Product name (snapshot)
  productName: varchar("productName", { length: 255 }).notNull(),
  // Variant ID (if applicable)
  variantId: int("variantId"),
  variantName: varchar("variantName", { length: 255 }),
  // Paid quantity (auto-calculated from paid orders)
  paidQuantity: int("paidQuantity").default(0).notNull(),
  // Final purchase quantity (admin can adjust, e.g. paid 100 + spare 5 = 105)
  finalPurchaseQuantity: int("finalPurchaseQuantity").default(0).notNull(),
  // Arrival verification
  actualReceivedQty: int("actualReceivedQty"),
  healthyQty: int("healthyQty"),
  damagedQty: int("damagedQty").default(0),
  deadQty: int("deadQty").default(0),
  missingQty: int("missingQty").default(0),
  // Item status
  itemStatus: mysqlEnum("itemStatus", [
    "pending",         // 待到货
    "all_arrived",     // 全部到货
    "partial_arrived", // 部分到货
    "shortage",        // 数量不足
    "damaged",         // 损坏
    "dead",            // 死亡
    "missing",         // 遗漏
  ]).default("pending"),
  // Unit purchase cost (from supplier)
  unitPurchaseCost: decimal("unitPurchaseCost", { precision: 10, scale: 2 }),
  // Allocated China shipping cost per unit (auto-calculated)
  allocatedShippingCost: decimal("allocatedShippingCost", { precision: 10, scale: 2 }),
  // Total actual cost (unit + shipping)
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
