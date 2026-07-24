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
import { useI18n } from "@/contexts/I18nContext";

export default function Suppliers() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { lang, translate } = useI18n();

  const { data: suppliers, isLoading } = trpc.suppliers.list.useQuery();

  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => { utils.suppliers.invalidate(); toast.success(translate("供应商创建成功", "Supplier created successfully")); setDialogOpen(false); resetForm(); },
    onError: (e) => toast.error(translate("创建失败: {message}", "Failed to create: {message}", { message: e.message })),
  });

  const updateMutation = trpc.suppliers.update.useMutation({
    onSuccess: () => { utils.suppliers.invalidate(); toast.success(translate("供应商更新成功", "Supplier updated successfully")); setDialogOpen(false); resetForm(); },
    onError: (e) => toast.error(translate("更新失败: {message}", "Failed to update: {message}", { message: e.message })),
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
    if (!form.name.trim()) { toast.error(translate("请输入供应商名称", "Please enter supplier name")); return; }
    if (editingId) { updateMutation.mutate({ id: editingId, ...form }); }
    else { createMutation.mutate(form); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("供应商管理", "Supplier Management")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{translate("管理进货供应商，不同厂家不同成本", "Manage procurement suppliers, different manufacturers, different costs")}</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />{translate("新增供应商", "Add Supplier")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate("供应商名称", "Supplier Name")}</TableHead>
                <TableHead>{translate("联系人", "Contact Person")}</TableHead>
                <TableHead>{translate("电话", "Phone")}</TableHead>
                <TableHead>{translate("状态", "Status")}</TableHead>
                <TableHead className="text-right">{translate("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
              ) : suppliers?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{translate("暂无供应商", "No suppliers yet")}</TableCell></TableRow>
              ) : suppliers?.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contactPerson || "—"}</TableCell>
                  <TableCell>{s.phoneNumber || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? "default" : "outline"}>{s.isActive ? translate("活跃", "Active") : translate("停用", "Disabled")}</Badge>
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
            <DialogTitle>{editingId ? translate("编辑供应商", "Edit Supplier") : translate("新增供应商", "Add Supplier")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("供应商名称 *", "Supplier Name *")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{translate("联系人", "Contact Person")}</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div>
                <Label>{translate("电话号码", "Phone Number")}</Label>
                <Input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{translate("邮箱", "Email")}</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{translate("地址", "Address")}</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>{translate("银行账号", "Bank Account")}</Label>
              <Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
            </div>
            <div>
              <Label>{translate("备注", "Notes")}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? translate("保存", "Save") : translate("创建", "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
