/**
 * AiProcessingContext - Unified processing trail collector for AI logs.
 *
 * Created when a customer message is received, steps are added by each engine
 * during processing, and finalize() produces a complete AiLog record for storage.
 * Log write failures are caught and do NOT affect message processing.
 */

export interface ProcessingStep {
  step: string;
  label: string;
  detail?: string;
  result?: string;
  ts?: string;
  durationMs?: number;
  ruleId?: number;
  knowledgeId?: number;
  productId?: number;
  flowId?: number;
}

export interface AiLogRecord {
  conversationId: number | null;
  customerId: number | null;
  customerName: string | null;
  platform: string;
  sourceType: string;
  customerMessageId: number | null;
  aiReplyMessageId: number | null;
  customerMessage: string;
  receivedAt: Date;
  aiEnabled: boolean;
  handoverStatus: string;
  processingSteps: ProcessingStep[];
  finalSource: string;
  matchedRuleId?: number;
  matchedKnowledgeId?: number;
  matchedProductId?: number;
  matchedFlowId?: number;
  aiReply: string | null;
  sendStatus: string;
  platformMessageId?: string;
  retryCount: number;
  errorCode?: string;
  errorStage?: string;
  errorMessage?: string;
  isHandover: boolean;
  handoverReason?: string;
  processingTimeMs: number;
}

export class AiProcessingContext {
  private steps: ProcessingStep[] = [];
  private startTime: number;

  // Fields set after finalize
  public finalSource: string = "no_match";
  public matchedRuleId?: number;
  public matchedKnowledgeId?: number;
  public matchedProductId?: number;
  public matchedFlowId?: number;
  public aiReply: string | null = null;
  public sendStatus: string = "not_sent";
  public platformMessageId?: string;
  public retryCount: number = 0;
  public errorCode?: string;
  public errorStage?: string;
  public errorMessage?: string;
  public isHandover: boolean = false;
  public handoverReason?: string;
  public aiReplyMessageId?: number;

  constructor(
    public conversationId: number | null,
    public customerId: number | null,
    public customerName: string | null,
    public platform: string,
    public customerMessageId: number | null,
    public customerMessage: string,
    public aiEnabled: boolean,
    public handoverStatus: string,
  ) {
    this.startTime = Date.now();
    this.addStep("receive", "收到客户消息", `渠道：${platform}`);
    this.addStep(
      "ai_check",
      "AI开启检查",
      aiEnabled ? "通过" : "AI未开启",
      aiEnabled ? "passed" : "skipped",
    );
  }

  addStep(
    step: string,
    label: string,
    detail?: string,
    result?: string,
    extra?: Partial<ProcessingStep>,
  ): void {
    this.steps.push({
      step,
      label,
      detail: detail ? detail.slice(0, 200) : undefined,
      result,
      ts: new Date().toISOString(),
      ...extra,
    });
  }

  /** Record a step with timing */
  timedStep<T>(
    step: string,
    label: string,
    fn: () => T,
    extra?: Partial<ProcessingStep>,
  ): T {
    const t0 = Date.now();
    try {
      const result = fn();
      const durationMs = Date.now() - t0;
      this.addStep(step, label, undefined, undefined, { durationMs, ...extra });
      return result;
    } catch (err: any) {
      const durationMs = Date.now() - t0;
      this.addStep(step, label, `错误: ${err?.message ?? String(err)}`.slice(0, 200), "error", { durationMs, ...extra });
      throw err;
    }
  }

  finalize(): AiLogRecord {
    return {
      conversationId: this.conversationId,
      customerId: this.customerId,
      customerName: this.customerName,
      platform: this.platform,
      sourceType: "private_chat",
      customerMessageId: this.customerMessageId,
      aiReplyMessageId: this.aiReplyMessageId ?? null,
      customerMessage: this.customerMessage.slice(0, 200),
      receivedAt: new Date(this.startTime),
      aiEnabled: this.aiEnabled,
      handoverStatus: this.handoverStatus,
      processingSteps: this.steps,
      finalSource: this.finalSource,
      matchedRuleId: this.matchedRuleId,
      matchedKnowledgeId: this.matchedKnowledgeId,
      matchedProductId: this.matchedProductId,
      matchedFlowId: this.matchedFlowId,
      aiReply: this.aiReply,
      sendStatus: this.sendStatus,
      platformMessageId: this.platformMessageId,
      retryCount: this.retryCount,
      errorCode: this.errorCode,
      errorStage: this.errorStage,
      errorMessage: this.errorMessage,
      isHandover: this.isHandover,
      handoverReason: this.handoverReason,
      processingTimeMs: Date.now() - this.startTime,
    };
  }
}
