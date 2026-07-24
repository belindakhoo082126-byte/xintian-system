import { useState, useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, DollarSign, Package, Truck, AlertTriangle, RefreshCw } from "lucide-react";

export default function ProfitAnalysisReport() {
  const { translate, lang } = useI18n();
  const utils = trpc.useUtils();

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [dateFrom, setDateFrom] = useState(monthStart.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));
  const [preset, setPreset] = useState("thisMonth");

  const { data, isLoading, refetch, isFetching } = trpc.profitAnalysis.report.useQuery({
    dateFrom,
    dateTo,
  });

  const applyPreset = (p: string) => {
    setPreset(p);
    const now = new Date();
    let from = new Date();
    let to = now;
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
    setDateTo(to.toISOString().slice(0, 10));
  };

  const fmt = (n: number) => `RM ${Number(n).toFixed(2)}`;

  const cards = data ? [
    { label: translate("销售额", "Sales Revenue"), value: fmt(data.salesRevenue), icon: DollarSign, color: "text-blue-600" },
    { label: translate("商品成本", "Product Cost"), value: fmt(data.productCost), icon: Package, color: "text-orange-600" },
    { label: translate("运费收入", "Shipping Income"), value: fmt(data.shippingIncome), icon: Truck, color: "text-green-600" },
    { label: translate("运费支出", "Shipping Cost"), value: fmt(data.shippingCost), icon: Truck, color: "text-red-600" },
    { label: translate("运费差额", "Shipping Diff"), value: fmt(data.shippingDiff), icon: Truck, color: data.shippingDiff >= 0 ? "text-green-600" : "text-red-600" },
    { label: translate("报废损耗", "Scrap Loss"), value: fmt(data.scrapLoss), icon: AlertTriangle, color: "text-red-600" },
    { label: translate("退款损失", "Refund Loss"), value: fmt(data.refundLoss), icon: AlertTriangle, color: "text-red-600" },
    { label: translate("实际毛利", "Actual Gross Profit"), value: fmt(data.actualGrossProfit), icon: TrendingUp, color: data.actualGrossProfit >= 0 ? "text-green-600" : "text-red-600" },
    { label: translate("毛利率", "Gross Margin"), value: `${data.grossMargin}%`, icon: TrendingUp, color: data.grossMargin >= 0 ? "text-green-600" : "text-red-600" },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{translate("利润分析报告", "Profit Analysis Report")}</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          {translate("刷新", "Refresh")}
        </Button>
      </div>

      {/* Date Filter */}
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

      {/* KPI Cards */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{translate("加载中...", "Loading...")}</div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">{card.label}</div>
                      <div className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</div>
                    </div>
                    <Icon className={`h-8 w-8 ${card.color} opacity-50`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">{translate("暂无数据", "No data")}</div>
      )}
    </div>
  );
}
