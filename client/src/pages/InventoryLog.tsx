import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Pencil, RefreshCw } from "lucide-react";

const ADJUSTMENT_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  quality_issue: { zh: "品质异常报废", en: "Quality Issue Scrap" },
  plant_death: { zh: "植物死亡", en: "Plant Death" },
  pest_disease: { zh: "病虫害", en: "Pest/Disease" },
  human_damage: { zh: "人为损坏", en: "Human Damage" },
  unhealthy: { zh: "不健康植株", en: "Unhealthy Plant" },
  lost: { zh: "遗失", en: "Lost" },
  other: { zh: "其他", en: "Other" },
};

export default function InventoryLog() {
  const { translate, lang } = useI18n();
  const utils = trpc.useUtils();
  const [filterType, setFilterType] = useState<string>("all");
  const [correctionTarget, setCorrectionTarget] = useState<any>(null);
  const [correctedQuantity, setCorrectedQuantity] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const { data: adjustments, isLoading, refetch, isFetching } = trpc.inventoryAdjustment.list.useQuery(
    filterType !== "all" ? { adjustmentType: filterType } : undefined,
  );
  const correctAdjustment = trpc.inventoryAdjustment.correct.useMutation({
    onSuccess: async () => {
      setCorrectionTarget(null);
      setCorrectedQuantity("");
      setCorrectionReason("");
      await utils.inventoryAdjustment.list.invalidate();
    },
    onError: (error) => window.alert(error.message),
  });

  const fmt = (n: number) => `RM ${Number(n).toFixed(2)}`;
  const fmtDate = (ts: unknown) => {
    if (!ts) return "-";
    return new Date(typeof ts === "number" ? ts : String(ts)).toLocaleString();
  };
  const openCorrection = (adjustment: any) => {
    setCorrectionTarget(adjustment);
    setCorrectedQuantity(String(adjustment.effectiveQuantityChange ?? adjustment.quantityChange));
    setCorrectionReason("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardList className="h-6 w-6" />{translate("库存日志", "Inventory Log")}</h1>
        <div className="flex items-center gap-2">
          <p className="hidden text-xs text-muted-foreground md:block">{translate("库存变动由进货、订单、退款及异常处理自动记录；如需修正，系统会保留原记录并新增关联流水。", "Purchases, orders, refunds and exceptions create stock records automatically. Corrections retain the original and add a linked movement.")}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />{translate("刷新", "Refresh")}</Button>
        </div>
      </div>

      <Card><CardContent className="pt-6"><div className="flex items-end gap-4"><div className="space-y-1"><Label>{translate("筛选类型", "Filter Type")}</Label><Select value={filterType} onValueChange={setFilterType}><SelectTrigger className="w-[200px]"><SelectValue placeholder={translate("全部", "All")} /></SelectTrigger><SelectContent><SelectItem value="all">{translate("全部", "All")}</SelectItem>{Object.entries(ADJUSTMENT_TYPE_LABELS).map(([key, value]) => <SelectItem key={key} value={key}>{lang === "zh" ? value.zh : value.en}</SelectItem>)}</SelectContent></Select></div></div></CardContent></Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{translate("库存调整记录", "Inventory Adjustment Records")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="py-8 text-center text-muted-foreground">{translate("加载中...", "Loading...")}</div> : adjustments && (adjustments as any[]).length > 0 ? (
            <Table><TableHeader><TableRow><TableHead>{translate("商品", "Product")}</TableHead><TableHead>{translate("类型", "Type")}</TableHead><TableHead className="text-right">{translate("数量", "Qty")}</TableHead><TableHead className="text-right">{translate("成本", "Cost")}</TableHead><TableHead>{translate("操作人", "Operator")}</TableHead><TableHead>{translate("日期", "Date")}</TableHead><TableHead>{translate("备注", "Remark")}</TableHead><TableHead>{translate("更正", "Correct")}</TableHead></TableRow></TableHeader>
              <TableBody>{(adjustments as any[]).map((adjustment: any) => <TableRow key={adjustment.id}>
                <TableCell><div className="font-medium">{adjustment.productName || `商品 #${adjustment.productId}`}</div>{adjustment.supplierName && <div className="text-xs text-muted-foreground">{translate("厂家", "Supplier")}: {adjustment.supplierName}</div>}</TableCell>
                <TableCell>{adjustment.isCorrection ? translate("更正记录", "Correction") : ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType] ? (lang === "zh" ? ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType].zh : ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType].en) : adjustment.adjustmentType}</TableCell>
                <TableCell className={`text-right ${Number(adjustment.quantityChange) < 0 ? "text-red-600" : "text-emerald-600"}`}><div>{adjustment.quantityChange}</div>{!adjustment.isCorrection && Number(adjustment.effectiveQuantityChange) !== Number(adjustment.quantityChange) && <div className="text-xs text-muted-foreground">{translate("现有效", "Effective")}: {adjustment.effectiveQuantityChange}</div>}</TableCell>
                <TableCell className="text-right">{fmt(Number(adjustment.totalCost))}</TableCell><TableCell>{adjustment.adjustedBy || "-"}</TableCell><TableCell className="text-sm">{fmtDate(adjustment.createdAt)}</TableCell><TableCell className="text-sm text-muted-foreground">{adjustment.remark || adjustment.reason || "-"}</TableCell>
                <TableCell>{!adjustment.isCorrection && !adjustment.orderExceptionId ? <Button variant="outline" size="sm" onClick={() => openCorrection(adjustment)}><Pencil className="mr-1 h-3.5 w-3.5" />{translate("更正", "Correct")}</Button> : <span className="text-xs text-muted-foreground">{adjustment.isCorrection ? translate("关联原记录", "Linked") : translate("订单异常流程", "Order exception")}</span>}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          ) : <div className="py-8 text-center text-muted-foreground">{translate("暂无记录", "No records")}</div>}
        </CardContent>
      </Card>

      <Dialog open={Boolean(correctionTarget)} onOpenChange={(open) => !open && setCorrectionTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{translate("更正库存记录", "Correct Inventory Record")}</DialogTitle><DialogDescription>{translate("系统会保留原始记录，并建立关联的反向流水来同步库存与成本；不会覆盖历史。", "The original record is retained. A linked reversing movement updates stock and cost without overwriting history.")}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm"><div className="font-medium">{correctionTarget?.productName}</div><div className="text-muted-foreground">{translate("当前有效数量", "Current effective quantity")}: {correctionTarget?.effectiveQuantityChange ?? correctionTarget?.quantityChange}</div></div>
            <div className="space-y-1"><Label>{translate("更正后的最终数量", "Corrected final quantity")}</Label><Input type="number" step="1" value={correctedQuantity} onChange={(event) => setCorrectedQuantity(event.target.value)} /></div>
            <div className="space-y-1"><Label>{translate("更正原因", "Correction reason")}</Label><Textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder={translate("例如：进货时多录了 2 件", "e.g. 2 units were over-recorded at receiving")} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCorrectionTarget(null)}>{translate("取消", "Cancel")}</Button><Button disabled={correctAdjustment.isPending || !correctionReason.trim() || !/^[-+]?\d+$/.test(correctedQuantity.trim())} onClick={() => correctAdjustment.mutate({ adjustmentId: correctionTarget.id, desiredQuantityChange: Number(correctedQuantity), reason: correctionReason })}>{correctAdjustment.isPending ? translate("保存中...", "Saving...") : translate("保存更正", "Save correction")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
