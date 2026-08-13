import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(projectRoot, relativePath), "utf8");

describe("移动端商城、后台与A5包货单回归", () => {
  const homeSource = source("client/src/pages/mall/MallHome.tsx");
  const checkoutSource = source("client/src/pages/mall/MallCheckout.tsx");
  const cartSource = source("client/src/pages/mall/MallCart.tsx");
  const productDetailSource = source("client/src/pages/mall/MallProductDetail.tsx");
  const dashboardLayoutSource = source("client/src/components/DashboardLayout.tsx");
  const ordersSource = source("client/src/pages/Orders.tsx");
  const packingSource = source("client/src/pages/Packing.tsx");

  it("商城首页与结账在手机上保持可收缩容器和单列输入网格", () => {
    expect(homeSource).toContain("min-w-0");
    expect(homeSource).toContain("overflow-x-hidden");
    expect(checkoutSource).toContain('grid grid-cols-1 gap-3 sm:grid-cols-2');
    expect(checkoutSource).toContain('grid grid-cols-1 gap-3 sm:grid-cols-3');
  });

  it("商城英文模式完整翻译槟城Lalamove配送提示", () => {
    expect(checkoutSource).toContain("Lalamove delivery is available in Penang. Free delivery from RM150; otherwise RM15.");
    expect(checkoutSource).toContain("槟城支持 Lalamove 配送");
    expect(checkoutSource).toContain("translate(");
  });

  it("商城商品详情和购物车在手机端允许文字收缩、操作换行且不以固定宽度撑出视口", () => {
    expect(productDetailSource).toContain("min-w-0");
    expect(productDetailSource).toContain("overflow-x-hidden");
    expect(productDetailSource).toContain("grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2");
    expect(cartSource).toContain("min-w-0");
    expect(cartSource).toContain("flex flex-col gap-3 sm:flex-row");
    expect(cartSource).toContain("line-clamp-1");
  });

  it("后台在手机上使用可收缩主内容区和移动顶栏，避免固定宽度裁切", () => {
    expect(dashboardLayoutSource).toContain('SidebarInset className="w-full min-w-0 max-w-full overflow-x-hidden"');
    expect(dashboardLayoutSource).toContain('main className="min-w-0 max-w-full flex-1 overflow-x-hidden p-3 sm:p-4"');
    expect(dashboardLayoutSource).toContain("isMobile && (");
    expect(ordersSource).toContain("overflow-x-auto");
    expect(packingSource).toContain("flex-col items-stretch");
  });

  it("A5包货单按参考层级突出配送方式、订单号、姓名、商品数量和备注", () => {
    expect(packingSource).toContain("width:148mm;min-height:210mm");
    expect(packingSource).toContain("shippingLabel");
    expect(packingSource).toContain("font-size:26px");
    expect(packingSource).toContain("data.orderNumber");
    expect(packingSource).toContain("font-size:25px");
    expect(packingSource).toContain("font-size:17px;font-weight:800");
    expect(packingSource).toContain("font-size:31px");
    expect(packingSource).toContain("订单备注");
    expect(packingSource).toContain("font-size:16px;margin-bottom:5px");
  });
});
