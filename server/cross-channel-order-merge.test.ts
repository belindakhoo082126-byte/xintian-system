import { afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  appendItemsToUnpaidLocalOrder,
  assertImportLiveOrderWindow,
  findMergeableUnpaidLocalOrder,
  getDb,
} from "./db";
import { customers, liveRooms, orderItems, orderOperationLogs, orders, products } from "../drizzle/schema";

describe.sequential("跨渠道订单自动合并", () => {
  const qaKey = `QA-CROSS-MERGE-${Date.now()}`;
  const customerCode = `QCM${Date.now().toString().slice(-11)}`;
  const sku = `QCM-${Date.now().toString().slice(-10)}`;
  let customerId = 0;
  let productId = 0;
  let orderIds: number[] = [];
  let roomIds: number[] = [];

  async function cleanup() {
    const db = await getDb();
    if (!db) return;
    if (orderIds.length > 0) {
      await db.delete(orderOperationLogs).where(inArray(orderOperationLogs.orderId, orderIds));
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }
    if (roomIds.length > 0) await db.delete(liveRooms).where(inArray(liveRooms.id, roomIds));
    await db.delete(products).where(eq(products.sku, sku));
    await db.delete(customers).where(eq(customers.customerId, customerCode));
    customerId = 0;
    productId = 0;
    orderIds = [];
    roomIds = [];
  }

  async function seedCustomerAndProduct() {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL 必须可用，才可进行真实隔离演练");
    const customerInsert = await db.insert(customers).values({
      customerId: customerCode,
      name: qaKey,
      displayName: qaKey,
      customerSource: "admin",
    });
    customerId = Number((customerInsert as any)?.[0]?.insertId ?? (customerInsert as any)?.insertId);
    const productInsert = await db.insert(products).values({
      name: `${qaKey} 商品`, sku, keyword: sku, type: "physical", status: "active",
      sellingPrice: "10.00", cost: "3.00", currentCost: "3.00",
      stockQuantity: 20, reservedQuantity: 0, allowOversold: false, allowPresale: false,
    });
    productId = Number((productInsert as any)?.[0]?.insertId ?? (productInsert as any)?.insertId);
    return db;
  }

  async function seedOrder(category: "local" | "import", suffix: string, paidAmount = "0.00", liveRoomId?: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const result = await db.insert(orders).values({
      orderNumber: `${qaKey}-${suffix}`.slice(0, 50),
      secureToken: `${qaKey}-${suffix}-TOKEN`.slice(0, 255),
      checkoutLink: `/order/${qaKey}-${suffix}`,
      customerId,
      facebookName: qaKey,
      orderType: "physical",
      orderCategory: category,
      importStatus: category === "import" ? "pending" : null,
      physicalStatus: "pending",
      orderSource: "manual",
      totalAmount: "0.00",
      paidAmount,
      liveRoomId: liveRoomId || null,
      shippingMethod: "west_malaysia",
    });
    const id = Number((result as any)?.[0]?.insertId ?? (result as any)?.insertId);
    orderIds.push(id);
    return id;
  }

  afterEach(cleanup);

  it("同一客户的未付款本地 XT 可接收商城、直播与 AI／私聊来源商品", async () => {
    await cleanup();
    const db = await seedCustomerAndProduct();
    const localOrderId = await seedOrder("local", "XT");

    for (const itemSource of ["mall", "facebook_live", "messenger"] as const) {
      await appendItemsToUnpaidLocalOrder({
        customerId,
        targetOrderId: localOrderId,
        operationType: "cross_channel_merge",
        operationBy: "QA",
        items: [{
          productId,
          productName: `${qaKey} 商品`,
          productType: "physical",
          quantity: 1,
          unitPrice: "10.00",
          subtotal: "10.00",
          itemSource,
        }],
      });
    }

    const mergedItems = await db.select({ source: orderItems.itemSource, quantity: orderItems.quantity })
      .from(orderItems).where(eq(orderItems.orderId, localOrderId));
    expect(mergedItems).toHaveLength(3);
    expect(mergedItems.map((item) => item.source).sort()).toEqual(["facebook_live", "mall", "messenger"]);
    const updated = await db.select({ totalAmount: orders.totalAmount }).from(orders).where(eq(orders.id, localOrderId));
    expect(updated[0]?.totalAmount).toBe("45.00"); // RM30 商品 + 西马 10kg 内 RM15 运费
  }, 20_000);

  it("已付款本地订单不会成为候选，XTC 也永远不会被本地合单查询选中", async () => {
    await cleanup();
    await seedCustomerAndProduct();
    const localOrderId = await seedOrder("local", "UNPAID");
    await seedOrder("local", "PAID", "10.00");
    await seedOrder("import", "XTC");

    const target = await findMergeableUnpaidLocalOrder(customerId);
    expect(target?.id).toBe(localOrderId);
    expect(target?.orderCategory).toBe("local");
  }, 20_000);

  it("中国代购直播超过截止日期后拒绝继续建立或合并 XTC 订单", async () => {
    await cleanup();
    const db = await seedCustomerAndProduct();
    const now = Date.now();
    const roomInsert = await db.insert(liveRooms).values({
      name: `${qaKey} 已截止中国代购直播`,
      liveDate: new Date(now - 3 * 24 * 60 * 60 * 1000),
      liveType: "import_preorder",
      preorderStartDate: new Date(now - 3 * 24 * 60 * 60 * 1000),
      preorderEndDate: new Date(now - 24 * 60 * 60 * 1000),
      status: "ended",
    });
    const roomId = Number((roomInsert as any)?.[0]?.insertId ?? (roomInsert as any)?.insertId);
    roomIds.push(roomId);

    await expect(assertImportLiveOrderWindow(roomId)).rejects.toThrow(/开始日期至截止日期/);
  }, 20_000);
});
