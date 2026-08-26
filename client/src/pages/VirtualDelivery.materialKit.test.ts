import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const virtualDelivery = readFileSync(new URL("./VirtualDelivery.tsx", import.meta.url), "utf8");
const purchaseOrders = readFileSync(new URL("./PurchaseOrders.tsx", import.meta.url), "utf8");
const router = readFileSync(new URL("../../../server/routers.ts", import.meta.url), "utf8");

describe("实体材料包页面与进货入口", () => {
  it("允许在虚拟交付中选择实体材料包并明确其进入进货、库存、订单与包货", () => {
    expect(virtualDelivery).toContain('value="material_kit"');
    expect(virtualDelivery).toContain("实体材料包（需进货／库存／包货）");
    expect(virtualDelivery).toContain("单包重量 (kg)");
    expect(virtualDelivery).toContain("进货管理收货入库存");
  });

  it("要求实体材料包填写大于零的重量，并在进货单中明确属于可进货项目", () => {
    expect(router).toContain('value.deliveryType !== "material_kit"');
    expect(router).toContain("实体材料包的每个配套必须填写大于0的单包重量");
    expect(purchaseOrders).toContain("商品、赠品与实体材料包");
  });
});
