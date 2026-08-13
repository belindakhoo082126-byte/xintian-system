import { useState, useMemo, useEffect, useRef } from "react";
import { useI18n } from "@/contexts/I18nContext";
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
import { Plus, Edit2, Trash2, Search, Copy, Check, AlertCircle, Link as LinkIcon, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Upload, Bot, Loader2, History } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProductImagePreview } from "@/components/ProductImagePreview";

const RAW_PRODUCT_TYPES = [
  { value: "physical", zh: "实体商品", en: "Physical Product" },
  { value: "virtual", zh: "虚拟商品", en: "Virtual Product" },
  { value: "gift", zh: "赠品", en: "Gift Product" },
];

const TYPE_BADGES: Record<string, string> = {
  physical: "bg-blue-100 text-blue-700",
  virtual: "bg-purple-100 text-purple-700",
  gift: "bg-orange-100 text-orange-700",
};

const RAW_STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  draft: { zh: "草稿", en: "Draft" },
  active: { zh: "上架", en: "Active" },
  inactive: { zh: "下架", en: "Inactive" },
  out_of_stock: { zh: "缺货", en: "Out of Stock" },
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
  type: "physical" | "virtual" | "gift";
  productMode: "simple" | "variant";
  categoryId: number | undefined;
  unitId: number | undefined;
  keyword: string;
  keywordChannels: string[];
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
  isSpecial: boolean;
  specialPrice: string;
  allowPresale: boolean;
  allowStandaloneShipping: boolean;
  standaloneShippingMethod: string;
  standaloneShippingFee: string;
  lightDesc: string;
  waterDesc: string;
  fertilizerDesc: string;
  pruningDesc: string;
  productImages: string[];
  videoUrl: string;
  // V2.0: Sales mode
  salesMode: string;
  preorderWaitDays: string;
  spotSaleEnabled: boolean;
  spotSaleQty: number;
  linkedBatchId: string;
  // V4: Wholesale & Agent
  wholesalePrice: string;
  agentPrice: string;
  moq: number;
  visibleTo: string[];
  specialPriceStartDate: string;
  specialPriceEndDate: string;
  // V5: AI Tags & Selling Points
  aiTags: string[];
  aiSellingPoints: string;
  syncToMall: boolean;
};

const EMPTY_FORM: ProductForm = {
  name: "", type: "physical", productMode: "simple", categoryId: undefined, unitId: undefined,
  keyword: "", keywordChannels: ["fb_live", "fb_post", "fb_reel", "messenger", "whatsapp"], status: "draft", visibility: "public", priceVisibility: "show",
  shortDescZh: "", shortDescEn: "", fullDescZh: "", fullDescEn: "", careZh: "", careEn: "",
  sellingPrice: "", compareAtPrice: "", memberPrice: "", currentCost: "",
  weightKg: "", stockQuantity: 0, isFeatured: false, featuredSortOrder: 0,
  membershipIntro: "", telegramFlowLink: "", allowStandalonePurchase: true, allowMixedCheckout: true,
  notes: "", coverImageUrl: "", dimensions: {},
  isSpecial: false, specialPrice: "", allowPresale: false, allowStandaloneShipping: false,
  standaloneShippingMethod: "fixed_fee", standaloneShippingFee: "",
  lightDesc: "", waterDesc: "", fertilizerDesc: "", pruningDesc: "",
  productImages: [],
  videoUrl: "",
  salesMode: "normal", preorderWaitDays: "", spotSaleEnabled: false, spotSaleQty: 0, linkedBatchId: "",
  wholesalePrice: "", agentPrice: "", moq: 0, visibleTo: ["retail", "member", "wholesale", "agent"],
  specialPriceStartDate: "", specialPriceEndDate: "",
  aiTags: [], aiSellingPoints: "",
  syncToMall: false,
};

const RAW_STEPS = [
  { zh: "基本资料", en: "Basic Info" },
  { zh: "图片与描述", en: "Images & Description" },
  { zh: "价格与成本", en: "Price & Cost" },
  { zh: "规格设置", en: "Variant Settings" },
  { zh: "显示与推荐", en: "Display & Recommendation" },
  { zh: "预览确认", en: "Preview & Confirm" },
];

type VariantForm = {
  id?: number;
  name: string;
  keyword: string;
  sellingPrice: string;
  compareAtPrice: string;
  memberPrice: string;
    status: "active" | "inactive" | "hidden";
  sortOrder: number;
  imageUrl: string;
  stockQuantity: number;
};
const EMPTY_VARIANT: VariantForm = {
  name: "", keyword: "", sellingPrice: "", compareAtPrice: "", memberPrice: "",
  status: "active", sortOrder: 0, imageUrl: "", stockQuantity: 0,
};

export default function ProductsV2() {
  const { translate, lang } = useI18n();
  const getProductTypeLabel = (type: string) => {
    const entry = RAW_PRODUCT_TYPES.find((item) => item.value === type);
    return translate(entry?.zh ?? type, entry?.en ?? type);
  };
  const getPhysicalStatusLabel = (status: string) => {
    const labels: Record<string, { zh: string; en: string }> = {
      pending: { zh: "待汇款", en: "Pending Payment" },
      hold_order: { zh: "保留订单", en: "Hold Order" },
      partial_payment: { zh: "部分汇款", en: "Partial Payment" },
      receipt_uploaded: { zh: "待审核付款凭证", en: "Payment Proof Review" },
      packing: { zh: "待包货", en: "Pending Packing" },
      partial_shipped: { zh: "部分发货", en: "Partial Shipped" },
      shipped: { zh: "已发货", en: "Shipped" },
      completed: { zh: "已完成", en: "Completed" },
    };
    return translate(labels[status]?.zh ?? status, labels[status]?.en ?? status);
  };
  const searchParams = useSearch();
  const urlStock = new URLSearchParams(searchParams).get("stock");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>(urlStock || "all");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
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
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingVariant, setUploadingVariant] = useState(false);
  const [coverPreview, setCoverPreview] = useState("");
  const [orderDetailsTarget, setOrderDetailsTarget] = useState<{
    productId: number;
    productName: string;
    type: "ordered" | "paid" | "completed";
  } | null>(null);
  const [stockLogTarget, setStockLogTarget] = useState<{ productId: number; productName: string } | null>(null);
  const hydratedEditingIdRef = useRef<number | null>(null);
  const utils = trpc.useUtils();

  // List query with pagination
  const { data: productsData, isLoading } = trpc.productsV2.list.useQuery({
    search: search || undefined,
    type: typeFilter !== "all" ? (typeFilter as any) : undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    stockFilter: stockFilter !== "all" ? (stockFilter as "low" | "out" | "anomaly") : undefined,
    stockThreshold: stockFilter === "low" ? Math.max(1, Number(lowStockThreshold) || 5) : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const { data: categories } = trpc.categories.list.useQuery({ activeOnly: true });
  const { data: units } = trpc.units.list.useQuery();

  const products = productsData?.items || [];
  const totalCount = productsData?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const orderDetailsQuery = trpc.productsV2.orderDetails.useQuery(
    {
      productId: orderDetailsTarget?.productId ?? 0,
      type: orderDetailsTarget?.type ?? "ordered",
    },
    { enabled: !!orderDetailsTarget },
  );
  const stockLogQuery = trpc.inventoryAdjustment.list.useQuery(
    { productId: stockLogTarget?.productId ?? 0 },
    { enabled: !!stockLogTarget },
  );

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
        type: (p.type === "membership" ? "virtual" : p.type) as any,
        productMode: p.productMode || "simple",
        categoryId: p.categoryId || undefined,
        unitId: p.unitId || undefined,
        keyword: p.keyword || "",
        keywordChannels: (() => { try { const ch = JSON.parse((p as any).keywordChannels || "[]"); return Array.isArray(ch) && ch.length > 0 ? ch : ["fb_live", "fb_post", "fb_reel", "messenger", "whatsapp"]; } catch { return ["fb_live", "fb_post", "fb_reel", "messenger", "whatsapp"]; } })(),
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
        isSpecial: p.isSpecial ?? false,
        specialPrice: p.specialPrice || "",
        allowPresale: p.allowPresale ?? false,
        allowStandaloneShipping: p.allowStandaloneShipping ?? false,
        standaloneShippingMethod: (p as any).standaloneShippingMethod || "fixed_fee",
        standaloneShippingFee: (p as any).standaloneShippingFee ? String((p as any).standaloneShippingFee) : "",
        lightDesc: p.lightDesc || "",
        waterDesc: p.waterDesc || "",
        fertilizerDesc: p.fertilizerDesc || "",
        pruningDesc: p.pruningDesc || "",
        productImages: (p.images || []).map((img: any) => img.url || img),
        videoUrl: (p as any).videoUrl || "",
        salesMode: (p as any).salesMode || "normal",
        preorderWaitDays: (p as any).preorderWaitDays || "",
        spotSaleEnabled: (p as any).spotSaleEnabled ?? false,
        spotSaleQty: (p as any).spotSaleQty ?? 0,
        linkedBatchId: (p as any).linkedBatchId ? String((p as any).linkedBatchId) : "",
        wholesalePrice: (p as any).wholesalePrice ? String((p as any).wholesalePrice) : "",
        agentPrice: (p as any).agentPrice ? String((p as any).agentPrice) : "",
        moq: (p as any).moq ?? 0,
        visibleTo: (() => { try { return JSON.parse((p as any).visibleTo || '"[\"retail\",\"member\",\"wholesale\",\"agent\"]"'); } catch { return ["retail", "member", "wholesale", "agent"]; } })(),
        specialPriceStartDate: (p as any).specialPriceStartDate ? String((p as any).specialPriceStartDate).split("T")[0] : "",
        specialPriceEndDate: (p as any).specialPriceEndDate ? String((p as any).specialPriceEndDate).split("T")[0] : "",
        aiTags: (() => { try { const t = JSON.parse((p as any).aiTags || "[]"); return Array.isArray(t) ? t : []; } catch { return []; } })(),
        aiSellingPoints: (p as any).aiSellingPoints || "",
        syncToMall: (p as any).syncToMall ?? false,
      });
      setVariants(p.variants || []);
      hydratedEditingIdRef.current = editingId;
    }
  }, [detailQuery.data, editingId]);

  const createMutation = trpc.productsV2.create.useMutation({
    onSuccess: (data) => {
      utils.productsV2.invalidate();
      toast.success(translate(`商品创建成功，SKU: {sku}`, `Product created successfully, SKU: {sku}`, { sku: data.sku }));
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(translate(`创建失败: {message}`, `Creation failed: {message}`, { message: e.message })),
  });

  const updateMutation = trpc.productsV2.update.useMutation({
    onSuccess: () => {
      utils.productsV2.invalidate();
      toast.success(translate("商品更新成功", "Product updated successfully"));
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(translate(`更新失败: {message}`, `Update failed: {message}`, { message: e.message })),
  });

  const deleteMutation = trpc.productsV2.delete.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        utils.productsV2.invalidate();
        toast.success(translate("商品已删除", "Product deleted"));
      } else {
        toast.error(data.reason || translate("删除失败", "Deletion failed"));
      }
    },
    onError: (e) => toast.error(translate(`删除失败: {message}`, `Deletion failed: {message}`, { message: e.message })),
  });

  const duplicateMutation = trpc.productsV2.duplicate.useMutation({
    onSuccess: (data) => {
      utils.productsV2.invalidate();
      toast.success(translate(`商品已复制，新 SKU: {sku}`, `Product duplicated, new SKU: {sku}`, { sku: data.sku }));
    },
    onError: (e) => toast.error(translate(`复制失败: {message}`, `Duplication failed: {message}`, { message: e.message })),
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
      toast.success(translate("规格添加成功", "Variant added successfully"));
      setVariantDialogOpen(false);
      setVariantForm(EMPTY_VARIANT);
    },
    onError: (e) => toast.error(translate(`添加失败: {message}`, `Addition failed: {message}`, { message: e.message })),
  });

  const updateVariantMutation = trpc.variants.update.useMutation({
    onSuccess: () => {
      utils.productsV2.invalidate();
      if (editingId) utils.productsV2.getById.invalidate({ id: editingId });
      toast.success(translate("规格更新成功", "Variant updated successfully"));
      setVariantDialogOpen(false);
      setVariantForm(EMPTY_VARIANT);
      setEditingVariantId(null);
    },
    onError: (e) => toast.error(translate(`更新失败: {message}`, `Update failed: {message}`, { message: e.message })),
  });

  const deleteVariantMutation = trpc.variants.delete.useMutation({
    onSuccess: () => {
      utils.productsV2.invalidate();
      if (editingId) utils.productsV2.getById.invalidate({ id: editingId });
      toast.success(translate("规格已删除", "Variant deleted"));
    },
    onError: (e) => toast.error(translate(`删除失败: {message}`, `Deletion failed: {message}`, { message: e.message })),
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
      toast.success(translate(`会员链接已生成: {url}`, `Member link generated: {url}`, { url: data.url }));
      if (currentProductId) utils.memberLinks.list.invalidate({ productId: currentProductId });
    },
    onError: (e) => toast.error(translate(`生成失败: {message}`, `Generation failed: {message}`, { message: e.message })),
  });

  const deactivateMemberLinkMutation = trpc.memberLinks.deactivate.useMutation({
    onSuccess: () => {
      utils.memberLinks.invalidate();
      toast.success(translate("链接已停用", "Link deactivated"));
      if (currentProductId) utils.memberLinks.list.invalidate({ productId: currentProductId });
    },
  });

  const memberLinksQuery = trpc.memberLinks.list.useQuery(
    { productId: currentProductId! },
    { enabled: !!currentProductId && showMemberLinkDialog }
  );

  const getMemberLinkUrl = (token: string) => `${window.location.origin}/m/${token}`;
  const copyMemberLink = async (token: string) => {
    const url = getMemberLinkUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(translate("会员链接已复制", "Member link copied"));
    } catch {
      toast.error(translate("无法自动复制，请手动复制链接", "Unable to copy automatically. Please copy the link manually."));
    }
  };

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
      toast.error(translate("请输入商品名称", "Please enter product name"));
      setStep(0);
      return;
    }
    if (!form.keyword.trim()) {
      toast.error(translate("请输入商品关键词", "Please enter product keyword"));
      setStep(0);
      return;
    }
    const data: any = {
      ...form,
      salesMode: form.salesMode,
      preorderWaitDays: form.preorderWaitDays || undefined,
      spotSaleEnabled: form.spotSaleEnabled,
      spotSaleQty: form.spotSaleQty,
      linkedBatchId: form.linkedBatchId ? Number(form.linkedBatchId) : undefined,
      wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : undefined,
      agentPrice: form.agentPrice ? Number(form.agentPrice) : undefined,
      moq: form.moq,
      visibleTo: JSON.stringify(form.visibleTo),
      specialPriceStartDate: form.specialPriceStartDate || undefined,
      specialPriceEndDate: form.specialPriceEndDate || undefined,
      keywordChannels: JSON.stringify(form.keywordChannels),
      aiTags: JSON.stringify(form.aiTags),
      aiSellingPoints: form.aiSellingPoints || undefined,
      syncToMall: form.syncToMall,
    };
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

      status: v.status || "active",
      sortOrder: v.sortOrder || 0,
      imageUrl: v.imageUrl || "",
      stockQuantity: v.stockQuantity || 0,
    });
    setVariantDialogOpen(true);
  }

  function handleVariantSubmit() {
    if (!variantForm.name.trim()) {
      toast.error(translate("请输入规格名称", "Please enter variant name"));
      return;
    }
    if (!variantForm.keyword.trim()) {
      toast.error(translate("请输入规格关键词", "Please enter variant keyword"));
      return;
    }
    if (!editingId) {
      toast.error(translate("请先保存商品再添加规格", "Please save the product before adding variants"));
      return;
    }
    if (editingVariantId) {
      updateVariantMutation.mutate({ id: editingVariantId, ...variantForm });
    } else {
      createVariantMutation.mutate({ productId: editingId, ...variantForm });
    }
  }

  const isVirtual = form.type === "virtual";
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
    const cost = parseFloat(form.currentCost) || 0;
    return simulatorTestPrice - cost;
  }, [simulatorTestPrice, form.currentCost]);

  const simulatorMargin = useMemo(() => {
    if (simulatorTestPrice <= 0) return 0;
    return (simulatorProfit / simulatorTestPrice) * 100;
  }, [simulatorProfit, simulatorTestPrice]);

  const profitLevel = useMemo(() => {
    if (simulatorProfit <= 0) return { label: translate("亏损", "Loss"), color: "text-red-600", icon: TrendingDown };
    if (simulatorMargin < 20) return { label: translate("低利润", "Low Profit"), color: "text-orange-600", icon: AlertCircle };
    return { label: translate("正常", "Normal"), color: "text-green-600", icon: TrendingUp };
  }, [simulatorProfit, simulatorMargin]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("商品管理", "Product Management")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{translate("共 {count} 个商品", "{count} products total", { count: String(totalCount) })}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {translate("新增商品", "Add Product")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={translate("搜索商品名称...", "Search product name...")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={translate("商品类型", "Product Type")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{translate("全部类型", "All Types")}</SelectItem>
            {RAW_PRODUCT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{translate(t.zh, t.en)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={translate("商品状态", "Product Status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{translate("全部状态", "All Statuses")}</SelectItem>
            <SelectItem value="draft">{translate("草稿", "Draft")}</SelectItem>
            <SelectItem value="active">{translate("上架", "Active")}</SelectItem>
            <SelectItem value="inactive">{translate("下架", "Inactive")}</SelectItem>
            <SelectItem value="out_of_stock">{translate("缺货", "Out of Stock")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={translate("库存筛选", "Stock Filter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{translate("全部库存", "All Stock")}</SelectItem>
            <SelectItem value="low">{translate("低库存预警", "Low Stock Alert")}</SelectItem>
            <SelectItem value="out">{translate("缺货", "Out of Stock")}</SelectItem>
            <SelectItem value="anomaly">{translate("库存异常", "Stock Exception")}</SelectItem>
          </SelectContent>
        </Select>
        {stockFilter === "low" && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
            <span className="whitespace-nowrap text-sm text-muted-foreground">{translate("少于", "Below")}</span>
            <Input
              aria-label={translate("低库存阈值", "Low stock threshold")}
              type="number"
              min="1"
              step="1"
              value={lowStockThreshold}
              onChange={(event) => {
                setLowStockThreshold(event.target.value);
                setPage(0);
              }}
              className="h-8 w-16 bg-background text-center"
            />
            <span className="whitespace-nowrap text-sm text-muted-foreground">{translate("件", "units")}</span>
          </div>
        )}
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate("商品名称", "Product Name")}</TableHead>
                <TableHead>{translate("类型", "Type")}</TableHead>
                <TableHead>{translate("模式", "Mode")}</TableHead>
                <TableHead>{translate("分类", "Category")}</TableHead>
                <TableHead>{translate("关键词", "Keyword")}</TableHead>
                <TableHead>{translate("售价", "Selling Price")}</TableHead>
                <TableHead>{translate("状态", "Status")}</TableHead>
                <TableHead>{translate("库存", "Stock")}</TableHead>
                <TableHead>{translate("允许超卖", "Allow Oversold")}</TableHead>
                <TableHead>{translate("推荐", "Featured")}</TableHead>
                <TableHead className="text-right">{translate("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">{translate("暂无商品", "No products yet")}</TableCell></TableRow>
              ) : products.map(p => (
                <TableRow key={p.id} className="[&>td]:py-3 [&>td]:text-sm">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <ProductImagePreview
                        src={p.coverImageUrl}
                        alt={p.name}
                        className="h-14 w-14"
                        label={translate("预览商品图片", "Preview product image")}
                      />
                      <span className="text-base font-semibold leading-snug">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={TYPE_BADGES[p.type]} variant="secondary">
                      {getProductTypeLabel(p.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.productMode === "variant" ? translate("多规格", "Variant") : translate("单规格", "Simple")}</Badge>
                  </TableCell>
                  <TableCell>
                    {categories?.find(c => c.id === p.categoryId)?.[lang === "zh" ? "nameZh" : "nameEn"] || translate("—", "—")}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.keyword}</code>
                  </TableCell>
                  <TableCell>
                    {p.type === "gift" ? translate("免费", "Free") : `RM ${p.sellingPrice || "0"}`}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGES[p.status]} variant="secondary">
                      {translate(RAW_STATUS_LABELS[p.status]?.zh, RAW_STATUS_LABELS[p.status]?.en) || p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.type === "physical" ? (
                      <TooltipProvider>
                        <div className="text-sm space-y-0.5">
                          <div>{translate("存库", "Stock")}: <span className="font-medium">{p.stockQuantity ?? 0}</span></div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="cursor-pointer text-blue-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => setOrderDetailsTarget({ productId: p.id, productName: p.name, type: "ordered" })}
                              >
                                {translate("已下单", "Ordered")}: <span className="font-medium">{p.orderedCount ?? 0}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="text-xs space-y-0.5">
                                <div className="font-medium">{translate("已下单包含以下订单状态", "Ordered includes these order statuses")}:</div>
                                <div>• {translate("挂单 / Hold Order", "Hold Order")}</div>
                                <div>• {translate("待汇款 / Pending", "Pending")}</div>
                                <div>• {translate("保留订单 / Reserved", "Reserved")}</div>
                                <div>• {translate("待审核付款凭证 / Receipt Uploaded", "Receipt Uploaded")}</div>
                                <div>• {translate("部分汇款 / Partial Payment", "Partial Payment")}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="cursor-pointer text-amber-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => setOrderDetailsTarget({ productId: p.id, productName: p.name, type: "paid" })}
                              >
                                {translate("已汇款", "Paid")}: <span className="font-medium">{p.paidCount ?? 0}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="text-xs space-y-0.5">
                                <div className="font-medium">{translate("已汇款包含以下订单状态", "Paid includes these order statuses")}:</div>
                                <div>• {translate("待备货 / Packing", "Packing")}</div>
                                <div>• {translate("预约发货 / Scheduled", "Scheduled")}</div>
                                <div>• {translate("部分发货中尚未发出的数量", "Unshipped quantities in partial shipments")}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="cursor-pointer text-green-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => setOrderDetailsTarget({ productId: p.id, productName: p.name, type: "completed" })}
                              >
                                {translate("已完成", "Completed")}: <span className="font-medium">{p.completedCount ?? 0}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="text-xs space-y-0.5">
                                <div className="font-medium">{translate("已完成包含以下订单状态", "Completed includes these order statuses")}:</div>
                                <div>• {translate("部分发货中已发出的数量", "Shipped quantities in partial shipments")}</div>
                                <div>• {translate("已发货 / Shipped", "Shipped")}</div>
                                <div>• {translate("已完成 / Completed", "Completed")}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    ) : translate("—", "—")}
                  </TableCell>
                  <TableCell>
                    {p.type === "physical" ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!p.allowOversold}
                          disabled={updateMutation.isPending}
                          onCheckedChange={(allowOversold) => updateMutation.mutate({ id: p.id, allowOversold })}
                          aria-label={translate(`允许「{name}」超卖`, `Allow oversold for "{name}"`, { name: p.name })}
                        />
                        <span className={`text-xs font-medium ${p.allowOversold ? "text-amber-700" : "text-muted-foreground"}`}>
                          {p.allowOversold ? translate("已开启", "On") : translate("未开启", "Off")}
                        </span>
                      </div>
                    ) : translate("—", "—")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.isFeatured && <Badge variant="default">{translate("推荐", "Featured")}</Badge>}
                      {p.isSpecial && <Badge className="bg-orange-100 text-orange-700">{translate("特价", "Special")}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} title={translate("编辑", "Edit")}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateMutation.mutate({ id: p.id })} title={translate("复制", "Duplicate")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      {p.type === "physical" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setStockLogTarget({ productId: p.id, productName: p.name })}
                          title={translate("库存操作日志", "Stock operation log")}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      )}
                      {p.type === "membership" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setCurrentProductId(p.id); setShowMemberLinkDialog(true); }}
                          title={translate("会员链接", "Member Link")}
                        >
                          <LinkIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          if (confirm(translate(`确定删除「{name}」吗？`, `Are you sure you want to delete "{name}"?`, { name: p.name }))) {
                            deleteMutation.mutate({ id: p.id });
                          }
                        }}
                        title={translate("删除", "Delete")}
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

      <Dialog open={!!orderDetailsTarget} onOpenChange={(open) => { if (!open) setOrderDetailsTarget(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {orderDetailsTarget?.productName} · {orderDetailsTarget?.type === "ordered"
                ? translate("已下单订单明细", "Ordered Details")
                : orderDetailsTarget?.type === "paid"
                  ? translate("已汇款订单明细", "Paid Details")
                  : translate("已完成订单明细", "Completed Details")}
            </DialogTitle>
          </DialogHeader>
          {orderDetailsQuery.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{translate("加载订单明细中...", "Loading order details...")}</div>
          ) : orderDetailsQuery.isError ? (
            <div className="py-10 text-center text-sm text-destructive">{translate("无法读取订单明细，请稍后重试。", "Unable to load order details. Please try again.")}</div>
          ) : (orderDetailsQuery.data?.length ?? 0) === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{translate("目前没有符合此状态的订单。", "No orders match this status.")}</div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate("订单号", "Order No.")}</TableHead>
                    <TableHead>{translate("客户", "Customer")}</TableHead>
                    <TableHead>{translate("状态", "Status")}</TableHead>
                    <TableHead className="text-right">{translate("数量", "Qty")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderDetailsQuery.data?.map((detail) => (
                    <TableRow key={`${detail.orderId}-${detail.orderNumber}`}>
                      <TableCell className="font-medium">{detail.orderNumber}</TableCell>
                      <TableCell>
                        <div>{detail.customerName}</div>
                        {detail.customerPhone && <div className="text-xs text-muted-foreground">{detail.customerPhone}</div>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{getPhysicalStatusLabel(detail.physicalStatus)}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{detail.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDetailsTarget(null)}>{translate("关闭", "Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!stockLogTarget} onOpenChange={(open) => { if (!open) setStockLogTarget(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{stockLogTarget?.productName} · {translate("库存操作日志", "Stock Operation Log")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {translate("此处为只读审计记录。库存数量只能通过进货批次、订单、退款或获授权的库存异常流程变动。", "This is a read-only audit record. Stock can only change through purchase batches, orders, refunds, or authorized stock-exception workflows.")}
          </p>
          {stockLogQuery.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{translate("加载库存日志中...", "Loading stock log...")}</div>
          ) : stockLogQuery.isError ? (
            <div className="py-10 text-center text-sm text-destructive">{translate("无法读取库存日志，请稍后重试。", "Unable to load stock log. Please try again.")}</div>
          ) : (stockLogQuery.data?.length ?? 0) === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{translate("暂时没有可显示的库存异常或售后调整记录。", "There are no stock-exception or after-sales adjustment records yet.")}</div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{translate("时间", "Time")}</TableHead>
                  <TableHead>{translate("变动", "Change")}</TableHead>
                  <TableHead>{translate("原因", "Reason")}</TableHead>
                  <TableHead>{translate("操作人", "Operator")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(stockLogQuery.data ?? []).map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}</TableCell>
                      <TableCell className={Number(entry.quantityChange) >= 0 ? "font-medium text-emerald-700" : "font-medium text-destructive"}>{Number(entry.quantityChange) >= 0 ? "+" : ""}{entry.quantityChange}</TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal break-words">{entry.reason || entry.remark || entry.adjustmentType || "—"}</TableCell>
                      <TableCell>{entry.adjustedBy || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setStockLogTarget(null)}>{translate("关闭", "Close")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {translate(`共 {totalCount} 件商品，第 {page} / {totalPages} 页`, `{totalCount} items in total, page {page} / {totalPages}`, { totalCount: totalCount, page: page + 1, totalPages: totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
              {translate("上一页", "Previous Page")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>
              {translate("下一页", "Next Page")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Product Editor Dialog - Step Wizard */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? translate("编辑商品", "Edit Product") : translate("新增商品", "Add Product")}</DialogTitle>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
            {RAW_STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer hover:opacity-80 ${
                    i === step ? "bg-primary text-primary-foreground" :
                    i < step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium">
                    {i < step ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {translate(s.zh, s.en)}
                </button>
                {i < RAW_STEPS.length - 1 && <div className="w-2 h-px bg-border" />}
              </div>
            ))}
          </div>

          {/* Loading state for edit */}
          {editingId && detailQuery.isLoading ? (
            <div className="text-center py-12 text-muted-foreground">{translate("加载商品详情中...", "Loading product details...")}</div>
          ) : (
            <>
              {/* Step Content */}
              <div className="min-h-[300px]">
                {/* Step 0: Basic Info */}
                {step === 0 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{translate("商品名称", "Product Name")} *</Label>
                        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={translate("商品名称", "Product Name")} />
                      </div>
                      <div>
                        <Label>{translate("商品类型", "Product Type")} *</Label>
                        <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RAW_PRODUCT_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{translate(t.zh, t.en)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{translate("商品模式", "Product Mode")} *</Label>
                        <Select value={form.productMode} onValueChange={(v: any) => setForm({ ...form, productMode: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simple">{translate("单规格 (Simple)", "Simple (Simple)")}</SelectItem>
                            <SelectItem value="variant">{translate("多规格 (Variant)", "Variant (Variant)")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{translate("商品分类", "Product Category")}</Label>
                        <Select
                          value={form.categoryId?.toString() || "none"}
                          onValueChange={(v) => setForm({ ...form, categoryId: v === "none" ? undefined : parseInt(v) })}
                        >
                          <SelectTrigger><SelectValue placeholder={translate("选择分类", "Select Category")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{translate("无分类", "No Category")}</SelectItem>
                            {categories?.map(c => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.nameZh}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{translate("销售单位", "Sales Unit")}</Label>
                        <Select
                          value={form.unitId?.toString() || "none"}
                          onValueChange={(v) => setForm({ ...form, unitId: v === "none" ? undefined : parseInt(v) })}
                        >
                          <SelectTrigger><SelectValue placeholder={translate("选择单位", "Select Unit")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{translate("无单位", "No Unit")}</SelectItem>
                            {units?.map(u => (
                              <SelectItem key={u.id} value={u.id.toString()}>{u.nameZh}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{translate("关键词", "Keyword")} *</Label>
                        <div className="relative">
                          <Input
                            value={form.keyword}
                            onChange={(e) => setForm({ ...form, keyword: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                            placeholder={translate("自动大写去空格", "Auto uppercase and remove spaces")}
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
                          <p className="text-xs text-red-500 mt-1">{translate("关键词已被使用", "Keyword already in use")}</p>
                        )}
                        {/* Keyword Channels */}
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-1.5">{translate("关键词适用渠道", "Keyword Channels")}</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: "fb_live", label: translate("FB直播", "FB Live") },
                              { value: "fb_post", label: translate("FB贴文", "FB Post") },
                              { value: "fb_reel", label: translate("FB Reel", "FB Reel") },
                              { value: "messenger", label: translate("Messenger", "Messenger") },
                              { value: "whatsapp", label: translate("WhatsApp", "WhatsApp") },
                            ].map(ch => {
                              const active = form.keywordChannels.includes(ch.value);
                              return (
                                <button
                                  key={ch.value}
                                  type="button"
                                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                    active
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                                  }`}
                                  onClick={() => {
                                    setForm({
                                      ...form,
                                      keywordChannels: active
                                        ? form.keywordChannels.filter((c: string) => c !== ch.value)
                                        : [...form.keywordChannels, ch.value],
                                    });
                                  }}
                                >
                                  {ch.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* V2: Special, Presale, Standalone Shipping */}
                    {isPhysical && (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <Label>{translate("特价商品", "Special Price")}</Label>
                            <p className="text-xs text-muted-foreground">{translate("商城显示特价标记", "Show special price tag in mall")}</p>
                          </div>
                          <Switch checked={form.isSpecial} onCheckedChange={(v) => setForm({ ...form, isSpecial: v })} />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <Label>{translate("允许预售", "Allow Presale")}</Label>
                            <p className="text-xs text-muted-foreground">{translate("库存不足时可预售", "Allow pre-order when out of stock")}</p>
                          </div>
                          <Switch checked={form.allowPresale} onCheckedChange={(v) => setForm({ ...form, allowPresale: v })} />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <Label>{translate("单颗邮寄", "Standalone Shipping")}</Label>
                            <p className="text-xs text-muted-foreground">{translate("单独包裹计算", "Separate package shipping")}</p>
                          </div>
                          <Switch checked={form.allowStandaloneShipping} onCheckedChange={(v) => setForm({ ...form, allowStandaloneShipping: v })} />
                        </div>
                        {form.allowStandaloneShipping && (
                          <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
                            <div>
                              <Label>{translate("运费方式", "Shipping Method")}</Label>
                              <Select value={form.standaloneShippingMethod || "fixed_fee"} onValueChange={(v) => setForm({ ...form, standaloneShippingMethod: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixed_fee">{translate("固定运费", "Fixed Fee")}</SelectItem>
                                  <SelectItem value="free_shipping">{translate("免邮", "Free Shipping")}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {form.standaloneShippingMethod === "fixed_fee" && (
                              <div>
                                <Label>{translate("固定运费金额 (RM)", "Fixed Shipping Fee (RM)")}</Label>
                                <Input type="number" step="0.01" placeholder="0.00" value={form.standaloneShippingFee || ""}
                                  onChange={(e) => setForm({ ...form, standaloneShippingFee: e.target.value })} />
                              </div>
                            )}
                          </div>
                                                )}
                      </div>
                    )}
                    {isPhysical && (
                      <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
                        <div>
                          <Label>{translate("销售模式", "Sales Mode")}</Label>
                          <Select value={form.salesMode} onValueChange={(v) => setForm({ ...form, salesMode: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">{translate("普通现货", "Normal Stock")}</SelectItem>
                              <SelectItem value="presale">{translate("可预售", "Presale")}</SelectItem>
                              <SelectItem value="import_preorder">{translate("中国进口代购", "China Import Pre-order")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {form.salesMode === "import_preorder" && (
                          <div className="space-y-3">
                            <div>
                              <Label>{translate("预计等待时间", "Estimated Wait Time")}</Label>
                              <Input value={form.preorderWaitDays} onChange={(e) => setForm({ ...form, preorderWaitDays: e.target.value })} placeholder={translate("例如: 30~45天", "e.g. 30~45 days")} />
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-3">
                              <div>
                                <Label>{translate("到货后现货销售", "Spot Sale After Arrival")}</Label>
                                <p className="text-xs text-muted-foreground">{translate("到货后剩余库存可现货销售", "Remaining stock can be sold as normal after arrival")}</p>
                              </div>
                              <Switch checked={form.spotSaleEnabled} onCheckedChange={(v) => setForm({ ...form, spotSaleEnabled: v })} />
                            </div>
                            {form.spotSaleEnabled && (
                              <div>
                                <Label>{translate("现货销售数量", "Spot Sale Quantity")}</Label>
                                <Input type="number" value={form.spotSaleQty} onChange={(e) => setForm({ ...form, spotSaleQty: Number(e.target.value) })} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {isPhysical && form.isSpecial && (
                      <div>
                        <Label>{translate("特价金额 (RM)", "Special Price (RM)")}</Label>
                        <Input type="number" placeholder="0.00" value={form.specialPrice}
                          onChange={(e) => setForm({ ...form, specialPrice: e.target.value })} />
                      </div>
                    )}
                  </div>
                )}

                {/* Step 1: Images & Description */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <Label>{translate("封面图片", "Cover Image")}</Label>
                      <div className="flex items-center gap-3">
                        <Input value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} placeholder={translate("https://... 或点击上传", "https://... or click to upload")} />
                        <label className={`cursor-pointer inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${uploadingCover ? "pointer-events-none opacity-50" : ""}`}>
                          {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          {uploadingCover ? translate("上传中...", "Uploading...") : translate("上传", "Upload")}
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            // 立即显示本地预览
                            const localPreviewUrl = URL.createObjectURL(file);
                            setCoverPreview(localPreviewUrl);
                            setUploadingCover(true);
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
                                  toast.success(translate("图片已上传", "Image uploaded"));
                                } else {
                                  toast.error(translate("上传失败", "Upload failed"));
                                }
                              } catch { toast.error(translate("上传失败，请重试", "Upload failed, please try again")); }
                              finally {
                                setUploadingCover(false);
                                setCoverPreview("");
                                URL.revokeObjectURL(localPreviewUrl);
                              }
                            };
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                      </div>
                      {/* 上传中显示 Spinner + 本地预览 */}
                      {uploadingCover && (
                        <div className="mt-2 flex items-center gap-2">
                          {coverPreview && (
                            <img src={coverPreview} alt={translate("上传中预览", "Uploading preview")} className="h-32 w-32 rounded-lg object-cover border opacity-60" />
                          )}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner className="h-4 w-4" />
                            {translate("正在上传图片...", "Uploading image...")}
                          </div>
                        </div>
                      )}
                      {/* 上传完成后显示服务器图片 */}
                      {!uploadingCover && form.coverImageUrl && (
                        <ProductImagePreview
                          src={form.coverImageUrl}
                          alt={translate("封面预览", "Cover Preview")}
                          className="mt-2 h-32 w-32"
                          label={translate("预览并缩放封面图片", "Preview and zoom cover image")}
                        />
                      )}
                    </div>

                    {/* Multiple product images */}
                    <div>
                      <Label>{translate("商品照片（多张）", "Product Images (Multiple)")}</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {form.productImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <ProductImagePreview
                              src={img}
                              alt={`${form.name || translate("商品", "Product")} ${idx + 1}`}
                              className="h-20 w-20"
                              label={translate("预览并缩放商品图片", "Preview and zoom product image")}
                            />
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, productImages: form.productImages.filter((_, i) => i !== idx) })}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >×</button>
                          </div>
                        ))}
                        <label className={`cursor-pointer ${uploadingImages ? "pointer-events-none" : ""}`}>
                          <div className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground hover:border-primary transition-colors">
                            {uploadingImages ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Upload className="h-5 w-5" />}
                          </div>
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingImages(true);
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
                                  setForm({ ...form, productImages: [...form.productImages, data.url] });
                                  toast.success(translate("图片已上传", "Image uploaded"));
                                } else { toast.error(translate("上传失败", "Upload failed")); }
                              } catch { toast.error(translate("上传失败，请重试", "Upload failed, please try again")); }
                              finally { setUploadingImages(false); }
                            };
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{translate("可上传多张商品照片，商城将轮播展示", "Upload multiple images; mall will display as a gallery")}</p>
                    </div>

                    <div>
                      <Label>{translate("商品影片", "Product Video")}</Label>
                      <div className="flex items-center gap-3">
                        <Input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder={translate("https://... 或点击上传影片", "https://... or click to upload video")} />
                        <label className={`cursor-pointer inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${uploadingVideo ? "pointer-events-none opacity-50" : ""}`}>
                          {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {uploadingVideo ? translate("上传中...", "Uploading...") : translate("上传影片", "Upload Video")}
                          <input type="file" accept="video/*" className="hidden" onChange={async (ev) => {
                            const file = ev.target.files?.[0];
                            if (!file) return;
                            if (file.size > 50 * 1024 * 1024) {
                              toast.error(translate("影片大小不能超过 50MB", "Video size cannot exceed 50MB"));
                              return;
                            }
                            setUploadingVideo(true);
                            const reader = new FileReader();
                            reader.onload = async () => {
                              const base64 = reader.result as string;
                              try {
                                const res = await fetch("/api/upload", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ base64, filename: file.name }),
                                });
                                if (res.ok) {
                                  const data = await res.json();
                                  setForm({ ...form, videoUrl: data.url });
                                  toast.success(translate("影片已上传", "Video uploaded"));
                                } else {
                                  toast.error(translate("上传失败", "Upload failed"));
                                }
                              } catch {
                                toast.error(translate("上传失败，请重试", "Upload failed, please try again"));
                              }
                              finally { setUploadingVideo(false); }
                            };
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                      </div>
                      {form.videoUrl && (
                        <div className="mt-2">
                          <video src={form.videoUrl} controls className="w-full max-w-md rounded-lg" />
                          <Button variant="ghost" size="sm" className="mt-1 text-destructive" onClick={() => setForm({ ...form, videoUrl: "" })}>
                            {translate("移除影片", "Remove Video")}
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{translate("支持 MP4/MOV/WebM 格式，最大 50MB。商城将在商品详情页播放影片。", "Supports MP4/MOV/WebM, max 50MB. Mall will play video on product detail page.")}</p>
                    </div>

                    <div>
                      <Label>{translate("详细描述", "Detailed Description")}</Label>
                      <Textarea value={form.fullDescZh} onChange={(e) => setForm({ ...form, fullDescZh: e.target.value })} rows={4} placeholder={translate("如不填写商城不会显示", "Leave empty to hide in mall")} />
                      <p className="text-xs text-muted-foreground mt-1">{translate("只需填写中文，英文版商城将自动翻译（商品名不翻译）", "Write in Chinese; English mall will auto-translate (product name excluded)")}</p>
                    </div>

                    {/* Structured care fields */}
                    {isPhysical && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{translate("光线", "Light")}</Label>
                          <Input value={form.lightDesc} onChange={(e) => setForm({ ...form, lightDesc: e.target.value })} placeholder={translate("如：半阴、散射光", "e.g. Partial shade, indirect light")} />
                        </div>
                        <div>
                          <Label>{translate("水分", "Water")}</Label>
                          <Input value={form.waterDesc} onChange={(e) => setForm({ ...form, waterDesc: e.target.value })} placeholder={translate("如：每2-3天浇一次", "e.g. Water every 2-3 days")} />
                        </div>
                        <div>
                          <Label>{translate("施肥", "Fertilizer")}</Label>
                          <Input value={form.fertilizerDesc} onChange={(e) => setForm({ ...form, fertilizerDesc: e.target.value })} placeholder={translate("如：每月施一次缓释肥", "e.g. Slow-release fertilizer monthly")} />
                        </div>
                        <div>
                          <Label>{translate("修剪", "Pruning")}</Label>
                          <Input value={form.pruningDesc} onChange={(e) => setForm({ ...form, pruningDesc: e.target.value })} placeholder={translate("如：定期修剪枯叶", "e.g. Trim dead leaves regularly")} />
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {translate("提示：以上字段如不填写，商城不会显示对应区域。", "Note: Fields left empty will not be shown in the mall.")}
                    </p>

                    {/* V5: AI Tags & Selling Points */}
                    {isPhysical && (
                      <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">{translate("AI 智能推荐设置", "AI Recommendation Settings")}</span>
                        </div>
                        <div>
                          <Label>{translate("AI Tags（AI 标签）", "AI Tags")}</Label>
                          <p className="text-xs text-muted-foreground mb-2">{translate("用于 AI 商品推荐匹配。客户描述需求时，AI 会根据这些标签筛选商品。", "Used by AI to match products when customers describe their needs.")}</p>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {form.aiTags.map((tag, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                {tag}
                                <button type="button" onClick={() => setForm({ ...form, aiTags: form.aiTags.filter((_, i) => i !== idx) })} className="text-primary/50 hover:text-primary">
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              id="ai-tag-input"
                              placeholder={translate("输入标签后按 Enter，如：办公室、耐阴、新手", "Type a tag and press Enter, e.g. office, low-light, beginner")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const input = e.target as HTMLInputElement;
                                  const val = input.value.trim();
                                  if (val && !form.aiTags.includes(val)) {
                                    setForm({ ...form, aiTags: [...form.aiTags, val] });
                                  }
                                  input.value = "";
                                }
                              }}
                            />
                            <Button type="button" variant="outline" size="sm" onClick={() => {
                              const input = document.getElementById("ai-tag-input") as HTMLInputElement;
                              const val = input?.value?.trim();
                              if (val && !form.aiTags.includes(val)) {
                                setForm({ ...form, aiTags: [...form.aiTags, val] });
                                input.value = "";
                              }
                            }}>{translate("添加", "Add")}</Button>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {translate("常用：", "Quick: ")}{["办公室", "客厅", "卧室", "阳台", "送礼", "新手", "耐阴", "耐旱", "宠物安全", "空气净化", "大型植物", "小型植物"].map(t => (
                              <button key={t} type="button" onClick={() => { if (!form.aiTags.includes(t)) setForm({ ...form, aiTags: [...form.aiTags, t] }); }} className="text-xs text-primary/60 hover:text-primary hover:underline">
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label>{translate("AI Selling Points（AI 推荐卖点）", "AI Selling Points")}</Label>
                          <p className="text-xs text-muted-foreground mb-2">{translate("AI 回复时优先引用此内容，不会自行编造卖点。", "AI will quote this text in replies instead of inventing selling points.")}</p>
                          <Textarea
                            value={form.aiSellingPoints}
                            onChange={(e) => setForm({ ...form, aiSellingPoints: e.target.value })}
                            rows={2}
                            placeholder={translate("如：非常适合新手、办公室热卖、最容易照顾、净化空气效果佳", "e.g. Perfect for beginners, office bestseller, easiest to care for, great air purifier")}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Price & Cost */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>{translate("售价 (RM)", "Selling Price (RM)")} {!isGift && "*"}</Label>
                        <Input type="number" placeholder="0.00" value={isGift ? "0" : form.sellingPrice}
                          onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} disabled={isGift} />
                      </div>
                      <div>
                        <Label>{translate("划线价 (RM)", "Compare At Price (RM)")}</Label>
                        <Input type="number" placeholder="0.00" value={form.compareAtPrice}
                          onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} disabled={isGift} />
                      </div>
                      <div>
                        <Label>{translate("会员价 (RM)", "Member Price (RM)")}</Label>
                        <Input type="number" placeholder="0.00" value={form.memberPrice}
                          onChange={(e) => setForm({ ...form, memberPrice: e.target.value })} disabled={isGift} />
                      </div>
                    </div>

                    <div>
                      <Label>{translate("当前成本 (RM)", "Current Cost (RM)")}</Label>
                      <Input type="number" placeholder="0.00" value={form.currentCost}
                        readOnly disabled={isVirtual} className="bg-muted/50 cursor-not-allowed" />
                      <p className="text-xs text-muted-foreground mt-1">{translate("由进货管理自动更新（FIFO），此处仅供参考", "Auto-updated from purchase orders (FIFO), read-only reference")}</p>
                    </div>

                    {/* Price Simulator */}
                    {!isGift && !isVirtual && form.currentCost && (
                      <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <h4 className="font-medium text-sm">{translate("价格模拟器", "Price Simulator")}</h4>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>{translate("测试售价 (RM)", "Test Selling Price (RM)")}</Label>
                            <Input type="number" placeholder={form.sellingPrice || "0.00"} value={simulatorPrice}
                              onChange={(e) => setSimulatorPrice(e.target.value)} />
                          </div>
                          <div>
                            <Label>{translate("预计利润", "Estimated Profit")}</Label>
                            <div className={`flex items-center gap-1.5 text-lg font-bold ${profitLevel.color}`}>
                              <profitLevel.icon className="h-4 w-4" />
                              RM {simulatorProfit.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <Label>{translate("利润率", "Profit Margin")}</Label>
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
                            <span className="text-xs text-orange-600">{translate("利润率低于 20%，建议调整售价或成本", "Profit margin is below 20%; consider adjusting the selling price or cost")}</span>
                          )}
                          {simulatorProfit <= 0 && simulatorPrice && (
                            <span className="text-xs text-red-600">{translate("当前售价低于成本，处于亏损状态", "The current selling price is below cost, resulting in a loss")}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* V4: Wholesale & Agent Pricing */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>{translate("批发价 (RM)", "Wholesale Price (RM)")}</Label>
                        <Input type="number" placeholder="自动=售价×50%" value={form.wholesalePrice}
                          onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} disabled={isGift} />
                        <p className="text-xs text-muted-foreground mt-1">{translate("留空自动计算", "Auto-calc if empty")}</p>
                      </div>
                      <div>
                        <Label>{translate("代理价 (RM)", "Agent Price (RM)")}</Label>
                        <Input type="number" placeholder="自动=售价×70%" value={form.agentPrice}
                          onChange={(e) => setForm({ ...form, agentPrice: e.target.value })} disabled={isGift} />
                        <p className="text-xs text-muted-foreground mt-1">{translate("留空自动计算", "Auto-calc if empty")}</p>
                      </div>
                      <div>
                        <Label>{translate("最低批发量 (MOQ)", "Min Order Qty (MOQ)")}</Label>
                        <Input type="number" placeholder="0" value={form.moq}
                          onChange={(e) => setForm({ ...form, moq: parseInt(e.target.value) || 0 })} disabled={isGift} />
                        <p className="text-xs text-muted-foreground mt-1">{translate("0=无限制", "0=No limit")}</p>
                      </div>
                    </div>

                    {/* V4: Special Price Date Range */}
                    {form.isSpecial && form.specialPrice && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{translate("特价开始日期", "Special Price Start Date")}</Label>
                          <Input type="date" value={form.specialPriceStartDate}
                            onChange={(e) => setForm({ ...form, specialPriceStartDate: e.target.value })} />
                        </div>
                        <div>
                          <Label>{translate("特价结束日期", "Special Price End Date")}</Label>
                          <Input type="date" value={form.specialPriceEndDate}
                            onChange={(e) => setForm({ ...form, specialPriceEndDate: e.target.value })} />
                          <p className="text-xs text-muted-foreground mt-1">{translate("结束后自动恢复原价", "Auto-revert after end date")}</p>
                        </div>
                      </div>
                    )}

                    {/* V4: Price Preview (价格预览) */}
                    {!isGift && form.sellingPrice && (
                      <div className="p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-500" />
                          {translate("价格预览", "Price Preview")}
                        </h4>
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div className="p-2 rounded bg-background">
                            <div className="text-xs text-muted-foreground">{translate("普通客户", "Retail")}</div>
                            <div className="font-bold">RM {(parseFloat(form.sellingPrice) || 0).toFixed(2)}</div>
                          </div>
                          <div className="p-2 rounded bg-background">
                            <div className="text-xs text-muted-foreground">{translate("会员", "Member")}</div>
                            <div className="font-bold">RM {(parseFloat(form.memberPrice || form.sellingPrice) || 0).toFixed(2)}</div>
                          </div>
                          <div className="p-2 rounded bg-background">
                            <div className="text-xs text-muted-foreground">{translate("批发", "Wholesale")}</div>
                            <div className="font-bold">RM {(parseFloat(form.wholesalePrice) || (parseFloat(form.sellingPrice) || 0) * 0.5).toFixed(2)}</div>
                          </div>
                          <div className="p-2 rounded bg-background">
                            <div className="text-xs text-muted-foreground">{translate("代理", "Agent")}</div>
                            <div className="font-bold">RM {(parseFloat(form.agentPrice) || (parseFloat(form.sellingPrice) || 0) * 0.7).toFixed(2)}</div>
                          </div>
                        </div>
                        {form.isSpecial && form.specialPrice && (
                          <div className="text-xs text-orange-600 font-medium">
                            {translate("⚠ 特价生效时，所有客户统一显示特价", "⚠ When special price is active, all customers see special price")}
                          </div>
                        )}
                      </div>
                    )}

                    {/* V4: Product Visibility (可见对象) */}
                    <div>
                      <Label>{translate("可见对象", "Visible To")}</Label>
                      <div className="flex flex-wrap gap-3 mt-2">
                        {[
                          { value: "retail", label: translate("普通", "Retail") },
                          { value: "member", label: translate("会员链接", "Member Link") },
                          { value: "wholesale", label: translate("批发", "Wholesale") },
                          { value: "agent", label: translate("代理", "Agent") },
                        ].map((opt) => (
                          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.visibleTo.includes(opt.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setForm({ ...form, visibleTo: [...form.visibleTo, opt.value] });
                                } else {
                                  setForm({ ...form, visibleTo: form.visibleTo.filter((v) => v !== opt.value) });
                                }
                              }}
                              className="rounded border-input"
                            />
                            <span className="text-sm">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Price Visibility */}
                    <div>
                      <Label>{translate("价格显示设置", "Price Display Settings")}</Label>
                      <Select value={form.priceVisibility} onValueChange={(v: any) => setForm({ ...form, priceVisibility: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="show">{translate("公开显示价格", "Show Price Publicly")}</SelectItem>
                          <SelectItem value="hide">{translate("隐藏价格（询价）", "Hide Price (Enquiry Required)")}</SelectItem>
                          <SelectItem value="member_link">{translate("仅会员链接可见", "Visible via Member Link Only")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Physical: weight & dimensions */}
                    {!isVirtual && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{translate("重量 (kg)", "Weight (kg)")}</Label>
                            <Input type="number" placeholder="0.00" value={form.weightKg}
                              onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
                          </div>
                          <div>
                            <Label>{translate("库存数量", "Stock Quantity")}</Label>
                            <Input type="number" value={form.stockQuantity} disabled />
                            <p className="text-xs text-muted-foreground mt-1">{translate("由进货管理自动更新", "Auto-updated by Purchase Management")}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <Label>{translate("口径 (cm)", "Diameter (cm)")}</Label>
                            <Input type="number" placeholder="0" value={form.dimensions.diameter || ""}
                              onChange={(e) => setForm({ ...form, dimensions: { ...form.dimensions, diameter: e.target.value } })} />
                          </div>
                          <div>
                            <Label>{translate("高度 (cm)", "Height (cm)")}</Label>
                            <Input type="number" placeholder="0" value={form.dimensions.height || ""}
                              onChange={(e) => setForm({ ...form, dimensions: { ...form.dimensions, height: e.target.value } })} />
                          </div>
                          <div>
                            <Label>{translate("长度 (cm)", "Length (cm)")}</Label>
                            <Input type="number" placeholder="0" value={form.dimensions.length || ""}
                              onChange={(e) => setForm({ ...form, dimensions: { ...form.dimensions, length: e.target.value } })} />
                          </div>
                          <div>
                            <Label>{translate("宽度 (cm)", "Width (cm)")}</Label>
                            <Input type="number" placeholder="0" value={form.dimensions.width || ""}
                              onChange={(e) => setForm({ ...form, dimensions: { ...form.dimensions, width: e.target.value } })} />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Membership-specific */}
                    {isVirtual && (
                      <div className="space-y-4 p-4 border rounded-lg bg-purple-50/50 dark:bg-purple-950/20">
                        <h3 className="font-medium text-sm">{translate("会员商品专属设置", "Membership Product Exclusive Settings")}</h3>
                        <p className="text-xs text-muted-foreground">{translate("会员商品不计算重量、运费，不进入配货流程，无库存限制", "Membership products do not calculate weight or shipping, do not enter the distribution process, and have no inventory restrictions")}</p>
                        <div>
                          <Label>{translate("会员收费金额", "Membership Fee Amount")}</Label>
                          <Input type="number" placeholder="0.00" value={form.sellingPrice}
                            onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
                        </div>
                        <div>
                          <Label>{translate("会员介绍", "Membership Introduction")}</Label>
                          <Textarea value={form.membershipIntro} onChange={(e) => setForm({ ...form, membershipIntro: e.target.value })} rows={3} placeholder={translate("详细描述会员权益和福利...", "Describe membership rights and benefits in detail...")} />
                        </div>
                        <div>
                          <Label>{translate("Telegram 会员流程链接", "Telegram Membership Flow Link")}</Label>
                          <Input placeholder="https://t.me/..." value={form.telegramFlowLink}
                            onChange={(e) => setForm({ ...form, telegramFlowLink: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <Label>{translate("允许单独购买", "Allow Standalone Purchase")}</Label>
                              <p className="text-xs text-muted-foreground">{translate("客户可只购买会员商品", "Customers can purchase membership products only")}</p>
                            </div>
                            <Switch checked={form.allowStandalonePurchase}
                              onCheckedChange={(v) => setForm({ ...form, allowStandalonePurchase: v })} />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <Label>{translate("允许混合结账", "Allow Mixed Checkout")}</Label>
                              <p className="text-xs text-muted-foreground">{translate("可与普通商品一起结账", "Can be checked out with regular products")}</p>
                            </div>
                            <Switch checked={form.allowMixedCheckout}
                              onCheckedChange={(v) => setForm({ ...form, allowMixedCheckout: v })} />
                          </div>
                        </div>
                      </div>
                    )}

                    {isGift && (
                      <div className="p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                        <h3 className="font-medium text-sm">{translate("赠品设置", "Gift Product Settings")}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{translate("赠品有库存限制，需计算运费，但不收取商品费用（价格为0）。赠品会与实体商品一起计算运费和免邮门槛。", "Gift products have inventory limits, require shipping calculation, but do not charge product fees (price is 0). Gift products will be calculated with physical products for shipping and free shipping thresholds.")}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Variants */}
                {step === 3 && (
                  <div className="space-y-4">
                    {!isVariant ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>{translate("此商品为单规格模式，无需设置规格。", "This product is in simple mode, no variants needed.")}</p>
                        <p className="text-xs mt-2">{translate("如需多规格，请在「基本资料」步骤中切换为 Variant 模式", "To enable variants, please switch to Variant mode in the 'Basic Info' step.")}</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">{translate("规格列表", "Variant List")}</h3>
                          <Button size="sm" onClick={openAddVariant} disabled={!editingId}>
                            <Plus className="h-4 w-4 mr-1" />
                            {translate("添加规格", "Add Variant")}
                          </Button>
                        </div>
                        {!editingId && (
                          <p className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/20 p-2 rounded">
                            {translate("请先保存商品后再添加规格", "Please save the product before adding variants")}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">{translate("规格关键词 = 商品关键词 + 规格关键词（自动组合）", "Variant Keyword = Product Keyword + Variant Keyword (auto-combined)")}</p>
                        {variants.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">{translate("暂无规格", "No variants yet")}</p>
                        ) : (
                          <div className="space-y-2">
                            {variants.map((v, i) => (
                              <div key={v.id || i} className="flex items-center gap-3 p-3 border rounded-lg">
                                <div className="flex-1">
                                  <span className="font-medium text-sm">{lang === "zh" ? v.nameZh || v.name : v.nameEn || v.name}</span>
                                  <div className="flex items-center gap-2 mt-1">
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{v.keyword}</code>
                                    <span className="text-xs text-muted-foreground">SKU: {v.sku}</span>
                                  </div>
                                </div>
                                <span className="text-sm">RM {v.sellingPrice || "—"}</span>
                                <Badge variant="outline">{v.status === "active" ? translate("启用", "Active") : v.status === "inactive" ? translate("停用", "Inactive") : translate("隐藏", "Hidden")}</Badge>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditVariant(v)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8"
                                  onClick={() => { if (confirm(translate("确定删除规格「{name}」？", "Are you sure you want to delete variant \"{name}\"", { name: lang === "zh" ? v.nameZh || v.name : v.nameEn || v.name }))) deleteVariantMutation.mutate({ id: v.id }); }}>
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
                        <Label>{translate("商品状态", "Product Status")}</Label>
                        <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">{translate("草稿", "Draft")}</SelectItem>
                            <SelectItem value="active">{translate("上架", "Active")}</SelectItem>
                            <SelectItem value="inactive">{translate("下架", "Inactive")}</SelectItem>
                            <SelectItem value="out_of_stock">{translate("缺货", "Out of Stock")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{translate("可见性", "Visibility")}</Label>
                        <Select value={form.visibility} onValueChange={(v: any) => setForm({ ...form, visibility: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">{translate("公开", "Public")}</SelectItem>
                            <SelectItem value="link_only">{translate("仅链接可见", "Link Only")}</SelectItem>
                            <SelectItem value="hidden">{translate("隐藏", "Hidden")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label>{translate("推荐商品", "Featured Product")}</Label>
                        <p className="text-xs text-muted-foreground">{translate("在商城首页推荐此商品", "Feature this product on the homepage")}</p>
                      </div>
                      <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label>{translate("同步到商城", "Sync to Mall")}</Label>
                        <p className="text-xs text-muted-foreground">{translate("开启后此商品将在商城中显示", "Enable to show this product in the mall")}</p>
                      </div>
                      <Switch checked={form.syncToMall} onCheckedChange={(v) => setForm({ ...form, syncToMall: v })} />
                    </div>

                    {form.isFeatured && (
                      <div>
                        <Label>{translate("推荐排序权重", "Featured Sort Weight")}</Label>
                        <Input type="number" value={form.featuredSortOrder}
                          onChange={(e) => setForm({ ...form, featuredSortOrder: parseInt(e.target.value) || 0 })} />
                        <p className="text-xs text-muted-foreground mt-1">{translate("数字越小排序越靠前", "Smaller number means higher priority")}</p>
                      </div>
                    )}

                    <div>
                      <Label>{translate("内部备注", "Internal Notes")}</Label>
                      <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                        placeholder={translate("仅后台可见的备注信息", "Notes visible only to backend users")} />
                    </div>
                  </div>
                )}

                {/* Step 5: Preview & Confirm */}
                {step === 5 && (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{translate("商品预览", "Product Preview")}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-start gap-4">
                          {form.coverImageUrl && (
                            <ProductImagePreview
                              src={form.coverImageUrl}
                              alt={form.name || translate("商品封面", "Product cover")}
                              className="h-24 w-24"
                              label={translate("预览并缩放商品封面", "Preview and zoom product cover")}
                            />
                          )}
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{form.name || translate("未命名商品", "Unnamed Product")}</h3>
                              <Badge className={TYPE_BADGES[form.type]} variant="secondary">
                                {getProductTypeLabel(form.type)}
                              </Badge>
                              <Badge variant="outline">{form.productMode === "variant" ? translate("多规格", "Variant") : translate("单规格", "Simple")}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{form.shortDescZh || translate("无描述", "No description")}</p>
                            <div className="flex items-center gap-3 text-sm">
                              {form.isSpecial && form.specialPrice && parseFloat(form.specialPrice) > 0 ? (
                                <>
                                  <span className="font-medium text-orange-600">RM {form.specialPrice}</span>
                                  <span className="line-through text-muted-foreground">RM {form.sellingPrice || "0"}</span>
                                </>
                              ) : (
                                <span className="font-medium">RM {form.sellingPrice || "0"}</span>
                              )}
                              {form.compareAtPrice && parseFloat(form.compareAtPrice) > 0 && (
                                <span className="line-through text-muted-foreground">RM {form.compareAtPrice}</span>
                              )}
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{form.keyword}</code>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                          <div>{translate("分类", "Category")}: {categories?.find(c => c.id === form.categoryId)?.[lang === "zh" ? "nameZh" : "nameEn"] || translate("无", "None")}</div>
                          <div>{translate("状态", "Status")}: {translate(RAW_STATUS_LABELS[form.status]?.zh, RAW_STATUS_LABELS[form.status]?.en)}</div>
                          <div>{translate("可见性", "Visibility")}: {form.visibility === "public" ? translate("公开", "Public") : form.visibility === "link_only" ? translate("仅链接", "Link Only") : translate("隐藏", "Hidden")}</div>
                          <div>{translate("推荐", "Featured")}: {form.isFeatured ? translate("是", "Yes") : translate("否", "No")}</div>
                          {!isVirtual && <div>{translate("库存", "Stock")}: {form.stockQuantity}</div>}
                          {!isVirtual && form.currentCost && (
                            <div>{translate("预计利润", "Estimated Profit")}: <span className={parseFloat(form.sellingPrice) - parseFloat(form.currentCost) >= 0 ? "text-green-600" : "text-red-600"}>RM {(parseFloat(form.sellingPrice) - parseFloat(form.currentCost)).toFixed(2)}</span></div>
                          )}
                        </div>
                        {isVariant && variants.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-sm font-medium mb-2">{translate("规格", "Variants")} ({variants.length})</p>
                            <div className="space-y-1">
                              {variants.map((v, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <span>{lang === "zh" ? v.nameZh || v.name : v.nameEn || v.name}</span>
                                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{v.keyword}</code>
                                  <span className="text-muted-foreground">RM {v.sellingPrice || translate("—", "—")}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {isVirtual && (
                      <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border text-sm">
                        <p className="font-medium">{translate("会员商品提示", "Membership Product Tip")}</p>
                        <p className="text-xs text-muted-foreground mt-1">{translate("保存后可生成会员专属购买链接，通过 Messenger 发送给客户", "After saving, you can generate exclusive member purchase links and send them to customers via Messenger")}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : setDialogOpen(false)}>
                  {step === 0 ? translate("取消", "Cancel") : translate("上一步", "Previous Step")}
                </Button>
                {step < RAW_STEPS.length - 1 ? (
                  <Button onClick={() => setStep(step + 1)} disabled={step === 0 && (!form.name.trim() || !form.keyword.trim() || !keywordAvailable)}>
                    {translate("下一步", "Next Step")}
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingId ? translate("保存", "Save") : translate("创建商品", "Create Product")}
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
            <DialogTitle>{editingVariantId ? translate("编辑规格", "Edit Variant") : translate("新增规格", "Add Variant")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{translate("规格名称", "Variant Name")} *</Label>
                <Input value={variantForm.name} onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })} placeholder={translate("如：红色大盆", "e.g., Red Large Pot")} />
              </div>
              <div>
                <Label>{translate("规格关键词", "Variant Keyword")} *</Label>
                <div className="relative">
                  <Input
                    value={variantForm.keyword}
                    onChange={(e) => setVariantForm({ ...variantForm, keyword: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    placeholder={translate("自动大写去空格", "Auto uppercase and remove spaces")}
                  />
                  {variantForm.keyword && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {variantKeywordAvailable ? <Check className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                    </div>
                  )}
                </div>
                {variantForm.keyword && !variantKeywordAvailable && (
                  <p className="text-xs text-red-500 mt-1">{translate("关键词已被使用", "Keyword already in use")}</p>
                )}
                {variantForm.keyword && (
                  <p className="text-xs text-muted-foreground mt-1">{translate("组合关键词", "Combined Keyword")}: {form.keyword}{variantForm.keyword}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{translate("售价 (RM)", "Selling Price (RM)")}</Label>
                <Input type="number" placeholder={translate("继承商品", "Inherit Product")} value={variantForm.sellingPrice}
                  onChange={(e) => setVariantForm({ ...variantForm, sellingPrice: e.target.value })} />
              </div>
              <div>
                <Label>{translate("划线价 (RM)", "Compare At Price (RM)")}</Label>
                <Input type="number" placeholder={translate("继承商品", "Inherit Product")} value={variantForm.compareAtPrice}
                  onChange={(e) => setVariantForm({ ...variantForm, compareAtPrice: e.target.value })} />
              </div>
              <div>
                <Label>{translate("会员价 (RM)", "Member Price (RM)")}</Label>
                <Input type="number" placeholder={translate("继承商品", "Inherit Product")} value={variantForm.memberPrice}
                  onChange={(e) => setVariantForm({ ...variantForm, memberPrice: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{translate("库存", "Stock")}</Label>
                <Input type="number" value={variantForm.stockQuantity} readOnly aria-describedby="variant-stock-help" className="bg-muted" />
                <p id="variant-stock-help" className="mt-1 text-xs text-muted-foreground">
                  {translate("规格库存由进货批次、订单与库存流水同步，不能在此直接修改。", "Variant stock is synced from purchase batches, orders and inventory records and cannot be edited here.")}
                </p>
              </div>
              <div>
                <Label>{translate("状态", "Status")}</Label>
                <Select value={variantForm.status} onValueChange={(v: any) => setVariantForm({ ...variantForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{translate("启用", "Active")}</SelectItem>
                    <SelectItem value="inactive">{translate("停用", "Inactive")}</SelectItem>
                    <SelectItem value="hidden">{translate("隐藏", "Hidden")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Variant Image */}
            <div>
              <Label>{translate("规格图片", "Variant Image")}</Label>
              <div className="flex items-center gap-3">
                <Input value={variantForm.imageUrl} onChange={(e) => setVariantForm({ ...variantForm, imageUrl: e.target.value })} placeholder={translate("https://... 或点击上传", "https://... or click to upload")} />
                <label className={`cursor-pointer inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${uploadingVariant ? "pointer-events-none opacity-50" : ""}`}>
                  {uploadingVariant ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadingVariant ? translate("上传中...", "Uploading...") : translate("上传", "Upload")}
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    // 立即显示本地预览
                    const localPreviewUrl = URL.createObjectURL(file);
                    setCoverPreview(localPreviewUrl);
                    setUploadingVariant(true);
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
                          setVariantForm({ ...variantForm, imageUrl: data.url });
                          toast.success(translate("图片已上传", "Image uploaded"));
                        } else { toast.error(translate("上传失败", "Upload failed")); }
                      } catch { toast.error(translate("上传失败，请重试", "Upload failed, please try again")); }
                      finally {
                        setUploadingVariant(false);
                        setCoverPreview("");
                        URL.revokeObjectURL(localPreviewUrl);
                      }
                    };
                    reader.readAsDataURL(file);
                  }} />
                </label>
              </div>
              {/* 上传中显示 Spinner + 本地预览 */}
              {uploadingVariant && (
                <div className="mt-2 flex items-center gap-2">
                  {coverPreview && (
                    <img src={coverPreview} alt={translate("上传中预览", "Uploading preview")} className="h-20 w-20 rounded-lg object-cover border opacity-60" />
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="h-4 w-4" />
                    {translate("正在上传图片...", "Uploading image...")}
                  </div>
                </div>
              )}
              {/* 上传完成后显示服务器图片 */}
              {!uploadingVariant && variantForm.imageUrl && (
                <ProductImagePreview
                  src={variantForm.imageUrl}
                  alt={variantForm.name || translate("规格图片", "Variant image")}
                  className="mt-2 h-20 w-20"
                  label={translate("预览并缩放规格图片", "Preview and zoom variant image")}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={handleVariantSubmit} disabled={createVariantMutation.isPending || updateVariantMutation.isPending}>
              {editingVariantId ? translate("保存", "Save") : translate("添加", "Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Links Dialog */}
      <Dialog open={showMemberLinkDialog} onOpenChange={setShowMemberLinkDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{translate("会员购买链接管理", "Member Purchase Link Management")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              onClick={() => currentProductId && generateMemberLinkMutation.mutate({ productId: currentProductId })}
              disabled={generateMemberLinkMutation.isPending}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              {translate("生成新链接（旧链接将自动停用）", "Generate New Link (old links will be automatically deactivated)")}
            </Button>

            <div className="space-y-2">
              {memberLinksQuery.isLoading ? (
                <p className="text-center text-muted-foreground py-4">{translate("加载中...", "Loading...")}</p>
              ) : memberLinksQuery.data?.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">{translate("暂无有效会员链接。生成链接后，只有持有链接的会员可进入购买页。", "No member link exists yet. After generating one, only members with the link can enter the purchase page.")}</p>
              ) : memberLinksQuery.data?.map(link => (
                <div key={link.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{getMemberLinkUrl(link.token)}</code>
                    <p className="text-xs text-muted-foreground mt-1">
                      {translate("创建于", "Created on")} {new Date(link.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={link.isActive ? "default" : "outline"}>
                    {link.isActive ? translate("活跃", "Active") : translate("已停用", "Deactivated")}
                  </Badge>
                  {link.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void copyMemberLink(link.token)}
                      aria-label={translate("复制会员链接", "Copy member link")}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      {translate("复制", "Copy")}
                    </Button>
                  )}
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
