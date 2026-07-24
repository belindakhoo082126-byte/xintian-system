import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ShoppingBag, TrendingDown, TrendingUp, Percent } from "lucide-react";
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

export default function ProductSalesReport() {
  const [preset, setPreset] = useState("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const queryParams = useMemo(
    () => (preset === "custom" ? { preset, customStart, customEnd } : { preset }),
    [preset, customStart, customEnd],
  );

  const enabled = preset !== "custom" || (customStart !== "" && customEnd !== "");
  const { data: products, isLoading } = trpc.reports.productSales.useQuery(queryParams, { enabled });

  const summary = useMemo(() => {
    if (!products || products.length === 0) return { totalQty: 0, totalSales: 0, totalCost: 0, totalProfit: 0 };
    return products.reduce(
      (acc, p) => ({
        totalQty: acc.totalQty + (p.totalQuantity || 0),
        totalSales: acc.totalSales + (p.totalSales || 0),
        totalCost: acc.totalCost + (p.fifoCost || 0),
        totalProfit: acc.totalProfit + (p.grossProfit || 0),
      }),
      { totalQty: 0, totalSales: 0, totalCost: 0, totalProfit: 0 },
    );
  }, [products]);

  const overallMargin = summary.totalSales > 0 ? Math.round((summary.totalProfit / summary.totalSales) * 10000) / 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/profit-report">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">商品销售报告</h1>
          <p className="text-sm text-muted-foreground mt-1">各商品销量、销售额与毛利润分析</p>
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
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">总销量</p>
                <p className="text-lg font-bold text-blue-600">{summary.totalQty}</p>
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
                <p className="text-xs text-muted-foreground">总销售额</p>
                <p className="text-lg font-bold text-green-600">{formatRM(summary.totalSales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">FIFO总成本</p>
                <p className="text-lg font-bold text-red-600">{formatRM(summary.totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">总毛利润</p>
                <p className={`text-lg font-bold ${summary.totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatRM(summary.totalProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                <Percent className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">整体毛利率</p>
                <p className={`text-lg font-bold ${overallMargin >= 0 ? "text-purple-600" : "text-red-600"}`}>{overallMargin}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">商品销售明细</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : products && products.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品名称</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead className="text-right">销量</TableHead>
                  <TableHead className="text-right">销售额</TableHead>
                  <TableHead className="text-right">订单数</TableHead>
                  <TableHead className="text-right">FIFO成本</TableHead>
                  <TableHead className="text-right">毛利润</TableHead>
                  <TableHead className="text-right">毛利率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.productName}</TableCell>
                    <TableCell className="text-muted-foreground">{p.variantName || "-"}</TableCell>
                    <TableCell className="text-right font-semibold">{p.totalQuantity}</TableCell>
                    <TableCell className="text-right">{formatRM(p.totalSales)}</TableCell>
                    <TableCell className="text-right">{p.orderCount}</TableCell>
                    <TableCell className="text-right text-red-600">{formatRM(p.fifoCost)}</TableCell>
                    <TableCell className={`text-right font-semibold ${p.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatRM(p.grossProfit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={p.grossMargin >= 0 ? "text-green-600" : "text-red-600"}>{p.grossMargin}%</span>
                    </TableCell>
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
