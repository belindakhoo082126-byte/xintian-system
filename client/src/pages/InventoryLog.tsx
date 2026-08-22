import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, RefreshCw } from "lucide-react";

const MOVEMENT_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  purchase_receipt: { zh: "进货确认收货", en: "Purchase Receipt" },
  manual_adjustment: { zh: "进货管理库存扣减", en: "Inventory Deduction" },
  live_stock_adjustment: { zh: "直播库存扣减", en: "Live Stock Deduction" },
  bundle_component_deduct: { zh: "组合包组件消耗", en: "Bundle Component Deduction" },
  bundle_component_return: { zh: "组合包组件退回", en: "Bundle Component Return" },
};

export default function InventoryLog() {
  const { translate, lang } = useI18n();
  const [filterType, setFilterType] = useState<string>("all");
  const { data: movements, isLoading, refetch, isFetching } = trpc.inventoryLog.list.useQuery(
    filterType !== "all" ? { movementType: filterType } : undefined,
  );
  const fmtDate = (ts: unknown) => {
    if (!ts) return "-";
    return new Date(typeof ts === "number" ? ts : String(ts)).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardList className="h-6 w-6" />{translate("库存日志", "Inventory Log")}</h1>
        <div className="flex items-center gap-2">
          <p className="hidden text-xs text-muted-foreground md:block">{translate("统一记录进货收货、进货管理扣减、直播扣减及组合包库存变动；每笔均保留前后数量、原因与关联单据。", "A unified ledger records purchase receipts, inventory deductions, live deductions and bundle movements with before/after quantities and references.")}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />{translate("刷新", "Refresh")}</Button>
        </div>
      </div>

      <Card><CardContent className="pt-6"><div className="flex items-end gap-4"><div className="space-y-1"><Label>{translate("筛选类型", "Filter Type")}</Label><Select value={filterType} onValueChange={setFilterType}><SelectTrigger className="w-[220px]"><SelectValue placeholder={translate("全部", "All")} /></SelectTrigger><SelectContent><SelectItem value="all">{translate("全部", "All")}</SelectItem>{Object.entries(MOVEMENT_TYPE_LABELS).map(([key, value]) => <SelectItem key={key} value={key}>{lang === "zh" ? value.zh : value.en}</SelectItem>)}</SelectContent></Select></div></div></CardContent></Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{translate("统一库存流水", "Unified Inventory Ledger")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="py-8 text-center text-muted-foreground">{translate("加载中...", "Loading...")}</div> : movements && (movements as any[]).length > 0 ? (
            <Table><TableHeader><TableRow><TableHead>{translate("商品／规格", "Product / Variant")}</TableHead><TableHead>{translate("类型", "Type")}</TableHead><TableHead>{translate("变动前 → 后", "Before → After")}</TableHead><TableHead className="text-right">{translate("数量", "Qty")}</TableHead><TableHead>{translate("原因／关联", "Reason / Reference")}</TableHead><TableHead>{translate("操作人", "Operator")}</TableHead><TableHead>{translate("日期", "Date")}</TableHead></TableRow></TableHeader>
              <TableBody>{(movements as any[]).map((movement: any) => <TableRow key={movement.id}>
                <TableCell><div className="font-medium">{movement.productName || `商品 #${movement.productId}`}</div>{movement.variantName && <div className="text-xs text-muted-foreground">{movement.variantName}</div>}</TableCell>
                <TableCell>{MOVEMENT_TYPE_LABELS[movement.movementType] ? (lang === "zh" ? MOVEMENT_TYPE_LABELS[movement.movementType].zh : MOVEMENT_TYPE_LABELS[movement.movementType].en) : movement.movementType}</TableCell>
                <TableCell>{movement.stockBefore} → {movement.stockAfter}</TableCell>
                <TableCell className={`text-right ${Number(movement.quantityChange) < 0 ? "text-red-600" : "text-emerald-600"}`}>{Number(movement.quantityChange) > 0 ? "+" : ""}{movement.quantityChange}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{movement.reason || "-"}</TableCell><TableCell>{movement.operator || "-"}</TableCell><TableCell className="text-sm">{fmtDate(movement.createdAt)}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          ) : <div className="py-8 text-center text-muted-foreground">{translate("暂无记录", "No records")}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
