import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Edit2, Trash2, Search, Tag } from "lucide-react";

const PRODUCT_TYPES = [
  { value: "physical", label: "实体商品" },
  { value: "membership", label: "会员商品" },
  { value: "gift", label: "赠品" },
];

const TYPE_BADGES: Record<string, string> = {
  physical: "bg-blue-100 text-blue-700",
  membership: "bg-purple-100 text-purple-700",
  gift: "bg-orange-100 text-orange-700",
};

type FormState = {
  name: string;
  type: "physical" | "membership" | "gift";
  categoryId: number | undefined;
  description: string;
  coverImageUrl: string;
  cost: string;
  regularPrice: string;
  memberPrice: string;
  originalPrice: string;
  specialPrice: string;
  weightKg: string;
  stockQuantity: number;
  isPreOrder: boolean;
  isListed: boolean;
  isSpecialItem: boolean;
  allowFreeShipping: boolean;
  keywords: string;
  videoUrl: string;
  membershipIntro: string;
  telegramFlowLink: string;
  facebookFlowId: string;
  allowStandalonePurchase: boolean;
  allowMixedCheckout: boolean;
  orderCategory: "local" | "import";
};

const EMPTY_FORM: FormState = {
  name: "", type: "physical", categoryId: undefined, description: "", coverImageUrl: "",
  cost: "", regularPrice: "", memberPrice: "", originalPrice: "", specialPrice: "",
  weightKg: "", stockQuantity: 0, isPreOrder: false, isListed: true,
  isSpecialItem: false, allowFreeShipping: true, keywords: "", videoUrl: "",
  membershipIntro: "", telegramFlowLink: "", facebookFlowId: "",
  allowStandalonePurchase: true, allowMixedCheckout: true,
  orderCategory: "local",
};

export default function Products() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const utils = trpc.useUtils();

  const { data: products, isLoading } = trpc.products.list.useQuery({
    search: search || undefined,
    type: typeFilter !== "all" ? (typeFilter as any) : undefined,
  });

  const { data: categories } = trpc.categories.list.useQuery({ activeOnly: true });

  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      utils.products.invalidate();
      toast.success("商品创建成功");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    },
    onError: (e) => toast.error(`创建失败: ${e.message}`),
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.invalidate();
      toast.success("商品更新成功");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
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

  function openEdit(product: any) {
    setEditingId(product.id);
    setForm({
      ...EMPTY_FORM,
      name: product.name || "",
      type: product.type,
      categoryId: product.categoryId || undefined,
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
      orderCategory: (product.orderCategory as "local" | "import") ?? "local",
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
  const isGift = form.type === "gift";
  const isPhysical = form.type === "physical";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">商品管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理实体商品、会员商品及赠品</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setDialogOpen(true); }}>
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
                <TableHead>分类</TableHead>
                <TableHead>价格</TableHead>
                <TableHead>库存</TableHead>
                <TableHead>上架</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : products?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">暂无商品</TableCell></TableRow>
              ) : products?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge className={TYPE_BADGES[p.type]} variant="secondary">
                      {PRODUCT_TYPES.find(t => t.value === p.type)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {categories?.find(c => c.id === p.categoryId)?.nameZh || "—"}
                  </TableCell>
                  <TableCell>
                    {p.type === "gift"
                      ? "免费 (赠品)"
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
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v, categoryId: v === "physical" ? form.categoryId : undefined })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category selector for physical products */}
            {isPhysical && (
              <div>
                <Label>商品分类</Label>
                <Select
                  value={form.categoryId?.toString() || "none"}
                  onValueChange={(v) => setForm({ ...form, categoryId: v === "none" ? undefined : parseInt(v) })}
                >
                  <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无分类</SelectItem>
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.nameZh}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>商品介绍</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>成本价</Label>
                <Input type="number" placeholder="0.00" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} disabled={isMembership} />
              </div>
              <div>
                <Label>{isMembership ? "会员收费金额" : isGift ? "赠品价格 (0)" : "普通价格"}</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={isGift ? "0" : form.regularPrice}
                  onChange={(e) => setForm({ ...form, regularPrice: e.target.value })}
                  disabled={isMembership || isGift}
                />
              </div>
              <div>
                <Label>会员价</Label>
                <Input type="number" placeholder="0.00" value={form.memberPrice} onChange={(e) => setForm({ ...form, memberPrice: e.target.value })} disabled={isMembership || isGift} />
              </div>
            </div>

            {/* Physical & Gift: weight, stock, original/special price */}
            {!isMembership && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>原价</Label>
                  <Input type="number" placeholder="0.00" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} disabled={isGift} />
                </div>
                <div>
                  <Label>特价</Label>
                  <Input type="number" placeholder="0.00" value={form.specialPrice} onChange={(e) => setForm({ ...form, specialPrice: e.target.value })} disabled={isGift} />
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
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-purple-600" />
                  <h3 className="font-medium text-sm">会员商品专属设置</h3>
                </div>
                <p className="text-xs text-muted-foreground">会员商品不计算重量、运费，不进入配货流程，无库存限制</p>
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
            {/* Order Category - available for all product types */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>订单类型 / Order Category</Label>
                <Select value={form.orderCategory} onValueChange={(v) => setForm({ ...form, orderCategory: v as "local" | "import" })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">本地 Local</SelectItem>
                    <SelectItem value="import">中国代购 China Import</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">决定商品加入 XT 本地订单还是 XTC 中国代购订单</p>
              </div>
            </div>
            {/* Gift-specific note */}
            {isGift && (
              <div className="p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-4 w-4 text-orange-600" />
                  <h3 className="font-medium text-sm">赠品设置</h3>
                </div>
                <p className="text-xs text-muted-foreground">赠品有库存限制，需计算运费，但不收取商品费用（价格为0）。赠品会与实体商品一起计算运费和免邮门槛。</p>
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
