import { describe, expect, it, beforeEach, vi } from "vitest";
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

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(null)),

  // Products
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
  logOrderOperation: vi.fn(() => Promise.resolve()),

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
  // Business Reports
  getDateRange: vi.fn(() => ({ start: new Date(), end: new Date() })),
  getBusinessOverview: vi.fn(() => Promise.resolve({
    totalRevenue: 0, totalPaid: 0, totalUnpaid: 0, totalRefunds: 0,
    paidOrders: 0, unpaidOrders: 0, shippedPackages: 0, borneShipping: 0,
    shippingIncome: 0, productSales: 0, fifoCost: 0, grossProfit: 0, grossMargin: 0,
    orderStats: { total: 0, paid: 0, unpaid: 0, refunded: 0, completed: 0, cancelled: 0 },
  })),
  getTopProductsByQuantity: vi.fn(() => Promise.resolve([])),
  getTopProductsByRevenue: vi.fn(() => Promise.resolve([])),
  getTopProductsByProfit: vi.fn(() => Promise.resolve([])),
  getTopCustomersBySpending: vi.fn(() => Promise.resolve([])),
  getSalesPaymentReport: vi.fn(() => Promise.resolve([])),
  getProductSalesReport: vi.fn(() => Promise.resolve([])),
  getCustomerSpendingReport: vi.fn(() => Promise.resolve([])),
  getPurchaseInventoryReport: vi.fn(() => Promise.resolve(null)),
  getRefundRecords: vi.fn(() => Promise.resolve([])),
  getMonthlyProfitReport: vi.fn(() => Promise.resolve({ revenue: "0", cost: "0", profit: "0" })),
  // System Settings & Shipping
  getSystemSettings: vi.fn(() => Promise.resolve({ id: 1, companyName: "心田", currency: "MYR", timezone: "Asia/Kuala_Lumpur" })),
  updateSystemSettings: vi.fn((data: any) => Promise.resolve({ id: 1, ...data })),
  getShippingRules: vi.fn(() => Promise.resolve([
    { id: 1, zone: "west_malaysia", displayName: "西马", freeShippingThreshold: "150.00", isEnabled: true, sortOrder: 1 },
    { id: 2, zone: "east_malaysia", displayName: "东马", maxCalculateWeight: "2.00", isEnabled: true, sortOrder: 2 },
  ])),
  getShippingRuleByZone: vi.fn(() => Promise.resolve(null)),
  updateShippingRule: vi.fn((_id: number, data: any) => Promise.resolve({ id: 1, ...data })),
  createShippingRule: vi.fn((data: any) => Promise.resolve({ id: 3, ...data })),
  deleteShippingRule: vi.fn(() => Promise.resolve()),
  getShippingProviders: vi.fn(() => Promise.resolve([
    { id: 1, providerKey: "parceldaily", displayName: "ParcelDaily", isEnabled: true, environment: "production" },
    { id: 2, providerKey: "manual", displayName: "Manual Shipping", isEnabled: true, environment: "production" },
  ])),
  getShippingProviderByKey: vi.fn(() => Promise.resolve(null)),
  updateShippingProvider: vi.fn((_key: string, data: any) => Promise.resolve({ providerKey: "parceldaily", ...data })),
  getShipmentByOrderId: vi.fn(() => Promise.resolve(null)),
  createShipment: vi.fn((data: any) => Promise.resolve({ id: 1, ...data })),
  updateShipment: vi.fn((_id: number, data: any) => Promise.resolve({ id: 1, ...data })),
  getShipmentsByStatus: vi.fn(() => Promise.resolve([])),
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

describe("products router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list returns products from db", async () => {
    const mockProducts = [
      { id: 1, name: "黑莓苗", type: "physical", regularPrice: "35.00" },
      { id: 2, name: "心田会员", type: "membership", regularPrice: "200.00" },
    ];
    vi.mocked(dbMock.getProducts).mockResolvedValue(mockProducts as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.products.list({});

    expect(result).toEqual(mockProducts);
    expect(dbMock.getProducts).toHaveBeenCalledWith({});
  });

  it("list filters by type", async () => {
    vi.mocked(dbMock.getProducts).mockResolvedValue([]);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await caller.products.list({ type: "membership" });

    expect(dbMock.getProducts).toHaveBeenCalledWith({ type: "membership" });
  });

  it("blocks Shipping Staff from creating products", async () => {
    const { ctx } = createAuthContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.products.create({ name: "Test", type: "physical" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(dbMock.createProduct).not.toHaveBeenCalled();
  });

  it("create succeeds with admin role", async () => {
    vi.mocked(dbMock.createProduct).mockResolvedValue({ insertId: 1 } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.products.create({
      name: "心田会员",
      type: "membership",
      regularPrice: "200.00",
      membershipIntro: "年度会员",
      telegramFlowLink: "https://t.me/xintian",
    });

    expect(result).toBeDefined();
    expect(dbMock.createProduct).toHaveBeenCalled();
  });
});

describe("orders router - split logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create calls createOrderWithSplit with correct data", async () => {
    const mockResult = { orderId: 1, orderNumber: "XT001", totalAmount: "65.00" };
    vi.mocked(dbMock.createOrderWithSplit).mockResolvedValue(mockResult as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.orders.create({
      customerId: 1,
      items: [
        { productId: 1, productName: "黑莓苗", productType: "physical", quantity: 1, unitPrice: "35.00", subtotal: "35.00" },
        { productId: 2, productName: "肥料", productType: "physical", quantity: 1, unitPrice: "10.00", subtotal: "10.00" },
        { productId: 3, productName: "心田会员", productType: "membership", quantity: 1, unitPrice: "20.00", subtotal: "20.00" },
      ],
      shippingMethod: "west_malaysia",
    });

    expect(result).toEqual(mockResult);
    expect(dbMock.createOrderWithSplit).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 1,
        items: expect.arrayContaining([
          expect.objectContaining({ productType: "physical" }),
          expect.objectContaining({ productType: "membership" }),
        ]),
      })
    );
  });

  it("updateStatus calls updateOrderStatus", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await caller.orders.updateStatus({ id: 1, physicalStatus: "payment_confirmed" });

    expect(dbMock.updateOrderStatus).toHaveBeenCalledWith(1, { physicalStatus: "payment_confirmed" });
  });
});

describe("membership router - fee review flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approveFee updates review, order status, and sends flow", async () => {
    const mockReview = {
      id: 1,
      orderId: 10,
      receiptFileUrl: "/receipt.jpg",
      receiptUploadedAt: new Date(),
      reviewedByStaffId: null,
      reviewStatus: "pending",
      reviewNotes: null,
      reviewedAt: null,
      flowSentAt: null,
      flowStatus: "pending",
      flowErrorMessage: null,
      flowTemplateId: null,
      telegramLinkClicked: false,
      telegramLinkClickedAt: null,
      needsManualFollowUp: false,
      followUpNotes: null,
      followUpCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockTemplate = {
      id: 1,
      name: "会员付款成功 Flow",
      messageContent: "您好，会员费已确认",
      buttonName: "进入心田会员系统",
      buttonLink: "https://t.me/xintian",
      isActive: true,
    };

    vi.mocked(dbMock.getMembershipReviewById).mockResolvedValue(mockReview as any);
    vi.mocked(dbMock.getFlowTemplates).mockResolvedValue([mockTemplate] as any);
    vi.mocked(dbMock.getFlowTemplateById).mockResolvedValue(null as any);
    vi.mocked(dbMock.getOrderById).mockResolvedValue({ id: 10, customerId: 1, messengerId: "psid_123" } as any);
    vi.mocked(dbMock.getCustomerById).mockResolvedValue({ id: 1, messengerId: "psid_123" } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.membership.approveFee({ reviewId: 1 });

    expect(result.success).toBe(true);
    expect(result.flowSent).toBe(true);
    expect(dbMock.approveMembershipFee).toHaveBeenCalledWith(1, 1, undefined);
    expect(dbMock.updateOrderStatus).toHaveBeenCalledWith(10, { membershipStatus: "fee_confirmed" });
    expect(dbMock.updateFlowStatus).toHaveBeenCalledWith(1, expect.objectContaining({ flowStatus: "sent" }));
  });

  it("approveFee handles missing template gracefully", async () => {
    const mockReview = {
      id: 1,
      orderId: 10,
      receiptFileUrl: "/receipt.jpg",
      receiptUploadedAt: new Date(),
      reviewedByStaffId: null,
      reviewStatus: "pending",
      reviewNotes: null,
      reviewedAt: null,
      flowSentAt: null,
      flowStatus: "pending",
      flowErrorMessage: null,
      flowTemplateId: null,
      telegramLinkClicked: false,
      telegramLinkClickedAt: null,
      needsManualFollowUp: false,
      followUpNotes: null,
      followUpCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(dbMock.getMembershipReviewById).mockResolvedValue(mockReview as any);
    vi.mocked(dbMock.getFlowTemplates).mockResolvedValue([] as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.membership.approveFee({ reviewId: 1 });

    expect(result.success).toBe(true);
    expect(result.flowSent).toBe(false);
    expect(dbMock.updateFlowStatus).toHaveBeenCalledWith(1, expect.objectContaining({
      flowStatus: "failed",
      flowErrorMessage: expect.stringContaining("会员付款成功Flow"),
    }));
  });

  it("rejectFee resets order to pending", async () => {
    const mockReview = {
      id: 1,
      orderId: 10,
      receiptFileUrl: "/receipt.jpg",
      receiptUploadedAt: new Date(),
      reviewedByStaffId: null,
      reviewStatus: "pending",
      reviewNotes: null,
      reviewedAt: null,
      flowSentAt: null,
      flowStatus: "pending",
      flowErrorMessage: null,
      flowTemplateId: null,
      telegramLinkClicked: false,
      telegramLinkClickedAt: null,
      needsManualFollowUp: false,
      followUpNotes: null,
      followUpCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(dbMock.getMembershipReviewById).mockResolvedValue(mockReview as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.membership.rejectFee({ reviewId: 1 });

    expect(result.success).toBe(true);
    expect(dbMock.rejectMembershipFee).toHaveBeenCalled();
    expect(dbMock.updateOrderStatus).toHaveBeenCalledWith(10, { membershipStatus: "pending" });
  });

  it("resendFlow sends flow again", async () => {
    const mockReview = {
      id: 1,
      orderId: 10,
      flowTemplateId: 1,
      receiptFileUrl: "/receipt.jpg",
      receiptUploadedAt: new Date(),
      reviewedByStaffId: 1,
      reviewStatus: "approved",
      reviewNotes: null,
      reviewedAt: new Date(),
      flowSentAt: new Date(),
      flowStatus: "failed",
      flowErrorMessage: "timeout",
      telegramLinkClicked: false,
      telegramLinkClickedAt: null,
      needsManualFollowUp: false,
      followUpNotes: null,
      followUpCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockTemplate = {
      id: 1,
      name: "Test Flow",
      messageContent: "测试消息",
      buttonName: "进入心田会员系统",
      buttonLink: "https://t.me/xintian",
      isActive: true,
    };

    vi.mocked(dbMock.getMembershipReviewById).mockResolvedValue(mockReview as any);
    vi.mocked(dbMock.getFlowTemplateById).mockResolvedValue(mockTemplate as any);
    vi.mocked(dbMock.getOrderById).mockResolvedValue({ id: 10, customerId: 1, messengerId: "psid_123" } as any);
    vi.mocked(dbMock.getCustomerById).mockResolvedValue({ id: 1, messengerId: "psid_123" } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.membership.resendFlow({ reviewId: 1 });

    expect(result.success).toBe(true);
    expect(dbMock.updateFlowStatus).toHaveBeenCalledWith(1, expect.objectContaining({ flowStatus: "sent" }));
    expect(dbMock.updateOrderStatus).toHaveBeenCalledWith(10, { membershipStatus: "flow_sent" });
  });

  it("cancelMembershipOrder sets cancelled status", async () => {
    const mockReview = {
      id: 1,
      orderId: 10,
      receiptFileUrl: "/receipt.jpg",
      receiptUploadedAt: new Date(),
      reviewedByStaffId: null,
      reviewStatus: "pending",
      reviewNotes: null,
      reviewedAt: null,
      flowSentAt: null,
      flowStatus: "pending",
      flowErrorMessage: null,
      flowTemplateId: null,
      telegramLinkClicked: false,
      telegramLinkClickedAt: null,
      needsManualFollowUp: false,
      followUpNotes: null,
      followUpCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(dbMock.getMembershipReviewById).mockResolvedValue(mockReview as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.membership.cancelMembershipOrder({ reviewId: 1 });

    expect(result.success).toBe(true);
    expect(dbMock.updateOrderStatus).toHaveBeenCalledWith(10, { membershipStatus: "cancelled" });
  });
});

describe("customers router - identity merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findOrCreate delegates to db helper", async () => {
    const mockCustomer = { id: 1, name: "Test", facebookId: "fb123" };
    vi.mocked(dbMock.findOrCreateCustomer).mockResolvedValue(mockCustomer as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.findOrCreate({
      facebookId: "fb123",
      facebookName: "Test User",
    });

    expect(result).toEqual(mockCustomer);
    expect(dbMock.findOrCreateCustomer).toHaveBeenCalledWith({
      facebookId: "fb123",
      facebookName: "Test User",
    });
  });

  it("merge calls mergeCustomers with correct ids", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.merge({ sourceId: 2, targetId: 1 });

    expect(result.success).toBe(true);
    expect(dbMock.mergeCustomers).toHaveBeenCalledWith(2, 1, 1);
  });

  it("findDuplicates returns potential duplicates", async () => {
    const mockDuplicates = [
      { id: 2, name: "Belinda", phoneNumber: "0123456789", facebookId: null },
      { id: 3, name: "Enabelle", phoneNumber: "0123456789", facebookId: null },
    ];
    vi.mocked(dbMock.findPotentialDuplicateCustomers).mockResolvedValue(mockDuplicates as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customers.findDuplicates({ customerId: 1 });

    expect(result).toEqual(mockDuplicates);
    expect(dbMock.findPotentialDuplicateCustomers).toHaveBeenCalledWith(1);
  });
});

describe("dashboard router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stats returns dashboard data", async () => {
    const mockStats = {
      newMembershipOrders: 5,
      pendingReviews: 2,
      flowSent: 10,
      needsFollowUp: 1,
      membershipRevenue: "1000.00",
      flowSuccessRate: 90,
    };
    vi.mocked(dbMock.getDashboardStats).mockResolvedValue(mockStats as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.stats();

    expect(result).toEqual(mockStats);
  });
});

describe("flows router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list returns flow templates", async () => {
    const mockTemplates = [
      { id: 1, name: "会员付款成功 Flow", isActive: true },
    ];
    vi.mocked(dbMock.getFlowTemplates).mockResolvedValue(mockTemplates as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.flows.list({});

    expect(result).toEqual(mockTemplates);
  });

  it("blocks Shipping Staff from creating flow templates", async () => {
    const { ctx } = createAuthContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.flows.create({ name: "Test", messageContent: "Hello" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(dbMock.createFlowTemplate).not.toHaveBeenCalled();
  });

  it("create succeeds with admin", async () => {
    vi.mocked(dbMock.createFlowTemplate).mockResolvedValue({ insertId: 1 } as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.flows.create({
      name: "会员付款成功 Flow",
      messageContent: "您好，会员费已确认",
      buttonName: "进入心田会员系统",
      buttonLink: "https://t.me/xintian",
    });

    expect(result).toBeDefined();
    expect(dbMock.createFlowTemplate).toHaveBeenCalled();
  });
});

describe("settings router", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("get returns system settings", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.get();
    expect(result).toEqual({ id: 1, companyName: "心田", currency: "MYR", timezone: "Asia/Kuala_Lumpur" });
  });
  it("update saves settings with admin", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.update({ companyName: "心田 ERP" });
    expect(result).toMatchObject({ id: 1, companyName: "心田 ERP" });
    expect(dbMock.updateSystemSettings).toHaveBeenCalledWith({ companyName: "心田 ERP" });
  });
});

describe("shippingRules router", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("list returns shipping rules", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.shippingRules.list();
    expect(result).toHaveLength(2);
    expect(result[0].zone).toBe("west_malaysia");
  });
  it("update modifies a rule with admin", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.shippingRules.update({ id: 1, displayName: "西马半岛" });
    expect(result).toMatchObject({ id: 1, displayName: "西马半岛" });
    expect(dbMock.updateShippingRule).toHaveBeenCalled();
  });
  it("delete removes a rule with admin", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.shippingRules.delete({ id: 5 });
    expect(result).toEqual({ success: true });
    expect(dbMock.deleteShippingRule).toHaveBeenCalledWith(5);
  });
});

describe("shippingProviders router", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("list returns providers without credentials", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.shippingProviders.list();
    expect(result).toHaveLength(2);
    expect(result[0].credentials).toBeUndefined();
  });
  it("update modifies provider settings with admin", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.shippingProviders.update({ providerKey: "parceldaily", isEnabled: false });
    expect(result).toMatchObject({ providerKey: "parceldaily", isEnabled: false });
    expect(dbMock.updateShippingProvider).toHaveBeenCalled();
  });
});
