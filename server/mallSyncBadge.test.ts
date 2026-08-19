import { describe, expect, it } from "vitest";
import { shouldShowMallSyncBadge } from "../shared/mallSyncBadge";

describe("商品列表商城同步标识", () => {
  it("仅对已同步商城的商品显示标识", () => {
    expect(shouldShowMallSyncBadge({ syncToMall: true })).toBe(true);
    expect(shouldShowMallSyncBadge({ syncToMall: false })).toBe(false);
    expect(shouldShowMallSyncBadge({})).toBe(false);
  });
});

