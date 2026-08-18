import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Check, ChevronsUpDown, PackagePlus, Plus, Search, Trash2, CheckCircle, MinusCircle, AlertTriangle, Eye, Edit } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  createEmptyPurchaseOrderItem,
  expandProductToPurchaseOrderItems,
  filterPurchaseProductOptions,
  type PurchaseProductOption,
} from "@/lib/purchaseOrderSelection";

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ordered: "bg-blue-100 text-blue-700",
  received: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

interface PoItem {
  productId: number | undefined;
  quantity: number;
  unitCost: string;
  sellingPrice: string;
  subtotal: string;
  // V2.1: Variant support
  variantName: string;
  variantKeyword: string;
}

interface BatchAdjustmentRow {
  productId: string;
  supplierId: string;
  quantityChange: number;
}

const createEmptyBatchAdjustmentRow = (): BatchAdjustmentRow => ({
  productId: "none",
  supplierId: "none",
  quantityChange: -1,
});

const ADJUSTMENT_TYPES = [
  { value: "quality_issue", zh: "品质异常报废", en: "Quality Issue Scrap" },
  { value: "plant_death", zh: "植物死亡", en: "Plant Death" },
  { value: "pest_disease", zh: "病虫害", en: "Pest/Disease" },
  { value: "human_damage", zh: "人为损坏", en: "Human Damage" },
  { value: "unhealthy", zh: "不健康", en: "Unhealthy" },
  { value: "lost", zh: "遗失", en: "Lost" },
  { value: "other", zh: "其他", en: "Other" },
];

function PurchaseOrderItems({ poId }: { poId: number }) {
  const { lang, translate } = useI18n();
  const { data: items, isLoading } = trpc.purchaseOrders.items.useQuery({ poId });
  const { data: products } = trpc.products.list.useQuery({});

  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-2">{translate("进货商品", "Purchase Items")}</Label>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{translate("商品", "Product")}</TableHead>
            <TableHead>{translate("规格", "Variant")}</TableHead>
            <TableHead className="text-right">{translate("数量", "Qty")}</TableHead>
            <TableHead className="text-right">{translate("本钱", "Cost")}</TableHead>
            <TableHead className="text-right">{translate("小计", "Subtotal")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
          ) : items?.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{translate("无商品", "No items")}</TableCell></TableRow>
          ) : items?.map((item: any) => (
            <TableRow key={item.id}>
              <TableCell>{products?.find((p: any) => p.id === item.productId)?.name || `#${item.productId}`}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{item.variantName || '-'} {item.variantKeyword ? `(${item.variantKeyword})` : ''}</TableCell>
              <TableCell className="text-right">{item.quantity}</TableCell>
              <TableCell className="text-right">RM {item.unitCost}</TableCell>
              <TableCell className="text-right font-semibold">RM {item.subtotal}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function PurchaseOrders() {
  const { lang, translate } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState("purchase");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("none");
  const [poNumberInput, setPoNumberInput] = useState("");
  const [notes, setNotes] = useState("");
  const [detailPo, setDetailPo] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [items, setItems] = useState<PoItem[]>([createEmptyPurchaseOrderItem()]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const utils = trpc.useUtils();

  // Stock adjustment state
  const [adjProductId, setAdjProductId] = useState<string>("none");
  const [adjSupplierId, setAdjSupplierId] = useState<string>("none");
  const [adjType, setAdjType] = useState<string>("plant_death");
  const [adjQty, setAdjQty] = useState(1);
  const [adjReason, setAdjReason] = useState("");
  const [batchAdjustmentOpen, setBatchAdjustmentOpen] = useState(false);
  const [batchAdjustmentRows, setBatchAdjustmentRows] = useState<BatchAdjustmentRow[]>([createEmptyBatchAdjustmentRow()]);
  const [batchAdjustmentType, setBatchAdjustmentType] = useState<string>("plant_death");
  const [batchAdjustmentReason, setBatchAdjustmentReason] = useState("");

  const statusLabels = {
    draft: { zh: "草稿", en: "Draft" },
    ordered: { zh: "已下单", en: "Ordered" },
    received: { zh: "已收货", en: "Received" },
    cancelled: { zh: "已取消", en: "Cancelled" },
  };

  const { data: purchaseOrders, isLoading } = trpc.purchaseOrders.list.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery({ activeOnly: true });
  const { data: products } = trpc.products.list.useQuery({});
  const { data: purchaseProductOptions = [] } = trpc.purchaseOrders.selectionOptions.useQuery();
  const filteredPurchaseProducts = useMemo(
    () => filterPurchaseProductOptions(purchaseProductOptions as PurchaseProductOption[], productSearch),
    [purchaseProductOptions, productSearch],
  );
  const purchaseProductById = useMemo(
    () => new Map((purchaseProductOptions as PurchaseProductOption[]).map(product => [product.id, product])),
    [purchaseProductOptions],
  );
  const { data: adjustmentSupplierCost, isFetching: isLoadingAdjustmentSupplierCost } = trpc.purchaseOrders.lastProductCost.useQuery(
    { productId: adjProductId === "none" ? 0 : parseInt(adjProductId), supplierId: adjSupplierId === "none" ? 0 : parseInt(adjSupplierId) },
    { enabled: adjProductId !== "none" && adjSupplierId !== "none" },
  );

  const createMutation = trpc.purchaseOrders.create.useMutation({
    onSuccess: (r: any) => {
      utils.purchaseOrders.invalidate();
      utils.products.invalidate();
      toast.success(translate(`进货单创建成功: {poNumber}`, `Purchase order created: {poNumber}`, { poNumber: r.poNumber }));
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(translate(`创建失败: {message}`, `Creation failed: {message}`, { message: e.message })),
  });

  const receiveMutation = trpc.purchaseOrders.receive.useMutation({
    onSuccess: () => {
      utils.purchaseOrders.invalidate();
      utils.products.invalidate();
      toast.success(translate("进货单已标记为已收货", "Purchase order marked as received"));
    },
    onError: (e) => toast.error(translate(`操作失败: {message}`, `Operation failed: {message}`, { message: e.message })),
  });

  const adjustStockMutation = trpc.inventoryAdjustment.create.useMutation({
    onSuccess: () => {
      utils.inventoryAdjustment.invalidate();
      utils.products.invalidate();
      toast.success(translate("库存扣减已记录", "Stock adjustment recorded"));
      setAdjProductId("none");
      setAdjSupplierId("none");
      setAdjQty(1);
      setAdjReason("");
    },
    onError: (e) => toast.error(translate(`扣减失败: {message}`, `Adjustment failed: {message}`, { message: e.message })),
  });
  const adjustBatchStockMutation = trpc.inventoryAdjustment.createBatch.useMutation({
    onSuccess: (result) => {
      utils.inventoryAdjustment.invalidate();
      utils.products.invalidate();
      toast.success(translate("已完成 {count} 项库存调整", "Completed {count} stock adjustments", { count: result.length }));
      setBatchAdjustmentOpen(false);
      setBatchAdjustmentRows([createEmptyBatchAdjustmentRow()]);
      setBatchAdjustmentReason("");
    },
    onError: (e) => toast.error(translate(`批量调整失败: {message}`, `Batch adjustment failed: {message}`, { message: e.message })),
  });

  function resetForm() {
    setSelectedSupplier("none");
    setPoNumberInput("");
    setNotes("");
    setItems([createEmptyPurchaseOrderItem()]);
    setProductSearch("");
  }

  function addItem() {
    setItems([...items, createEmptyPurchaseOrderItem()]);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof PoItem, value: any) {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    if (field === "quantity" || field === "unitCost") {
      const qty = parseFloat(String(newItems[idx].quantity)) || 0;
      const cost = parseFloat(String(newItems[idx].unitCost)) || 0;
      newItems[idx].subtotal = (qty * cost).toFixed(2);
    }
    setItems(newItems);
  }

  function selectPurchaseProduct(product: PurchaseProductOption) {
    const expandedItems = expandProductToPurchaseOrderItems(product);
    setItems(currentItems => {
      const emptyItemIndex = currentItems.findIndex(item => item.productId === undefined);
      if (emptyItemIndex === -1) return [...currentItems, ...expandedItems];
      return [
        ...currentItems.slice(0, emptyItemIndex),
        ...expandedItems,
        ...currentItems.slice(emptyItemIndex + 1),
      ];
    });
    setProductPickerOpen(false);
    setProductSearch("");
  }

  function handleSubmit() {
    if (selectedSupplier === "none") { toast.error(translate("请选择供应商", "Please select a supplier")); return; }
    const validItems = items.filter(i => i.productId !== undefined && i.quantity > 0);
    if (validItems.length === 0) { toast.error(translate("请至少添加一个进货商品", "Please add at least one purchase item")); return; }
    createMutation.mutate({
      supplierId: parseInt(selectedSupplier),
      poNumber: poNumberInput || undefined,
      notes: notes || undefined,
      items: validItems.map(i => ({
        productId: i.productId!,
        quantity: i.quantity,
        unitCost: i.unitCost,
        subtotal: i.subtotal,
        variantName: i.variantName || undefined,
        variantKeyword: i.variantKeyword || undefined,
        sellingPrice: i.sellingPrice || undefined,
      })),
    });
  }

  function handleAdjustStock() {
    if (adjProductId === "none") { toast.error(translate("请选择商品", "Please select a product")); return; }
    if (adjSupplierId === "none") { toast.error(translate("请选择厂家", "Please select a supplier")); return; }
    if (!adjustmentSupplierCost) { toast.error(translate("该厂家尚无此商品的已收货成本", "This supplier has no received cost for this product")); return; }
    if (adjQty <= 0) { toast.error(translate("扣减数量必须大于0", "Quantity must be greater than 0")); return; }
    adjustStockMutation.mutate({
      productId: parseInt(adjProductId),
      supplierId: parseInt(adjSupplierId),
      adjustmentType: adjType as any,
      quantityChange: -adjQty,
      reason: adjReason || undefined,
    });
  }

  function updateBatchAdjustmentRow(index: number, field: keyof BatchAdjustmentRow, value: string | number) {
    setBatchAdjustmentRows(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  function handleBatchAdjustStock() {
    const invalidRow = batchAdjustmentRows.find(row => row.productId === "none" || row.supplierId === "none" || !Number.isInteger(row.quantityChange) || row.quantityChange === 0);
    if (invalidRow) {
      toast.error(translate("请完整填写每项商品、厂家及非零调整数量", "Complete product, supplier and a non-zero quantity for every row"));
      return;
    }
    adjustBatchStockMutation.mutate({
      adjustmentType: batchAdjustmentType as any,
      reason: batchAdjustmentReason.trim() || undefined,
      items: batchAdjustmentRows.map(row => ({
        productId: Number(row.productId),
        supplierId: Number(row.supplierId),
        quantityChange: row.quantityChange,
      })),
    });
  }

  const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.subtotal || "0"), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("进货管理", "Purchase Management")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{translate("进货入库、库存扣减、规格管理", "Purchase, stock adjustment, variant management")}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <Button variant="outline" onClick={() => setBatchAdjustmentOpen(true)}>
            <MinusCircle className="h-4 w-4 mr-2" />{translate("批量库存调整", "Batch Stock Adjustment")}
          </Button>}
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />{translate("新增进货单", "New Purchase Order")}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="purchase">{translate("进货单", "Purchase Orders")}</TabsTrigger>
          {isAdmin && <TabsTrigger value="adjust">{translate("库存扣减", "Stock Adjustment")}</TabsTrigger>}
        </TabsList>

        {/* Tab 1: Purchase Orders */}
        <TabsContent value="purchase">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate("进货单号", "PO Number")}</TableHead>
                    <TableHead>{translate("供应商", "Supplier")}</TableHead>
                    <TableHead>{translate("总金额", "Total Amount")}</TableHead>
                    <TableHead>{translate("状态", "Status")}</TableHead>
                    <TableHead>{translate("日期", "Date")}</TableHead>
                    <TableHead className="text-right">{translate("操作", "Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
                  ) : purchaseOrders?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{translate("暂无进货单", "No purchase orders yet")}</TableCell></TableRow>
                  ) : purchaseOrders?.map(po => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-sm">{po.poNumber}</TableCell>
                      <TableCell>{suppliers?.find(s => s.id === po.supplierId)?.name || translate(`供应商#{supplierId}`, `Supplier#{supplierId}`, { supplierId: po.supplierId })}</TableCell>
                      <TableCell>RM {po.totalAmount}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGES[po.status]} variant="secondary">
                          {statusLabels[po.status]?.[lang] || po.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(po.createdAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setDetailPo(po); setDetailOpen(true); }}
                          >
                            <Eye className="h-4 w-4 mr-1" />{translate("详情", "View")}
                          </Button>
                          {po.status === "ordered" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(translate("确认已收货？库存将自动增加。", "Confirm receipt? Inventory will be automatically increased."))) {
                                  receiveMutation.mutate({ id: po.id });
                                }
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />{translate("确认收货", "Confirm Receipt")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Stock Adjustment */}
        {isAdmin && <TabsContent value="adjust">
          <Card className="p-6">
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold">{translate("库存扣减", "Stock Adjustment")}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{translate("用于处理死亡、损坏、不健康等情况的库存扣减", "Used for stock reduction due to death, damage, unhealthy, etc.")}</p>

              <div>
                <Label>{translate("选择商品 *", "Select Product *")}</Label>
                <Select value={adjProductId} onValueChange={setAdjProductId}>
                  <SelectTrigger><SelectValue placeholder={translate("选择商品", "Select Product")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{translate("请选择...", "Please select...")}</SelectItem>
                    {products?.filter((p: any) => p.type === "physical" || p.type === "gift").map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name} {translate("库存", "Stock")}: {p.stockQuantity ?? 0}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{translate("选择厂家 *", "Select Supplier *")}</Label>
                <Select value={adjSupplierId} onValueChange={setAdjSupplierId}>
                  <SelectTrigger><SelectValue placeholder={translate("选择厂家", "Select Supplier")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{translate("请选择...", "Please select...")}</SelectItem>
                    {suppliers?.map((supplier) => <SelectItem key={supplier.id} value={supplier.id.toString()}>{supplier.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {adjProductId !== "none" && adjSupplierId !== "none" && !isLoadingAdjustmentSupplierCost && !adjustmentSupplierCost && (
                  <p className="mt-1 text-xs text-destructive">{translate("该厂家尚无此商品的已收货成本，请先完成进货单收货。", "This supplier has no received cost for this product. Receive a purchase order first.")}</p>
                )}
              </div>

              <div>
                <Label>{translate("单位成本 (RM)", "Unit Cost (RM)")}</Label>
                <Input value={adjustmentSupplierCost ? Number(adjustmentSupplierCost.unitCost).toFixed(2) : "-"} readOnly className="bg-muted" />
                <p className="mt-1 text-xs text-muted-foreground">{translate("按所选厂家最近一次已收货进货单自动带入", "Automatically from this supplier's latest received purchase order")}</p>
              </div>

              <div>
                <Label>{translate("扣减原因 *", "Adjustment Reason *")}</Label>
                <Select value={adjType} onValueChange={setAdjType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ADJUSTMENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        {lang === 'zh' ? t.zh : t.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{translate("扣减数量 *", "Quantity *")}</Label>
                <Input type="number" min={1} value={adjQty} onChange={(e) => setAdjQty(parseInt(e.target.value) || 0)} />
              </div>

              <div>
                <Label>{translate("备注", "Remark")}</Label>
                <Textarea value={adjReason} onChange={(e) => setAdjReason(e.target.value)} rows={2}
                  placeholder={translate("可选：填写详细原因...", "Optional: Enter detailed reason...")} />
              </div>

              <Button onClick={handleAdjustStock} disabled={adjustStockMutation.isPending || isLoadingAdjustmentSupplierCost} variant="destructive">
                <MinusCircle className="h-4 w-4 mr-2" />
                {translate("确认扣减库存", "Confirm Stock Adjustment")}
              </Button>
            </div>
          </Card>
        </TabsContent>}
      </Tabs>

      {/* New Purchase Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate("新增进货单", "New Purchase Order")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("进货单号（可选）", "PO Number (optional)")}</Label>
              <Input value={poNumberInput} onChange={(e) => setPoNumberInput(e.target.value)} placeholder={translate("填写厂家单号，留空自动生成", "Enter supplier's PO number, leave empty for auto")} />
            </div>
            <div>
              <Label>{translate("选择供应商 *", "Select Supplier *")}</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger><SelectValue placeholder={translate("选择供应商", "Select Supplier")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{translate("请选择...", "Please select...")}</SelectItem>
                  {suppliers?.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label>{translate("进货商品（可添加规格）", "Purchase Items (with variants)")}</Label>
                <div className="flex gap-2">
                  <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="justify-between" aria-expanded={productPickerOpen}>
                        <Search className="mr-1 h-3 w-3" />
                        {translate("选择商品", "Choose product")}
                        <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(34rem,calc(100vw-2rem))] p-0" align="end">
                      <Command shouldFilter={false}>
                        <CommandInput value={productSearch} onValueChange={setProductSearch} placeholder={translate("按商品名称、SKU 或规格关键词搜索...", "Search product name, SKU or variant keyword...")} />
                        <CommandList className="max-h-72">
                          <CommandEmpty>{translate("未找到可进货商品", "No purchasable products found")}</CommandEmpty>
                          <CommandGroup heading={translate("商品与赠品", "Products and gifts")}>
                            {filteredPurchaseProducts.map(product => (
                              <CommandItem key={product.id} value={`${product.id}-${product.name}`} onSelect={() => selectPurchaseProduct(product)}>
                                <Check className="mr-2 h-4 w-4 opacity-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate">{product.name}</span>
                                    {product.isGift && <Badge variant="secondary">{translate("赠品", "Gift")}</Badge>}
                                  </div>
                                  <p className="text-xs text-muted-foreground">SKU: {product.sku || "-"}{product.variants.length > 0 ? ` · ${translate("规格", "Variants")} ${product.variants.map(variant => variant.keyword).join("、")}` : ""}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3 w-3 mr-1" />{translate("添加空白行", "Add blank row")}
                  </Button>
                </div>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  {/* Row 1: Product selection */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-8">
                      <Label className="text-xs">{translate("商品 *", "Product *")}</Label>
                      <div className="flex h-8 items-center rounded-md border bg-background px-2 text-sm">
                        {item.productId ? (
                          <>
                            <span className="truncate">{purchaseProductById.get(item.productId)?.name || `#${item.productId}`}</span>
                            {purchaseProductById.get(item.productId)?.isGift && <Badge variant="secondary" className="ml-2">{translate("赠品", "Gift")}</Badge>}
                            <span className="ml-2 shrink-0 text-xs text-muted-foreground">SKU: {purchaseProductById.get(item.productId)?.sku || "-"}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">{translate("请从上方搜索并选择商品", "Search and choose a product above")}</span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-4 flex justify-end">
                      {items.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Variant info (optional) */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <Label className="text-xs">{translate("规格名称", "Variant Name")}</Label>
                      <Input className="h-8 bg-muted" value={item.variantName || translate("商品级", "Product level")} readOnly />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">{translate("规格关键词", "Variant Keyword")}</Label>
                      <Input className="h-8 bg-muted" value={item.variantKeyword || "-"} readOnly />
                    </div>
                    <div className="col-span-5">
                      <Label className="text-xs text-muted-foreground">{item.variantName ? translate("已由商品规格自动展开", "Expanded automatically from product variants") : translate("商品无规格，按商品级入库", "Product has no variants; stock at product level")}</Label>
                    </div>
                  </div>

                  {/* Row 3: Cost, Price, Quantity */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                      <Label className="text-xs">{translate("本钱 (RM) *", "Unit Cost (RM) *")}</Label>
                      <Input
                        type="number"
                        className="h-8"
                        value={item.unitCost}
                        onChange={(e) => updateItem(idx, "unitCost", e.target.value)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">{translate("卖价 (RM)", "Selling Price (RM)")}</Label>
                      <Input
                        type="number"
                        className="h-8"
                        placeholder={translate("同步到商品售价", "Sync to product price")}
                        value={item.sellingPrice}
                        onChange={(e) => updateItem(idx, "sellingPrice", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">{translate("数量 *", "Quantity *")}</Label>
                      <Input
                        type="number"
                        className="h-8"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-4">
                      <Label className="text-xs">{translate("小计", "Subtotal")}</Label>
                      <Input className="h-8" value={`RM ${item.subtotal}`} disabled />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end font-semibold text-lg">
              {translate("总计: RM {totalAmount}", "Total: RM {totalAmount}", { totalAmount: totalAmount.toFixed(2) })}
            </div>

            <div>
              <Label>{translate("备注", "Notes")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {translate("创建进货单", "Create Purchase Order")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate("进货单详情", "Purchase Order Details")}</DialogTitle>
          </DialogHeader>
          {detailPo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">{translate("进货单号", "PO Number")}</Label>
                  <p className="font-mono font-semibold">{detailPo.poNumber}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{translate("供应商", "Supplier")}</Label>
                  <p className="font-semibold">{suppliers?.find(s => s.id === detailPo.supplierId)?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{translate("总金额", "Total Amount")}</Label>
                  <p className="font-semibold">RM {detailPo.totalAmount}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{translate("状态", "Status")}</Label>
                  <Badge className={STATUS_BADGES[detailPo.status as string]} variant="secondary">{statusLabels[detailPo.status as keyof typeof statusLabels]?.[lang] || detailPo.status}</Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{translate("日期", "Date")}</Label>
                  <p className="text-sm">{new Date(detailPo.createdAt).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}</p>
                </div>
                {detailPo.notes && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">{translate("备注", "Notes")}</Label>
                    <p className="text-sm">{detailPo.notes}</p>
                  </div>
                )}
              </div>
              <PurchaseOrderItems poId={detailPo.id} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>{translate("关闭", "Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchAdjustmentOpen} onOpenChange={setBatchAdjustmentOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{translate("批量库存调整", "Batch Stock Adjustment")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{translate("同一批次会以单个事务提交；任一商品库存不足或成本资料缺失时，整批不会写入。负数扣减库存，正数补回库存。", "This batch is submitted as one transaction. If any item lacks stock or cost data, no changes are written. Negative quantities deduct stock; positive quantities restore stock.")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>{translate("调整原因 *", "Adjustment Reason *")}</Label><Select value={batchAdjustmentType} onValueChange={setBatchAdjustmentType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ADJUSTMENT_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{lang === "zh" ? type.zh : type.en}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>{translate("批次备注", "Batch Remark")}</Label><Input value={batchAdjustmentReason} onChange={(event) => setBatchAdjustmentReason(event.target.value)} placeholder={translate("可选：记录盘点或异常原因", "Optional: record stocktake or issue reason")} /></div>
            </div>
            <div className="space-y-3">
              {batchAdjustmentRows.map((row, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1.3fr_1.3fr_0.7fr_auto] md:items-end">
                <div><Label className="text-xs">{translate("商品", "Product")}</Label><Select value={row.productId} onValueChange={(value) => updateBatchAdjustmentRow(index, "productId", value)}><SelectTrigger><SelectValue placeholder={translate("选择商品", "Select product")} /></SelectTrigger><SelectContent><SelectItem value="none">{translate("请选择...", "Please select...")}</SelectItem>{products?.filter((product: any) => product.type === "physical" || product.type === "gift").map((product: any) => <SelectItem key={product.id} value={String(product.id)}>{product.name} · {translate("库存", "Stock")}: {product.stockQuantity ?? 0}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">{translate("厂家", "Supplier")}</Label><Select value={row.supplierId} onValueChange={(value) => updateBatchAdjustmentRow(index, "supplierId", value)}><SelectTrigger><SelectValue placeholder={translate("选择厂家", "Select supplier")} /></SelectTrigger><SelectContent><SelectItem value="none">{translate("请选择...", "Please select...")}</SelectItem>{suppliers?.map(supplier => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">{translate("数量变动", "Quantity Change")}</Label><Input type="number" step={1} value={row.quantityChange} onChange={(event) => updateBatchAdjustmentRow(index, "quantityChange", Number.parseInt(event.target.value, 10) || 0)} /></div>
                <Button variant="ghost" size="icon" disabled={batchAdjustmentRows.length === 1} onClick={() => setBatchAdjustmentRows(rows => rows.filter((_, rowIndex) => rowIndex !== index))} aria-label={translate("删除此行", "Delete row")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>)}
            </div>
            <Button variant="outline" onClick={() => setBatchAdjustmentRows(rows => [...rows, createEmptyBatchAdjustmentRow()])}><Plus className="mr-2 h-4 w-4" />{translate("新增调整行", "Add adjustment row")}</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchAdjustmentOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button variant="destructive" onClick={handleBatchAdjustStock} disabled={adjustBatchStockMutation.isPending}>{translate("确认批量调整", "Confirm Batch Adjustment")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
