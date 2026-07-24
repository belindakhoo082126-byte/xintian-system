import { useState } from "react";
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

  const { data: categories, isLoading } = trpc.categories.list.useQuery();

  const createMutation = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.invalidate();
      toast.success("分类创建成功");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    },
    onError: (e) => toast.error(`创建失败: ${e.message}`),
  });

  const updateMutation = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.invalidate();
      toast.success("分类更新成功");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const deleteMutation = trpc.categories.delete.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        utils.categories.invalidate();
        toast.success("分类已删除");
      } else {
        toast.error(data.reason || "删除失败");
      }
    },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
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
      toast.error("请输入中文名称");
      return;
    }
    if (!form.nameEn.trim()) {
      toast.error("请输入英文名称");
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
          <h1 className="text-2xl font-semibold tracking-tight">分类管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理商品分类，支持中英文双语、排序与商城显示控制</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          新增分类
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">排序</TableHead>
                <TableHead>中文名称</TableHead>
                <TableHead>英文名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>商城显示</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : categories?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">暂无分类</TableCell></TableRow>
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
                  <TableCell className="font-medium">{c.nameZh}</TableCell>
                  <TableCell>{c.nameEn}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{c.descZh || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : "outline"}>
                      {c.status === "active" ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.showInStore ? "default" : "outline"}>
                      {c.showInStore ? "显示" : "隐藏"}
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
                        if (confirm(`确定删除分类「${c.nameZh}」吗？`)) {
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
            <DialogTitle>{editingId ? "编辑分类" : "新增分类"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>中文名称 *</Label>
                <Input value={form.nameZh} onChange={(e) => setForm({ ...form, nameZh: e.target.value })} placeholder="花类" />
              </div>
              <div>
                <Label>英文名称 *</Label>
                <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="Flowers" />
              </div>
            </div>

            <div>
              <Label>中文描述</Label>
              <Textarea value={form.descZh} onChange={(e) => setForm({ ...form, descZh: e.target.value })} rows={2} placeholder="分类描述（可选）" />
            </div>

            <div>
              <Label>英文描述</Label>
              <Textarea value={form.descEn} onChange={(e) => setForm({ ...form, descEn: e.target.value })} rows={2} placeholder="Category description (optional)" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>商城显示</Label>
                  <p className="text-xs text-muted-foreground">在客户端商城展示此分类</p>
                </div>
                <Switch checked={form.showInStore} onCheckedChange={(v) => setForm({ ...form, showInStore: v })} />
              </div>
              <div>
                <Label>排序权重</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            {editingId && (
              <div>
                <Label>状态</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.status === "active"}
                    onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })}
                  />
                  <span className="text-sm">{form.status === "active" ? "启用" : "停用"}</span>
                </div>
              </div>
            )}
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
