import { useState } from "react";
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

  const [filterType, setFilterType] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjProductId, setAdjProductId] = useState<number | "">("");
  const [adjType, setAdjType] = useState<"quality_issue" | "plant_death" | "pest_disease" | "human_damage" | "lost" | "other">("quality_issue");
  const [adjQty, setAdjQty] = useState(1);
  const [adjCost, setAdjCost] = useState(0);
  const [adjReason, setAdjReason] = useState("");
  const [adjRemark, setAdjRemark] = useState("");

  const { data: adjustments, isLoading, refetch, isFetching } = trpc.inventoryAdjustment.list.useQuery(
    filterType ? { adjustmentType: filterType } : undefined,
  );

  const { data: products } = trpc.products.list.useQuery(undefined);

  const createMutation = trpc.inventoryAdjustment.create.useMutation({
    onSuccess: () => {
      toast.success(translate("库存扣减已记录", "Inventory adjustment recorded"));
      setDialogOpen(false);
      setAdjProductId("");
      setAdjQty(1);
      setAdjCost(0);
      setAdjReason("");
      setAdjRemark("");
      utils.inventoryAdjustment.list.invalidate();
      utils.products.list.invalidate();
    },
    onError: (err) => toast.error(translate("扣减失败: ", "Failed: ") + err.message),
  });

  const fmt = (n: number) => `RM ${Number(n).toFixed(2)}`;
  const fmtDate = (ts: any) => {
    if (!ts) return "-";
    const d = new Date(typeof ts === "number" ? ts : ts);
    return d.toLocaleString();
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
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {translate("新增扣减", "New Adjustment")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{translate("库存手动扣减", "Manual Stock Adjustment")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{translate("商品", "Product")}</Label>
                  <Select value={String(adjProductId)} onValueChange={(v) => setAdjProductId(Number(v))}>
                    <SelectTrigger><SelectValue placeholder={translate("选择商品", "Select product")} /></SelectTrigger>
                    <SelectContent>
                      {(products as any[])?.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{translate("扣减原因", "Reason")}</Label>
                  <Select value={adjType} onValueChange={(v: any) => setAdjType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([key, val]) => (
                        <SelectItem key={key} value={key}>
                          {lang === "zh" ? val.zh : val.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{translate("扣减数量", "Quantity")}</Label>
                    <Input type="number" min={1} value={adjQty} onChange={(e) => setAdjQty(Math.abs(parseInt(e.target.value) || 1))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{translate("单位成本 (RM)", "Unit Cost (RM)")}</Label>
                    <Input type="number" min={0} step="0.01" value={adjCost} onChange={(e) => setAdjCost(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{translate("备注", "Remark")}</Label>
                  <Input value={adjRemark} onChange={(e) => setAdjRemark(e.target.value)} placeholder={translate("可选备注...", "Optional remark...")} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
                  <Button
                    onClick={() => {
                      if (!adjProductId) { toast.error(translate("请选择商品", "Please select a product")); return; }
                      createMutation.mutate({
                        productId: adjProductId,
                        adjustmentType: adjType,
                        quantityChange: -adjQty,
                        unitCost: adjCost,
                        totalCost: adjCost * adjQty,
                        reason: adjReason || undefined,
                        remark: adjRemark || undefined,
                      });
                    }}
                    disabled={createMutation.isPending}
                  >
                    {translate("确认扣减", "Confirm")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="space-y-1">
              <Label>{translate("筛选类型", "Filter Type")}</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder={translate("全部", "All")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{translate("全部", "All")}</SelectItem>
                  {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {lang === "zh" ? val.zh : val.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">{translate("扣减记录", "Adjustment Records")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{translate("加载中...", "Loading...")}</div>
          ) : adjustments && (adjustments as any[]).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translate("商品", "Product")}</TableHead>
                  <TableHead>{translate("类型", "Type")}</TableHead>
                  <TableHead className="text-right">{translate("数量", "Qty")}</TableHead>
                  <TableHead className="text-right">{translate("成本", "Cost")}</TableHead>
                  <TableHead>{translate("操作人", "Operator")}</TableHead>
                  <TableHead>{translate("日期", "Date")}</TableHead>
                  <TableHead>{translate("备注", "Remark")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(adjustments as any[]).map((adj: any) => (
                  <TableRow key={adj.id}>
                    <TableCell>{adj.productId}</TableCell>
                    <TableCell>
                      {ADJUSTMENT_TYPE_LABELS[adj.adjustmentType]
                        ? (lang === "zh" ? ADJUSTMENT_TYPE_LABELS[adj.adjustmentType].zh : ADJUSTMENT_TYPE_LABELS[adj.adjustmentType].en)
                        : adj.adjustmentType}
                    </TableCell>
                    <TableCell className="text-right text-red-600">{adj.quantityChange}</TableCell>
                    <TableCell className="text-right">{fmt(Number(adj.totalCost))}</TableCell>
                    <TableCell>{adj.adjustedBy || "-"}</TableCell>
                    <TableCell className="text-sm">{fmtDate(adj.createdAt)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{adj.remark || adj.reason || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">{translate("暂无记录", "No records")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
