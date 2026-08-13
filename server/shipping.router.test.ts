import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  fullShipping: vi.fn(),
  partialShipping: vi.fn(),
  getOrderById: vi.fn(),
  getCustomerById: vi.fn(),
  getSystemSettings: vi.fn(),
  updateOrderNotificationStatus: vi.fn(),
  createNotificationLog: vi.fn(),
}));

vi.mock("./shippingProvider", () => ({
  parcelDailyProvider: {
    isConfigured: true,
    createShipment: vi.fn(),
    checkoutShipment: vi.fn(),
    getConsignmentNote: vi.fn(),
  },
}));

vi.mock("./parcelking", () => ({
  ParcelKingError: class ParcelKingError extends Error {},
  isParcelKingConfigured: vi.fn(),
  normalizePhone: vi.fn(),
  createOrder: vi.fn(),
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
import * as parcelkingMock from "./parcelking";
import * as shippingProviderMock from "./shippingProvider";

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

  it("routes Parcel Daily AWB, tracking, weight and actual fee through fullShipping", async () => {
    vi.mocked(dbMock.getOrderById).mockResolvedValue({
      id: 90001, orderNumber: "XT90001", customerId: 30001, shippingMethod: "west_malaysia", actualShippingFee: "18.50", totalAmount: "200",
    } as any);
    vi.mocked(dbMock.getCustomerById).mockResolvedValue({
      id: 30001, name: "收件客户", phoneNumber: "0123456789", address: "Jalan Test 1", postalCode: "11700", messengerId: null,
    } as any);
    vi.mocked(dbMock.getSystemSettings).mockResolvedValue({
      defaultShipFromName: "Xintian", defaultShipFromPhone: "0124311232", defaultShipFromAddress: "No 31, Jalan Pantai Jerjak 5", defaultShipFromPostcode: "11700",
    } as any);
    vi.mocked(shippingProviderMock.parcelDailyProvider.createShipment).mockResolvedValue({ providerOrderId: "PD-ORDER-1" } as any);
    vi.mocked(shippingProviderMock.parcelDailyProvider.checkoutShipment).mockResolvedValue({ trackingNumber: "PD-TRACK-1", shippingCost: 18.5 } as any);
    vi.mocked(shippingProviderMock.parcelDailyProvider.getConsignmentNote).mockResolvedValue({ url: "https://awb.example/PD-TRACK-1.pdf" } as any);
    vi.mocked(dbMock.fullShipping).mockResolvedValue({ success: true } as any);

    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.shipping.autoShipParcelDaily({ orderId: 90001, actualWeight: 2.5, mode: "full" })).resolves.toMatchObject({
      success: true, trackingNumber: "PD-TRACK-1", shippingLabelUrl: "https://awb.example/PD-TRACK-1.pdf",
    });

    expect(dbMock.fullShipping).toHaveBeenCalledWith(90001, [expect.objectContaining({
      courier: "Line Clear", trackingNumber: "PD-TRACK-1", shippingLabelUrl: "https://awb.example/PD-TRACK-1.pdf", weight: "2.5", shippingCost: "18.50",
    })]);
  });

  it("routes Parcel King label, tracking, weight and final fee through fullShipping", async () => {
    vi.mocked(parcelkingMock.isParcelKingConfigured).mockReturnValue(true);
    vi.mocked(parcelkingMock.normalizePhone).mockReturnValue({ dial_code: "+60", mobile: "123456789" } as any);
    vi.mocked(dbMock.getOrderById).mockResolvedValue({
      id: 90002, orderNumber: "XT90002", customerId: 30002, shippingMethod: "west_malaysia", shippingAddress: "Jalan Test 2", totalAmount: "200",
    } as any);
    vi.mocked(dbMock.getCustomerById).mockResolvedValue({
      id: 30002, name: "客户乙", phoneNumber: "0123456789", address: "Jalan Test 2", postalCode: "11700", messengerId: null,
    } as any);
    vi.mocked(dbMock.getSystemSettings).mockResolvedValue({
      defaultShipFromName: "Xintian", defaultShipFromPhone: "0124311232", defaultShipFromAddress: "No 31, Jalan Pantai Jerjak 5", defaultShipFromPostcode: "11700", notifyOnShipment: false,
    } as any);
    vi.mocked(parcelkingMock.createOrder).mockResolvedValue({ result: { tracking_no: "PK-TRACK-1", label_url: "https://awb.example/PK-TRACK-1.pdf", final_amount: 99.4 } } as any);
    vi.mocked(dbMock.fullShipping).mockResolvedValue({ success: true } as any);

    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.shipping.createParcelKing({ orderId: 90002, serviceId: 77, weightKg: 8 })).resolves.toMatchObject({ success: true });

    expect(dbMock.fullShipping).toHaveBeenCalledWith(90002, [expect.objectContaining({
      courier: "ParcelKing #77", trackingNumber: "PK-TRACK-1", shippingLabelUrl: "https://awb.example/PK-TRACK-1.pdf", weight: "8", shippingCost: "99.4",
    })]);
  });
});
