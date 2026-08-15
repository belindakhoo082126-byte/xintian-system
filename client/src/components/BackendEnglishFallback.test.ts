import { describe, expect, it } from "vitest";
import { isBackendEnglishFallbackPath, translateBackendStaticText } from "./BackendEnglishFallback";

describe("BackendEnglishFallback", () => {
  it("applies to every administrator route while preserving public-page isolation", () => {
    expect(isBackendEnglishFallbackPath("/marketing")).toBe(true);
    expect(isBackendEnglishFallbackPath("/import-batches?tab=ib")).toBe(true);
    expect(isBackendEnglishFallbackPath("/orders")).toBe(true);
    expect(isBackendEnglishFallbackPath("/refunds")).toBe(true);
    expect(isBackendEnglishFallbackPath("/products")).toBe(true);
    expect(isBackendEnglishFallbackPath("/auto-notifications")).toBe(true);
    expect(isBackendEnglishFallbackPath("/flows")).toBe(true);
    expect(isBackendEnglishFallbackPath("/ai-knowledge")).toBe(true);
    expect(isBackendEnglishFallbackPath("/reply-rules")).toBe(true);
    expect(isBackendEnglishFallbackPath("/mall")).toBe(false);
  });

  it("translates static administration terms without touching unknown business data", () => {
    expect(translateBackendStaticText("营销中心")).toBe("Marketing Center");
    expect(translateBackendStaticText("等待到货")).toBe("Awaiting Arrival");
    expect(translateBackendStaticText("Chat 客服")).toBe("Chat Support");
    expect(translateBackendStaticText("自动通知")).toBe("Automated Notifications");
    expect(translateBackendStaticText("最近订单")).toBe("Recent Orders");
    expect(translateBackendStaticText("Flow 编辑器")).toBe("Flow Editor");
    expect(translateBackendStaticText("付款设定")).toBe("Payment Settings");
    expect(translateBackendStaticText("草稿订单（AI 生成）")).toBe("Draft Orders (AI-generated)");
    expect(translateBackendStaticText("订单变更请求（AI 生成）")).toBe("Order Change Requests (AI-generated)");
    expect(translateBackendStaticText("采购批次管理")).toBe("Import Batch Management");
    expect(translateBackendStaticText("自动营销控制台")).toBe("Automation Console");
    expect(translateBackendStaticText("关键词模拟测试")).toBe("Keyword Simulation");
    expect(translateBackendStaticText("幸运轮盘与直播抽奖")).toBe("Lucky Wheel & Live Draw");
    expect(translateBackendStaticText("启用前检查")).toBe("Preflight check");
    expect(translateBackendStaticText("营销效果分析")).toBe("Marketing Performance Analysis");
    expect(translateBackendStaticText("AI 自动解决率")).toBe("AI Auto-resolution Rate");
    expect(translateBackendStaticText("请输入 Flow 名称")).toBe("Please enter the Flow name");
    expect(translateBackendStaticText("回放完成，已生成对比结果")).toBe("Playback completed, comparison results generated");
    expect(translateBackendStaticText("确认删除此测试记录？此操作不可撤销。")).toBe("Are you sure you want to delete this test record? This action cannot be undone.");
    expect(translateBackendStaticText("暂停捉单")).toBe("Order Capture Paused");
    expect(translateBackendStaticText("XT-00001")).toBe("XT-00001");
  });
});
