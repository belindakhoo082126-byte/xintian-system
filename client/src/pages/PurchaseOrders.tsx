import { useState } from "react";
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
import { toast } from "sonner";
import { PackagePlus, Plus, Trash2, CheckCircle, MinusCircle, AlertTriangle } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

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

const ADJUSTMENT_TYPES = [
  { value: "quality_issue", zh: "品质异常报废", en: "Quality Issue Scrap" },
  { value: "plant_death", zh: "植物死亡", en: "Plant Death" },
  { value: "pest_disease", zh: "病虫害", en: "Pest/Disease" },
  { value: "human_damage", zh: "人为损坏", en: "Human Damage" },
  { value: "unhealthy", zh: "不健康", en: "Unhealthy" },
  { value: "lost", zh: "遗失", en: "Lost" },
  { value: "other", zh: "其他", en: "Other" },
];

export default function PurchaseOrders() {
  const { lang, translate } = useI18n();
  const [activeTab, setActiveTab] = useState("purchase");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PoItem[]>([{ productId: undefined, quantity: 1, unitCost: "0", sellingPrice: "", subtotal: "0", variantName: "", variantKeyword: "" }]);
  const utils = trpc.useUtils();

  // Stock adjustment state
  const [adjProductId, setAdjProductId] = useState<string>("none");
  const [adjType, setAdjType] = useState<string>("plant_death");
  const [adjQty, setAdjQty] = useState(1);
  const [adjReason, setAdjReason] = useState("");

  const statusLabels = {
    draft: { zh: "草稿", en: "Draft" },
    ordered: { zh: "已下单", en: "Ordered" },
    received: { zh: "已收货", en: "Received" },
    cancelled: { zh: "已取消", en: "Cancelled" },
  };

  const { data: purchaseOrders, isLoading } = trpc.purchaseOrders.list.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery({ activeOnly: true });
  const { data: products } = trpc.products.list.useQuery({});

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
      setAdjQty(1);
      setAdjReason("");
    },
    onError: (e) => toast.error(translate(`扣减失败: {message}`, `Adjustment failed: {message}`, { message: e.message })),
  });

  function resetForm() {
    setSelectedSupplier("none");
    setNotes("");
    setItems([{ productId: undefined, quantity: 1, unitCost: "0", sellingPrice: "", subtotal: "0", variantName: "", variantKeyword: "" }]);
  }

  function addItem() {
    setItems([...items, { productId: undefined, quantity: 1, unitCost: "0", sellingPrice: "", subtotal: "0", variantName: "", variantKeyword: "" }]);
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

  function handleSubmit() {
    if (selectedSupplier === "none") { toast.error(translate("请选择供应商", "Please select a supplier")); return; }
    const validItems = items.filter(i => i.productId !== undefined && i.quantity > 0);
    if (validItems.length === 0) { toast.error(translate("请至少添加一个进货商品", "Please add at least one purchase item")); return; }
    createMutation.mutate({
      supplierId: parseInt(selectedSupplier),
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
    if (adjQty <= 0) { toast.error(translate("扣减数量必须大于0", "Quantity must be greater than 0")); return; }
    adjustStockMutation.mutate({
      productId: parseInt(adjProductId),
      adjustmentType: adjType as any,
      quantityChange: -adjQty,
      reason: adjReason || undefined,
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
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />{translate("新增进货单", "New Purchase Order")}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="purchase">{translate("进货单", "Purchase Orders")}</TabsTrigger>
          <TabsTrigger value="adjust">{translate("库存扣减", "Stock Adjustment")}</TabsTrigger>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Stock Adjustment */}
        <TabsContent value="adjust">
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
                    {products?.filter((p: any) => p.type === "physical").map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name} {translate("库存", "Stock")}: {p.stockQuantity ?? 0}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              <Button onClick={handleAdjustStock} disabled={adjustStockMutation.isPending} variant="destructive">
                <MinusCircle className="h-4 w-4 mr-2" />
                {translate("确认扣减库存", "Confirm Stock Adjustment")}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Purchase Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate("新增进货单", "New Purchase Order")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label>{translate("进货商品（可添加规格）", "Purchase Items (with variants)")}</Label>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" />{translate("添加商品", "Add Item")}
                </Button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  {/* Row 1: Product selection */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-7">
                      <Label className="text-xs">{translate("商品 *", "Product *")}</Label>
                      <Select
                        value={item.productId?.toString() || "none"}
                        onValueChange={(v) => updateItem(idx, "productId", v === "none" ? undefined : parseInt(v))}
                      >
                        <SelectTrigger className="h-8"><SelectValue placeholder={translate("选择商品", "Select Product")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{translate("请选择...", "Please select...")}</SelectItem>
                          {products?.filter((p: any) => p.type === "physical").map((p: any) => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-5 flex justify-end">
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
                      <Input
                        className="h-8"
                        placeholder={translate("如：大盆、红色", "e.g. Large, Red")}
                        value={item.variantName}
                        onChange={(e) => updateItem(idx, "variantName", e.target.value)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">{translate("规格关键词", "Variant Keyword")}</Label>
                      <Input
                        className="h-8"
                        placeholder={translate("如：LR", "e.g. LR")}
                        value={item.variantKeyword}
                        onChange={(e) => updateItem(idx, "variantKeyword", e.target.value)}
                      />
                    </div>
                    <div className="col-span-5">
                      <Label className="text-xs text-muted-foreground">{translate("留空则不创建规格，仅商品级进货", "Leave empty for product-level only")}</Label>
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
    </div>
  );
}
