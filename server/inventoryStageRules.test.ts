import { describe, expect, it } from "vitest";
import { getInventoryOrderStage, getSellableInventoryQuantity, isStockManagedProductType } from "../shared/inventoryStageRules";

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

  it("正式订单的等待补货数量已占用库存：蓝莓缺3盆后收货10盆时可销售7盆", () => {
    // 实体订单在成立时已从库存扣除3盆，等待补货只记录履约待办，不再重复扣减。
    const stockAfterOrder = -3;
    const stockAfterReceipt = stockAfterOrder + 10;

    expect(stockAfterReceipt).toBe(7);
    expect(getSellableInventoryQuantity(stockAfterReceipt, 0)).toBe(7);
  });

  it("临时预留库存同样不得重复销售：实物10盆、已保护3盆时只可销售7盆", () => {
    expect(getSellableInventoryQuantity(10, 3)).toBe(7);
  });
});
