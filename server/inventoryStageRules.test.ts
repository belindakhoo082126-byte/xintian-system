import { describe, expect, it } from "vitest";
import { getInventoryOrderStage, isStockManagedProductType } from "../shared/inventoryStageRules";

describe("赠品库存四阶段规则", () => {
  it("将赠品与实体商品视为需实际库存管理的商品", () => {
    expect(isStockManagedProductType("physical")).toBe(true);
    expect(isStockManagedProductType("gift")).toBe(true);
    expect(isStockManagedProductType("membership")).toBe(false);
  });

  it("将订单状态映射为互斥的下单、已汇款与已完成阶段", () => {
    expect(getInventoryOrderStage("pending")).toBe("ordered");
    expect(getInventoryOrderStage("hold_order")).toBe("ordered");
    expect(getInventoryOrderStage("receipt_uploaded")).toBe("ordered");
    expect(getInventoryOrderStage("partial_payment")).toBe("ordered");
    expect(getInventoryOrderStage("packing")).toBe("paid");
    expect(getInventoryOrderStage("scheduled")).toBe("paid");
    expect(getInventoryOrderStage("partial_shipped")).toBe("paid");
    expect(getInventoryOrderStage("shipped")).toBe("completed");
    expect(getInventoryOrderStage("completed")).toBe("completed");
    expect(getInventoryOrderStage("cancelled")).toBeNull();
  });
});
