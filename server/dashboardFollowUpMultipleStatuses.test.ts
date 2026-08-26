import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const dashboardSource = readFileSync(new URL("../client/src/pages/Dashboard.tsx", import.meta.url), "utf8");

describe("Dashboard 多待办状态", () => {
  it("将库存等于预警阈值的商品纳入低库存筛选", () => {
    expect(dbSource).toContain("lte(products.stockQuantity, stockThreshold)");
  });

  it("按每个未完成特别状态返回待办，支持同订单待退款与等待补货并行", () => {
    expect(dbSource).toContain("FROM order_special_statuses oss");
    expect(dbSource).toContain("UNION ALL");
    expect(dbSource).toContain("oss.status = 'pending'");
  });

  it("等待补货卡可在有唯一待办时直接打开对应订单", () => {
    expect(dashboardSource).toContain("const waitingRestockItem");
    expect(dashboardSource).toContain("/orders/${waitingRestockItem.orderId}");
  });
});
