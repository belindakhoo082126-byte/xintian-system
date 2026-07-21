import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Package, Plus, Edit2, Trash2, Search } from "lucide-react";

const PRODUCT_TYPES = [
  { value: "physical", label: "普通实体商品" },
  { value: "membership", label: "会员商品" },
  { value: "virtual", label: "虚拟商品" },
  { value: "gift", label: "赠品" },
];

const TYPE_BADGES: Record<string, string> = {
  physical: "bg-blue-100 text-blue-700",
  membership: "bg-purple-100 text-purple-700",
  virtual: "bg-gray-100 text-gray-700",
  gift: "bg-orange-100 text-orange-700",
};

export default function Products() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: products, isLoading } = trpc.products.list.useQuery({
    search: search || undefined,
    type: typeFilter !== "all" ? (typeFilter as any) : undefined,
  });

  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      utils.products.invalidate();
      toast.success("商品创建成功");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(`创建失败: ${e.message}`),
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.invalidate();
      toast.success("商品更新成功");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      utils.products.invalidate();
      toast.success("商品已删除");
    },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
  });

  const [form, setForm] = useState({
    name: "",
    type: "physical" as "physical" | "membership" | "virtual" | "gift",
    description: "",
    coverImageUrl: "",
    cost: "",
    regularPrice: "",
    memberPrice: "",
    originalPrice: "",
    specialPrice: "",
    weightKg: "",
    stockQuantity: 0,
    isPreOrder: false,
    isListed: true,
    isSpecialItem: false,
    allowFreeShipping: true,
    keywords: "",
    videoUrl: "",
    membershipIntro: "",
    telegramFlowLink: "",
    facebookFlowId: "",
    allowStandalonePurchase: true,
    allowMixedCheckout: true,
  });

  function resetForm() {
    setForm({
      name: "", type: "physical", description: "", coverImageUrl: "",
      cost: "", regularPrice: "", memberPrice: "", originalPrice: "", specialPrice: "",
      weightKg: "", stockQuantity: 0, isPreOrder: false, isListed: true,
      isSpecialItem: false, allowFreeShipping: true, keywords: "", videoUrl: "",
      membershipIntro: "", telegramFlowLink: "", facebookFlowId: "",
      allowStandalonePurchase: true, allowMixedCheckout: true,
    });
    setEditingId(null);
  }

  function openEdit(product: any) {
    setEditingId(product.id);
    setForm({
      name: product.name || "",
      type: product.type,
      description: product.description || "",
      coverImageUrl: product.coverImageUrl || "",
      cost: product.cost || "",
      regularPrice: product.regularPrice || "",
      memberPrice: product.memberPrice || "",
      originalPrice: product.originalPrice || "",
      specialPrice: product.specialPrice || "",
      weightKg: product.weightKg || "",
      stockQuantity: product.stockQuantity || 0,
      isPreOrder: product.isPreOrder || false,
      isListed: product.isListed ?? true,
      isSpecialItem: product.isSpecialItem || false,
      allowFreeShipping: product.allowFreeShipping ?? true,
      keywords: product.keywords || "",
      videoUrl: product.videoUrl || "",
      membershipIntro: product.membershipIntro || "",
      telegramFlowLink: product.telegramFlowLink || "",
      facebookFlowId: product.facebookFlowId || "",
      allowStandalonePurchase: product.allowStandalonePurchase ?? true,
      allowMixedCheckout: product.allowMixedCheckout ?? true,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("请输入商品名称");
      return;
    }
    const data: any = { ...form };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  const isMembership = form.type === "membership";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">商品管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理所有商品类型，包括会员商品</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          新增商品
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索商品名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="商品类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {PRODUCT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>价格</TableHead>
                <TableHead>库存</TableHead>
                <TableHead>上架</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : products?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">暂无商品</TableCell></TableRow>
              ) : products?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge className={TYPE_BADGES[p.type]} variant="secondary">
                      {PRODUCT_TYPES.find(t => t.value === p.type)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.type === "membership"
                      ? `RM ${p.regularPrice || "0"}`
                      : `RM ${p.regularPrice || "0"}`
                    }
                  </TableCell>
                  <TableCell>
                    {p.type === "membership" ? "不限" : p.stockQuantity}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.isListed ? "default" : "outline"}>
                      {p.isListed ? "已上架" : "未上架"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`确定删除「${p.name}」吗？`)) {
                          deleteMutation.mutate({ id: p.id });
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑商品" : "新增商品"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>商品名称 *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>商品类型 *</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>商品介绍</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>成本价</Label>
                <Input type="number" placeholder="0.00" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
              <div>
                <Label>{isMembership ? "会员收费金额" : "普通价格"}</Label>
                <Input type="number" placeholder="0.00" value={form.regularPrice} onChange={(e) => setForm({ ...form, regularPrice: e.target.value })} />
              </div>
              <div>
                <Label>会员价格</Label>
                <Input type="number" placeholder="0.00" value={form.memberPrice} onChange={(e) => setForm({ ...form, memberPrice: e.target.value })} disabled={isMembership} />
              </div>
            </div>

            {!isMembership && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>原价</Label>
                  <Input type="number" placeholder="0.00" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
                </div>
                <div>
                  <Label>特价</Label>
                  <Input type="number" placeholder="0.00" value={form.specialPrice} onChange={(e) => setForm({ ...form, specialPrice: e.target.value })} />
                </div>
                <div>
                  <Label>重量 (kg)</Label>
                  <Input type="number" placeholder="0.00" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
                </div>
              </div>
            )}

            {!isMembership && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>库存数量</Label>
                  <Input type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>商品关键词</Label>
                  <Input placeholder="AAB, 菊花..." value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
                </div>
              </div>
            )}

            {/* Membership-specific fields */}
            {isMembership && (
              <div className="space-y-4 p-4 border rounded-lg bg-purple-50/50 dark:bg-purple-950/20">
                <h3 className="font-medium text-sm">会员商品专属设置</h3>
                <div>
                  <Label>会员介绍</Label>
                  <Textarea value={form.membershipIntro} onChange={(e) => setForm({ ...form, membershipIntro: e.target.value })} rows={3} placeholder="详细描述会员权益和福利..." />
                </div>
                <div>
                  <Label>Telegram 会员流程链接</Label>
                  <Input placeholder="https://t.me/..." value={form.telegramFlowLink} onChange={(e) => setForm({ ...form, telegramFlowLink: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label>允许单独购买</Label>
                      <p className="text-xs text-muted-foreground">客户可只购买会员商品</p>
                    </div>
                    <Switch checked={form.allowStandalonePurchase} onCheckedChange={(v) => setForm({ ...form, allowStandalonePurchase: v })} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label>允许混合结账</Label>
                      <p className="text-xs text-muted-foreground">可与普通商品一起结账</p>
                    </div>
                    <Switch checked={form.allowMixedCheckout} onCheckedChange={(v) => setForm({ ...form, allowMixedCheckout: v })} />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>上架商城</Label>
                <Switch checked={form.isListed} onCheckedChange={(v) => setForm({ ...form, isListed: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>特价商品</Label>
                <Switch checked={form.isSpecialItem} onCheckedChange={(v) => setForm({ ...form, isSpecialItem: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>允许免邮</Label>
                <Switch checked={form.allowFreeShipping} onCheckedChange={(v) => setForm({ ...form, allowFreeShipping: v })} />
              </div>
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
