import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  WEST_MALAYSIA_V22_SHIPPING,
  getWestMalaysiaV22Specification,
} from "../shared/shippingV22";

const dbSource = fs.readFileSync(path.resolve(process.cwd(), "server/db.ts"), "utf8");
const productsSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/ProductsV2.tsx"), "utf8");
const inventoryLogSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/InventoryLog.tsx"), "utf8");
const shippingRulesSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/ShippingRules.tsx"), "utf8");

describe("库存更正与商品库存审计边界", () => {
  it("uses a linked correction row instead of overwriting the historical adjustment", () => {
    const correctionSource = dbSource.slice(
      dbSource.indexOf("export async function correctInventoryAdjustment"),
      dbSource.indexOf("// ============================================================================\n// V1.2: Profit Analysis Report"),
    );

    expect(correctionSource).toContain("if (original.correctsAdjustmentId)");
    expect(correctionSource).toContain("if (original.orderExceptionId)");
    expect(correctionSource).toContain("const correctionDelta = desiredQuantityChange - currentEffectiveQuantity");
    expect(correctionSource).toContain("correctsAdjustmentId: original.id");
    expect(correctionSource).toContain("totalCost: -correctionDelta * unitCost");
    expect(correctionSource).toContain("return await createInventoryAdjustment");
  });

  it("keeps the product-level inventory log read-only while exposing traceable logs", () => {
    expect(productsSource).toContain("库存操作日志");
    expect(productsSource).toContain("trpc.inventoryAdjustment.list.useQuery");
    expect(inventoryLogSource).not.toContain("新增库存调整");
    expect(inventoryLogSource).toContain("更正记录");
  });

  it("states that variation inventory is maintained through audited inventory flows", () => {
    expect(productsSource).toContain("规格库存由进货批次、订单与库存流水同步，不能在此直接修改。");
  });
});

describe("西马V2.2物流规格单一口径", () => {
  it("defines the official threshold, included weight, base fee and additional fee", () => {
    expect(WEST_MALAYSIA_V22_SHIPPING).toEqual({
      freeShippingThreshold: 150,
      includedWeightKg: 10,
      baseFeeBelowThreshold: 15,
      additionalKgFee: 3,
    });
    expect(getWestMalaysiaV22Specification()).toContain("订单商品金额满 RM150");
    expect(getWestMalaysiaV22Specification()).toContain("首 10kg 免邮");
    expect(getWestMalaysiaV22Specification()).toContain("每公斤加 RM3");
  });

  it("renders the shipping settings description from the shared official specification", () => {
    expect(shippingRulesSource).toContain("getWestMalaysiaV22Specification");
    expect(shippingRulesSource).toContain("WEST_MALAYSIA_V22_SHIPPING");
  });
});
