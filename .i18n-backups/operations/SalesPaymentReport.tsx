import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
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

function formatDateTime(ts: number | string | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待处理", variant: "secondary" },
  confirmed: { label: "已确认", variant: "default" },
  shipping: { label: "配送中", variant: "default" },
  shipped: { label: "已发货", variant: "default" },
  completed: { label: "已完成", variant: "default" },
  cancelled: { label: "已取消", variant: "destructive" },
};

export default function SalesPaymentReport() {
  const [preset, setPreset] = useState("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const queryParams = useMemo(
    () => (preset === "custom" ? { preset, customStart, customEnd } : { preset }),
    [preset, customStart, customEnd],
  );

  const enabled = preset !== "custom" || (customStart !== "" && customEnd !== "");
  const { data: orders, isLoading } = trpc.reports.salesPayment.useQuery(queryParams, { enabled });

  const summary = useMemo(() => {
    if (!orders || orders.length === 0) return { total: 0, paid: 0, unpaid: 0, orders: 0 };
    return orders.reduce(
      (acc, o) => ({
        total: acc.total + (o.productSubtotal || 0),
        paid: acc.paid + (o.paidAmount || 0),
        unpaid: acc.unpaid + (o.balance || 0),
        orders: acc.orders + 1,
      }),
      { total: 0, paid: 0, unpaid: 0, orders: 0 },
    );
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/profit-report">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">销售与收款报告</h1>
          <p className="text-sm text-muted-foreground mt-1">订单付款明细一览</p>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">商品销售额</p>
                <p className="text-lg font-bold text-blue-600">{formatRM(summary.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">已收款</p>
                <p className="text-lg font-bold text-green-600">{formatRM(summary.paid)}</p>
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
                <p className="text-xs text-muted-foreground">未收款</p>
                <p className="text-lg font-bold text-orange-600">{formatRM(summary.unpaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">订单数</p>
                <p className="text-lg font-bold text-purple-600">{summary.orders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">订单付款明细</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : orders && orders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单号</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead className="text-right">商品金额</TableHead>
                  <TableHead className="text-right">运费</TableHead>
                  <TableHead className="text-right">总额</TableHead>
                  <TableHead className="text-right">已付</TableHead>
                  <TableHead className="text-right">欠款</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>付款方式</TableHead>
                  <TableHead>下单时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                    <TableCell className="font-medium">{o.customerName || "-"}</TableCell>
                    <TableCell className="text-right">{formatRM(o.productSubtotal)}</TableCell>
                    <TableCell className="text-right">{formatRM(o.shippingFee)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatRM(o.totalAmount)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatRM(o.paidAmount)}</TableCell>
                    <TableCell className={`text-right ${o.balance > 0 ? "text-orange-600" : ""}`}>{formatRM(o.balance)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_MAP[o.status]?.variant || "secondary"}>
                        {STATUS_MAP[o.status]?.label || o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.paymentMethod || "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDateTime(o.createdAt)}</TableCell>
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
