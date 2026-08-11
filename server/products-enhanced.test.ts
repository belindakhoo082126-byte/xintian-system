import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product source-of-truth safeguards", () => {
  const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

  it("uses the physical order status column when calculating reserved quantity", () => {
    const queryBlock = source.slice(
      source.indexOf("export async function getProductsEnhanced"),
      source.indexOf("export async function getProductByIdEnhanced"),
    );

    expect(queryBlock).toContain("o.physicalStatus IN ('pending', 'hold_order', 'partial_payment', 'receipt_uploaded', 'packing', 'partial_shipped')");
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

  it("uses the same order state groups when exposing product order details", () => {
    const detailBlock = source.slice(
      source.indexOf("export async function getProductOrderDetails"),
      source.indexOf("export async function getProductByIdEnhanced"),
    );

    expect(detailBlock).toContain("'pending', 'hold_order', 'partial_payment', 'receipt_uploaded', 'packing', 'partial_shipped'");
    expect(detailBlock).toContain("'shipped', 'completed'");
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
