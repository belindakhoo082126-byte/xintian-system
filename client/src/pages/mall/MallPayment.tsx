import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { QrCode, University, Banknote, Package, Copy, ZoomIn, Download, Upload, CheckCircle, ChevronLeft } from "lucide-react";

const TYPE_ICONS: Record<string, any> = {
  qr_code: QrCode,
  bank_transfer: University,
  cash: Banknote,
  other: Package,
};

// Unified payment info image — shown for all payment methods
const UNIFIED_PAYMENT_IMAGE = "/manus-storage/pasted_file_BhQwTf_image_dcbe7a31.png";

// Method-specific payment instructions (keyed by payment method name)
const PAYMENT_INSTRUCTIONS: Record<string, string> = {
  "Touch 'n Go eWallet QR": "请打开 Touch 'n Go eWallet，扫描二维码完成付款。\n汇款完成后，请截图并上传付款凭证。",
  "DuitNow QR": "请使用任何支援 DuitNow QR 的银行或电子钱包扫描二维码完成付款。\n汇款完成后，请截图并上传付款凭证。",
  "Public Bank Transfer": "请汇款至以下 Public Bank 户口。\n汇款完成后，请截图并上传付款凭证。",
};

function getPaymentInstruction(method: any): string {
  const instr = PAYMENT_INSTRUCTIONS[method.name];
  if (instr) return instr;
  if (method.paymentInstruction) return method.paymentInstruction;
  return "汇款完成后，请截图并上传付款凭证。";
}

export default function MallPayment() {
  const [location] = useLocation();
  const orderNumber = location.split("/").pop() || "";
  const contactNumber = new URLSearchParams(window.location.search).get("phone") || "";
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [qrZoomOpen, setQrZoomOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const utils = trpc.useUtils();

  const uploadReceiptMutation = trpc.mall.uploadReceipt.useMutation({
    onSuccess: () => {
      utils.mall.queryOrder.invalidate();
      setUploaded(true);
      setReceiptFile(null);
      setReceiptPreview("");
      toast.success("付款凭证已上传，等待商家确认");
    },
    onError: (e) => toast.error(`上传失败: ${e.message}`),
  });

  const { data: order, isLoading } = trpc.mall.queryOrder.useQuery({
    orderNumber,
    contactNumber,
  });
  const { data: paymentMethods } = trpc.paymentMethods.listEnabled.useQuery();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Package className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">订单不存在</p>
        <Link href="/mall"><Button>返回商城</Button></Link>
      </div>
    );
  }

  const totalAmount = Number(order.totalAmount);
  const paidAmount = Number(order.paidAmount || 0);
  const remaining = totalAmount - paidAmount;
  const receiptAlreadyUploaded = order.physicalStatus === "receipt_uploaded";
  const canUploadReceipt = ["pending", "receipt_uploaded", "partial_payment"].includes(order.physicalStatus ?? "");

  async function handleUploadReceipt() {
    if (!selectedMethod) {
      toast.error("请选择付款方式");
      return;
    }
    if (!receiptFile) {
      toast.error("请选择付款凭证图片");
      return;
    }
    setUploading(true);
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
              orderNumber,
              contactNumber,
              receiptUrl: data.url,
              paymentMethodId: selectedMethod.id,
            });
          } else {
            toast.error("文件上传失败");
          }
      } catch {
        toast.error("上传失败，请重试");
      }
      setUploading(false);
    };
    reader.readAsDataURL(receiptFile);
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
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/mall"><Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button></Link>
          <h1 className="font-semibold text-lg">付款</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Payment Amount Summary */}
        <Card className="border-2 border-[#2d6a4f]/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">需付款金额</p>
                <p className="text-3xl font-bold text-[#2d6a4f]">RM {remaining.toFixed(2)}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-muted-foreground">订单号: {order.orderNumber}</p>
                <p className="text-muted-foreground">订单总额: RM {totalAmount.toFixed(2)}</p>
                {paidAmount > 0 && <p className="text-green-600">已付: RM {paidAmount.toFixed(2)}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {(uploaded || receiptAlreadyUploaded) && (
          <Card className="border-green-500 bg-green-50">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">付款凭证已上传</p>
                <p className="text-sm text-green-700">商家确认后订单将进入待包货状态</p>
              </div>
            </CardContent>
          </Card>
        )}

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
                  className={`cursor-pointer transition-all ${isSelected ? "border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20" : "hover:border-[#2d6a4f]/50"}`}
                  onClick={() => setSelectedMethod(method)}
                >
                  <CardContent className="flex items-center gap-3 pt-4">
                    <div className={`p-2 rounded-lg ${isSelected ? "bg-[#2d6a4f] text-white" : "bg-muted"}`}>
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
                    {isSelected && <CheckCircle className="h-5 w-5 text-[#2d6a4f]" />}
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
              {/* Unified Payment Info Image — shown for ALL payment methods */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <img src={UNIFIED_PAYMENT_IMAGE} alt="汇款资料" className="w-full max-w-md rounded-lg border-2 border-[#2d6a4f]/20" />
                  <Button variant="outline" size="sm" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setQrZoomOpen(true)}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setQrZoomOpen(true)}>
                    <ZoomIn className="h-4 w-4 mr-2" />放大图片
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadQr(UNIFIED_PAYMENT_IMAGE, "payment-info")}>
                    <Download className="h-4 w-4 mr-2" />下载图片
                  </Button>
                </div>
              </div>

              {/* Method-specific Payment Instruction */}
              <div className="p-4 border rounded-lg bg-blue-50">
                <p className="text-sm whitespace-pre-line"><strong>付款说明:</strong> {getPaymentInstruction(selectedMethod)}</p>
              </div>

              {/* Upload Payment Proof */}
              {canUploadReceipt && !uploaded && (
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="font-medium">上传付款凭证</h3>
                  <p className="text-sm text-muted-foreground">请在付款后截图或保留收据，并上传以便商家核对。</p>
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
                    <Button onClick={handleUploadReceipt} disabled={uploading} className="w-full bg-[#2d6a4f] hover:bg-[#40916c]">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {uploading ? "上传中..." : "确认上传凭证"}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Info Zoom Dialog */}
        <Dialog open={qrZoomOpen} onOpenChange={setQrZoomOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>汇款资料</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3">
              <img src={UNIFIED_PAYMENT_IMAGE} alt="汇款资料" className="max-w-full rounded-lg" />
              <Button variant="outline" size="sm" onClick={() => downloadQr(UNIFIED_PAYMENT_IMAGE, "payment-info")}>
                <Download className="h-4 w-4 mr-2" />下载图片
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="text-center text-sm text-muted-foreground py-4 border-t">
          <Link href="/mall" className="text-[#2d6a4f] hover:underline">返回商城首页</Link>
        </div>
      </main>
    </div>
  );
}
