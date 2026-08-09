import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { QrCode, University, Banknote, Package, Copy, ZoomIn, Download, Upload, CheckCircle, ArrowLeft } from "lucide-react";

const TYPE_ICONS: Record<string, any> = {
  qr_code: QrCode,
  bank_transfer: University,
  cash: Banknote,
  other: Package,
};

// Unified payment info image — shown for all payment methods
const UNIFIED_PAYMENT_IMAGE = "/manus-storage/pasted_file_BhQwTf_image_dcbe7a31.png";

// Method-specific payment instructions (keyed by payment method name)
const PAYMENT_INSTRUCTIONS: Record<string, { zh: string; en: string }> = {
  "Touch 'n Go eWallet QR": {
    zh: "请打开 Touch 'n Go eWallet，扫描二维码完成付款。\n汇款完成后，请截图并上传付款凭证。",
    en: "Please open Touch 'n Go eWallet and scan the QR code to complete payment.\nAfter payment, please screenshot and upload the payment proof.",
  },
  "DuitNow QR": {
    zh: "请使用任何支援 DuitNow QR 的银行或电子钱包扫描二维码完成付款。\n汇款完成后，请截图并上传付款凭证。",
    en: "Please use any DuitNow QR-supported bank or e-wallet to scan the QR code.\nAfter payment, please screenshot and upload the payment proof.",
  },
  "Online Transfer": {
    zh: "请使用网上银行或手机银行汇款至以下 Public Bank 户口。\n汇款完成后，请截图并上传付款凭证。",
    en: "Please use online or mobile banking to transfer to the following Public Bank account.\nAfter payment, please screenshot and upload the payment proof.",
  },
  "Public Bank Transfer": {
    zh: "请使用网上银行或手机银行汇款至以下 Public Bank 户口。\n汇款完成后，请截图并上传付款凭证。",
    en: "Please use online or mobile banking to transfer to the following Public Bank account.\nAfter payment, please screenshot and upload the payment proof.",
  },
};

function getPaymentInstruction(method: any, lang: string): string {
  const name = lang === "zh" ? method.name : method.name_en || method.name;
  const instr = PAYMENT_INSTRUCTIONS[name];
  if (instr) return lang === "zh" ? instr.zh : instr.en;
  // Fallback to method's own instruction or generic text
  if (method.paymentInstruction) return method.paymentInstruction;
  return lang === "zh" ? "汇款完成后，请截图并上传付款凭证。" : "After payment, please screenshot and upload the payment proof.";
}

export default function CustomerPayment({ orderId, onBack }: { orderId: number; onBack: () => void }) {
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [qrZoomOpen, setQrZoomOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
    const utils = trpc.useUtils();
  const { translate, lang } = useI18n();

  const { data: order, isLoading } = trpc.orders.getById.useQuery({ id: orderId });
  const { data: paymentMethods } = trpc.paymentMethods.listEnabled.useQuery();

  const uploadReceiptMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      toast.success(translate("付款凭证已上传，等待商家确认", "Payment proof uploaded, waiting for merchant confirmation"));
      setReceiptFile(null);
      setReceiptPreview("");
    },
    onError: (e) => toast.error(`${translate("上传失败:", "Upload failed:")} ${e.message}`),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">{translate("加载中...", "Loading...")}</div>;
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />{translate("返回", "Back")}</Button>
        <p className="text-center text-muted-foreground py-20">{translate("订单不存在", "Order not found")}</p>
      </div>
    );
  }

  const totalAmount = Number(order.totalAmount);
  const paidAmount = Number(order.paidAmount || 0);
  const remaining = totalAmount - paidAmount;

  async function handleUploadReceipt() {
    if (!receiptFile) {
      toast.error(translate("请选择付款凭证图片", "Please select payment proof image"));
      return;
    }
    // Convert file to base64 data URL for JSON API
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64Data = ev.target?.result as string;
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: base64Data, filename: receiptFile.name }),
        });
        if (res.ok) {
          const data = await res.json();
          uploadReceiptMutation.mutate({
            id: orderId,
            physicalStatus: "receipt_uploaded",
            receiptUrl: data.url,
          });
        } else {
          toast.error(translate("上传失败", "Upload failed"));
        }
      } catch {
        toast.error(translate("上传失败，请重试", "Upload failed, please try again"));
      }
    };
    reader.readAsDataURL(receiptFile);
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(translate(`${label} 已复制`, `${label} Copied`));
  }

  function downloadQr(url: string, name: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-QR.png`;
    a.click();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />{translate("返回", "Back")}</Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("付款", "Payment")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {translate("订单号:", "Order No.:")} <span className="font-mono">{order.orderNumber}</span>
          </p>
        </div>
      </div>

      {/* Payment Amount Summary */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{translate("需付款金额", "Amount to Pay")}</p>
              <p className="text-3xl font-bold text-primary">RM {remaining.toFixed(2)}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-muted-foreground">{translate("订单总额:", "Total Amount:")} RM {totalAmount.toFixed(2)}</p>
              {paidAmount > 0 && (
                <p className="text-green-600">{translate("已付:", "Paid:")} RM {paidAmount.toFixed(2)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Selection */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{translate("选择付款方式", "Select Payment Method")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {paymentMethods?.map((method: any) => {
            const Icon = TYPE_ICONS[method.type] || Package;
            const isSelected = selectedMethod?.id === method.id;
            return (
              <Card
                key={method.id}
                className={`cursor-pointer transition-all ${isSelected ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`}
                onClick={() => setSelectedMethod(method)}
              >
                <CardContent className="flex items-center gap-3 pt-4">
                  <div className={`p-2 rounded-lg ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{lang === "zh" ? method.name : method.name_en || method.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {method.type === "qr_code" ? translate("扫码付款", "Scan to Pay") :
                       method.type === "bank_transfer" ? translate("银行转账", "Bank Transfer") :
                       method.type === "cash" ? translate("现金付款", "Cash Payment") : translate("其他方式", "Other Method")}
                    </p>
                  </div>
                  {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Selected Payment Method Details */}
      {selectedMethod && (
        <Card>
          <CardHeader>
            <CardTitle>{lang === "zh" ? selectedMethod.name : selectedMethod.name_en || selectedMethod.name} - {translate("付款详情", "Payment Details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Unified Payment Info Image — shown for ALL payment methods */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative group">
                <img
                  src={UNIFIED_PAYMENT_IMAGE}
                  alt={translate("汇款资料", "Payment Info")}
                  className="w-full max-w-md rounded-lg border-2 border-primary/20"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setQrZoomOpen(true)}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setQrZoomOpen(true)}>
                  <ZoomIn className="h-4 w-4 mr-2" />{translate("放大图片", "Zoom Image")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadQr(UNIFIED_PAYMENT_IMAGE, "payment-info")}>
                  <Download className="h-4 w-4 mr-2" />{translate("下载图片", "Download Image")}
                </Button>
              </div>
            </div>

            {/* Online Transfer Bank Details — shown only for bank_transfer type */}
            {selectedMethod.type === "bank_transfer" && (
              <div className="p-4 border-2 border-primary/30 rounded-lg bg-green-50/50 dark:bg-green-950/20 space-y-3">
                <div className="flex items-center gap-2 font-semibold">
                  <University className="h-5 w-5" />
                  <span>{translate("银行户口资料", "Bank Account Details")}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-lg border">
                    <div>
                      <p className="text-xs text-muted-foreground">{translate("银行", "Bank")}</p>
                      <p className="font-semibold text-sm">Public Bank</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-lg border">
                    <div>
                      <p className="text-xs text-muted-foreground">{translate("户口号码", "Account Number")}</p>
                      <p className="font-mono font-semibold text-sm">3825375502</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard("3825375502", translate("户口号码", "Account Number"))}>
                      <Copy className="h-3.5 w-3.5 mr-1" />{translate("复制", "Copy")}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-lg border">
                    <div>
                      <p className="text-xs text-muted-foreground">{translate("户口名字", "Account Name")}</p>
                      <p className="font-semibold text-sm">ECOLAND NURSERY</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard("ECOLAND NURSERY", translate("户口名字", "Account Name"))}>
                      <Copy className="h-3.5 w-3.5 mr-1" />{translate("复制", "Copy")}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Method-specific Payment Instruction */}
            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <p className="text-sm whitespace-pre-line">
                <strong>{translate("付款说明:", "Payment Instructions:")}</strong>
                {getPaymentInstruction(selectedMethod, lang)}
              </p>
            </div>

            {/* Upload Payment Proof */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-medium">{translate("上传付款凭证", "Upload Payment Proof")}</h3>
              <p className="text-sm text-muted-foreground">
                {translate("请在付款后截图或保留收据，并上传以便商家核对。", "Please screenshot or keep the receipt after payment and upload it for merchant verification.")}
              </p>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer">
                  <Button variant="outline" asChild>
                    <span><Upload className="h-4 w-4 mr-2" />{translate("选择图片", "Select Image")}</span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                </label>
                {receiptPreview && (
                  <img src={receiptPreview} alt={translate("收据预览", "Receipt Preview")} className="h-20 w-20 rounded border object-cover" />
                )}
              </div>
              {receiptFile && (
                <Button
                  onClick={handleUploadReceipt}
                  disabled={uploadReceiptMutation.isPending}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {uploadReceiptMutation.isPending ? translate("上传中...", "Uploading...") : translate("确认上传凭证", "Confirm Upload Proof")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Zoom Dialog */}
      <Dialog open={qrZoomOpen} onOpenChange={setQrZoomOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{translate("汇款资料", "Payment Info")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <img src={UNIFIED_PAYMENT_IMAGE} alt={translate("汇款资料", "Payment Info")} className="max-w-full rounded-lg" />
            <Button variant="outline" size="sm" onClick={() => downloadQr(UNIFIED_PAYMENT_IMAGE, "payment-info")}>
              <Download className="h-4 w-4 mr-2" />{translate("下载图片", "Download Image")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer notice */}
      <div className="text-center text-sm text-muted-foreground py-4 border-t">
        {translate("请在汇款后，截图或保留收据并发送给我们，以便核对。谢谢！", "Please screenshot or keep the receipt after payment and send it to us for verification. Thank you!")}
      </div>
    </div>
  );
}
