import { afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDashboardV11Stats, getDb, getOrders } from "./db";
import { customers, orderOperationLogs, orders } from "../drizzle/schema";

describe.sequential("Dashboard 今日跨渠道合单统计", () => {
  const qaKey = `QA-DASHBOARD-MERGE-${Date.now()}`;
  let customerId = 0;
  let orderIds: number[] = [];

  async function cleanup() {
    const db = await getDb();
    if (!db) return;
    if (orderIds.length > 0) {
      await db.delete(orderOperationLogs).where(inArray(orderOperationLogs.orderId, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }
    if (customerId) await db.delete(customers).where(eq(customers.id, customerId));
    customerId = 0;
    orderIds = [];
  }

  afterEach(cleanup);

  it("按今日跨渠道追加次数和新增商品金额汇总，且不计入其他审计类型", async () => {
    await cleanup();
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL 必须可用，才可进行真实隔离演练");
    const baseline = await getDashboardV11Stats();

    const customerInsert = await db.insert(customers).values({
      customerId: `QDM${Date.now().toString().slice(-11)}`,
      name: qaKey,
      displayName: qaKey,
      customerSource: "admin",
    });
    customerId = Number((customerInsert as any)?.[0]?.insertId ?? (customerInsert as any)?.insertId);

    const orderInsert = await db.insert(orders).values({
      orderNumber: `${qaKey}-XT`.slice(0, 50),
      secureToken: `${qaKey}-TOKEN`.slice(0, 255),
      checkoutLink: `/order/${qaKey}`,
      customerId,
      facebookName: qaKey,
      orderType: "physical",
      orderCategory: "local",
      physicalStatus: "pending",
      orderSource: "manual",
      totalAmount: "0.00",
      paidAmount: "0.00",
      shippingMethod: "west_malaysia",
    });
    const orderId = Number((orderInsert as any)?.[0]?.insertId ?? (orderInsert as any)?.insertId);
    orderIds.push(orderId);

    await db.insert(orderOperationLogs).values([
      {
        orderId,
        operationType: "cross_channel_merge",
        description: "QA 商城自动合单",
        changes: JSON.stringify({ addedAmount: "12.50", items: [{ quantity: 1, unitPrice: "12.50", itemSource: "mall" }] }),
        operator: "QA",
      },
      {
        orderId,
        operationType: "cross_channel_merge",
        description: "QA 直播自动合单",
        changes: JSON.stringify({ items: [{ quantity: 2, unitPrice: "7.25", itemSource: "facebook_live" }] }),
        operator: "QA",
      },
      {
        orderId,
        operationType: "item_add",
        description: "不应纳入跨渠道合单统计",
        changes: JSON.stringify({ addedAmount: "999.00" }),
        operator: "QA",
      },
    ]);

    const stats = await getDashboardV11Stats();
    expect(stats.crossChannelMerge.count).toBe(baseline.crossChannelMerge.count + 2);
    expect(Number(stats.crossChannelMerge.addedAmount)).toBeCloseTo(
      Number(baseline.crossChannelMerge.addedAmount) + 27,
      2,
    );

    const mergeOrders = await getOrders({ orderCategory: "local", crossChannelMergeToday: true }) as any[];
    const mergeOrder = mergeOrders.find((entry) => entry.id === orderId);
    expect(mergeOrder).toBeTruthy();
    expect(mergeOrder.crossChannelMergeDetails).toHaveLength(2);
    expect(mergeOrder.crossChannelMergeDetails.map((detail: any) => detail.addedAmount).sort()).toEqual(["12.50", "14.50"]);
    expect(mergeOrder.crossChannelMergeDetails.flatMap((detail: any) => detail.addedSources).sort()).toEqual(["facebook_live", "mall"]);
  }, 20_000);
});
