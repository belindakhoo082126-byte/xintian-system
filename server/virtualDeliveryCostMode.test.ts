import { describe, expect, it } from "vitest";
import { getVirtualDeliveryCostLabel, resolveVirtualDeliveryPackageCosts, resolveVirtualDeliveryPackageNames } from "../shared/virtualDeliveryCostMode";

describe("虚拟交付成本模式", () => {
  it("单一内容商品以独立商品成本覆盖技术配套的成本快照", () => {
    const packages = resolveVirtualDeliveryPackageCosts([{ contentCost: "0.00" }], "5.50");
    expect(packages[0].contentCost).toBe("5.50");
    expect(getVirtualDeliveryCostLabel(packages.length)).toBe("商品成本");
  });

  it("多个配套各自保留配套成本", () => {
    const packages = resolveVirtualDeliveryPackageCosts([{ contentCost: "2.00" }, { contentCost: "8.00" }], "5.50");
    expect(packages.map((item) => item.contentCost)).toEqual(["2.00", "8.00"]);
    expect(getVirtualDeliveryCostLabel(packages.length)).toBe("配套成本");
  });

  it("单一商品未填写技术内容名称时自动使用商品名称", () => {
    expect(resolveVirtualDeliveryPackageNames([{ name: "" }], "心田会员")[0].name).toBe("心田会员");
    expect(resolveVirtualDeliveryPackageNames([{ name: "基础" }, { name: "完整" }], "课程").map((item) => item.name)).toEqual(["基础", "完整"]);
  });
});
