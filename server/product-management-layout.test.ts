import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product management responsive layout", () => {
  const source = readFileSync(new URL("../client/src/pages/ProductsV2.tsx", import.meta.url), "utf8");
  const desktopBlock = source.slice(source.indexOf("{/* Desktop:"), source.indexOf("{/* Mobile:"));
  const mobileBlock = source.slice(source.indexOf("{/* Mobile:"), source.indexOf("<Dialog open={!!orderDetailsTarget}"));

  it("keeps the desktop listing to the agreed eight operational columns", () => {
    expect(desktopBlock).toContain("商品资料");
    expect(desktopBlock).toContain("类型／模式");
    expect(desktopBlock).toContain("库存资料");
    expect(desktopBlock).toContain("销售设置");
    expect(desktopBlock).toContain("<colgroup>");
    expect(desktopBlock).toContain("table-fixed");
    expect(desktopBlock).not.toContain("<TableHead>{translate(\"关键词\"");
    expect(desktopBlock).not.toContain("<TableHead>{translate(\"商品预售\"");
    expect(desktopBlock).not.toContain("<TableHead>{translate(\"商品标记\"");
  });

  it("keeps the action entry visibly pinned at the right edge and retains all product actions", () => {
    expect(desktopBlock).toContain("sticky right-0");
    expect(desktopBlock).toContain("MoreHorizontal");
    expect(desktopBlock).toContain("查看详情");
    expect(desktopBlock).toContain("编辑商品");
    expect(desktopBlock).toContain("调整库存");
    expect(desktopBlock).toContain("查看库存日志");
    expect(desktopBlock).toContain("复制商品");
    expect(desktopBlock).toContain("下架");
    expect(desktopBlock).toContain("删除");
  });

  it("lets filter controls wrap instead of widening the product list", () => {
    expect(source).toContain("grid-cols-1 gap-3 sm:grid-cols-2");
    expect(source).toContain("xl:grid-cols-[minmax(280px,1fr)_repeat(4,minmax(132px,0.52fr))]");
    expect(source).toContain("<SelectTrigger className=\"w-full\">");
  });

  it("uses cards rather than a horizontal table below the desktop breakpoint", () => {
    expect(mobileBlock).toContain("lg:hidden");
    expect(mobileBlock).toContain("ProductImagePreview");
    expect(mobileBlock).toContain("已下单");
    expect(mobileBlock).toContain("已汇款");
    expect(mobileBlock).toContain("已完成");
    expect(mobileBlock).toContain("查看详情");
    expect(mobileBlock).toContain("DropdownMenu");
  });
});
