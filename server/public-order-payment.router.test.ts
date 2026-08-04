import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getOrderBySecureToken: vi.fn(),
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
  orderNumber: "XT00001",
  token: "a".repeat(64),
  receiptUrl: "/manus-storage/uploads/customer/receipt.webp",
  paymentMethodId: 7,
};

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as any,
    res: {} as any,
  };
}

describe("publicOrder.submitPaymentReceipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMock.getOrderBySecureToken).mockResolvedValue({
      id: 501,
      physicalStatus: "pending",
    } as any);
    vi.mocked(dbMock.getPaymentMethodById).mockResolvedValue({
      id: 7,
      name: "Public Bank Transfer",
      isEnabled: true,
    } as any);
    vi.mocked(dbMock.transitionOrderStatus).mockResolvedValue({} as any);
    vi.mocked(dbMock.updateOrderStatus).mockResolvedValue({} as any);
  });

  it("拒绝系统存储以外的付款凭证链接", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.publicOrder.submitPaymentReceipt({
      ...validInput,
      receiptUrl: "https://attacker.example/receipt.png",
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "付款凭证必须来自系统上传服务",
    });
    expect(dbMock.getOrderBySecureToken).not.toHaveBeenCalled();
  });

  it("使用有效安全令牌写入服务器确认的付款方式并记录审核状态", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.publicOrder.submitPaymentReceipt(validInput)).resolves.toEqual({ success: true });
    expect(dbMock.transitionOrderStatus).toHaveBeenCalledWith(
      501,
      "receipt_uploaded",
      "客户结单页",
      "客户已上传付款凭证"
    );
    expect(dbMock.updateOrderStatus).toHaveBeenCalledWith(501, {
      receiptUrl: validInput.receiptUrl,
      paymentMethodId: 7,
      paymentMethodName: "Public Bank Transfer",
    });
  });

  it("拒绝已提交付款凭证的订单再次上传", async () => {
    vi.mocked(dbMock.getOrderBySecureToken).mockResolvedValue({
      id: 501,
      physicalStatus: "receipt_uploaded",
    } as any);
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.publicOrder.submitPaymentReceipt(validInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "当前订单状态不允许上传付款凭证",
    });
    expect(dbMock.transitionOrderStatus).not.toHaveBeenCalled();
  });
});
