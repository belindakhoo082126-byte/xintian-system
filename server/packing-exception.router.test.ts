import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  updateOrderException: vi.fn(),
  resolveOrderException: vi.fn(),
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
});
