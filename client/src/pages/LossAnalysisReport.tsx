import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { ReportMethodologyCard } from "@/components/ReportMethodologyCard";

const ADJUSTMENT_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  quality_issue: { zh: "品质异常报废", en: "Quality Issue Scrap" },
  plant_death: { zh: "植物死亡", en: "Plant Death" },
  pest_disease: { zh: "病虫害", en: "Pest/Disease" },
  human_damage: { zh: "人为损坏", en: "Human Damage" },
  lost: { zh: "遗失", en: "Lost" },
  other: { zh: "其他", en: "Other" },
};

export default function LossAnalysisReport() {
  const { translate, lang } = useI18n();

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [dateFrom, setDateFrom] = useState(monthStart.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));
  const [preset, setPreset] = useState("thisMonth");

  const { data, isLoading, refetch, isFetching } = trpc.lossAnalysis.report.useQuery({
    dateFrom,
    dateTo,
  });

  const applyPreset = (p: string) => {
    setPreset(p);
    const now = new Date();
    let from = new Date();
    switch (p) {
      case "today":
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "thisWeek":
        const day = now.getDay() || 7;
        from = new Date(now);
        from.setDate(now.getDate() - day + 1);
        break;
      case "thisMonth":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        return;
    }
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(now.toISOString().slice(0, 10));
  };

  const fmt = (n: number) => `RM ${Number(n).toFixed(2)}`;

  return (
    <div className="space-y-6">
      <ReportMethodologyCard kind="lossAnalysis" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          {translate("损耗分析报告", "Loss Analysis Report")}
        </h1>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          {translate("刷新", "Refresh")}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>{translate("日期范围", "Date Range")}</Label>
              <Select value={preset} onValueChange={applyPreset}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">{translate("今日", "Today")}</SelectItem>
                  <SelectItem value="thisWeek">{translate("本周", "This Week")}</SelectItem>
                  <SelectItem value="thisMonth">{translate("本月", "This Month")}</SelectItem>
                  <SelectItem value="custom">{translate("自订", "Custom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{translate("从", "From")}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPreset("custom"); }} className="w-[160px]" />
            </div>
            <div className="space-y-1">
              <Label>{translate("到", "To")}</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPreset("custom"); }} className="w-[160px]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{translate("加载中...", "Loading...")}</div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">{translate("损耗总盆数", "Total Loss Units")}</div>
                <div className="text-2xl font-bold mt-1 text-red-600">{data.totalLossUnits}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">{translate("损耗总成本", "Total Loss Cost")}</div>
                <div className="text-2xl font-bold mt-1 text-red-600">{fmt(data.totalLossCost)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">{translate("损耗率", "Loss Rate")}</div>
                <div className="text-2xl font-bold mt-1 text-orange-600">{data.lossRate}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Loss by Type */}
          <Card>
            <CardHeader><CardTitle className="text-base">{translate("按损耗类型统计", "Loss by Type")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate("损耗类型", "Loss Type")}</TableHead>
                    <TableHead className="text-right">{translate("损耗盆数", "Loss Units")}</TableHead>
                    <TableHead className="text-right">{translate("损耗成本", "Loss Cost")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.summary.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>
                        {ADJUSTMENT_TYPE_LABELS[item.adjustmentType]
                          ? (lang === "zh" ? ADJUSTMENT_TYPE_LABELS[item.adjustmentType].zh : ADJUSTMENT_TYPE_LABELS[item.adjustmentType].en)
                          : item.adjustmentType}
                      </TableCell>
                      <TableCell className="text-right">{item.lossUnits}</TableCell>
                      <TableCell className="text-right text-red-600">{fmt(item.lossCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Product Loss Ranking */}
          <Card>
            <CardHeader><CardTitle className="text-base">{translate("商品损耗排行榜", "Product Loss Ranking")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate("商品名称", "Product Name")}</TableHead>
                    <TableHead className="text-right">{translate("损耗盆数", "Loss Units")}</TableHead>
                    <TableHead className="text-right">{translate("损耗成本", "Loss Cost")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.productRanking.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{item.productName || "-"}</TableCell>
                      <TableCell className="text-right">{item.lossUnits}</TableCell>
                      <TableCell className="text-right text-red-600">{fmt(item.lossCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Category Loss Ranking */}
          <Card>
            <CardHeader><CardTitle className="text-base">{translate("品种损耗排行榜", "Category Loss Ranking")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate("品种", "Category")}</TableHead>
                    <TableHead className="text-right">{translate("损耗盆数", "Loss Units")}</TableHead>
                    <TableHead className="text-right">{translate("损耗成本", "Loss Cost")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.categoryRanking.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{item.categoryName || "-"}</TableCell>
                      <TableCell className="text-right">{item.lossUnits}</TableCell>
                      <TableCell className="text-right text-red-600">{fmt(item.lossCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">{translate("暂无数据", "No data")}</div>
      )}
    </div>
  );
}
