import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Truck, Plus, Edit2, Phone, MapPin } from "lucide-react";

export default function Suppliers() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: suppliers, isLoading } = trpc.suppliers.list.useQuery();

  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => { utils.suppliers.invalidate(); toast.success("供应商创建成功"); setDialogOpen(false); resetForm(); },
    onError: (e) => toast.error(`创建失败: ${e.message}`),
  });

  const updateMutation = trpc.suppliers.update.useMutation({
    onSuccess: () => { utils.suppliers.invalidate(); toast.success("供应商更新成功"); setDialogOpen(false); resetForm(); },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const [form, setForm] = useState({
    name: "", contactPerson: "", phoneNumber: "", email: "", address: "", bankAccount: "", notes: "",
  });

  function resetForm() {
    setForm({ name: "", contactPerson: "", phoneNumber: "", email: "", address: "", bankAccount: "", notes: "" });
    setEditingId(null);
  }

  function openEdit(s: any) {
    setEditingId(s.id);
    setForm({
      name: s.name || "", contactPerson: s.contactPerson || "", phoneNumber: s.phoneNumber || "",
      email: s.email || "", address: s.address || "", bankAccount: s.bankAccount || "", notes: s.notes || "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast.error("请输入供应商名称"); return; }
    if (editingId) { updateMutation.mutate({ id: editingId, ...form }); }
    else { createMutation.mutate(form); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">供应商管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理进货供应商，不同厂家不同成本</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />新增供应商
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>供应商名称</TableHead>
                <TableHead>联系人</TableHead>
                <TableHead>电话</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : suppliers?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">暂无供应商</TableCell></TableRow>
              ) : suppliers?.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contactPerson || "—"}</TableCell>
                  <TableCell>{s.phoneNumber || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? "default" : "outline"}>{s.isActive ? "活跃" : "停用"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑供应商" : "新增供应商"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>供应商名称 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>联系人</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div>
                <Label>电话号码</Label>
                <Input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>邮箱</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>地址</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>银行账号</Label>
              <Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
            </div>
            <div>
              <Label>备注</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
