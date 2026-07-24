import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronLeft, ClipboardPaste, Truck, Package, Merge } from "lucide-react";

export default function MallCheckout() {
  const [cart, setCart] = useState<any[]>([]);
  const [form, setForm] = useState<{
    customerName: string; contactNumber: string; whatsappNumber: string; email: string;
    addressLine1: string; addressLine2: string; postcode: string; city: string; state: string; area: string;
    deliveryRemark: string; shippingMethod: "west_malaysia" | "east_malaysia" | "self_pickup" | "lalamove";
  }>({
    customerName: "", contactNumber: "", whatsappNumber: "", email: "",
    addressLine1: "", addressLine2: "", postcode: "", city: "", state: "", area: "",
    deliveryRemark: "", shippingMethod: "west_malaysia",
  });
  const [mergeIntoOrderId, setMergeIntoOrderId] = useState<number | undefined>(undefined);
  const [paymentMethodId, setPaymentMethodId] = useState<number | undefined>(undefined);
  const [smartPasteText, setSmartPasteText] = useState("");
  const [showSmartPaste, setShowSmartPaste] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);

  const utils = trpc.useUtils();
  const { data: settings } = trpc.mall.settings.useQuery();
  const { data: paymentMethods } = trpc.paymentMethods.listEnabled.useQuery();

  // smartPaste is a query, use lazy fetch
  const [smartPasteLoading, setSmartPasteLoading] = useState(false);

  // findMergeableOrders is a query, use lazy query pattern
  const [mergeableData, setMergeableData] = useState<any[]>([]);

  const [mergeableOrders, setMergeableOrders] = useState<any[]>([]);

  const checkoutMutation = trpc.mall.checkout.useMutation({
    onSuccess: (data: any) => {
      localStorage.removeItem("mall_cart");
      setOrderResult(data);
      toast.success(data.merged ? "已合并到保留订单" : "订单已创建");
    },
    onError: (e: any) => toast.error(`下单失败: ${e.message}`),
  });

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem("mall_cart") || "[]")); } catch { setCart([]); }
  }, []);

  const subtotal = cart.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const totalWeight = cart.reduce((sum, i) => sum + 0.5 * i.quantity, 0);
  
  // Split items into normal and standalone shipping
  const normalItems = cart.filter(i => !i.isStandalone);
  const standaloneItems = cart.filter(i => i.isStandalone);
  const normalSubtotal = normalItems.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const specialItems = cart.filter(i => i.isSpecial);
  const specialSubtotal = specialItems.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const regularSubtotal = subtotal - specialSubtotal;
  
  let shippingFee = 0;
  let standaloneShippingFee = 0;
  if (form.shippingMethod === "west_malaysia") {
    shippingFee = normalSubtotal >= 150 ? (totalWeight <= 10 ? 0 : Math.ceil(totalWeight - 10) * 3) : 15;
  } else if (form.shippingMethod === "east_malaysia") {
    shippingFee = 15;
  }
  // Add standalone shipping fees
  standaloneItems.forEach(i => {
    standaloneShippingFee += i.standaloneShippingFee || 0;
  });
  const totalShipping = shippingFee + standaloneShippingFee;
  const total = subtotal + totalShipping;
  const needsSplit = standaloneItems.length > 0 && normalItems.length > 0;

  async function handleSmartPaste() {
    if (!smartPasteText.trim()) return;
    setSmartPasteLoading(true);
    try {
      const data = await utils.mall.smartPaste.fetch({ text: smartPasteText });
      setForm((p) => ({ ...p, ...data }));
      toast.success("已解析地址信息");
    } catch {
      toast.error("解析失败");
    }
    setSmartPasteLoading(false);
    setShowSmartPaste(false);
  }

  async function handleFindMergeable() {
    if (!form.contactNumber) { toast.error("请先填写联系电话"); return; }
    try {
      const data = await utils.mall.findMergeableOrders.fetch({ contactNumber: form.contactNumber });
      setMergeableOrders(data || []);
      if (data && data.length > 0) {
        toast.info(`找到 ${data.length} 张保留订单可合并`);
      } else {
        toast.info("没有找到可合并的保留订单");
      }
    } catch {
      toast.error("查询失败");
    }
  }

  function handleCheckout() {
    if (!form.customerName || !form.contactNumber || !form.addressLine1 || !form.postcode || !form.city || !form.state) {
      toast.error("请填写完整的收货信息");
      return;
    }
    if (cart.length === 0) { toast.error("购物车为空"); return; }

    const selectedPayment = paymentMethods?.find((p: any) => p.id === paymentMethodId);

    checkoutMutation.mutate({
      ...form,
      items: cart.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        productSku: i.productSku,
        variationId: i.variationId,
        variationName: i.variationName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
      paymentMethodId,
      paymentMethodName: selectedPayment?.name,
      mergeIntoOrderId,
    });
  }

  if (orderResult) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <Package className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">订单已创建</h2>
            <p className="text-muted-foreground">订单号: {orderResult.orderNumber}</p>
            <p className="text-lg font-bold text-[#2d6a4f]">RM {orderResult.totalAmount}</p>
            {orderResult.merged && <Badge>已合并到保留订单</Badge>}
            <div className="pt-4 space-y-2">
                <Link href={`/mall/payment/${orderResult.orderNumber}?phone=${encodeURIComponent(form.contactNumber || '')}`}>
                <Button className="w-full bg-[#2d6a4f] hover:bg-[#40916c]">去付款</Button>
              </Link>
              <Link href="/mall/order-query">
                <Button variant="outline" className="w-full">查询订单</Button>
              </Link>
              <Link href="/mall">
                <Button variant="ghost" className="w-full">继续购物</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/mall/cart"><Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button></Link>
          <h1 className="font-semibold text-lg">结算</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Smart Paste */}
        <Card>
          <CardContent className="p-4">
            <Button variant="outline" className="w-full" onClick={() => setShowSmartPaste(!showSmartPaste)}>
              <ClipboardPaste className="h-4 w-4 mr-2" />智能贴上地址
            </Button>
            {showSmartPaste && (
              <div className="mt-3 space-y-2">
                <Textarea
                  placeholder="粘贴客户信息...\n例如:\n张三\n011-12345678\n123 Jalan Test\n14000 Bukit Mertajam\nPenang"
                  value={smartPasteText}
                  onChange={(e) => setSmartPasteText(e.target.value)}
                  rows={5}
                />
                <Button onClick={handleSmartPaste} disabled={smartPasteLoading}>解析</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader><CardTitle>收货信息</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>姓名 *</Label><Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></div>
              <div><Label>联系电话 *</Label><Input value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} /></div>
              <div><Label>WhatsApp</Label><Input value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>地址行 1 *</Label><Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} /></div>
            <div><Label>地址行 2</Label><Input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>邮编 *</Label><Input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} /></div>
              <div><Label>城市 *</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>州属 *</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            </div>
            <div><Label>配送备注</Label><Input value={form.deliveryRemark} onChange={(e) => setForm({ ...form, deliveryRemark: e.target.value })} placeholder="如：周末配送" /></div>
          </CardContent>
        </Card>

        {/* Hold Order Merge */}
        <Card>
          <CardContent className="p-4">
            <Button variant="outline" className="w-full" onClick={handleFindMergeable}>
              <Merge className="h-4 w-4 mr-2" />查找可合并的保留订单
            </Button>
            {mergeableOrders.length > 0 && (
              <div className="mt-3 space-y-2">
                {mergeableOrders.map((o: any) => (
                  <label key={o.orderId} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                    <input
                      type="radio"
                      checked={mergeIntoOrderId === o.orderId}
                      onChange={() => setMergeIntoOrderId(o.orderId)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">RM {o.totalAmount}</p>
                    </div>
                    <Badge variant="outline">保留订单</Badge>
                  </label>
                ))}
                {mergeIntoOrderId && (
                  <Button variant="ghost" size="sm" onClick={() => setMergeIntoOrderId(undefined)}>取消合并</Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shipping Method */}
        <Card>
          <CardHeader><CardTitle><Truck className="h-5 w-5 inline mr-2" />配送方式</CardTitle></CardHeader>
          <CardContent>
            <RadioGroup value={form.shippingMethod} onValueChange={(v) => setForm({ ...form, shippingMethod: v as any })}>
              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent mb-2">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="west_malaysia" />
                  <div><p className="font-medium text-sm">西马配送</p><p className="text-xs text-muted-foreground">满RM150免邮，首10kg免运费</p></div>
                </div>
                <span className="font-semibold">{shippingFee === 0 ? "免邮" : `RM ${shippingFee}`}</span>
              </label>
              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent mb-2">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="east_malaysia" />
                  <div><p className="font-medium text-sm">东马配送</p><p className="text-xs text-muted-foreground">首2kg RM15，其余Shopee补差价</p></div>
                </div>
                <span className="font-semibold">RM 15+</span>
              </label>
              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent mb-2">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="self_pickup" />
                  <div><p className="font-medium text-sm">自取</p><p className="text-xs text-muted-foreground">槟城 ECOLAND NURSERY</p></div>
                </div>
                <span className="font-semibold">免费</span>
              </label>
              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="lalamove" />
                  <div><p className="font-medium text-sm">Lalamove</p><p className="text-xs text-muted-foreground">槟城区域，到付运费</p></div>
                </div>
                <span className="font-semibold">到付</span>
              </label>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader><CardTitle>付款方式</CardTitle></CardHeader>
          <CardContent>
            <Select value={paymentMethodId?.toString() || ""} onValueChange={(v) => setPaymentMethodId(parseInt(v))}>
              <SelectTrigger><SelectValue placeholder="选择付款方式" /></SelectTrigger>
              <SelectContent>
                {paymentMethods?.filter((p: any) => p.isEnabled).map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader><CardTitle>订单摘要</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {cart.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="flex-1">{item.productName} {item.variationName ? `(${item.variationName})` : ""} x{item.quantity}</span>
                <span>RM {item.subtotal}</span>
              </div>
            ))}
            {specialSubtotal > 0 && (
              <div className="border-t pt-2 flex justify-between text-sm">
                <span className="text-orange-600">特价商品小计</span><span className="text-orange-600">RM {specialSubtotal.toFixed(2)}</span>
              </div>
            )}
            {regularSubtotal > 0 && regularSubtotal !== subtotal && (
              <div className="flex justify-between text-sm">
                <span>普通商品小计</span><span>RM {regularSubtotal.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between text-sm">
              <span>商品小计</span><span>RM {subtotal.toFixed(2)}</span>
            </div>
            {needsSplit ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>包裹一运费</span><span>{shippingFee === 0 ? "免邮" : `RM ${shippingFee.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>包裹二运费（单独邮寄）</span><span>RM {standaloneShippingFee.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-sm">
                <span>运费</span><span>{totalShipping === 0 ? "免邮" : `RM ${totalShipping.toFixed(2)}`}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-semibold text-lg">
              <span>合计</span><span className="text-[#2d6a4f]">RM {total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full bg-[#2d6a4f] hover:bg-[#40916c] text-lg py-6"
          onClick={handleCheckout}
          disabled={checkoutMutation.isPending}
        >
          {checkoutMutation.isPending ? "提交中..." : `确认下单 · RM ${total.toFixed(2)}`}
        </Button>
      </main>
    </div>
  );
}
