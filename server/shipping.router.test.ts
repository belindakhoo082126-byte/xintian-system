import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  fullShipping: vi.fn(),
  partialShipping: vi.fn(),
}));

vi.mock("./messenger", () => ({
  sendTextMessage: vi.fn(),
  sendButtonMessage: vi.fn(),
  sendMediaMessage: vi.fn(),
  sendTemplateMessage: vi.fn(),
  sendMembershipFlow: vi.fn(),
  sendTelegramJoinFlow: vi.fn(),
  getUserProfile: vi.fn(),
}));

import { appRouter } from "./routers";
import * as dbMock from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "admin" | "user" = "admin"): TrpcContext {
  const isAdmin = role === "admin";
  const user: AuthenticatedUser = {
    id: isAdmin ? 1 : 2,
    openId: isAdmin ? "shipping-test-admin" : "shipping-test-staff",
    email: isAdmin ? "shipping-test@example.com" : "shipping-staff@example.com",
    name: isAdmin ? "Shipping Test Admin" : "Shipping Test Staff",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as any,
    res: {} as any,
  };
}

const fullShipmentInput = {
  orderId: 90001,
  packages: [{
    courier: "Parcel Daily",
    shippingType: "manual" as const,
    trackingNumber: "SAT-TRACK-001",
    weight: "1",
  }],
};

const partialShipmentInput = {
  orderId: 90001,
  itemIds: [1001],
  itemQuantities: [{ itemId: "1001", quantity: 1 }],
  packageData: {
    courier: "Parcel Daily",
    shippingType: "manual" as const,
    trackingNumber: "SAT-TRACK-002",
    weight: "1",
  },
};

describe("shipping router safety checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a business rejection instead of 500 when an already shipped order is submitted for full shipment", async () => {
    vi.mocked(dbMock.fullShipping).mockRejectedValue(
      new Error("PACKING_ORDER_NOT_READY_FOR_FULL_SHIPMENT")
    );

    const caller = appRouter.createCaller(createAuthContext());

    await expect(caller.shipping.fullShip(fullShipmentInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "订单当前状态不可完整发货",
    });
  });

  it("rejects a partial-shipment request that contains an item from another order", async () => {
    vi.mocked(dbMock.partialShipping).mockRejectedValue(
      new Error("PACKING_ITEM_NOT_IN_ORDER")
    );

    const caller = appRouter.createCaller(createAuthContext());

    await expect(caller.shipping.partialShip(partialShipmentInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "所选商品不属于此订单",
    });
  });

  it("allows Shipping Staff to use the packing shipment white list but blocks admin product APIs", async () => {
    vi.mocked(dbMock.fullShipping).mockResolvedValue({ success: true });

    const staffCaller = appRouter.createCaller(createAuthContext("user"));

    await expect(staffCaller.shipping.fullShip(fullShipmentInput)).resolves.toEqual({ success: true });
    await expect(staffCaller.products.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("passes valid shipment requests through to the service layer", async () => {
    vi.mocked(dbMock.fullShipping).mockResolvedValue({ success: true });
    vi.mocked(dbMock.partialShipping).mockResolvedValue({ success: true, allShipped: false });

    const caller = appRouter.createCaller(createAuthContext());

    await expect(caller.shipping.fullShip(fullShipmentInput)).resolves.toEqual({ success: true });
    await expect(caller.shipping.partialShip(partialShipmentInput)).resolves.toEqual({
      success: true,
      allShipped: false,
    });
    expect(dbMock.fullShipping).toHaveBeenCalledWith(90001, fullShipmentInput.packages);
    expect(dbMock.partialShipping).toHaveBeenCalledWith(
      90001,
      partialShipmentInput.itemIds,
      partialShipmentInput.packageData,
      partialShipmentInput.itemQuantities
    );
  });
});
