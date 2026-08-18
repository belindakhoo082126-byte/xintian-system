import { Link, useLocation } from "wouter";
import { ChevronLeft, Package, ShoppingCart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { getMallTheme } from "@/lib/mallTheme";
import { MallThemeDecorations } from "@/components/MallThemeArtwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ProductImagePreview } from "@/components/ProductImagePreview";

export default function MallBundleDetail() {
  const [location] = useLocation();
  const bundleId = Number(location.split("/").filter(Boolean).pop());
  const { lang, translate } = useI18n();
  const t = (zh: string, en: string) => translate(zh, en);
  const { data: settings } = trpc.mall.settings.useQuery();
  const { data: bundle, isLoading } = trpc.productBundles.mallDetail.useQuery(
    { id: bundleId },
    { enabled: Number.isInteger(bundleId) && bundleId > 0 },
  );
  const theme = getMallTheme(settings?.activeTheme, settings?.customThemeColors);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (!bundle) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white px-4 text-center">
        <Package className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">{t("组合商品不存在或暂时无法购买", "This bundle is unavailable")}</p>
        <Link href="/mall"><Button>{t("返回商城", "Back to Mall")}</Button></Link>
      </div>
    );
  }

  const salePrice = Number(bundle.specialPrice) > 0 ? bundle.specialPrice : bundle.sellingPrice;
  const hasOriginalPrice = Number(bundle.originalTotalPrice) > Number(salePrice);
  const displayName = lang === "en" && bundle.nameEn ? bundle.nameEn : bundle.name;
  const isSoldOut = Number(bundle.bundleStock) <= 0;
  const addBundleToCart = (goToCheckout = false) => {
    const representativeProductId = Number(bundle.items?.[0]?.productId);
    if (!Number.isInteger(representativeProductId) || representativeProductId <= 0) {
      toast.error(t("此组合商品资料不完整，暂时无法购买。", "This bundle is incomplete and cannot be purchased yet."));
      return;
    }
    if (isSoldOut) {
      toast.error(t("组合优惠已售罄", "This bundle is sold out"));
      return;
    }
    const price = Number(salePrice);
    const nextItem = {
      productId: representativeProductId,
      bundleId: bundle.id,
      productName: displayName,
      productSku: `BUNDLE-${bundle.id}`,
      quantity: 1,
      unitPrice: price.toFixed(2),
      subtotal: price.toFixed(2),
      availableStock: Number(bundle.bundleStock),
      isSpecial: true,
      isBundle: true,
      imageUrl: bundle.coverImage || undefined,
    };
    let cart: any[] = [];
    try { cart = JSON.parse(localStorage.getItem("mall_cart") || "[]"); } catch { cart = []; }
    const existingIndex = cart.findIndex((item) => Number(item.bundleId) === Number(bundle.id));
    if (existingIndex >= 0) {
      const nextQuantity = Math.min(Number(bundle.bundleStock), Number(cart[existingIndex].quantity || 0) + 1);
      cart[existingIndex] = { ...cart[existingIndex], quantity: nextQuantity, subtotal: (price * nextQuantity).toFixed(2), availableStock: Number(bundle.bundleStock) };
    } else {
      cart.push(nextItem);
    }
    localStorage.setItem("mall_cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("cart-updated"));
    toast.success(t("组合优惠已加入购物车", "Bundle added to cart"));
    if (goToCheckout) window.location.assign("/mall/checkout");
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ backgroundColor: theme.background, backgroundImage: theme.visual.pattern, color: theme.font }}>
      <MallThemeDecorations theme={theme} />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b shadow-sm" style={{ backgroundColor: `${theme.background}f2`, borderColor: `${theme.secondary}8c`, backdropFilter: "blur(12px)" }}>
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/mall"><Button variant="ghost" size="icon" aria-label={t("返回商城", "Back to Mall")}><ChevronLeft className="h-5 w-5" /></Button></Link>
            <Link href="/mall" className="font-bold text-lg" style={{ color: theme.primary }}>{settings?.shopName || t("心田", "Xintian")}</Link>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="overflow-hidden border-white/90 bg-white/94" style={{ borderColor: `${theme.secondary}a8`, boxShadow: `0 10px 28px ${theme.primary}14` }}>
              <div className="aspect-square bg-stone-100">
                {bundle.coverImage ? (
                  <ProductImagePreview
                    src={bundle.coverImage}
                    alt={displayName}
                    label={t("放大查看组合包封面", "Zoom bundle cover")}
                    className="h-full w-full rounded-none border-0 bg-transparent"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-20 w-20" /></div>
                )}
              </div>
            </Card>

            <Card className="border-white/90 bg-white/94" style={{ borderColor: `${theme.secondary}a8`, boxShadow: `0 10px 28px ${theme.primary}14` }}>
              <CardContent className="space-y-5 p-5">
                <div>
                  <Badge style={{ backgroundColor: theme.primary, color: "#fff" }}>{t("组合优惠", "Bundle offer")}</Badge>
                  <h1 className="mt-3 text-2xl font-bold">{displayName}</h1>
                  {bundle.keyword && <p className="mt-1 text-sm text-muted-foreground">{t("下单关键词", "Order keyword")}: {bundle.keyword}</p>}
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold" style={{ color: theme.primary }}>RM {Number(salePrice).toFixed(2)}</span>
                  {hasOriginalPrice && <span className="text-base text-muted-foreground line-through">RM {Number(bundle.originalTotalPrice).toFixed(2)}</span>}
                </div>

                {bundle.description && <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{bundle.description}</p>}

                <section className="rounded-xl border border-stone-200 bg-stone-50/90 p-4">
                  <h2 className="font-semibold">{t("组合内容", "What's included")}</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {(bundle.items || []).map((item: any) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 border-b border-stone-200/80 pb-2 last:border-0 last:pb-0">
                        <div className="flex min-w-0 items-center gap-3">
                          {item.imageUrl ? (
                            <ProductImagePreview
                              src={item.imageUrl}
                              alt={item.productName}
                              label={t("放大查看组成商品照片", "Zoom included product photo")}
                              className="h-12 w-12 shrink-0 rounded-lg border border-stone-200 bg-white"
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-muted-foreground"><Package className="h-5 w-5" /></div>
                          )}
                          <span className="min-w-0">{item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</span>
                        </div>
                        <span className="shrink-0 font-medium">× {item.qtyPerBundle}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <div className="space-y-2">
                  <Button variant="outline" className="w-full" onClick={() => addBundleToCart(false)} disabled={isSoldOut}><ShoppingCart className="mr-2 h-4 w-4" />{isSoldOut ? t("组合优惠已售罄", "Sold out") : t("加入购物车", "Add to Cart")}</Button>
                  <Button className="w-full" style={{ backgroundColor: theme.primary }} onClick={() => addBundleToCart(true)} disabled={isSoldOut}>{t("立即购买", "Buy Now")}</Button>
                  <Link href="/mall" className="block"><Button variant="ghost" className="w-full">{t("返回继续选购", "Continue shopping")}</Button></Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
