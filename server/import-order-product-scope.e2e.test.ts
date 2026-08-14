import { afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  addMallItemsToOrder,
  assertChinaImportOrderItemsEligible,
  createOrderWithSplit,
  getDb,
} from "./db";
import { approveDraftOrder } from "./businessAi";
import { customers, draftOrders, orders, products } from "../drizzle/schema";

/**
 * Exercises the three real import-order entry points using disposable QA data.
 * Every tested rejection happens before any stock reservation or order item write.
 */
describe.sequential("中国代购商品范围隔离行为验证", () => {
  const qaKey = `QA-IMPORT-SCOPE-${Date.now()}`;
  const customerCode = `QAI${Date.now().toString().slice(-11)}`;
  const skuBase = `QIS${Date.now().toString().slice(-10)}`;
  const blockedSku = `${skuBase}B`;
  const allowedSku = `${skuBase}A`;

  async function cleanup() {
    const db = await getDb();
    if (!db) return;
    const markedOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.facebookName, qaKey));
    const orderIds = markedOrders.map((row) => Number(row.id));
    if (orderIds.length > 0) await db.delete(orders).where(inArray(orders.id, orderIds));
    await db.delete(draftOrders).where(eq(draftOrders.draftNumber, `${qaKey}-DRAFT`));
    await db.delete(products).where(inArray(products.sku, [blockedSku, allowedSku]));
    await db.delete(customers).where(eq(customers.customerId, customerCode));
  }

  afterEach(cleanup);

  it("后台建单与商城加单拒绝普通商品进入 XTC；AI 普通草稿在无代购上下文时维持 XT", async () => {
    const db = await getDb();
    expect(db, "DATABASE_URL 必须可用，才可进行真实隔离演练").toBeTruthy();
    await cleanup();

    const customerInsert = await db!.insert(customers).values({
      customerId: customerCode,
      name: qaKey,
      displayName: qaKey,
      customerSource: "admin",
    });
    const customerId = Number((customerInsert as any)?.[0]?.insertId ?? (customerInsert as any)?.insertId);
    const blockedInsert = await db!.insert(products).values({
      name: `${qaKey} 普通商品`, sku: blockedSku, keyword: `${skuBase}B`,
      type: "physical", status: "active", sellingPrice: "10.00", cost: "4.00", currentCost: "4.00",
      stockQuantity: 2, reservedQuantity: 0, allowOversold: false, salesMode: "normal", orderCategory: "local", allowImportOrder: false,
    });
    const allowedInsert = await db!.insert(products).values({
      name: `${qaKey} 中国代购商品`, sku: allowedSku, keyword: `${skuBase}A`,
      type: "physical", status: "active", sellingPrice: "10.00", cost: "4.00", currentCost: "4.00",
      stockQuantity: 2, reservedQuantity: 0, allowOversold: false, salesMode: "import_preorder", orderCategory: "import",
    });
    const blockedProductId = Number((blockedInsert as any)?.[0]?.insertId ?? (blockedInsert as any)?.insertId);
    const allowedProductId = Number((allowedInsert as any)?.[0]?.insertId ?? (allowedInsert as any)?.insertId);

    await expect(assertChinaImportOrderItemsEligible([allowedProductId])).resolves.toBeUndefined();
    await expect(createOrderWithSplit({
      customerId,
      facebookName: qaKey,
      orderCategory: "import",
      items: [{ productId: blockedProductId, productName: `${qaKey} 普通商品`, productType: "physical", quantity: 1, unitPrice: "10.00", subtotal: "10.00" }],
    })).rejects.toThrow(/中国代购|代购/);

    const orderInsert = await db!.insert(orders).values({
      orderNumber: `${qaKey}-ORDER`.slice(0, 50), secureToken: `${qaKey}-TOKEN`.slice(0, 255), checkoutLink: `/order/${qaKey}`,
      customerId, facebookName: qaKey, orderType: "physical", totalAmount: "0.00", paidAmount: "0.00",
      physicalStatus: "pending", orderCategory: "import", importStatus: "pending", orderSource: "store",
    });
    const orderId = Number((orderInsert as any)?.[0]?.insertId ?? (orderInsert as any)?.insertId);
    await expect(addMallItemsToOrder(orderId, [{
      productId: blockedProductId, productName: `${qaKey} 普通商品`, quantity: 1, unitPrice: "10.00", subtotal: "10.00",
    }])).rejects.toThrow(/中国代购|代购/);

    const draftInsert = await db!.insert(draftOrders).values({
      draftNumber: `${qaKey}-DRAFT`, customerId, customerName: qaKey, platform: "messenger", totalAmount: "10.00",
      items: [{ productId: blockedProductId, productName: `${qaKey} 普通商品`, quantity: 1, price: 10 }],
      status: "waiting_approval",
    });
    const draftId = Number((draftInsert as any)?.[0]?.insertId ?? (draftInsert as any)?.insertId);
    const approved = await approveDraftOrder(draftId, "qa-import-scope");
    const [approvedOrder] = await db!.select({ orderCategory: orders.orderCategory })
      .from(orders).where(eq(orders.id, approved.orderId)).limit(1);
    expect(approvedOrder?.orderCategory).toBe("local");
  }, 20_000);
});
