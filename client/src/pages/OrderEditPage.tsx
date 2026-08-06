import { useState, useMemo, useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, Save, FileText, User, Truck, DollarSign, Package, X, CreditCard,
} from "lucide-react";
import { PaymentRecordsEditor } from "@/components/PaymentRecordsEditor";

const ORDER_NATURE = {
  retail: { label: "零售", enLabel: "Retail" },
  wholesale: { label: "批发", enLabel: "Wholesale" },
  agent: { label: "代理", enLabel: "Agent" },
} as const;

const SHIPPING_METHODS = {
  west_malaysia: { label: "西马", enLabel: "West Malaysia" },
  east_malaysia_poslaju: { label: "东马 Pos Laju", enLabel: "East Malaysia Pos Laju" },
  east_malaysia_shopee: { label: "东马 Shopee", enLabel: "East Malaysia Shopee" },
  lalamove: { label: "Lalamove", enLabel: "Lalamove" },
  self_pickup: { label: "自取", enLabel: "Self Pickup" },
} as const;

const ORDER_SOURCES = {
  facebook_live: { label: "FB直播", enLabel: "FB Live" },
  facebook_post: { label: "FB贴文", enLabel: "FB Post" },
  facebook_reel: { label: "FB Reel", enLabel: "FB Reel" },
  messenger: { label: "Messenger", enLabel: "Messenger" },
  store: { label: "商城", enLabel: "Store" },
  manual: { label: "Admin手动", enLabel: "Admin Manual" },
} as const;

export default function OrderEditPage({ orderId, onBack }: { orderId: number; onBack: () => void }) {
  const { translate, lang } = useI18n();
  const [_, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: order, isLoading } = trpc.orders.getDetail.useQuery({ id: orderId });

  // Editable form state
  const [formData, setFormData] = useState<any>({
    orderNature: "retail",
    orderSource: "manual",
    orderCategory: "local",
    shippingMethod: "west_malaysia",
    shippingAddress: "",
    recipientName: "",
    recipientPhone: "",
    discountAmount: "0",
    discountReason: "",
    extraCharge: "0",
    extraChargeDescription: "",
    creditUsed: "0",
    shippingFee: "0",
  });

  // Load order data into form when available
  useEffect(() => {
    if (order) {
      const o = order as any;
      setFormData({
        orderNature: o.orderNature || "retail",
        orderSource: o.orderSource || "manual",
        orderCategory: o.orderCategory || "local",
        shippingMethod: o.shippingMethod || "west_malaysia",
        shippingAddress: o.shippingAddress || "",
        recipientName: o.recipientName || "",
        recipientPhone: o.recipientPhone || "",
        discountAmount: o.discountAmount || "0",
        discountReason: o.discountReason || "",
        extraCharge: o.extraCharge || "0",
        extraChargeDescription: o.extraChargeDescription || "",
        creditUsed: o.creditUsed || "0",
        shippingFee: o.shippingFee || "0",
      });
    }
  }, [order]);

  const updateDetailsMutation = trpc.orders.updateDetails.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      toast.success(translate("订单更新成功", "Order updated successfully"));
      setLocation(`/orders/browse/${orderId}`);
    },
    onError: (e) => toast.error(translate("更新失败: {message}", "Update failed: {message}", { message: e.message })),
  });

  // Calculate total
  const itemsSubtotal = useMemo(() => {
    if (!order) return 0;
    const o = order as any;
    return parseFloat(o.physicalSubtotal || "0") + parseFloat(o.membershipSubtotal || "0");
  }, [order]);

  const discountNum = parseFloat(formData.discountAmount) || 0;
  const extraChargeNum = parseFloat(formData.extraCharge) || 0;
  // V2.2: Credit is auto-applied from customer account, not manually entered
  const customerCreditBalance = parseFloat((order as any)?.creditBalance || "0");
  const creditUsedNum = useMemo(() => {
    if (customerCreditBalance <= 0) return 0;
    // Auto-apply: use all available credit up to the total amount (before shipping)
    const maxCreditCoverage = itemsSubtotal - discountNum + extraChargeNum;
    return Math.min(customerCreditBalance, Math.max(0, maxCreditCoverage));
  }, [customerCreditBalance, itemsSubtotal, discountNum, extraChargeNum]);
  const shippingFeeNum = parseFloat(formData.shippingFee) || 0;
  const totalAmount = itemsSubtotal - discountNum + extraChargeNum + shippingFeeNum - creditUsedNum;

  function handleSave() {
    updateDetailsMutation.mutate({
      id: orderId,
      ...formData,
      creditUsed: creditUsedNum.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
    });
  }

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold">{translate("编辑订单", "Edit Order")}</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded animate-pulse mb-3" />
                <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold">{translate("订单未找到", "Order Not Found")}</h1>
        </div>
      </div>
    );
  }

  const o = order as any;
  const orderTypeLabel = o.orderCategory === "import" ? translate("中国代购订单", "Import Order") : translate("本地订单", "Local Order");

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              {translate("编辑订单", "Edit Order")}
              <span className="font-mono text-lg text-muted-foreground">#{o.orderNumber}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{orderTypeLabel}</p>
          </div>
        </div>
        <Badge variant="outline">{translate("编辑模式", "Edit Mode")}</Badge>
      </div>

      {/* Section 1: Order Basic Info (editable) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {translate("订单基本资料", "Order Basic Info")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">{translate("订单编号", "Order Number")}</Label>
            <Input value={o.orderNumber} disabled className="bg-muted/50 font-mono" />
          </div>
          <div>
            <Label className="text-xs">{translate("订单类型", "Order Type")}</Label>
            <Select value={formData.orderCategory} onValueChange={(v) => setFormData({ ...formData, orderCategory: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">{translate("本地订单", "Local Order")}</SelectItem>
                <SelectItem value="import">{translate("中国代购订单", "Import Order")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{translate("订单性质", "Order Nature")}</Label>
            <Select value={formData.orderNature} onValueChange={(v) => setFormData({ ...formData, orderNature: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ORDER_NATURE).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{translate("订单来源", "Order Source")}</Label>
            <Select value={formData.orderSource} onValueChange={(v) => setFormData({ ...formData, orderSource: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ORDER_SOURCES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Customer Info (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            {translate("客户资料", "Customer Info")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground">{translate("客户姓名", "Customer Name")}:</span> {o.facebookName || o.customerName || "-"}</div>
          <div><span className="text-muted-foreground">{translate("电话号码", "Phone")}:</span> {o.customerPhone || "-"}</div>
          <div><span className="text-muted-foreground">{translate("Facebook 名称", "FB Name")}:</span> {o.facebookName || "-"}</div>
          <div><span className="text-muted-foreground">{translate("Facebook ID", "FB ID")}:</span> {o.facebookId || "-"}</div>
          <div><span className="text-muted-foreground">{translate("Messenger ID", "Messenger ID")}:</span> {o.messengerId || "-"}</div>
        </CardContent>
      </Card>

      {/* Section 3: Recipient & Shipping (editable) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            {translate("收件人资料与配送方式", "Recipient & Shipping")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">{translate("收件人姓名", "Recipient Name")}</Label>
              <Input value={formData.recipientName} onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("收件人电话", "Recipient Phone")}</Label>
              <Input value={formData.recipientPhone} onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("配送方式", "Shipping Method")}</Label>
              <Select value={formData.shippingMethod} onValueChange={(v) => setFormData({ ...formData, shippingMethod: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SHIPPING_METHODS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">{translate("收件地址", "Shipping Address")}</Label>
            <Textarea
              value={formData.shippingAddress}
              onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Order Items (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            {translate("商品明细", "Order Items")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">{translate("商品名称", "Product Name")}</th>
                  <th className="text-left p-3 font-medium">{translate("规格", "Variation")}</th>
                  <th className="text-right p-3 font-medium">{translate("数量", "Qty")}</th>
                  <th className="text-right p-3 font-medium">{translate("单价", "Unit Price")}</th>
                  <th className="text-right p-3 font-medium">{translate("小计", "Subtotal")}</th>
                </tr>
              </thead>
              <tbody>
                {(o.items || []).map((item: any, idx: number) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="p-3">{item.productName}</td>
                    <td className="p-3 text-muted-foreground">{item.variationName || "-"}</td>
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-right">RM {parseFloat(item.unitPrice).toFixed(2)}</td>
                    <td className="p-3 text-right font-medium">RM {parseFloat(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Amount Details (editable) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {translate("金额详情", "Amount Details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">{translate("折扣金额", "Discount Amount")}</Label>
              <Input type="number" value={formData.discountAmount} onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value || "0" })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{translate("折扣原因", "Discount Reason")}</Label>
              <Input value={formData.discountReason} onChange={(e) => setFormData({ ...formData, discountReason: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("额外收费", "Extra Charge")}</Label>
              <Input type="number" value={formData.extraCharge} onChange={(e) => setFormData({ ...formData, extraCharge: e.target.value || "0" })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{translate("收费说明", "Charge Description")}</Label>
              <Input value={formData.extraChargeDescription} onChange={(e) => setFormData({ ...formData, extraChargeDescription: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("自动扣除Credit", "Auto Credit Used")}</Label>
              <Input type="number" value={creditUsedNum.toFixed(2)} readOnly className="bg-muted" />
            </div>
            <div>
              <Label className="text-xs">{translate("运费", "Shipping Fee")}</Label>
              <Input type="number" value={formData.shippingFee} onChange={(e) => setFormData({ ...formData, shippingFee: e.target.value || "0" })} />
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>{translate("商品小计", "Items Subtotal")}</span><span>RM {itemsSubtotal.toFixed(2)}</span></div>
            {discountNum > 0 && <div className="flex justify-between text-red-600"><span>{translate("折扣", "Discount")}</span><span>-RM {discountNum.toFixed(2)}</span></div>}
            {extraChargeNum > 0 && <div className="flex justify-between"><span>{translate("额外收费", "Extra Charge")}</span><span>+RM {extraChargeNum.toFixed(2)}</span></div>}
            <div className="flex justify-between"><span>{translate("运费", "Shipping Fee")}</span><span>RM {shippingFeeNum.toFixed(2)}</span></div>
            {creditUsedNum > 0 && <div className="flex justify-between text-blue-600"><span>{translate("使用Credit", "Credit Used")}</span><span>-RM {creditUsedNum.toFixed(2)}</span></div>}
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>{translate("总金额", "Total Amount")}</span>
              <span>RM {totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Records Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {translate("付款记录", "Payment Records")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {order && (
            <PaymentRecordsEditor
              orderId={orderId}
              totalAmount={totalAmount}
              paidAmount={parseFloat((order as any).paidAmount || "0")}
              payments={((order as any).payments || []).map((p: any) => ({
                id: p.id,
                amount: p.amount,
                paymentMethod: p.paymentMethod,
                paymentDate: p.paymentDate,
                receiptFiles: p.receiptFiles ? (typeof p.receiptFiles === "string" ? JSON.parse(p.receiptFiles) : p.receiptFiles) : (p.receiptUrl ? [p.receiptUrl] : []),
                notes: p.notes,
                purpose: p.purpose,
              }))}
            />
          )}
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 pt-4 pb-8">
        <Button variant="outline" onClick={onBack}>
          <X className="h-4 w-4 mr-1" />{translate("取消", "Cancel")}
        </Button>
        <Button onClick={handleSave} disabled={updateDetailsMutation.isPending} size="lg">
          <Save className="h-4 w-4 mr-1" />
          {updateDetailsMutation.isPending ? translate("保存中...", "Saving...") : translate("保存修改", "Save Changes")}
        </Button>
      </div>
    </div>
  );
}
