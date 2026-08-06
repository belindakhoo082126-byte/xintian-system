import { useState, useRef, useEffect } from "react";
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
  Sprout, TreePine, AlertCircle, Link2, Download, Printer, Eye,
  Copy, MessageCircle, Bell, Send,
} from "lucide-react";
import html2canvas from "html2canvas";
import { createRoot } from "react-dom/client";
import { OrderDocument } from "@/components/OrderDocument";
import { prepareOrderDocumentExportHost } from "@/lib/orderDocumentExport";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUS_CONFIG: Record<string, { zh: string; en: string; variant: any }> = {
  pending: { zh: "未汇款订单", en: "Unpaid Order", variant: "outline" },
  receipt_uploaded: { zh: "待审核付款凭证", en: "Pending Payment Verification", variant: "secondary" },
  partial_payment: { zh: "部分汇款", en: "Partial Payment", variant: "secondary" },
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
  const [exporting, setExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | undefined>(undefined);

  // Preload logo as dataURL for Preview — same asset as export/print
  useEffect(() => {
    if (!previewOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/manus-storage/FB_IMG_1779824864256(2)_dbe588b7.png");
        const blob = await resp.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (!cancelled) setPreviewLogoUrl(dataUrl);
      } catch (e) {
        console.warn("Preview logo fetch failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [previewOpen]);

  // V2.0.45: Logo URL for watermark
  const LOGO_URL = "/manus-storage/xintian-logo-transparent_58bbaf5e.png";

  // V2.0.74: Export order as PNG — robust cross-platform download
  async function handleExportImage() {
    setExporting(true);
    try {
      // Pre-convert logo to base64 dataURL so html2canvas doesn't hit CORS/taint issues
      let logoDataUrl: string | undefined;
      try {
        const logoResp = await fetch("/manus-storage/FB_IMG_1779824864256(2)_dbe588b7.png");
        const logoBlob = await logoResp.blob();
        logoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(logoBlob);
        });
      } catch (e) {
        console.warn("Logo fetch failed, will try direct URL", e);
      }

      // Create a standalone container outside the React tree
      const container = document.createElement("div");
      prepareOrderDocumentExportHost(container);
      document.body.appendChild(container);

      // Render OrderDocument into the container using React
      const root = createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(<OrderDocument order={o} remarks={remarks} variant="customer" logoDataUrl={logoDataUrl} />);
        setTimeout(resolve, 500);
      });

      // Wait for any images to load
      await new Promise(r => setTimeout(r, 300));

      const targetEl = container.firstChild as HTMLElement;
      if (!targetEl) throw new Error("Failed to render order document");

      const canvas = await html2canvas(targetEl, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: false,
        logging: false,
        imageTimeout: 0,
      });

      // Convert to blob for more reliable download (especially on mobile)
      const dataUrl = canvas.toDataURL("image/png");
      const blob = await (await fetch(dataUrl)).blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.download = `order_${o.orderNumber}.png`;
      link.href = blobUrl;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        root.unmount();
        document.body.removeChild(container);
      }, 100);

      toast.success(translate("图片已下载", "Image downloaded"));
    } catch (e: any) {
      console.error("Export image error:", e);
      toast.error(translate("导出失败: {message}", "Export failed: {message}", { message: e.message }));
      setExporting(false);
    }
  }

  // V2.0.73: Print order — open new window with only OrderDocument content
  async function handlePrint() {
    // Pre-convert logo to base64 dataURL
    let logoDataUrl: string | undefined;
    try {
      const logoResp = await fetch("/manus-storage/FB_IMG_1779824864256(2)_dbe588b7.png");
      const logoBlob = await logoResp.blob();
      logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(logoBlob);
      });
    } catch (e) {
      console.warn("Logo fetch failed for print", e);
    }

    const container = document.createElement("div");
    prepareOrderDocumentExportHost(container);
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(<OrderDocument order={o} remarks={remarks} variant="customer" logoDataUrl={logoDataUrl} />);

    setTimeout(() => {
      const targetEl = container.firstChild as HTMLElement;
      if (!targetEl) return;

      const printWindow = window.open("", "_blank", "width=900,height=700");
      if (!printWindow) {
        toast.error(translate("无法打开打印窗口，请检查弹窗拦截设置", "Cannot open print window. Please check popup blocker settings."));
        root.unmount();
        document.body.removeChild(container);
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>心田 Xin Tian - ${o.orderNumber}</title>
          <style>
            @page { margin: 1cm; }
            body { margin: 0; padding: 0; font-family: 'Noto Sans SC', 'Segoe UI', Arial, sans-serif; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          </style>
        </head>
        <body>${targetEl.outerHTML}</body>
        </html>
      `);
      printWindow.document.close();

      // Wait for images to load in print window
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);

      // Cleanup React container
      root.unmount();
      document.body.removeChild(container);
    }, 300);
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
        <div className="flex items-center gap-2 no-print">
          <Badge variant={statusCfg.variant}>{translate(statusCfg.zh, statusCfg.en)}</Badge>
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-3 w-3 mr-1" />{translate("Preview 单据", "Preview Document")}
          </Button>
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
          {o.checkoutLink && o.messengerId && (
            <Button variant="outline" size="sm" onClick={() => {
              const fullLink = `https://xintian.com.my${o.checkoutLink}`;
              const template =
                "您好，目前还没收到您的汇款及确认信息\n\n请您点击以下链接查询您的订单（{orderNumber}）\n\n进入订单里除了可以查询订单也可以进行在商城加单❤️\n\n西马消费🈵150不含特价10kg内即可享受免邮了\n\n{link}";
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
          <div><span className="text-muted-foreground">{translate("客户姓名", "Customer Name")}:</span> {o.customerName || o.facebookName || "-"}</div>
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
            <div><span className="text-muted-foreground">{translate("收件人姓名", "Recipient Name")}:</span> {o.recipientName || "-"}</div>
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
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Payment records list */}
          <div className="space-y-2">
            {(o.payments || []).length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-6 border rounded-lg">
                {translate("暂无付款记录", "No payment records")}
              </div>
            ) : (
              o.payments.map((p: any, idx: number) => {
                const files: string[] = p.receiptFiles
                  ? (typeof p.receiptFiles === "string" ? JSON.parse(p.receiptFiles) : p.receiptFiles)
                  : (p.receiptUrl ? [p.receiptUrl] : []);
                return (
                  <div key={idx} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{translate("付款", "Payment")} {idx + 1}</Badge>
                        <span className="font-medium">RM {parseFloat(p.amount).toFixed(2)}</span>
                        <span className="text-muted-foreground text-xs">· {p.paymentMethodName || p.paymentMethod || "-"}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.paymentDate || p.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}
                      </span>
                      {p.purpose && <span>· {p.purpose}</span>}
                      {p.notes && <span>· {p.notes}</span>}
                    </div>
                    {files.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {files.map((url: string, fi: number) => (
                          <a key={fi} href={url} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 dark:bg-blue-950/20 rounded px-2 py-1">
                            <FileText className="h-3 w-3" />
                            {translate("单据", "Receipt")} {fi + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Summary */}
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{translate("订单总金额", "Total Amount")}</span>
              <span className="font-medium">RM {totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{translate("已付款", "Paid")}</span>
              <span className="font-medium text-green-600">RM {paidAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{translate("未付款", "Outstanding")}</span>
              <span className={`font-medium ${balance > 0 ? "text-orange-600" : "text-green-600"}`}>
                RM {Math.max(0, balance).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t">
              <span className="text-muted-foreground">{translate("订单状态", "Order Status")}</span>
              <Badge variant={statusCfg.variant} className="text-xs">{translate(statusCfg.zh, statusCfg.en)}</Badge>
            </div>
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

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 pt-4 pb-8 no-print">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />{translate("返回", "Back")}
        </Button>
        <Button onClick={() => setLocation(`/orders/${orderId}/edit`)}>
          <Edit className="h-4 w-4 mr-1" />{translate("编辑订单", "Edit Order")}
        </Button>
      </div>

      {/* Preview Document Dialog — same OrderDocument template as export/print */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-4 pb-2 sticky top-0 bg-white z-10 border-b">
            <DialogTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {translate("Preview 单据", "Preview Document")} — {o.orderNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 py-2">
            <OrderDocument order={o} remarks={remarks} variant="customer" logoDataUrl={previewLogoUrl} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
