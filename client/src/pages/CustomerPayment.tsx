import { useState } from "react";
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

  const { data: order, isLoading } = trpc.orders.getById.useQuery({ id: orderId });
  const { data: paymentMethods } = trpc.paymentMethods.listEnabled.useQuery();

  const uploadReceiptMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      toast.success("付款凭证已上传，等待商家确认");
      setReceiptFile(null);
      setReceiptPreview("");
    },
    onError: (e) => toast.error(`上传失败: ${e.message}`),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">加载中...</div>;
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />返回</Button>
        <p className="text-center text-muted-foreground py-20">订单不存在</p>
      </div>
    );
  }

  const totalAmount = Number(order.totalAmount);
  const paidAmount = Number(order.paidAmount || 0);
  const remaining = totalAmount - paidAmount;

  async function handleUploadReceipt() {
    if (!receiptFile) {
      toast.error("请选择付款凭证图片");
      return;
    }
    const formData = new FormData();
    formData.append("file", receiptFile);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        uploadReceiptMutation.mutate({
          id: orderId,
          physicalStatus: "receipt_uploaded",
          receiptUrl: data.url,
        });
      } else {
        toast.error("上传失败");
      }
    } catch {
      toast.error("上传失败，请重试");
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} 已复制`);
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
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />返回</Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">付款</h1>
          <p className="text-sm text-muted-foreground mt-1">
            订单号: <span className="font-mono">{order.orderNumber}</span>
          </p>
        </div>
      </div>

      {/* Payment Amount Summary */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">需付款金额</p>
              <p className="text-3xl font-bold text-primary">RM {remaining.toFixed(2)}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-muted-foreground">订单总额: RM {totalAmount.toFixed(2)}</p>
              {paidAmount > 0 && (
                <p className="text-green-600">已付: RM {paidAmount.toFixed(2)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Selection */}
      <div>
        <h2 className="text-lg font-semibold mb-3">选择付款方式</h2>
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
                    <p className="font-medium">{method.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {method.type === "qr_code" ? "扫码付款" :
                       method.type === "bank_transfer" ? "银行转账" :
                       method.type === "cash" ? "现金付款" : "其他方式"}
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
            <CardTitle>{selectedMethod.name} - 付款详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* QR Code Display */}
            {selectedMethod.type === "qr_code" && selectedMethod.qrImageUrl && (
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <img
                    src={selectedMethod.qrImageUrl}
                    alt={`${selectedMethod.name} QR Code`}
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
                    <ZoomIn className="h-4 w-4 mr-2" />放大 QR Code
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadQr(selectedMethod.qrImageUrl, selectedMethod.name)}>
                    <Download className="h-4 w-4 mr-2" />下载 QR Code
                  </Button>
                </div>
              </div>
            )}

            {/* Bank Transfer Details */}
            {selectedMethod.type === "bank_transfer" && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                {selectedMethod.bankName && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">银行名称</span>
                    <span className="font-medium">{selectedMethod.bankName}</span>
                  </div>
                )}
                {selectedMethod.accountHolder && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">账户持有人</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedMethod.accountHolder}</span>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(selectedMethod.accountHolder, "账户持有人")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {selectedMethod.accountNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">银行账号</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg">{selectedMethod.accountNumber}</span>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(selectedMethod.accountNumber, "银行账号")}>
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
                  <strong>付款说明:</strong> {selectedMethod.paymentInstruction}
                </p>
              </div>
            )}

            {/* Upload Payment Proof */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-medium">上传付款凭证</h3>
              <p className="text-sm text-muted-foreground">
                请在付款后截图或保留收据，并上传以便商家核对。
              </p>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer">
                  <Button variant="outline" asChild>
                    <span><Upload className="h-4 w-4 mr-2" />选择图片</span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                </label>
                {receiptPreview && (
                  <img src={receiptPreview} alt="Receipt Preview" className="h-20 w-20 rounded border object-cover" />
                )}
              </div>
              {receiptFile && (
                <Button
                  onClick={handleUploadReceipt}
                  disabled={uploadReceiptMutation.isPending}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {uploadReceiptMutation.isPending ? "上传中..." : "确认上传凭证"}
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
            <DialogTitle>{selectedMethod?.name} QR Code</DialogTitle>
          </DialogHeader>
          {selectedMethod?.qrImageUrl && (
            <div className="flex flex-col items-center gap-3">
              <img src={selectedMethod.qrImageUrl} alt="QR Code" className="max-w-full rounded-lg" />
              <Button variant="outline" size="sm" onClick={() => downloadQr(selectedMethod.qrImageUrl, selectedMethod.name)}>
                <Download className="h-4 w-4 mr-2" />下载 QR Code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer notice */}
      <div className="text-center text-sm text-muted-foreground py-4 border-t">
        请在汇款后，截图或保留收据并发送给我们，以便核对。谢谢！
      </div>
    </div>
  );
}
