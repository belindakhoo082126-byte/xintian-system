import { describe, expect, it } from "vitest";
import { canConfigureSpecialPrice } from "../shared/specialPriceFormPlacement";

describe("特价价格表单位置规则", () => {
  it("只允许实体商品在价格与成本步骤配置特价", () => {
    expect(canConfigureSpecialPrice("physical")).toBe(true);
    expect(canConfigureSpecialPrice("gift")).toBe(false);
    expect(canConfigureSpecialPrice("virtual")).toBe(false);
  });
});

