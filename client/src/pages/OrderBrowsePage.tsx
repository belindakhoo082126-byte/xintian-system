import { useState, useRef } from "react";
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
  Sprout, TreePine, AlertCircle, Link2, Download, Printer,
  Copy, MessageCircle, Bell, Send, Plus, Upload, Loader2, Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import html2canvas from "html2canvas";

const STATUS_CONFIG: Record<string, { zh: string; en: string; variant: any }> = {
  pending: { zh: "未汇款订单", en: "Unpaid Order", variant: "outline" },
  receipt_uploaded: { zh: "待审核付款凭证", en: "Pending Payment Verification", variant: "secondary" },
  hold_order: { zh: "保留订单", en: "Hold Order", variant: "secondary" },
  packing: { zh: "待包货", en: "Pending Packing", variant: "default" },
  partial_shipped: { zh: "部分发货", en: "Partial Shipped", variant: "secondary" },
  shipped: { zh: "已发货", en: "Shipped", variant: "default" },
  completed: { zh: "已完成", en: "Completed", variant: "default" },
  cancelled: { zh: "已取消", en: "Cancelled", variant: "destructive" },
  scheduled: { zh: "预约发货", en: "Scheduled Shipping", variant: "secondary" },
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
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentMethodName: "", receiptUrl: "", notes: "" });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptFileRef = useRef<HTMLInputElement>(null);

  // V2.0.45: Logo URL for watermark
  const LOGO_URL = "/manus-storage/xintian-logo-transparent_58bbaf5e.png";

  // V2.0.44: Export order as image with logo and watermark
  async function handleExportImage() {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      // First capture the order content
      const contentCanvas = await html2canvas(exportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      // Create a new canvas with extra space for header (logo) and footer (watermark)
      const logoHeight = 100;
      const watermarkHeight = 50;
      const padding = 30;
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = contentCanvas.width + padding * 2;
      finalCanvas.height = contentCanvas.height + logoHeight + watermarkHeight + padding * 2;
      const ctx = finalCanvas.getContext("2d")!;

      // Fill white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      // Load logo image
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        logoImg.src = LOGO_URL;
      });

      // Draw logo at top-left, sized to fit logoHeight
      const logoSize = logoHeight;
      ctx.drawImage(logoImg, padding, padding, logoSize, logoSize);

      // Draw brand name next to logo
      ctx.fillStyle = "#1E3F20";
      ctx.font = "bold 28px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("\u5fc3\u7530 Xin Tian", padding + logoSize + 20, padding + logoHeight / 2);

      // Draw order number next to brand
      ctx.fillStyle = "#666666";
      ctx.font = "18px sans-serif";
      ctx.fillText(`#${o.orderNumber}`, padding + logoSize + 20 + 200, padding + logoHeight / 2);

      // Draw content canvas below header
      ctx.drawImage(contentCanvas, padding, padding + logoHeight + 10);

      // Draw watermark at bottom
      const watermarkY = finalCanvas.height - watermarkHeight / 2 - 10;
      ctx.fillStyle = "rgba(30, 63, 32, 0.15)";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("\u5fc3\u7530 Xin Tian \u00b7 \u878d\u5408\u690d\u7269\u3001\u8349\u672cDIY\u3001\u60c5\u7eea\u7597\u6108\u4e0e\u624b\u4f5c\u521b\u4f5c\u7684\u5171\u521b\u5e73\u53f0", finalCanvas.width / 2, watermarkY);
      ctx.textAlign = "left";

      const link = document.createElement("a");
      link.download = `order_${o.orderNumber}.png`;
      link.href = finalCanvas.toDataURL("image/png");
      link.click();
      toast.success(translate("\u56fe\u7247\u5df2\u4e0b\u8f7d", "Image downloaded"));
    } catch (e: any) {
      toast.error(translate("\u5bfc\u51fa\u5931\u8d25: {message}", "Export failed: {message}", { message: e.message }));
    } finally {
      setExporting(false);
    }
  }

  // V2.0.44: Print order
  function handlePrint() {
    window.print();
  }

  const { data: order, isLoading, error: orderError } = trpc.orders.getDetail.useQuery({ id: orderId });
  const { data: remarks } = trpc.orderRemarks.list.useQuery({ orderId });
  const { data: operationLogs } = trpc.orders.getOperationLogs.useQuery({ orderId });
  const utils = trpc.useUtils();
  const sendCheckoutMutation = trpc.orders.sendCheckout.useMutation({
    onSuccess: () => {
      toast.success(translate("结单通知已发送到 Messenger", "Checkout notification sent to Messenger"));
      utils.orders.getDetail.invalidate({ id: orderId });
    },
    onError: (e: any) => toast.error(translate("发送失败: {message}", "Send failed: {message}", { message: e.message })),
  });
  const addPaymentMutation = trpc.orders.addPayment.useMutation({
    onSuccess: () => {
      utils.orders.getDetail.invalidate({ id: orderId });
      toast.success(translate("付款记录已添加", "Payment record added"));
      setPaymentDialogOpen(false);
      setPaymentForm({ amount: "", paymentMethodName: "", receiptUrl: "", notes: "" });
    },
    onError: (e: any) => toast.error(translate("添加付款失败: {message}", "Payment failed: {message}", { message: e.message })),
  });
  async function handleUploadReceipt(file: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(translate("文件大小不能超过 10MB", "File size cannot exceed 10MB"));
      return;
    }
    setUploadingReceipt(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: base64, filename: file.name, contentType: file.type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      setPaymentForm(prev => ({ ...prev, receiptUrl: data.url }));
      toast.success(translate("单据已上传", "Receipt uploaded"));
    } catch (e: any) {
      toast.error(translate("上传失败: {message}", "Upload failed: {message}", { message: e.message }));
    } finally {
      setUploadingReceipt(false);
    }
  }
  function handleAddPayment() {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error(translate("请输入有效金额", "Please enter a valid amount"));
      return;
    }
    addPaymentMutation.mutate({
      orderId,
      amount: paymentForm.amount,
      paymentMethod: paymentForm.paymentMethodName || undefined,
      receiptUrl: paymentForm.receiptUrl || undefined,
      notes: paymentForm.notes || undefined,
    });
  }

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

  if (!order || orderError) {
    return (
      <div className="container max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold">{translate("订单未找到", "Order Not Found")}</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">
                {orderError?.message
                  ? translate(`错误: ${orderError.message}`, `Error: ${orderError.message}`)
                  : translate("无法加载订单数据，请检查订单ID是否正确。", "Unable to load order data. Please check if the order ID is correct.")}
              </span>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              {translate("订单ID", "Order ID")}: {orderId}
            </div>
          </CardContent>
        </Card>
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
  const discountAmount = parseFloat(o.discountAmount || "0");

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
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
        <div className="flex items-center gap-2">
          <Badge variant={statusCfg.variant}>{translate(statusCfg.zh, statusCfg.en)}</Badge>
          <Button variant="outline" size="sm" onClick={handleExportImage} disabled={exporting}>
            <Download className="h-3 w-3 mr-1" />{exporting ? translate("导出中...", "Exporting...") : translate("导出图片", "Export Image")}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-3 w-3 mr-1" />{translate("打印", "Print")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLocation(`/orders/${orderId}/edit`)}>
            <Edit className="h-3 w-3 mr-1" />{translate("编辑", "Edit")}
          </Button>
          {o.secureToken && (
            <Button variant="outline" size="sm" onClick={() => {
              const url = `${window.location.origin}/order/${o.orderNumber}/${o.secureToken}`;
              navigator.clipboard.writeText(url);
              toast.success(translate("客户订单链接已复制", "Customer order link copied"));
            }}>
              <Link2 className="h-3 w-3 mr-1" />{translate("复制订单链接", "Copy Order Link")}
            </Button>
          )}
          {o.checkoutLink && (
            <Button variant="outline" size="sm" onClick={() => {
              const fullLink = `https://xintian.com.my${o.checkoutLink}`;
              navigator.clipboard.writeText(fullLink);
              toast.success(translate("结单链接已复制", "Checkout link copied"), { description: fullLink, duration: 5000 });
            }}>
              <Copy className="h-3 w-3 mr-1" />{translate("复制结单链接", "Copy Checkout Link")}
            </Button>
          )}
          {o.checkoutLink && o.messengerId && (
            <Button variant="outline" size="sm" onClick={() => {
              const fullLink = `https://xintian.com.my${o.checkoutLink}`;
              const template =
                "您好，目前还没收到您的汇款及确认信息\n\n请您点击以下链接或直接点击按钮（查询/结账订单）查询您的订单（{orderNumber}）\n\n进入订单里除了可以查询订单也可以进行在商城加单❤️\n\n西马消费🈵150不含特价10kg内即可享受免邮了\n\n{link}";
              const msg = template.replace(/\{link\}/g, fullLink).replace(/\{orderNumber\}/g, o.orderNumber || "");
              sendCheckoutMutation.mutate({ orderId: orderId, customMessage: msg });
            }} disabled={sendCheckoutMutation.isPending}>
              <Send className="h-3 w-3 mr-1" />{translate("发送结单通知", "Send Checkout Notification")}
            </Button>
          )}
        </div>
      </div>

      {/* Notification Status Banner */}
      {o.notificationStatus && (
        <div className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm no-print ${
          o.notificationStatus === "sent" ? "bg-green-50 text-green-700 border border-green-200" :
          o.notificationStatus === "failed" ? "bg-red-50 text-red-700 border border-red-200" :
          "bg-muted text-muted-foreground"
        }`}>
          <Bell className="h-4 w-4 flex-shrink-0" />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {o.notificationStatus === "sent" ? translate("✅ 通知已发送", "✅ Notification Sent") :
                 o.notificationStatus === "failed" ? translate("❌ 通知发送失败", "❌ Notification Failed") :
                 translate("⏳ 待发送", "⏳ Pending")}
              </span>
              {o.notificationSentAt && (
                <span className="text-xs opacity-80">
                  {new Date(o.notificationSentAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}
                </span>
              )}
            </div>
            {o.notificationStatus === "failed" && o.notificationError && (
              <span className="text-xs opacity-80">{translate("失败原因", "Error")}: {o.notificationError}</span>
            )}
          </div>
        </div>
      )}

      {/* Export/Print content wrapper */}
      <div ref={exportRef} className="space-y-4">

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
                  <th className="text-left p-3 font-medium w-20">{translate("图片", "Image")}</th>
                  <th className="text-left p-3 font-medium">{translate("商品名称", "Product Name")}</th>
                  <th className="text-left p-3 font-medium">{translate("SKU", "SKU")}</th>
                  <th className="text-left p-3 font-medium">{translate("关键词", "Keyword")}</th>
                  <th className="text-left p-3 font-medium">{translate("规格", "Variation")}</th>
                  <th className="text-right p-3 font-medium">{translate("数量", "Qty")}</th>
                  <th className="text-right p-3 font-medium">{translate("单价", "Unit Price")}</th>
                  <th className="text-right p-3 font-medium">{translate("小计", "Subtotal")}</th>
                </tr>
              </thead>
              <tbody>
                {(o.items || []).map((item: any, idx: number) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="p-3">
                      {item.productImage ? (
                        <img src={item.productImage} alt={item.productName} className="w-16 h-16 rounded object-cover" />
                      ) : (
                        <div className="w-16 h-16 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">{translate("无图", "No img")}</div>
                      )}
                    </td>
                    <td className="p-3 font-medium">{item.productName}</td>
                    <td className="p-3 text-muted-foreground">{item.productSku || "-"}</td>
                    <td className="p-3 text-muted-foreground">{item.facebookKeyword || "-"}</td>
                    <td className="p-3 text-muted-foreground">{item.variationName || "-"}</td>
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-right">RM {parseFloat(item.unitPrice).toFixed(2)}</td>
                    <td className="p-3 text-right font-medium">RM {parseFloat(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
                {(!o.items || o.items.length === 0) && (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{translate("无商品", "No items")}</td></tr>
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
          {discountAmount > 0 && (
            <div className="flex justify-between text-red-600"><span>{translate("人工折扣", "Manual Discount")}{o.discountReason && ` (${o.discountReason})`}</span><span>-RM {discountAmount.toFixed(2)}</span></div>
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
          <div className="flex justify-between"><span>{translate("已付", "Paid Amount")}</span><span>RM {paidAmount.toFixed(2)}</span></div>
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
            <Button variant="outline" size="sm" className="ml-auto no-print" onClick={() => setPaymentDialogOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />{translate("新增付款", "Add Payment")}
            </Button>
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
                  <th className="text-left p-3 font-medium">{translate("付款凭证", "Receipt")}</th>
                  <th className="text-left p-3 font-medium">{translate("备注", "Notes")}</th>
                </tr>
              </thead>
              <tbody>
                {(o.payments || []).map((p: any, idx: number) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="p-3">{new Date(p.paymentDate || p.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</td>
                    <td className="p-3 text-right font-medium">RM {parseFloat(p.amount).toFixed(2)}</td>
                    <td className="p-3">{p.paymentMethodName || "-"}</td>
                    <td className="p-3">{p.receiptUrl ? <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{translate("查看", "View")}</a> : "-"}</td>
                    <td className="p-3 text-muted-foreground">{p.notes || "-"}</td>
                  </tr>
                ))}
                {(!o.payments || o.payments.length === 0) && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{translate("无付款记录", "No payment records")}</td></tr>
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
                    {r.remarkCategory === "repotting" ? translate("换盆", "Repotting") :
                     r.remarkCategory === "desired_delivery_date" ? translate("希望收货日期", "Desired Delivery Date") :
                     translate("其他", "Other")}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{new Date(r.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</span>
                </div>
                {r.remarkCategory === "desired_delivery_date" ? (
                  <p className="text-sm text-muted-foreground">
                    {r.desiredDeliveryDate ? new Date(r.desiredDeliveryDate).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US") : ""}
                    {r.desiredDeliveryReason && <span className="ml-2">— {r.desiredDeliveryReason}</span>}
                  </p>
                ) : r.remarkCategory === "repotting" && r.repottingData ? (
                  <div className="space-y-1">
                    <p className="text-sm">{r.content}</p>
                    {(() => {
                      try {
                        const entries = JSON.parse(r.repottingData);
                        return entries.map((e: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-green-50 dark:bg-green-950/20 rounded px-2 py-1">
                            <Sprout className="h-3 w-3 text-green-600" />
                            <span className="font-medium">{e.plantName}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">{e.potName}</span>
                            <span className="text-muted-foreground">x{e.quantity}</span>
                          </div>
                        ));
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                ) : (
                  <p className="text-sm">{r.content}</p>
                )}
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

      </div>

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 pt-4 pb-8 no-print">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />{translate("返回", "Back")}
        </Button>
        <Button onClick={() => setLocation(`/orders/${orderId}/edit`)}>
          <Edit className="h-4 w-4 mr-1" />{translate("编辑订单", "Edit Order")}
        </Button>
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("新增付款记录", "Add Payment Record")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("金额 (RM)", "Amount (RM)")}</Label>
              <Input type="number" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>{translate("付款方式", "Payment Method")}</Label>
              <Input value={paymentForm.paymentMethodName} onChange={e => setPaymentForm(prev => ({ ...prev, paymentMethodName: e.target.value }))} placeholder={translate("例如: QR Pay (Tng/Duit Now)", "e.g. QR Pay (Tng/Duit Now)")} />
            </div>
            <div>
              <Label>{translate("上传付款单据", "Upload Receipt")}</Label>
              <input ref={receiptFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadReceipt(f); e.target.value = ""; }} />
              <Button variant="outline" size="sm" onClick={() => receiptFileRef.current?.click()} disabled={uploadingReceipt} className="w-full">
                {uploadingReceipt ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />{translate("上传中...", "Uploading...")}</> : <><Upload className="h-3 w-3 mr-1" />{translate("选择文件", "Choose File")}</>}
              </Button>
              {paymentForm.receiptUrl && (
                <p className="text-xs text-green-600 mt-1">{translate("✓ 单据已上传", "✓ Receipt uploaded")}</p>
              )}
            </div>
            <div>
              <Label>{translate("备注", "Notes")}</Label>
              <Textarea value={paymentForm.notes} onChange={e => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={handleAddPayment} disabled={addPaymentMutation.isPending}>
              {addPaymentMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              {translate("保存", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
