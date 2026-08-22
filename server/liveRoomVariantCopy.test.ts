import { describe, expect, it } from "vitest";
import { formatLiveRoomVariantCopyText } from "../shared/liveRoomVariantCopy";

describe("直播房多规格喊单清单", () => {
  it("逐规格列出关键词、售价、现货、已喊与可卖数量", () => {
    const text = formatLiveRoomVariantCopyText("疏松泥土", [
      { name: "7L", keyword: "LS7", price: 7, onHand: 20, called: 1, available: 19 },
      { name: "28L", keyword: "LS28", price: 17, onHand: 8, called: 0, available: 8 },
    ], "👇 留言关键词即可自动下单");

    expect(text).toContain("7L｜关键词：LS7｜RM7.00");
    expect(text).toContain("28L｜关键词：LS28｜RM17.00");
    expect(text).toContain("留言：LS28+1");
    expect(text).not.toMatch(/现货|已喊|可卖/);
  });

  it("单一商品仍保留明确的关键词与喊单格式", () => {
    const text = formatLiveRoomVariantCopyText("玛格丽特ASTER", [
      { name: "默认规格", keyword: "AS", price: 17, onHand: 40, called: 0, available: 40 },
    ], "footer");

    expect(text).toContain("📝 关键词：AS");
    expect(text).toContain("留言格式：AS+1");
  });
});
