import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Minus, Plus, ShoppingCart, ChevronLeft, Package } from "lucide-react";
import { MALL_CART_STORAGE_KEY, readAndRepairMallCart } from "@/lib/mallInteractions";

export default function MallCart() {
  const [cart, setCart] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [addOnOrder, setAddOnOrder] = useState<any>(null);

  useEffect(() => {
    const loadCart = () => {
      try { setCart(readAndRepairMallCart(localStorage)); } catch { setCart([]); }
    };
    loadCart();
    window.addEventListener("cart-updated", loadCart);
    // V2.0.90: Read persistent order session
    try {
      const saved = localStorage.getItem("xintian_mall_add_on_order");
      if (saved) setAddOnOrder(JSON.parse(saved));
    } catch { /* ignore */ }
    setLoaded(true);
    return () => window.removeEventListener("cart-updated", loadCart);
  }, []);

  function updateCart(newCart: any[]) {
    setCart(newCart);
    localStorage.setItem(MALL_CART_STORAGE_KEY, JSON.stringify(newCart));
    window.dispatchEvent(new Event("cart-updated"));
  }

  function updateQty(index: number, delta: number) {
    const newCart = [...cart];
    newCart[index].quantity = Math.max(1, newCart[index].quantity + delta);
    newCart[index].subtotal = (parseFloat(newCart[index].unitPrice) * newCart[index].quantity).toFixed(2);
    updateCart(newCart);
  }

  function removeItem(index: number) {
    updateCart(cart.filter((_, i) => i !== index));
    toast.success("已移除");
  }

  const subtotal = cart.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);

  if (!loaded) return null;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/mall"><Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button></Link>
          <h1 className="font-semibold text-lg">购物车</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
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
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-16 h-16 rounded border bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-1">{item.productName}</p>
                    {item.variationName && <p className="text-xs text-muted-foreground">{item.variationName}</p>}
                    <p className="text-[#2d6a4f] font-semibold mt-1">RM {item.unitPrice}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(i, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(i, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </CardContent>
              </Card>
            ))}

            <Card className="mt-4">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">合计: RM {subtotal.toFixed(2)}</span>
                  <Link href="/mall/checkout"><Button className="bg-[#2d6a4f] hover:bg-[#40916c]">去结算</Button></Link>
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
