import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product source-of-truth safeguards", () => {
  const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

  it("uses the physical order status column with mutually exclusive ordered and paid stages", () => {
    const queryBlock = source.slice(
      source.indexOf("export async function getProductsEnhanced"),
      source.indexOf("export async function getProductByIdEnhanced"),
    );

    expect(queryBlock).toContain("o.physicalStatus IN ('pending', 'hold_order', 'partial_payment', 'receipt_uploaded')");
    expect(queryBlock).toContain("o.physicalStatus IN ('packing', 'scheduled', 'partial_shipped')");
    expect(queryBlock).toContain("AS paidQty");
    expect(queryBlock).toContain("GREATEST(oi.quantity - COALESCE(shipped_items.shippedQty, 0), 0)");
    expect(queryBlock).not.toContain("o.status IN ('pending', 'checkout', 'confirmed')");
  });

  it("supports a configurable low-stock threshold using the less-than rule", () => {
    const queryBlock = source.slice(
      source.indexOf("export async function getProductsEnhanced"),
      source.indexOf("export async function getProductByIdEnhanced"),
    );

    expect(queryBlock).toContain("stockThreshold?: number");
    expect(queryBlock).toContain("params.stockThreshold ?? 5");
    expect(queryBlock).toContain("lt(products.stockQuantity, stockThreshold)");
  });

  it("supports inventory anomaly filtering for physical products with negative stock", () => {
    const queryBlock = source.slice(
      source.indexOf("export async function getProductsEnhanced"),
      source.indexOf("export async function getProductByIdEnhanced"),
    );

    expect(queryBlock).toContain("params.stockFilter === 'anomaly'");
    expect(queryBlock).toContain("eq(products.type, 'physical')");
    expect(queryBlock).toContain("lt(products.stockQuantity, 0)");
  });

  it("records supplier-specific quick restocks as a received purchase, FIFO lot, and purchase ledger entry", () => {
    expect(source).toContain("export async function quickRestockProduct");
    expect(source).toContain("export async function getLatestSupplierProductCost");
    expect(source).toContain('status: "received"');
    expect(source).toContain("INSERT INTO inventory_lots");
    expect(source).toContain("'purchase', 'quick_restock'");
  });

  it("allocates supplier lots to order sales with FIFO cost records without deducting product stock twice", () => {
    const fifoBlock = source.slice(
      source.indexOf("async function allocateFifoCostForSale"),
      source.indexOf("// ============================================================================\n// Profit Report helpers"),
    );
    expect(fifoBlock).toContain("ORDER BY purchase_date ASC, id ASC");
    expect(fifoBlock).toContain("remaining_quantity = remaining_quantity -");
    expect(fifoBlock).toContain("'sale', 'order_sale'");
    expect(fifoBlock).not.toContain("stockQuantity: sql");

    const createOrderBlock = source.slice(
      source.indexOf("export async function createOrderWithSplit"),
      source.indexOf("export async function updateOrderStatus"),
    );
    expect(createOrderBlock).toContain("await allocateFifoCostForSale({ orderId, productId: item.productId, quantity: item.quantity");
  });

  it("uses the same mutually exclusive order stage groups when exposing product order details", () => {
    const detailBlock = source.slice(
      source.indexOf("export async function getProductOrderDetails"),
      source.indexOf("export async function getProductByIdEnhanced"),
    );

    expect(detailBlock).toContain("'pending', 'hold_order', 'partial_payment', 'receipt_uploaded'");
    expect(detailBlock).toContain("'packing', 'scheduled', 'partial_shipped'");
    expect(detailBlock).toContain("'shipped', 'completed'");
    expect(detailBlock).toContain("GREATEST(oi.quantity - COALESCE(shipped_items.shippedQty, 0), 0)");
    expect(detailBlock).toContain("o.orderNumber AS orderNumber");
    expect(detailBlock).toContain("customerName");
  });

  it("reads live-room product identity from products and ignores orphaned live-room rows", () => {
    const liveProductsBlock = source.slice(
      source.indexOf("export async function getLiveRoomProducts"),
      source.indexOf("export async function addLiveRoomProduct"),
    );

    expect(liveProductsBlock).toContain("if (!product) continue;");
    expect(liveProductsBlock).toContain("productName: product.name");
    expect(liveProductsBlock).toContain("coverImageUrl: product.coverImageUrl");
    expect(liveProductsBlock).not.toContain("productInfos[pid]?.name || row.displayName");
  });
});
