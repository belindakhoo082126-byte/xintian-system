import { describe, expect, it } from "vitest";
import { isStockManagedProductType } from "../shared/inventoryStageRules";
import { resolveOrderItemUnitWeight } from "../shared/orderItemWeight";
import { requiresMaterialKitWeight, resolveVirtualDeliveryCatalogProductType } from "../shared/virtualDeliveryProductType";

describe("实体材料包库存边界", () => {
  it("将实体材料包映射为实体商品，使其可进入进货、库存、下单与包货流程", () => {
    const productType = resolveVirtualDeliveryCatalogProductType("material_kit");
    expect(productType).toBe("physical");
    expect(isStockManagedProductType(productType)).toBe(true);
    expect(requiresMaterialKitWeight("material_kit")).toBe(true);
    expect(resolveOrderItemUnitWeight({ productType, variantWeight: "0.75" })).toBe(0.75);
  });

  it("保持会员、课程与纯资料包为非库存虚拟交付", () => {
    for (const deliveryType of ["membership", "course", "resource"] as const) {
      const productType = resolveVirtualDeliveryCatalogProductType(deliveryType);
      expect(productType).toBe("membership");
      expect(isStockManagedProductType(productType)).toBe(false);
      expect(requiresMaterialKitWeight(deliveryType)).toBe(false);
    }
  });
});
