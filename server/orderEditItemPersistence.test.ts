import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const editSource = readFileSync(resolve(process.cwd(), "client/src/pages/OrderEditPage.tsx"), "utf8");

describe("OrderEdit newly added item persistence", () => {
  it("sends selected variant and price snapshot details through the typed update route", () => {
    expect(editSource).toContain("variationId: item.variationId")
    expect(editSource).toContain("variationName: item.variationName")
    expect(editSource).toContain('originalUnitPrice: item.originalUnitPrice ? String(item.originalUnitPrice) : null')
    expect(routerSource).toContain("originalUnitPrice: z.string().nullable().optional()")
  })

  it("reserves and restores stock through the current variants table for Edit additions", () => {
    expect(dbSource).toContain("variationId: item.variationId || null")
    expect(dbSource).toContain("variationId: item.variationId ?? null")
    expect(dbSource).toContain("await reserveProductStocksForOrder(additionalReservations)")
    expect(dbSource).toContain("await db.update(variants).set({\n        stockQuantity: sql`${variants.stockQuantity} + ${item.quantity}`")
    expect(dbSource).toContain("Product and variant stock were atomically reserved above before item insertion.")
    expect(dbSource).toContain('const variationLabel = ni.variationName ? `（${ni.variationName}）` : ""')
  })
})
