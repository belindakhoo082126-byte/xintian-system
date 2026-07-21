import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

  it("create requires admin role", async () => {
    const { ctx } = createAuthContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.products.create({ name: "Test", type: "physical" })
    ).rejects.toThrow();
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
      flowErrorMessage: expect.stringContaining("No active flow template"),
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

  it("create requires admin", async () => {
    const { ctx } = createAuthContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.flows.create({ name: "Test", messageContent: "Hello" })
    ).rejects.toThrow();
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
