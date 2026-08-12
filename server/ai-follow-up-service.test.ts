import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    finalizeAiFollowUpDelivery: vi.fn(),
    getAiFollowUpPolicyByTaskUid: vi.fn(),
    listEligibleAiFollowUpOrders: vi.fn(),
    reserveAiFollowUpDelivery: vi.fn(),
    updateAiFollowUpPolicy: vi.fn(),
  },
  sendTextMessage: vi.fn(),
}));

vi.mock("./db", () => mocks.db);
vi.mock("./messenger", () => ({ sendTextMessage: mocks.sendTextMessage }));

import { runAiFollowUpPolicyTask } from "./aiFollowUpService";

const activePolicy = {
  id: 8,
  isEnabled: true,
  channel: "messenger" as const,
  messageTemplate: "{{customerName}}，订单 {{orderNumber}} 尚欠 {{outstandingAmount}}。",
};

const candidate = {
  customerId: 11,
  conversationId: 22,
  orderId: 33,
  customerName: "小敏",
  orderNumber: "XT-00033",
  totalAmount: "150",
  paidAmount: "20",
  messengerId: "psid-11",
  skipReason: null,
};

describe("AI 自动跟进安全执行", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.getAiFollowUpPolicyByTaskUid.mockResolvedValue(activePolicy);
    mocks.db.listEligibleAiFollowUpOrders.mockResolvedValue([candidate]);
    mocks.db.reserveAiFollowUpDelivery.mockResolvedValue({ delivery: { id: 99 }, isNew: true });
    mocks.sendTextMessage.mockResolvedValue({ message_id: "mid.99" });
  });

  it("策略默认暂停时绝不查询候选或发送客户消息", async () => {
    mocks.db.getAiFollowUpPolicyByTaskUid.mockResolvedValue({ ...activePolicy, isEnabled: false });

    const result = await runAiFollowUpPolicyTask("task-paused");

    expect(result.reason).toBe("policy_paused");
    expect(mocks.db.listEligibleAiFollowUpOrders).not.toHaveBeenCalled();
    expect(mocks.sendTextMessage).not.toHaveBeenCalled();
  });

  it("人工接管或停止条件已筛出的候选只记录跳过，不会发送", async () => {
    mocks.db.listEligibleAiFollowUpOrders.mockResolvedValue([{ ...candidate, skipReason: "human_handover" }]);

    const result = await runAiFollowUpPolicyTask("task-safe-skip");

    expect(result).toMatchObject({ reserved: 1, skipped: 1, sent: 0 });
    expect(mocks.db.reserveAiFollowUpDelivery).toHaveBeenCalledWith(expect.objectContaining({
      status: "skipped",
      skipReason: "human_handover",
    }));
    expect(mocks.sendTextMessage).not.toHaveBeenCalled();
  });

  it("数据库唯一预约拒绝重复投递时不会再次发送", async () => {
    mocks.db.reserveAiFollowUpDelivery.mockResolvedValue({ delivery: { id: 99 }, isNew: false });

    const result = await runAiFollowUpPolicyTask("task-duplicate");

    expect(result).toMatchObject({ checked: 1, reserved: 0, sent: 0 });
    expect(mocks.sendTextMessage).not.toHaveBeenCalled();
  });

  it("仅在可发送且首次预约时发送，并写入可审计的投递结果", async () => {
    const result = await runAiFollowUpPolicyTask("task-send-once");

    expect(result).toMatchObject({ checked: 1, reserved: 1, sent: 1, failed: 0 });
    expect(mocks.sendTextMessage).toHaveBeenCalledWith("psid-11", "小敏，订单 XT-00033 尚欠 RM130.00。");
    expect(mocks.db.finalizeAiFollowUpDelivery).toHaveBeenCalledWith(99, expect.objectContaining({
      status: "sent",
      platformMessageId: "mid.99",
    }));
  });
});
