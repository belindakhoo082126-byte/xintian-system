import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Percent } from "lucide-react";
import { ReportMethodologyCard } from "@/components/ReportMethodologyCard";

const MONTHS = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];

export default function ProfitReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: report, isLoading } = trpc.reports.monthlyProfit.useQuery({ year, month });

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const stats = [
    {
      title: "总收入",
      value: `RM ${report?.revenue || "0"}`,
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/20",
    },
    {
      title: "总成本",
      value: `RM ${report?.cost || "0"}`,
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950/20",
    },
    {
      title: "净利润",
      value: `RM ${report?.profit || "0"}`,
      icon: TrendingUp,
      color: parseFloat(report?.profit || "0") >= 0 ? "text-green-600" : "text-red-600",
      bg: "bg-blue-50 dark:bg-blue-950/20",
    },
    {
      title: "利润率",
      value: `${report?.profitMargin || 0}%`,
      icon: Percent,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/20",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">利润报表</h1>
          <p className="text-sm text-muted-foreground mt-1">月度已完成订单的旧版利润估算</p>
        </div>
        <div className="flex gap-2">
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y.toString()}>{y}年</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ReportMethodologyCard kind="legacyMonthlyProfit" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.title}</p>
                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${s.bg}`}>
                    <Icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">实体商品收入</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold">RM {report?.physicalRevenue || "0"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">会员费收入</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold">RM {report?.membershipRevenue || "0"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">运费收入</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold">RM {report?.shippingRevenue || "0"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">订单数</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold">{report?.orderCount || 0}</p></CardContent>
        </Card>
      </div>

      {/* Order details */}
      <Card>
        <CardHeader><CardTitle className="text-base">订单利润明细</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单号</TableHead>
                <TableHead>收入</TableHead>
                <TableHead>成本</TableHead>
                <TableHead>利润</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : report?.details?.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">本月暂无已完成订单</TableCell></TableRow>
              ) : report?.details?.map((d: any) => (
                <TableRow key={d.orderId}>
                  <TableCell className="font-mono text-sm">{d.orderNumber}</TableCell>
                  <TableCell>RM {d.revenue}</TableCell>
                  <TableCell>RM {d.cost}</TableCell>
                  <TableCell className={parseFloat(d.profit) >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    RM {d.profit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
