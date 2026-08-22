import { describe, expect, it } from "vitest";
import { calculateActualGrossProfit } from "../shared/profitInventoryLoss";

describe("库存扣减损耗利润口径", () => {
  it("从实际毛利扣除进货管理与直播房的有成本库存损耗", () => {
    expect(calculateActualGrossProfit({
      salesRevenue: 1000,
      productCost: 500,
      shippingDiff: 20,
      scrapLoss: 10,
      refundLoss: 5,
      inventoryAdjustmentLoss: 30,
    })).toBe(475);
  });
});
