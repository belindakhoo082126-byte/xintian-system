import {
  finalizeAiFollowUpDelivery,
  getAiFollowUpPolicyByTaskUid,
  listEligibleAiFollowUpOrders,
  reserveAiFollowUpDelivery,
  updateAiFollowUpPolicy,
} from "./db";
import { sendTextMessage } from "./messenger";

type FollowUpRunSummary = {
  policyId: number | null;
  checked: number;
  reserved: number;
  sent: number;
  skipped: number;
  stopped: number;
  failed: number;
  reason?: string;
};

function asAmount(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderFollowUpTemplate(template: string, candidate: {
  customerName: string | null;
  orderNumber: string;
  totalAmount: unknown;
  paidAmount: unknown;
}) {
  const outstandingAmount = Math.max(0, asAmount(candidate.totalAmount) - asAmount(candidate.paidAmount));
  const values: Record<string, string> = {
    customerName: candidate.customerName?.trim() || "您好",
    orderNumber: candidate.orderNumber,
    outstandingAmount: `RM${outstandingAmount.toFixed(2)}`,
  };
  return template.replace(/{{(customerName|orderNumber|outstandingAmount)}}/g, (_, key: string) => values[key]);
}

/**
 * Runs one persisted policy. The task UID is resolved from the database instead
 * of accepting a policy ID from a request body, so a scheduled callback cannot
 * be redirected to an arbitrary policy. Database uniqueness remains the final
 * guard against duplicate sends when two invocations overlap.
 */
export async function runAiFollowUpPolicyTask(taskUid: string): Promise<FollowUpRunSummary> {
  const policy = await getAiFollowUpPolicyByTaskUid(taskUid);
  if (!policy) return { policyId: null, checked: 0, reserved: 0, sent: 0, skipped: 0, stopped: 0, failed: 0, reason: "policy_not_found" };
  if (!policy.isEnabled) return { policyId: policy.id, checked: 0, reserved: 0, sent: 0, skipped: 0, stopped: 0, failed: 0, reason: "policy_paused" };

  const candidates = await listEligibleAiFollowUpOrders(policy);
  const summary: FollowUpRunSummary = {
    policyId: policy.id,
    checked: candidates.length,
    reserved: 0,
    sent: 0,
    skipped: 0,
    stopped: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    const renderedMessage = renderFollowUpTemplate(policy.messageTemplate, candidate);
    const requiredSkipReason = candidate.skipReason
      ?? (policy.channel === "whatsapp" ? "channel_not_configured" : null);
    const reservation = await reserveAiFollowUpDelivery({
      policyId: policy.id,
      customerId: candidate.customerId,
      conversationId: candidate.conversationId,
      orderId: candidate.orderId,
      channel: policy.channel,
      status: requiredSkipReason ? "skipped" : "pending",
      skipReason: requiredSkipReason,
      message: renderedMessage,
    });

    if (!reservation.isNew) continue;
    summary.reserved += 1;
    if (requiredSkipReason) {
      summary.skipped += 1;
      continue;
    }

    if (!candidate.messengerId) {
      await finalizeAiFollowUpDelivery(reservation.delivery.id, { status: "skipped", skipReason: "missing_channel_identity" });
      summary.skipped += 1;
      continue;
    }

    try {
      const sendResult = await sendTextMessage(candidate.messengerId, renderedMessage);
      await finalizeAiFollowUpDelivery(reservation.delivery.id, {
        status: "sent",
        platformMessageId: typeof sendResult?.message_id === "string" ? sendResult.message_id : null,
        sentAt: new Date(),
      });
      summary.sent += 1;
    } catch (error: any) {
      await finalizeAiFollowUpDelivery(reservation.delivery.id, {
        status: "failed",
        errorMessage: error?.response?.data?.error?.message || error?.message || "messenger_send_failed",
      });
      summary.failed += 1;
    }
  }

  await updateAiFollowUpPolicy(policy.id, { lastRunAt: new Date() });
  return summary;
}

