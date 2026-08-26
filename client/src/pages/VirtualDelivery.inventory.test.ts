import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./VirtualDelivery.tsx", import.meta.url), "utf8");

describe("虚拟交付库存与订单阶段展示", () => {
  it("材料包显示库存、可售、规格关键词与库存日志，会员保留非库存提示", () => {
    expect(source).toContain("库存日志");
    expect(source).toContain("库存 {Number(inventory.stockQuantity || 0)}");
    expect(source).toContain("可售 {Number(inventory.availableQuantity || 0)}");
    expect(source).toContain("关键词");
    expect(source).toContain("非库存交付：仅追踪订单阶段");
  });

  it("三种订单阶段均可查看与商品管理相同口径的明细", () => {
    expect(source).toContain("已下单");
    expect(source).toContain("已汇款");
    expect(source).toContain("已完成");
    expect(source).toContain("trpc.productsV2.orderDetails.useQuery");
    expect(source).toContain("trpc.products.stockMovements.useQuery");
  });
});
