import { describe, expect, it } from "vitest";
import { DEFAULT_SALES_UNITS } from "../shared/defaultSalesUnits";

describe("默认销售单位", () => {
  it("提供商品管理可选择的常用单位且中文名称不重复", () => {
    expect(DEFAULT_SALES_UNITS.map((unit) => unit.nameZh)).toEqual([
      "个", "件", "包", "盒", "瓶", "袋", "套", "组", "份", "公斤",
    ]);
    expect(new Set(DEFAULT_SALES_UNITS.map((unit) => unit.nameZh)).size).toBe(DEFAULT_SALES_UNITS.length);
  });
});
