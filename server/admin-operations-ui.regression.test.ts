import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const readClient = (relativePath: string) => fs.readFileSync(path.join(root, "client", "src", relativePath), "utf8");

describe("商品、订单与客服后台操作回归", () => {
  it("订单、商品、组合与包货均复用统一商品图片预览", () => {
    const previewComponent = readClient("components/ProductImagePreview.tsx");
    const productPage = readClient("pages/ProductsV2.tsx");
    const ordersPage = readClient("pages/Orders.tsx");
    const orderBrowsePage = readClient("pages/OrderBrowsePage.tsx");
    const bundlesPage = readClient("pages/ProductBundles.tsx");
    const packingPage = readClient("pages/PackingDetail.tsx");

    expect(previewComponent).toContain("ProductImagePreview");
    for (const source of [productPage, ordersPage, orderBrowsePage, bundlesPage, packingPage]) {
      expect(source).toContain("ProductImagePreview");
    }
  });

  it("客服最新订单保留专属结账链接复制与预览入口", () => {
    const chatPage = readClient("pages/Chat.tsx");
    const db = fs.readFileSync(path.join(root, "server", "db.ts"), "utf8");

    expect(chatPage).toContain("复制结账链接");
    expect(chatPage).toContain("navigator.clipboard.writeText");
    expect(chatPage).toContain("预览");
    expect(db).toContain("secureToken");
  });

  it("Dashboard 同步 AI 转人工待处理数，并在备注卡显示订单状态", () => {
    const dashboard = readClient("pages/Dashboard.tsx");

    expect(dashboard).toContain("trpc.aiHandover.getStats.useQuery");
    expect(dashboard).toContain("AI 转人工待处理");
    expect(dashboard).toContain("ORDER_STATUS_LABELS");
    expect(dashboard).toContain("physicalStatus");
  });

  it("Campaign 页面提供创建、绑定内容和启用活动的操作说明", () => {
    const campaigns = readClient("pages/Campaigns.tsx");

    expect(campaigns).toContain("Campaign 是什么？如何使用？");
    expect(campaigns).toContain("绑定 Facebook 内容");
    expect(campaigns).toContain("配置并启用");
  });
});
