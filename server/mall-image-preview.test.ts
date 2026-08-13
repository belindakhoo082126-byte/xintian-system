import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("商城图片统一放大预览", () => {
  const home = source("client/src/pages/mall/MallHome.tsx");
  const productDetail = source("client/src/pages/mall/MallProductDetail.tsx");
  const bundleDetail = source("client/src/pages/mall/MallBundleDetail.tsx");
  const cart = source("client/src/pages/mall/MallCart.tsx");
  const favorites = source("client/src/pages/mall/MallFavorites.tsx");
  const payment = source("client/src/pages/mall/MallPayment.tsx");

  it("商城首页的普通商品与组合商品封面均可缩放查看，且预览点击不会进入商品页", () => {
    expect(home).toContain('import { ProductImagePreview } from "@/components/ProductImagePreview"');
    expect(home).toContain('label={translate("放大查看组合包封面", "Zoom bundle cover")}');
    expect(home).toContain('label={translate("放大查看商品照片", "Zoom product photo")}');
    expect(home).toContain("onClick={() => setLocation(`/mall/bundle/${b.id}`)}");
    expect(home).toContain("onClick={() => setLocation(productDetailHref(p.id))}");
  });

  it("商品详情的主图、附图、已选规格图及详情长图均可缩放查看", () => {
    expect(productDetail).toContain('label={t("放大查看商品主图", "Zoom product main photo")}');
    expect(productDetail).toContain('label={t("放大查看商品附加照片", "Zoom product additional photo")}');
    expect(productDetail).toContain('label={t("放大查看规格照片", "Zoom variant photo")}');
    expect(productDetail).toContain('label={t("放大查看商品详情照片", "Zoom product detail photo")}');
  });

  it("组合详情、购物车、收藏及付款凭证照片均复用同一预览组件", () => {
    expect(bundleDetail).toContain('label={t("放大查看组合包封面", "Zoom bundle cover")}');
    expect(bundleDetail).toContain('label={t("放大查看组成商品照片", "Zoom included product photo")}');
    expect(cart).toContain('label="放大查看购物车商品照片"');
    expect(favorites).toContain('label={t("放大查看收藏商品照片", "Zoom saved product photo")}');
    expect(payment).toContain('label="放大查看付款凭证"');
  });
});
