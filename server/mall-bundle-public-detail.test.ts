import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("商城公开组合商品详情", () => {
  const root = path.resolve(__dirname, "..");
  const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
  const mallHome = fs.readFileSync(path.join(root, "client/src/pages/mall/MallHome.tsx"), "utf8");
  const detail = fs.readFileSync(path.join(root, "client/src/pages/mall/MallBundleDetail.tsx"), "utf8");
  const cart = fs.readFileSync(path.join(root, "client/src/pages/mall/MallCart.tsx"), "utf8");
  const checkout = fs.readFileSync(path.join(root, "client/src/pages/mall/MallCheckout.tsx"), "utf8");
  const router = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
  const db = fs.readFileSync(path.join(root, "server/db.ts"), "utf8");
  const productDetail = fs.readFileSync(path.join(root, "client/src/pages/mall/MallProductDetail.tsx"), "utf8");

  it("从商城组合卡进入公开组合详情页，不会落入后台 404 路由", () => {
    expect(mallHome).toContain('href={`/mall/bundle/${b.id}`}');
    expect(app).toContain('path={"/mall/bundle/:id"} component={MallBundleDetail}');
    expect(router).toContain("mallDetail: publicProcedure");
  });

  it("组合详情页沿用保存的 coverImage 字段显示上传的封面图片", () => {
    expect(mallHome).toContain("{b.coverImage ? (");
    expect(mallHome).toContain('<img src={b.coverImage} alt={b.name}');
    expect(detail).toContain("trpc.productBundles.mallDetail.useQuery");
    expect(detail).toContain("bundle.coverImage");
    expect(detail).toContain('<img src={bundle.coverImage}');
    expect(detail).toContain("组合内容");
  });

  it("组合优惠可进入购物车并携带受控组合标识至结账流程", () => {
    expect(detail).toContain("bundleId: bundle.id");
    expect(detail).toContain("isBundle: true");
    expect(detail).toContain('localStorage.setItem("mall_cart", JSON.stringify(cart))');
    expect(detail).toContain('window.location.assign("/mall/checkout")');
    expect(cart).toContain("newCart[index].isBundle");
    expect(cart).toContain("组合优惠库存不足");
    expect(checkout).toContain("bundleId: i.bundleId ? Number(i.bundleId) : undefined");
    expect(router).toContain("bundleId: z.number().int().positive().optional()");
  });

  it("组合优惠结账由服务器重新读取组合资料、售价与库存，并在建单后同步扣减组合库存", () => {
    expect(db).toContain("const publicBundles = await getMallBundles()");
    expect(db).toContain("publicBundles.find((candidate) => candidate.id === item.bundleId)");
    expect(db).toContain("组合优惠不存在、已下架或已售罄");
    expect(db).toContain("const trustedPrice = Number(bundle.specialPrice)");
    expect(db).toContain("组合包库存不足");
    expect(db).toContain("await deductBundleStock(item.bundleId!, item.quantity)");
  });

  it("商品服务公告以同一完整卡片显示换盆、运费和订单保留，并在英文下有对应文案", () => {
    expect(productDetail).toContain('aria-label={t("购物服务公告", "Shopping information")}');
    expect(productDetail).toContain("免费换盆服务");
    expect(productDetail).toContain("Free Repotting Service");
    expect(productDetail).toContain("消费满 RM150 首 10kg 免邮，续重 RM3/kg；不含特价商品及会员费用。");
    expect(productDetail).toContain("Spend RM150 for free delivery on the first 10kg; RM3/kg thereafter.");
    expect(productDetail).toContain("本地订单可保留 7 天，逾期系统将自动取消。");
    expect(productDetail).toContain("Local orders are reserved for 7 days and will be cancelled automatically after expiry.");
  });

  it("商城公告与购物条款入口可在中英文间切换，且条款入口不隐藏于移动端", () => {
    expect(mallHome).toContain("translateMallNotice(n.announcement, translate)");
    expect(mallHome).toContain('translate("购物条款与政策", "Policies")');
    expect(mallHome).not.toContain('hidden shrink-0 text-xs sm:inline-flex');
  });
});
