import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  quickRestockProduct: vi.fn(),
}));

import { appRouter } from "./routers";
import * as dbMock from "./db";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "quick-restock-test-admin",
      email: "quick-restock@example.com",
      name: "Quick Restock Test Admin",
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

describe("quick restock waiting-restock allocation contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the quantity and exception identifiers automatically allocated after a restock is received", async () => {
    vi.mocked(dbMock.quickRestockProduct).mockResolvedValue({
      poId: 72,
      poNumber: "QR-72",
      quantity: 5,
      stockQuantity: 8,
      allocatedExceptionIds: [301, 302],
      allocatedQuantity: 4,
      unallocatedRestockQuantity: 1,
    } as any);
    const caller = appRouter.createCaller(createAdminContext());

    await expect(caller.purchaseOrders.quickRestock({
      productId: 88,
      supplierId: 9,
      quantity: 5,
      remark: "到货后优先分配等待补货订单",
    })).resolves.toMatchObject({
      allocatedExceptionIds: [301, 302],
      allocatedQuantity: 4,
      unallocatedRestockQuantity: 1,
    });

    expect(dbMock.quickRestockProduct).toHaveBeenCalledWith(expect.objectContaining({
      productId: 88,
      supplierId: 9,
      quantity: 5,
      adjustedBy: "Quick Restock Test Admin",
    }));
  });
});
