import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Minus, Plus, ShoppingCart, ChevronLeft, Package, Sparkles, Gift, Target } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ProductImagePreview } from "@/components/ProductImagePreview";

export default function MallCart() {
  const [cart, setCart] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [addOnOrder, setAddOnOrder] = useState<any>(null);

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem("mall_cart") || "[]"));
    } catch { setCart([]); }
    // V2.0.90: Read persistent order session
    try {
      const saved = localStorage.getItem("xintian_mall_add_on_order");
      if (saved) setAddOnOrder(JSON.parse(saved));
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  function updateCart(newCart: any[]) {
    setCart(newCart);
    localStorage.setItem("mall_cart", JSON.stringify(newCart));
    window.dispatchEvent(new Event("cart-updated"));
  }

  function updateQty(index: number, delta: number) {
    const newCart = [...cart];
    const maxQuantity = newCart[index].isBundle
      ? Math.max(1, Number(newCart[index].availableStock) || 1)
      : Number.POSITIVE_INFINITY;
    const requestedQuantity = Math.max(1, newCart[index].quantity + delta);
    if (requestedQuantity > maxQuantity) {
      toast.error(`组合优惠库存不足，目前最多可购买 ${maxQuantity} 组。`);
      return;
    }
    newCart[index].quantity = requestedQuantity;
    newCart[index].subtotal = (parseFloat(newCart[index].unitPrice) * newCart[index].quantity).toFixed(2);
    updateCart(newCart);
  }

  function removeItem(index: number) {
    updateCart(cart.filter((_, i) => i !== index));
    toast.success("已移除");
  }

  const subtotal = cart.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const marketingInput = useMemo(() => ({
    cart: cart
      .map((item) => ({
        productId: Number(item.productId ?? item.id),
        categoryId: item.categoryId != null ? Number(item.categoryId) : null,
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
      }))
      .filter((item) => Number.isInteger(item.productId) && item.productId > 0),
  }), [cart]);
  const { data: marketingCampaigns = [] } = trpc.marketing.mallPreview.useQuery(marketingInput, {
    enabled: loaded && marketingInput.cart.length > 0,
    staleTime: 15_000,
  });

  if (!loaded) return null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8f9fa]">
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4">
          <Link href="/mall"><Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button></Link>
          <h1 className="min-w-0 truncate text-lg font-semibold">购物车</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-6">
        {cart.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground mb-4">购物车是空的</p>
            <Link href="/mall"><Button>去逛逛</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item, i) => (
              <Card key={i}>
                <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-3 p-3 sm:flex-nowrap sm:gap-4 sm:p-4">
                  <div className="w-16 h-16 overflow-hidden rounded border bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {item.imageUrl ? <ProductImagePreview src={item.imageUrl} alt={item.productName} label="放大查看购物车商品照片" className="h-full w-full rounded-none border-0 bg-transparent" /> : <Package className="h-8 w-8 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1 basis-[calc(100%-5rem)] sm:basis-auto">
                    <p className="font-medium text-sm line-clamp-1">{item.productName}</p>
                    {item.isBundle && <span className="mt-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">组合优惠</span>}
                    {item.variationName && <p className="text-xs text-muted-foreground">{item.variationName}</p>}
                    <p className="text-[#2d6a4f] font-semibold mt-1">RM {item.unitPrice}</p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:ml-0 sm:gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(i, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(i, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </CardContent>
              </Card>
            ))}

            {marketingCampaigns.map((campaign) => {
              const { result } = campaign;
              const discounts = result.discounts || [];
              const entitlements = result.entitlements || [];
              const totalDiscount = result.discountTotal || 0;
              return (
                <Card key={campaign.id} className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <div className="min-w-0">
                        <p className="font-semibold text-amber-900">{campaign.name}</p>
                        {campaign.description && <p className="mt-0.5 text-xs text-amber-800">{campaign.description}</p>}
                      </div>
                    </div>
                    {totalDiscount > 0 && (
                      <p className="text-sm font-medium text-emerald-700">本活动可优惠 RM {totalDiscount.toFixed(2)}，最终结账时将由系统再次确认。</p>
                    )}
                    {discounts.map((discount, index) => (
                      <p key={`${discount.ruleId}-${index}`} className="text-xs text-amber-900">{discount.reason}：省 RM {discount.amount.toFixed(2)}</p>
                    ))}
                    {entitlements.map((item, index) => (
                      <div key={`${item.ruleId}-${index}`} className="flex gap-2 text-xs text-amber-900">
                        {item.type === "add_on_offer" ? <Target className="h-4 w-4 shrink-0 text-orange-600" /> : <Gift className="h-4 w-4 shrink-0 text-rose-600" />}
                        <span>{item.reason}{item.type === "add_on_offer" && item.unitPrice != null ? `（加价 RM ${item.unitPrice.toFixed(2)}，结账前仍须通过库存确认）` : ""}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}

            <Card className="mt-4">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-lg font-semibold">合计: RM {subtotal.toFixed(2)}</span>
                  <Link href="/mall/checkout" className="w-full sm:w-auto"><Button className="w-full bg-[#2d6a4f] hover:bg-[#40916c] sm:w-auto">去结算</Button></Link>
                </div>
                {/* V2.0.90: Show return-to-order button when add-on session exists */}
                {addOnOrder && (
                  <a href={`/order/${addOnOrder.orderNumber}/${addOnOrder.token}`}>
                    <Button variant="outline" className="w-full">返回原订单 ({addOnOrder.orderNumber})</Button>
                  </a>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
