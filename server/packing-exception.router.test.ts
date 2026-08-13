import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  updateOrderException: vi.fn(),
  resolveOrderException: vi.fn(),
  allocateRestockedOrderException: vi.fn(),
  cancelOrderException: vi.fn(),
  createOrderExceptionItem: vi.fn(),
  createInventoryAdjustment: vi.fn(),
  recalculateOrderTotals: vi.fn(),
}));

import { appRouter } from "./routers";
import * as dbMock from "./db";

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "packing-exception-test-admin",
      email: "packing-exception@example.com",
      name: "Packing Exception Test Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: {} as any,
  };
}

describe("packing exception router safeguards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("edits a pending exception without creating a new exception or settling inventory", async () => {
    vi.mocked(dbMock.updateOrderException).mockResolvedValue({ id: 31, status: "open" } as any);
    const caller = appRouter.createCaller(createAuthContext());

    await expect(caller.orderException.update({
      exceptionId: 31,
      orderItemId: 88,
      exceptionType: "quality_issue",
      description: "更新后的品质异常说明",
      quantity: 2,
      customerAction: "pending",
    })).resolves.toEqual({ id: 31, status: "open" });

    expect(dbMock.updateOrderException).toHaveBeenCalledWith(31, expect.objectContaining({
      orderItemId: 88,
      quantity: 2,
      customerAction: "pending",
    }));
    expect(dbMock.resolveOrderException).not.toHaveBeenCalled();
  });

  it("accepts a delivery-delay reason as an item-level open exception", async () => {
    vi.mocked(dbMock.updateOrderException).mockResolvedValue({ id: 36, status: "open" } as any);
    const caller = appRouter.createCaller(createAuthContext());

    await expect(caller.orderException.update({
      exceptionId: 36,
      orderItemId: 89,
      exceptionType: "delivery_delay",
      description: "等待供应商下一批到货",
      quantity: 1,
      customerAction: "pending",
    })).resolves.toEqual({ id: 36, status: "open" });

    expect(dbMock.updateOrderException).toHaveBeenCalledWith(36, expect.objectContaining({
      exceptionType: "delivery_delay",
      customerAction: "pending",
    }));
    expect(dbMock.createInventoryAdjustment).not.toHaveBeenCalled();
  });

  it("does not apply legacy replacement side effects when the authoritative replacement product is supplied", async () => {
    vi.mocked(dbMock.resolveOrderException).mockResolvedValue({ id: 32, status: "resolved" } as any);
    const caller = appRouter.createCaller(createAuthContext());

    await expect(caller.orderException.resolve({
      exceptionId: 32,
      orderId: 81,
      resolutionType: "replace",
      customerAction: "replace_product",
      quantity: 1,
      replacementProductId: 902,
      replacementProductName: "MON",
      replacementQuantity: 1,
      replacementUnitPrice: 18,
      replacementItems: [{
        productId: 902,
        productName: "MON",
        quantity: 1,
        unitPrice: 18,
        subtotal: 18,
      }],
    })).resolves.toMatchObject({ success: true });

    expect(dbMock.resolveOrderException).toHaveBeenCalledTimes(1);
    expect(dbMock.createOrderExceptionItem).not.toHaveBeenCalled();
    expect(dbMock.createInventoryAdjustment).not.toHaveBeenCalled();
    expect(dbMock.recalculateOrderTotals).not.toHaveBeenCalled();
  });

  it("closes a waiting-restock exception only through the explicit restock allocation action", async () => {
    vi.mocked(dbMock.allocateRestockedOrderException).mockResolvedValue({
      id: 33,
      status: "resolved",
      waitingForRestock: false,
      closedBy: "Packing Exception Test Admin",
    } as any);
    const caller = appRouter.createCaller(createAuthContext());

    await expect(caller.orderException.markResolved({ exceptionId: 33 })).resolves.toMatchObject({
      success: true,
      exception: { id: 33, waitingForRestock: false },
    });
    expect(dbMock.allocateRestockedOrderException).toHaveBeenCalledWith(33, "Packing Exception Test Admin");
    expect(dbMock.resolveOrderException).not.toHaveBeenCalled();
  });

  it("cancels an open exception through the audit-preserving cancellation path", async () => {
    vi.mocked(dbMock.cancelOrderException).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthContext());

    await expect(caller.orderException.cancel({ exceptionId: 34 })).resolves.toEqual({
      success: true,
      status: "cancelled",
    });

    expect(dbMock.cancelOrderException).toHaveBeenCalledWith(34, "Packing Exception Test Admin");
  });

  it("keeps the legacy delete contract audit-safe by routing it through cancellation", async () => {
    vi.mocked(dbMock.cancelOrderException).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthContext());

    await expect(caller.orderException.delete({ exceptionId: 35 })).resolves.toEqual({
      success: true,
      status: "cancelled",
    });
    expect(dbMock.cancelOrderException).toHaveBeenCalledWith(35, "Packing Exception Test Admin");
  });
});
