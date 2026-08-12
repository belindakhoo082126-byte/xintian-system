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
import { ChevronLeft, ClipboardPaste, Truck, Package, Merge, Plane, Minus, Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { getMallTheme } from "@/lib/mallTheme";
import { MallThemeDecorations } from "@/components/MallThemeArtwork";
import { MALL_CART_STORAGE_KEY, readMallCartItems } from "@/lib/mallInteractions";

export default function MallCheckout() {
  const [cart, setCart] = useState<any[]>([]);
  const [form, setForm] = useState<{
    customerName: string; contactNumber: string; whatsappNumber: string; email: string;
    addressLine1: string; addressLine2: string; postcode: string; city: string; state: string; area: string;
    deliveryRemark: string; shippingMethod: "west_malaysia" | "east_malaysia" | "east_malaysia_poslaju" | "east_malaysia_shopee" | "self_pickup" | "lalamove";
  }>({
    customerName: "", contactNumber: "", whatsappNumber: "", email: "",
    addressLine1: "", addressLine2: "", postcode: "", city: "", state: "", area: "",
    deliveryRemark: "", shippingMethod: "west_malaysia",
  });
  const [mergeIntoOrderId, setMergeIntoOrderId] = useState<number | undefined>(undefined);
  const [repotEnabled, setRepotEnabled] = useState(false);
  const [repotPairs, setRepotPairs] = useState<{ plantProductId: number; plantName: string; potProductId: number; potName: string; quantity: number }[]>([]);
  const [customerRemark, setCustomerRemark] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState<number | undefined>(undefined);
  const [smartPasteText, setSmartPasteText] = useState("");
  const [showSmartPaste, setShowSmartPaste] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);
  const [importAgreed, setImportAgreed] = useState(false);
  const [secureAddOnOrder, setSecureAddOnOrder] = useState<{
    orderNumber: string;
    token: string;
    customerName: string;
    contactNumber: string;
    shippingAddress: string;
    shippingMethod: "west_malaysia" | "east_malaysia" | "east_malaysia_poslaju" | "east_malaysia_shopee" | "self_pickup" | "lalamove";
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: settings } = trpc.mall.settings.useQuery();
  const { data: paymentMethods } = trpc.paymentMethods.listEnabled.useQuery();
  const theme = getMallTheme(settings?.activeTheme, settings?.customThemeColors);

  // smartPaste is a query, use lazy fetch
  const [smartPasteLoading, setSmartPasteLoading] = useState(false);

  // findMergeableOrders is a query, use lazy query pattern
  const [mergeableData, setMergeableData] = useState<any[]>([]);

  const [mergeableOrders, setMergeableOrders] = useState<any[]>([]);

  const checkoutMutation = trpc.mall.checkout.useMutation({
    onSuccess: (data: any) => {
      localStorage.removeItem(MALL_CART_STORAGE_KEY);
      setOrderResult(data);
      toast.success(data.merged ? "已合并到保留订单" : "订单已创建");
    },
    onError: (e: any) => toast.error(`下单失败: ${e.message}`),
  });

  const secureAddOnMutation = trpc.mall.addToSecureOrder.useMutation({
    onSuccess: (data: any) => {
      localStorage.removeItem(MALL_CART_STORAGE_KEY);
      // V2.0.90: Keep the order session in localStorage so user can add more items later
      setOrderResult({ ...data, added: true });
      toast.success("商品已加入原订单，请返回订单链接完成付款");
    },
    onError: (e: any) => toast.error(`加单失败: ${e.message}`),
  });

  useEffect(() => {
    try { setCart(readMallCartItems(localStorage.getItem(MALL_CART_STORAGE_KEY))); } catch { setCart([]); }
    try {
      // V2.0.90: Use localStorage for persistent order session - survives across page navigations
      const saved = localStorage.getItem("xintian_mall_add_on_order");
      if (saved) {
        const context = JSON.parse(saved);
        setSecureAddOnOrder(context);
        setForm((current) => ({
          ...current,
          customerName: context.customerName || current.customerName,
          contactNumber: context.contactNumber || current.contactNumber,
          addressLine1: context.shippingAddress || current.addressLine1,
          shippingMethod: context.shippingMethod || current.shippingMethod,
        }));
        // V2.0.90: DON'T remove the session - keep it persistent so user can add more items later
      }
    } catch {
      localStorage.removeItem("xintian_mall_add_on_order");
    }
  }, []);

  function persistCart(nextCart: any[]) {
    setCart(nextCart);
    localStorage.setItem(MALL_CART_STORAGE_KEY, JSON.stringify(nextCart));
    window.dispatchEvent(new Event("cart-updated"));
  }

  function updateCartQuantity(itemIndex: number, requestedQuantity: number) {
    const item = cart[itemIndex];
    if (!item) return;
    const requested = Math.max(1, Number.isFinite(requestedQuantity) ? requestedQuantity : 1);
    const availableStock = Number(item.availableStock ?? item.stockQuantity ?? Number.POSITIVE_INFINITY);
    const allowOversell = Boolean(item.allowOversell);
    if (!allowOversell && requested > availableStock) {
      toast.error(`库存不足，目前最多可购买 ${Math.max(availableStock, 0)} 件。`);
    }
    const quantity = !allowOversell && Number.isFinite(availableStock) ? Math.max(1, Math.min(requested, availableStock)) : requested;
    const nextCart = cart.map((cartItem, index) => index === itemIndex
      ? { ...cartItem, quantity, subtotal: (parseFloat(cartItem.unitPrice) * quantity).toFixed(2) }
      : cartItem,
    );
    persistCart(nextCart);
  }

  function removeCartItem(itemIndex: number) {
    persistCart(cart.filter((_, index) => index !== itemIndex));
    toast.success("商品已从购物车移除");
  }

  const subtotal = cart.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  
  // Split items into normal and standalone shipping
  const normalItems = cart.filter(i => !i.isStandalone);
  const standaloneItems = cart.filter(i => i.isStandalone);
  // Weight for shipping calculation: only normal (non-standalone) items
  const totalWeight = normalItems.reduce((sum, i) => sum + 0.5 * i.quantity, 0);
  const normalSubtotal = normalItems.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const specialItems = cart.filter(i => i.isSpecial);
  const specialSubtotal = specialItems.reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  // Free shipping threshold excludes special-price items (V2.1 rule)
  const thresholdSubtotal = normalSubtotal - specialSubtotal;
  const regularSubtotal = subtotal - specialSubtotal;
  
  let shippingFee = 0;
  let standaloneShippingFee = 0;
  if (form.shippingMethod === "west_malaysia") {
    if (thresholdSubtotal >= 150) {
      // 满 RM150：10kg 以内免邮，超过 10kg 每公斤 RM3
      shippingFee = totalWeight <= 10 ? 0 : Math.ceil(totalWeight - 10) * 3;
    } else {
      // 未满 RM150：10kg 以内 RM15，超过 10kg 每公斤 RM3
      shippingFee = 15 + (totalWeight <= 10 ? 0 : Math.ceil(totalWeight - 10) * 3);
    }
  } else if (form.shippingMethod === "east_malaysia" || form.shippingMethod === "east_malaysia_shopee") {
    // V2.0.84: 东马 Shopee 运费固定 RM0
    shippingFee = 0;
  } else if (form.shippingMethod === "east_malaysia_poslaju") {
    // V2.0.84: 东马 PosLaju 预收 RM50
    shippingFee = 50;
  } else if (form.shippingMethod === "lalamove") {
    // V2.0.84: Lalamove — 满 RM150 公司承担，未满收 RM15
    shippingFee = thresholdSubtotal >= 150 ? 0 : 15;
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
    if (cart.length === 0) { toast.error("购物车为空"); return; }
    if (secureAddOnOrder) {
      secureAddOnMutation.mutate({
        orderNumber: secureAddOnOrder.orderNumber,
        token: secureAddOnOrder.token,
        items: cart.map((item) => ({
          productId: item.productId,
          variationId: item.variationId || undefined,
          quantity: item.quantity,
        })),
      });
      return;
    }
    if (!form.customerName || !form.contactNumber || !form.addressLine1 || !form.postcode || !form.city || !form.state) {
      toast.error("请填写完整的收货信息");
      return;
    }
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
        isSpecial: i.isSpecial || false,
        isStandalone: i.isStandalone || false,
      })),
      paymentMethodId,
      paymentMethodName: selectedPayment?.name,
      mergeIntoOrderId,
      repotPairs: repotEnabled ? repotPairs.filter(p => p.plantProductId && p.potProductId) : [],
      customerRemark: customerRemark || undefined,
    } as any);
  }

  if (orderResult) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden" style={{ backgroundColor: theme.background, backgroundImage: theme.visual.pattern }}>
        <MallThemeDecorations theme={theme} />
        <Card className="relative z-10 mx-4 w-full max-w-md border-white/80 bg-white/90" style={{ borderColor: `${theme.secondary}a8`, boxShadow: `0 16px 36px ${theme.primary}1f` }}>
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <Package className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">{orderResult.added ? "商品已加入原订单" : "订单已创建"}</h2>
            <p className="text-muted-foreground">订单号: {orderResult.orderNumber}</p>
            <p className="text-lg font-bold" style={{ color: theme.primary }}>RM {orderResult.totalAmount}</p>
            {orderResult.merged && <Badge>已合并到保留订单</Badge>}
            <div className="pt-4 space-y-2">
              {orderResult.added && secureAddOnOrder ? (
                <a href={`/order/${orderResult.orderNumber}/${secureAddOnOrder.token}`}>
                  <Button className="w-full hover:opacity-90" style={{ backgroundColor: theme.button }}>返回原订单</Button>
                </a>
              ) : (
                <Link href={`/mall/payment/${orderResult.orderNumber}?phone=${encodeURIComponent(form.contactNumber || '')}`}>
                  <Button className="w-full hover:opacity-90" style={{ backgroundColor: theme.button }}>去付款</Button>
                </Link>
              )}
              {/* V2.0.90: Removed "查询订单" button - redundant with "返回原订单" */}
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
    <div className="relative min-h-screen overflow-x-hidden" style={{ backgroundColor: theme.background, backgroundImage: theme.visual.pattern, color: theme.font }}>
      <MallThemeDecorations theme={theme} />
      <div className="relative z-10">
      <header className="sticky top-0 z-50 border-b shadow-sm" style={{ backgroundColor: `${theme.background}f2`, borderColor: `${theme.secondary}8c`, backdropFilter: "blur(12px)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/mall"><Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button></Link>
          <h1 className="font-semibold text-lg">结算</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {secureAddOnOrder && (
          <Card className="border bg-white/80" style={{ borderColor: theme.primary, backgroundColor: `${theme.secondary}4a` }}>
            <CardContent className="flex items-start gap-3 p-4">
              <Merge className="mt-0.5 h-5 w-5 shrink-0" style={{ color: theme.primary }} />
              <div>
                <p className="font-semibold" style={{ color: theme.font }}>正在为原订单加单</p>
                <p className="mt-1 text-sm" style={{ color: `${theme.font}c7` }}>新商品将加入订单 <strong>{secureAddOnOrder.orderNumber}</strong>；原收货资料、运费与付款状态会保留，无需再次填写。</p>
              </div>
            </CardContent>
          </Card>
        )}
        {!secureAddOnOrder && (<>
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

        {/* Free Repotting Service */}
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox checked={repotEnabled} onCheckedChange={(v) => setRepotEnabled(!!v)} id="repot-checkbox" />
              <Label htmlFor="repot-checkbox" className="font-medium cursor-pointer">🪴 免费换盆服务</Label>
            </div>
            {repotEnabled && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">如需换盆，请选择对应的植物和花盆，以及换盆数量。</p>
                {cart.filter(i => i.productType === "plant" || !i.productType).length === 0 && cart.filter(i => i.productType === "pot").length === 0 ? (
                  <p className="text-xs text-orange-600">要换盆的花友，请先把需要使用的花盆加入订单，再回来选择换盆。</p>
                ) : (
                  <>
                    {repotPairs.map((pair, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Select value={String(pair.plantProductId)} onValueChange={(v) => {
                          const item = cart.find(i => String(i.productId) === v);
                          const newPairs = [...repotPairs];
                          newPairs[idx] = { ...pair, plantProductId: Number(v), plantName: item?.productName || "" };
                          setRepotPairs(newPairs);
                        }}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="选择植物" /></SelectTrigger>
                          <SelectContent>
                            {cart.filter(i => i.productType === "plant" || !i.productType).map((i) => (
                              <SelectItem key={i.productId} value={String(i.productId)}>{i.productName} {i.variationName ? `(${i.variationName})` : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-sm">→</span>
                        <Select value={String(pair.potProductId)} onValueChange={(v) => {
                          const item = cart.find(i => String(i.productId) === v);
                          const newPairs = [...repotPairs];
                          newPairs[idx] = { ...pair, potProductId: Number(v), potName: item?.productName || "" };
                          setRepotPairs(newPairs);
                        }}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="选择花盆" /></SelectTrigger>
                          <SelectContent>
                            {cart.filter(i => i.productType === "pot").map((i) => (
                              <SelectItem key={i.productId} value={String(i.productId)}>{i.productName} {i.variationName ? `(${i.variationName})` : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={1}
                          className="w-16"
                          value={pair.quantity}
                          onChange={(e) => {
                            const newPairs = [...repotPairs];
                            newPairs[idx] = { ...pair, quantity: parseInt(e.target.value) || 1 };
                            setRepotPairs(newPairs);
                          }}
                        />
                        <Button variant="ghost" size="sm" onClick={() => setRepotPairs(repotPairs.filter((_, i) => i !== idx))}>
                          ✕
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setRepotPairs([...repotPairs, { plantProductId: 0, plantName: "", potProductId: 0, potName: "", quantity: 1 }])}>
                      + 新增换盆
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Remark */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="font-medium">订单备注</Label>
            <Textarea
              value={customerRemark}
              onChange={(e) => setCustomerRemark(e.target.value)}
              placeholder="其他备注（如需换盆请上方勾选）"
              rows={2}
            />
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
                  <div><p className="font-medium text-sm">西马配送</p><p className="text-xs text-muted-foreground">满RM150首10kg免邮，未满RM15起，续重RM3/kg</p></div>
                </div>
                <span className="font-semibold">{shippingFee === 0 ? "免邮" : `RM ${shippingFee}`}</span>
              </label>
              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent mb-2">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="east_malaysia_poslaju" />
                  <div><p className="font-medium text-sm">东马 PosLaju</p><p className="text-xs text-muted-foreground">预收 RM50，打包后按实际运费结算</p></div>
                </div>
                <span className="font-semibold">RM 50</span>
              </label>
              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent mb-2">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="east_malaysia_shopee" />
                  <div><p className="font-medium text-sm">东马 Shopee</p><p className="text-xs text-muted-foreground">运费由 Shopee 平台收取，本系统不收运费</p></div>
                </div>
                <span className="font-semibold text-emerald-600">RM 0</span>
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
                  <div><p className="font-medium text-sm">Lalamove</p><p className="text-xs text-muted-foreground">满 RM150 免邮，未满 RM15</p></div>
                </div>
                <span className="font-semibold">{thresholdSubtotal >= 150 ? "免邮" : "RM 15"}</span>
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
                {paymentMethods?.filter((p: any) => p.isEnabled && (p.type !== "cash" || form.shippingMethod === "self_pickup")).map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        </>)}

        {/* Order Summary */}
        <Card>
          <CardHeader><CardTitle>订单摘要</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {cart.map((item, i) => (
              <div key={`${item.productId}-${item.variationId ?? "default"}-${i}`} className="flex items-center gap-2 rounded-lg border border-transparent py-1 text-sm">
                <span className="min-w-0 flex-1 truncate">{item.productName} {item.variationName ? `(${item.variationName})` : ""}</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQuantity(i, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="减少数量"><Minus className="h-3.5 w-3.5" /></Button>
                  <Input className="h-7 w-11 px-1 text-center text-xs" inputMode="numeric" value={item.quantity} onChange={(event) => updateCartQuantity(i, parseInt(event.target.value) || 1)} aria-label={`${item.productName} 数量`} />
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQuantity(i, item.quantity + 1)} disabled={!item.allowOversell && Number.isFinite(Number(item.availableStock ?? item.stockQuantity)) && item.quantity >= Number(item.availableStock ?? item.stockQuantity)} aria-label="增加数量"><Plus className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={() => removeCartItem(i)} aria-label="移除商品"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <span className="w-20 text-right font-medium">RM {item.subtotal}</span>
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
            {secureAddOnOrder ? (
              <>
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  这是加购商品小计。确认加单后，系统会按原订单的配送方式重新计算总额与运费。
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold text-lg">
                  <span>本次加购</span><span className="text-[#2d6a4f]">RM {subtotal.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </CardContent>
        </Card>

        {/* Import Pre-order Agreement */}
        {cart.some((i: any) => i.salesMode === "import_preorder") && (
          <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-purple-700 font-medium">
              <Plane className="h-4 w-4" />
              中国进口代购商品提醒
            </div>
            <p className="text-sm text-purple-600">
              您的购物车中包含中国进口代购商品。此商品需等待中国采购及运输，预计等待时间较长。付款后才会开始采购，到货后通知发货。
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={importAgreed} onCheckedChange={(v) => setImportAgreed(!!v)} />
              <span className="text-sm">我已了解这是中国进口预购商品，愿意等待采购及运输</span>
            </label>
          </div>
        )}
        <Button
          className="w-full bg-[#2d6a4f] hover:bg-[#40916c] text-lg py-6"
          onClick={handleCheckout}
          disabled={checkoutMutation.isPending || secureAddOnMutation.isPending || (cart.some((i: any) => i.salesMode === "import_preorder") && !importAgreed)}
        >
          {checkoutMutation.isPending || secureAddOnMutation.isPending
            ? "提交中..."
            : secureAddOnOrder
              ? `确认加入原订单 · RM ${subtotal.toFixed(2)}`
              : `确认下单 · RM ${total.toFixed(2)}`}
        </Button>
      </main>
      </div>
    </div>
  );
}
