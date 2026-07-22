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

const PRESETS = [
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "this_week", label: "本周" },
  { value: "this_month", label: "本月" },
  { value: "last_month", label: "上个月" },
  { value: "this_year", label: "今年" },
  { value: "custom", label: "自定义" },
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
      <div className="flex items-center gap-4">
        <Link href="/profit-report">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">客户消费报告</h1>
          <p className="text-sm text-muted-foreground mt-1">各客户消费金额与付款情况分析</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <Button key={p.value} size="sm" variant={preset === p.value ? "default" : "outline"} onClick={() => setPreset(p.value)}>
            {p.label}
          </Button>
        ))}
      </div>

      {preset === "custom" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-2">
                <Label>开始日期</Label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>结束日期</Label>
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
                <p className="text-xs text-muted-foreground">客户数</p>
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
                <p className="text-xs text-muted-foreground">总订单数</p>
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
                <p className="text-xs text-muted-foreground">总消费金额</p>
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
                <p className="text-xs text-muted-foreground">已付款</p>
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
                <p className="text-xs text-muted-foreground">未付款</p>
                <p className="text-lg font-bold text-orange-600">{formatRM(summary.totalUnpaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">客户消费明细</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : customers && customers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>客户</TableHead>
                  <TableHead>客户编号</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead className="text-right">订单数</TableHead>
                  <TableHead className="text-right">总消费</TableHead>
                  <TableHead className="text-right">已付款</TableHead>
                  <TableHead className="text-right">未付款</TableHead>
                  <TableHead>最近下单</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.displayName || "未知"}</TableCell>
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
            <p className="text-center text-muted-foreground py-8">暂无数据</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
