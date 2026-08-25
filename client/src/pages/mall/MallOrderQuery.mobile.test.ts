import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MallOrderQuery mobile layout", () => {
  it("uses mobile order-item cards while preserving the desktop table", () => {
    const source = readFileSync(new URL("./MallOrderQuery.tsx", import.meta.url), "utf8");

    expect(source).toContain('className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"');
    expect(source).toContain('className="space-y-2 md:hidden" aria-label="订单商品"');
    expect(source).toContain('className="hidden md:table"');
    expect(source).toContain("规格：{item.variationName || \"-\"}");
    expect(source).toContain("flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between");
  });
});
