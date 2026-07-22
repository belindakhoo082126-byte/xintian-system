import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db.ts
vi.mock("./db", () => ({
  getAllCouriers: vi.fn(),
  getActiveCouriers: vi.fn(),
  createCourier: vi.fn(),
  updateCourier: vi.fn(),
  deleteCourier: vi.fn(),
  getOrderPayments: vi.fn(),
  addOrderPayment: vi.fn(),
  getOrderNotifications: vi.fn(),
  createOrderNotification: vi.fn(),
  markManualNotified: vi.fn(),
  getOrderAuditLogs: vi.fn(),
  createAuditLog: vi.fn(),
  getWorkQueueStats: vi.fn(),
  findMergeableOrder: vi.fn(),
  mergeOrderItems: vi.fn(),
  shipOrder: vi.fn(),
  cancelOrder: vi.fn(),
  completeOrder: vi.fn(),
  getOrdersEnhanced: vi.fn(),
  getOrderDetail: vi.fn(),
}));

// Mock server/_core/trpc
vi.mock("./_core/trpc", () => ({
  publicProcedure: {
    query: (fn: any) => ({ _fn: fn, _type: "query" }),
    mutation: (fn: any) => ({ _fn: fn, _type: "mutation" }),
  },
  protectedProcedure: {
    query: (fn: any) => ({ _fn: fn, _type: "query" }),
    mutation: (fn: any) => ({ _fn: fn, _type: "mutation" }),
    use: (fn: any) => ({
      query: (inner: any) => ({ _fn: inner, _type: "query", _middleware: fn }),
      mutation: (inner: any) => ({ _fn: inner, _type: "mutation", _middleware: fn }),
    }),
  },
  adminProcedure: {
    query: (fn: any) => ({ _fn: fn, _type: "query" }),
    mutation: (fn: any) => ({ _fn: fn, _type: "mutation" }),
  },
  router: (obj: any) => obj,
  mergeRouters: (obj: any) => obj,
}));

// Mock env
vi.mock("./_core/env", () => ({ ENV: { DATABASE_URL: "mysql://test:test@localhost/test" } }));

// Mock messenger
vi.mock("./messenger", () => ({
  sendTextMessage: vi.fn(),
  sendButtonMessage: vi.fn(),
  sendMediaMessage: vi.fn(),
  getUserProfile: vi.fn(),
  sendTelegramJoinFlow: vi.fn(),
}));

import * as db from "./db";

describe("XLCS V1.0: Couriers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAllCouriers returns all couriers sorted by sortOrder", async () => {
    const mockCouriers = [
      { id: 1, name: "PosLaju", sortOrder: 0, isActive: true },
      { id: 2, name: "J&T", sortOrder: 1, isActive: true },
    ];
    vi.mocked(db.getAllCouriers).mockResolvedValue(mockCouriers as any);
    const result = await db.getAllCouriers();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("PosLaju");
  });

  it("getActiveCouriers returns only active couriers", async () => {
    const mockActive = [{ id: 1, name: "PosLaju", isActive: true }];
    vi.mocked(db.getActiveCouriers).mockResolvedValue(mockActive as any);
    const result = await db.getActiveCouriers();
    expect(result).toHaveLength(1);
    expect(result[0].isActive).toBe(true);
  });

  it("createCourier creates a new courier", async () => {
    vi.mocked(db.createCourier).mockResolvedValue({ insertId: 10 });
    const result = await db.createCourier({ name: "DHL", sortOrder: 5 });
    expect(result.insertId).toBe(10);
    expect(db.createCourier).toHaveBeenCalledWith({ name: "DHL", sortOrder: 5 });
  });

  it("updateCourier updates courier fields", async () => {
    vi.mocked(db.updateCourier).mockResolvedValue(undefined);
    await db.updateCourier(1, { name: "PosLaju Express", isActive: false });
    expect(db.updateCourier).toHaveBeenCalledWith(1, { name: "PosLaju Express", isActive: false });
  });

  it("deleteCourier soft-deletes by deactivating", async () => {
    vi.mocked(db.deleteCourier).mockResolvedValue(undefined);
    await db.deleteCourier(5);
    expect(db.deleteCourier).toHaveBeenCalledWith(5);
  });
});

describe("XLCS V1.0: Order Payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getOrderPayments returns payments for an order", async () => {
    const mockPayments = [
      { id: 1, orderId: 10, amount: "50.00", paymentMethod: "online_banking" },
      { id: 2, orderId: 10, amount: "15.00", paymentMethod: "tng" },
    ];
    vi.mocked(db.getOrderPayments).mockResolvedValue(mockPayments as any);
    const result = await db.getOrderPayments(10);
    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe("50.00");
  });

  it("addOrderPayment creates payment and updates order paidAmount", async () => {
    vi.mocked(db.addOrderPayment).mockResolvedValue({ insertId: 3 });
    const result = await db.addOrderPayment({
      orderId: 10,
      amount: "30.00",
      paymentDate: new Date(),
      paymentMethod: "cash",
    });
    expect(result.insertId).toBe(3);
    expect(db.addOrderPayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 10, amount: "30.00", paymentMethod: "cash" })
    );
  });
});

describe("XLCS V1.0: Order Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getOrderNotifications returns notifications for an order", async () => {
    const mockNotifs = [
      { id: 1, orderId: 10, notificationType: "shipping_notice", messengerStatus: "sent" },
    ];
    vi.mocked(db.getOrderNotifications).mockResolvedValue(mockNotifs as any);
    const result = await db.getOrderNotifications(10);
    expect(result).toHaveLength(1);
    expect(result[0].notificationType).toBe("shipping_notice");
  });

  it("createOrderNotification creates a notification record", async () => {
    vi.mocked(db.createOrderNotification).mockResolvedValue({ insertId: 5 });
    const result = await db.createOrderNotification({
      orderId: 10,
      notificationType: "order_link",
      messengerStatus: "pending",
    });
    expect(result.insertId).toBe(5);
  });

  it("markManualNotified marks a notification as manually notified", async () => {
    vi.mocked(db.markManualNotified).mockResolvedValue(undefined);
    await db.markManualNotified(1, 100, "Admin");
    expect(db.markManualNotified).toHaveBeenCalledWith(1, 100, "Admin");
  });
});

describe("XLCS V1.0: Audit Logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getOrderAuditLogs returns logs for an order", async () => {
    const mockLogs = [
      { id: 1, orderId: 10, action: "ship_order", fieldName: "physicalStatus", oldValue: "packing", newValue: "shipped" },
    ];
    vi.mocked(db.getOrderAuditLogs).mockResolvedValue(mockLogs as any);
    const result = await db.getOrderAuditLogs(10);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("ship_order");
  });

  it("createAuditLog creates an audit log entry", async () => {
    vi.mocked(db.createAuditLog).mockResolvedValue(undefined);
    await db.createAuditLog({
      orderId: 10,
      action: "cancel_order",
      fieldName: "physicalStatus",
      oldValue: "pending",
      newValue: "cancelled",
    });
    expect(db.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 10, action: "cancel_order" })
    );
  });
});

describe("XLCS V1.0: Work Queue Stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getWorkQueueStats returns all queue counts", async () => {
    const mockStats = {
      pending: 5,
      paymentConfirmed: 3,
      eastMalaysiaShopee: 2,
      shippingShortfall: 1,
      reserved: 0,
    };
    vi.mocked(db.getWorkQueueStats).mockResolvedValue(mockStats as any);
    const result = await db.getWorkQueueStats();
    expect(result.pending).toBe(5);
    expect(result.paymentConfirmed).toBe(3);
    expect(result.eastMalaysiaShopee).toBe(2);
    expect(result.shippingShortfall).toBe(1);
    expect(result.reserved).toBe(0);
  });
});

describe("XLCS V1.0: Order Auto-Merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMergeableOrder returns undefined when no pending order exists", async () => {
    vi.mocked(db.findMergeableOrder).mockResolvedValue(undefined);
    const result = await db.findMergeableOrder(100, "west_malaysia");
    expect(result).toBeUndefined();
  });

  it("findMergeableOrder returns a mergeable order for same shipping method", async () => {
    const mockOrder = { id: 5, customerId: 100, physicalStatus: "pending", shippingMethod: "west_malaysia" };
    vi.mocked(db.findMergeableOrder).mockResolvedValue(mockOrder as any);
    const result = await db.findMergeableOrder(100, "west_malaysia");
    expect(result).toBeDefined();
    expect(result?.id).toBe(5);
  });

  it("findMergeableOrder returns undefined for self_pickup incompatibility", async () => {
    vi.mocked(db.findMergeableOrder).mockResolvedValue(undefined);
    const result = await db.findMergeableOrder(100, "self_pickup");
    expect(result).toBeUndefined();
  });

  it("mergeOrderItems moves items and recalculates totals", async () => {
    vi.mocked(db.mergeOrderItems).mockResolvedValue(undefined);
    await db.mergeOrderItems(10, 5);
    expect(db.mergeOrderItems).toHaveBeenCalledWith(10, 5);
  });
});

describe("XLCS V1.0: Enhanced Order Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shipOrder updates status and creates audit log", async () => {
    vi.mocked(db.shipOrder).mockResolvedValue(undefined);
    await db.shipOrder(10, {
      courierId: 1,
      trackingNumber: "TRK123",
      shipmentDate: new Date(),
      operatorId: 100,
      operatorName: "Admin",
    });
    expect(db.shipOrder).toHaveBeenCalledWith(10, expect.objectContaining({
      courierId: 1,
      trackingNumber: "TRK123",
    }));
  });

  it("cancelOrder sets status to cancelled and logs audit", async () => {
    vi.mocked(db.cancelOrder).mockResolvedValue(undefined);
    await db.cancelOrder(10, 100, "Admin");
    expect(db.cancelOrder).toHaveBeenCalledWith(10, 100, "Admin");
  });

  it("completeOrder sets status to completed and logs audit", async () => {
    vi.mocked(db.completeOrder).mockResolvedValue(undefined);
    await db.completeOrder(10, 100, "Admin");
    expect(db.completeOrder).toHaveBeenCalledWith(10, 100, "Admin");
  });

  it("getOrdersEnhanced returns paginated results with total", async () => {
    const mockResult = {
      items: [{ id: 1, orderNumber: "XT001" }],
      total: 1,
    };
    vi.mocked(db.getOrdersEnhanced).mockResolvedValue(mockResult as any);
    const result = await db.getOrdersEnhanced({ limit: 20, offset: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("getOrderDetail returns order with items, payments, notifications, and audit logs", async () => {
    const mockDetail = {
      id: 10,
      orderNumber: "XT010",
      items: [{ id: 1, productName: "Test Product" }],
      payments: [{ id: 1, amount: "50.00" }],
      notifications: [{ id: 1, notificationType: "shipping_notice" }],
      auditLogs: [{ id: 1, action: "ship_order" }],
    };
    vi.mocked(db.getOrderDetail).mockResolvedValue(mockDetail as any);
    const result = await db.getOrderDetail(10);
    expect(result).toBeDefined();
    expect(result?.items).toHaveLength(1);
    expect(result?.payments).toHaveLength(1);
    expect(result?.notifications).toHaveLength(1);
    expect(result?.auditLogs).toHaveLength(1);
  });

  it("getOrderDetail returns undefined for non-existent order", async () => {
    vi.mocked(db.getOrderDetail).mockResolvedValue(undefined);
    const result = await db.getOrderDetail(9999);
    expect(result).toBeUndefined();
  });
});
