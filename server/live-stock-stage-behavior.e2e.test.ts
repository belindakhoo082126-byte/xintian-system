import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  adjustLiveRoomProductStock,
  createOrderFromLiveCapture,
  createPurchaseOrder,
  getDb,
  getProductOrderDetails,
  receivePurchaseOrder,
  updateOrderStatus,
} from "./db";
import {
  customers,
  inventoryAdjustments,
  liveOrderCaptures,
  liveRoomProducts,
  liveRooms,
  orderItems,
  orderOperationLogs,
  orderStatusLogs,
  orders,
  purchaseOrderItems,
  purchaseOrders,
  products,
  suppliers,
} from "../drizzle/schema";

/**
 * Uses uniquely marked QA rows and removes them in reverse dependency order.
 * This verifies the user-facing live workflow against the real database without
 * retaining any test orders, products, live rooms, customers or stock logs.
 */
describe.sequential("直播库存与订单阶段隔离行为验证", () => {
  const qaKey = `QA-LIVE-STOCK-${Date.now()}`;
  const qaCustomerCodes = [`QAL${Date.now().toString().slice(-11)}1`, `QAL${Date.now().toString().slice(-11)}2`];
  const orderIds: number[] = [];
  const productIds: number[] = [];
  const customerIds: number[] = [];
  const liveProductIds: number[] = [];
  const purchaseOrderIds: number[] = [];
  const supplierIds: number[] = [];
  let liveRoomId: number | undefined;

  const asInsertId = (result: any) => Number(result?.[0]?.insertId ?? result?.insertId);

  async function cleanupQaRows() {
    const db = await getDb();
    if (!db) return;
    const markedOrderRows = await db.select({ id: orders.id }).from(orders).where(inArray(orders.facebookName, [
      `${qaKey} 客户 1`,
      `${qaKey} 客户 2`,
    ]));
    const markedCustomerRows = await db.select({ id: customers.id }).from(customers).where(inArray(customers.customerId, qaCustomerCodes));
    const markedProductRows = await db.select({ id: products.id }).from(products).where(inArray(products.name, [
      `${qaKey} 现货商品`,
      `${qaKey} 预售商品`,
    ]));
    const markedRoomRows = await db.select({ id: liveRooms.id }).from(liveRooms).where(eq(liveRooms.notes, qaKey));
    const markedPurchaseOrderRows = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.notes, qaKey));
    const markedSupplierRows = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, `${qaKey} 供应商`));
    const targetOrderIds = [...new Set([...orderIds, ...markedOrderRows.map((row) => Number(row.id))])];
    const targetCustomerIds = [...new Set([...customerIds, ...markedCustomerRows.map((row) => Number(row.id))])];
    const targetProductIds = [...new Set([...productIds, ...markedProductRows.map((row) => Number(row.id))])];
    const targetRoomIds = [...new Set([...(liveRoomId ? [liveRoomId] : []), ...markedRoomRows.map((row) => Number(row.id))])];
    const targetPurchaseOrderIds = [...new Set([...purchaseOrderIds, ...markedPurchaseOrderRows.map((row) => Number(row.id))])];
    const targetSupplierIds = [...new Set([...supplierIds, ...markedSupplierRows.map((row) => Number(row.id))])];
    const targetLiveProductIds = [...new Set([
      ...liveProductIds,
      ...(targetRoomIds.length > 0
        ? (await db.select({ id: liveRoomProducts.id }).from(liveRoomProducts).where(inArray(liveRoomProducts.liveRoomId, targetRoomIds))).map((row) => Number(row.id))
        : []),
    ])];

    if (targetOrderIds.length > 0) {
      await db.delete(liveOrderCaptures).where(inArray(liveOrderCaptures.orderId, targetOrderIds));
      await db.delete(orderOperationLogs).where(inArray(orderOperationLogs.orderId, targetOrderIds));
      await db.delete(orderStatusLogs).where(inArray(orderStatusLogs.orderId, targetOrderIds));
      await db.delete(orderItems).where(inArray(orderItems.orderId, targetOrderIds));
      await db.delete(orders).where(inArray(orders.id, targetOrderIds));
    }
    if (targetPurchaseOrderIds.length > 0) {
      await db.delete(purchaseOrderItems).where(inArray(purchaseOrderItems.purchaseOrderId, targetPurchaseOrderIds));
      await db.delete(purchaseOrders).where(inArray(purchaseOrders.id, targetPurchaseOrderIds));
    }
    if (targetProductIds.length > 0) {
      await db.delete(inventoryAdjustments).where(inArray(inventoryAdjustments.productId, targetProductIds));
    }
    if (targetLiveProductIds.length > 0) {
      await db.delete(liveRoomProducts).where(inArray(liveRoomProducts.id, targetLiveProductIds));
    }
    if (targetRoomIds.length > 0) await db.delete(liveRooms).where(inArray(liveRooms.id, targetRoomIds));
    if (targetProductIds.length > 0) await db.delete(products).where(inArray(products.id, targetProductIds));
    if (targetCustomerIds.length > 0) await db.delete(customers).where(inArray(customers.id, targetCustomerIds));
    if (targetSupplierIds.length > 0) await db.delete(suppliers).where(inArray(suppliers.id, targetSupplierIds));
  }

  afterEach(async () => {
    await cleanupQaRows();
  });

  it("库存调整同步主库存；商品级预售允许负库存，进货入库按增量抵销，并按状态在三阶段间迁移", async () => {
    const db = await getDb();
    expect(db, "DATABASE_URL 必须可用，才可进行真实隔离演练").toBeTruthy();
    await cleanupQaRows();

    for (const [index, customerId] of qaCustomerCodes.entries()) {
      const customerInsert = await db!.insert(customers).values({
        customerId,
        name: `${qaKey} 客户 ${index + 1}`,
        displayName: `${qaKey} 客户 ${index + 1}`,
        facebookName: `${qaKey} 客户 ${index + 1}`,
        messengerId: `${qaKey}-PSID-${index + 1}`,
        phoneNumber: "0190000000",
        customerSource: "facebook_live",
      });
      customerIds.push(asInsertId(customerInsert));
    }

    const supplierInsert = await db!.insert(suppliers).values({ name: `${qaKey} 供应商`, notes: qaKey });
    const supplierId = asInsertId(supplierInsert);
    supplierIds.push(supplierId);

    const normalProductInsert = await db!.insert(products).values({
      name: `${qaKey} 现货商品`, sku: `${qaKey}-N`.slice(0, 30), keyword: `${qaKey}-N`.slice(0, 50),
      type: "physical", status: "active", sellingPrice: "20.00", cost: "8.00", currentCost: "8.00",
      stockQuantity: 5, reservedQuantity: 0, allowOversold: false, orderCategory: "local",
    });
    const preorderProductInsert = await db!.insert(products).values({
      name: `${qaKey} 预售商品`, sku: `${qaKey}-P`.slice(0, 30), keyword: `${qaKey}-P`.slice(0, 50),
      type: "physical", status: "active", sellingPrice: "30.00", cost: "12.00", currentCost: "12.00",
      stockQuantity: 10, reservedQuantity: 0, allowPresale: true, allowOversold: true, orderCategory: "local",
    });
    const normalProductId = asInsertId(normalProductInsert);
    const preorderProductId = asInsertId(preorderProductInsert);
    productIds.push(normalProductId, preorderProductId);

    const roomInsert = await db!.insert(liveRooms).values({
      name: `${qaKey} 正式直播`, liveDate: new Date(), liveType: "normal", status: "live", notes: qaKey,
    });
    liveRoomId = asInsertId(roomInsert);

    const normalLiveProductInsert = await db!.insert(liveRoomProducts).values({
      liveRoomId, productId: normalProductId, keyword: "QAN", displayName: `${qaKey} 现货商品`, price: "20.00",
      startStock: 5, availableStock: 5, reservedCount: 0, orderedCount: 0, allowPreorder: false, preorderCount: 0, status: "active",
    });
    const preorderLiveProductInsert = await db!.insert(liveRoomProducts).values({
      liveRoomId, productId: preorderProductId, keyword: "QAP", displayName: `${qaKey} 预售商品`, price: "30.00",
      startStock: 10, availableStock: 10, reservedCount: 0, orderedCount: 0, allowPreorder: true, preorderCount: 0, status: "active",
    });
    const normalLiveProductId = asInsertId(normalLiveProductInsert);
    const preorderLiveProductId = asInsertId(preorderLiveProductInsert);
    liveProductIds.push(normalLiveProductId, preorderLiveProductId);

    // 管理员在直播内补 2 件，必须同步主商品库存与可售数。
    const adjusted = await adjustLiveRoomProductStock(normalLiveProductId, { quantityChange: 2, reason: "other" });
    expect(adjusted).toMatchObject({ startStock: 7, availableStock: 7 });
    const [liveAdjustment] = await db!.select().from(inventoryAdjustments)
      .where(eq(inventoryAdjustments.productId, normalProductId));
    expect(liveAdjustment).toMatchObject({
      productId: normalProductId,
      adjustmentType: "other",
      quantityChange: 2,
      adjustedBy: "live_management",
    });
    expect(liveAdjustment.reason).toContain("直播库存调整");

    const normalCapture = await createOrderFromLiveCapture({
      commenterName: `${qaKey} 客户 1`, commenterPsid: `${qaKey}-PSID-1`, commentMessage: "QAN x2",
      commentId: `${qaKey}-COMMENT-N`, liveRoomId, liveType: "normal",
      matchedProducts: [{ keyword: "QAN", quantity: 2, productId: normalProductId, productName: `${qaKey} 现货商品`, productSku: `${qaKey}-N`.slice(0, 30), unitPrice: "20.00", liveRoomProductId: normalLiveProductId, isPreorder: false }],
    });
    orderIds.push(normalCapture.orderId);

    const preorderCapture = await createOrderFromLiveCapture({
      commenterName: `${qaKey} 客户 2`, commenterPsid: `${qaKey}-PSID-2`, commentMessage: "QAP x12",
      commentId: `${qaKey}-COMMENT-P`, liveRoomId, liveType: "normal",
      matchedProducts: [{ keyword: "QAP", quantity: 12, productId: preorderProductId, productName: `${qaKey} 预售商品`, productSku: `${qaKey}-P`.slice(0, 30), unitPrice: "30.00", liveRoomProductId: preorderLiveProductId }],
    });
    orderIds.push(preorderCapture.orderId);

    const [normalProduct, preorderProduct] = await db!.select().from(products).where(inArray(products.id, productIds));
    expect(Number(normalProduct.stockQuantity)).toBe(5); // 5 + 2 直播补货 - 2 成功现货订单
    expect(Number(preorderProduct.stockQuantity)).toBe(-2); // 库存 10 成功下单 12，商品级预售允许负库存

    const [normalLiveProduct, preorderLiveProduct] = await db!.select().from(liveRoomProducts).where(inArray(liveRoomProducts.id, liveProductIds));
    expect(Number(normalLiveProduct.startStock)).toBe(7);
    expect(Number(normalLiveProduct.availableStock)).toBe(5);
    expect(Number(normalLiveProduct.reservedCount)).toBe(2);
    expect(Number(normalLiveProduct.orderedCount)).toBe(2);
    expect(Number(preorderLiveProduct.startStock)).toBe(10);
    expect(Number(preorderLiveProduct.availableStock)).toBe(0);
    expect(Number(preorderLiveProduct.reservedCount)).toBe(12);
    expect(Number(preorderLiveProduct.orderedCount)).toBe(12);
    expect(Number(preorderLiveProduct.preorderCount)).toBe(0);

    const purchase = await createPurchaseOrder({
      supplierId,
      notes: qaKey,
      items: [{ productId: preorderProductId, quantity: 15, unitCost: "12.00", subtotal: "180.00" }],
    });
    purchaseOrderIds.push(purchase.poId);
    await receivePurchaseOrder(purchase.poId);
    const [restockedProduct] = await db!.select({ stockQuantity: products.stockQuantity }).from(products).where(eq(products.id, preorderProductId));
    expect(Number(restockedProduct.stockQuantity)).toBe(13); // -2 + 本次入库 15 = 13

    const hasStageRow = (rows: Array<{ orderId: number; quantity: number }>, orderId: number, quantity: number) =>
      rows.some((row) => Number(row.orderId) === orderId && Number(row.quantity) === quantity);
    expect(hasStageRow(await getProductOrderDetails(normalProductId, "ordered"), normalCapture.orderId, 2)).toBe(true);
    expect(hasStageRow(await getProductOrderDetails(preorderProductId, "ordered"), preorderCapture.orderId, 12)).toBe(true);

    await updateOrderStatus(normalCapture.orderId, { physicalStatus: "packing" });
    expect(hasStageRow(await getProductOrderDetails(normalProductId, "paid"), normalCapture.orderId, 2)).toBe(true);
    expect((await getProductOrderDetails(normalProductId, "ordered")).some((row) => Number(row.orderId) === normalCapture.orderId)).toBe(false);

    await updateOrderStatus(normalCapture.orderId, { physicalStatus: "shipped" });
    expect(hasStageRow(await getProductOrderDetails(normalProductId, "completed"), normalCapture.orderId, 2)).toBe(true);
    expect((await getProductOrderDetails(normalProductId, "paid")).some((row) => Number(row.orderId) === normalCapture.orderId)).toBe(false);

    // 即使管理员将直播起始库存下调低于已保留数，直播页也不可出现负数可售量。
    const trimmed = await adjustLiveRoomProductStock(normalLiveProductId, { quantityChange: -20, reason: "other" });
    expect(trimmed).toMatchObject({ startStock: 0, availableStock: 0 });
    const [trimmedProduct] = await db!.select({ stockQuantity: products.stockQuantity }).from(products).where(eq(products.id, normalProductId));
    expect(Number(trimmedProduct.stockQuantity)).toBe(0);
    const adjustments = await db!.select().from(inventoryAdjustments)
      .where(eq(inventoryAdjustments.productId, normalProductId));
    expect(adjustments).toHaveLength(2);
  }, 45_000);

  it("黑名单客户的直播留言不会建立订单、占用库存或写入直播捉单记录", async () => {
    const db = await getDb();
    expect(db, "DATABASE_URL 必须可用，才可进行真实隔离演练").toBeTruthy();
    await cleanupQaRows();

    const blacklistedCode = `QALB${Date.now().toString().slice(-10)}`;
    const blacklistedName = `${qaKey} 黑名单客户`;
    const blacklistedInsert = await db!.insert(customers).values({
      customerId: blacklistedCode,
      name: blacklistedName,
      displayName: blacklistedName,
      facebookName: blacklistedName,
      messengerId: `${qaKey}-BLACKLISTED-PSID`,
      customerSource: "facebook_live",
      isBlacklisted: true,
      blacklistReason: "QA validation",
    });
    const blacklistedCustomerId = asInsertId(blacklistedInsert);
    customerIds.push(blacklistedCustomerId);
    qaCustomerCodes.push(blacklistedCode);

    await expect(createOrderFromLiveCapture({
      commenterName: blacklistedName,
      commenterPsid: `${qaKey}-BLACKLISTED-PSID`,
      commentMessage: "QA-BLACKLISTED",
      commentId: `${qaKey}-BLACKLISTED-COMMENT`,
      liveType: "normal",
      matchedProducts: [],
    })).rejects.toThrow("CUSTOMER_BLACKLISTED");

    const blacklistedOrders = await db!.select({ id: orders.id })
      .from(orders)
      .where(eq(orders.customerId, blacklistedCustomerId));
    expect(blacklistedOrders).toHaveLength(0);
  }, 20_000);
});
