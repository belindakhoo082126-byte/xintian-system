import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardList, Plus, RefreshCw } from "lucide-react";

const ADJUSTMENT_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  quality_issue: { zh: "品质异常报废", en: "Quality Issue Scrap" },
  plant_death: { zh: "植物死亡", en: "Plant Death" },
  pest_disease: { zh: "病虫害", en: "Pest/Disease" },
  human_damage: { zh: "人为损坏", en: "Human Damage" },
  lost: { zh: "遗失", en: "Lost" },
  other: { zh: "其他", en: "Other" },
};

export default function InventoryLog() {
  const { translate, lang } = useI18n();
  const utils = trpc.useUtils();

  const [filterType, setFilterType] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjProductId, setAdjProductId] = useState<number | "">("");
  const [adjSupplierId, setAdjSupplierId] = useState<number | "">("");
  const [adjType, setAdjType] = useState<"quality_issue" | "plant_death" | "pest_disease" | "human_damage" | "lost" | "other">("quality_issue");
  const [adjQty, setAdjQty] = useState(1);
  const [adjCost, setAdjCost] = useState(0);
  const [adjReason, setAdjReason] = useState("");
  const [adjRemark, setAdjRemark] = useState("");

  const { data: adjustments, isLoading, refetch, isFetching } = trpc.inventoryAdjustment.list.useQuery(
    filterType !== "all" ? { adjustmentType: filterType } : undefined,
  );
  const { data: products } = trpc.products.list.useQuery(undefined);
  const { data: suppliers } = trpc.suppliers.list.useQuery({ activeOnly: true });
  const { data: supplierCost, isFetching: isLoadingSupplierCost } = trpc.purchaseOrders.lastProductCost.useQuery(
    { productId: Number(adjProductId || 0), supplierId: Number(adjSupplierId || 0) },
    { enabled: Boolean(adjProductId && adjSupplierId) },
  );

  useEffect(() => {
    setAdjCost(supplierCost?.unitCost !== undefined ? Number(supplierCost.unitCost) : 0);
  }, [supplierCost?.unitCost]);

  const createMutation = trpc.inventoryAdjustment.create.useMutation({
    onSuccess: () => {
      toast.success(translate("库存扣减已记录，损耗成本已同步利润报告", "Inventory adjustment and loss cost were recorded"));
      setDialogOpen(false);
      setAdjProductId("");
      setAdjSupplierId("");
      setAdjQty(1);
      setAdjCost(0);
      setAdjReason("");
      setAdjRemark("");
      utils.inventoryAdjustment.list.invalidate();
      utils.products.list.invalidate();
      utils.profitAnalysis.report.invalidate();
    },
    onError: (err) => toast.error(translate("扣减失败: ", "Failed: ") + err.message),
  });

  const fmt = (n: number) => `RM ${Number(n).toFixed(2)}`;
  const fmtDate = (ts: unknown) => {
    if (!ts) return "-";
    return new Date(typeof ts === "number" ? ts : String(ts)).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          {translate("库存日志", "Inventory Log")}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            {translate("刷新", "Refresh")}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />{translate("新增扣减", "New Adjustment")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{translate("库存手动扣减", "Manual Stock Adjustment")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{translate("商品", "Product")}</Label>
                  <Select value={String(adjProductId)} onValueChange={(value) => setAdjProductId(Number(value))}>
                    <SelectTrigger><SelectValue placeholder={translate("选择商品", "Select product")} /></SelectTrigger>
                    <SelectContent>{(products as any[])?.map((product: any) => <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{translate("厂家（必填）", "Supplier (required)")}</Label>
                  <Select value={String(adjSupplierId)} onValueChange={(value) => setAdjSupplierId(Number(value))}>
                    <SelectTrigger><SelectValue placeholder={translate("选择厂家", "Select supplier")} /></SelectTrigger>
                    <SelectContent>{(suppliers as any[])?.map((supplier: any) => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {adjProductId && adjSupplierId && !isLoadingSupplierCost && !supplierCost && <p className="text-xs text-destructive">{translate("该厂家尚无此商品的已收货成本，请先完成进货单收货。", "This supplier has no received cost for this product. Receive a purchase order first.")}</p>}
                </div>
                <div className="space-y-2">
                  <Label>{translate("扣减原因", "Reason")}</Label>
                  <Select value={adjType} onValueChange={(value: any) => setAdjType(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(ADJUSTMENT_TYPE_LABELS).map(([key, value]) => <SelectItem key={key} value={key}>{lang === "zh" ? value.zh : value.en}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{translate("扣减数量", "Quantity")}</Label>
                    <Input type="number" min={1} value={adjQty} onChange={(event) => setAdjQty(Math.abs(parseInt(event.target.value) || 1))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{translate("单位成本 (RM)", "Unit Cost (RM)")}</Label>
                    <Input type="number" value={adjCost.toFixed(2)} readOnly className="bg-muted" />
                    <p className="text-xs text-muted-foreground">{translate("根据所选厂家最近一次已收货进货单自动带入", "From this supplier's latest received purchase order")}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{translate("备注", "Remark")}</Label>
                  <Input value={adjRemark} onChange={(event) => setAdjRemark(event.target.value)} placeholder={translate("可选备注...", "Optional remark...")} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
                  <Button onClick={() => {
                    if (!adjProductId) return toast.error(translate("请选择商品", "Please select a product"));
                    if (!adjSupplierId) return toast.error(translate("请选择厂家", "Please select a supplier"));
                    if (!supplierCost) return toast.error(translate("无法读取该厂家成本", "Cannot read this supplier's cost"));
                    createMutation.mutate({ productId: adjProductId, supplierId: adjSupplierId, adjustmentType: adjType, quantityChange: -adjQty, reason: adjReason || undefined, remark: adjRemark || undefined });
                  }} disabled={createMutation.isPending || isLoadingSupplierCost}>
                    {translate("确认扣减", "Confirm")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card><CardContent className="pt-6"><div className="flex items-end gap-4"><div className="space-y-1"><Label>{translate("筛选类型", "Filter Type")}</Label><Select value={filterType} onValueChange={setFilterType}><SelectTrigger className="w-[200px]"><SelectValue placeholder={translate("全部", "All")} /></SelectTrigger><SelectContent><SelectItem value="all">{translate("全部", "All")}</SelectItem>{Object.entries(ADJUSTMENT_TYPE_LABELS).map(([key, value]) => <SelectItem key={key} value={key}>{lang === "zh" ? value.zh : value.en}</SelectItem>)}</SelectContent></Select></div></div></CardContent></Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{translate("扣减记录", "Adjustment Records")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="text-center py-8 text-muted-foreground">{translate("加载中...", "Loading...")}</div> : adjustments && (adjustments as any[]).length > 0 ? (
            <Table><TableHeader><TableRow><TableHead>{translate("商品", "Product")}</TableHead><TableHead>{translate("类型", "Type")}</TableHead><TableHead className="text-right">{translate("数量", "Qty")}</TableHead><TableHead className="text-right">{translate("成本", "Cost")}</TableHead><TableHead>{translate("操作人", "Operator")}</TableHead><TableHead>{translate("日期", "Date")}</TableHead><TableHead>{translate("备注", "Remark")}</TableHead></TableRow></TableHeader>
              <TableBody>{(adjustments as any[]).map((adjustment: any) => <TableRow key={adjustment.id}>
                <TableCell><div className="font-medium">{adjustment.productName || `商品 #${adjustment.productId}`}</div>{adjustment.supplierName && <div className="text-xs text-muted-foreground">{translate("厂家", "Supplier")}: {adjustment.supplierName}</div>}</TableCell>
                <TableCell>{ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType] ? (lang === "zh" ? ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType].zh : ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType].en) : adjustment.adjustmentType}</TableCell>
                <TableCell className="text-right text-red-600">{adjustment.quantityChange}</TableCell><TableCell className="text-right">{fmt(Number(adjustment.totalCost))}</TableCell><TableCell>{adjustment.adjustedBy || "-"}</TableCell><TableCell className="text-sm">{fmtDate(adjustment.createdAt)}</TableCell><TableCell className="text-sm text-muted-foreground">{adjustment.remark || adjustment.reason || "-"}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          ) : <div className="text-center py-8 text-muted-foreground">{translate("暂无记录", "No records")}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
