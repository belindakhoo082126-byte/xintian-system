import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShoppingCart, Minus, Plus, ChevronLeft, Package, Truck, Shield, Sun, Droplets, Sparkles, Scissors, Plane, Heart, MessageCircle, Link2 } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { getMallTheme } from "@/lib/mallTheme";
import { MallThemeDecorations } from "@/components/MallThemeArtwork";
import { MallCartFlyAnimation, type MallCartFlight } from "@/components/MallCartFlyAnimation";
import { getMallShareLinks, MALL_FAVORITES_STORAGE_KEY, readMallFavoriteIds, toggleMallFavoriteId } from "@/lib/mallInteractions";

export default function MallProductDetail() {
  const [location] = useLocation();
  const productId = parseInt(location.split("/").pop() || "0");
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>(undefined);
  const [cartCount, setCartCount] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [cartFlight, setCartFlight] = useState<MallCartFlight | null>(null);

  useEffect(() => {
    const loadCart = () => {
      try {
        const c = JSON.parse(localStorage.getItem("mall_cart") || "[]");
        setCartCount(c.reduce((s: number, i: any) => s + i.quantity, 0));
      } catch { setCartCount(0); }
    };
    loadCart();
    window.addEventListener("cart-updated", loadCart);
    return () => window.removeEventListener("cart-updated", loadCart);
  }, []);

  useEffect(() => {
    const loadFavorites = () => setFavoriteIds(readMallFavoriteIds(localStorage.getItem(MALL_FAVORITES_STORAGE_KEY)));
    loadFavorites();
    window.addEventListener("mall-favorites-updated", loadFavorites);
    return () => window.removeEventListener("mall-favorites-updated", loadFavorites);
  }, []);

  const { data: settings } = trpc.mall.settings.useQuery();
  const { data: product, isLoading } = trpc.mall.productDetail.useQuery({ id: productId });
  const { lang, translate } = useI18n();
  const t = (zh: string, en: string) => translate(zh, en);
  const theme = getMallTheme(settings?.activeTheme, settings?.customThemeColors);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Package className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">{t("商品不存在", "Product not found")}</p>
        <Link href="/mall"><Button>{t("返回商城", "Back to Mall")}</Button></Link>
      </div>
    );
  }

  const images = product.images || [];
  const detailImages = product.detailImages || [];
  const variants = product.variants || [];
  const selectedVariant = variants.find((v: any) => v.id === selectedVariantId);
  const unitPrice = selectedVariant?.sellingPrice || product!.sellingPrice || "0";
  const subtotal = (parseFloat(unitPrice) * quantity).toFixed(2);
  const selectedVariantStock = selectedVariant as (typeof selectedVariant & { availableStock?: number; allowOversold?: boolean }) | undefined;
  const productStock = product as typeof product & { availableStock?: number; allowOversold?: boolean };
  const allowOversell = Boolean(selectedVariantStock?.allowOversold ?? productStock.allowOversold);
  const availableStock = Number(selectedVariantStock?.availableStock ?? selectedVariantStock?.stockQuantity ?? productStock.availableStock ?? productStock.stockQuantity ?? 0);
  const isSoldOut = !allowOversell && availableStock <= 0;

  function setSafeQuantity(nextQuantity: number) {
    const requested = Math.max(1, Number.isFinite(nextQuantity) ? nextQuantity : 1);
    if (!allowOversell && requested > availableStock) {
      toast.error(t(`库存不足，目前最多可购买 ${Math.max(availableStock, 0)} 件。`, `Insufficient stock. You can purchase up to ${Math.max(availableStock, 0)} item(s).`));
      setQuantity(Math.max(1, availableStock));
      return;
    }
    setQuantity(requested);
  }

  function launchCartFlight(origin?: HTMLElement) {
    const originRect = origin?.getBoundingClientRect();
    const cartRect = document.getElementById("mall-cart-anchor")?.getBoundingClientRect();
    if (!originRect || !cartRect) return;
    const flightId = Date.now();
    setCartFlight({
      id: flightId,
      fromX: originRect.left + originRect.width / 2 - 20,
      fromY: originRect.top + originRect.height / 2 - 20,
      toX: cartRect.left + cartRect.width / 2 - 20,
      toY: cartRect.top + cartRect.height / 2 - 20,
    });
    window.setTimeout(() => setCartFlight((current) => current?.id === flightId ? null : current), 900);
  }

  function addToCart(origin?: HTMLElement): boolean {
    if (variants.length > 0 && !selectedVariantId) {
      toast.error(t("请选择规格", "Please select a variant"));
      return false;
    }
    if (isSoldOut) {
      toast.error(t("商品已售罄", "This product is sold out"));
      return false;
    }
    try {
      const cart = JSON.parse(localStorage.getItem("mall_cart") || "[]");
      const existing = cart.find((i: any) => i.productId === product!.id && i.variationId === selectedVariantId);
      if (existing) {
        if (!allowOversell && existing.quantity + quantity > availableStock) {
          toast.error(t(`库存不足，目前最多可购买 ${availableStock} 件。`, `Insufficient stock. You can purchase up to ${availableStock} item(s).`));
          return false;
        }
        existing.quantity += quantity;
        existing.subtotal = (parseFloat(unitPrice) * existing.quantity).toFixed(2);
      } else {
        cart.push({
          productId: product!.id,
          productName: product!.name,
          productSku: product!.sku,
          variationId: selectedVariantId,
          variationName: selectedVariant?.name,
          quantity,
          unitPrice,
          subtotal,
          availableStock,
          allowOversell,
        });
      }
      localStorage.setItem("mall_cart", JSON.stringify(cart));
      launchCartFlight(origin);
      toast.success(t("已加入购物车", "Added to cart"));
      window.dispatchEvent(new Event("cart-updated"));
      return true;
    } catch (e) {
      toast.error(t("加入购物车失败", "Failed to add to cart"));
      return false;
    }
  }

  function buyNow() {
    if (variants.length > 0 && !selectedVariantId) {
      toast.error(t("请选择规格", "Please select a variant"));
      return;
    }
    if (addToCart()) window.location.href = "/mall/checkout";
  }

  function toggleFavorite() {
    const nextFavoriteIds = toggleMallFavoriteId(favoriteIds, product!.id);
    setFavoriteIds(nextFavoriteIds);
    localStorage.setItem(MALL_FAVORITES_STORAGE_KEY, JSON.stringify(nextFavoriteIds));
    window.dispatchEvent(new Event("mall-favorites-updated"));
    toast.success(nextFavoriteIds.includes(product!.id) ? t("已加入收藏", "Saved to favorites") : t("已取消收藏", "Removed from favorites"));
  }

  async function shareProduct(channel: "whatsapp" | "copy") {
    const url = window.location.href;
    const shareText = `${product!.name} · RM ${product!.isSpecial && product!.specialPrice ? product!.specialPrice : unitPrice}`;
    if (channel === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        toast.success(t("商品链接已复制", "Product link copied"));
      } catch {
        toast.error(t("复制链接失败", "Could not copy link"));
      }
      return;
    }
    const links = getMallShareLinks({ url, text: shareText });
    window.open(links.whatsapp, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ backgroundColor: theme.background, backgroundImage: theme.visual.pattern, color: theme.font }}>
      <MallThemeDecorations theme={theme} />
      <MallCartFlyAnimation flight={cartFlight} />
      <div className="relative z-10">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b shadow-sm" style={{ backgroundColor: `${theme.background}f2`, borderColor: `${theme.secondary}8c`, backdropFilter: "blur(12px)" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/mall"><Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button></Link>
          <Link href="/mall" className="flex items-center gap-2">
            <span className="font-bold text-lg" style={{ color: theme.primary }}>{settings?.shopName || t("心田", "Xintian")}</span>
          </Link>
          <Link href="/mall/checkout" className="ml-auto relative">
            <Button id="mall-cart-anchor" variant="ghost"><ShoppingCart className="h-5 w-5" /></Button>
            {cartCount > 0 && <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">{cartCount}</Badge>}
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Images */}
          <div className="space-y-3">
            <Card className="overflow-hidden border-white/80 bg-white/90" style={{ borderColor: `${theme.secondary}a8`, boxShadow: `0 10px 28px ${theme.primary}14` }}>
              <div className="aspect-square bg-gray-100">
                {product.coverImageUrl ? (
                  <img src={product.coverImageUrl} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400"><Package className="h-20 w-20" /></div>
                )}
              </div>
            </Card>
            {images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img: any) => (
                  <img key={img.id} src={img.imageUrl} alt="" className="h-20 w-20 rounded border object-cover cursor-pointer" />
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold mb-2">{product.name}</h1>
              {product.isSpecial && (
                <Badge className="bg-orange-100 text-orange-700 mb-2">{t("特价", "Special Price")}</Badge>
              )}
              {product.shortDescZh && <p className="text-sm text-muted-foreground">{product.shortDescZh}</p>}
            </div>

            <div className="flex items-center gap-3">
              {product.isSpecial && product.specialPrice && parseFloat(product.specialPrice) > 0 ? (
                <>
                  <span className="text-3xl font-bold text-orange-600">RM {product.specialPrice}</span>
                  <span className="text-lg text-muted-foreground line-through">RM {unitPrice}</span>
                </>
              ) : (
                <span className="text-3xl font-bold" style={{ color: theme.primary }}>RM {unitPrice}</span>
              )}
              {product.compareAtPrice && parseFloat(product.compareAtPrice) > 0 && !product.isSpecial && (
                <span className="text-lg text-muted-foreground line-through">RM {product.compareAtPrice}</span>
              )}
            </div>

            {/* Variants */}
            {variants.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">{t("选择规格", "Select Variant")}</p>
                <Select value={selectedVariantId?.toString() || ""} onValueChange={(v) => setSelectedVariantId(parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder={t("请选择规格", "Please select a variant")} /></SelectTrigger>
                  <SelectContent>
                    {variants.map((v: any) => (
                      <SelectItem key={v.id} value={v.id.toString()}>
                        <div className="flex items-center gap-2">
                          {v.imageUrl && <img src={v.imageUrl} alt="" className="h-6 w-6 rounded object-cover" />}
                          {v.name} - RM {v.sellingPrice}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedVariant?.imageUrl && (
                  <img src={selectedVariant.imageUrl} alt={selectedVariant.name} className="mt-2 h-24 w-24 rounded-lg border object-cover" />
                )}
              </div>
            )}

            {/* Import Pre-order Notice */}
            {(product as any).salesMode === "import_preorder" && (
              <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-purple-700 font-medium">
                  <Plane className="h-4 w-4" />
                  {t("中国进口代购商品", "China Import Pre-order Product")}
                </div>
                <p className="text-sm text-purple-600">
                  {t("此商品为中国进口代购，下单后需等待采购及运输。", "This product is imported from China. Please expect waiting time for purchasing and shipping.")}
                  {(product as any).preorderWaitDays && (
                    <span className="font-medium">{t("预计等待时间: ", "Estimated wait: ")}{(product as any).preorderWaitDays}</span>
                  )}
                </p>
                <p className="text-xs text-purple-500">
                  {t("付款后才会采购，请耐心等待。到货后通知发货。", "Purchasing begins after payment. You will be notified upon arrival.")}
                </p>
              </div>
            )}
            <section className="overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-amber-50 shadow-sm" aria-label={t("购物服务公告", "Shopping information")}>
              <div className="flex items-center gap-2 border-b border-emerald-100 bg-white/70 px-4 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm text-white">✦</span>
                <p className="text-sm font-bold text-emerald-800">{t("心田贴心服务", "Xintian Shopping Guide")}</p>
              </div>
              <div className="space-y-3 px-4 py-3.5 text-sm">
                <div className="flex gap-3"><span className="mt-0.5">🪴</span><div><p className="font-semibold text-emerald-800">{t("免费换盆服务", "Free Repotting Service")}</p><p className="mt-0.5 text-xs leading-5 text-emerald-700">{t("购买植物并同单加购花盆，结账时可选择免费换盆。", "Buy plants and pots in the same order, then select complimentary repotting at checkout.")}</p></div></div>
                <div className="flex gap-3 border-t border-emerald-100 pt-3"><span className="mt-0.5">🚚</span><div><p className="font-semibold text-emerald-800">{t("西马运费优惠", "West Malaysia Delivery")}</p><p className="mt-0.5 text-xs leading-5 text-emerald-700">{t("消费满 RM150 首 10kg 免邮，续重 RM3/kg；不含特价商品及会员费用。", "Spend RM150 for free delivery on the first 10kg; RM3/kg thereafter. Special-price items and membership fees are excluded.")}</p></div></div>
                <div className="flex gap-3 border-t border-emerald-100 pt-3"><span className="mt-0.5">📅</span><div><p className="font-semibold text-emerald-800">{t("订单保留", "Order Reservation")}</p><p className="mt-0.5 text-xs leading-5 text-emerald-700">{t("本地订单可保留 7 天，逾期系统将自动取消。", "Local orders are reserved for 7 days and will be cancelled automatically after expiry.")}</p></div></div>
              </div>
            </section>

            {/* Quantity */}
            <div>
              <p className="text-sm font-medium mb-2">{t("数量", "Quantity")}</p>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="h-4 w-4" /></Button>
                <Input className="w-20 text-center" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                <Button variant="outline" size="icon" onClick={() => setSafeQuantity(quantity + 1)} disabled={isSoldOut || (!allowOversell && quantity >= availableStock)}><Plus className="h-4 w-4" /></Button>
              </div>
              {isSoldOut && <p className="mt-2 text-sm font-medium text-red-600">{t("商品已售罄", "Sold out")}</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={(event) => addToCart(event.currentTarget)} disabled={isSoldOut}><ShoppingCart className="h-4 w-4 mr-2" />{t("加入购物车", "Add to Cart")}</Button>
              <Button className="flex-1 hover:opacity-90" style={{ backgroundColor: theme.button }} onClick={buyNow} disabled={isSoldOut}>{t("立即购买", "Buy Now")}</Button>
            </div>

            <div className="flex flex-wrap gap-2" aria-label={t("商品互动", "Product actions")}>
              <Button variant="outline" size="sm" onClick={toggleFavorite} aria-pressed={favoriteIds.includes(product.id)} className={favoriteIds.includes(product.id) ? "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100" : ""}>
                <Heart className="mr-1.5 h-4 w-4" fill={favoriteIds.includes(product.id) ? "currentColor" : "none"} />
                {favoriteIds.includes(product.id) ? t("已收藏", "Saved") : t("加入收藏", "Favorite")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void shareProduct("copy")}><Link2 className="mr-1.5 h-4 w-4" />{t("分享链接", "Share link")}</Button>
              <Button variant="outline" size="icon" onClick={() => void shareProduct("whatsapp")} title="WhatsApp"><MessageCircle className="h-4 w-4 text-[#25D366]" /></Button>
            </div>

          </div>
        </div>

        {/* Product Description */}
        {(product.fullDescZh || product.lightDesc || product.waterDesc || product.fertilizerDesc || product.pruningDesc) && (
          <Card className="mt-6 border-white/80 bg-white/90" style={{ borderColor: `${theme.secondary}a8`, boxShadow: `0 10px 28px ${theme.primary}10` }}>
            <CardContent className="p-6 space-y-4">
              {product.fullDescZh && (
                <div>
                  <h3 className="font-semibold mb-2">{t("详细描述", "Detailed Description")}</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.fullDescZh}</p>
                </div>
              )}
              {/* Structured care info */}
              {(product.lightDesc || product.waterDesc || product.fertilizerDesc || product.pruningDesc) && (
                <div className="grid grid-cols-2 gap-4">
                  {product.lightDesc && (
                    <div className="flex items-start gap-2">
                      <Sun className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
                      <div><p className="text-xs font-medium text-muted-foreground">{t("光线", "Light")}</p><p className="text-sm">{product.lightDesc}</p></div>
                    </div>
                  )}
                  {product.waterDesc && (
                    <div className="flex items-start gap-2">
                      <Droplets className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                      <div><p className="text-xs font-medium text-muted-foreground">{t("水分", "Water")}</p><p className="text-sm">{product.waterDesc}</p></div>
                    </div>
                  )}
                  {product.fertilizerDesc && (
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      <div><p className="text-xs font-medium text-muted-foreground">{t("施肥", "Fertilizer")}</p><p className="text-sm">{product.fertilizerDesc}</p></div>
                    </div>
                  )}
                  {product.pruningDesc && (
                    <div className="flex items-start gap-2">
                      <Scissors className="h-5 w-5 text-gray-500 mt-0.5 shrink-0" />
                      <div><p className="text-xs font-medium text-muted-foreground">{t("修剪", "Pruning")}</p><p className="text-sm">{product.pruningDesc}</p></div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dimensions (pot size) */}
        {(() => {
          const dims = product.dimensions as any;
          if (!dims || (!dims.diameter && !dims.height)) return null;
          return (
            <Card className="mt-4 border-white/80 bg-white/90" style={{ borderColor: `${theme.secondary}a8`, boxShadow: `0 10px 28px ${theme.primary}10` }}>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">{t("尺寸信息", "Dimensions")}</h3>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  {dims.diameter && <span>{t("口径", "Diameter")}: {dims.diameter}</span>}
                  {dims.height && <span>{t("高度", "Height")}: {dims.height}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Detail Images */}
        {detailImages.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="font-semibold">{t("商品详情", "Product Details")}</h3>
            {detailImages.map((img: any) => (
              <img key={img.id} src={img.imageUrl} alt="detail" className="w-full rounded-lg" />
            ))}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
