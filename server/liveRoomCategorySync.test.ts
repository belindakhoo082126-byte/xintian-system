import { describe, expect, it } from "vitest";
import { getLiveRoomCategoryLabel, shouldQueryLiveRoomProducts } from "../shared/liveRoomCategorySync";

describe("直播房商品分类同步", () => {
  it("优先显示商品管理分类中文名称，并兼容旧分类字段", () => {
    expect(getLiveRoomCategoryLabel({ nameZh: "种植介质", nameEn: "Planting medium" })).toBe("种植介质");
    expect(getLiveRoomCategoryLabel({ nameEn: "Fertilizer" })).toBe("Fertilizer");
    expect(getLiveRoomCategoryLabel({ name: "Legacy category" })).toBe("Legacy category");
  });

  it("输入关键词或选择分类时均查询直播房可加入商品", () => {
    expect(shouldQueryLiveRoomProducts("泥土", "all")).toBe(true);
    expect(shouldQueryLiveRoomProducts("", "150000")).toBe(true);
    expect(shouldQueryLiveRoomProducts("   ", "all")).toBe(false);
  });
});
