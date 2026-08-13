import { afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb, processExpiredLocalOrders } from "./db";
import { customers, orderItems, orderOperationLogs, orderStatusLogs, orders, products } from "../drizzle/schema";

/**
 * 真实数据库隔离演练：所有记录带唯一 QA 标识，并始终按依赖反向清理。
 * 禁止查询、修改或删除不含该标识的真实客户、订单或库存资料。
 */
describe.sequential("本地订单七天付款期限隔离行为验证", () => {
  const qaKey = `QA-LOCAL-EXPIRY-${Date.now()}`;
  const qaCustomerCode = `QAE${Date.now().toString().slice(-10)}`;
  const qaOrderNumber = `XT-QA-${Date.now()}`;
  let customerId: number | undefined;
  let productId: number | undefined;
  let orderId: number | undefined;

  const asInsertId = (result: any) => Number(result?.[0]?.insertId ?? result?.insertId);

  async function cleanupQaRows() {
    const db = await getDb();
    if (!db) return;
    const markedOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.orderNumber, qaOrderNumber));
    const markedCustomers = await db.select({ id: customers.id }).from(customers).where(eq(customers.customerId, qaCustomerCode));
    const markedProducts = await db.select({ id: products.id }).from(products).where(eq(products.name, `${qaKey} 商品`));
    const orderIds = [...new Set([...(orderId ? [orderId] : []), ...markedOrders.map((row) => Number(row.id))])];
    const productIds = [...new Set([...(productId ? [productId] : []), ...markedProducts.map((row) => Number(row.id))])];
    const customerIds = [...new Set([...(customerId ? [customerId] : []), ...markedCustomers.map((row) => Number(row.id))])];

    if (orderIds.length > 0) {
      await db.delete(orderOperationLogs).where(inArray(orderOperationLogs.orderId, orderIds));
      await db.delete(orderStatusLogs).where(inArray(orderStatusLogs.orderId, orderIds));
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }
    if (productIds.length > 0) await db.delete(products).where(inArray(products.id, productIds));
    if (customerIds.length > 0) await db.delete(customers).where(inArray(customers.id, customerIds));
  }

  afterEach(async () => {
    await cleanupQaRows();
  });

  it("取消超期且无付款凭证的本地待付款订单，回补库存并保留审计", async () => {
    const db = await getDb();
    expect(db, "DATABASE_URL 必须可用，才可进行真实隔离演练").toBeTruthy();
    await cleanupQaRows();

    customerId = asInsertId(await db!.insert(customers).values({
      customerId: qaCustomerCode,
      name: `${qaKey} 客户`,
      displayName: `${qaKey} 客户`,
      phoneNumber: "0190000000",
      customerSource: "admin",
    }));
    productId = asInsertId(await db!.insert(products).values({
      name: `${qaKey} 商品`,
      sku: `${qaKey}-SKU`.slice(0, 30),
      keyword: `${qaKey}-KEY`.slice(0, 50),
      type: "physical",
      status: "active",
      sellingPrice: "20.00",
      cost: "8.00",
      currentCost: "8.00",
      stockQuantity: 3,
      reservedQuantity: 0,
      allowOversold: false,
      orderCategory: "local",
    }));
    orderId = asInsertId(await db!.insert(orders).values({
      orderNumber: qaOrderNumber,
      customerId,
      facebookName: `${qaKey} 客户`,
      orderType: "physical",
      orderCategory: "local",
      physicalStatus: "pending",
      physicalSubtotal: "40.00",
      totalAmount: "40.00",
      paidAmount: "0.00",
      shippingFee: "0.00",
      orderSource: "manual",
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    }));
    await db!.insert(orderItems).values({
      orderId,
      productId,
      productName: `${qaKey} 商品`,
      quantity: 2,
      unitPrice: "20.00",
      subtotal: "40.00",
      itemSource: "admin",
      salesMode: "normal",
      priceType: "retail",
      unitCost: "8.00",
    });

    const result = await processExpiredLocalOrders();
    expect(result.cancelled.some((item) => Number(item.id) === orderId)).toBe(true);

    const [cancelledOrder] = await db!.select({
      status: orders.physicalStatus,
      reason: orders.cancelReason,
      cancelledBy: orders.cancelledBy,
    }).from(orders).where(eq(orders.id, orderId));
    expect(cancelledOrder).toMatchObject({
      status: "cancelled",
      cancelledBy: "系统自动",
    });
    expect(cancelledOrder.reason).toContain("下单满7天");

    const [replenishedProduct] = await db!.select({ stockQuantity: products.stockQuantity })
      .from(products).where(eq(products.id, productId));
    expect(Number(replenishedProduct.stockQuantity)).toBe(5);

    const logs = await db!.select({ operationType: orderOperationLogs.operationType, description: orderOperationLogs.description })
      .from(orderOperationLogs).where(eq(orderOperationLogs.orderId, orderId));
    expect(logs.some((log) => log.operationType === "cancel" && log.description?.includes("下单满7天"))).toBe(true);
  }, 20_000);
});
