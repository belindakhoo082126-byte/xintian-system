import { describe, it, expect } from "vitest";
import { classifyIntent, generateHandoverSummary } from "./businessAi";

describe("Business AI — Intent Classification", () => {
  it("classifies shipment tracking intent", () => {
    const result = classifyIntent("我的包裹到哪里了？");
    expect(result.intent).toBe("shipment_tracking");
    expect(result.workflow).toBe("shipping_api");
  });

  it("classifies parcel issue as mandatory handover", () => {
    const result = classifyIntent("我的植物损坏了");
    expect(result.intent).toBe("parcel_issue");
    expect(result.shouldHandover).toBe(true);
    expect(result.workflow).toBe("human_handover");
  });

  it("classifies complaint as mandatory handover", () => {
    const result = classifyIntent("我要投诉，服务太差了");
    expect(result.intent).toBe("complaint");
    expect(result.shouldHandover).toBe(true);
  });

  it("classifies refund as mandatory handover", () => {
    const result = classifyIntent("我要退款");
    expect(result.intent).toBe("refund");
    expect(result.shouldHandover).toBe(true);
  });

  it("classifies order modification intent", () => {
    const result = classifyIntent("我要改地址");
    expect(result.intent).toBe("order_modification");
    expect(result.workflow).toBe("change_request");
  });

  it("classifies order status query", () => {
    const result = classifyIntent("我的订单怎样了？");
    expect(result.intent).toBe("order_status");
    expect(result.workflow).toBe("query_order");
  });

  it("classifies new order intent", () => {
    const result = classifyIntent("我要买这棵植物");
    expect(result.intent).toBe("new_order");
    expect(result.workflow).toBe("draft_order");
  });

  it("classifies membership inquiry", () => {
    const result = classifyIntent("如何加入会员？");
    expect(result.intent).toBe("membership");
    expect(result.workflow).toBe("ai_reply");
  });

  it("classifies product inquiry", () => {
    const result = classifyIntent("这棵花怎么养护？");
    expect(result.intent).toBe("product_inquiry");
    expect(result.workflow).toBe("product_match");
  });

  it("classifies human assistance request", () => {
    const result = classifyIntent("请转人工客服");
    expect(result.intent).toBe("human_assistance");
    expect(result.shouldHandover).toBe(true);
  });

  it("classifies cooperation as mandatory handover", () => {
    const result = classifyIntent("我想和你们合作批发");
    expect(result.intent).toBe("cooperation");
    expect(result.shouldHandover).toBe(true);
  });

  it("returns other for unrecognized messages", () => {
    const result = classifyIntent("今天天气很好啊");
    expect(result.intent).toBe("other");
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });

  it("handles English messages", () => {
    const result = classifyIntent("Where is my parcel?");
    expect(result.intent).toBe("shipment_tracking");
  });

  it("handles Malay messages", () => {
    const result = classifyIntent("Parcel saya sampai mana?");
    expect(result.intent).toBe("shipment_tracking");
  });
});

describe("Business AI — Handover Summary", () => {
  it("generates high priority for parcel issues", () => {
    const summary = generateHandoverSummary({
      customerName: "张三",
      customerMessage: "我的植物坏了",
      reason: "包裹损坏，需人工处理",
      detectedIntent: "parcel_issue",
      aiAction: "AI识别到包裹损坏，转人工处理",
    });
    expect(summary.priority).toBe("high");
    expect(summary.detectedIntent).toBe("parcel_issue");
    expect(summary.suggestedNextAction).toContain("快递公司");
  });

  it("generates high priority for complaints", () => {
    const summary = generateHandoverSummary({
      customerName: "李四",
      customerMessage: "服务太差了",
      reason: "客户投诉",
      detectedIntent: "complaint",
      aiAction: "AI识别到投诉，转人工处理",
    });
    expect(summary.priority).toBe("high");
    expect(summary.suggestedNextAction).toContain("投诉");
  });

  it("generates high priority for refunds", () => {
    const summary = generateHandoverSummary({
      customerName: "王五",
      customerMessage: "我要退款",
      reason: "客户要求退款",
      detectedIntent: "refund",
      aiAction: "AI识别到退款请求，转人工处理",
    });
    expect(summary.priority).toBe("high");
    expect(summary.suggestedNextAction).toContain("退款");
  });

  it("generates normal priority for general inquiries", () => {
    const summary = generateHandoverSummary({
      customerName: "赵六",
      customerMessage: "请问运费多少",
      reason: "AI无法匹配",
      detectedIntent: "other",
      aiAction: "AI无法回答，转人工",
    });
    expect(summary.priority).toBe("normal");
  });

  it("includes related order info when provided", () => {
    const summary = generateHandoverSummary({
      customerName: "客户A",
      customerMessage: "我的订单还没到",
      reason: "物流查询",
      detectedIntent: "shipment_tracking",
      aiAction: "AI查询物流状态",
      relatedOrder: { orderNumber: "XT10050", status: "shipped" },
    });
    expect(summary.relatedOrder?.orderNumber).toBe("XT10050");
    expect(summary.suggestedNextAction).toContain("物流");
  });
});

describe("Business AI — Router Structure", () => {
  it("appRouter should have draftOrders router", async () => {
    const mod = await import("./routers");
    const router = mod.appRouter as any;
    expect(router).toBeDefined();
    const procKeys = Object.keys(router._def?.procedures || {});
    expect(procKeys.some(k => k.startsWith("draftOrders."))).toBe(true);
  });

  it("appRouter should have orderChangeRequests router", async () => {
    const mod = await import("./routers");
    const router = mod.appRouter as any;
    const procKeys = Object.keys(router._def?.procedures || {});
    expect(procKeys.some(k => k.startsWith("orderChangeRequests."))).toBe(true);
  });

  it("appRouter should have reservations router", async () => {
    const mod = await import("./routers");
    const router = mod.appRouter as any;
    const procKeys = Object.keys(router._def?.procedures || {});
    expect(procKeys.some(k => k.startsWith("reservations."))).toBe(true);
  });

  it("appRouter should have aiLogistics router", async () => {
    const mod = await import("./routers");
    const router = mod.appRouter as any;
    const procKeys = Object.keys(router._def?.procedures || {});
    expect(procKeys.some(k => k.startsWith("aiLogistics."))).toBe(true);
  });
});
