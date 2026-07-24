import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShoppingCart, Minus, Plus, ChevronLeft, Package, Truck, Shield, Sun, Droplets, Sparkles, Scissors, Plane } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export default function MallProductDetail() {
  const [location] = useLocation();
  const productId = parseInt(location.split("/").pop() || "0");
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>(undefined);

  const { data: settings } = trpc.mall.settings.useQuery();
  const { data: product, isLoading } = trpc.mall.productDetail.useQuery({ id: productId });
  const { lang, translate } = useI18n();
  const t = (zh: string, en: string) => translate(zh, en);

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

  function addToCart() {
    if (variants.length > 0 && !selectedVariantId) {
      toast.error(t("请选择规格", "Please select a variant"));
      return;
    }
    try {
      const cart = JSON.parse(localStorage.getItem("mall_cart") || "[]");
      const existing = cart.find((i: any) => i.productId === product!.id && i.variationId === selectedVariantId);
      if (existing) {
        existing.quantity += quantity;
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
        });
      }
      localStorage.setItem("mall_cart", JSON.stringify(cart));
      toast.success(t("已加入购物车", "Added to cart"));
      window.dispatchEvent(new Event("cart-updated"));
    } catch (e) {
      toast.error(t("加入购物车失败", "Failed to add to cart"));
    }
  }

  function buyNow() {
    if (variants.length > 0 && !selectedVariantId) {
      toast.error(t("请选择规格", "Please select a variant"));
      return;
    }
    addToCart();
    window.location.href = "/mall/checkout";
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/mall"><Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button></Link>
          <Link href="/mall" className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="font-bold text-lg text-[#2d6a4f]">{settings?.shopName || t("心田", "Xintian")}</span>
          </Link>
          <Link href="/mall/cart" className="ml-auto"><Button variant="ghost"><ShoppingCart className="h-5 w-5" /></Button></Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Images */}
          <div className="space-y-3">
            <Card className="overflow-hidden">
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
                <span className="text-3xl font-bold text-[#2d6a4f]">RM {unitPrice}</span>
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
            {/* Quantity */}
            <div>
              <p className="text-sm font-medium mb-2">{t("数量", "Quantity")}</p>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="h-4 w-4" /></Button>
                <Input className="w-20 text-center" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={addToCart}><ShoppingCart className="h-4 w-4 mr-2" />{t("加入购物车", "Add to Cart")}</Button>
              <Button className="flex-1 bg-[#2d6a4f] hover:bg-[#40916c]" onClick={buyNow}>{t("立即购买", "Buy Now")}</Button>
            </div>

            {/* Trust badges */}
            <div className="flex gap-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Truck className="h-4 w-4" />{t("西马满RM150免邮", "Free shipping over RM150 (West Malaysia)")}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Shield className="h-4 w-4" />{t("7天保留", "7-day reservation")}</div>
            </div>
          </div>
        </div>

        {/* Product Description */}
        {(product.fullDescZh || product.lightDesc || product.waterDesc || product.fertilizerDesc || product.pruningDesc) && (
          <Card className="mt-6">
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
            <Card className="mt-4">
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
  );
}
