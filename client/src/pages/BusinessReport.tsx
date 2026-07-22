import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, TrendingUp, TrendingDown, Package, Percent,
  ShoppingBag, Users, Truck, ArrowLeft, Calendar, Trophy,
  Crown, Medal, Award, Receipt, AlertCircle,
} from "lucide-react";
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

export default function BusinessReport() {
  const [preset, setPreset] = useState("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const queryParams = useMemo(
    () => (preset === "custom" ? { preset, customStart, customEnd } : { preset }),
    [preset, customStart, customEnd],
  );

  const { data: overview, isLoading: loadingOverview } = trpc.reports.overview.useQuery(queryParams, {
    enabled: preset !== "custom" || (customStart !== "" && customEnd !== ""),
  });
  const { data: topQty, isLoading: loadingQty } = trpc.reports.topByQuantity.useQuery(queryParams, {
    enabled: preset !== "custom" || (customStart !== "" && customEnd !== ""),
  });
  const { data: topRev, isLoading: loadingRev } = trpc.reports.topByRevenue.useQuery(queryParams, {
    enabled: preset !== "custom" || (customStart !== "" && customEnd !== ""),
  });
  const { data: topProfit, isLoading: loadingProfit } = trpc.reports.topByProfit.useQuery(queryParams, {
    enabled: preset !== "custom" || (customStart !== "" && customEnd !== ""),
  });
  const { data: topCustomers, isLoading: loadingCustomers } = trpc.reports.topCustomers.useQuery(queryParams, {
    enabled: preset !== "custom" || (customStart !== "" && customEnd !== ""),
  });

  const cards = overview ? [
    { title: "总业绩", value: formatRM(overview.totalRevenue), icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
    { title: "已汇款金额", value: formatRM(overview.totalPaid), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
    { title: "未汇款金额", value: formatRM(overview.totalUnpaid), icon: TrendingDown, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/20" },
    { title: "退款金额", value: formatRM(overview.totalRefunds), icon: Receipt, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20" },
    { title: "已汇款订单数", value: `${overview.orderStats.paid}`, icon: ShoppingBag, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    { title: "未汇款订单数", value: `${overview.orderStats.unpaid}`, icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
    { title: "已寄包裹数量", value: `${overview.shippedPackages}`, icon: Package, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/20" },
    { title: "承担运费", value: formatRM(overview.borneShipping), icon: Truck, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/20" },
    { title: "商品成本(FIFO)", value: formatRM(overview.fifoCost), icon: TrendingDown, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/20" },
    { title: "实际毛利润", value: formatRM(overview.grossProfit), icon: TrendingUp, color: overview.grossProfit >= 0 ? "text-green-600" : "text-red-600", bg: "bg-green-50 dark:bg-green-950/20" },
    { title: "毛利率", value: `${overview.grossMargin}%`, icon: Percent, color: overview.grossMargin >= 0 ? "text-green-600" : "text-red-600", bg: "bg-green-50 dark:bg-green-950/20" },
    { title: "运费收入", value: formatRM(overview.shippingIncome), icon: Truck, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/20" },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">经营总览</h1>
          <p className="text-sm text-muted-foreground mt-1">12 项核心经营指标 + TOP10 排行榜</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={preset === p.value ? "default" : "outline"}
              onClick={() => setPreset(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
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

      {/* 12 Data Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {loadingOverview
          ? Array.from({ length: 12 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))
          : cards.map((card, i) => {
              const Icon = card.icon;
              return (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${card.bg}`}>
                        <Icon className={`h-5 w-5 ${card.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{card.title}</p>
                        <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Order Stats Summary */}
      {overview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">订单统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">总订单数</p>
                <p className="text-xl font-bold">{overview.orderStats.total}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">已付款</p>
                <p className="text-xl font-bold text-green-600">{overview.orderStats.paid}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">未付款</p>
                <p className="text-xl font-bold text-orange-600">{overview.orderStats.unpaid}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">已退款</p>
                <p className="text-xl font-bold text-red-600">{overview.orderStats.refunded}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">已完成</p>
                <p className="text-xl font-bold text-blue-600">{overview.orderStats.completed}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">已取消</p>
                <p className="text-xl font-bold text-gray-500">{overview.orderStats.cancelled}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TOP10 Leaderboards */}
      <Tabs defaultValue="quantity" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quantity">
            <Trophy className="h-4 w-4 mr-1" /> 销量榜
          </TabsTrigger>
          <TabsTrigger value="revenue">
            <Medal className="h-4 w-4 mr-1" /> 销售额榜
          </TabsTrigger>
          <TabsTrigger value="profit">
            <Award className="h-4 w-4 mr-1" /> 毛利润榜
          </TabsTrigger>
          <TabsTrigger value="customers">
            <Crown className="h-4 w-4 mr-1" /> 消费客户榜
          </TabsTrigger>
        </TabsList>

        {/* TOP10 by Quantity */}
        <TabsContent value="quantity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-5 w-5 text-yellow-500" /> 最好卖商品 TOP 10（按销量）
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingQty ? (
                <Skeleton className="h-64 w-full" />
              ) : topQty && topQty.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">排名</TableHead>
                      <TableHead>商品名称</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead className="text-right">销量</TableHead>
                      <TableHead className="text-right">销售额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topQty.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant={i < 3 ? "default" : "secondary"}>{i + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-muted-foreground">{item.variantName || "-"}</TableCell>
                        <TableCell className="text-right font-semibold">{item.totalQuantity}</TableCell>
                        <TableCell className="text-right">{formatRM(item.totalSales)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">暂无数据</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TOP10 by Revenue */}
        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Medal className="h-5 w-5 text-gray-400" /> 最好卖商品 TOP 10（按销售额）
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRev ? (
                <Skeleton className="h-64 w-full" />
              ) : topRev && topRev.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">排名</TableHead>
                      <TableHead>商品名称</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead className="text-right">销量</TableHead>
                      <TableHead className="text-right">销售额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topRev.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant={i < 3 ? "default" : "secondary"}>{i + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-muted-foreground">{item.variantName || "-"}</TableCell>
                        <TableCell className="text-right">{item.totalQuantity}</TableCell>
                        <TableCell className="text-right font-semibold">{formatRM(item.totalSales)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">暂无数据</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TOP10 by Profit */}
        <TabsContent value="profit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-5 w-5 text-amber-600" /> 最赚钱商品 TOP 10（按毛利润）
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProfit ? (
                <Skeleton className="h-64 w-full" />
              ) : topProfit && topProfit.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">排名</TableHead>
                      <TableHead>商品名称</TableHead>
                      <TableHead className="text-right">销售额</TableHead>
                      <TableHead className="text-right">FIFO成本</TableHead>
                      <TableHead className="text-right">毛利润</TableHead>
                      <TableHead className="text-right">毛利率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProfit.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant={i < 3 ? "default" : "secondary"}>{i + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-right">{formatRM(item.totalSales)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatRM(item.fifoCost)}</TableCell>
                        <TableCell className={`text-right font-semibold ${item.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatRM(item.grossProfit)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={item.grossMargin >= 0 ? "text-green-600" : "text-red-600"}>
                            {item.grossMargin}%
                          </span>
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
        </TabsContent>

        {/* TOP10 Customers */}
        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Crown className="h-5 w-5 text-yellow-500" /> 消费最高客户 TOP 10（按已汇款金额）
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCustomers ? (
                <Skeleton className="h-64 w-full" />
              ) : topCustomers && topCustomers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">排名</TableHead>
                      <TableHead>客户</TableHead>
                      <TableHead>客户编号</TableHead>
                      <TableHead className="text-right">订单数</TableHead>
                      <TableHead className="text-right">已汇款金额</TableHead>
                      <TableHead>最近下单</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCustomers.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant={i < 3 ? "default" : "secondary"}>{i + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.displayName || "未知"}</TableCell>
                        <TableCell className="text-muted-foreground">{item.customerCode || "-"}</TableCell>
                        <TableCell className="text-right">{item.orderCount}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">{formatRM(item.totalPaid)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(item.lastOrderDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">暂无数据</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sub-report links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/reports/sales-payment">
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardContent className="pt-6 flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <div>
                <p className="font-medium">销售与收款报告</p>
                <p className="text-xs text-muted-foreground">订单付款明细</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/reports/product-sales">
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardContent className="pt-6 flex items-center gap-3">
              <ShoppingBag className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium">商品销售报告</p>
                <p className="text-xs text-muted-foreground">商品销量与利润</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/reports/customer-spending">
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardContent className="pt-6 flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-600" />
              <div>
                <p className="font-medium">客户消费报告</p>
                <p className="text-xs text-muted-foreground">客户消费分析</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/reports/purchase-inventory">
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardContent className="pt-6 flex items-center gap-3">
              <Truck className="h-8 w-8 text-orange-600" />
              <div>
                <p className="font-medium">进货与库存报告</p>
                <p className="text-xs text-muted-foreground">采购与库存状态</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
