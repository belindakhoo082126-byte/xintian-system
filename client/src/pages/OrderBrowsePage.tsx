import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ITEM_SOURCE_LABELS } from "@shared/const";
import {
  ArrowLeft, Edit, FileText, User, Package, DollarSign, Truck,
  CreditCard, History, MessageSquare, PackageCheck, Calendar,
  Sprout, TreePine, AlertCircle, Download, Printer, Eye,
  Copy, MessageCircle, Bell, Send, Plus, Upload, Loader2, Trash2,
  CheckCircle, Pencil, X, GitFork, GitMerge,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import html2canvas from "html2canvas";
import { createRoot } from "react-dom/client";
import { OrderDocument } from "@/components/OrderDocument";
import { prepareOrderDocumentExportHost } from "@/lib/orderDocumentExport";
import { ProductImagePreview } from "@/components/ProductImagePreview";

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
  special: { zh: "特别订单", en: "Special Order", variant: "secondary" },
};

// V2.0.99: XTC Import order status config (final unified version)
const IMPORT_STATUS_CONFIG: Record<string, { zh: string; en: string; variant: any }> = {
  pending: { zh: "挂单", en: "Pending", variant: "outline" },
  receipt_uploaded: { zh: "待审核付款凭证", en: "Pending Verification", variant: "secondary" },
  partial_payment: { zh: "部分汇款", en: "Partial Payment", variant: "secondary" },
  waiting_stock: { zh: "待备货", en: "Waiting Stock", variant: "secondary" },
  ready_to_ship: { zh: "待发货", en: "Ready to Ship", variant: "default" },
  scheduled_ship: { zh: "预约发货", en: "Scheduled Ship", variant: "secondary" },
  partial_shipped: { zh: "部分发货", en: "Partial Shipped", variant: "secondary" },
  shipped: { zh: "已发货", en: "Shipped", variant: "default" },
  completed: { zh: "已完成", en: "Completed", variant: "default" },
  cancelled: { zh: "取消", en: "Cancelled", variant: "destructive" },
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | undefined>(undefined);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentMethodName: "", receiptUrl: "", notes: "" });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptFileRef = useRef<HTMLInputElement>(null);
  // V2.1.26补充5: Payment review/edit/reject state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectPaymentId, setRejectPaymentId] = useState<number | null>(null);
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState<number | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({ amount: "", paymentMethod: "", receiptUrl: "", notes: "" });
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitQuantities, setSplitQuantities] = useState<Record<number, number>>({});
  const [newOrderAllocatedPayment, setNewOrderAllocatedPayment] = useState("0");
  const [newOrderAllocatedCredit, setNewOrderAllocatedCredit] = useState("0");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeCreditDisposition, setMergeCreditDisposition] = useState<"carry_forward" | "return_to_source">("carry_forward");

  // Preload logo as dataURL for Preview — same asset as export/print
  useEffect(() => {
    if (!previewOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const logoResp = await fetch("/manus-storage/FB_IMG_1779824864256(2)_dbe588b7.png");
        const logoBlob = await logoResp.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(logoBlob);
        });
        if (!cancelled) setPreviewLogoUrl(dataUrl);
      } catch (e) {
        console.warn("Preview logo fetch failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [previewOpen]);

  // V2.0.74: Export order as PNG — renders OrderDocument off-screen, captures with html2canvas
  async function handleExportImage() {
    if (!order) return;
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
      // Pre-convert product images to base64 dataURLs to avoid CORS issues with html2canvas
      // (XTC orders may use external URLs like unsplash.com which cause CORS taint)
      const productImageOverrides: Record<string, string> = {};
      const items = (o as any).items || [];
      for (const item of items) {
        if (item.productImage && !productImageOverrides[item.productImage]) {
          try {
            const imgResp = await fetch(item.productImage, { mode: "cors" });
            if (imgResp.ok) {
              const imgBlob = await imgResp.blob();
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(imgBlob);
              });
              productImageOverrides[item.productImage] = dataUrl;
            }
          } catch (e) {
            console.warn(`Product image fetch failed for ${item.productImage}`, e);
          }
        }
      }
      // Create a standalone container outside the React tree
      const container = document.createElement("div");
      prepareOrderDocumentExportHost(container);
      document.body.appendChild(container);
      // Render OrderDocument into the container using React
      const root = createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(<OrderDocument order={o} remarks={remarks} variant="customer" logoDataUrl={logoDataUrl} productImageOverrides={productImageOverrides} showProductImage={true} />);
        setTimeout(resolve, 500);
      });
      // Wait for any images to load (including product images)
      await new Promise(r => setTimeout(r, 1000));
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
        onclone: (doc: Document) => {
          // Fix: html2canvas 1.4.1 doesn't support oklch() color function.
          const html = doc.documentElement;
          const body = doc.body;
          if (html) html.style.backgroundColor = "#ffffff";
          if (body) body.style.backgroundColor = "#ffffff";
          const allEls = doc.querySelectorAll("*");
          allEls.forEach((el) => {
            const cs = doc.defaultView?.getComputedStyle(el);
            if (cs) {
              const bg = cs.backgroundColor;
              const color = cs.color;
              const bdc = cs.borderColor;
              if (bg && bg.includes("oklch")) (el as HTMLElement).style.backgroundColor = "#ffffff";
              if (color && color.includes("oklch")) (el as HTMLElement).style.color = "#1a1a1a";
              if (bdc && bdc.includes("oklch")) (el as HTMLElement).style.borderColor = "#e0e0e0";
            }
          });
        },
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
    } finally {
      setExporting(false);
    }
  }

  // V2.0.73: Print order — open new window with only OrderDocument content
  async function handlePrint() {
    if (!order) return;
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
    // Pre-convert product images to base64 dataURLs to avoid CORS issues
    const productImageOverrides: Record<string, string> = {};
    const items = (o as any).items || [];
    for (const item of items) {
      if (item.productImage && !productImageOverrides[item.productImage]) {
        try {
          const imgResp = await fetch(item.productImage, { mode: "cors" });
          if (imgResp.ok) {
            const imgBlob = await imgResp.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(imgBlob);
            });
            productImageOverrides[item.productImage] = dataUrl;
          }
        } catch (e) {
          console.warn(`Product image fetch failed for print: ${item.productImage}`, e);
        }
      }
    }
    const container = document.createElement("div");
    prepareOrderDocumentExportHost(container);
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(<OrderDocument order={o} remarks={remarks} variant="customer" logoDataUrl={logoDataUrl} productImageOverrides={productImageOverrides} showProductImage={false} />);
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
  const { data: mergeCandidates = [], isLoading: isLoadingMergeCandidates } = trpc.orders.mergeCandidates.useQuery(
    { sourceOrderId: orderId },
    { enabled: mergeOpen },
  );
  const utils = trpc.useUtils();
  const splitOrderMutation = trpc.orders.split.useMutation({
    onSuccess: (result) => {
      toast.success(translate("订单已拆分，已建立 {orderNumber}", "Order split. {orderNumber} created", { orderNumber: result.newOrderNumber }));
      setSplitOpen(false);
      setSplitQuantities({});
      setNewOrderAllocatedPayment("0");
      setNewOrderAllocatedCredit("0");
      utils.orders.getDetail.invalidate({ id: orderId });
      utils.orders.list.invalidate();
    },
    onError: (error: any) => toast.error(translate("拆单失败: {message}", "Split failed: {message}", { message: error.message })),
  });
  const mergeOrderMutation = trpc.orders.merge.useMutation({
    onSuccess: (result) => {
      toast.success(translate("订单已合并至 {orderNumber}", "Order merged into {orderNumber}", { orderNumber: result.targetOrderNumber }));
      setMergeOpen(false);
      setMergeTargetId("");
      setMergeCreditDisposition("carry_forward");
      utils.orders.getDetail.invalidate({ id: orderId });
      utils.orders.list.invalidate();
    },
    onError: (error: any) => toast.error(translate("合单失败: {message}", "Merge failed: {message}", { message: error.message })),
  });
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
  // V2.1.26补充5: Review payment mutation
  const reviewPaymentMutation = trpc.orders.reviewPayment.useMutation({
    onSuccess: () => {
      utils.orders.getDetail.invalidate({ id: orderId });
      toast.success(translate("付款审核已更新", "Payment review updated"));
      setRejectDialogOpen(false);
      setRejectReason("");
      setRejectPaymentId(null);
    },
    onError: (e: any) => toast.error(translate("审核失败: {message}", "Review failed: {message}", { message: e.message })),
  });
  // V2.1.26补充5: Edit payment mutation
  const editPaymentMutation = trpc.orders.editPayment.useMutation({
    onSuccess: () => {
      utils.orders.getDetail.invalidate({ id: orderId });
      toast.success(translate("付款记录已更新", "Payment record updated"));
      setEditPaymentDialogOpen(false);
      setEditPaymentId(null);
    },
    onError: (e: any) => toast.error(translate("更新失败: {message}", "Update failed: {message}", { message: e.message })),
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
  const isImportOrder = o.orderCategory === "import";
  const statusCfg = isImportOrder
    ? (IMPORT_STATUS_CONFIG[o.importStatus] || { zh: o.importStatus, en: o.importStatus, variant: "outline" })
    : (STATUS_CONFIG[o.physicalStatus] || { zh: o.physicalStatus, en: o.physicalStatus, variant: "outline" });
  const natureCfg = NATURE_LABELS[o.orderNature] || { zh: o.orderNature, en: o.orderNature };
  const sourceCfg = SOURCE_LABELS[o.orderSource] || { zh: o.orderSource, en: o.orderSource };
  const shippingCfg = SHIPPING_LABELS[o.shippingMethod] || { zh: o.shippingMethod, en: o.shippingMethod };
  const orderTypeLabel = o.orderCategory === "import" ? translate("中国代购订单", "Import Order") : translate("本地订单", "Local Order");
  const processedRefunds = ((o.refunds || []) as any[]).filter((refund) => refund.status === "processed" || refund.status === "awaiting_return");

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
  const detailItems = (o.items || []) as any[];
  const canSplitOrder = !isImportOrder && o.orderType === "physical" && ["pending", "receipt_uploaded", "partial_payment", "hold_order"].includes(o.physicalStatus || "")
    && discountAmount === 0 && promotionDiscount === 0 && extraCharge === 0 && detailItems.length > 1;
  const canMergeOrder = !isImportOrder && o.orderType === "physical" && ["pending", "hold_order"].includes(o.physicalStatus || "")
    && paidAmount === 0 && creditUsed === 0 && discountAmount === 0 && promotionDiscount === 0 && extraCharge === 0 && !o.receiptUrl;
  const selectedSplitItems = detailItems
    .filter((item) => Number(splitQuantities[item.id] || 0) > 0)
    .map((item) => ({ orderItemId: item.id, quantity: Number(splitQuantities[item.id]) }));
  const leavesItemsOnOriginalOrder = detailItems.some((item) => Number(splitQuantities[item.id] || 0) < Number(item.quantity));
  const allocatedSplitPayment = Math.max(0, Number(newOrderAllocatedPayment || 0));
  const allocatedSplitCredit = Math.max(0, Number(newOrderAllocatedCredit || 0));
  const retainedSplitPayment = Math.max(0, paidAmount - allocatedSplitPayment);
  const retainedSplitCredit = Math.max(0, creditUsed - allocatedSplitCredit);
  const isSplitPaymentAllocationValid = Number.isFinite(allocatedSplitPayment) && allocatedSplitPayment <= paidAmount;
  const isSplitCreditAllocationValid = Number.isFinite(allocatedSplitCredit) && allocatedSplitCredit <= creditUsed;

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
          {processedRefunds.length > 0 && (
            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border border-rose-200">
              {translate("部分退款", "Partially Refunded")} · {processedRefunds.map((refund) => refund.refundNumber).filter(Boolean).join("、")}
            </Badge>
          )}
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
          {canSplitOrder && (
            <Button variant="outline" size="sm" onClick={() => {
              setNewOrderAllocatedPayment("0");
              setNewOrderAllocatedCredit("0");
              setSplitOpen(true);
            }}>
              <GitFork className="h-3 w-3 mr-1" />{translate("拆分订单", "Split Order")}
            </Button>
          )}
          {canMergeOrder && (
            <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
              <GitMerge className="h-3 w-3 mr-1" />{translate("合并订单", "Merge Order")}
            </Button>
          )}
          {o.checkoutLink && (
            <Button variant="outline" size="sm" onClick={() => {
              const fullLink = `${window.location.origin}${o.checkoutLink}`;
              const msg = `您好，感恩您的支持 ❤️\n\n目前还没收到您的汇款及确认信息。\n\n请您点击以下链接查询您的订单（${o.orderNumber || ""}）：\n\n${fullLink}\n\n进入订单后，除了可以查询订单，也可以继续到商城加单 ❤️\n\n西马消费满 RM150（特价商品除外），10kg 内即可享受免邮优惠。`;
              navigator.clipboard.writeText(msg);
              toast.success(translate("结单链接已复制", "Checkout link copied"), { description: fullLink, duration: 5000 });
            }}>
              <Copy className="h-3 w-3 mr-1" />{translate("复制结单链接", "Copy Checkout Link")}
            </Button>
          )}
          {o.checkoutLink && o.messengerId && (
            <Button variant="outline" size="sm" onClick={() => {
              const fullLink = `${window.location.origin}${o.checkoutLink}`;
              const template =
                "您好，感恩您的支持 ❤️\n\n目前还没收到您的汇款及确认信息。\n\n请您点击以下链接查询您的订单（{orderNumber}）：\n\n{link}\n\n进入订单后，除了可以查询订单，也可以继续到商城加单 ❤️\n\n西马消费满 RM150（特价商品除外），10kg 内即可享受免邮优惠。";
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
          {processedRefunds.length > 0 && (
            <>
              <div className="md:col-span-2"><span className="text-muted-foreground">{translate("已处理退款", "Processed Refunds")}:</span> <span className="font-medium text-rose-700">{processedRefunds.map((refund) => `${refund.refundNumber || `RF-${refund.id}`}（RM${Number(refund.amount || refund.requestedAmount || 0).toFixed(2)}）`).join("、")}</span></div>
              <div><span className="text-muted-foreground">{translate("售后退款损失", "After-sales refund loss")}:</span> <span className="font-medium text-rose-700">RM {Number(o.refundProfit?.actualRefundLoss || 0).toFixed(2)}</span></div>
              <div className="md:col-span-2"><span className="text-muted-foreground">{translate("退款后商品利润（不含配送）", "Post-refund product profit (excl. delivery)")}:</span> <span className={`font-medium ${Number(o.refundProfit?.finalProductProfit || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>RM {Number(o.refundProfit?.finalProductProfit || 0).toFixed(2)}</span></div>
            </>
          )}
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
                  <th className="text-left p-3 font-medium">{translate("来源", "Source")}</th>
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
                        <ProductImagePreview
                          src={item.productImage}
                          alt={item.productName}
                          className="h-16 w-16"
                          label={translate("预览商品图片", "Preview product image")}
                        />
                      </td>
                    <td className="p-3 font-medium">{item.productName}</td>
                    <td className="p-3 text-muted-foreground">{ITEM_SOURCE_LABELS[item.itemSource] || item.itemSource || "-"}</td>
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
          {o.shippingMethod !== "self_pickup" && (
            <div className="flex justify-between"><span>{translate("运费", "Shipping Fee")}</span><span>RM {shippingFee.toFixed(2)}</span></div>
          )}
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
                  <th className="text-left p-3 font-medium">{translate("审核状态", "Status")}</th>
                  <th className="text-left p-3 font-medium">{translate("付款凭证", "Receipt")}</th>
                  <th className="text-left p-3 font-medium">{translate("备注", "Notes")}</th>
                  <th className="text-left p-3 font-medium">{translate("操作人", "Recorded By")}</th>
                  <th className="text-left p-3 font-medium no-print">{translate("操作", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {(o.payments || []).map((p: any, idx: number) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="p-3">{new Date(p.paymentDate || p.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</td>
                    <td className="p-3 text-right font-medium">RM {parseFloat(p.amount).toFixed(2)}</td>
                    <td className="p-3">{p.paymentMethodName || p.paymentMethod || "-"}</td>
                    <td className="p-3">
                      {p.reviewStatus === 'approved' && <Badge className="bg-green-100 text-green-700">{translate("已确认", "Approved")}</Badge>}
                      {p.reviewStatus === 'pending' && <Badge className="bg-orange-100 text-orange-700">{translate("待审核", "Pending")}</Badge>}
                      {p.reviewStatus === 'rejected' && <Badge className="bg-red-100 text-red-700">{translate("审核失败", "Rejected")}</Badge>}
                    </td>
                    <td className="p-3">{p.receiptUrl ? <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{translate("查看", "View")}</a> : "-"}</td>
                    <td className="p-3 text-muted-foreground">
                      {p.notes || "-"}
                      {p.rejectReason && <div className="text-red-500 text-xs mt-1">{p.rejectReason}</div>}
                    </td>
                    <td className="p-3 text-sm">
                      {p.operatorName || (p.paymentSource === 'customer_upload' ? translate("客户", "Customer") : "-")}
                      {p.reviewedBy && <div className="text-xs text-muted-foreground">{translate("审核人", "Reviewer")}: {p.reviewedBy}</div>}
                    </td>
                    <td className="p-3 no-print">
                      {p.reviewStatus === 'pending' && (
                        <div className="flex gap-1">
                          {p.receiptUrl && (
                            <a href={p.receiptUrl} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="h-7 px-2">
                                <Eye className="h-3 w-3 mr-1" />{translate("查看", "View")}
                              </Button>
                            </a>
                          )}
                          <Button size="sm" className="h-7 px-2 bg-green-600 hover:bg-green-700" disabled={reviewPaymentMutation.isPending}
                            onClick={() => reviewPaymentMutation.mutate({ paymentId: p.id, action: 'approve' })}>
                            <CheckCircle className="h-3 w-3 mr-1" />{translate("通过", "Approve")}
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 px-2" disabled={reviewPaymentMutation.isPending}
                            onClick={() => { setRejectPaymentId(p.id); setRejectReason(""); setRejectDialogOpen(true); }}>
                            <X className="h-3 w-3 mr-1" />{translate("失败", "Reject")}
                          </Button>
                        </div>
                      )}
                      {p.reviewStatus === 'approved' && (
                        <div className="flex gap-1">
                          {p.receiptUrl && (
                            <a href={p.receiptUrl} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 px-2">
                                <Eye className="h-3 w-3" />
                              </Button>
                            </a>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-2"
                            onClick={() => {
                              setEditPaymentId(p.id);
                              setEditPaymentForm({ amount: String(p.amount), paymentMethod: p.paymentMethod || "", receiptUrl: p.receiptUrl || "", notes: p.notes || "" });
                              setEditPaymentDialogOpen(true);
                            }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {(!o.payments || o.payments.length === 0) && (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{translate("无付款记录", "No payment records")}</td></tr>
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
                     r.remarkCategory === "desired_delivery_date" ? translate("发货日期", "Shipping Date") :
                     r.remarkCategory === "select_tree" ? translate("选树身", "Select Tree") :
                     translate("其他", "Other")}
                  </Badge>
                  {r.type === "customer" && <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{translate("客户", "Customer")}</Badge>}
                  {r.type === "internal" && <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{translate("后台", "Admin")}</Badge>}
                  {r.type === "live" && <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{translate("直播", "Live")}</Badge>}
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

      {/* V2.1.26补充5: Reject Payment Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("驳回付款凭证", "Reject Payment Receipt")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{translate("驳回原因", "Reject Reason")}</Label>
              <Textarea value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3} placeholder={translate("请填写驳回原因...", "Please enter reject reason...")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button variant="destructive" disabled={reviewPaymentMutation.isPending}
              onClick={() => {
                if (!rejectPaymentId) return;
                reviewPaymentMutation.mutate({ paymentId: rejectPaymentId, action: 'reject', rejectReason });
              }}>
              {reviewPaymentMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              {translate("确认驳回", "Confirm Reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* V2.1.26补充5: Edit Payment Dialog */}
      <Dialog open={editPaymentDialogOpen} onOpenChange={setEditPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("编辑付款记录", "Edit Payment Record")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{translate("金额", "Amount")}</Label>
              <Input type="number" step="0.01" value={editPaymentForm.amount}
                onChange={(e) => setEditPaymentForm({ ...editPaymentForm, amount: e.target.value })} />
            </div>
            <div>
              <Label>{translate("付款方式", "Payment Method")}</Label>
              <Select value={editPaymentForm.paymentMethod} onValueChange={(v) => setEditPaymentForm({ ...editPaymentForm, paymentMethod: v })}>
                <SelectTrigger><SelectValue placeholder={translate("选择付款方式", "Select payment method")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qr_pay">QR Pay (TNG/DuitNow)</SelectItem>
                  <SelectItem value="online_transfer">Online Transfer</SelectItem>
                  <SelectItem value="banking">Banking</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{translate("备注", "Notes")}</Label>
              <Textarea value={editPaymentForm.notes}
                onChange={(e) => setEditPaymentForm({ ...editPaymentForm, notes: e.target.value })}
                rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPaymentDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button disabled={editPaymentMutation.isPending}
              onClick={() => {
                if (!editPaymentId) return;
                editPaymentMutation.mutate({
                  paymentId: editPaymentId,
                  amount: editPaymentForm.amount,
                  paymentMethod: editPaymentForm.paymentMethod,
                  notes: editPaymentForm.notes,
                });
              }}>
              {editPaymentMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              {translate("保存", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={splitOpen} onOpenChange={(open) => {
        setSplitOpen(open);
        if (!open) {
          setSplitQuantities({});
          setNewOrderAllocatedPayment("0");
          setNewOrderAllocatedCredit("0");
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{translate("拆分订单", "Split Order")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{translate("选择要拆到新订单的商品数量。原订单必须至少保留一项商品或数量；本地未付款、部分汇款及保留订单都可以拆单。", "Choose quantities to move to a new order. The original order must retain at least one item or quantity; local unpaid, partially paid, and hold orders may be split.")}</p>
            <div className="space-y-2 rounded-lg border p-3">
              {detailItems.map((item) => {
                const splitQuantity = Number(splitQuantities[item.id] || 0);
                return (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{translate("原数量", "Original quantity")}: {item.quantity} · RM {Number(item.subtotal || 0).toFixed(2)}</p>
                    </div>
                    <Input type="number" min="0" max={item.quantity} value={splitQuantity || ""} onChange={(event) => {
                      const quantity = Math.max(0, Math.min(Number(item.quantity), Number(event.target.value || 0)));
                      setSplitQuantities((current) => ({ ...current, [item.id]: quantity }));
                    }} />
                  </div>
                );
              })}
            </div>
            {!leavesItemsOnOriginalOrder && <p className="text-sm text-destructive">{translate("原订单必须至少保留一项商品或数量。", "At least one item or quantity must remain on the original order.")}</p>}
            {(paidAmount > 0 || creditUsed > 0) && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div>
                  <p className="text-sm font-medium text-amber-950">{translate("已收款与 Credit 分配", "Payment & Credit allocation")}</p>
                  <p className="mt-1 text-xs leading-5 text-amber-900">{translate("请选择要带入新订单的金额。两张订单的已收款与已使用 Credit 合计会保持等于原订单；付款凭据不会复制，仍只保留在原订单及其付款审计中。", "Choose the amount to bring into the new order. Paid amount and Credit remain conserved across both orders; payment proof is not copied and remains only on the original order and its payment audit.")}</p>
                </div>
                {paidAmount > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
                    <div>
                      <Label>{translate("带入新订单的已收款（RM）", "Paid amount to new order (RM)")}</Label>
                      <Input type="number" min="0" max={paidAmount} step="0.01" value={newOrderAllocatedPayment}
                        onChange={(event) => setNewOrderAllocatedPayment(event.target.value)} />
                    </div>
                    <p className="rounded-md bg-white/70 px-3 py-2 text-sm text-amber-950">{translate("原订单保留", "Original keeps")}: <span className="font-semibold">RM {retainedSplitPayment.toFixed(2)}</span></p>
                  </div>
                )}
                {creditUsed > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
                    <div>
                      <Label>{translate("带入新订单的 Credit（RM）", "Credit to new order (RM)")}</Label>
                      <Input type="number" min="0" max={creditUsed} step="0.01" value={newOrderAllocatedCredit}
                        onChange={(event) => setNewOrderAllocatedCredit(event.target.value)} />
                    </div>
                    <p className="rounded-md bg-white/70 px-3 py-2 text-sm text-amber-950">{translate("原订单保留 Credit", "Original keeps Credit")}: <span className="font-semibold">RM {retainedSplitCredit.toFixed(2)}</span></p>
                  </div>
                )}
                {(!isSplitPaymentAllocationValid || !isSplitCreditAllocationValid) && <p className="text-sm text-destructive">{translate("带入新订单的金额不可超过原订单已收款或已使用 Credit。", "Amounts assigned to the new order cannot exceed the original paid amount or Credit used.")}</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={() => splitOrderMutation.mutate({ orderId, items: selectedSplitItems, newOrderAllocatedPayment: allocatedSplitPayment, newOrderAllocatedCredit: allocatedSplitCredit })} disabled={selectedSplitItems.length === 0 || !leavesItemsOnOriginalOrder || !isSplitPaymentAllocationValid || !isSplitCreditAllocationValid || splitOrderMutation.isPending}>
              <GitFork className="h-4 w-4 mr-2" />{translate("确认拆分", "Confirm Split")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={(open) => { setMergeOpen(open); if (!open) { setMergeTargetId(""); setMergeCreditDisposition("carry_forward"); } }}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100vh-4rem)] sm:w-full" data-order-detail-merge-dialog>
          <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 sm:border-0 sm:px-6 sm:pb-0">
            <DialogTitle>{translate("合并订单", "Merge Order")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {translate("不同客户也可合并，但两张订单都必须是未付款或保留订单、无付款凭证且未进入包货的本地 XT 订单。合并后会保留所选目标订单的客户、收件资料与配送方式，目前订单会保留为已取消的操作记录。", "Different customers may merge when both local XT orders are unpaid or on hold, have no payment proof, and have not entered fulfilment. The selected target keeps its customer, recipient, and shipping details; this order remains as a cancelled audit record.")}
            </div>
            {isLoadingMergeCandidates ? <p className="text-sm text-muted-foreground">{translate("正在查询可合并订单…", "Finding eligible orders…")}</p> : mergeCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{translate("没有符合条件的未付款或保留本地订单。", "No eligible unpaid or hold local order was found.")}</p>
            ) : (
              <div className="space-y-2">
                <Label>{translate("合并至订单", "Merge into order")}</Label>
                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                  <SelectTrigger><SelectValue placeholder={translate("请选择保留的目标订单", "Select the order to keep")} /></SelectTrigger>
                  <SelectContent>
                    {mergeCandidates.map((candidate: any) => <SelectItem key={candidate.id} value={String(candidate.id)}>
                      {candidate.orderNumber} · {candidate.customerName || candidate.facebookName || translate("未命名客户", "Unnamed customer")} · RM {Number(candidate.totalAmount || 0).toFixed(2)} · {candidate.physicalStatus === "hold_order" ? translate("保留订单", "Hold order") : translate("未汇款", "Unpaid")}
                    </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {Number(order?.creditUsed || 0) > 0 && (
              <div className="space-y-3 rounded-md border border-violet-300 bg-violet-50 p-3 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100" data-merge-credit-disposition>
                <div>
                  <p className="font-semibold">{translate("此来源订单已使用客户 Credit", "This source order has used customer Credit")}</p>
                  <p className="mt-1 text-xs opacity-80">{translate(`本订单已使用 RM ${Number(order?.creditUsed || 0).toFixed(2)}。请选择合并时继续使用，或退回来源客户余额。`, `This order used RM ${Number(order?.creditUsed || 0).toFixed(2)}. Choose whether to use it after merge or return it to the source customer balance.`)}</p>
                </div>
                <Select value={mergeCreditDisposition} onValueChange={(value) => setMergeCreditDisposition(value as "carry_forward" | "return_to_source")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carry_forward">{translate("继续用于保留订单（减少保留订单应付金额）", "Use on kept order (reduces its amount due)")}</SelectItem>
                    <SelectItem value="return_to_source">{translate("退回来源客户 Credit 余额（不用于保留订单）", "Return to source customer Credit balance (do not use on kept order)")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:border-0 sm:px-6 sm:pb-6">
            <Button variant="outline" onClick={() => setMergeOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={() => mergeOrderMutation.mutate({ sourceOrderId: orderId, targetOrderId: Number(mergeTargetId), creditDisposition: mergeCreditDisposition })} disabled={!mergeTargetId || mergeOrderMutation.isPending}>
              <GitMerge className="h-4 w-4 mr-2" />{translate("确认合并", "Confirm Merge")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Document Dialog — same OrderDocument template as export/print */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="shrink-0 border-b bg-white px-5 py-4 pr-12 sm:px-8">
            <DialogTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {translate("Preview 单据", "Preview Document")} — {o.orderNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/30 px-3 py-4 sm:px-8 sm:py-6">
            <OrderDocument
              order={o}
              remarks={remarks}
              variant="customer"
              logoDataUrl={previewLogoUrl}
              responsive
              showProductImage={true}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
