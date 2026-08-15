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

  it("按今日 XT 与合资格 XTC 的追加次数和新增商品金额汇总，且不计入其他审计类型", async () => {
    await cleanup();
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL 必须可用，才可进行真实隔离演练");
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

    const importOrderInsert = await db.insert(orders).values({
      orderNumber: `${qaKey}-XTC`.slice(0, 50),
      secureToken: `${qaKey}-XTC-TOKEN`.slice(0, 255),
      checkoutLink: `/order/${qaKey}-xtc`,
      customerId,
      facebookName: qaKey,
      orderType: "physical",
      orderCategory: "import",
      physicalStatus: "pending",
      orderSource: "facebook_live",
      totalAmount: "0.00",
      paidAmount: "0.00",
      shippingMethod: "west_malaysia",
    });
    const importOrderId = Number((importOrderInsert as any)?.[0]?.insertId ?? (importOrderInsert as any)?.insertId);
    orderIds.push(importOrderId);

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
        // XTC 合并日志仅由既有截止日期守卫通过后的入口写入；Dashboard
        // 应保留该真实审计事实，而不是以当前截止时间重新过滤。
        orderId: importOrderId,
        operationType: "import_live_merge",
        description: "QA 中国代购直播合单",
        changes: JSON.stringify({ addedAmount: "36.00", items: [{ quantity: 3, unitPrice: "12.00", itemSource: "facebook_live" }] }),
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
    // 完整回归会并行进行其他真实订单演练，它们可能在此测试的前后新增或
    // 清理自己的今日审计记录，因此全局聚合不适合用“基线 + 固定差值”断言。
    // 下限由本测试刚写入的两笔 XT 和一笔 XTC 合单保证；下面的订单明细
    // 继续以 QA 专属订单号精确验证三笔记录的类型、来源与金额。
    expect(stats.crossChannelMerge.count).toBeGreaterThanOrEqual(3);
    expect(Number(stats.crossChannelMerge.addedAmount)).toBeGreaterThanOrEqual(63);

    const mergeOrders = await getOrders({ crossChannelMergeToday: true }) as any[];
    const mergeOrder = mergeOrders.find((entry) => entry.id === orderId);
    const importMergeOrder = mergeOrders.find((entry) => entry.id === importOrderId);
    expect(mergeOrder).toBeTruthy();
    expect(importMergeOrder).toMatchObject({ orderCategory: "import" });
    expect(mergeOrder.crossChannelMergeDetails).toHaveLength(2);
    expect(mergeOrder.crossChannelMergeDetails.map((detail: any) => detail.addedAmount).sort()).toEqual(["12.50", "14.50"]);
    expect(mergeOrder.crossChannelMergeDetails.flatMap((detail: any) => detail.addedSources).sort()).toEqual(["facebook_live", "mall"]);
    expect(importMergeOrder.crossChannelMergeDetails).toHaveLength(1);
    expect(importMergeOrder.crossChannelMergeDetails[0]).toMatchObject({
      mergeOperationType: "import_live_merge",
      addedAmount: "36.00",
      addedSources: ["facebook_live"],
    });
  }, 20_000);
});
