import { useState, useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
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
import { ReportMethodologyCard } from "@/components/ReportMethodologyCard";

const PRESETS = [
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

function formatDateTime(ts: number | string | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS_MAP: Record<string, { zh: string; en: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { zh: "待处理", en: "Pending", variant: "secondary" },
  confirmed: { zh: "已确认", en: "Confirmed", variant: "default" },
  shipping: { zh: "配送中", en: "Shipping", variant: "default" },
  shipped: { zh: "已发货", en: "Shipped", variant: "default" },
  completed: { zh: "已完成", en: "Completed", variant: "default" },
  cancelled: { zh: "已取消", en: "Cancelled", variant: "destructive" },
};

export default function SalesPaymentReport() {
  const { lang, translate } = useI18n();
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
      <ReportMethodologyCard kind="salesPayment" />
      <div className="flex items-center gap-4">
        <Link href="/profit-report">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("销售与收款报告", "Sales & Payment Report")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{translate("订单付款明细一览", "Overview of order payment details")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map((p) => (
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{translate("商品销售额", "Product Sales")}</p>
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
                <p className="text-xs text-muted-foreground">{translate("已收款", "Amount Received")}</p>
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
                <p className="text-xs text-muted-foreground">{translate("未收款", "Amount Due")}</p>
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
                <p className="text-xs text-muted-foreground">{translate("订单数", "Number of Orders")}</p>
                <p className="text-lg font-bold text-purple-600">{summary.orders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{translate("订单付款明细", "Order Payment Details")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : orders && orders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translate("订单号", "Order No.")}</TableHead>
                  <TableHead>{translate("客户", "Customer")}</TableHead>
                  <TableHead className="text-right">{translate("商品金额", "Product Amount")}</TableHead>
                  <TableHead className="text-right">{translate("运费", "Shipping Fee")}</TableHead>
                  <TableHead className="text-right">{translate("总额", "Total Amount")}</TableHead>
                  <TableHead className="text-right">{translate("已付", "Paid")}</TableHead>
                  <TableHead className="text-right">{translate("欠款", "Balance Due")}</TableHead>
                  <TableHead>{translate("状态", "Status")}</TableHead>
                  <TableHead>{translate("付款方式", "Payment Method")}</TableHead>
                  <TableHead>{translate("下单时间", "Order Time")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                    <TableCell className="font-medium">{o.customerName || translate("-", "-")}</TableCell>
                    <TableCell className="text-right">{formatRM(o.productSubtotal)}</TableCell>
                    <TableCell className="text-right">{formatRM(o.shippingFee)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatRM(o.totalAmount)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatRM(o.paidAmount)}</TableCell>
                    <TableCell className={`text-right ${o.balance > 0 ? "text-orange-600" : ""}`}>{formatRM(o.balance)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_MAP[o.status]?.variant || "secondary"}>
                        {translate(STATUS_MAP[o.status]?.zh || o.status, STATUS_MAP[o.status]?.en || o.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.paymentMethod || translate("-", "-")}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDateTime(o.createdAt)}</TableCell>
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
