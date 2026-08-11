import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product source-of-truth safeguards", () => {
  const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

  it("uses the physical order status column when calculating reserved quantity", () => {
    const queryBlock = source.slice(
      source.indexOf("export async function getProductsEnhanced"),
      source.indexOf("export async function getProductByIdEnhanced"),
    );

    expect(queryBlock).toContain("o.physicalStatus IN ('pending', 'hold_order', 'partial_payment')");
    expect(queryBlock).not.toContain("o.status IN ('pending', 'checkout', 'confirmed')");
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
