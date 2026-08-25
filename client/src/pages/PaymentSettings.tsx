import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, QrCode, University, Banknote, Package, Upload, Copy, ZoomIn, Download } from "lucide-react";

const TYPE_ICONS: Record<string, any> = {
  qr_code: QrCode,
  bank_transfer: University,
  cash: Banknote,
  other: Package,
};

const TYPE_LABELS: Record<string, string> = {
  qr_code: "TNG",
  bank_transfer: "Online Transfer",
  cash: "现金",
  other: "其他（旧资料）",
};

export default function PaymentSettings() {
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState("");
  const [form, setForm] = useState<any>({
    name: "",
    type: "qr_code",
    qrImageUrl: "",
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    paymentInstruction: "",
    remark: "",
    isEnabled: true,
    displayOrder: 0,
  });
  const utils = trpc.useUtils();

  const { data: methods, isLoading } = trpc.paymentMethods.list.useQuery();

  const createMutation = trpc.paymentMethods.create.useMutation({
    onSuccess: () => {
      utils.paymentMethods.invalidate();
      toast.success("付款方式已创建");
      setEditOpen(false);
    },
    onError: (e) => toast.error(`创建失败: ${e.message}`),
  });

  const updateMutation = trpc.paymentMethods.update.useMutation({
    onSuccess: () => {
      utils.paymentMethods.invalidate();
      toast.success("付款方式已更新");
      setEditOpen(false);
    },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const deleteMutation = trpc.paymentMethods.delete.useMutation({
    onSuccess: () => {
      utils.paymentMethods.invalidate();
      toast.success("付款方式已删除");
    },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
  });

  function openCreate() {
    setEditingId(null);
    setForm({
      name: "",
      type: "qr_code",
      qrImageUrl: "",
      bankName: "",
      accountHolder: "",
      accountNumber: "",
      paymentInstruction: "",
      remark: "",
      isEnabled: true,
      displayOrder: (methods?.length || 0) + 1,
    });
    setEditOpen(true);
  }

  function openEdit(method: any) {
    setEditingId(method.id);
    setForm({
      name: method.name,
      type: method.type,
      qrImageUrl: method.qrImageUrl || "",
      bankName: method.bankName || "",
      accountHolder: method.accountHolder || "",
      accountNumber: method.accountNumber || "",
      paymentInstruction: method.paymentInstruction || "",
      remark: method.remark || "",
      isEnabled: method.isEnabled,
      displayOrder: method.displayOrder,
    });
    setEditOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("请输入付款方式名称");
      return;
    }
    const data: any = { ...form };
    // Clean up empty strings to null for optional fields
    if (!data.qrImageUrl) delete data.qrImageUrl;
    if (!data.bankName) data.bankName = null;
    if (!data.accountHolder) data.accountHolder = null;
    if (!data.accountNumber) data.accountNumber = null;
    if (!data.paymentInstruction) data.paymentInstruction = null;
    if (!data.remark) data.remark = null;

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleDelete(id: number) {
    if (confirm("确定要删除此付款方式吗？旧订单记录不受影响。")) {
      deleteMutation.mutate({ id });
    }
  }

  async function handleQrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: base64, filename: file.name }),
        });
        if (res.ok) {
          const data = await res.json();
          setForm((prev: any) => ({ ...prev, qrImageUrl: data.url }));
          toast.success("QR 图片已上传");
        } else {
          toast.error("上传失败");
        }
      } catch {
        toast.error("上传失败，请重试");
      }
    };
    reader.readAsDataURL(file);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">付款设定</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理付款方式 — 新增、修改、停用均不影响旧订单记录
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新增付款方式
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">排序</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>QR / 银行资料</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : methods?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">暂无付款方式</TableCell></TableRow>
              ) : methods?.map((m: any) => {
                const Icon = TYPE_ICONS[m.type] || Package;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{m.displayOrder}</TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {TYPE_LABELS[m.type]}
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.type === "qr_code" && m.qrImageUrl ? (
                        <div className="flex items-center gap-2">
                          <img src={m.qrImageUrl} alt="QR" className="h-10 w-10 rounded border" />
                          <Button variant="ghost" size="sm" onClick={() => { setQrPreviewUrl(m.qrImageUrl); setQrPreviewOpen(true); }}>
                            <ZoomIn className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : m.type === "bank_transfer" ? (
                        <div className="text-sm">
                          <span className="text-muted-foreground">{m.bankName}</span>
                          {" · "}
                          <span className="font-mono">{m.accountNumber}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.isEnabled ? "default" : "outline"}>
                        {m.isEnabled ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑付款方式" : "新增付款方式"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>付款方式名称 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p: any) => ({ ...p, name: e.target.value }))}
                placeholder="现金、TNG 或 Online Transfer"
              />
            </div>

            <div>
              <Label>类型</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p: any) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qr_code">TNG</SelectItem>
                  <SelectItem value="bank_transfer">Online Transfer</SelectItem>
                  <SelectItem value="cash">现金</SelectItem>
                  <SelectItem value="other">其他（旧资料）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.type === "qr_code" && (
              <div>
                <Label>QR Code 图片</Label>
                <div className="flex items-center gap-3 mt-2">
                  {form.qrImageUrl && (
                    <img src={form.qrImageUrl} alt="QR Preview" className="h-20 w-20 rounded border" />
                  )}
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild>
                        <span><Upload className="h-4 w-4 mr-2" />上传 QR 图片</span>
                      </Button>
                      <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
                    </label>
                    {form.qrImageUrl && (
                      <Button variant="ghost" size="sm" onClick={() => setForm((p: any) => ({ ...p, qrImageUrl: "" }))}>
                        移除图片
                      </Button>
                    )}
                  </div>
                </div>
                <Input
                  className="mt-2"
                  value={form.qrImageUrl}
                  onChange={(e) => setForm((p: any) => ({ ...p, qrImageUrl: e.target.value }))}
                  placeholder="或直接输入图片 URL"
                />
              </div>
            )}

            {form.type === "bank_transfer" && (
              <>
                <div>
                  <Label>银行名称</Label>
                  <Input
                    value={form.bankName}
                    onChange={(e) => setForm((p: any) => ({ ...p, bankName: e.target.value }))}
                    placeholder="例如: Public Bank"
                  />
                </div>
                <div>
                  <Label>账户持有人</Label>
                  <Input
                    value={form.accountHolder}
                    onChange={(e) => setForm((p: any) => ({ ...p, accountHolder: e.target.value }))}
                    placeholder="例如: ECOLAND NURSERY"
                  />
                </div>
                <div>
                  <Label>银行账号</Label>
                  <Input
                    value={form.accountNumber}
                    onChange={(e) => setForm((p: any) => ({ ...p, accountNumber: e.target.value }))}
                    placeholder="例如: 3825375502"
                  />
                </div>
              </>
            )}

            <div>
              <Label>付款说明</Label>
              <Textarea
                value={form.paymentInstruction}
                onChange={(e) => setForm((p: any) => ({ ...p, paymentInstruction: e.target.value }))}
                placeholder="客户付款时显示的说明文字"
                rows={3}
              />
            </div>

            <div>
              <Label>备注 (内部)</Label>
              <Textarea
                value={form.remark}
                onChange={(e) => setForm((p: any) => ({ ...p, remark: e.target.value }))}
                placeholder="内部备注，客户不可见"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isEnabled}
                  onCheckedChange={(v) => setForm((p: any) => ({ ...p, isEnabled: v }))}
                />
                <Label>启用</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label>显示排序</Label>
                <Input
                  type="number"
                  className="w-20"
                  value={form.displayOrder}
                  onChange={(e) => setForm((p: any) => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Preview Dialog */}
      <Dialog open={qrPreviewOpen} onOpenChange={setQrPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code 预览</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <img src={qrPreviewUrl} alt="QR Code" className="max-w-full rounded-lg border" />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadQr(qrPreviewUrl, "QR")}>
                <Download className="h-4 w-4 mr-2" />下载
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(qrPreviewUrl, "QR URL")}>
                <Copy className="h-4 w-4 mr-2" />复制 URL
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
