import { randomUUID } from "crypto";
import {
  claimMarketingMessageDelivery,
  getMarketingAutomationRuleById,
  getMarketingAutomationRuleByScheduleTaskUid,
  getMarketingMessageTemplateById,
  resolveMarketingSegmentCustomers,
  updateMarketingAutomationRule,
  updateMarketingMessageDelivery,
} from "./db";
import { sendTextMessage } from "./messenger";

const MESSENGER_WINDOW_MS = 24 * 60 * 60 * 1000;

function renderTemplate(content: string, customer: { name: string | null; displayName: string | null; customerId: string }, campaignName?: string | null) {
  const customerName = customer.displayName || customer.name || customer.customerId || "顾客";
  return content
    .replaceAll("{{customer_name}}", customerName)
    .replaceAll("{{campaign_name}}", campaignName || "心田精选活动")
    .replaceAll("{{shop_url}}", "https://www.xintian.com.my");
}

function canSendMessengerAutomatically(customer: { messengerId: string | null; lastInteractionAt: Date | null }) {
  return Boolean(customer.messengerId && customer.lastInteractionAt && Date.now() - customer.lastInteractionAt.getTime() <= MESSENGER_WINDOW_MS);
}

export type MarketingAutomationRunSummary = {
  ruleId: number;
  queued: number;
  sent: number;
  manualCopy: number;
  failed: number;
  skipped: number;
  deliveryIds: number[];
};

/**
 * Runs an administrator-enabled marketing rule. It never sends to blacklisted
 * customers, never bypasses Messenger's 24-hour interaction window, and logs
 * every planned or attempted delivery before a provider call is made.
 */
export async function runMarketingAutomationRule(input: {
  ruleId: number;
  customerIds?: number[];
  dryRun?: boolean;
  /** Enables read-only validation for rules that have not been activated yet. */
  allowPausedDryRun?: boolean;
  limit?: number;
}) : Promise<MarketingAutomationRunSummary> {
  const rule = await getMarketingAutomationRuleById(input.ruleId);
  if (!rule) throw new Error("营销自动规则不存在");
  if (rule.status !== "active" && !(input.dryRun && input.allowPausedDryRun)) throw new Error("营销自动规则目前已暂停，管理员启用后才可发送");
  const template = await getMarketingMessageTemplateById(rule.templateId);
  if (!template?.isActive) throw new Error("营销消息模板不存在或未启用");
  const customers = await resolveMarketingSegmentCustomers({
    segmentId: rule.segmentId,
    customerIds: input.customerIds,
    limit: Math.min(Math.max(input.limit || 100, 1), 500),
  });
  const summary: MarketingAutomationRunSummary = { ruleId: rule.id, queued: 0, sent: 0, manualCopy: 0, failed: 0, skipped: 0, deliveryIds: [] };

  for (const customer of customers) {
    const renderedContent = renderTemplate(template.content, customer, null);
    const automaticSend = template.channel === "messenger" && canSendMessengerAutomatically(customer);
    if (input.dryRun) {
      automaticSend ? summary.queued++ : summary.manualCopy++;
      continue;
    }
    const claim = await claimMarketingMessageDelivery({
      automationRuleId: rule.id,
      campaignId: rule.campaignId,
      templateId: template.id,
      customerId: customer.id,
      channel: automaticSend ? "messenger" : "manual_copy",
      status: automaticSend ? "queued" : "skipped",
      renderedContent,
      trackingToken: randomUUID().replaceAll("-", ""),
      errorMessage: automaticSend ? null : "无近期 Messenger 互动窗口，已保留为手动发送文案",
    });
    if (!claim.claimed) {
      summary.skipped++;
      continue;
    }
    const deliveryId = claim.deliveryId;
    summary.deliveryIds.push(deliveryId);
    if (!automaticSend) {
      summary.manualCopy++;
      continue;
    }
    summary.queued++;
    try {
      const result = await sendTextMessage(customer.messengerId!, renderedContent);
      await updateMarketingMessageDelivery({ deliveryId, status: "sent", providerMessageId: result?.message_id || null });
      summary.sent++;
    } catch (error) {
      await updateMarketingMessageDelivery({ deliveryId, status: "failed", errorMessage: error instanceof Error ? error.message : "Messenger 发送失败" });
      summary.failed++;
    }
  }
  if (!input.dryRun) {
    await updateMarketingAutomationRule(rule.id, {
      lastRunAt: new Date(),
      ...(rule.scheduleType === "once" ? { status: "paused" as const } : {}),
    });
  }
  return summary;
}

/**
 * Heartbeat callbacks do not trust request bodies. The authenticated task UID
 * is resolved to its stored rule before any customer data is selected or sent.
 */
export async function runMarketingAutomationHeartbeat(taskUid: string) {
  const rule = await getMarketingAutomationRuleByScheduleTaskUid(taskUid);
  if (!rule) return { ok: true as const, skipped: "orphan" as const };
  if (rule.status !== "active") return { ok: true as const, skipped: "paused" as const, ruleId: rule.id };
  const summary = await runMarketingAutomationRule({ ruleId: rule.id });
  return { ok: true as const, ...summary };
}

export const marketingMessagingSafety = {
  messengerWindowMs: MESSENGER_WINDOW_MS,
  canSendMessengerAutomatically,
  renderTemplate,
};
