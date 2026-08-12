import { afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  autoMatchXtcOrders,
  createChinaPreorderWithAutoIB,
  getCNEligibleLiveSessions,
  getCNMergedProducts,
  getCnIbBatchDetail,
  getCnIbCostProfit,
  getDb,
  lockImportBatch,
  processExpiredCNOrders,
  unlockImportBatch,
} from "./db";
import {
  cnChangeLogs,
  customers,
  importBatchChangeLogs,
  importBatchItems,
  importBatches,
  liveRoomProducts,
  liveRooms,
  orderItems,
  orderOperationLogs,
  orderPayments,
  orderStatusLogs,
  orders,
  products,
} from "../drizzle/schema";

/**
 * A real-database, service-layer QA drill. Every row has a QA-CNIB marker and
 * is removed in reverse dependency order after the assertion sequence, so the
 * production data set remains untouched.
 */
describe.sequential("CN/IB 隔离端到端演练", () => {
  const qaKey = `QA-CNIB-E2E-${Date.now()}`;
  const qaCustomerCode = `QA${Date.now().toString().slice(-12)}`;
  let customerId: number | undefined;
  let productId: number | undefined;
  let liveRoomIds: number[] = [];
  let orderIds: number[] = [];
  let batchIds: number[] = [];

  const asInsertId = (result: any) => Number(result?.[0]?.insertId ?? result?.insertId);
  const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
  const daysAgo = (days: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return dateOnly(date);
  };

  async function cleanupQaRows() {
    const db = await getDb();
    if (!db) return;

    if (batchIds.length > 0) {
      await db.delete(importBatchChangeLogs).where(inArray(importBatchChangeLogs.ibId, batchIds));
      await db.delete(cnChangeLogs).where(inArray(cnChangeLogs.cnId, batchIds));
      await db.delete(importBatchItems).where(inArray(importBatchItems.batchId, batchIds));
      await db.delete(importBatches).where(inArray(importBatches.id, batchIds));
    }
    if (orderIds.length > 0) {
      await db.delete(orderPayments).where(inArray(orderPayments.orderId, orderIds));
      await db.delete(orderOperationLogs).where(inArray(orderOperationLogs.orderId, orderIds));
      await db.delete(orderStatusLogs).where(inArray(orderStatusLogs.orderId, orderIds));
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }
    if (liveRoomIds.length > 0) {
      await db.delete(liveRoomProducts).where(inArray(liveRoomProducts.liveRoomId, liveRoomIds));
      await db.delete(liveRooms).where(inArray(liveRooms.id, liveRoomIds));
    }
    if (productId) await db.delete(products).where(eq(products.id, productId));
    if (customerId) await db.delete(customers).where(eq(customers.id, customerId));
  }

  afterEach(async () => {
    await cleanupQaRows();
  });

  it("用三场中国代购直播验证CN合并、自动IB、超期取消保护与IB锁定审计", async () => {
    const db = await getDb();
    expect(db, "DATABASE_URL 必须可用，才可进行真实隔离演练").toBeTruthy();
    await cleanupQaRows();

    const customerInsert = await db!.insert(customers).values({
      customerId: qaCustomerCode,
      name: `${qaKey} 客户`,
      displayName: `${qaKey} 客户`,
      phoneNumber: "0190000000",
      customerSource: "admin",
    });
    customerId = asInsertId(customerInsert);

    const productInsert = await db!.insert(products).values({
      name: `${qaKey} 合并商品`,
      type: "physical",
      keyword: `${qaKey}-KW`.slice(0, 50),
      sku: `${qaKey}-SKU`.slice(0, 30),
      status: "active",
      sellingPrice: "20.00",
      currentCost: "8.00",
      cost: "8.00",
      stockQuantity: 50,
      reservedQuantity: 0,
    });
    productId = asInsertId(productInsert);

    const startDate = daysAgo(7);
    const endDate = daysAgo(4);
    const liveDates = [daysAgo(7), daysAgo(6), daysAgo(5)];
    for (const [index, liveDate] of liveDates.entries()) {
      const roomInsert = await db!.insert(liveRooms).values({
        name: `${qaKey} 中国代购直播 ${index + 1}`,
        liveDate: new Date(`${liveDate}T12:00:00.000Z`),
        liveType: "import_preorder",
        status: "ended",
        preorderStartDate: new Date(`${startDate}T00:00:00.000Z`),
        preorderEndDate: new Date(`${endDate}T23:59:59.999Z`),
        notes: `${qaKey} 隔离演练`,
      });
      const liveRoomId = asInsertId(roomInsert);
      liveRoomIds.push(liveRoomId);
      await db!.insert(liveRoomProducts).values({
        liveRoomId,
        productId: productId!,
        keyword: `${qaKey}-L${index + 1}`.slice(0, 50),
        displayName: `${qaKey} 合并商品`,
        price: "20.00",
        startStock: 50,
        reservedCount: 0,
        availableStock: 50,
        orderedCount: 0,
        allowPreorder: true,
        preorderCount: 0,
        status: "active",
      });
    }

    const orderDefinitions = [
      { suffix: "PAID", liveRoomId: liveRoomIds[0], physicalStatus: "packing" as const, importStatus: "waiting_stock" as const, quantity: 2, paidAmount: "40.00", receiptUrl: null },
      { suffix: "UNPAID", liveRoomId: liveRoomIds[1], physicalStatus: "pending" as const, importStatus: "pending" as const, quantity: 3, paidAmount: "0.00", receiptUrl: null },
      { suffix: "PENDING-PROOF", liveRoomId: liveRoomIds[2], physicalStatus: "receipt_uploaded" as const, importStatus: "receipt_uploaded" as const, quantity: 4, paidAmount: "0.00", receiptUrl: "https://example.test/qa-pending-proof.jpg" },
    ];
    for (const orderDefinition of orderDefinitions) {
      const totalAmount = String(orderDefinition.quantity * 20);
      const orderInsert = await db!.insert(orders).values({
        orderNumber: `${qaKey}-${orderDefinition.suffix}`.slice(0, 50),
        customerId: customerId!,
        orderType: "physical",
        salesChannel: "import_preorder",
        orderCategory: "import",
        orderNature: "retail",
        physicalSubtotal: totalAmount,
        totalAmount,
        paidAmount: orderDefinition.paidAmount,
        physicalStatus: orderDefinition.physicalStatus,
        importStatus: orderDefinition.importStatus,
        orderSource: "manual",
        liveRoomId: orderDefinition.liveRoomId,
        receiptUrl: orderDefinition.receiptUrl,
        paymentUploadedAt: orderDefinition.receiptUrl ? new Date() : null,
      });
      const orderId = asInsertId(orderInsert);
      orderIds.push(orderId);
      await db!.insert(orderItems).values({
        orderId,
        productId: productId!,
        productName: `${qaKey} 合并商品`,
        productSku: `${qaKey}-SKU`.slice(0, 100),
        productType: "physical",
        quantity: orderDefinition.quantity,
        unitPrice: "20.00",
        unitCost: "8.00",
        subtotal: totalAmount,
        itemSource: "admin",
        salesMode: "import_preorder",
      });
    }

    await db!.insert(orderPayments).values({
      orderId: orderIds[2],
      amount: "80.00",
      paymentDate: new Date(),
      paymentMethod: "Online Transfer",
      receiptUrl: "https://example.test/qa-pending-proof.jpg",
      paymentSource: "customer_upload",
      reviewStatus: "pending",
    });

    const eligibleSessions = await getCNEligibleLiveSessions(startDate, endDate);
    const eligibleQaSessionIds = eligibleSessions.filter(session => session.name.startsWith(qaKey)).map(session => session.id);
    expect(eligibleQaSessionIds).toEqual([...liveRoomIds].reverse());

    const mergedProducts = await getCNMergedProducts(liveRoomIds);
    expect(mergedProducts).toHaveLength(1);
    expect(mergedProducts[0]).toMatchObject({
      productId,
      liveSessionCount: 3,
      orderedQuantity: 7,
      paidQuantity: 2,
      completedQuantity: 0,
    });

    const cnResult = await createChinaPreorderWithAutoIB({
      startDate,
      endDate,
      batchName: `${qaKey} CN`,
      supplierName: `${qaKey} 供应商`,
      liveSessionIds: liveRoomIds,
      operatorId: 1,
      items: [{
        productId: productId!,
        productName: `${qaKey} 合并商品`,
        paidQuantity: 2,
        finalPurchaseQuantity: 2,
        unitPurchaseCost: "8.00",
      }],
    });
    batchIds = [cnResult.cnId, cnResult.ibId];
    expect(cnResult.linkedOrderCount).toBe(3);
    expect(cnResult.paymentDeadline).toBe(daysAgo(2));

    const linkedOrders = await db!.select().from(orders).where(inArray(orders.id, orderIds));
    expect(linkedOrders.every(order => order.importBatchId === cnResult.cnId)).toBe(true);
    const [cn] = await db!.select().from(importBatches).where(eq(importBatches.id, cnResult.cnId));
    const [ib] = await db!.select().from(importBatches).where(eq(importBatches.id, cnResult.ibId));
    expect(cn).toMatchObject({ documentType: "cn", autoIbId: cnResult.ibId });
    expect(dateOnly(cn!.paymentDeadline as Date)).toBe(cnResult.paymentDeadline);
    expect(ib).toMatchObject({ documentType: "ib", cnId: cnResult.cnId, status: "in_progress" });

    const expiryResult = await processExpiredCNOrders();
    expect(expiryResult.cancelled.map(order => order.id)).toContain(orderIds[1]);
    expect(expiryResult.cancelled.map(order => order.id)).not.toContain(orderIds[2]);
    const [unpaidAfterExpiry] = await db!.select().from(orders).where(eq(orders.id, orderIds[1]));
    const [pendingProofAfterExpiry] = await db!.select().from(orders).where(eq(orders.id, orderIds[2]));
    expect(unpaidAfterExpiry).toMatchObject({ physicalStatus: "cancelled", importStatus: "cancelled" });
    expect(pendingProofAfterExpiry).toMatchObject({ physicalStatus: "receipt_uploaded", importStatus: "receipt_uploaded" });

    // Orders are saved against CN. The automatic IB must resolve cnId and read
    // all three CN orders instead of querying its own IB ID and returning none.
    const ibDetail = await getCnIbBatchDetail(cnResult.ibId);
    expect(ibDetail?.linkedOrders.map(order => order.id).sort((a, b) => a - b)).toEqual([...orderIds].sort((a, b) => a - b));
    const ibCostProfit = await getCnIbCostProfit(cnResult.ibId);
    expect(ibCostProfit?.totalOrders).toBe(3);
    const autoMatchResult = await autoMatchXtcOrders(cnResult.ibId);
    expect(autoMatchResult.map(order => order.orderId).sort((a, b) => a - b)).toEqual([orderIds[0], orderIds[2]].sort((a, b) => a - b));

    await lockImportBatch(cnResult.ibId, 1);
    const [lockedIb] = await db!.select().from(importBatches).where(eq(importBatches.id, cnResult.ibId));
    expect(lockedIb).toMatchObject({ isLocked: true, lockedBy: 1 });
    await expect(unlockImportBatch(cnResult.ibId, 1, "   ")).rejects.toThrow("解锁 IB 必须填写原因");
    await unlockImportBatch(cnResult.ibId, 1, `${qaKey} 演练完成后复核`);
    const [unlockedIb] = await db!.select().from(importBatches).where(eq(importBatches.id, cnResult.ibId));
    expect(unlockedIb).toMatchObject({ isLocked: false, unlockReason: `${qaKey} 演练完成后复核` });
    const ibAuditRows = await db!.select().from(importBatchChangeLogs).where(eq(importBatchChangeLogs.ibId, cnResult.ibId));
    expect(ibAuditRows.map(row => row.field)).toEqual(expect.arrayContaining(["lock", "unlockReason"]));
  }, 30_000);
});
