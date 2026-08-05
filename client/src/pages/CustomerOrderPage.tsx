import { useState } from "react";
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
import { Package, Truck, MapPin, Phone, User, CheckCircle2, Clock, ExternalLink, Leaf, AlertCircle, RefreshCw, MapPinCheck, Upload, Copy, QrCode, University, Banknote, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  "Pending Payment": { label: "未汇款订单", color: "bg-amber-100 text-amber-900", icon: Clock },
  "Payment Review": { label: "付款审核中", color: "bg-sky-100 text-sky-900", icon: Clock },
  "Payment Confirmed": { label: "已确认付款", color: "bg-emerald-100 text-emerald-900", icon: CheckCircle2 },
  "Preparing Goods": { label: "配货中", color: "bg-sky-100 text-sky-900", icon: Package },
  "Partial Shipped": { label: "部分已发货", color: "bg-orange-100 text-orange-900", icon: Truck },
  "Shipped": { label: "已发货", color: "bg-emerald-100 text-emerald-900", icon: Truck },
  "Completed": { label: "已完成", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
  "Cancelled": { label: "已取消", color: "bg-red-100 text-red-900", icon: AlertCircle },
};

const SHIPPING_METHODS = [
  { value: "west_malaysia", label: "西马配送" },
  { value: "east_malaysia", label: "东马配送" },
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
  const [repotRemark, setRepotRemark] = useState("");
  const utils = trpc.useUtils();
  const { data: paymentMethods } = trpc.paymentMethods.listEnabled.useQuery();

  const submitRemarkMutation = trpc.publicOrder.updateRemark.useMutation({
    onSuccess: () => {
      toast.success("备注已保存");
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
  const canEditAddress = o?.customerStatus === "Pending Payment";
  const canPay = canEditAddress && hasAddress && parseFloat(o?.amountDue || "0") > 0;

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
    sessionStorage.setItem("xintian_mall_add_on_order", JSON.stringify({
      orderNumber,
      token,
      customerName: o.customerName || "",
      contactNumber: o.customerPhone || "",
      shippingAddress: o.shippingAddress || "",
      shippingMethod: o.shippingMethod || "west_malaysia",
    }));
    window.location.assign("/mall");
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
                  <span className="text-emerald-700">运费：RM {o.shippingFee || "0.00"}</span>
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

            {/* Status */}
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
              </CardContent>
            </Card>

            {/* Items */}
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

            {/* Amount Summary - V2.0.3: Complete breakdown with shipping */}
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

                {/* 额外费用 */}
                {parseFloat(o.extraCharge || "0") > 0 && (
                  <div className="flex justify-between">
                    <span>{o.extraChargeDescription || "额外费用"}</span>
                    <span>RM {o.extraCharge}</span>
                  </div>
                )}

                {/* Discount */}
                {parseFloat(o.discountAmount || "0") > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>折扣 (Discount)</span>
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

                {/* 应付款 */}
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg">
                  <span>应付款</span>
                  <span className={parseFloat(o.amountDue || "0") > 0 ? "text-red-600" : "text-emerald-600"}>
                    RM {o.amountDue || "0.00"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* V2.0.52: 换盆服务说明 */}
            <Card className="border-purple-200 bg-purple-50/30 dark:border-purple-900/40 dark:bg-purple-950/10">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Leaf className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-900">🌿 换盆服务</p>
                    <p className="text-xs text-purple-700 mt-1">
                      如有需要换盆服务，可以直接把想要更换的植物及花盆加入购物车，结账时在备注区选择换盆服务即可。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* V2.0.52: 客户备注 */}
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
                    onChange={e => setRepotService(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="repot-service" className="text-sm cursor-pointer">需要换盆服务</Label>
                </div>
                {repotService && (
                  <div>
                    <Label className="text-sm">换盆说明</Label>
                    <Textarea
                      value={repotRemark}
                      onChange={e => setRepotRemark(e.target.value)}
                      placeholder="请说明需要换盆的植物及花盆"
                      rows={2}
                    />
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submitRemarkMutation.isPending || (!customerRemark.trim() && !repotService)}
                  onClick={() => {
                    const remarkText = [
                      customerRemark.trim(),
                      repotService ? `【换盆服务】${repotRemark.trim() || "需要换盆服务"}` : "",
                    ].filter(Boolean).join("\n");
                    submitRemarkMutation.mutate({
                      orderNumber,
                      token,
                      remark: remarkText,
                    });
                  }}
                >
                  {submitRemarkMutation.isPending ? "保存中..." : "保存备注"}
                </Button>
              </CardContent>
            </Card>

            {/* 客户结单操作：直接汇款或继续到商城加单 */}
            {canEditAddress && (
              <Card className="border-primary/25 bg-primary/[0.025]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">完成结单</CardTitle>
                  <p className="text-sm text-muted-foreground">您可以直接汇款并上传凭证，或先到商城继续加购商品。加单完毕后可点击购物车进行结账。</p>
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
                          <p className="text-xs text-muted-foreground">应付款：RM {o.amountDue || "0.00"}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowPaymentPanel(false)}>取消</Button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {paymentMethods?.filter((method: any) => method.isEnabled).map((method: any) => {
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
                                <span className="block text-xs text-muted-foreground">{method.type === "qr_code" ? "扫码付款" : method.type === "bank_transfer" ? "银行转账" : "其他付款方式"}</span>
                              </span>
                              {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            </button>
                          );
                        })}
                      </div>

                      {selectedPaymentMethod && (
                        <div className="space-y-3 rounded-lg border bg-background p-4">
                          {selectedPaymentMethod.type === "qr_code" && selectedPaymentMethod.qrImageUrl && (
                            <div className="flex justify-center"><img src={selectedPaymentMethod.qrImageUrl} alt={`${selectedPaymentMethod.name} QR Code`} className="max-h-64 max-w-full rounded-lg border object-contain" /></div>
                          )}
                          {selectedPaymentMethod.type === "bank_transfer" && (
                            <div className="space-y-2 text-sm">
                              {selectedPaymentMethod.bankName && <div className="flex justify-between gap-4"><span className="text-muted-foreground">银行名称</span><span className="font-medium text-right">{selectedPaymentMethod.bankName}</span></div>}
                              {selectedPaymentMethod.accountHolder && <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">账户持有人</span><span className="flex items-center gap-1 font-medium text-right">{selectedPaymentMethod.accountHolder}<Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(selectedPaymentMethod.accountHolder, "账户持有人")}><Copy className="h-3.5 w-3.5" /></Button></span></div>}
                              {selectedPaymentMethod.accountNumber && <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">银行账号</span><span className="flex items-center gap-1 font-mono font-semibold text-right">{selectedPaymentMethod.accountNumber}<Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(selectedPaymentMethod.accountNumber, "银行账号")}><Copy className="h-3.5 w-3.5" /></Button></span></div>}
                            </div>
                          )}
                          {selectedPaymentMethod.paymentInstruction && <p className="rounded-md bg-muted p-3 text-sm">{selectedPaymentMethod.paymentInstruction}</p>}

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

            {/* Shipping Address - V2.0.3: Show address with edit option */}
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
