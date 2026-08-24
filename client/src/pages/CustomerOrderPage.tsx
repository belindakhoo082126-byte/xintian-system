import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Truck, MapPin, Phone, User, CheckCircle2, Clock, ExternalLink, Leaf, AlertCircle, RefreshCw, MapPinCheck, Upload, Copy, QrCode, University, Banknote, ShoppingBag, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { WEST_MALAYSIA_V22_SHIPPING } from "@shared/shippingV22";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  // Local order statuses (mapped from server Chinese labels)
  "未汇款": { label: "未汇款订单", color: "bg-amber-100 text-amber-900", icon: Clock },
  "付款审核中": { label: "付款审核中", color: "bg-sky-100 text-sky-900", icon: Clock },
  "部分汇款": { label: "部分汇款", color: "bg-amber-100 text-amber-900", icon: Clock },
  "保留订单": { label: "保留订单", color: "bg-purple-100 text-purple-900", icon: Clock },
  "待包货": { label: "待包货", color: "bg-sky-100 text-sky-900", icon: Package },
  "预约发货": { label: "预约发货", color: "bg-indigo-100 text-indigo-900", icon: Clock },
  "部分发货": { label: "部分发货", color: "bg-orange-100 text-orange-900", icon: Truck },
  "已发货": { label: "已发货", color: "bg-emerald-100 text-emerald-900", icon: Truck },
  "已完成": { label: "已完成", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
  "已取消": { label: "已取消", color: "bg-red-100 text-red-900", icon: AlertCircle },
  // XTC import order statuses
  "挂单": { label: "挂单", color: "bg-amber-100 text-amber-900", icon: Clock },
  "待审核付款凭证": { label: "待审核付款凭证", color: "bg-sky-100 text-sky-900", icon: Clock },
  "待备货": { label: "待备货", color: "bg-purple-100 text-purple-900", icon: Package },
  "待发货": { label: "待发货", color: "bg-indigo-100 text-indigo-900", icon: Package },
  "取消": { label: "取消", color: "bg-red-100 text-red-900", icon: AlertCircle },
  // Fallback for old English keys
  "Pending Payment": { label: "未汇款订单", color: "bg-amber-100 text-amber-900", icon: Clock },
  "Payment Review": { label: "付款审核中", color: "bg-sky-100 text-sky-900", icon: Clock },
  "Partial Payment": { label: "部分汇款", color: "bg-amber-100 text-amber-900", icon: Clock },
  "Hold Order": { label: "保留订单", color: "bg-purple-100 text-purple-900", icon: Clock },
};

const SHIPPING_METHODS = [
  { value: "west_malaysia", label: "西马配送" },
  { value: "east_malaysia_poslaju", label: "东马 PosLaju" },
  { value: "east_malaysia_shopee", label: "东马 Shopee" },
  { value: "self_pickup", label: "自取" },
  { value: "lalamove", label: "Lalamove" },
];

const PAYMENT_TYPE_ICONS: Record<string, any> = {
  qr_code: QrCode,
  bank_transfer: University,
  cash: Banknote,
};

export default function CustomerOrderPage(props: any) {
  const orderNumber = props.orderNumber ?? props.match?.params?.orderNumber ?? "";
  const token = props.token ?? props.match?.params?.token ?? "";

  // V2.0.2: refetch every 10s for near real-time updates
  const { data: order, isLoading, error, isFetching } = trpc.publicOrder.getByToken.useQuery(
    { orderNumber, token },
    {
      enabled: orderNumber.length > 0 && token.length > 0,
      refetchInterval: 10 * 1000,
      refetchOnWindowFocus: true,
      staleTime: 5 * 1000,
    }
  );
  const { data: carePackLink } = trpc.publicOrder.getCarePackPath.useQuery(
    { orderNumber, token },
    { enabled: orderNumber.length > 0 && token.length >= 32, staleTime: 60 * 1000 }
  );

  // V2.0.3: Address form state
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [shippingMethod, setShippingMethod] = useState<string>("west_malaysia");
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [customerRemark, setCustomerRemark] = useState("");
  const [repotService, setRepotService] = useState(false);
  // V2.0.68: Structured repotting entries (same as admin)
  const [repottingEntries, setRepottingEntries] = useState<Array<{ plantName: string; potName: string; quantity: number }>>([]);
  const utils = trpc.useUtils();
  const { data: paymentMethods } = trpc.paymentMethods.listEnabled.useQuery();

  const submitRemarkMutation = trpc.publicOrder.updateRemark.useMutation({
    onSuccess: () => {
      toast.success("备注已保存");
      setCustomerRemark("");
      setRepotService(false);
      setRepottingEntries([]);
      utils.publicOrder.getByToken.invalidate({ orderNumber, token });
    },
    onError: (e: any) => toast.error("保存失败: " + e.message),
  });

  const updateAddressMutation = trpc.publicOrder.updateAddress.useMutation({
    onSuccess: () => {
      toast.success("收货地址已更新，运费已重新计算");
      setShowAddressForm(false);
    },
    onError: (e: any) => toast.error("更新失败: " + e.message),
  });

  const submitPaymentReceiptMutation = trpc.publicOrder.submitPaymentReceipt.useMutation({
    onSuccess: async () => {
      toast.success("付款凭证已上传，等待商家确认");
      setShowPaymentPanel(false);
      setReceiptFile(null);
      setReceiptPreview("");
      await utils.publicOrder.getByToken.invalidate({ orderNumber, token });
    },
    onError: (e: any) => toast.error("上传失败: " + e.message),
  });

  const o = order as any;
  const statusInfo = o ? STATUS_CONFIG[o.customerStatus] || STATUS_CONFIG["Pending Payment"] : null;
  const hasAddress = !!(o?.shippingAddress);
  const estimatedWeight = Number(o?.estimatedWeight || o?.totalWeight || 0);
  const isWestMalaysia = o?.shippingMethod === "west_malaysia";
  const extraWeightKg = isWestMalaysia ? Math.max(0, Math.ceil(estimatedWeight - WEST_MALAYSIA_V22_SHIPPING.includedWeightKg)) : 0;
  const extraWeightFee = extraWeightKg * WEST_MALAYSIA_V22_SHIPPING.additionalKgFee;
  const shippingFee = Number(o?.shippingFee || 0);
  const baseShippingFee = isWestMalaysia ? Math.max(0, shippingFee - extraWeightFee) : shippingFee;
  const isFreeShipping = isWestMalaysia && estimatedWeight > 0 && baseShippingFee === 0;
  // V2.1.14: Allow mall add-on and address editing for open order statuses (Chinese labels from server)
  const openOrderStatuses = ["未汇款", "保留订单", "部分汇款", "挂单", "Pending Payment", "Hold Order", "Partial Payment"];
  const canEditAddress = openOrderStatuses.includes(o?.customerStatus);
  const canPay = canEditAddress && hasAddress && parseFloat(o?.amountDue || "0") > 0;

  // V2.0.68: Filter payment methods based on shipping method
  // Cash only available for self pickup; delivery methods don't show cash
  const currentShippingMethod = o?.shippingMethod || shippingMethod;
  const isSelfPickup = currentShippingMethod === "self_pickup";
  const filteredPaymentMethods = useMemo(() => {
    if (!paymentMethods) return [];
    return paymentMethods.filter((method: any) => {
      if (!method.isEnabled) return false;
      // Hide cash for non-self-pickup shipping methods
      if (method.type === "cash" && !isSelfPickup) return false;
      return true;
    });
  }, [paymentMethods, isSelfPickup]);

  // V2.0.68: Get plant items from order (isPot=false) for repotting
  const orderPlants = useMemo(() => {
    if (!o?.items) return [];
    return o.items.filter((item: any) => !item.isPot && item.productType === "physical");
  }, [o?.items]);

  // V2.0.68: Get pot items from order (isPot=true) for repotting
  const orderPots = useMemo(() => {
    if (!o?.items) return [];
    return o.items.filter((item: any) => item.isPot);
  }, [o?.items]);

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} 已复制`);
  }

  function handleReceiptSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setReceiptPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmitReceipt() {
    if (!selectedPaymentMethod) {
      toast.error("请选择付款方式");
      return;
    }
    if (!receiptFile) {
      toast.error("请选择付款凭证图片");
      return;
    }
    setUploadingReceipt(true);
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("读取文件失败"));
        reader.readAsDataURL(receiptFile);
      });
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: content, filename: receiptFile.name, contentType: receiptFile.type }),
      });
      if (!response.ok) throw new Error("文件上传失败");
      const uploaded = await response.json();
      await submitPaymentReceiptMutation.mutateAsync({
        orderNumber,
        token,
        receiptUrl: uploaded.url,
        paymentMethodId: selectedPaymentMethod.id,
      });
    } catch (e: any) {
      toast.error(e?.message || "上传失败，请重试");
    } finally {
      setUploadingReceipt(false);
    }
  }

  function goToMallForAddOn() {
    if (!o) return;
    // V2.0.90: Use localStorage for persistent order session - survives across page navigations
    localStorage.setItem("xintian_mall_add_on_order", JSON.stringify({
      orderNumber,
      token,
      customerName: o.customerName || "",
      contactNumber: o.customerPhone || "",
      shippingAddress: o.shippingAddress || "",
      shippingMethod: o.shippingMethod || "west_malaysia",
    }));
    // V2.0.90: Don't clear cart - allow adding more items to existing cart across visits
    window.location.assign("/mall");
  }

  // V2.0.68: Handle saving remark with repotting data
  function handleSaveRemark() {
    const remarkText = customerRemark.trim();
    if (!remarkText && !repotService) {
      toast.error("请填写备注内容或勾选换盆服务");
      return;
    }

    if (repotService && repottingEntries.length > 0) {
      // Save with repotting data (same format as admin)
      const repottingData = JSON.stringify(repottingEntries.map(e => ({
        plantName: e.plantName,
        potName: e.potName,
        quantity: e.quantity,
      })));
      const content = [
        remarkText,
        `【换盆服务】共 ${repottingEntries.length} 组换盆`,
      ].filter(Boolean).join("\n");
      submitRemarkMutation.mutate({
        orderNumber,
        token,
        remark: content,
        remarkCategory: "repotting",
        repottingData,
      });
    } else {
      const content = [
        remarkText,
        repotService ? `【换盆服务】需要换盆服务` : "",
      ].filter(Boolean).join("\n");
      submitRemarkMutation.mutate({
        orderNumber,
        token,
        remark: content,
      });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Xintian Brand Header */}
      <div className="border-b bg-card">
        <div className="container max-w-2xl mx-auto py-4 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg text-primary">心田 Xintian</span>
          </div>
          {isFetching && !isLoading && (
            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>
      </div>
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-center mb-2">订单查询</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">您的订单状态如下</p>

        {isLoading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">加载中...</CardContent>
          </Card>
        )}

        {error && !isLoading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
              订单链接无效或已过期，请联系客服获取最新订单链接
            </CardContent>
          </Card>
        )}

        {o && !isLoading && (
          <div className="space-y-4">
            {/* V2.0.3: Address status banner - yellow when no address, green when completed */}
            {!hasAddress && canEditAddress && !showAddressForm && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <MapPin className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">
                    请先填写收货地址
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    系统将自动计算运费后即可完成付款。消费满 RM150（不含特价商品）10kg 内即可享用免邮福利。
                  </p>
                  <Button size="sm" className="mt-2" onClick={() => setShowAddressForm(true)}>
                    填写收货地址
                  </Button>
                </div>
              </div>
            )}
            {hasAddress && !showAddressForm && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium text-emerald-900">✓ 收货地址已完成</span>
                  <span className="text-emerald-700">配送方式：{SHIPPING_METHODS.find(m => m.value === o.shippingMethod)?.label || o.shippingMethod}</span>
                  <span className="text-emerald-700">客户应付运费：RM {o.shippingFee || "0.00"}</span>
                </div>
                {canEditAddress && (
                  <Button variant="ghost" size="sm" className="text-emerald-700 hover:text-emerald-900" onClick={() => {
                    setAddressInput(o.shippingAddress || "");
                    setPhoneInput(o.customerPhone || "");
                    setShippingMethod(o.shippingMethod || "west_malaysia");
                    setShowAddressForm(true);
                  }}>
                    修改
                  </Button>
                )}
              </div>
            )}

            {/* V2.0.3: Address form */}
            {showAddressForm && canEditAddress && (
              <Card>
                <CardHeader><CardTitle className="text-base">填写收货地址</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>配送方式</Label>
                    <Select value={shippingMethod} onValueChange={setShippingMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHIPPING_METHODS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>联系电话</Label>
                    <Input
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value)}
                      placeholder="请输入联系电话"
                    />
                  </div>
                  <div>
                    <Label>收货地址</Label>
                    <Textarea
                      value={addressInput}
                      onChange={e => setAddressInput(e.target.value)}
                      placeholder="请输入详细收货地址（包括州属、邮编）"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={updateAddressMutation.isPending || !addressInput.trim()}
                      onClick={() => {
                        updateAddressMutation.mutate({
                          orderNumber,
                          token,
                          address: addressInput.trim(),
                          phone: phoneInput.trim(),
                          shippingMethod: shippingMethod as any,
                        });
                      }}
                    >
                      {updateAddressMutation.isPending ? "计算中..." : "确认并计算运费"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddressForm(false)}>取消</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 1. 订单资料 - Status */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">订单编号</div>
                    <div className="font-semibold">{o.orderNumber}</div>
                  </div>
                  <Badge className={statusInfo?.color}>
                    {statusInfo && <statusInfo.icon className="h-3 w-3 mr-1" />}
                    {statusInfo?.label}
                  </Badge>
                </div>
                {carePackLink?.path ? (
                  <div className="mt-4 border-t pt-4">
                    <Button variant="outline" className="w-full border-emerald-700 text-emerald-900 hover:bg-emerald-50" asChild>
                      <a href={carePackLink.path} target="_blank" rel="noreferrer">
                        <Leaf className="mr-2 h-4 w-4" />查看／保存本订单商品养护知识包
                      </a>
                    </Button>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">知识包会按当前有效商品更新；开始包货后将保存为最终版本。</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* 2. 商品列表 */}
            <Card>
              <CardHeader><CardTitle className="text-base">商品列表</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {o.items.map((item: any, i: number) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border flex-shrink-0 bg-muted">
                      {item.coverImageUrl ? (
                        <img src={item.coverImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">无图</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{item.productName}</div>
                      {item.variationName && <div className="text-xs text-muted-foreground">{item.variationName}</div>}
                      <div className="text-xs text-muted-foreground">×{item.quantity} @ RM {item.unitPrice}</div>
                    </div>
                    <div className="text-sm font-medium">RM {item.subtotal || (parseFloat(item.unitPrice) * item.quantity).toFixed(2)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 3. 金额明细 */}
            <Card>
              <CardHeader><CardTitle className="text-base">金额明细</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>商品小计</span>
                  <span>RM {o.physicalSubtotal || o.totalAmount}</span>
                </div>

                {/* 运费 */}
                <div className="flex justify-between">
                  <span>运费 {hasAddress ? "" : "(待计算)"}</span>
                  <span>{hasAddress ? `RM ${o.shippingFee || "0.00"}` : "— 填写地址后计算"}</span>
                </div>
                {isWestMalaysia && estimatedWeight > 0 && (
                  <div className="rounded-md bg-emerald-50 border border-emerald-100 px-3 py-2 mt-2 space-y-1 text-emerald-900">
                    <div className="flex justify-between"><span>估计重量</span><span>{estimatedWeight.toFixed(2)} kg</span></div>
                    <div className="flex justify-between"><span>{isFreeShipping ? "首10kg免运" : "首10kg基础运费"}</span><span>RM {baseShippingFee.toFixed(2)}</span></div>
                    {extraWeightKg > 0 && <div className="flex justify-between"><span>续重运费（{extraWeightKg}kg × RM {WEST_MALAYSIA_V22_SHIPPING.additionalKgFee}）</span><span>RM {extraWeightFee.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-medium border-t border-emerald-200 pt-1"><span>客户应付运费</span><span>RM {shippingFee.toFixed(2)}</span></div>
                  </div>
                )}

                {/* 额外收费 */}
                {parseFloat(o.extraCharge || "0") > 0 && (
                  <div className="flex justify-between">
                    <div className="flex flex-col">
                      <span>额外收费 (Extra Charge)</span>
                      {o.extraChargeDescription && (
                        <span className="text-xs text-muted-foreground">原因：{o.extraChargeDescription}</span>
                      )}
                    </div>
                    <span>RM {o.extraCharge}</span>
                  </div>
                )}

                {/* 人工折扣 */}
                {parseFloat(o.discountAmount || "0") > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <div className="flex flex-col">
                      <span>人工折扣 (Discount)</span>
                      {o.discountReason && (
                        <span className="text-xs text-muted-foreground">原因：{o.discountReason}</span>
                      )}
                    </div>
                    <span>-RM {o.discountAmount}</span>
                  </div>
                )}

                {/* Credit 扣减 */}
                {parseFloat(o.creditUsed || "0") > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Credit 抵扣</span>
                    <span>-RM {o.creditUsed}</span>
                  </div>
                )}

                <Separator className="my-2" />

                {/* 订单总额 */}
                <div className="flex justify-between font-semibold text-base">
                  <span>订单总额</span>
                  <span>RM {o.totalAmount}</span>
                </div>

                {/* 已付 */}
                {parseFloat(o.paidAmount || "0") > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>已付</span>
                    <span>RM {o.paidAmount}</span>
                  </div>
                )}

                {/* 已退款 */}
                {parseFloat(o.refundedAmount || "0") > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>已退款</span>
                    <span>RM {o.refundedAmount}</span>
                  </div>
                )}

                {/* 应付款 / 多汇款 */}
                <Separator className="my-2" />
                {parseFloat(o.amountDue || "0") > 0 ? (
                  <div className="flex justify-between font-bold text-lg">
                    <span>尚欠</span>
                    <span className="text-red-600">RM {o.amountDue || "0.00"}</span>
                  </div>
                ) : parseFloat(o.overpaidAmount || "0") > 0 ? (
                  <div className="flex justify-between font-bold text-lg">
                    <span>多汇款</span>
                    <span className="text-orange-600">RM {o.overpaidAmount || "0.00"}</span>
                  </div>
                ) : (
                  <div className="flex justify-between font-bold text-lg">
                    <span>应付款</span>
                    <span className="text-emerald-600">RM 0.00</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 4. 付款记录 - Show existing payment records */}
            {o.payments && o.payments.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">付款记录</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {o.payments.map((p: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                      <div>
                        <span className="font-medium">{p.paymentMethodName || p.paymentMethod || "-"}</span>
                        <span className="text-muted-foreground ml-2">{new Date(p.paymentDate || p.createdAt).toLocaleString("zh-CN")}</span>
                        {p.reviewStatus === 'pending' && (
                          <Badge className="ml-2 bg-orange-100 text-orange-700">待审核</Badge>
                        )}
                        {p.reviewStatus === 'approved' && (
                          <Badge className="ml-2 bg-green-100 text-green-700">已确认</Badge>
                        )}
                        {p.reviewStatus === 'rejected' && (
                          <Badge className="ml-2 bg-red-100 text-red-700">审核失败</Badge>
                        )}
                        {p.reviewStatus === 'rejected' && p.rejectReason && (
                          <span className="text-red-500 text-xs ml-2">{p.rejectReason}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">RM {parseFloat(p.amount).toFixed(2)}</span>
                        {p.receiptUrl && (
                          <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                            查看单据 <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 5. 订单备注（含换盆功能） */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">订单备注</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm">备注内容</Label>
                  <Textarea
                    value={customerRemark}
                    onChange={e => setCustomerRemark(e.target.value)}
                    placeholder="如有特殊要求请在此备注（如配送时间、包装要求等）"
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="repot-service"
                    checked={repotService}
                    onChange={e => {
                      setRepotService(e.target.checked);
                      if (!e.target.checked) {
                        setRepottingEntries([]);
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="repot-service" className="text-sm cursor-pointer">需要换盆服务</Label>
                </div>
                {repotService && (
                  <div className="space-y-3 border rounded-lg p-3 bg-purple-50/30">
                    <Label className="text-xs">换盆记录（可添加多组，系统会自动读取本订单的植物和花盆）</Label>
                    {repottingEntries.map((entry, idx) => (
                      <div key={idx} className="flex items-end gap-2 p-3 border rounded-lg bg-background">
                        <div className="flex-1">
                          <Label className="text-xs mb-1 block">植物名称</Label>
                          <Select
                            value={entry.plantName}
                            onValueChange={(v) => {
                              setRepottingEntries(prev => prev.map((r, i) => i === idx ? { ...r, plantName: v } : r));
                            }}
                          >
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="选择植物" /></SelectTrigger>
                            <SelectContent>
                              {orderPlants.length === 0 ? (
                                <SelectItem value="__none" disabled>本订单无植物类商品</SelectItem>
                              ) : (
                                orderPlants.map((item: any, i: number) => (
                                  <SelectItem key={`${item.productId}-${i}`} value={item.productName}>
                                    {item.productName}{item.variationName ? ` (${item.variationName})` : ""} ×{item.quantity}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs mb-1 block">花盆</Label>
                          <Select
                            value={entry.potName}
                            onValueChange={(v) => {
                              setRepottingEntries(prev => prev.map((r, i) => i === idx ? { ...r, potName: v } : r));
                            }}
                          >
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="选择花盆" /></SelectTrigger>
                            <SelectContent>
                              {orderPots.length === 0 ? (
                                <SelectItem value="__none" disabled>本订单无花盆类商品</SelectItem>
                              ) : (
                                orderPots.map((item: any, i: number) => (
                                  <SelectItem key={`${item.productId}-${i}`} value={item.productName}>
                                    {item.productName}{item.variationName ? ` (${item.variationName})` : ""} ×{item.quantity}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-16">
                          <Label className="text-xs mb-1 block">数量</Label>
                          <Input
                            type="number"
                            min={1}
                            value={entry.quantity}
                            onChange={(e) => setRepottingEntries(prev => prev.map((r, i) => i === idx ? { ...r, quantity: Number(e.target.value) } : r))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setRepottingEntries(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRepottingEntries(prev => [...prev, { plantName: "", potName: "", quantity: 1 }])}
                      disabled={orderPlants.length === 0 && orderPots.length === 0}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      添加换盆记录
                    </Button>
                    {orderPlants.length === 0 && orderPots.length === 0 && (
                      <div className="text-xs text-amber-600">
                        本订单中没有植物或花盆商品，如需换盆请先到商城加购花盆。
                      </div>
                    )}
                    {repottingEntries.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        已添加 {repottingEntries.length} 条换盆记录
                      </div>
                    )}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submitRemarkMutation.isPending || (!customerRemark.trim() && !repotService)}
                  onClick={handleSaveRemark}
                >
                  {submitRemarkMutation.isPending ? "保存中..." : "保存备注"}
                </Button>
              </CardContent>
            </Card>

            {/* 6. 收件人资料 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">收件信息</CardTitle>
                  {hasAddress && canEditAddress && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setAddressInput(o.shippingAddress || "");
                      setPhoneInput(o.customerPhone || "");
                      setShippingMethod(o.shippingMethod || "west_malaysia");
                      setShowAddressForm(true);
                    }}>
                      修改
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{o.customerName}</div>
                {o.customerPhone && (
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{o.customerPhone}</div>
                )}
                {o.shippingAddress && (
                  <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />{o.shippingAddress}</div>
                )}
                {o.shippingMethod && (
                  <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" />
                    {SHIPPING_METHODS.find(m => m.value === o.shippingMethod)?.label || o.shippingMethod}
                  </div>
                )}
                {!hasAddress && !showAddressForm && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <MapPinCheck className="h-4 w-4" /> 尚未填写收货地址
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 7. 完成结单（最下方） */}
            {canEditAddress && (
              <Card className="border-primary/25 bg-primary/[0.025]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">完成结单</CardTitle>
                  <p className="text-sm text-muted-foreground">确认商品、金额、备注、收件资料无误后，请直接汇款并上传凭证完成结单。</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!hasAddress && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      请先填写收货地址，系统计算运费后即可完成付款。
                    </div>
                  )}

                  {!showPaymentPanel ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        className="bg-[#2d6a4f] hover:bg-[#40916c]"
                        disabled={!canPay}
                        onClick={() => setShowPaymentPanel(true)}
                      >
                        <Banknote className="mr-2 h-4 w-4" />直接汇款
                      </Button>
                      <Button variant="outline" onClick={goToMallForAddOn}>
                        <ShoppingBag className="mr-2 h-4 w-4" />前往商城加单
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">选择付款方式</p>
                          <p className="text-xs text-muted-foreground">
                            应付款：RM {o.amountDue || "0.00"}
                            {!isSelfPickup && <span className="ml-2 text-amber-600">（配送订单不支持现金付款）</span>}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowPaymentPanel(false)}>取消</Button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {filteredPaymentMethods.map((method: any) => {
                          const Icon = PAYMENT_TYPE_ICONS[method.type] || Banknote;
                          const selected = selectedPaymentMethod?.id === method.id;
                          return (
                            <button
                              key={method.id}
                              type="button"
                              onClick={() => setSelectedPaymentMethod(method)}
                              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/10 ring-1 ring-primary" : "bg-background hover:border-primary/50"}`}
                            >
                              <span className={`rounded-md p-2 ${selected ? "bg-primary text-primary-foreground" : "bg-muted"}`}><Icon className="h-4 w-4" /></span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{method.name}</span>
                                <span className="block text-xs text-muted-foreground">{method.type === "qr_code" ? "扫码付款" : method.type === "bank_transfer" ? "银行转账" : method.type === "cash" ? "现金付款" : "其他付款方式"}</span>
                              </span>
                              {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            </button>
                          );
                        })}
                      </div>

                      {selectedPaymentMethod && (
                        <div className="space-y-3 rounded-lg border bg-background p-4">
                          {/* V2.1.05: QR image only for qr_code type (TNG/DuitNow); bank_transfer shows bank details only */}
                          {selectedPaymentMethod.type === "qr_code" && (
                            <div className="flex justify-center"><img src="/manus-storage/pasted_file_ywVQP7_image_59fb9825.png" alt="汇款资料" className="max-h-96 max-w-full rounded-lg border object-contain" /></div>
                          )}
                          {selectedPaymentMethod.paymentInstruction && <p className="rounded-md bg-muted p-3 text-sm">{selectedPaymentMethod.paymentInstruction}</p>}
                          {/* V2.1.05: Online Transfer bank details — shown only for bank_transfer type */}
                          {selectedPaymentMethod.type === "bank_transfer" && (
                            <div className="p-4 border-2 border-primary/30 rounded-lg bg-green-50/50 dark:bg-green-950/20 space-y-3">
                              <div className="flex items-center gap-2 font-semibold">
                                <University className="h-5 w-5" />
                                <span>银行户口资料</span>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-lg border">
                                  <div>
                                    <p className="text-xs text-muted-foreground">银行</p>
                                    <p className="font-semibold text-sm">Public Bank</p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-lg border">
                                  <div>
                                    <p className="text-xs text-muted-foreground">户口号码</p>
                                    <p className="font-mono font-semibold text-sm">3825375502</p>
                                  </div>
                                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText("3825375502"); toast.success("已复制户口号码"); }}>
                                    <Copy className="h-3.5 w-3.5 mr-1" />复制
                                  </Button>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-lg border">
                                  <div>
                                    <p className="text-xs text-muted-foreground">户口名字</p>
                                    <p className="font-semibold text-sm">ECOLAND NURSERY</p>
                                  </div>
                                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText("ECOLAND NURSERY"); toast.success("已复制户口名字"); }}>
                                    <Copy className="h-3.5 w-3.5 mr-1" />复制
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2 border-t pt-3">
                            <p className="text-sm font-medium">上传付款凭证</p>
                            <p className="text-xs text-muted-foreground">付款后请上传转账截图或收据，商家核对后会更新订单状态。</p>
                            <div className="flex items-center gap-3">
                              <label className="cursor-pointer">
                                <Button type="button" variant="outline" asChild><span><Upload className="mr-2 h-4 w-4" />选择图片</span></Button>
                                <input type="file" accept="image/*" className="hidden" onChange={handleReceiptSelect} />
                              </label>
                              {receiptPreview && <img src={receiptPreview} alt="付款凭证预览" className="h-16 w-16 rounded-md border object-cover" />}
                            </div>
                            <Button className="w-full bg-[#2d6a4f] hover:bg-[#40916c]" disabled={!receiptFile || uploadingReceipt || submitPaymentReceiptMutation.isPending} onClick={handleSubmitReceipt}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />{uploadingReceipt || submitPaymentReceiptMutation.isPending ? "上传中..." : "确认上传付款凭证"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Packages / Tracking - Real data from database */}
            {o.packages && o.packages.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">物流信息</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {o.packages.map((pkg: any, i: number) => (
                    <div key={pkg.id || i} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">包裹 {pkg.packageNumber || i + 1} - {pkg.courierCompany || "快递"}</span>
                        <Badge variant={pkg.status === "shipped" ? "default" : "secondary"}>{pkg.status}</Badge>
                      </div>
                      {pkg.trackingNumber && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">追踪号: {pkg.trackingNumber}</span>
                          <a
                            href={`https://www.trackingmore.com/track/${pkg.trackingNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            查询物流 <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {pkg.items && pkg.items.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          包含: {pkg.items.map((pi: any) => `${pi.productName} ×${pi.quantity}`).join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Payment Info */}
            {o.paymentMethodName && (
              <Card>
                <CardHeader><CardTitle className="text-base">付款方式</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  <div className="flex justify-between">
                    <span>付款方式</span>
                    <span className="font-medium">{o.paymentMethodName}</span>
                  </div>
                  {o.receiptUrl && (
                    <div className="mt-2">
                      <a href={o.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        查看汇款单据 <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Order Date */}
            <div className="text-center text-xs text-muted-foreground">
              订单创建时间: {new Date(o.createdAt).toLocaleString("zh-CN")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
