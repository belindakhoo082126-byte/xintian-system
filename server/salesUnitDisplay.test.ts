import { describe, expect, it } from "vitest";
import { getSalesUnitLabel } from "../shared/salesUnitDisplay";

describe("商城销售单位展示", () => {
  it("按访客语言显示商品已保存的单位，并在翻译缺失时回退", () => {
    const product = { unitNameZh: "盆", unitNameEn: "Pot" };
    expect(getSalesUnitLabel(product, "zh")).toBe("盆");
    expect(getSalesUnitLabel(product, "en")).toBe("Pot");
    expect(getSalesUnitLabel({ unitNameZh: "组", unitNameEn: "" }, "en")).toBe("组");
    expect(getSalesUnitLabel({}, "zh")).toBe("");
  });
});

