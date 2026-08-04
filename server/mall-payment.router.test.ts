import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getDb: vi.fn(),
  getPaymentMethodById: vi.fn(),
  transitionOrderStatus: vi.fn(),
  updateOrderStatus: vi.fn(),
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

const validInput = {
  orderNumber: "XT-SAT-PAY-001",
  contactNumber: "0198888001",
  receiptUrl: "/manus-storage/uploads/sat-payment-proof.webp",
  paymentMethodId: 3,
};

const order = {
  id: 501,
  customerId: 701,
  physicalStatus: "pending",
};

const matchingCustomer = {
  id: 701,
  phoneNumber: "0198888001",
};

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as any,
    res: {} as any,
  };
}

function mockOrderAndCustomerQuery(customer = matchingCustomer, orderRecord = order) {
  const limit = vi
    .fn()
    .mockResolvedValueOnce([orderRecord])
    .mockResolvedValueOnce([customer]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  vi.mocked(dbMock.getDb).mockResolvedValue({
    select: vi.fn(() => ({ from })),
  } as any);
}

describe("mall.uploadReceipt authorization and audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMock.getPaymentMethodById).mockResolvedValue({
      id: 3,
      name: "Public Bank Transfer",
      isEnabled: true,
    } as any);
    vi.mocked(dbMock.transitionOrderStatus).mockResolvedValue({} as any);
    vi.mocked(dbMock.updateOrderStatus).mockResolvedValue({} as any);
  });

  it("rejects a payment-proof upload when the supplied phone does not own the order", async () => {
    mockOrderAndCustomerQuery({ ...matchingCustomer, phoneNumber: "0110000000" });

    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.mall.uploadReceipt(validInput)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "订单不存在或联系电话不匹配",
    });
    expect(dbMock.transitionOrderStatus).not.toHaveBeenCalled();
    expect(dbMock.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("rejects arbitrary external receipt URLs before they reach persistence", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.mall.uploadReceipt({
      ...validInput,
      receiptUrl: "https://attacker.example/proof.svg",
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "付款凭证必须来自系统上传服务",
    });
    expect(dbMock.getDb).not.toHaveBeenCalled();
  });

  it("stores the server-authoritative enabled payment method and creates a status audit entry", async () => {
    mockOrderAndCustomerQuery();

    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.mall.uploadReceipt(validInput)).resolves.toEqual({ success: true });
    expect(dbMock.transitionOrderStatus).toHaveBeenCalledWith(
      501,
      "receipt_uploaded",
      "商城顾客",
      "顾客已上传付款凭证"
    );
    expect(dbMock.updateOrderStatus).toHaveBeenCalledWith(501, {
      receiptUrl: validInput.receiptUrl,
      paymentMethodId: 3,
      paymentMethodName: "Public Bank Transfer",
    });
  });

  it("rejects a replayed upload after a receipt has already been submitted", async () => {
    mockOrderAndCustomerQuery(matchingCustomer, { ...order, physicalStatus: "shipped" });

    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.mall.uploadReceipt(validInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "当前订单状态不允许上传付款凭证",
    });
    expect(dbMock.transitionOrderStatus).not.toHaveBeenCalled();
    expect(dbMock.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("rejects a disabled or nonexistent payment method", async () => {
    mockOrderAndCustomerQuery();
    vi.mocked(dbMock.getPaymentMethodById).mockResolvedValue({
      id: 3,
      name: "Disabled method",
      isEnabled: false,
    } as any);

    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.mall.uploadReceipt(validInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "请选择有效的付款方式",
    });
    expect(dbMock.transitionOrderStatus).not.toHaveBeenCalled();
    expect(dbMock.updateOrderStatus).not.toHaveBeenCalled();
  });
});
