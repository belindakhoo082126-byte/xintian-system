import { describe, expect, it } from "vitest";
import { isBackendEnglishFallbackPath, translateBackendStaticText } from "./BackendEnglishFallback";

describe("BackendEnglishFallback", () => {
  it("only applies to the administrator pages specified for English fallback", () => {
    expect(isBackendEnglishFallbackPath("/marketing")).toBe(true);
    expect(isBackendEnglishFallbackPath("/import-batches?tab=ib")).toBe(true);
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
    expect(translateBackendStaticText("XT-00001")).toBe("XT-00001");
  });
});
