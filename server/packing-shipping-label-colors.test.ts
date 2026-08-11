import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packingPage = readFileSync(resolve(process.cwd(), "client/src/pages/Packing.tsx"), "utf8");

describe("包货工作台配送标签颜色", () => {
  it("为用户指定的四种配送方式保留独立颜色映射", () => {
    expect(packingPage).toContain('normalizedLabel.includes("shopee")');
    expect(packingPage).toContain("bg-orange-100 text-orange-800");

    expect(packingPage).toContain('normalizedLabel.includes("lalamove")');
    expect(packingPage).toContain("bg-yellow-100 text-yellow-800");

    expect(packingPage).toContain('normalizedLabel.includes("自取")');
    expect(packingPage).toContain("bg-purple-100 text-purple-800");

    expect(packingPage).toContain('normalizedLabel.includes("poslaju")');
    expect(packingPage).toContain("bg-red-100 text-red-800");
  });

  it("将配送标签样式映射实际应用于包货订单卡片", () => {
    expect(packingPage).toContain("getShippingLabelClassName(order.specialLabel)");
  });
});

