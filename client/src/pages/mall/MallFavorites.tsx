import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Heart, PackageOpen, ShoppingCart, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/contexts/I18nContext";
import { getMallTheme } from "@/lib/mallTheme";
import { MallThemeDecorations } from "@/components/MallThemeArtwork";
import { MALL_CART_STORAGE_KEY, MALL_FAVORITES_STORAGE_KEY, readAndRepairMallCart, readMallFavoriteIds } from "@/lib/mallInteractions";
import { toast } from "sonner";

export default function MallFavorites() {
  const { translate } = useI18n();
  const t = (zh: string, en: string) => translate(zh, en);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const { data: settings } = trpc.mall.settings.useQuery();
  const { data: products, isLoading } = trpc.mall.products.useQuery({});
  const theme = useMemo(
    () => getMallTheme(settings?.activeTheme, settings?.customThemeColors),
    [settings?.activeTheme, settings?.customThemeColors],
  );

  useEffect(() => {
    const loadFavorites = () => setFavoriteIds(readMallFavoriteIds(localStorage.getItem(MALL_FAVORITES_STORAGE_KEY)));
    loadFavorites();
    window.addEventListener("mall-favorites-updated", loadFavorites);
    return () => window.removeEventListener("mall-favorites-updated", loadFavorites);
  }, []);

  const favoriteProducts = (products || []).filter((product: any) => favoriteIds.includes(product.id));

  function removeFavorite(productId: number) {
    const next = favoriteIds.filter((id) => id !== productId);
    setFavoriteIds(next);
    localStorage.setItem(MALL_FAVORITES_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("mall-favorites-updated"));
  }

  function addFavoriteToCart(product: any) {
    const availableStock = Number(product.availableStock ?? product.stockQuantity ?? 0);
    const allowOversell = Boolean(product.allowOversell);
    if (!allowOversell && availableStock <= 0) {
      toast.error(t("商品已售罄", "This product is sold out"));
      return;
    }
    const unitPrice = String(product.isSpecial && product.specialPrice ? product.specialPrice : product.sellingPrice || "0");
    const cart = readAndRepairMallCart(localStorage);
    const existing = cart.find((item) => item.productId === product.id && !item.variationId);
    if (existing) {
      if (!allowOversell && existing.quantity + 1 > availableStock) {
        toast.error(t(`库存不足，目前最多可购买 ${availableStock} 件。`, `Insufficient stock. You can purchase up to ${availableStock} item(s).`));
        return;
      }
      existing.quantity += 1;
      existing.subtotal = (Number(unitPrice) * existing.quantity).toFixed(2);
    } else {
      cart.push({
        productId: product.id,
        productName: product.nameZh || product.name,
        productSku: product.sku,
        quantity: 1,
        unitPrice,
        subtotal: Number(unitPrice).toFixed(2),
        availableStock,
        allowOversell,
      });
    }
    localStorage.setItem(MALL_CART_STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("cart-updated"));
    toast.success(t("已加入购物车", "Added to cart"));
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ backgroundColor: theme.background, backgroundImage: theme.visual.pattern, color: theme.font }}>
      <MallThemeDecorations theme={theme} />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b shadow-sm backdrop-blur-md" style={{ backgroundColor: `${theme.background}ed`, borderColor: `${theme.secondary}8c` }}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/mall" className="flex items-center gap-2">
              {settings?.logoUrl ? <img src={settings.logoUrl} alt={settings.shopName} className="h-10 w-10 rounded-lg object-contain" /> : <PackageOpen className="h-9 w-9" style={{ color: theme.primary }} />}
              <span className="font-bold text-lg" style={{ color: theme.primary }}>{settings?.shopName || "心田 Xintian"}</span>
            </Link>
            <Link href="/mall/cart">
              <Button variant="outline" size="sm" style={{ borderColor: theme.secondary, color: theme.primary }}><ShoppingCart className="mr-1.5 h-4 w-4" />{t("购物车", "Cart")}</Button>
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2" style={{ color: theme.primary }}><Heart className="h-5 w-5" fill="currentColor" /><span className="text-sm font-semibold tracking-wide">{t("我的清单", "MY LIST")}</span></div>
              <h1 className="text-2xl font-bold">{t("我的收藏", "My Favorites")}</h1>
              <p className="mt-1 text-sm opacity-70">{t("收藏商品不会占用库存；结账时仍会实时检查可售数量。", "Favorites do not reserve stock. Availability is checked again at checkout.")}</p>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1" style={{ borderColor: theme.secondary, color: theme.primary }}>{favoriteProducts.length} {t("件收藏", "saved")}</Badge>
          </div>

          {isLoading ? (
            <div className="flex min-h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: theme.primary, borderTopColor: "transparent" }} /></div>
          ) : favoriteProducts.length === 0 ? (
            <Card className="border-white/80 bg-white/90 text-center shadow-sm">
              <CardContent className="py-16">
                <Heart className="mx-auto mb-4 h-14 w-14 opacity-30" style={{ color: theme.primary }} />
                <h2 className="text-lg font-semibold">{t("还没有收藏商品", "No saved products yet")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t("在商品详情点击“加入收藏”，方便下次再来查看。", "Use “Favorite” on a product page to save it for later.")}</p>
                <Link href="/mall"><Button className="mt-5" style={{ backgroundColor: theme.button }}>{t("前往商城", "Browse mall")}</Button></Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {favoriteProducts.map((product: any) => {
                const availableStock = Number(product.availableStock ?? product.stockQuantity ?? 0);
                const isSoldOut = !product.allowOversell && availableStock <= 0;
                const imageUrl = product.images?.[0]?.imageUrl || product.imageUrl;
                return (
                  <Card key={product.id} className="overflow-hidden border-white/80 bg-white/95 shadow-sm transition-transform duration-200 hover:-translate-y-1" style={{ borderColor: `${theme.secondary}96` }}>
                    <Link href={`/mall/product/${product.id}`} className="block">
                      <div className="relative aspect-square overflow-hidden bg-muted">
                        {imageUrl ? <img src={imageUrl} alt={product.nameZh || product.name} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" /> : <PackageOpen className="absolute inset-0 m-auto h-10 w-10 text-muted-foreground/40" />}
                        {isSoldOut && <Badge className="absolute left-2 top-2 bg-slate-800/90">{t("已售罄", "SOLD OUT")}</Badge>}
                      </div>
                    </Link>
                    <CardContent className="p-3">
                      <Link href={`/mall/product/${product.id}`} className="block">
                        <p className="line-clamp-1 font-semibold">{product.nameZh || product.name}</p>
                        {product.nameEn && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{product.nameEn}</p>}
                        <p className="mt-2 font-bold" style={{ color: theme.primary }}>RM {Number(product.sellingPrice || 0).toFixed(2)}</p>
                      </Link>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button size="sm" className="w-full" style={{ backgroundColor: theme.button }} onClick={() => addFavoriteToCart(product)} disabled={isSoldOut}><ShoppingCart className="mr-1.5 h-3.5 w-3.5" />{t("加入购物车", "Add to cart")}</Button>
                        <Button variant="outline" size="sm" className="w-full text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeFavorite(product.id)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />{t("移除", "Remove")}</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
