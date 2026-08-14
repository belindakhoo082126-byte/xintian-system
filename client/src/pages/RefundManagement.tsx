import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, ClipboardList, Copy, FileUp, Loader2, PackageCheck, Plus, Search, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LargeOperationDialogBody,
  LargeOperationDialogContent,
  LargeOperationDialogFooter,
  LargeOperationDialogHeader,
} from "@/components/LargeOperationDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type RefundStatus = "all" | "pending" | "processed" | "awaiting_return" | "rejected" | "cancelled";
type InventoryTreatment = "return_to_sale" | "write_off" | "none" | "pending_return";
type DraftLine = { quantity: number; inventoryTreatment: InventoryTreatment };

const STATUS_META: Record<Exclude<RefundStatus, "all">, { zh: string; en: string; className: string }> = {
  pending: { zh: "未处理", en: "Pending", className: "border-amber-200 bg-amber-50 text-amber-700" },
  processed: { zh: "已处理", en: "Processed", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  awaiting_return: { zh: "待退货确认", en: "Awaiting Return", className: "border-violet-200 bg-violet-50 text-violet-700" },
  rejected: { zh: "已拒绝", en: "Rejected", className: "border-red-200 bg-red-50 text-red-700" },
  cancelled: { zh: "已取消", en: "Cancelled", className: "border-slate-200 bg-slate-50 text-slate-700" },
};

const TREATMENT_META: Record<InventoryTreatment, { zh: string; en: string }> = {
  return_to_sale: { zh: "退回可售库存", en: "Return to sale" },
  write_off: { zh: "不退回库存／报损", en: "Write off" },
  none: { zh: "与库存无关", en: "Not inventory related" },
  pending_return: { zh: "待退货确认", en: "Pending return" },
};

const METHOD_META: Record<string, { zh: string; en: string }> = {
  credit: { zh: "退入客户 Credit", en: "Customer Credit" },
  tng_qr: { zh: "TNG QR", en: "TNG QR" },
  duitnow_qr: { zh: "DuitNow QR", en: "DuitNow QR" },
  bank_transfer: { zh: "银行转账", en: "Bank transfer" },
  cash: { zh: "现金", en: "Cash" },
  other: { zh: "其他", en: "Other" },
};

const currency = (value: unknown) => `RM ${Number(value || 0).toFixed(2)}`;

function isProofRequired(method: string) {
  return ["tng_qr", "duitnow_qr", "bank_transfer"].includes(method);
}

function parseAttachmentUrls(value: unknown): string[] {
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === "string" && url.length > 0) : [];
  } catch {
    return value.startsWith("http") ? [value] : [];
  }
}

export default function RefundManagement() {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const text = (zhText: string, enText: string) => zh ? zhText : enText;
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<RefundStatus>("all");
  const [keyword, setKeyword] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [draftLines, setDraftLines] = useState<Record<number, DraftLine>>({});
  const [requestedAmount, setRequestedAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("credit");
  const [refundReason, setRefundReason] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [customerRefundDetails, setCustomerRefundDetails] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeRefund, setActiveRefund] = useState<any>(null);
  const [completeAmount, setCompleteAmount] = useState("");
  const [completeReceiptUrl, setCompleteReceiptUrl] = useState("");
  const [correctingItemId, setCorrectingItemId] = useState<number | null>(null);

  const statusInput = status === "all" ? undefined : { status: status as Exclude<RefundStatus, "all"> };
  const { data: refundRows = [], isLoading } = trpc.refunds.list.useQuery(statusInput);
  const { data: eligibleOrders = [], isFetching: isSearchingOrders } = trpc.refunds.searchEligibleOrders.useQuery(
    { search: orderSearch.trim() || undefined },
    { enabled: createOpen && step === 1 },
  );
  const { data: selectedDetail, isFetching: loadingDetail } = trpc.refunds.getOrderDetail.useQuery(
    { orderId: selectedOrder?.id || 0 },
    { enabled: Boolean(selectedOrder) && createOpen },
  );

  const filteredRows = useMemo(() => (refundRows as any[]).filter((row) => {
    const createdAt = row.refund?.createdAt ? new Date(row.refund.createdAt) : null;
    if (fromDate && (!createdAt || createdAt < new Date(`${fromDate}T00:00:00`))) return false;
    if (toDate && (!createdAt || createdAt > new Date(`${toDate}T23:59:59.999`))) return false;
    if (!keyword.trim()) return true;
    const search = keyword.trim().toLowerCase();
    return [row.orderNumber, row.customerName, row.customerPhone, row.refund?.refundNumber, row.refund?.refundReason]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
  }), [refundRows, keyword, fromDate, toDate]);
  const pendingRows = (refundRows as any[]).filter((row) => row.refund?.status === "pending");
  const pendingAmount = pendingRows.reduce((sum, row) => sum + Number(row.refund?.requestedAmount || 0), 0);

  const selectedItems = useMemo(() => (selectedDetail?.items || []).filter((item: any) => draftLines[item.id]?.quantity > 0), [selectedDetail, draftLines]);
  const calculatedItemAmount = selectedItems.reduce((sum: number, item: any) => sum + (draftLines[item.id].quantity * Number(item.unitPrice || 0)), 0);
  const plannedReturnCostRecovery = selectedItems.reduce((sum: number, item: any) => draftLines[item.id].inventoryTreatment === "return_to_sale" ? sum + (draftLines[item.id].quantity * Number(item.unitCost || item.costPrice || 0)) : sum, 0);
  const plannedRefundAmount = Number(requestedAmount || calculatedItemAmount || 0);
  const estimatedPostRefundProfit = Number(selectedDetail?.refundProfit?.finalProductProfit || 0) - plannedRefundAmount + plannedReturnCostRecovery;

  useEffect(() => {
    if (!activeRefund) return;
    const fresh = (refundRows as any[]).find((row) => row.refund?.id === activeRefund.refund?.id);
    if (fresh) setActiveRefund(fresh);
  }, [refundRows, activeRefund?.refund?.id]);

  const invalidateRefunds = async () => {
    await Promise.all([utils.refunds.list.invalidate(), utils.dashboardV11.stats.invalidate(), utils.orders.getDetail.invalidate()]);
  };

  const createMutation = trpc.refunds.create.useMutation({
    onSuccess: async () => {
      toast.success(text("退款申请已建立；未处理前不会影响库存与正式财务。", "Refund request created. Inventory and formal finance remain unchanged until processing."));
      await invalidateRefunds();
      resetCreateDialog();
    },
    onError: (error) => toast.error(error.message),
  });
  const completeMutation = trpc.refunds.complete.useMutation({
    onSuccess: async () => {
      toast.success(text("退款已完成，库存、Credit 与财务已同步。", "Refund completed; inventory, credit, and finance are synchronized."));
      await invalidateRefunds();
      setCompleteAmount("");
      setCompleteReceiptUrl("");
    },
    onError: (error) => toast.error(error.message),
  });
  const rejectMutation = trpc.refunds.reject.useMutation({ onSuccess: invalidateRefunds, onError: (error) => toast.error(error.message) });
  const cancelMutation = trpc.refunds.cancel.useMutation({ onSuccess: invalidateRefunds, onError: (error) => toast.error(error.message) });
  const finalizeMutation = trpc.refunds.finalizeReturnItem.useMutation({ onSuccess: invalidateRefunds, onError: (error) => toast.error(error.message) });
  const correctMutation = trpc.refunds.correctInventoryTreatment.useMutation({ onSuccess: async () => { toast.success(text("库存处理已更正，并已留下反向库存记录。", "Inventory treatment corrected with a reversing inventory record.")); await invalidateRefunds(); setCorrectingItemId(null); }, onError: (error) => toast.error(error.message) });

  async function copyRefundDetails(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(text("客户退款资料已复制", "Customer refund details copied"));
    } catch {
      toast.error(text("复制失败，请手动复制", "Copy failed; please copy manually"));
    }
  }

  function resetCreateDialog() {
    setCreateOpen(false);
    setStep(1);
    setOrderSearch("");
    setSelectedOrder(null);
    setDraftLines({});
    setRequestedAmount("");
    setRefundMethod("credit");
    setRefundReason("");
    setIssueDescription("");
    setCustomerRefundDetails("");
    setInternalNotes("");
    setAttachmentUrls([]);
  }

  function selectOrder(order: any) {
    const isChangingOrder = selectedOrder?.id !== order.id;
    setSelectedOrder(order);
    if (isChangingOrder) {
      setDraftLines({});
      setRequestedAmount("");
    }
    setStep(2);
  }

  function updateLine(item: any, patch: Partial<DraftLine>) {
    const existing = draftLines[item.id] || { quantity: 0, inventoryTreatment: item.productId ? "return_to_sale" as InventoryTreatment : "none" as InventoryTreatment };
    const max = Math.max(0, Number(item.quantity || 0) - Number(item.refundedQuantity || 0));
    const nextQuantity = Math.max(0, Math.min(max, Number(patch.quantity ?? existing.quantity)));
    setDraftLines((previous) => ({ ...previous, [item.id]: { ...existing, ...patch, quantity: nextQuantity } }));
  }

  async function uploadFile(file: File, target: "attachment" | "receipt") {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(text("文件不能超过 10MB", "File must not exceed 10MB"));
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: dataUrl, filename: file.name, contentType: file.type }) });
      const payload = await response.json();
      if (!response.ok || !payload.url) throw new Error(payload.error || "Upload failed");
      if (target === "attachment") setAttachmentUrls((urls) => [...urls, payload.url]);
      else setCompleteReceiptUrl(payload.url);
      toast.success(text("文件已上传", "File uploaded"));
    } catch (error: any) {
      toast.error(error?.message || text("上传失败", "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  function submitCreate() {
    const amount = Number(requestedAmount);
    if (!selectedOrder || amount <= 0) {
      toast.error(text("请选择订单并填写有效的申请退款金额。", "Select an order and enter a valid requested amount."));
      return;
    }
    createMutation.mutate({
      orderId: selectedOrder.id,
      requestedAmount: amount,
      refundMethod: refundMethod as any,
      refundReason: refundReason || undefined,
      issueDescription: issueDescription || undefined,
      customerRefundDetails: customerRefundDetails || undefined,
      attachmentUrls: attachmentUrls.join("\n") || undefined,
      internalNotes: internalNotes || undefined,
      items: selectedItems.map((item: any) => ({
        orderItemId: item.id,
        productId: item.productId || undefined,
        productName: item.productName,
        productSku: item.productSku || null,
        refundQuantity: draftLines[item.id].quantity,
        unitPrice: Number(item.unitPrice || 0),
        unitCost: Number(item.unitCost || item.costPrice || 0),
        refundAmount: draftLines[item.id].quantity * Number(item.unitPrice || 0),
        inventoryTreatment: draftLines[item.id].inventoryTreatment,
      })),
    });
  }

  function requestReject(refundId: number) {
    const reason = window.prompt(text("请输入拒绝原因（可留空）：", "Enter rejection reason (optional):")) || undefined;
    rejectMutation.mutate({ refundId, reason });
  }

  function requestCancel(refundId: number) {
    const reason = window.prompt(text("请输入取消原因（可留空）：", "Enter cancellation reason (optional):")) || undefined;
    cancelMutation.mutate({ refundId, reason });
  }

  const renderStatus = (value: string) => {
    const meta = STATUS_META[value as Exclude<RefundStatus, "all">] || STATUS_META.pending;
    return <Badge variant="outline" className={meta.className}>{text(meta.zh, meta.en)}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{text("退款管理", "Refund Management")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{text("建立、追溯与完成逐项退款；未处理退款不会影响库存或正式财务。", "Create, trace, and finalize itemized refunds. Pending refunds do not affect inventory or formal finance.")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" />{text("添加退款", "Add Refund")}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2"><CardDescription>{text("待处理退款", "Pending refunds")}</CardDescription><CardTitle className="text-3xl text-amber-700">{pendingRows.length}</CardTitle></CardHeader>
          <CardContent className="text-sm text-amber-800">{text("申请退款总额", "Requested total")}: <span className="font-semibold">{currency(pendingAmount)}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>{text("处理规则", "Processing rule")}</CardDescription><CardTitle className="text-base">{text("完成后才同步库存与财务", "Sync only after completion")}</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{text("TNG、DuitNow、银行转账需上传凭证；Credit 必须成功写入客户流水。", "TNG, DuitNow, and bank transfer require proof; Credit must write a customer ledger entry successfully.")}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={keyword} onChange={(event) => setKeyword(event.target.value)} className="pl-9" placeholder={text("搜索退款编号、订单、客户或原因", "Search refund, order, customer, or reason")} /></div>
          <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label={text("开始日期", "Start date")} className="w-full lg:w-[150px]" />
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label={text("结束日期", "End date")} className="w-full lg:w-[150px]" />
          <Select value={status} onValueChange={(value) => setStatus(value as RefundStatus)}><SelectTrigger className="w-full lg:w-[190px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{text("全部状态", "All statuses")}</SelectItem>{Object.entries(STATUS_META).map(([key, meta]) => <SelectItem key={key} value={key}>{text(meta.zh, meta.en)}</SelectItem>)}</SelectContent></Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ClipboardList className="h-5 w-5 text-primary" />{text("退款记录", "Refund records")}</CardTitle><CardDescription>{text("一张订单可以有多笔退款；系统按商品累计已退数量以防止重复退款。", "One order may have multiple refunds; refunded quantities are accumulated per item to prevent duplicates.")}</CardDescription></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : filteredRows.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">{text("暂时没有符合条件的退款记录。", "No matching refund records.")}</div> : (
            <div className="divide-y">
              {filteredRows.map((row) => {
                const refund = row.refund;
                return <div key={refund.id} className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold">{refund.refundNumber || `RF-${refund.id}`}</span>{renderStatus(refund.status)}<Link href={`/orders/${refund.orderId}`} className="text-sm text-primary hover:underline">{row.orderNumber || `#${refund.orderId}`}</Link></div>
                    <p className="text-sm text-muted-foreground">{row.customerName || "-"}{row.customerPhone ? ` · ${row.customerPhone}` : ""} · {refund.refundReason || text("未填写原因", "No reason")}</p>
                    <p className="text-xs text-muted-foreground">{new Date(refund.createdAt).toLocaleString(zh ? "zh-CN" : "en-MY")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 xl:justify-end"><div className="text-left xl:text-right"><p className="text-xs text-muted-foreground">{text("申请金额", "Requested")}</p><p className="font-semibold">{currency(refund.requestedAmount)}</p></div><Button size="sm" variant="outline" onClick={() => { setActiveRefund(row); setCompleteAmount(String(refund.requestedAmount || "")); setCompleteReceiptUrl(refund.receiptUrl || ""); }}>{text("查看与处理", "View & Process")}</Button></div>
                </div>;
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetCreateDialog(); else setCreateOpen(true); }}>
        <LargeOperationDialogContent>
          <LargeOperationDialogHeader>
            <DialogHeader><DialogTitle>{text("添加退款", "Add Refund")}</DialogTitle><DialogDescription>{text(`步骤 ${step}/3：${step === 1 ? "选择已发货／已完成订单" : step === 2 ? "选择退款商品与库存处理" : "填写退款资料"}`, `Step ${step}/3`)}</DialogDescription></DialogHeader>
            <div className="grid grid-cols-3 gap-2 pt-4">
              {[
                text("选择订单", "Select order"),
                text("商品与库存处理", "Items & inventory"),
                text("退款资料", "Refund details"),
              ].map((label, index) => <div key={label} className={`min-w-0 rounded-md px-3 py-2 text-center text-sm font-medium ${step >= index + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><span className="block truncate">{index + 1}. {label}</span></div>)}
            </div>
          </LargeOperationDialogHeader>
          <LargeOperationDialogBody>

          {step === 1 && <div className="space-y-5"><div className="relative"><Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" /><Input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} className="h-12 pl-11 text-base" placeholder={text("搜索订单号、客户姓名、电话或追踪号", "Search order, customer, phone, or tracking number")} /></div>{isSearchingOrders ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : <div className="grid gap-5 sm:grid-cols-2">{(eligibleOrders as any[]).map((order) => <button key={order.id} onClick={() => selectOrder(order)} className="min-h-[150px] rounded-xl border p-6 text-left text-base shadow-sm transition-colors hover:border-primary hover:bg-primary/5"><div className="flex items-center justify-between gap-3"><span className="font-mono font-semibold">{order.orderNumber}</span><Badge variant="outline">{order.physicalStatus === "completed" ? text("已完成", "Completed") : text("已发货", "Shipped")}</Badge></div><p className="mt-3 text-base">{order.customerName || "-"}{order.customerPhone ? ` · ${order.customerPhone}` : ""}</p><p className="mt-2 text-sm text-muted-foreground">{text("追踪号", "Tracking")}: {order.trackingNumber || "-"} · {text("实付", "Paid")}: {currency(order.paidAmount)}</p></button>)}</div>}{!isSearchingOrders && (eligibleOrders as any[]).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{text("没有可退款的已发货或已完成订单。", "No eligible shipped or completed orders.")}</p>}</div>}

          {step === 2 && <div className="space-y-5">{loadingDetail ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : <><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"><div><p className="font-semibold">{text("已选择订单，下一步请选择退款商品", "Order selected. Choose refund items next.")}</p><p className="mt-1 text-sm text-muted-foreground">{text("如需更换订单，可返回第一步骤重新搜索；已填写的退款资料会保留。", "Return to step 1 to search again; entered refund details are retained.")}</p></div><Button type="button" variant="outline" className="h-11 px-5 text-base" onClick={() => setStep(1)}>{text("返回重新查询订单", "Back to order search")}</Button></div><Card className="bg-muted/30"><CardContent className="grid gap-3 p-5 text-base sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-muted-foreground">{text("订单", "Order")}: </span><span className="font-mono font-semibold">{selectedDetail?.order?.orderNumber}</span></div><div><span className="text-muted-foreground">{text("客户", "Customer")}: </span>{selectedDetail?.customer?.name || "-"}</div><div><span className="text-muted-foreground">{text("配送", "Shipping")}: </span>{selectedDetail?.order?.shippingMethod || "-"}</div><div><span className="text-muted-foreground">{text("实付", "Paid")}: </span>{currency(selectedDetail?.order?.paidAmount)}</div><div><span className="text-muted-foreground">{text("商品成本", "Product cost")}: </span>{currency(selectedDetail?.refundProfit?.originalProductCost)}</div><div><span className="text-muted-foreground">{text("已退款损失", "Refund loss")}: </span><span className="text-rose-700">{currency(selectedDetail?.refundProfit?.actualRefundLoss)}</span></div><div className="sm:col-span-2"><span className="text-muted-foreground">{text("当前商品售后利润（不含配送）", "Current post-sale product profit (excl. delivery)")}: </span><span className="font-semibold text-emerald-700">{currency(selectedDetail?.refundProfit?.finalProductProfit)}</span></div></CardContent></Card>
            <div className="space-y-3"><div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(150px,.8fr)_140px_minmax(210px,1fr)] gap-4 border-b bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground lg:grid"><span>{text("商品", "Item")}</span><span>{text("已购／已退／可退", "Bought / Refunded / Available")}</span><span>{text("本次数量", "Qty")}</span><span>{text("库存处理", "Inventory treatment")}</span></div>{(selectedDetail?.items || []).map((item: any) => { const available = Math.max(0, Number(item.quantity || 0) - Number(item.refundedQuantity || 0)); const line = draftLines[item.id]; return <div key={item.id} className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm lg:grid-cols-[minmax(0,1.7fr)_minmax(150px,.8fr)_140px_minmax(210px,1fr)] lg:items-center"><div className="flex min-w-0 items-start gap-3"><Checkbox className="mt-1" checked={Boolean(line?.quantity)} disabled={available <= 0} onCheckedChange={(checked) => updateLine(item, { quantity: checked ? Math.min(1, available) : 0 })} /><div className="min-w-0"><p className="truncate text-base font-semibold" title={item.productName}>{item.productName}</p><p className="mt-1 text-sm text-muted-foreground">{currency(item.unitPrice)} · {text("成本", "Cost")} {currency(item.unitCost || item.costPrice)}</p></div></div><div className="text-sm"><span className="mr-1 text-muted-foreground lg:hidden">{text("已购／已退／可退", "Bought / Refunded / Available")}:</span>{item.quantity} / {item.refundedQuantity || 0} / <span className="font-semibold">{available}</span></div><div><Label className="mb-1 block text-xs lg:hidden">{text("本次数量", "Qty")}</Label><Input className="h-11" type="number" min="0" max={available} disabled={!line?.quantity} value={line?.quantity || 0} onChange={(event) => updateLine(item, { quantity: Number(event.target.value) })} /></div><div><Label className="mb-1 block text-xs lg:hidden">{text("库存处理", "Inventory treatment")}</Label><Select value={line?.inventoryTreatment || (item.productId ? "return_to_sale" : "none")} disabled={!line?.quantity} onValueChange={(value) => updateLine(item, { inventoryTreatment: value as InventoryTreatment })}><SelectTrigger className="h-11 text-sm"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TREATMENT_META).map(([key, meta]) => <SelectItem key={key} value={key}>{text(meta.zh, meta.en)}</SelectItem>)}</SelectContent></Select></div></div>; })}</div>
            {(selectedDetail?.refunds || []).length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{text("此前退款记录", "Previous refunds")}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{(selectedDetail?.refunds || []).map((refund: any) => <div key={refund.id} className="flex flex-wrap justify-between gap-2 rounded bg-muted/40 p-2"><span>{refund.refundNumber} · {renderStatus(refund.status)}</span><span>{currency(refund.amount || refund.requestedAmount)}</span></div>)}</CardContent></Card>}</>}</div>}

          {step === 3 && <div className="grid gap-4 lg:grid-cols-2"><div className="space-y-4"><div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"><p className="font-medium">{text("已选商品退款金额", "Selected item refund amount")}: {currency(calculatedItemAmount)}</p><p className="mt-1 font-medium">{text("预计退款后商品利润（不含配送）", "Estimated post-refund product profit (excl. delivery)")}: <span className={estimatedPostRefundProfit >= 0 ? "text-emerald-700" : "text-rose-700"}>{currency(estimatedPostRefundProfit)}</span></p><p className="mt-1 text-xs text-muted-foreground">{text("此金额会按实际退款额更新；选择退回可售库存的商品成本会在完成退库后回收。", "This updates with the actual refunded amount; cost is recovered after selected items return to saleable stock.")}</p><p className="mt-1 text-xs text-muted-foreground">{text("运费、多付款或服务补偿可不选择商品，并使用“与库存无关”。", "For shipping, overpayment, or service compensation, no item selection is needed and inventory remains unaffected.")}</p></div><div className="grid gap-2"><Label>{text("申请退款金额", "Requested refund amount")} *</Label><Input type="number" min="0.01" step="0.01" value={requestedAmount} onChange={(event) => setRequestedAmount(event.target.value)} placeholder={calculatedItemAmount ? calculatedItemAmount.toFixed(2) : "0.00"} /></div><div className="grid gap-2"><Label>{text("退款原因", "Refund reason")}</Label><Input value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder={text("例如：遗漏发货、商品损坏", "e.g. missed shipment, damaged item")} /></div><div className="grid gap-2"><Label>{text("问题说明", "Issue description")}</Label><Textarea value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} placeholder={text("说明客户问题、商品情况或补偿原因", "Describe the customer issue, item condition, or compensation reason")} /></div></div><div className="space-y-4"><div className="grid gap-2"><Label>{text("退款方式", "Refund method")} *</Label><Select value={refundMethod} onValueChange={setRefundMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(METHOD_META).map(([key, meta]) => <SelectItem key={key} value={key}>{text(meta.zh, meta.en)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>{text("客户退款资料", "Customer refund details")}</Label><Textarea value={customerRefundDetails} onChange={(event) => setCustomerRefundDetails(event.target.value)} placeholder={text("QR 收款人、姓名、电话号码／DuitNow 号码，或银行名称、户口姓名与号码", "QR recipient, name, phone/DuitNow number, or bank, account holder and account number")} /></div><div className="grid gap-2"><Label>{text("客户问题照片／聊天截图", "Customer issue photos / chat screenshots")}</Label><div className="flex items-center gap-2"><Input type="file" accept="image/*,.pdf" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file, "attachment"); }} /><FileUp className="h-4 w-4 text-muted-foreground" /></div>{attachmentUrls.length > 0 && <div className="space-y-1 text-xs">{attachmentUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="block truncate text-primary hover:underline">{url}</a>)}</div>}</div><div className="grid gap-2"><Label>{text("内部备注", "Internal notes")}</Label><Textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} /></div></div></div>}
          </LargeOperationDialogBody>
          <LargeOperationDialogFooter><div className="flex w-full items-center justify-between"><Button variant="outline" onClick={() => step === 1 ? resetCreateDialog() : setStep((current) => current - 1)}>{step === 1 ? text("取消", "Cancel") : text("上一步", "Back")}</Button>{step < 3 ? <Button disabled={step === 2 && loadingDetail} onClick={() => { if (step === 2 && !requestedAmount && calculatedItemAmount) setRequestedAmount(calculatedItemAmount.toFixed(2)); setStep((current) => current + 1); }}>{text("下一步", "Next")}</Button> : <Button disabled={createMutation.isPending} onClick={submitCreate}>{createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{text("建立退款申请", "Create Refund Request")}</Button>}</div></LargeOperationDialogFooter>
        </LargeOperationDialogContent>
      </Dialog>

      <Dialog open={Boolean(activeRefund)} onOpenChange={(open) => { if (!open) setActiveRefund(null); }}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          {activeRefund && <><DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">{activeRefund.refund.refundNumber || `RF-${activeRefund.refund.id}`}{renderStatus(activeRefund.refund.status)}</DialogTitle><DialogDescription>{text("订单", "Order")} {activeRefund.orderNumber || activeRefund.refund.orderId} · {activeRefund.customerName || "-"}</DialogDescription></DialogHeader>
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-3"><div><p className="text-muted-foreground">{text("申请金额", "Requested")}</p><p className="font-semibold">{currency(activeRefund.refund.requestedAmount)}</p></div><div><p className="text-muted-foreground">{text("实际金额", "Actual")}</p><p className="font-semibold">{currency(activeRefund.refund.amount)}</p></div><div><p className="text-muted-foreground">{text("退款方式", "Method")}</p><p>{text(METHOD_META[activeRefund.refund.refundMethod]?.zh || activeRefund.refund.refundMethod, METHOD_META[activeRefund.refund.refundMethod]?.en || activeRefund.refund.refundMethod)}</p></div>{activeRefund.refund.sourceExceptionId && <div className="sm:col-span-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">{text("来源：包货异常处理；退款完成前不会改变库存、Credit、利润或订单商品。", "Source: packing exception; inventory, Credit, profit and order items remain unchanged until the refund is completed.")}</div>}<div className="sm:col-span-3"><p className="text-muted-foreground">{text("原因／说明", "Reason / description")}</p><p className="whitespace-pre-wrap">{activeRefund.refund.refundReason || "-"}{activeRefund.refund.issueDescription ? `\n${activeRefund.refund.issueDescription}` : ""}</p></div></div>
            {(activeRefund.refund.customerRefundDetails || parseAttachmentUrls(activeRefund.refund.attachmentUrls).length > 0) && <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/40 p-4 text-sm"><div><h3 className="font-medium text-sky-950">{text("客户退款资料", "Customer refund details")}</h3><p className="mt-1 text-xs text-sky-800">{text("以下资料由建立退款时保存，可直接复制或打开客户QR／附件。", "Saved when the refund was created; copy details or open the customer QR / attachment directly.")}</p></div>{activeRefund.refund.customerRefundDetails && <div className="rounded-md bg-white/80 p-3"><div className="flex items-start justify-between gap-3"><p className="whitespace-pre-wrap break-words text-slate-800">{activeRefund.refund.customerRefundDetails}</p><Button size="sm" variant="outline" className="shrink-0" onClick={() => void copyRefundDetails(activeRefund.refund.customerRefundDetails)}><Copy className="mr-1 h-3.5 w-3.5" />{text("复制", "Copy")}</Button></div></div>}{parseAttachmentUrls(activeRefund.refund.attachmentUrls).length > 0 && <div className="space-y-2"><p className="text-xs font-medium text-sky-900">{text("客户QR／问题附件", "Customer QR / issue attachments")}</p><div className="flex flex-wrap gap-2">{parseAttachmentUrls(activeRefund.refund.attachmentUrls).map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-md border border-sky-200 bg-white px-3 py-1.5 text-xs text-primary hover:bg-sky-100">{text(`打开附件 ${index + 1}`, `Open attachment ${index + 1}`)}</a>)}</div></div>}</div>}
            <div className="space-y-2"><h3 className="font-medium">{text("退款商品与库存处理", "Refund items & inventory treatment")}</h3>{(activeRefund.items || []).length === 0 ? <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">{text("此退款不涉及商品库存。", "This refund does not involve item inventory.")}</p> : activeRefund.items.map((item: any) => <div key={item.id} className="rounded-lg border p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{item.productName} × {item.refundQuantity}</p><p className="text-sm text-muted-foreground">{currency(item.refundAmount)} · {text(TREATMENT_META[item.inventoryTreatment as InventoryTreatment]?.zh || item.inventoryTreatment, TREATMENT_META[item.inventoryTreatment as InventoryTreatment]?.en || item.inventoryTreatment)}</p></div><Badge variant="outline">{item.inventoryActionStatus || text("未处理", "Not processed")}</Badge></div>{activeRefund.refund.status === "awaiting_return" && item.inventoryTreatment === "pending_return" && item.inventoryActionStatus === "pending" && <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => finalizeMutation.mutate({ refundItemId: item.id, inventoryTreatment: "return_to_sale" })} disabled={finalizeMutation.isPending}><PackageCheck className="mr-1 h-4 w-4" />{text("确认退回可售库存", "Return to sale")}</Button><Button size="sm" variant="outline" onClick={() => finalizeMutation.mutate({ refundItemId: item.id, inventoryTreatment: "write_off" })} disabled={finalizeMutation.isPending}>{text("确认报损不退库", "Write off")}</Button></div>}{["returned", "written_off"].includes(item.inventoryActionStatus) && <div className="mt-3 flex flex-wrap items-center gap-2"><Select value={correctingItemId === item.id ? (item.inventoryTreatment === "return_to_sale" ? "write_off" : "return_to_sale") : ""} onValueChange={(value) => { setCorrectingItemId(item.id); correctMutation.mutate({ refundItemId: item.id, inventoryTreatment: value as "return_to_sale" | "write_off", reason: text("管理员更正退款库存处理", "Admin corrected refund inventory treatment") }); }}><SelectTrigger className="h-8 w-[190px]"><SelectValue placeholder={text("管理员更正库存处理", "Correct inventory treatment")} /></SelectTrigger><SelectContent><SelectItem value={item.inventoryTreatment === "return_to_sale" ? "write_off" : "return_to_sale"}>{text(item.inventoryTreatment === "return_to_sale" ? "改为报损不退库" : "改为退回可售库存", item.inventoryTreatment === "return_to_sale" ? "Change to write off" : "Change to return to sale")}</SelectItem></SelectContent></Select><span className="text-xs text-muted-foreground">{text("系统会建立反向库存记录。", "A reversing inventory record will be created.")}</span></div>}</div>)}</div>
            {activeRefund.refund.status === "pending" && <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4"><h3 className="flex items-center gap-2 font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4" />{text("完成退款", "Complete refund")}</h3><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>{text("实际退款金额", "Actual refund amount")} *</Label><Input type="number" min="0.01" step="0.01" value={completeAmount} onChange={(event) => setCompleteAmount(event.target.value)} /></div>{isProofRequired(activeRefund.refund.refundMethod) && <div className="grid gap-2"><Label>{text("退款凭证", "Refund proof")} *</Label><Input type="file" accept="image/*,.pdf" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file, "receipt"); }} />{completeReceiptUrl && <a href={completeReceiptUrl} target="_blank" rel="noreferrer" className="truncate text-xs text-primary hover:underline">{completeReceiptUrl}</a>}</div>}</div><Button disabled={completeMutation.isPending || !Number(completeAmount) || (isProofRequired(activeRefund.refund.refundMethod) && !completeReceiptUrl)} onClick={() => completeMutation.mutate({ refundId: activeRefund.refund.id, actualAmount: Number(completeAmount), receiptUrl: completeReceiptUrl || undefined })}>{completeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<CheckCircle2 className="mr-2 h-4 w-4" />{text("完成退款并通知客户", "Complete & notify customer")}</Button></div>}
            {activeRefund.refund.status === "pending" && <DialogFooter className="sm:justify-between"><Button variant="destructive" size="sm" onClick={() => requestReject(activeRefund.refund.id)} disabled={rejectMutation.isPending}><XCircle className="mr-1 h-4 w-4" />{text("拒绝", "Reject")}</Button><Button variant="outline" size="sm" onClick={() => requestCancel(activeRefund.refund.id)} disabled={cancelMutation.isPending}><Undo2 className="mr-1 h-4 w-4" />{text("取消退款", "Cancel refund")}</Button></DialogFooter>}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
