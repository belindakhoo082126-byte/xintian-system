import { describe, expect, it } from "vitest";
import { DEFAULT_SALES_UNITS } from "./defaultSalesUnits";

describe("默认销售单位", () => {
  it("提供商品管理可选择的常用单位且中文名称不重复", () => {
    expect(DEFAULT_SALES_UNITS.map((unit) => unit.nameZh)).toEqual([
      "盆", "个", "包", "瓶", "袋", "组",
    ]);
    expect(new Set(DEFAULT_SALES_UNITS.map((unit) => unit.nameZh)).size).toBe(DEFAULT_SALES_UNITS.length);
  });
});
