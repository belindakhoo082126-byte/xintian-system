import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db to prevent real database calls
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock aiTestRunner SideEffectPolicy
vi.mock("./aiTestRunner", () => ({
  SideEffectPolicy: { allowAll: { allowSend: false, allowCreateConversation: false, allowCreateMessage: false, allowCreateHandover: false, allowModifyUsage: false, allowCreateOrder: false, allowCreateNotification: false, allowCreateFlow: false, allowWriteAiLog: false } },
}));

import { processChatAI } from "./aiEngines";
import { classifyIntent } from "./businessAi";

describe("classifyIntent Integration in processChatAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processChatAI should include detectedIntent in ai_disabled result", async () => {
    const result = await processChatAI(
      { text: "请问运费多少？", platform: "messenger" },
      { aiEnabled: false, handoverStatus: "none" }
    );
    expect(result.source).toBe("ai_disabled");
    expect(result.detectedIntent).toBeDefined();
    expect(typeof result.detectedIntent).toBe("string");
  });

  it("processChatAI should include detectedIntent in human_claimed result", async () => {
    const result = await processChatAI(
      { text: "你好", platform: "messenger" },
      { aiEnabled: true, handoverStatus: "claimed" }
    );
    expect(result.source).toBe("human_claimed");
    expect(result.detectedIntent).toBeDefined();
  });

  it("processChatAI should trigger mandatory handover for parcel_issue (损坏)", async () => {
    const result = await processChatAI(
      { text: "我收到的植物损坏了", platform: "messenger" },
      { aiEnabled: true, handoverStatus: "none" }
    );
    expect(result.source).toBe("intent_handover");
    expect(result.shouldHandover).toBe(true);
    expect(result.shouldReply).toBe(false);
    expect(result.detectedIntent).toBe("parcel_issue");
    expect(result.handoverSummary).toBeDefined();
    expect(result.handoverSummary.priority).toBe("high");
  });

  it("processChatAI should trigger mandatory handover for complaint (投诉)", async () => {
    const result = await processChatAI(
      { text: "我要投诉你们的服务", platform: "messenger" },
      { aiEnabled: true, handoverStatus: "none" }
    );
    expect(result.source).toBe("intent_handover");
    expect(result.shouldHandover).toBe(true);
    expect(result.detectedIntent).toBe("complaint");
    expect(result.handoverSummary.priority).toBe("high");
  });

  it("processChatAI should trigger mandatory handover for refund (退款)", async () => {
    const result = await processChatAI(
      { text: "我要退款", platform: "messenger" },
      { aiEnabled: true, handoverStatus: "none" }
    );
    expect(result.source).toBe("intent_handover");
    expect(result.shouldHandover).toBe(true);
    expect(result.detectedIntent).toBe("refund");
    expect(result.handoverSummary.priority).toBe("high");
  });

  it("processChatAI should trigger mandatory handover for cooperation (合作)", async () => {
    const result = await processChatAI(
      { text: "我想和你们合作代理", platform: "messenger" },
      { aiEnabled: true, handoverStatus: "none" }
    );
    expect(result.source).toBe("intent_handover");
    expect(result.shouldHandover).toBe(true);
    expect(result.detectedIntent).toBe("cooperation");
  });

  it("processChatAI should trigger mandatory handover for human_assistance (转人工)", async () => {
    const result = await processChatAI(
      { text: "请帮我转人工客服", platform: "messenger" },
      { aiEnabled: true, handoverStatus: "none" }
    );
    expect(result.source).toBe("intent_handover");
    expect(result.shouldHandover).toBe(true);
    expect(result.detectedIntent).toBe("human_assistance");
  });

  it("processChatAI should NOT trigger handover for general inquiry (你好)", async () => {
    const result = await processChatAI(
      { text: "你好", platform: "messenger" },
      { aiEnabled: true, handoverStatus: "none" }
    );
    expect(result.source).not.toBe("intent_handover");
    expect(result.detectedIntent).toBe("general_inquiry");
  });

  it("processChatAI should NOT trigger handover for membership inquiry", async () => {
    const result = await processChatAI(
      { text: "请问如何加入会员", platform: "messenger" },
      { aiEnabled: true, handoverStatus: "none" }
    );
    expect(result.source).not.toBe("intent_handover");
    expect(result.detectedIntent).toBe("membership");
  });

  it("processChatAI should NOT trigger handover for shipment tracking", async () => {
    const result = await processChatAI(
      { text: "我的包裹到哪里了", platform: "messenger" },
      { aiEnabled: true, handoverStatus: "none" }
    );
    expect(result.source).not.toBe("intent_handover");
    expect(result.detectedIntent).toBe("shipment_tracking");
  });

  it("processChatAI should include handoverSummary in no_match result", async () => {
    const result = await processChatAI(
      { text: "今天天气很好啊", platform: "messenger" },
      { aiEnabled: true, handoverStatus: "none" }
    );
    expect(result.source).toBe("no_match");
    expect(result.shouldHandover).toBe(true);
    expect(result.detectedIntent).toBe("other");
    expect(result.handoverSummary).toBeDefined();
    expect(result.handoverSummary.detectedIntent).toBe("other");
  });

  it("classifyIntent should classify shipment_tracking correctly", () => {
    const r = classifyIntent("我的快递什么时候到");
    expect(r.intent).toBe("shipment_tracking");
    expect(r.workflow).toBe("shipping_api");
    expect(r.shouldHandover).toBe(false);
  });

  it("classifyIntent should classify new_order correctly", () => {
    const r = classifyIntent("我要买这盆花");
    expect(r.intent).toBe("new_order");
    expect(r.workflow).toBe("draft_order");
  });

  it("classifyIntent should classify order_modification correctly", () => {
    const r = classifyIntent("我要改地址");
    expect(r.intent).toBe("order_modification");
    expect(r.workflow).toBe("change_request");
  });
});
