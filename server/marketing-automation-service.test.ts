import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuleById: vi.fn(),
  getRuleByTask: vi.fn(),
  getTemplate: vi.fn(),
  resolveCustomers: vi.fn(),
  claimDelivery: vi.fn(),
  updateDelivery: vi.fn(),
  updateRule: vi.fn(),
  sendText: vi.fn(),
}));

vi.mock("./db", () => ({
  getMarketingAutomationRuleById: mocks.getRuleById,
  getMarketingAutomationRuleByScheduleTaskUid: mocks.getRuleByTask,
  getMarketingMessageTemplateById: mocks.getTemplate,
  resolveMarketingSegmentCustomers: mocks.resolveCustomers,
  claimMarketingMessageDelivery: mocks.claimDelivery,
  updateMarketingMessageDelivery: mocks.updateDelivery,
  updateMarketingAutomationRule: mocks.updateRule,
}));
vi.mock("./messenger", () => ({ sendTextMessage: mocks.sendText }));

import { runMarketingAutomationHeartbeat, runMarketingAutomationRule } from "./marketingAutomationService";

const activeRule = { id: 22, templateId: 9, campaignId: null, segmentId: null, status: "active", scheduleType: "cron" };
const messengerTemplate = { id: 9, content: "您好 {{customer_name}}，欢迎 {{campaign_name}}：{{shop_url}}", channel: "messenger", isActive: true };
const currentCustomer = { id: 7, name: "王小明", displayName: null, customerId: "CUS00007", messengerId: "m-7", lastInteractionAt: new Date() };

describe("marketingAutomationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRuleById.mockResolvedValue(activeRule);
    mocks.getTemplate.mockResolvedValue(messengerTemplate);
    mocks.resolveCustomers.mockResolvedValue([currentCustomer]);
    mocks.claimDelivery.mockResolvedValue({ claimed: true, deliveryId: 31 });
    mocks.sendText.mockResolvedValue({ message_id: "provider-31" });
  });

  it("rejects a paused rule before selecting or contacting any customer", async () => {
    mocks.getRuleById.mockResolvedValue({ ...activeRule, status: "paused" });
    await expect(runMarketingAutomationRule({ ruleId: 22 })).rejects.toThrow("已暂停");
    expect(mocks.resolveCustomers).not.toHaveBeenCalled();
    expect(mocks.sendText).not.toHaveBeenCalled();
  });

  it("allows a paused rule to run a read-only preflight without delivery audit or provider sending", async () => {
    mocks.getRuleById.mockResolvedValue({ ...activeRule, status: "paused" });
    const result = await runMarketingAutomationRule({ ruleId: 22, dryRun: true, allowPausedDryRun: true });
    expect(result).toMatchObject({ ruleId: 22, queued: 1, sent: 0, manualCopy: 0, deliveryIds: [] });
    expect(mocks.claimDelivery).not.toHaveBeenCalled();
    expect(mocks.sendText).not.toHaveBeenCalled();
    expect(mocks.updateRule).not.toHaveBeenCalled();
  });

  it("sends only within the Messenger interaction window and writes delivery audit data", async () => {
    const result = await runMarketingAutomationRule({ ruleId: 22 });
    expect(result).toMatchObject({ queued: 1, sent: 1, manualCopy: 0, failed: 0, deliveryIds: [31] });
    expect(mocks.claimDelivery).toHaveBeenCalledWith(expect.objectContaining({ customerId: 7, channel: "messenger", status: "queued" }));
    expect(mocks.sendText).toHaveBeenCalledWith("m-7", expect.stringContaining("王小明"));
    expect(mocks.updateDelivery).toHaveBeenCalledWith(expect.objectContaining({ deliveryId: 31, status: "sent", providerMessageId: "provider-31" }));
  });

  it("keeps expired Messenger contacts as audited manual-copy work without provider delivery", async () => {
    mocks.resolveCustomers.mockResolvedValue([{ ...currentCustomer, lastInteractionAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }]);
    const result = await runMarketingAutomationRule({ ruleId: 22 });
    expect(result).toMatchObject({ sent: 0, manualCopy: 1, failed: 0 });
    expect(mocks.claimDelivery).toHaveBeenCalledWith(expect.objectContaining({ channel: "manual_copy", status: "skipped" }));
    expect(mocks.sendText).not.toHaveBeenCalled();
  });

  it("short-circuits duplicate delivery claims before a second provider send", async () => {
    mocks.claimDelivery.mockResolvedValue({ claimed: false, deliveryId: 31 });
    const result = await runMarketingAutomationRule({ ruleId: 22 });
    expect(result).toMatchObject({ skipped: 1, sent: 0 });
    expect(mocks.sendText).not.toHaveBeenCalled();
  });

  it("uses the authenticated heartbeat task UID to find a stored active rule", async () => {
    mocks.getRuleByTask.mockResolvedValue(activeRule);
    const result = await runMarketingAutomationHeartbeat("trusted-task-uid");
    expect(mocks.getRuleByTask).toHaveBeenCalledWith("trusted-task-uid");
    expect(result).toMatchObject({ ok: true, ruleId: 22, sent: 1 });
  });
});
