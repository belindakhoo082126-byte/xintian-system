import { useState, useMemo, useEffect, useRef } from "react";
import { useSearch } from "wouter";
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
import { Plus, Edit2, Trash2, Search, Copy, Check, AlertCircle, Link as LinkIcon, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Upload } from "lucide-react";

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

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  active: "上架",
  inactive: "下架",
  out_of_stock: "缺货",
};

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  inactive: "bg-yellow-100 text-yellow-700",
  out_of_stock: "bg-red-100 text-red-700",
};

const PAGE_SIZE = 20;

type ProductForm = {
  name: string;
  type: "physical" | "membership" | "gift";
  productMode: "simple" | "variant";
  categoryId: number | undefined;
  unitId: number | undefined;
  keyword: string;
  status: "draft" | "active" | "inactive" | "out_of_stock";
  visibility: "public" | "link_only" | "hidden";
  priceVisibility: "show" | "hide" | "member_link";
  shortDescZh: string;
  shortDescEn: string;
  fullDescZh: string;
  fullDescEn: string;
  careZh: string;
  careEn: string;
  sellingPrice: string;
  compareAtPrice: string;
  memberPrice: string;
  estimatedCost: string;
  currentCost: string;
  weightKg: string;
  stockQuantity: number;
  isFeatured: boolean;
  featuredSortOrder: number;
  membershipIntro: string;
  telegramFlowLink: string;
  allowStandalonePurchase: boolean;
  allowMixedCheckout: boolean;
  notes: string;
  coverImageUrl: string;
  dimensions: { diameter?: string; height?: string; length?: string; width?: string };
};

const EMPTY_FORM: ProductForm = {
  name: "", type: "physical", productMode: "simple", categoryId: undefined, unitId: undefined,
  keyword: "", status: "draft", visibility: "public", priceVisibility: "show",
  shortDescZh: "", shortDescEn: "", fullDescZh: "", fullDescEn: "", careZh: "", careEn: "",
  sellingPrice: "", compareAtPrice: "", memberPrice: "", estimatedCost: "", currentCost: "",
  weightKg: "", stockQuantity: 0, isFeatured: false, featuredSortOrder: 0,
  membershipIntro: "", telegramFlowLink: "", allowStandalonePurchase: true, allowMixedCheckout: true,
  notes: "", coverImageUrl: "", dimensions: {},
};

const STEPS = ["基本资料", "图片与描述", "价格与成本", "规格设置", "显示与推荐", "预览确认"];

type VariantForm = {
  id?: number;
  name: string;
  keyword: string;
  sellingPrice: string;
  compareAtPrice: string;
  memberPrice: string;
  estimatedCost: string;
  status: "active" | "inactive" | "hidden";
  sortOrder: number;
  imageUrl: string;
  stockQuantity: number;
};

const EMPTY_VARIANT: VariantForm = {
  name: "", keyword: "", sellingPrice: "", compareAtPrice: "", memberPrice: "",
  estimatedCost: "", status: "active", sortOrder: 0, imageUrl: "", stockQuantity: 0,
};

export default function ProductsV2() {
  const searchParams = useSearch();
  const urlStock = new URLSearchParams(searchParams).get("stock");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>(urlStock || "all");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [variants, setVariants] = useState<any[]>([]);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
  const [variantForm, setVariantForm] = useState<VariantForm>(EMPTY_VARIANT);
  const [showMemberLinkDialog, setShowMemberLinkDialog] = useState(false);
  const [currentProductId, setCurrentProductId] = useState<number | null>(null);
  const [simulatorPrice, setSimulatorPrice] = useState("");
  const hydratedEditingIdRef = useRef<number | null>(null);
  const utils = trpc.useUtils();

  // List query with pagination
  const { data: productsData, isLoading } = trpc.productsV2.list.useQuery({
    search: search || undefined,
    type: typeFilter !== "all" ? (typeFilter as any) : undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    stockFilter: stockFilter !== "all" ? (stockFilter as "low" | "out") : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const { data: categories } = trpc.categories.list.useQuery({ activeOnly: true });
  const { data: units } = trpc.units.list.useQuery();

  const products = productsData?.items || [];
  const totalCount = productsData?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Detail query for editing
  const detailQuery = trpc.productsV2.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId && dialogOpen }
  );

  // Populate an edit form once per dialog session. Without the guard, a query
  // cache update can overwrite in-progress operator edits with stale detail data.
  useEffect(() => {
    if (detailQuery.data && editingId && hydratedEditingIdRef.current !== editingId) {
      const p = detailQuery.data;
      setForm({
        name: p.name || "",
        type: p.type,
        productMode: p.productMode || "simple",
        categoryId: p.categoryId || undefined,
        unitId: p.unitId || undefined,
        keyword: p.keyword || "",
        status: p.status || "draft",
        visibility: p.visibility || "public",
        priceVisibility: p.priceVisibility || "show",
        shortDescZh: p.shortDescZh || "",
        shortDescEn: p.shortDescEn || "",
        fullDescZh: p.fullDescZh || "",
        fullDescEn: p.fullDescEn || "",
        careZh: p.careZh || "",
        careEn: p.careEn || "",
        sellingPrice: p.sellingPrice || "",
        compareAtPrice: p.compareAtPrice || "",
        memberPrice: p.memberPrice || "",
        estimatedCost: p.estimatedCost || "",
        currentCost: p.currentCost || "",
        weightKg: p.weightKg || "",
        stockQuantity: p.stockQuantity || 0,
        isFeatured: p.isFeatured || false,
        featuredSortOrder: p.featuredSortOrder || 0,
        membershipIntro: p.membershipIntro || "",
        telegramFlowLink: p.telegramFlowLink || "",
        allowStandalonePurchase: p.allowStandalonePurchase ?? true,
        allowMixedCheckout: p.allowMixedCheckout ?? true,
        notes: p.notes || "",
        coverImageUrl: p.coverImageUrl || "",
        dimensions: p.dimensions || {},
      });
      setVariants(p.variants || []);
      hydratedEditingIdRef.current = editingId;
    }
  }, [detailQuery.data, editingId]);

  const createMutation = trpc.productsV2.create.useMutation({
    onSuccess: (data) => {
      utils.productsV2.invalidate();
      toast.success(`商品创建成功，SKU: ${data.sku}`);
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(`创建失败: ${e.message}`),
  });

  const updateMutation = trpc.productsV2.update.useMutation({
    onSuccess: () => {
      utils.productsV2.invalidate();
      toast.success("商品更新成功");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const deleteMutation = trpc.productsV2.delete.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        utils.productsV2.invalidate();
        toast.success("商品已删除");
      } else {
        toast.error(data.reason || "删除失败");
      }
    },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
  });

  const duplicateMutation = trpc.productsV2.duplicate.useMutation({
    onSuccess: (data) => {
      utils.productsV2.invalidate();
      toast.success(`商品已复制，新 SKU: ${data.sku}`);
    },
    onError: (e) => toast.error(`复制失败: ${e.message}`),
  });

  const checkKeywordQuery = trpc.productsV2.checkKeyword.useQuery({
    keyword: form.keyword,
    excludeProductId: editingId || undefined,
  }, { enabled: form.keyword.length > 0 });

  // Variant mutations
  const createVariantMutation = trpc.variants.create.useMutation({
    onSuccess: () => {
      utils.productsV2.invalidate();
      if (editingId) utils.productsV2.getById.invalidate({ id: editingId });
      toast.success("规格添加成功");
      setVariantDialogOpen(false);
      setVariantForm(EMPTY_VARIANT);
    },
    onError: (e) => toast.error(`添加失败: ${e.message}`),
  });

  const updateVariantMutation = trpc.variants.update.useMutation({
    onSuccess: () => {
      utils.productsV2.invalidate();
      if (editingId) utils.productsV2.getById.invalidate({ id: editingId });
      toast.success("规格更新成功");
      setVariantDialogOpen(false);
      setVariantForm(EMPTY_VARIANT);
      setEditingVariantId(null);
    },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const deleteVariantMutation = trpc.variants.delete.useMutation({
    onSuccess: () => {
      utils.productsV2.invalidate();
      if (editingId) utils.productsV2.getById.invalidate({ id: editingId });
      toast.success("规格已删除");
    },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
  });

  const checkVariantKeywordQuery = trpc.productsV2.checkVariantKeyword.useQuery({
    productId: editingId || 0,
    keyword: variantForm.keyword,
    excludeVariantId: editingVariantId || undefined,
  }, { enabled: !!editingId && variantForm.keyword.length > 0 });

  // Member link mutations
  const generateMemberLinkMutation = trpc.memberLinks.generate.useMutation({
    onSuccess: (data) => {
      utils.memberLinks.invalidate();
      toast.success(`会员链接已生成: ${data.url}`);
      if (currentProductId) utils.memberLinks.list.invalidate({ productId: currentProductId });
    },
    onError: (e) => toast.error(`生成失败: ${e.message}`),
  });

  const deactivateMemberLinkMutation = trpc.memberLinks.deactivate.useMutation({
    onSuccess: () => {
      utils.memberLinks.invalidate();
      toast.success("链接已停用");
      if (currentProductId) utils.memberLinks.list.invalidate({ productId: currentProductId });
    },
  });

  const memberLinksQuery = trpc.memberLinks.list.useQuery(
    { productId: currentProductId! },
    { enabled: !!currentProductId && showMemberLinkDialog }
  );

  function resetForm() {
    hydratedEditingIdRef.current = null;
    setForm(EMPTY_FORM);
    setVariants([]);
    setStep(0);
    setEditingId(null);
    setCurrentProductId(null);
    setSimulatorPrice("");
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(product: any) {
    hydratedEditingIdRef.current = null;
    setEditingId(product.id);
    setCurrentProductId(product.id);
    setStep(0);
    setDialogOpen(true);
    // detailQuery will auto-fetch and populate form via useEffect
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("请输入商品名称");
      setStep(0);
      return;
    }
    if (!form.keyword.trim()) {
      toast.error("请输入商品关键词");
      setStep(0);
      return;
    }
    const data: any = { ...form };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  function openAddVariant() {
    setVariantForm(EMPTY_VARIANT);
    setEditingVariantId(null);
    setVariantDialogOpen(true);
  }

  function openEditVariant(v: any) {
    setEditingVariantId(v.id);
    setVariantForm({
      id: v.id,
      name: v.name || "",
      keyword: v.keyword || "",
      sellingPrice: v.sellingPrice || "",
      compareAtPrice: v.compareAtPrice || "",
      memberPrice: v.memberPrice || "",
      estimatedCost: v.estimatedCost || "",
      status: v.status || "active",
      sortOrder: v.sortOrder || 0,
      imageUrl: v.imageUrl || "",
      stockQuantity: v.stockQuantity || 0,
    });
    setVariantDialogOpen(true);
  }

  function handleVariantSubmit() {
    if (!variantForm.name.trim()) {
      toast.error("请输入规格名称");
      return;
    }
    if (!variantForm.keyword.trim()) {
      toast.error("请输入规格关键词");
      return;
    }
    if (!editingId) {
      toast.error("请先保存商品再添加规格");
      return;
    }
    if (editingVariantId) {
      updateVariantMutation.mutate({ id: editingVariantId, ...variantForm });
    } else {
      createVariantMutation.mutate({ productId: editingId, ...variantForm });
    }
  }

  const isMembership = form.type === "membership";
  const isGift = form.type === "gift";
  const isPhysical = form.type === "physical";
  const isVariant = form.productMode === "variant";
  const keywordAvailable = !checkKeywordQuery.data || checkKeywordQuery.data.available;
  const variantKeywordAvailable = !checkVariantKeywordQuery.data || checkVariantKeywordQuery.data.available;

  // Price simulator calculations. If no ad-hoc test price is entered,
  // use the product selling price so the default result is meaningful.
  const simulatorTestPrice = useMemo(
    () => parseFloat(simulatorPrice || form.sellingPrice) || 0,
    [simulatorPrice, form.sellingPrice],
  );

  const simulatorProfit = useMemo(() => {
    const cost = parseFloat(form.estimatedCost) || 0;
    return simulatorTestPrice - cost;
  }, [simulatorTestPrice, form.estimatedCost]);

  const simulatorMargin = useMemo(() => {
    if (simulatorTestPrice <= 0) return 0;
    return (simulatorProfit / simulatorTestPrice) * 100;
  }, [simulatorProfit, simulatorTestPrice]);

  const profitLevel = useMemo(() => {
    if (simulatorProfit <= 0) return { label: "亏损", color: "text-red-600", icon: TrendingDown };
    if (simulatorMargin < 20) return { label: "低利润", color: "text-orange-600", icon: AlertCircle };
    return { label: "正常", color: "text-green-600", icon: TrendingUp };
  }, [simulatorProfit, simulatorMargin]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">商品管理</h1>
          <p className="text-sm text-muted-foreground mt-1">Phase 1 商品核心管理 — Simple/Variant、关键词、三层价格隔离</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新增商品
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索商品名称..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="商品类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {PRODUCT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="商品状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="active">上架</SelectItem>
            <SelectItem value="inactive">下架</SelectItem>
            <SelectItem value="out_of_stock">缺货</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>模式</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>关键词</TableHead>
                <TableHead>售价</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>推荐</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">暂无商品</TableCell></TableRow>
              ) : products.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {p.coverImageUrl && <img src={p.coverImageUrl} alt="" className="h-8 w-8 rounded object-cover" />}
                      {p.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={TYPE_BADGES[p.type]} variant="secondary">
                      {PRODUCT_TYPES.find(t => t.value === p.type)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.productMode === "variant" ? "多规格" : "单规格"}</Badge>
                  </TableCell>
                  <TableCell>
                    {categories?.find(c => c.id === p.categoryId)?.nameZh || "—"}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.keyword}</code>
                  </TableCell>
                  <TableCell>
                    {p.type === "gift" ? "免费" : `RM ${p.sellingPrice || "0"}`}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGES[p.status]} variant="secondary">
                      {STATUS_LABELS[p.status] || p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.isFeatured && <Badge variant="default">推荐</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} title="编辑">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateMutation.mutate({ id: p.id })} title="复制">
                        <Copy className="h-4 w-4" />
                      </Button>
                      {p.type === "membership" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setCurrentProductId(p.id); setShowMemberLinkDialog(true); }}
                          title="会员链接"
                        >
                          <LinkIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          if (confirm(`确定删除「${p.name}」吗？`)) {
                            deleteMutation.mutate({ id: p.id });
                          }
                        }}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            共 {totalCount} 件商品，第 {page + 1} / {totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Product Editor Dialog - Step Wizard */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑商品" : "新增商品"}</DialogTitle>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-1 shrink-0">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    i === step ? "bg-primary text-primary-foreground" :
                    i < step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium">
                    {i < step ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {s}
                </div>
                {i < STEPS.length - 1 && <div className="w-2 h-px bg-border" />}
              </div>
            ))}
          </div>

          {/* Loading state for edit */}
          {editingId && detailQuery.isLoading ? (
            <div className="text-center py-12 text-muted-foreground">加载商品详情中...</div>
          ) : (
            <>
              {/* Step Content */}
              <div className="min-h-[300px]">
                {/* Step 0: Basic Info */}
                {step === 0 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>商品名称 *</Label>
                        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="商品名称" />
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

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>商品模式 *</Label>
                        <Select value={form.productMode} onValueChange={(v: any) => setForm({ ...form, productMode: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simple">单规格 (Simple)</SelectItem>
                            <SelectItem value="variant">多规格 (Variant)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>销售单位</Label>
                        <Select
                          value={form.unitId?.toString() || "none"}
                          onValueChange={(v) => setForm({ ...form, unitId: v === "none" ? undefined : parseInt(v) })}
                        >
                          <SelectTrigger><SelectValue placeholder="选择单位" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">默认</SelectItem>
                            {units?.map(u => (
                              <SelectItem key={u.id} value={u.id.toString()}>{u.nameZh}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>关键词 *</Label>
                        <div className="relative">
                          <Input
                            value={form.keyword}
                            onChange={(e) => setForm({ ...form, keyword: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                            placeholder="自动大写去空格"
                          />
                          {form.keyword && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              {keywordAvailable ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          )}
                        </div>
                        {form.keyword && !keywordAvailable && (
                          <p className="text-xs text-red-500 mt-1">关键词已被使用</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>简短描述（中文）</Label>
                      <Textarea value={form.shortDescZh} onChange={(e) => setForm({ ...form, shortDescZh: e.target.value })} rows={2} placeholder="一句话描述" />
                    </div>
                    <div>
                      <Label>简短描述（英文）</Label>
                      <Textarea value={form.shortDescEn} onChange={(e) => setForm({ ...form, shortDescEn: e.target.value })} rows={2} placeholder="Short description" />
                    </div>
                  </div>
                )}

                {/* Step 1: Images & Description */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <Label>封面图片</Label>
                      <div className="flex items-center gap-3">
                        <Input value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} placeholder="https://... 或点击上传" />
                        <label className="cursor-pointer">
                          <Button variant="outline" asChild>
                            <span><Upload className="h-4 w-4 mr-1" />上传</span>
                          </Button>
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
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
                                  setForm({ ...form, coverImageUrl: data.url });
                                  toast.success("图片已上传");
                                } else {
                                  toast.error("上传失败");
                                }
                              } catch { toast.error("上传失败，请重试"); }
                            };
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                      </div>
                      {form.coverImageUrl && (
                        <img src={form.coverImageUrl} alt="封面预览" className="mt-2 h-32 w-32 rounded-lg object-cover border" />
                      )}
                    </div>
                    <div>
                      <Label>详细描述（中文）</Label>
                      <Textarea value={form.fullDescZh} onChange={(e) => setForm({ ...form, fullDescZh: e.target.value })} rows={4} placeholder="详细商品描述" />
                    </div>
                    <div>
                      <Label>详细描述（英文）</Label>
                      <Textarea value={form.fullDescEn} onChange={(e) => setForm({ ...form, fullDescEn: e.target.value })} rows={4} placeholder="Full description" />
                    </div>
                    {isPhysical && (
                      <>
                        <div>
                          <Label>养护说明（中文）</Label>
                          <Textarea value={form.careZh} onChange={(e) => setForm({ ...form, careZh: e.target.value })} rows={3} placeholder="光照、浇水、施肥等" />
                        </div>
                        <div>
                          <Label>养护说明（英文）</Label>
                          <Textarea value={form.careEn} onChange={(e) => setForm({ ...form, careEn: e.target.value })} rows={3} placeholder="Light, watering, fertilizing" />
                        </div>
                      </>
                    )}
                    <p className="text-xs text-muted-foreground">
                      提示：图片和影片的批量上传功能将在后续版本中支持。当前可通过 URL 设置封面图。
                    </p>
                  </div>
                )}

                {/* Step 2: Price & Cost */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>售价 (RM) {!isGift && "*"}</Label>
                        <Input type="number" placeholder="0.00" value={isGift ? "0" : form.sellingPrice}
                          onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} disabled={isGift} />
                      </div>
                      <div>
                        <Label>划线价 (RM)</Label>
                        <Input type="number" placeholder="0.00" value={form.compareAtPrice}
                          onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} disabled={isGift} />
                      </div>
                      <div>
                        <Label>会员价 (RM)</Label>
                        <Input type="number" placeholder="0.00" value={form.memberPrice}
                          onChange={(e) => setForm({ ...form, memberPrice: e.target.value })} disabled={isGift} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>参考成本 (RM)</Label>
                        <Input type="number" placeholder="0.00" value={form.estimatedCost}
                          onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} disabled={isMembership} />
                        <p className="text-xs text-muted-foreground mt-1">预估成本，用于利润计算</p>
                      </div>
                      <div>
                        <Label>当前成本 (RM)</Label>
                        <Input type="number" placeholder="0.00" value={form.currentCost}
                          onChange={(e) => setForm({ ...form, currentCost: e.target.value })} disabled={isMembership} />
                        <p className="text-xs text-muted-foreground mt-1">FIFO 当前成本，进货时自动更新</p>
                      </div>
                    </div>

                    {/* Price Simulator */}
                    {!isGift && !isMembership && form.estimatedCost && (
                      <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <h4 className="font-medium text-sm">价格模拟器</h4>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>测试售价 (RM)</Label>
                            <Input type="number" placeholder={form.sellingPrice || "0.00"} value={simulatorPrice}
                              onChange={(e) => setSimulatorPrice(e.target.value)} />
                          </div>
                          <div>
                            <Label>预计利润</Label>
                            <div className={`flex items-center gap-1.5 text-lg font-bold ${profitLevel.color}`}>
                              <profitLevel.icon className="h-4 w-4" />
                              RM {simulatorProfit.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <Label>利润率</Label>
                            <div className={`text-lg font-bold ${profitLevel.color}`}>
                              {simulatorMargin.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={profitLevel.color.includes("green") ? "bg-green-100 text-green-700" : profitLevel.color.includes("orange") ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}>
                            {profitLevel.label}
                          </Badge>
                          {simulatorMargin < 20 && simulatorProfit > 0 && (
                            <span className="text-xs text-orange-600">利润率低于 20%，建议调整售价或成本</span>
                          )}
                          {simulatorProfit <= 0 && simulatorPrice && (
                            <span className="text-xs text-red-600">当前售价低于成本，处于亏损状态</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Price Visibility */}
                    <div>
                      <Label>价格显示设置</Label>
                      <Select value={form.priceVisibility} onValueChange={(v: any) => setForm({ ...form, priceVisibility: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="show">公开显示价格</SelectItem>
                          <SelectItem value="hide">隐藏价格（询价）</SelectItem>
                          <SelectItem value="member_link">仅会员链接可见</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Physical: weight & dimensions */}
                    {!isMembership && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>重量 (kg)</Label>
                            <Input type="number" placeholder="0.00" value={form.weightKg}
                              onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
                          </div>
                          <div>
                            <Label>库存数量</Label>
                            <Input type="number" value={form.stockQuantity}
                              onChange={(e) => setForm({ ...form, stockQuantity: parseInt(e.target.value) || 0 })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <Label>口径 (cm)</Label>
                            <Input type="number" placeholder="0" value={form.dimensions.diameter || ""}
                              onChange={(e) => setForm({ ...form, dimensions: { ...form.dimensions, diameter: e.target.value } })} />
                          </div>
                          <div>
                            <Label>高度 (cm)</Label>
                            <Input type="number" placeholder="0" value={form.dimensions.height || ""}
                              onChange={(e) => setForm({ ...form, dimensions: { ...form.dimensions, height: e.target.value } })} />
                          </div>
                          <div>
                            <Label>长度 (cm)</Label>
                            <Input type="number" placeholder="0" value={form.dimensions.length || ""}
                              onChange={(e) => setForm({ ...form, dimensions: { ...form.dimensions, length: e.target.value } })} />
                          </div>
                          <div>
                            <Label>宽度 (cm)</Label>
                            <Input type="number" placeholder="0" value={form.dimensions.width || ""}
                              onChange={(e) => setForm({ ...form, dimensions: { ...form.dimensions, width: e.target.value } })} />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Membership-specific */}
                    {isMembership && (
                      <div className="space-y-4 p-4 border rounded-lg bg-purple-50/50 dark:bg-purple-950/20">
                        <h3 className="font-medium text-sm">会员商品专属设置</h3>
                        <p className="text-xs text-muted-foreground">会员商品不计算重量、运费，不进入配货流程，无库存限制</p>
                        <div>
                          <Label>会员收费金额</Label>
                          <Input type="number" placeholder="0.00" value={form.sellingPrice}
                            onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
                        </div>
                        <div>
                          <Label>会员介绍</Label>
                          <Textarea value={form.membershipIntro} onChange={(e) => setForm({ ...form, membershipIntro: e.target.value })} rows={3} placeholder="详细描述会员权益和福利..." />
                        </div>
                        <div>
                          <Label>Telegram 会员流程链接</Label>
                          <Input placeholder="https://t.me/..." value={form.telegramFlowLink}
                            onChange={(e) => setForm({ ...form, telegramFlowLink: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <Label>允许单独购买</Label>
                              <p className="text-xs text-muted-foreground">客户可只购买会员商品</p>
                            </div>
                            <Switch checked={form.allowStandalonePurchase}
                              onCheckedChange={(v) => setForm({ ...form, allowStandalonePurchase: v })} />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <Label>允许混合结账</Label>
                              <p className="text-xs text-muted-foreground">可与普通商品一起结账</p>
                            </div>
                            <Switch checked={form.allowMixedCheckout}
                              onCheckedChange={(v) => setForm({ ...form, allowMixedCheckout: v })} />
                          </div>
                        </div>
                      </div>
                    )}

                    {isGift && (
                      <div className="p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                        <h3 className="font-medium text-sm">赠品设置</h3>
                        <p className="text-xs text-muted-foreground mt-1">赠品有库存限制，需计算运费，但不收取商品费用（价格为0）。赠品会与实体商品一起计算运费和免邮门槛。</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Variants */}
                {step === 3 && (
                  <div className="space-y-4">
                    {!isVariant ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>此商品为单规格模式，无需设置规格。</p>
                        <p className="text-xs mt-2">如需多规格，请在「基本资料」步骤中切换为 Variant 模式</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">规格列表</h3>
                          <Button size="sm" onClick={openAddVariant} disabled={!editingId}>
                            <Plus className="h-4 w-4 mr-1" />
                            添加规格
                          </Button>
                        </div>
                        {!editingId && (
                          <p className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/20 p-2 rounded">
                            请先保存商品后再添加规格
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">规格关键词 = 商品关键词 + 规格关键词（自动组合）</p>
                        {variants.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">暂无规格</p>
                        ) : (
                          <div className="space-y-2">
                            {variants.map((v, i) => (
                              <div key={v.id || i} className="flex items-center gap-3 p-3 border rounded-lg">
                                <div className="flex-1">
                                  <span className="font-medium text-sm">{v.name}</span>
                                  <div className="flex items-center gap-2 mt-1">
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{v.keyword}</code>
                                    <span className="text-xs text-muted-foreground">SKU: {v.sku}</span>
                                  </div>
                                </div>
                                <span className="text-sm">RM {v.sellingPrice || "—"}</span>
                                <Badge variant="outline">{v.status === "active" ? "启用" : v.status === "inactive" ? "停用" : "隐藏"}</Badge>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditVariant(v)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8"
                                  onClick={() => { if (confirm(`确定删除规格「${v.name}」？`)) deleteVariantMutation.mutate({ id: v.id }); }}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Step 4: Display & Featured */}
                {step === 4 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>商品状态</Label>
                        <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">草稿</SelectItem>
                            <SelectItem value="active">上架</SelectItem>
                            <SelectItem value="inactive">下架</SelectItem>
                            <SelectItem value="out_of_stock">缺货</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>可见性</Label>
                        <Select value={form.visibility} onValueChange={(v: any) => setForm({ ...form, visibility: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">公开</SelectItem>
                            <SelectItem value="link_only">仅链接可见</SelectItem>
                            <SelectItem value="hidden">隐藏</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label>推荐商品</Label>
                        <p className="text-xs text-muted-foreground">在商城首页推荐此商品</p>
                      </div>
                      <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} />
                    </div>

                    {form.isFeatured && (
                      <div>
                        <Label>推荐排序权重</Label>
                        <Input type="number" value={form.featuredSortOrder}
                          onChange={(e) => setForm({ ...form, featuredSortOrder: parseInt(e.target.value) || 0 })} />
                        <p className="text-xs text-muted-foreground mt-1">数字越小排序越靠前</p>
                      </div>
                    )}

                    <div>
                      <Label>内部备注</Label>
                      <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                        placeholder="仅后台可见的备注信息" />
                    </div>
                  </div>
                )}

                {/* Step 5: Preview & Confirm */}
                {step === 5 && (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">商品预览</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-start gap-4">
                          {form.coverImageUrl && (
                            <img src={form.coverImageUrl} alt="" className="h-24 w-24 rounded-lg object-cover border" />
                          )}
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{form.name || "未命名商品"}</h3>
                              <Badge className={TYPE_BADGES[form.type]} variant="secondary">
                                {PRODUCT_TYPES.find(t => t.value === form.type)?.label}
                              </Badge>
                              <Badge variant="outline">{form.productMode === "variant" ? "多规格" : "单规格"}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{form.shortDescZh || "无描述"}</p>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="font-medium">RM {form.sellingPrice || "0"}</span>
                              {form.compareAtPrice && <span className="line-through text-muted-foreground">RM {form.compareAtPrice}</span>}
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{form.keyword}</code>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                          <div>分类: {categories?.find(c => c.id === form.categoryId)?.nameZh || "无"}</div>
                          <div>状态: {STATUS_LABELS[form.status]}</div>
                          <div>可见性: {form.visibility === "public" ? "公开" : form.visibility === "link_only" ? "仅链接" : "隐藏"}</div>
                          <div>推荐: {form.isFeatured ? "是" : "否"}</div>
                          {!isMembership && <div>库存: {form.stockQuantity}</div>}
                          {!isMembership && form.estimatedCost && (
                            <div>预计利润: <span className={parseFloat(form.sellingPrice) - parseFloat(form.estimatedCost) >= 0 ? "text-green-600" : "text-red-600"}>RM {(parseFloat(form.sellingPrice) - parseFloat(form.estimatedCost)).toFixed(2)}</span></div>
                          )}
                        </div>
                        {isVariant && variants.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-sm font-medium mb-2">规格 ({variants.length})</p>
                            <div className="space-y-1">
                              {variants.map((v, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <span>{v.name}</span>
                                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{v.keyword}</code>
                                  <span className="text-muted-foreground">RM {v.sellingPrice || "—"}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {isMembership && (
                      <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border text-sm">
                        <p className="font-medium">会员商品提示</p>
                        <p className="text-xs text-muted-foreground mt-1">保存后可生成会员专属购买链接，通过 Messenger 发送给客户</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : setDialogOpen(false)}>
                  {step === 0 ? "取消" : "上一步"}
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button onClick={() => setStep(step + 1)} disabled={step === 0 && (!form.name.trim() || !form.keyword.trim() || !keywordAvailable)}>
                    下一步
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingId ? "保存" : "创建商品"}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Variant Dialog */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVariantId ? "编辑规格" : "新增规格"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>规格名称 *</Label>
                <Input value={variantForm.name} onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })} placeholder="如：红色大盆" />
              </div>
              <div>
                <Label>规格关键词 *</Label>
                <div className="relative">
                  <Input
                    value={variantForm.keyword}
                    onChange={(e) => setVariantForm({ ...variantForm, keyword: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    placeholder="自动大写去空格"
                  />
                  {variantForm.keyword && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {variantKeywordAvailable ? <Check className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                    </div>
                  )}
                </div>
                {variantForm.keyword && !variantKeywordAvailable && (
                  <p className="text-xs text-red-500 mt-1">关键词已被使用</p>
                )}
                {variantForm.keyword && (
                  <p className="text-xs text-muted-foreground mt-1">组合关键词: {form.keyword}{variantForm.keyword}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>售价 (RM)</Label>
                <Input type="number" placeholder="继承商品" value={variantForm.sellingPrice}
                  onChange={(e) => setVariantForm({ ...variantForm, sellingPrice: e.target.value })} />
              </div>
              <div>
                <Label>划线价 (RM)</Label>
                <Input type="number" placeholder="继承商品" value={variantForm.compareAtPrice}
                  onChange={(e) => setVariantForm({ ...variantForm, compareAtPrice: e.target.value })} />
              </div>
              <div>
                <Label>会员价 (RM)</Label>
                <Input type="number" placeholder="继承商品" value={variantForm.memberPrice}
                  onChange={(e) => setVariantForm({ ...variantForm, memberPrice: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>参考成本 (RM)</Label>
                <Input type="number" placeholder="继承商品" value={variantForm.estimatedCost}
                  onChange={(e) => setVariantForm({ ...variantForm, estimatedCost: e.target.value })} />
              </div>
              <div>
                <Label>库存</Label>
                <Input type="number" value={variantForm.stockQuantity}
                  onChange={(e) => setVariantForm({ ...variantForm, stockQuantity: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>状态</Label>
                <Select value={variantForm.status} onValueChange={(v: any) => setVariantForm({ ...variantForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                    <SelectItem value="hidden">隐藏</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantDialogOpen(false)}>取消</Button>
            <Button onClick={handleVariantSubmit} disabled={createVariantMutation.isPending || updateVariantMutation.isPending}>
              {editingVariantId ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Links Dialog */}
      <Dialog open={showMemberLinkDialog} onOpenChange={setShowMemberLinkDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>会员购买链接管理</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              onClick={() => currentProductId && generateMemberLinkMutation.mutate({ productId: currentProductId })}
              disabled={generateMemberLinkMutation.isPending}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              生成新链接（旧链接将自动停用）
            </Button>

            <div className="space-y-2">
              {memberLinksQuery.isLoading ? (
                <p className="text-center text-muted-foreground py-4">加载中...</p>
              ) : memberLinksQuery.data?.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">暂无链接</p>
              ) : memberLinksQuery.data?.map(link => (
                <div key={link.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">/m/{link.token}</code>
                    <p className="text-xs text-muted-foreground mt-1">
                      创建于 {new Date(link.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={link.isActive ? "default" : "outline"}>
                    {link.isActive ? "活跃" : "已停用"}
                  </Badge>
                  {link.isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deactivateMemberLinkMutation.mutate({ id: link.id })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
