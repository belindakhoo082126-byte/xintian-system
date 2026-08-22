import { describe, expect, it } from "vitest";
import { toLiveStockDeduction } from "../shared/liveStockDeductionRules";

describe("直播库存仅扣减规则", () => {
  it("将后台输入的扣减数量转换为负库存变动", () => {
    expect(toLiveStockDeduction(3)).toBe(-3);
  });

  it("拒绝直播房补货、零数量与非整数", () => {
    expect(() => toLiveStockDeduction(0)).toThrow("大于 0");
    expect(() => toLiveStockDeduction(-2)).toThrow("大于 0");
    expect(() => toLiveStockDeduction(1.5)).toThrow("大于 0");
  });
});
