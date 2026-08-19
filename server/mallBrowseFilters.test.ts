import { describe, expect, it } from "vitest";
import { buildMallBrowseSearch, getMallBrowseFilters } from "../shared/mallBrowseFilters";

describe("商城分类筛选参数", () => {
  it("保留搜索词并在分类切换时生成可被响应式查询读取的参数", () => {
    const params = buildMallBrowseSearch("?q=ASTER", 1, "ASTER");
    expect(params.toString()).toBe("q=ASTER&categoryId=1");
    expect(getMallBrowseFilters(`?${params.toString()}`)).toEqual({ categoryId: 1, query: "ASTER" });
  });

  it("点击全部时移除分类参数", () => {
    expect(buildMallBrowseSearch("?categoryId=1&q=ASTER", undefined, "ASTER").toString()).toBe("q=ASTER");
  });
});

