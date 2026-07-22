import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShoppingCart, Minus, Plus, ChevronLeft, Package, Truck, Shield } from "lucide-react";

export default function MallProductDetail() {
  const [location] = useLocation();
  const productId = parseInt(location.split("/").pop() || "0");
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>(undefined);

  const { data: settings } = trpc.mall.settings.useQuery();
  const { data: product, isLoading } = trpc.mall.productDetail.useQuery({ id: productId });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Package className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">商品不存在</p>
        <Link href="/mall"><Button>返回商城</Button></Link>
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
      toast.error("请选择规格");
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
      toast.success("已加入购物车");
      window.dispatchEvent(new Event("cart-updated"));
    } catch (e) {
      toast.error("加入购物车失败");
    }
  }

  function buyNow() {
    if (variants.length > 0 && !selectedVariantId) {
      toast.error("请选择规格");
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
            <span className="font-bold text-lg text-[#2d6a4f]">{settings?.shopName || "心田"}</span>
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
              {product.shortDescZh && <p className="text-sm text-muted-foreground">{product.shortDescZh}</p>}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-[#2d6a4f]">RM {unitPrice}</span>
              {product.compareAtPrice && parseFloat(product.compareAtPrice) > 0 && (
                <span className="text-lg text-muted-foreground line-through">RM {product.compareAtPrice}</span>
              )}
            </div>

            {/* Variants */}
            {variants.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">选择规格</p>
                <Select value={selectedVariantId?.toString() || ""} onValueChange={(v) => setSelectedVariantId(parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder="请选择规格" /></SelectTrigger>
                  <SelectContent>
                    {variants.map((v: any) => (
                      <SelectItem key={v.id} value={v.id.toString()}>{v.name} - RM {v.sellingPrice}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quantity */}
            <div>
              <p className="text-sm font-medium mb-2">数量</p>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="h-4 w-4" /></Button>
                <Input className="w-20 text-center" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={addToCart}><ShoppingCart className="h-4 w-4 mr-2" />加入购物车</Button>
              <Button className="flex-1 bg-[#2d6a4f] hover:bg-[#40916c]" onClick={buyNow}>立即购买</Button>
            </div>

            {/* Trust badges */}
            <div className="flex gap-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Truck className="h-4 w-4" />西马满RM150免邮</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Shield className="h-4 w-4" />7天保留</div>
            </div>
          </div>
        </div>

        {/* Product Description */}
        {(product.fullDescZh || product.careZh) && (
          <Card className="mt-6">
            <CardContent className="p-6 space-y-4">
              {product.fullDescZh && (
                <div>
                  <h3 className="font-semibold mb-2">商品介绍</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.fullDescZh}</p>
                </div>
              )}
              {product.careZh && (
                <div>
                  <h3 className="font-semibold mb-2">养护指南</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.careZh}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Detail Images */}
        {detailImages.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="font-semibold">商品详情</h3>
            {detailImages.map((img: any) => (
              <img key={img.id} src={img.imageUrl} alt="detail" className="w-full rounded-lg" />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
