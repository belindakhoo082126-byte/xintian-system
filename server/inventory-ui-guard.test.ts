import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const orderCreateSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/OrderCreatePage.tsx"), "utf8");
const productsSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/ProductsV2.tsx"), "utf8");
const routerSource = fs.readFileSync(path.resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("库存提示与商品级预售快捷控制", () => {
  it("marks quantity inputs and disables preview and submission when an ordinary physical product exceeds available stock", () => {
    expect(orderCreateSource).toContain("const hasStockShortage = stockShortageItems.length > 0");
    expect(orderCreateSource).toContain("border-destructive text-destructive");
    expect(orderCreateSource).toContain("库存不足：可售库存只剩");
    expect(orderCreateSource).toContain("disabled={manualItems.length === 0 || hasStockShortage}");
    expect(orderCreateSource).toContain("disabled={isSubmitting || manualItems.length === 0 || hasStockShortage}");
  });

  it("provides a persisted inline product-level presale switch for physical products", () => {
    expect(routerSource).toContain("allowOversold: z.boolean().optional()");
    expect(productsSource).toContain("updateMutation.mutate({ id: p.id, allowPresale })");
    expect(productsSource).toContain("Allow presale");
  });
});
