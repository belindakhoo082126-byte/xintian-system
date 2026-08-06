import { useState, useRef, useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Upload, X, FileText, DollarSign, Calendar } from "lucide-react";

// ── Types ──────────────────────────────────────────────
export interface PaymentRecord {
  id?: number;
  amount: string;
  paymentMethod?: string;
  paymentDate?: string; // ISO date
  receiptFiles?: string[]; // URLs
  receiptUrl?: string; // Legacy single URL
  notes?: string;
  purpose?: string;
}

interface Props {
  orderId?: number;
  totalAmount: number;
  paidAmount: number;
  payments: PaymentRecord[];
  onRefresh?: () => void;
  /** "create" mode collects payments locally without an orderId; "edit" mode (default) fires server mutations */
  mode?: "edit" | "create";
  /** Required in create mode: callback to sync local payment state up to parent */
  onLocalPaymentsChange?: (payments: PaymentRecord[]) => void;
}

const PAYMENT_METHODS = [
  { value: "Bank Transfer", label: "Bank Transfer", zhLabel: "银行转账" },
  { value: "QR Pay", label: "QR Pay", zhLabel: "QR Pay" },
  { value: "Cash", label: "Cash", zhLabel: "现金" },
  { value: "Credit", label: "Credit", zhLabel: "Credit" },
  { value: "Touch 'n Go", label: "Touch 'n Go", zhLabel: "Touch 'n Go" },
  { value: "Other", label: "其他", zhLabel: "其他" },
];

export function PaymentRecordsEditor({ orderId, totalAmount, paidAmount, payments, onRefresh, mode = "edit", onLocalPaymentsChange }: Props) {
  const { translate, lang } = useI18n();
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCreateMode = mode === "create";

  // New payment form state
  const [newPayment, setNewPayment] = useState<PaymentRecord>({
    amount: "",
    paymentMethod: "Bank Transfer",
    paymentDate: new Date().toISOString().slice(0, 10),
    receiptFiles: [],
    notes: "",
    purpose: "",
  });

  const balance = totalAmount - paidAmount;
  const isFullyPaid = balance <= 0.001;

  const addPaymentMutation = trpc.orders.addPayment.useMutation({
    onSuccess: () => {
      utils.orders.getDetail.invalidate({ id: orderId });
      utils.orders.getPayments.invalidate({ orderId });
      toast.success(translate("付款记录已新增", "Payment record added"));
      setDialogOpen(false);
      setNewPayment({
        amount: "",
        paymentMethod: "Bank Transfer",
        paymentDate: new Date().toISOString().slice(0, 10),
        receiptFiles: [],
        notes: "",
        purpose: "",
      });
      onRefresh?.();
    },
    onError: (e) => toast.error(translate("新增失败: {message}", "Add failed: {message}", { message: e.message })),
  });

  const deletePaymentMutation = trpc.orders.deletePayment.useMutation({
    onSuccess: () => {
      utils.orders.getDetail.invalidate({ id: orderId });
      utils.orders.getPayments.invalidate({ orderId });
      toast.success(translate("付款记录已删除", "Payment record deleted"));
      onRefresh?.();
    },
    onError: (e) => toast.error(translate("删除失败: {message}", "Delete failed: {message}", { message: e.message })),
  });

  // ── File upload ───────────────────────────────────────
  async function handleFileUpload(files: FileList) {
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        // Validate file type
        const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
        if (!validTypes.includes(file.type)) {
          toast.error(translate("仅支持 JPG, PNG, PDF 格式", "Only JPG, PNG, PDF formats are supported"));
          continue;
        }
        // Convert to base64 and upload via /api/upload
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: dataUrl, filename: file.name, contentType: file.type }),
        });
        if (res.ok) {
          const data = await res.json();
          uploaded.push(data.url);
        }
      }
      setNewPayment((prev) => ({
        ...prev,
        receiptFiles: [...(prev.receiptFiles || []), ...uploaded],
      }));
    } catch (e) {
      toast.error(translate("上传失败", "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  function removeUploadedFile(idx: number) {
    setNewPayment((prev) => ({
      ...prev,
      receiptFiles: (prev.receiptFiles || []).filter((_, i) => i !== idx),
    }));
  }

  function handleAddPayment() {
    const amt = parseFloat(newPayment.amount);
    if (!amt || amt <= 0) {
      toast.error(translate("请输入有效金额", "Please enter a valid amount"));
      return;
    }
    if (isCreateMode) {
      // In create mode, collect locally without an orderId
      const localPayment: PaymentRecord = {
        ...newPayment,
        amount: amt.toFixed(2),
        id: Date.now() + Math.floor(Math.random() * 1000),
      };
      onLocalPaymentsChange?.([...payments, localPayment]);
      setDialogOpen(false);
      setNewPayment({
        amount: "",
        paymentMethod: "Bank Transfer",
        paymentDate: new Date().toISOString().slice(0, 10),
        receiptFiles: [],
        notes: "",
        purpose: "",
      });
      toast.success(translate("付款记录已新增", "Payment record added"));
      return;
    }
    if (!orderId) {
      toast.error(translate("订单ID缺失", "Order ID is missing"));
      return;
    }
    addPaymentMutation.mutate({
      orderId,
      amount: amt.toFixed(2),
      paymentMethod: newPayment.paymentMethod,
      paymentDate: newPayment.paymentDate ? new Date(newPayment.paymentDate).toISOString() : undefined,
      receiptFiles: newPayment.receiptFiles && newPayment.receiptFiles.length > 0
        ? JSON.stringify(newPayment.receiptFiles)
        : undefined,
      notes: newPayment.notes || undefined,
      purpose: newPayment.purpose || undefined,
    });
  }

  function handleDeletePayment(paymentId: number) {
    if (!confirm(translate("确认删除此付款记录？", "Confirm delete this payment record?"))) return;
    if (isCreateMode) {
      onLocalPaymentsChange?.(payments.filter(p => p.id !== paymentId));
      return;
    }
    deletePaymentMutation.mutate({ paymentId });
  }

  // ── Status suggestion ─────────────────────────────────
  const statusSuggestion = useMemo(() => {
    if (paidAmount <= 0) return { zh: "未汇款订单", en: "Unpaid", variant: "outline" as const };
    if (isFullyPaid) return { zh: "已付款", en: "Fully Paid", variant: "secondary" as const };
    return { zh: "部分汇款", en: "Partial Payment", variant: "secondary" as const };
  }, [paidAmount, isFullyPaid]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border p-3 text-center">
          <div className="text-muted-foreground text-xs mb-1">{translate("订单总额", "Total Amount")}</div>
          <div className="font-bold text-base">RM {totalAmount.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-muted-foreground text-xs mb-1">{translate("已付款", "Paid")}</div>
          <div className="font-bold text-base text-green-600">RM {paidAmount.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-muted-foreground text-xs mb-1">{translate("未付款", "Outstanding")}</div>
          <div className={`font-bold text-base ${balance > 0 ? "text-orange-600" : "text-green-600"}`}>
            RM {Math.max(0, balance).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Status suggestion */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{translate("状态建议", "Status Suggestion")}:</span>
        <Badge variant={statusSuggestion.variant}>{translate(statusSuggestion.zh, statusSuggestion.en)}</Badge>
      </div>

      {/* Payment list */}
      <div className="space-y-2">
        {payments.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-6 border rounded-lg">
            {translate("暂无付款记录，点击下方按钮新增", "No payment records yet. Click the button below to add.")}
          </div>
        ) : (
          payments.map((p, idx) => {
            const files: string[] = p.receiptFiles
              ? (typeof p.receiptFiles === "string" ? JSON.parse(p.receiptFiles as string) : p.receiptFiles)
              : (p.receiptUrl ? [p.receiptUrl] : []);
            return (
              <div key={p.id || idx} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{translate("付款", "Payment")} {idx + 1}</Badge>
                    <span className="font-medium">RM {parseFloat(p.amount).toFixed(2)}</span>
                    <span className="text-muted-foreground text-xs">· {p.paymentMethod || "-"}</span>
                  </div>
                  {p.id && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeletePayment(p.id!)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US") : "-"}
                  </span>
                  {p.purpose && <span>· {p.purpose}</span>}
                  {p.notes && <span>· {p.notes}</span>}
                </div>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {files.map((url, fi) => (
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

      {/* Add Payment Button */}
      <Button variant="outline" onClick={() => setDialogOpen(true)} className="w-full">
        <Plus className="h-4 w-4 mr-1" />
        {translate("新增付款记录", "Add Payment")}
      </Button>
      {isCreateMode && payments.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          {translate("付款记录将在订单创建后自动保存", "Payment records will be saved automatically after order creation")}
        </div>
      )}

      {/* Add Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {translate("新增付款记录", "Add Payment Record")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount */}
            <div>
              <Label className="text-xs">{translate("付款金额 *", "Payment Amount *")}</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="RM 50.00"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
              />
            </div>

            {/* Payment Method */}
            <div>
              <Label className="text-xs">{translate("付款方式", "Payment Method")}</Label>
              <Select
                value={newPayment.paymentMethod}
                onValueChange={(v) => setNewPayment({ ...newPayment, paymentMethod: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {translate(m.zhLabel, m.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Date */}
            <div>
              <Label className="text-xs">{translate("汇款日期", "Payment Date")}</Label>
              <Input
                type="date"
                value={newPayment.paymentDate}
                onChange={(e) => setNewPayment({ ...newPayment, paymentDate: e.target.value })}
              />
            </div>

            {/* Purpose / Notes */}
            <div>
              <Label className="text-xs">{translate("备注", "Notes")}</Label>
              <Input
                placeholder={translate("例如：第一笔订金 / 客户补运费", "e.g. First deposit / Customer shipping top-up")}
                value={newPayment.purpose}
                onChange={(e) => setNewPayment({ ...newPayment, purpose: e.target.value })}
              />
            </div>

            {/* File Upload */}
            <div>
              <Label className="text-xs">{translate("上传付款单据 (JPG/PNG/PDF)", "Upload Receipt (JPG/PNG/PDF)")}</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(newPayment.receiptFiles || []).map((url, idx) => (
                  <div key={idx} className="relative group">
                    {url.match(/\.(pdf)$/i) ? (
                      <a href={url} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
                        <FileText className="h-3 w-3" /> PDF {idx + 1}
                      </a>
                    ) : (
                      <img src={url} alt={`Receipt ${idx + 1}`} className="w-16 h-16 object-cover rounded border" />
                    )}
                    <button
                      onClick={() => removeUploadedFile(idx)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-16 h-16 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  {uploading ? (
                    <span className="text-xs">...</span>
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                />
              </div>
            </div>

            <Separator />

            {/* Quick balance preview */}
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{translate("当前已付", "Currently Paid")}</span>
                <span>RM {paidAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{translate("本次新增", "This Payment")}</span>
                <span>RM {(parseFloat(newPayment.amount) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>{translate("新增后已付", "After Adding")}</span>
                <span className="text-green-600">RM {(paidAmount + (parseFloat(newPayment.amount) || 0)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>{translate("新增后欠款", "Remaining Outstanding")}</span>
                <span className="text-orange-600">
                  RM {Math.max(0, totalAmount - paidAmount - (parseFloat(newPayment.amount) || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {translate("取消", "Cancel")}
            </Button>
            <Button onClick={handleAddPayment} disabled={(!isCreateMode && addPaymentMutation.isPending) || uploading}>
              {(!isCreateMode && addPaymentMutation.isPending) ? translate("保存中...", "Saving...") : translate("确认新增", "Confirm Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
