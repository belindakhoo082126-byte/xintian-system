import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, ShoppingBag, DollarSign, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { ReportMethodologyCard } from "@/components/ReportMethodologyCard";

const PRESET_LABELS = [
  { value: "today", zh: "今天", en: "Today" },
  { value: "yesterday", zh: "昨天", en: "Yesterday" },
  { value: "this_week", zh: "本周", en: "This Week" },
  { value: "this_month", zh: "本月", en: "This Month" },
  { value: "last_month", zh: "上个月", en: "Last Month" },
  { value: "this_year", zh: "今年", en: "This Year" },
  { value: "custom", zh: "自定义", en: "Custom" },
];

function formatRM(n: number | undefined | null): string {
  if (n === undefined || n === null) return "RM 0.00";
  return `RM ${Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(ts: number | string | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function CustomerSpendingReport() {
  const { translate } = useI18n();
  const [preset, setPreset] = useState("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const queryParams = useMemo(
    () => (preset === "custom" ? { preset, customStart, customEnd } : { preset }),
    [preset, customStart, customEnd],
  );

  const enabled = preset !== "custom" || (customStart !== "" && customEnd !== "");
  const { data: customers, isLoading } = trpc.reports.customerSpending.useQuery(queryParams, { enabled });

  const summary = useMemo(() => {
    if (!customers || customers.length === 0) return { count: 0, orders: 0, totalAmount: 0, totalPaid: 0, totalUnpaid: 0 };
    return customers.reduce(
      (acc, c) => ({
        count: acc.count + 1,
        orders: acc.orders + (c.orderCount || 0),
        totalAmount: acc.totalAmount + (c.totalOrderAmount || 0),
        totalPaid: acc.totalPaid + (c.totalPaid || 0),
        totalUnpaid: acc.totalUnpaid + (c.totalUnpaid || 0),
      }),
      { count: 0, orders: 0, totalAmount: 0, totalPaid: 0, totalUnpaid: 0 },
    );
  }, [customers]);

  return (
    <div className="space-y-6">
      <ReportMethodologyCard kind="customerSpending" />
      <div className="flex items-center gap-4">
        <Link href="/profit-report">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("客户消费报告", "Customer Spending Report")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{translate("各客户消费金额与付款情况分析", "Analysis of customer spending and payment status")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {PRESET_LABELS.map((p) => (
          <Button key={p.value} size="sm" variant={preset === p.value ? "default" : "outline"} onClick={() => setPreset(p.value)}>
            {translate(p.zh, p.en)}
          </Button>
        ))}
      </div>

      {preset === "custom" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-2">
                <Label>{translate("开始日期", "Start Date")}</Label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{translate("结束日期", "End Date")}</Label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{translate("客户数", "Customers")}</p>
                <p className="text-lg font-bold text-purple-600">{summary.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{translate("总订单数", "Total Orders")}</p>
                <p className="text-lg font-bold text-blue-600">{summary.orders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{translate("总消费金额", "Total Spending")}</p>
                <p className="text-lg font-bold text-green-600">{formatRM(summary.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{translate("已付", "Paid")}</p>
                <p className="text-lg font-bold text-emerald-600">{formatRM(summary.totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                <TrendingDown className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{translate("未付款", "Unpaid")}</p>
                <p className="text-lg font-bold text-orange-600">{formatRM(summary.totalUnpaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{translate("客户消费明细", "Customer Spending Details")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : customers && customers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translate("客户", "Customer")}</TableHead>
                  <TableHead>{translate("客户编号", "Customer ID")}</TableHead>
                  <TableHead>{translate("电话", "Phone")}</TableHead>
                  <TableHead className="text-right">{translate("订单数", "Orders")}</TableHead>
                  <TableHead className="text-right">{translate("总消费", "Total Spending")}</TableHead>
                  <TableHead className="text-right">{translate("已付", "Paid")}</TableHead>
                  <TableHead className="text-right">{translate("未付款", "Unpaid")}</TableHead>
                  <TableHead>{translate("最近下单", "Last Order")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.displayName || translate("未知", "Unknown")}</TableCell>
                    <TableCell className="text-muted-foreground">{c.customerCode || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone || c.whatsappPhone || "-"}</TableCell>
                    <TableCell className="text-right">{c.orderCount}</TableCell>
                    <TableCell className="text-right font-semibold">{formatRM(c.totalOrderAmount)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatRM(c.totalPaid)}</TableCell>
                    <TableCell className={`text-right ${c.totalUnpaid > 0 ? "text-orange-600" : ""}`}>{formatRM(c.totalUnpaid)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(c.lastOrderDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">{translate("暂无数据", "No data available")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
