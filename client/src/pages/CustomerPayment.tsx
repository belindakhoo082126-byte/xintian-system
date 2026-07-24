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
            {/* QR Code Display */}
            {selectedMethod.type === "qr_code" && selectedMethod.qrImageUrl && (
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <img
                    src={selectedMethod.qrImageUrl}
                    alt={`${lang === "zh" ? selectedMethod.name : selectedMethod.name_en || selectedMethod.name} ${translate("QR Code", "QR Code")}`}
                    className="w-64 h-64 rounded-lg border-2 border-primary/20"
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
                    <ZoomIn className="h-4 w-4 mr-2" />{translate("放大 QR Code", "Zoom QR Code")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadQr(selectedMethod.qrImageUrl, selectedMethod.name)}>
                    <Download className="h-4 w-4 mr-2" />{translate("下载 QR Code", "Download QR Code")}
                  </Button>
                </div>
              </div>
            )}

            {/* Bank Transfer Details */}
            {selectedMethod.type === "bank_transfer" && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                {selectedMethod.bankName && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{translate("银行名称", "Bank Name")}</span>
                    <span className="font-medium">{selectedMethod.bankName}</span>
                  </div>
                )}
                {selectedMethod.accountHolder && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{translate("账户持有人", "Account Holder")}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedMethod.accountHolder}</span>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(selectedMethod.accountHolder, translate("账户持有人", "Account Holder"))}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {selectedMethod.accountNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{translate("银行账号", "Account Number")}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg">{selectedMethod.accountNumber}</span>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(selectedMethod.accountNumber, translate("银行账号", "Account Number"))}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment Instruction */}
            {selectedMethod.paymentInstruction && (
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <p className="text-sm">
                  <strong>{translate("付款说明:", "Payment Instructions:")}</strong> {selectedMethod.paymentInstruction}
                </p>
              </div>
            )}

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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{lang === "zh" ? selectedMethod?.name : selectedMethod?.name_en || selectedMethod?.name} {translate("QR Code", "QR Code")}</DialogTitle>
          </DialogHeader>
          {selectedMethod?.qrImageUrl && (
            <div className="flex flex-col items-center gap-3">
              <img src={selectedMethod.qrImageUrl} alt={translate("QR Code", "QR Code")} className="max-w-full rounded-lg" />
              <Button variant="outline" size="sm" onClick={() => downloadQr(selectedMethod.qrImageUrl, selectedMethod.name)}>
                <Download className="h-4 w-4 mr-2" />{translate("下载 QR Code", "Download QR Code")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer notice */}
      <div className="text-center text-sm text-muted-foreground py-4 border-t">
        {translate("请在汇款后，截图或保留收据并发送给我们，以便核对。谢谢！", "Please screenshot or keep the receipt after payment and send it to us for verification. Thank you!")}
      </div>
    </div>
  );
}
