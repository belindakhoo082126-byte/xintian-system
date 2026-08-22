import { describe, expect, it } from "vitest";
import { liveStudioLayout } from "../shared/liveStudioLayout";

describe("直播房操作台布局", () => {
  it("为主操作区保留稳定高度，并让桌面双栏与手机纵向布局共存", () => {
    expect(liveStudioLayout.workspace).toContain("grid-cols-1");
    expect(liveStudioLayout.workspace).toContain("lg:grid-cols-2");
    expect(liveStudioLayout.workspace).toContain("min-h-[380px]");
    expect(liveStudioLayout.workspaceCard).toContain("overflow-hidden");
  });

  it("为得标订单保留独立可滚动的底部操作高度", () => {
    expect(liveStudioLayout.ordersCard).toContain("min-h-[240px]");
    expect(liveStudioLayout.container).toContain("h-auto");
  });
});
