import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, GripVertical, ArrowUp, ArrowDown } from "lucide-react";

type FormState = {
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  showInStore: boolean;
  sortOrder: number;
  imageUrl: string;
  iconUrl: string;
  status: "active" | "inactive";
};

const EMPTY_FORM: FormState = {
  nameZh: "", nameEn: "", descZh: "", descEn: "",
  showInStore: true, sortOrder: 0, imageUrl: "", iconUrl: "", status: "active",
};

export default function Categories() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const utils = trpc.useUtils();
  const { translate, lang } = useI18n();

  const { data: categories, isLoading } = trpc.categories.list.useQuery();

  const createMutation = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.invalidate();
      toast.success(translate("分类创建成功", "Category created successfully"));
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    },
    onError: (e) => toast.error(translate(`创建失败: ${e.message}`, `Failed to create: ${e.message}`)),
  });

  const updateMutation = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.invalidate();
      toast.success(translate("分类更新成功", "Category updated successfully"));
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    },
    onError: (e) => toast.error(translate(`更新失败: ${e.message}`, `Failed to update: ${e.message}`)),
  });

  const deleteMutation = trpc.categories.delete.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        utils.categories.invalidate();
        toast.success(translate("分类已删除", "Category deleted"));
      } else {
        toast.error(data.reason || translate("删除失败", "Failed to delete"));
      }
    },
    onError: (e) => toast.error(translate(`删除失败: ${e.message}`, `Failed to delete: ${e.message}`)),
  });

  const reorderMutation = trpc.categories.reorder.useMutation({
    onSuccess: () => {
      utils.categories.invalidate();
    },
  });

  function openEdit(cat: any) {
    setEditingId(cat.id);
    setForm({
      nameZh: cat.nameZh || "",
      nameEn: cat.nameEn || "",
      descZh: cat.descZh || "",
      descEn: cat.descEn || "",
      showInStore: cat.showInStore ?? true,
      sortOrder: cat.sortOrder ?? 0,
      imageUrl: cat.imageUrl || "",
      iconUrl: cat.iconUrl || "",
      status: cat.status || "active",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.nameZh.trim()) {
      toast.error(translate("请输入中文名称", "Please enter Chinese name"));
      return;
    }
    if (!form.nameEn.trim()) {
      toast.error(translate("请输入英文名称", "Please enter English name"));
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  function moveCategory(index: number, direction: "up" | "down") {
    if (!categories) return;
    const newOrder = [...categories];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newOrder.length) return;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    reorderMutation.mutate({
      items: newOrder.map((c, i) => ({ id: c.id, sortOrder: i })),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("分类管理", "Category Management")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{translate("管理商品分类，支持中英文双语、排序与商城显示控制", "Manage product categories, supporting Chinese and English, sorting, and store display control")}</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          {translate("新增分类", "Add Category")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{translate("排序", "Sort")}</TableHead>
                <TableHead>{translate("中文名称", "Chinese Name")}</TableHead>
                <TableHead>{translate("英文名称", "English Name")}</TableHead>
                <TableHead>{translate("描述", "Description")}</TableHead>
                <TableHead>{translate("状态", "Status")}</TableHead>
                <TableHead>{translate("商城显示", "Show in Store")}</TableHead>
                <TableHead className="text-right">{translate("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
              ) : categories?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{translate("暂无分类", "No categories yet")}</TableCell></TableRow>
              ) : categories?.map((c, index) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveCategory(index, "up")} disabled={index === 0}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveCategory(index, "down")} disabled={index === (categories?.length ?? 0) - 1}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{lang === "zh" ? c.nameZh : c.nameEn || c.nameZh}</TableCell>
                  <TableCell>{lang === "en" ? c.nameEn : c.nameZh || c.nameEn}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{lang === "zh" ? (c.descZh || "—") : (c.descEn || "—")}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : "outline"}>
                      {c.status === "active" ? translate("启用", "Active") : translate("停用", "Inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.showInStore ? "default" : "outline"}>
                      {c.showInStore ? translate("显示", "Show") : translate("隐藏", "Hide")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(translate("确定删除分类「{name}」吗？", "Are you sure you want to delete category \'{name}\'?", { name: lang === "zh" ? c.nameZh : c.nameEn || c.nameZh }))) {
                          deleteMutation.mutate({ id: c.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
            <DialogTitle>{editingId ? translate("编辑分类", "Edit Category") : translate("新增分类", "Add Category")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{translate("中文名称", "Chinese Name")} *</Label>
                <Input value={form.nameZh} onChange={(e) => setForm({ ...form, nameZh: e.target.value })} placeholder={translate("花类", "Flowers")} />
              </div>
              <div>
                <Label>{translate("英文名称", "English Name")} *</Label>
                <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder={translate("Flowers", "Flowers")} />
              </div>
            </div>

            <div>
              <Label>{translate("中文描述", "Chinese Description")}</Label>
              <Textarea value={form.descZh} onChange={(e) => setForm({ ...form, descZh: e.target.value })} rows={2} placeholder={translate("分类描述（可选）", "Category description (optional)")} />
            </div>

            <div>
              <Label>{translate("英文描述", "English Description")}</Label>
              <Textarea value={form.descEn} onChange={(e) => setForm({ ...form, descEn: e.target.value })} rows={2} placeholder={translate("Category description (optional)", "Category description (optional)")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>{translate("商城显示", "Show in Store")}</Label>
                  <p className="text-xs text-muted-foreground">{translate("在客户端商城展示此分类", "Display this category in the client store")}</p>
                </div>
                <Switch checked={form.showInStore} onCheckedChange={(v) => setForm({ ...form, showInStore: v })} />
              </div>
              <div>
                <Label>{translate("排序权重", "Sort Weight")}</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            {editingId && (
              <div>
                <Label>{translate("状态", "Status")}</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.status === "active"}
                    onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })}
                  />
                  <span className="text-sm">{form.status === "active" ? translate("启用", "Active") : translate("停用", "Inactive")}</span>
                </div>
              </div>
            )}
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
