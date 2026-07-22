import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@//_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Edit, Eye, Ban, Building2, Banknote } from "lucide-react";
import { toast } from "sonner";

export default function SuppliersV2() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    phoneNumber: "",
    email: "",
    address: "",
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    remark: "",
  });

  const { data: suppliers, isLoading } = trpc.suppliersV2.list.useQuery({ search: search || undefined });

  const createMutation = trpc.suppliersV2.create.useMutation({
    onSuccess: () => { toast.success("供应商创建成功"); setShowAddDialog(false); resetForm(); utils.suppliersV2.list.invalidate(); },
    onError: (e: any) => toast.error(`创建失败: ${e.message}`),
  });

  const updateMutation = trpc.suppliersV2.update.useMutation({
    onSuccess: () => { toast.success("供应商更新成功"); setEditingId(null); setShowAddDialog(false); resetForm(); utils.suppliersV2.list.invalidate(); },
    onError: (e: any) => toast.error(`更新失败: ${e.message}`),
  });

  const deactivateMutation = trpc.suppliersV2.deactivate.useMutation({
    onSuccess: () => { toast.success("供应商已停用"); utils.suppliersV2.list.invalidate(); },
    onError: (e: any) => toast.error(`停用失败: ${e.message}`),
  });

  function resetForm() {
    setFormData({ name: "", contactPerson: "", phoneNumber: "", email: "", address: "", bankName: "", bankAccountName: "", bankAccountNumber: "", remark: "" });
  }

  function openEdit(s: any) {
    setEditingId(s.id);
    setFormData({
      name: s.name || "",
      contactPerson: s.contactPerson || "",
      phoneNumber: s.phoneNumber || "",
      email: s.email || "",
      address: s.address || "",
      bankName: s.bankName || "",
      bankAccountName: s.bankAccountName || "",
      bankAccountNumber: s.bankAccountNumber || "",
      remark: s.remark || "",
    });
    setShowAddDialog(true);
  }

  function handleSubmit() {
    if (!formData.name.trim()) { toast.error("供应商名称为必填"); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">供应商管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理供应商资料、银行信息及历史进货</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingId(null); setShowAddDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> 新增供应商
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索供应商名称、编号、联系人..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>供应商编号</TableHead>
              <TableHead>供应商名称</TableHead>
              <TableHead>联系人</TableHead>
              <TableHead>电话</TableHead>
              <TableHead>银行名称</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
            ) : !suppliers?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无供应商</TableCell></TableRow>
            ) : suppliers.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-sm">{s.supplierCode || "-"}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.contactPerson || "-"}</TableCell>
                <TableCell>{s.phoneNumber || "-"}</TableCell>
                <TableCell>{s.bankName || "-"}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "active" || s.isActive ? "default" : "secondary"}>
                    {s.status === "active" || s.isActive ? "启用" : "停用"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDetailId(s.id)} title="查看">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="编辑">
                      <Edit className="h-4 w-4" />
                    </Button>
                    {(s.status === "active" || s.isActive) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("确定停用此供应商？已有进货纪录的供应商只能停用，不能删除。")) {
                            deactivateMutation.mutate({ id: s.id });
                          }
                        }}
                        title="停用"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑供应商" : "新增供应商"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> 基本资料</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>供应商名称 *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="必填" />
                </div>
                <div>
                  <Label>联系人</Label>
                  <Input value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} />
                </div>
                <div>
                  <Label>电话号码</Label>
                  <Input value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>邮箱</Label>
                  <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>地址</Label>
                  <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>备注</Label>
                  <Textarea value={formData.remark} onChange={(e) => setFormData({ ...formData, remark: e.target.value })} rows={2} />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Banknote className="h-4 w-4" /> 银行资料</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>银行名称</Label>
                  <Input value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} placeholder="如：Maybank / Public Bank" />
                </div>
                <div>
                  <Label>银行户口名称</Label>
                  <Input value={formData.bankAccountName} onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })} />
                </div>
                <div>
                  <Label>银行户口号码</Label>
                  <Input value={formData.bankAccountNumber} onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); setEditingId(null); }}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <SupplierDetailDialog supplierId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function SupplierDetailDialog({ supplierId, onClose }: { supplierId: number | null; onClose: () => void }) {
  const { data: supplier, isLoading } = trpc.suppliersV2.getById.useQuery(
    { id: supplierId! },
    { enabled: !!supplierId }
  );

  if (!supplierId) return null;

  return (
    <Dialog open={!!supplierId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>供应商详情</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">加载中...</div>
        ) : supplier ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> 基本资料</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">供应商编号：</span>{(supplier as any).supplierCode || "-"}</div>
                  <div><span className="text-muted-foreground">名称：</span>{supplier.name}</div>
                  <div><span className="text-muted-foreground">联系人：</span>{supplier.contactPerson || "-"}</div>
                  <div><span className="text-muted-foreground">电话：</span>{supplier.phoneNumber || "-"}</div>
                  <div><span className="text-muted-foreground">邮箱：</span>{supplier.email || "-"}</div>
                  <div><span className="text-muted-foreground">地址：</span>{supplier.address || "-"}</div>
                  <div><span className="text-muted-foreground">备注：</span>{(supplier as any).remark || supplier.notes || "-"}</div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Banknote className="h-4 w-4" /> 银行资料</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">银行名称：</span>{(supplier as any).bankName || "-"}</div>
                  <div><span className="text-muted-foreground">户口名称：</span>{(supplier as any).bankAccountName || "-"}</div>
                  <div><span className="text-muted-foreground">户口号码：</span>{(supplier as any).bankAccountNumber || "-"}</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">历史进货</h3>
              <Card className="p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>进货单号</TableHead>
                      <TableHead>供应商单号</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">总数量</TableHead>
                      <TableHead className="text-right">总金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!((supplier as any).purchaseHistory?.length) ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">暂无进货记录</TableCell></TableRow>
                    ) : (supplier as any).purchaseHistory.map((po: any) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-mono text-sm">{po.purchaseOrderNo || po.poNumber}</TableCell>
                        <TableCell>{po.supplierDocumentNo || "-"}</TableCell>
                        <TableCell>{po.purchaseDate ? new Date(po.purchaseDate).toLocaleDateString() : (po.createdAt ? new Date(po.createdAt).toLocaleDateString() : "-")}</TableCell>
                        <TableCell>
                          <Badge variant={po.status === "confirmed" ? "default" : po.status === "draft" ? "secondary" : "destructive"}>
                            {po.status === "confirmed" ? "已确认" : po.status === "draft" ? "草稿" : po.status === "cancelled" ? "已取消" : po.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{po.totalQuantity || "-"}</TableCell>
                        <TableCell className="text-right">RM {Number(po.totalAmount).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
