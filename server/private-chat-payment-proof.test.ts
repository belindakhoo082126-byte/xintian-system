import { beforeEach, describe, expect, it, vi } from "vitest";

let eligibleOrders: any[] = [];

const dbSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      orderBy: vi.fn(async () => eligibleOrders),
    })),
  })),
}));
const database = { select: dbSelect };

vi.mock("./db", () => ({
  getDb: vi.fn(async () => database),
  transitionOrderStatus: vi.fn(),
  updateOrderStatus: vi.fn(),
  addOrderPayment: vi.fn(),
}));

vi.mock("./businessAi", () => ({
  createDraftOrder: vi.fn(),
  createOrderChangeRequest: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import { addOrderPayment, transitionOrderStatus, updateOrderStatus } from "./db";
import { storagePut } from "./storage";
import { captureMessengerPaymentProof } from "./privateChatOrderActions";

const eligibleOrder = {
  id: 105,
  customerId: 88,
  orderNumber: "XT00105",
  physicalStatus: "pending",
  paidAmount: "0.00",
  receiptUrl: null,
  paymentUploadedAt: null,
  createdAt: new Date(),
};

describe("captureMessengerPaymentProof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eligibleOrders = [eligibleOrder];
    vi.mocked(storagePut).mockResolvedValue({ key: "payment-proofs/messenger/XT00105.jpg", url: "/manus-storage/payment-proofs/messenger/XT00105.jpg" } as any);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      headers: { get: (key: string) => key === "content-type" ? "image/jpeg" : "2048" },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    })));
  });

  it("stores a Messenger image then creates a pending customer-upload payment record", async () => {
    const result = await captureMessengerPaymentProof({
      imageUrl: "https://graph.facebook.com/proof.jpg",
      message: "XT00105 汇款 RM 123.45",
      customerId: 88,
      conversationId: 7,
      customerMessageId: 19,
    });

    expect(result).toMatchObject({ handled: true, shouldHandover: false });
    expect(storagePut).toHaveBeenCalledWith(expect.stringMatching(/^payment-proofs\/messenger\/XT00105-/), expect.any(Buffer), "image/jpeg");
    expect(transitionOrderStatus).toHaveBeenCalledWith(105, "receipt_uploaded", "Messenger 私聊", "客户通过 Messenger 上传付款凭据");
    expect(updateOrderStatus).toHaveBeenCalledWith(105, { receiptUrl: "/manus-storage/payment-proofs/messenger/XT00105.jpg" });
    expect(addOrderPayment).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 105,
      amount: "123.45",
      paymentSource: "customer_upload",
      receiptUrl: "/manus-storage/payment-proofs/messenger/XT00105.jpg",
    }));
    expect(result.reply).toContain("待审核");
  });

  it("does not download, store, or create a payment record when the customer has multiple eligible orders", async () => {
    eligibleOrders = [eligibleOrder, { ...eligibleOrder, id: 106, orderNumber: "XT00106" }];
    const result = await captureMessengerPaymentProof({
      imageUrl: "https://graph.facebook.com/proof.jpg",
      message: "这是我的汇款截图",
      customerId: 88,
    });

    expect(result).toMatchObject({ handled: true, shouldHandover: true });
    expect(result.handoverReason).toContain("多张可处理订单");
    expect(fetch).not.toHaveBeenCalled();
    expect(storagePut).not.toHaveBeenCalled();
    expect(addOrderPayment).not.toHaveBeenCalled();
  });
});
