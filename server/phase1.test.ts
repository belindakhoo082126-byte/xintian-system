import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the messenger module
vi.mock("./messenger", () => ({
  sendTextMessage: vi.fn(() => Promise.resolve({ message_id: "msg_123" })),
  sendButtonMessage: vi.fn(() => Promise.resolve({ message_id: "msg_124" })),
  sendMediaMessage: vi.fn(() => Promise.resolve({ message_id: "msg_125" })),
  sendTemplateMessage: vi.fn(() => Promise.resolve({ message_id: "msg_126" })),
  sendMembershipFlow: vi.fn(() => Promise.resolve([{ stepIndex: 0, success: true, messageId: "msg_127" }])),
  sendTelegramJoinFlow: vi.fn(() => Promise.resolve({ success: true, messageId: "msg_128" })),
  getUserProfile: vi.fn(() => Promise.resolve({ name: "Test User" })),
  handleMessengerEvent: vi.fn(),
  handlePageFeedEvent: vi.fn(),
}));

// Mock the db module — include all Phase 1 helpers
vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(null)),

  // Legacy products
  getProducts: vi.fn(() => Promise.resolve([])),
  getProductById: vi.fn(() => Promise.resolve(undefined)),
  createProduct: vi.fn(() => Promise.resolve({ insertId: 1 })),
  updateProduct: vi.fn(() => Promise.resolve()),
  deleteProduct: vi.fn(() => Promise.resolve()),

  // Customers
  getCustomers: vi.fn(() => Promise.resolve([])),
  getCustomerById: vi.fn(() => Promise.resolve(undefined)),
  findOrCreateCustomer: vi.fn(() => Promise.resolve({ id: 1, name: "Test" })),
  updateCustomer: vi.fn(() => Promise.resolve()),
  findPotentialDuplicateCustomers: vi.fn(() => Promise.resolve([])),
  mergeCustomers: vi.fn(() => Promise.resolve()),
  getMergeSuggestions: vi.fn(() => Promise.resolve([])),

  // Orders
  getOrders: vi.fn(() => Promise.resolve([])),
  getOrderById: vi.fn(() => Promise.resolve(undefined)),
  getOrderItems: vi.fn(() => Promise.resolve([])),
  createOrderWithSplit: vi.fn(() => Promise.resolve({ orderId: 1, orderNumber: "XT001", totalAmount: "65.00" })),
  updateOrderStatus: vi.fn(() => Promise.resolve()),

  // Membership reviews
  getMembershipReviews: vi.fn(() => Promise.resolve([])),
  getMembershipReviewById: vi.fn(() => Promise.resolve(undefined)),
  getMembershipReviewByOrderId: vi.fn(() => Promise.resolve(undefined)),
  createMembershipReview: vi.fn(() => Promise.resolve()),
  approveMembershipFee: vi.fn(() => Promise.resolve()),
  rejectMembershipFee: vi.fn(() => Promise.resolve()),
  updateFlowStatus: vi.fn(() => Promise.resolve()),
  markTelegramLinkClicked: vi.fn(() => Promise.resolve()),
  markNeedsManualFollowUp: vi.fn(() => Promise.resolve()),

  // Flow templates
  getFlowTemplates: vi.fn(() => Promise.resolve([])),
  getFlowTemplateById: vi.fn(() => Promise.resolve(undefined)),
  createFlowTemplate: vi.fn(() => Promise.resolve({ insertId: 1 })),
  updateFlowTemplate: vi.fn(() => Promise.resolve()),
  deleteFlowTemplate: vi.fn(() => Promise.resolve()),

  // Flow steps
  getFlowStepsByTemplateId: vi.fn(() => Promise.resolve([])),
  createFlowStep: vi.fn(() => Promise.resolve({ insertId: 1 })),
  updateFlowStep: vi.fn(() => Promise.resolve()),
  deleteFlowStep: vi.fn(() => Promise.resolve()),

  // Flow send logs
  createFlowSendLog: vi.fn(() => Promise.resolve()),
  getFlowSendLogsByReviewId: vi.fn(() => Promise.resolve([])),

  // Dashboard
  getDashboardStats: vi.fn(() => Promise.resolve({
    newMembershipOrders: 0,
    pendingReviews: 0,
    flowSent: 0,
    needsFollowUp: 0,
    membershipRevenue: "0",
    flowSuccessRate: 0,
  })),

  // Phase 1: Categories
  getAllCategories: vi.fn(() => Promise.resolve([])),
  getActiveCategories: vi.fn(() => Promise.resolve([])),
  getStoreCategories: vi.fn(() => Promise.resolve([])),
  getCategoryById: vi.fn(() => Promise.resolve(undefined)),
  createCategory: vi.fn(() => Promise.resolve({ insertId: 1 })),
  updateCategory: vi.fn(() => Promise.resolve()),
  deleteCategory: vi.fn(() => Promise.resolve({ success: true })),
  reorderCategories: vi.fn(() => Promise.resolve()),
  countProductsInCategory: vi.fn(() => Promise.resolve(0)),

  // Phase 1: Units
  getAllUnits: vi.fn(() => Promise.resolve([])),
  createUnit: vi.fn(() => Promise.resolve({ insertId: 1 })),

  // Phase 1: Products V2
  getProductsEnhanced: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
  getProductByIdEnhanced: vi.fn(() => Promise.resolve(undefined)),
  createProductEnhanced: vi.fn(() => Promise.resolve({ id: 1, sku: "XT-00001" })),
  updateProductEnhanced: vi.fn(() => Promise.resolve()),
  deleteProductEnhanced: vi.fn(() => Promise.resolve({ success: true })),
  checkKeywordConflict: vi.fn(() => Promise.resolve({ available: true })),
  checkVariantKeywordConflict: vi.fn(() => Promise.resolve({ available: true })),
  generateProductSku: vi.fn(() => Promise.resolve("XT-00001")),
  generateVariantSku: vi.fn(() => Promise.resolve("XT-00001-01")),

  // Phase 1: Public API
  getPublicProducts: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
  getPublicProductById: vi.fn(() => Promise.resolve(undefined)),
  getPublicProductByKeyword: vi.fn(() => Promise.resolve(undefined)),

  // Phase 1: Member Link
  getMemberLinkByToken: vi.fn(() => Promise.resolve(undefined)),
  generateMemberLink: vi.fn(() => Promise.resolve({ id: 1, token: "abc123", url: "/m/abc123" })),
  getMemberLinksByProductId: vi.fn(() => Promise.resolve([])),
  deactivateMemberLink: vi.fn(() => Promise.resolve()),

  // Phase 1: Variants
  createVariant: vi.fn(() => Promise.resolve({ id: 1 })),
  updateVariant: vi.fn(() => Promise.resolve()),
  deleteVariant: vi.fn(() => Promise.resolve({ success: true })),
  getVariantsByProductId: vi.fn(() => Promise.resolve([])),

  // Phase 1: Images/Videos/Attributes
  createProductImage: vi.fn(() => Promise.resolve({ id: 1 })),
  createProductVideo: vi.fn(() => Promise.resolve({ id: 1 })),
  createProductAttribute: vi.fn(() => Promise.resolve({ id: 1 })),
}));

import * as dbMock from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin",
    email: "admin@xintian.test",
    name: "Test Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    ctx: {
      user,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    },
  };
}

function createPublicContext(): { ctx: TrpcContext } {
  return {
    ctx: {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    },
  };
}

// ===========================================================================
// Categories Tests
// ===========================================================================
describe("categories router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list returns all categories by default", async () => {
    const mockCats = [{ id: 1, nameZh: "花类", nameEn: "Flowers" }];
    vi.mocked(dbMock.getAllCategories).mockResolvedValue(mockCats as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.categories.list({});

    expect(result).toEqual(mockCats);
    expect(dbMock.getAllCategories).toHaveBeenCalled();
  });

  it("list returns active-only categories when activeOnly=true", async () => {
    const mockCats = [{ id: 1, nameZh: "花类", nameEn: "Flowers", status: "active" }];
    vi.mocked(dbMock.getActiveCategories).mockResolvedValue(mockCats as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.categories.list({ activeOnly: true });

    expect(result).toEqual(mockCats);
    expect(dbMock.getActiveCategories).toHaveBeenCalled();
  });

  it("list returns store-only categories when storeOnly=true", async () => {
    const mockCats = [{ id: 1, nameZh: "花类", nameEn: "Flowers", showInStore: true }];
    vi.mocked(dbMock.getStoreCategories).mockResolvedValue(mockCats as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.categories.list({ storeOnly: true });

    expect(result).toEqual(mockCats);
    expect(dbMock.getStoreCategories).toHaveBeenCalled();
  });

  it("create calls createCategory with correct data", async () => {
    vi.mocked(dbMock.createCategory).mockResolvedValue({ insertId: 5 } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.categories.create({
      nameZh: "花盆",
      nameEn: "Pots",
      showInStore: true,
      sortOrder: 2,
    });

    expect(result).toEqual({ insertId: 5 });
    expect(dbMock.createCategory).toHaveBeenCalledWith({
      nameZh: "花盆",
      nameEn: "Pots",
      showInStore: true,
      sortOrder: 2,
    });
  });

  it("reorder calls reorderCategories with items array", async () => {
    vi.mocked(dbMock.reorderCategories).mockResolvedValue(undefined as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.categories.reorder({
      items: [
        { id: 3, sortOrder: 0 },
        { id: 1, sortOrder: 1 },
        { id: 2, sortOrder: 2 },
      ],
    });

    expect(result).toEqual({ success: true });
    expect(dbMock.reorderCategories).toHaveBeenCalledWith([
      { id: 3, sortOrder: 0 },
      { id: 1, sortOrder: 1 },
      { id: 2, sortOrder: 2 },
    ]);
  });

  it("delete returns success result from db", async () => {
    vi.mocked(dbMock.deleteCategory).mockResolvedValue({ success: true } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.categories.delete({ id: 5 });

    expect(result).toEqual({ success: true });
    expect(dbMock.deleteCategory).toHaveBeenCalledWith(5);
  });
});

// ===========================================================================
// Units Tests
// ===========================================================================
describe("units router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list returns all units", async () => {
    const mockUnits = [{ id: 1, nameZh: "盆", nameEn: "Pot" }];
    vi.mocked(dbMock.getAllUnits).mockResolvedValue(mockUnits as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.units.list();

    expect(result).toEqual(mockUnits);
  });
});

// ===========================================================================
// ProductsV2 Tests
// ===========================================================================
describe("productsV2 router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list returns paginated results", async () => {
    const mockResult = {
      items: [{ id: 1, name: "黑莓苗", keyword: "BERRY" }],
      total: 1,
    };
    vi.mocked(dbMock.getProductsEnhanced).mockResolvedValue(mockResult as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productsV2.list({ limit: 20, offset: 0 });

    expect(result).toEqual(mockResult);
    expect(dbMock.getProductsEnhanced).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  it("list passes all filter params to db", async () => {
    vi.mocked(dbMock.getProductsEnhanced).mockResolvedValue({ items: [], total: 0 } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await caller.productsV2.list({
      search: "黑莓",
      type: "physical",
      status: "active",
      isFeatured: true,
      limit: 10,
      offset: 20,
    });

    expect(dbMock.getProductsEnhanced).toHaveBeenCalledWith({
      search: "黑莓",
      type: "physical",
      status: "active",
      isFeatured: true,
      limit: 10,
      offset: 20,
    });
  });

  it("getById returns product with details", async () => {
    const mockProduct = {
      id: 1,
      name: "黑莓苗",
      keyword: "BERRY",
      variants: [],
      images: [],
      videos: [],
    };
    vi.mocked(dbMock.getProductByIdEnhanced).mockResolvedValue(mockProduct as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productsV2.getById({ id: 1 });

    expect(result).toEqual(mockProduct);
    expect(dbMock.getProductByIdEnhanced).toHaveBeenCalledWith(1);
  });

  it("getById throws when product not found", async () => {
    vi.mocked(dbMock.getProductByIdEnhanced).mockResolvedValue(undefined as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.productsV2.getById({ id: 999 })).rejects.toThrow("商品不存在");
  });

  it("create throws on keyword conflict", async () => {
    vi.mocked(dbMock.checkKeywordConflict).mockResolvedValue({
      available: false,
      conflictWith: { id: 2, name: "菊花" },
    } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.productsV2.create({
      name: "新菊花",
      type: "physical",
      productMode: "simple",
      keyword: "JUHUA",
    })).rejects.toThrow("关键词");
  });

  it("create succeeds when keyword is available", async () => {
    vi.mocked(dbMock.checkKeywordConflict).mockResolvedValue({ available: true } as any);
    vi.mocked(dbMock.createProductEnhanced).mockResolvedValue({ id: 3, sku: "XT-00003" } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productsV2.create({
      name: "新商品",
      type: "physical",
      productMode: "simple",
      keyword: "NEW001",
    });

    expect(result).toEqual({ id: 3, sku: "XT-00003" });
    expect(dbMock.createProductEnhanced).toHaveBeenCalled();
  });

  it("update throws on keyword conflict", async () => {
    vi.mocked(dbMock.checkKeywordConflict).mockResolvedValue({
      available: false,
      conflictWith: { id: 2, name: "菊花" },
    } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.productsV2.update({
      id: 1,
      keyword: "JUHUA",
    })).rejects.toThrow("关键词");
  });

  it("update succeeds when keyword is not being changed", async () => {
    vi.mocked(dbMock.updateProductEnhanced).mockResolvedValue(undefined as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productsV2.update({
      id: 1,
      name: "更新后的名称",
    });

    expect(result).toEqual({ success: true });
    expect(dbMock.updateProductEnhanced).toHaveBeenCalledWith(1, { name: "更新后的名称" });
  });

  it("setStatus updates product status", async () => {
    vi.mocked(dbMock.updateProductEnhanced).mockResolvedValue(undefined as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productsV2.setStatus({ id: 1, status: "out_of_stock" });

    expect(result).toEqual({ success: true });
    expect(dbMock.updateProductEnhanced).toHaveBeenCalledWith(1, { status: "out_of_stock" });
  });

  it("delete returns success result", async () => {
    vi.mocked(dbMock.deleteProductEnhanced).mockResolvedValue({ success: true } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productsV2.delete({ id: 1 });

    expect(result).toEqual({ success: true });
  });

  it("duplicate creates a copy with _COPY keyword", async () => {
    const mockProduct = {
      id: 1,
      name: "黑莓苗",
      keyword: "BERRY",
      type: "physical",
      productMode: "simple",
      sellingPrice: "35.00",
    };
    vi.mocked(dbMock.getProductByIdEnhanced).mockResolvedValue(mockProduct as any);
    vi.mocked(dbMock.checkKeywordConflict).mockResolvedValue({ available: true } as any);
    vi.mocked(dbMock.createProductEnhanced).mockResolvedValue({ id: 2, sku: "XT-00002" } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productsV2.duplicate({ id: 1 });

    expect(result).toEqual({ id: 2, sku: "XT-00002" });
    expect(dbMock.createProductEnhanced).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "黑莓苗 (副本)",
        keyword: "BERRY_COPY",
        status: "draft",
      })
    );
  });

  it("checkKeyword returns availability status", async () => {
    vi.mocked(dbMock.checkKeywordConflict).mockResolvedValue({ available: true } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productsV2.checkKeyword({ keyword: "NEW001" });

    expect(result).toEqual({ available: true });
    expect(dbMock.checkKeywordConflict).toHaveBeenCalledWith("NEW001", undefined);
  });

  it("checkKeyword passes excludeProductId", async () => {
    vi.mocked(dbMock.checkKeywordConflict).mockResolvedValue({ available: true } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await caller.productsV2.checkKeyword({ keyword: "BERRY", excludeProductId: 1 });

    expect(dbMock.checkKeywordConflict).toHaveBeenCalledWith("BERRY", 1);
  });
});

// ===========================================================================
// Public API Tests (价格隔离)
// ===========================================================================
describe("productsV2 public API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publicList returns products without auth", async () => {
    const mockResult = {
      items: [{ id: 1, name: "黑莓苗", sellingPrice: "35.00" }],
      total: 1,
    };
    vi.mocked(dbMock.getPublicProducts).mockResolvedValue(mockResult as any);

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productsV2.publicList({ limit: 10 });

    expect(result).toEqual(mockResult);
    expect(dbMock.getPublicProducts).toHaveBeenCalledWith({ limit: 10 });
  });

  it("publicGetById returns product without auth", async () => {
    const mockProduct = { id: 1, name: "黑莓苗", sellingPrice: "35.00" };
    vi.mocked(dbMock.getPublicProductById).mockResolvedValue(mockProduct as any);

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productsV2.publicGetById({ id: 1 });

    expect(result).toEqual(mockProduct);
  });

  it("publicGetById throws when product not found", async () => {
    vi.mocked(dbMock.getPublicProductById).mockResolvedValue(undefined as any);

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.productsV2.publicGetById({ id: 999 })).rejects.toThrow("商品不存在或未上架");
  });

  it("publicGetByKeyword returns product", async () => {
    const mockProduct = { id: 1, name: "黑莓苗", keyword: "BERRY", sellingPrice: "35.00" };
    vi.mocked(dbMock.getPublicProductByKeyword).mockResolvedValue(mockProduct as any);

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productsV2.publicGetByKeyword({ keyword: "BERRY" });

    expect(result).toEqual(mockProduct);
  });

  it("publicGetByKeyword throws when not found", async () => {
    vi.mocked(dbMock.getPublicProductByKeyword).mockResolvedValue(undefined as any);

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.productsV2.publicGetByKeyword({ keyword: "NOPE" })).rejects.toThrow("关键词未匹配到商品");
  });
});

// ===========================================================================
// Member Link API Tests
// ===========================================================================
describe("productsV2 member link API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("memberGetByToken returns product with member pricing", async () => {
    const mockProduct = {
      id: 1,
      name: "心田会员",
      sellingPrice: "200.00",
      memberPrice: "180.00",
    };
    vi.mocked(dbMock.getMemberLinkByToken).mockResolvedValue(mockProduct as any);

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.productsV2.memberGetByToken({ token: "abc123" });

    expect(result).toEqual(mockProduct);
    expect(dbMock.getMemberLinkByToken).toHaveBeenCalledWith("abc123");
  });

  it("memberGetByToken throws for invalid token", async () => {
    vi.mocked(dbMock.getMemberLinkByToken).mockResolvedValue(undefined as any);

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.productsV2.memberGetByToken({ token: "invalid" })).rejects.toThrow("链接无效或已过期");
  });
});

// ===========================================================================
// Variants Tests
// ===========================================================================
describe("variants router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create throws on keyword conflict", async () => {
    vi.mocked(dbMock.checkVariantKeywordConflict).mockResolvedValue({
      available: false,
      conflictWith: { id: 1, name: "红色大盆" },
    } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.variants.create({
      productId: 1,
      name: "红色大盆",
      keyword: "RED",
    })).rejects.toThrow("关键词");
  });

  it("create succeeds when keyword is available", async () => {
    vi.mocked(dbMock.checkVariantKeywordConflict).mockResolvedValue({ available: true } as any);
    vi.mocked(dbMock.createVariant).mockResolvedValue({ id: 1 } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.variants.create({
      productId: 1,
      name: "蓝色中盆",
      keyword: "BLUE",
    });

    expect(result).toEqual({ id: 1 });
    expect(dbMock.createVariant).toHaveBeenCalled();
  });

  it("update succeeds when keyword is not being changed", async () => {
    vi.mocked(dbMock.updateVariant).mockResolvedValue(undefined as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.variants.update({
      id: 1,
      name: "更新规格",
    });

    expect(result).toEqual({ success: true });
    expect(dbMock.updateVariant).toHaveBeenCalledWith(1, { name: "更新规格" });
  });

  it("delete returns success result", async () => {
    vi.mocked(dbMock.deleteVariant).mockResolvedValue({ success: true } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.variants.delete({ id: 1 });

    expect(result).toEqual({ success: true });
  });
});

// ===========================================================================
// Member Links Tests
// ===========================================================================
describe("memberLinks router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generate creates a new link via db helper", async () => {
    vi.mocked(dbMock.generateMemberLink).mockResolvedValue({
      id: 2,
      token: "newtoken123",
      url: "/m/newtoken123",
    } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.memberLinks.generate({ productId: 1 });

    expect(result).toEqual({ id: 2, token: "newtoken123", url: "/m/newtoken123" });
    expect(dbMock.generateMemberLink).toHaveBeenCalledWith(1);
  });

  it("list returns links for a product", async () => {
    const mockLinks = [
      { id: 1, token: "abc123", isActive: true, createdAt: new Date() },
    ];
    vi.mocked(dbMock.getMemberLinksByProductId).mockResolvedValue(mockLinks as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.memberLinks.list({ productId: 1 });

    expect(result).toEqual(mockLinks);
    expect(dbMock.getMemberLinksByProductId).toHaveBeenCalledWith(1);
  });

  it("deactivate calls db deactivateMemberLink", async () => {
    vi.mocked(dbMock.deactivateMemberLink).mockResolvedValue(undefined as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.memberLinks.deactivate({ id: 5 });

    expect(result).toEqual({ success: true });
    expect(dbMock.deactivateMemberLink).toHaveBeenCalledWith(5);
  });
});
