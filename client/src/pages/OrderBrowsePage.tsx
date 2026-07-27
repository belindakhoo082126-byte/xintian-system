import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  ArrowLeft, Edit, FileText, User, Package, DollarSign, Truck,
  CreditCard, History, MessageSquare, PackageCheck, Calendar,
  Sprout, TreePine, AlertCircle,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { zh: string; en: string; variant: any }> = {
  pending: { zh: "挂单", en: "Pending", variant: "outline" },
  receipt_uploaded: { zh: "确认汇款", en: "Payment Confirmed", variant: "secondary" },
  partial_payment: { zh: "部分付款", en: "Partial Payment", variant: "secondary" },
  hold_order: { zh: "保留订单", en: "Hold Order", variant: "secondary" },
  packing: { zh: "待包货", en: "Packing", variant: "default" },
  shipped: { zh: "已发货", en: "Shipped", variant: "default" },
  partial_shipped: { zh: "部分发货", en: "Partial Shipped", variant: "secondary" },
  completed: { zh: "已完成", en: "Completed", variant: "default" },
  cancelled: { zh: "已取消", en: "Cancelled", variant: "destructive" },
  scheduled: { zh: "预约发货", en: "Scheduled", variant: "secondary" },
  special: { zh: "特别订单", en: "Special Order", variant: "secondary" },
};

const NATURE_LABELS: Record<string, { zh: string; en: string }> = {
  retail: { zh: "零售", en: "Retail" },
  wholesale: { zh: "批发", en: "Wholesale" },
  agent: { zh: "代理", en: "Agent" },
};

const SOURCE_LABELS: Record<string, { zh: string; en: string }> = {
  facebook_live: { zh: "FB直播", en: "FB Live" },
  facebook_post: { zh: "FB贴文", en: "FB Post" },
  facebook_reel: { zh: "FB Reel", en: "FB Reel" },
  messenger: { zh: "Messenger", en: "Messenger" },
  store: { zh: "商城", en: "Store" },
  manual: { zh: "Admin手动", en: "Admin Manual" },
};

const SHIPPING_LABELS: Record<string, { zh: string; en: string }> = {
  west_malaysia: { zh: "西马", en: "West Malaysia" },
  east_malaysia_poslaju: { zh: "东马 Pos Laju", en: "East Malaysia Pos Laju" },
  east_malaysia_shopee: { zh: "东马 Shopee", en: "East Malaysia Shopee" },
  lalamove: { zh: "Lalamove", en: "Lalamove" },
  self_pickup: { zh: "自取", en: "Self Pickup" },
};

export default function OrderBrowsePage({ orderId, onBack }: { orderId: number; onBack: () => void }) {
  const { translate, lang } = useI18n();
  const [_, setLocation] = useLocation();

  const { data: order, isLoading } = trpc.orders.getDetail.useQuery({ id: orderId });
  const { data: remarks } = trpc.orderRemarks.list.useQuery({ orderId });
  const { data: operationLogs } = trpc.orders.getOperationLogs.useQuery({ orderId });

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold">{translate("订单浏览", "Order Browse")}</h1>
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
  const statusCfg = STATUS_CONFIG[o.physicalStatus] || { zh: o.physicalStatus, en: o.physicalStatus, variant: "outline" };
  const natureCfg = NATURE_LABELS[o.orderNature] || { zh: o.orderNature, en: o.orderNature };
  const sourceCfg = SOURCE_LABELS[o.orderSource] || { zh: o.orderSource, en: o.orderSource };
  const shippingCfg = SHIPPING_LABELS[o.shippingMethod] || { zh: o.shippingMethod, en: o.shippingMethod };
  const orderTypeLabel = o.orderCategory === "import" ? translate("中国代购订单", "Import Order") : translate("本地订单", "Local Order");

  // Calculate amounts
  const physicalSubtotal = parseFloat(o.physicalSubtotal || "0");
  const membershipSubtotal = parseFloat(o.membershipSubtotal || "0");
  const itemsSubtotal = physicalSubtotal + membershipSubtotal;
  const promotionDiscount = parseFloat(o.promotionDiscount || "0");
  const extraCharge = parseFloat(o.extraCharge || "0");
  const creditUsed = parseFloat(o.creditUsed || "0");
  const shippingFee = parseFloat(o.shippingFee || "0");
  const totalAmount = parseFloat(o.totalAmount || "0");
  const paidAmount = parseFloat(o.paidAmount || "0");
  const balance = totalAmount - paidAmount;

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
              {translate("订单浏览", "Order Browse")}
              <span className="font-mono text-lg text-muted-foreground">#{o.orderNumber}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date(o.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusCfg.variant}>{translate(statusCfg.zh, statusCfg.en)}</Badge>
          <Button variant="outline" size="sm" onClick={() => setLocation(`/orders/${orderId}/edit`)}>
            <Edit className="h-3 w-3 mr-1" />{translate("编辑", "Edit")}
          </Button>
        </div>
      </div>

      {/* Section 1: Order Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {translate("1. 订单基本资料", "1. Order Basic Info")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-muted-foreground">{translate("订单编号", "Order Number")}:</span> <span className="font-mono font-medium">{o.orderNumber}</span></div>
          <div><span className="text-muted-foreground">{translate("订单类型", "Order Type")}:</span> {orderTypeLabel}</div>
          <div><span className="text-muted-foreground">{translate("订单性质", "Order Nature")}:</span> {translate(natureCfg.zh, natureCfg.en)}</div>
          <div><span className="text-muted-foreground">{translate("订单来源", "Order Source")}:</span> {translate(sourceCfg.zh, sourceCfg.en)}</div>
          <div><span className="text-muted-foreground">{translate("建立日期", "Created Date")}:</span> {new Date(o.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</div>
          <div><span className="text-muted-foreground">{translate("当前状态", "Current Status")}:</span> <Badge variant={statusCfg.variant} className="text-xs">{translate(statusCfg.zh, statusCfg.en)}</Badge></div>
          {o.sourceName && <div><span className="text-muted-foreground">{translate("来源名称", "Source Name")}:</span> {o.sourceName}</div>}
        </CardContent>
      </Card>

      {/* Section 2: Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            {translate("2. 客户资料", "2. Customer Info")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground">{translate("客户姓名", "Customer Name")}:</span> {o.facebookName || o.customerName || "-"}</div>
          <div><span className="text-muted-foreground">{translate("电话号码", "Phone")}:</span> {o.customerPhone || "-"}</div>
          <div><span className="text-muted-foreground">{translate("Facebook 名称", "FB Name")}:</span> {o.facebookName || "-"}</div>
          <div><span className="text-muted-foreground">{translate("Facebook ID", "FB ID")}:</span> {o.facebookId || "-"}</div>
          <div><span className="text-muted-foreground">{translate("Messenger ID", "Messenger ID")}:</span> {o.messengerId || "-"}</div>
          <div><span className="text-muted-foreground">{translate("客户Credit", "Customer Credit")}:</span> RM {parseFloat(o.creditBalance || "0").toFixed(2)}</div>
        </CardContent>
      </Card>

      {/* Section 3: Recipient & Shipping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            {translate("3. 收件人资料与配送方式", "3. Recipient & Shipping")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><span className="text-muted-foreground">{translate("收件人姓名", "Recipient Name")}:</span> {o.recipientName || o.facebookName || "-"}</div>
            <div><span className="text-muted-foreground">{translate("收件人电话", "Recipient Phone")}:</span> {o.recipientPhone || "-"}</div>
            <div><span className="text-muted-foreground">{translate("配送方式", "Shipping Method")}:</span> {translate(shippingCfg.zh, shippingCfg.en)}</div>
          </div>
          <div className="grid grid-cols-1 gap-1">
            <div><span className="text-muted-foreground">{translate("收件地址", "Shipping Address")}:</span> {o.shippingAddress || "-"}</div>
          </div>
          {(o.courierCompany || o.trackingNumber) && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
              <div><span className="text-muted-foreground">{translate("快递公司", "Courier Company")}:</span> {o.courierCompany || "-"}</div>
              <div><span className="text-muted-foreground">{translate("追踪号码/AWB", "Tracking/AWB")}:</span> {o.trackingNumber || "-"}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Order Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            {translate("4. 商品明细", "4. Order Items")}
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
                {(!o.items || o.items.length === 0) && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{translate("无商品", "No items")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Amount Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {translate("5. 金额详情", "5. Amount Details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span>{translate("商品小计", "Items Subtotal")}</span><span>RM {itemsSubtotal.toFixed(2)}</span></div>
          {promotionDiscount > 0 && (
            <div className="flex justify-between text-purple-600"><span>{translate("促销优惠", "Promotion Discount")}</span><span>-RM {promotionDiscount.toFixed(2)}</span></div>
          )}
          {extraCharge > 0 && (
            <div className="flex justify-between"><span>{translate("额外收费", "Extra Charge")}{o.extraChargeDescription && ` (${o.extraChargeDescription})`}</span><span>+RM {extraCharge.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between"><span>{translate("运费", "Shipping Fee")}</span><span>RM {shippingFee.toFixed(2)}</span></div>
          {creditUsed > 0 && (
            <div className="flex justify-between text-blue-600"><span>{translate("使用Credit", "Credit Used")}</span><span>-RM {creditUsed.toFixed(2)}</span></div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-base"><span>{translate("总金额", "Total Amount")}</span><span>RM {totalAmount.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>{translate("已付款", "Paid Amount")}</span><span>RM {paidAmount.toFixed(2)}</span></div>
          <Separator />
          {balance > 0 ? (
            <div className="flex justify-between text-orange-600 font-medium"><span>{translate("尚欠款", "Outstanding")}</span><span>RM {balance.toFixed(2)}</span></div>
          ) : balance < 0 ? (
            <div className="flex justify-between text-green-600 font-medium"><span>{translate("客户多付", "Customer Overpaid")}</span><span>RM {Math.abs(balance).toFixed(2)}</span></div>
          ) : (
            <div className="flex justify-between text-green-600 font-medium"><span>{translate("已付清", "Fully Paid")}</span><span>RM 0.00</span></div>
          )}
        </CardContent>
      </Card>

      {/* Section 6: Payment Records */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {translate("6. 付款记录", "6. Payment Records")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">{translate("日期", "Date")}</th>
                  <th className="text-right p-3 font-medium">{translate("金额", "Amount")}</th>
                  <th className="text-left p-3 font-medium">{translate("付款方式", "Method")}</th>
                  <th className="text-left p-3 font-medium">{translate("备注", "Notes")}</th>
                </tr>
              </thead>
              <tbody>
                {(o.payments || []).map((p: any, idx: number) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="p-3">{new Date(p.paymentDate || p.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</td>
                    <td className="p-3 text-right font-medium">RM {parseFloat(p.amount).toFixed(2)}</td>
                    <td className="p-3">{p.paymentMethodName || "-"}</td>
                    <td className="p-3 text-muted-foreground">{p.notes || "-"}</td>
                  </tr>
                ))}
                {(!o.payments || o.payments.length === 0) && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{translate("无付款记录", "No payment records")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 7: Remarks & Special Processing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {translate("7. 备注与特别处理", "7. Remarks & Special Processing")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(remarks || []).length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{translate("无备注", "No remarks")}</p>
          ) : (
            (remarks || []).map((r: any, idx: number) => (
              <div key={idx} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {r.remarkCategory === "scheduled_shipping" ? translate("预约发货", "Scheduled Shipping") :
                     r.remarkCategory === "repotting" ? translate("换盆", "Repotting") :
                     r.remarkCategory === "select_tree" ? translate("选树身", "Select Tree") :
                     r.remarkCategory === "customer_other" ? translate("客户其他备注", "Customer Other") :
                     r.remarkCategory === "internal_other" ? translate("内部其他备注", "Internal Other") :
                     translate("普通备注", "General Remark")}
                  </Badge>
                  {!r.isProcessed && <Badge variant="secondary" className="text-xs">{translate("待处理", "Pending")}</Badge>}
                </div>
                <p className="text-sm">{r.content}</p>
                {r.scheduledShippingDate && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {translate("预约日期", "Scheduled Date")}: {new Date(r.scheduledShippingDate).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Section 8: Logistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PackageCheck className="h-4 w-4" />
            {translate("8. 物流资料", "8. Logistics")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground">{translate("快递公司", "Courier Company")}:</span> {o.courierCompany || "-"}</div>
          <div><span className="text-muted-foreground">{translate("AWB/追踪号码", "AWB/Tracking")}:</span> {o.trackingNumber || "-"}</div>
          <div><span className="text-muted-foreground">{translate("Shipping Label", "Shipping Label")}:</span> {o.shippingLabelUrl ? <a href={o.shippingLabelUrl} target="_blank" className="text-blue-600 underline">{translate("查看", "View")}</a> : "-"}</div>
        </CardContent>
      </Card>

      {/* Section 9: Operation Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            {translate("9. 操作记录", "9. Operation Logs")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[300px]">
            <div className="p-3 space-y-2">
              {(operationLogs || []).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">{translate("无操作记录", "No operation logs")}</p>
              ) : (
                (operationLogs || []).map((log: any, idx: number) => (
                  <div key={idx} className="border-l-2 border-muted pl-3 py-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{log.action}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</span>
                    </div>
                    <p className="text-sm mt-1">{log.description}</p>
                    {log.operatorName && <p className="text-xs text-muted-foreground">{translate("操作人", "Operator")}: {log.operatorName}</p>}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 pt-4 pb-8">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />{translate("返回", "Back")}
        </Button>
        <Button onClick={() => setLocation(`/orders/${orderId}/edit`)}>
          <Edit className="h-4 w-4 mr-1" />{translate("编辑订单", "Edit Order")}
        </Button>
      </div>
    </div>
  );
}
