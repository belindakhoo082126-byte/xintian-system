import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("商城分类与特别订单筛选回归", () => {
  it("商城首页使用公开分类接口，并将分类点击同步为商品 categoryId 筛选", () => {
    const mallHome = readProjectFile("client/src/pages/mall/MallHome.tsx");

    expect(mallHome).toContain("trpc.mall.categories.useQuery");
    expect(mallHome).toContain("trpc.mall.products.useQuery({ categoryId");
    expect(mallHome).toContain("setLocation(`/mall?categoryId=${id}`)");
    expect(mallHome).toContain("onClick={() => handleCategoryClick(c.id)}");
  });

  it("商城分类仅读取商品管理中已启用且允许在商城显示的分类", () => {
    const db = readProjectFile("server/db.ts");

    expect(db).toContain('eq(categories.status, "active")');
    expect(db).toContain("eq(categories.showInStore, true)");
  });

  it("Dashboard 显示特别状态的触发逻辑，包货工作台公开七类分类筛选", () => {
    const dashboard = readProjectFile("client/src/pages/Dashboard.tsx");
    const packing = readProjectFile("client/src/pages/Packing.tsx");

    expect(dashboard).toContain("SPECIAL_STATUS_EXPLANATIONS");
    expect(dashboard).toContain("East Malaysia actual shipping or Lalamove balance");
    expect(dashboard).toContain("结单、追踪号码或自动通知发送失败");
    expect(packing).toContain("(isScheduledTab || isSpecialTab)");
    expect(packing).toContain("SPECIAL_ORDER_FILTER_OPTIONS.map");
  });
});
