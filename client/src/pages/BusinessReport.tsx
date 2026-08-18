import { useState, useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
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

function formatDate(ts: number | string | undefined, lang: "zh" | "en"): string {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function BusinessReport() {
  const { lang, translate } = useI18n();
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
    { title: translate("总业绩", "Total Revenue"), value: formatRM(overview.totalRevenue), icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
    { title: translate("已汇款金额", "Paid Amount"), value: formatRM(overview.totalPaid), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
    { title: translate("未汇款金额", "Unpaid Amount"), value: formatRM(overview.totalUnpaid), icon: TrendingDown, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/20" },
    { title: translate("退款金额", "Refund Amount"), value: formatRM(overview.totalRefunds), icon: Receipt, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20" },
    { title: translate("已汇款订单数", "Paid Orders"), value: `${overview.orderStats.paid}`, icon: ShoppingBag, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    { title: translate("未汇款订单数", "Unpaid Orders"), value: `${overview.orderStats.unpaid}`, icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
    { title: translate("已寄包裹数量", "Shipped Packages"), value: `${overview.shippedPackages}`, icon: Package, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/20" },
    { title: translate("承担运费", "Borne Shipping Fee"), value: formatRM(overview.borneShipping), icon: Truck, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/20" },
    { title: translate("商品成本(FIFO)", "Product Cost (FIFO)"), value: formatRM(overview.fifoCost), icon: TrendingDown, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/20" },
    { title: translate("实际毛利润", "Actual Gross Profit"), value: formatRM(overview.grossProfit), icon: TrendingUp, color: overview.grossProfit >= 0 ? "text-green-600" : "text-red-600", bg: "bg-green-50 dark:bg-green-950/20" },
    { title: translate("毛利率", "Gross Margin"), value: `${overview.grossMargin}%`, icon: Percent, color: overview.grossMargin >= 0 ? "text-green-600" : "text-red-600", bg: "bg-green-50 dark:bg-green-950/20" },
    { title: translate("运费收入", "Shipping Income"), value: formatRM(overview.shippingIncome), icon: Truck, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/20" },
  ] : [];

  return (
    <div className="space-y-6">
      <ReportMethodologyCard kind="businessOverview" />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("经营总览", "Business Overview")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{translate("12 项核心经营指标 + TOP10 排行榜", "12 Core Business Metrics + TOP10 Leaderboards")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={preset === p.value ? "default" : "outline"}
              onClick={() => setPreset(p.value)}
            >
              {translate(p.zh, p.en)}
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
            <CardTitle className="text-base">{translate("订单统计", "Order Statistics")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{translate("总订单数", "Total Orders")}</p>
                <p className="text-xl font-bold">{overview.orderStats.total}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{translate("已付", "Paid")}</p>
                <p className="text-xl font-bold text-green-600">{overview.orderStats.paid}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{translate("未付款", "Unpaid")}</p>
                <p className="text-xl font-bold text-orange-600">{overview.orderStats.unpaid}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{translate("已退款", "Refunded")}</p>
                <p className="text-xl font-bold text-red-600">{overview.orderStats.refunded}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{translate("已完成", "Completed")}</p>
                <p className="text-xl font-bold text-blue-600">{overview.orderStats.completed}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{translate("已取消", "Cancelled")}</p>
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
            <Trophy className="h-4 w-4 mr-1" /> {translate("销量榜", "Sales Volume Leaderboard")}
          </TabsTrigger>
          <TabsTrigger value="revenue">
            <Medal className="h-4 w-4 mr-1" /> {translate("销售额榜", "Revenue Leaderboard")}
          </TabsTrigger>
          <TabsTrigger value="profit">
            <Award className="h-4 w-4 mr-1" /> {translate("毛利润榜", "Gross Profit Leaderboard")}
          </TabsTrigger>
          <TabsTrigger value="customers">
            <Crown className="h-4 w-4 mr-1" /> {translate("消费客户榜", "Top Customers Leaderboard")}
          </TabsTrigger>
        </TabsList>

        {/* TOP10 by Quantity */}
        <TabsContent value="quantity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-5 w-5 text-yellow-500" /> {translate("最好卖商品 TOP 10（按销量）", "Best Selling Products TOP 10 (by Quantity)")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingQty ? (
                <Skeleton className="h-64 w-full" />
              ) : topQty && topQty.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">{translate("排名", "Rank")}</TableHead>
                      <TableHead>{translate("商品名称", "Product Name")}</TableHead>
                      <TableHead>{translate("规格", "Variant")}</TableHead>
                      <TableHead className="text-right">{translate("销量", "Quantity")}</TableHead>
                      <TableHead className="text-right">{translate("销售额", "Revenue")}</TableHead>
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
                <p className="text-center text-muted-foreground py-8">{translate("暂无数据", "No Data Available")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TOP10 by Revenue */}
        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Medal className="h-5 w-5 text-gray-400" /> {translate("最好卖商品 TOP 10（按销售额）", "Best Selling Products TOP 10 (by Revenue)")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRev ? (
                <Skeleton className="h-64 w-full" />
              ) : topRev && topRev.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">{translate("排名", "Rank")}</TableHead>
                      <TableHead>{translate("商品名称", "Product Name")}</TableHead>
                      <TableHead>{translate("规格", "Variant")}</TableHead>
                      <TableHead className="text-right">{translate("销量", "Quantity")}</TableHead>
                      <TableHead className="text-right">{translate("销售额", "Revenue")}</TableHead>
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
                <p className="text-center text-muted-foreground py-8">{translate("暂无数据", "No Data Available")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TOP10 by Profit */}
        <TabsContent value="profit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-5 w-5 text-amber-600" /> {translate("最赚钱商品 TOP 10（按毛利润）", "Most Profitable Products TOP 10 (by Gross Profit)")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProfit ? (
                <Skeleton className="h-64 w-full" />
              ) : topProfit && topProfit.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">{translate("排名", "Rank")}</TableHead>
                      <TableHead>{translate("商品名称", "Product Name")}</TableHead>
                      <TableHead className="text-right">{translate("销售额", "Revenue")}</TableHead>
                      <TableHead className="text-right">{translate("FIFO成本", "FIFO Cost")}</TableHead>
                      <TableHead className="text-right">{translate("毛利润", "Gross Profit")}</TableHead>
                      <TableHead className="text-right">{translate("毛利率", "Gross Margin")}</TableHead>
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
                <p className="text-center text-muted-foreground py-8">{translate("暂无数据", "No Data Available")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TOP10 Customers */}
        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Crown className="h-5 w-5 text-purple-600" /> {translate("消费客户 TOP 10（按消费额）", "Top 10 Customers (by Spending)")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCustomers ? (
                <Skeleton className="h-64 w-full" />
              ) : topCustomers && topCustomers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">{translate("排名", "Rank")}</TableHead>
                      <TableHead>{translate("客户", "Customer Name")}</TableHead>
                      <TableHead>{translate("客户编号", "Customer Code")}</TableHead>
                      <TableHead className="text-right">{translate("订单数", "Orders")}</TableHead>
                      <TableHead className="text-right">{translate("消费额", "Spending")}</TableHead>
                      <TableHead>{translate("最近下单", "Last Order")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCustomers.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant={i < 3 ? "default" : "secondary"}>{i + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.displayName || translate("未知", "Unknown")}</TableCell>
                        <TableCell className="text-muted-foreground">{item.customerCode || "-"}</TableCell>
                        <TableCell className="text-right">{item.orderCount}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">{formatRM(item.totalPaid)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(item.lastOrderDate, lang)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">{translate("暂无数据", "No Data Available")}</p>
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
                <p className="font-medium">{translate("销售与收款报告", "Sales and Collection Report")}</p>
                <p className="text-xs text-muted-foreground">{translate("订单付款明细", "Order Payment Details")}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/reports/product-sales">
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardContent className="pt-6 flex items-center gap-3">
              <ShoppingBag className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium">{translate("商品销售报告", "Product Sales Report")}</p>
                <p className="text-xs text-muted-foreground">{translate("商品销量与利润", "Product Sales and Profit")}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/reports/customer-spending">
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardContent className="pt-6 flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-600" />
              <div>
                <p className="font-medium">{translate("客户消费报告", "Customer Spending Report")}</p>
                <p className="text-xs text-muted-foreground">{translate("客户消费分析", "Customer Spending Analysis")}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/reports/purchase-inventory">
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardContent className="pt-6 flex items-center gap-3">
              <Truck className="h-8 w-8 text-orange-600" />
              <div>
                <p className="font-medium">{translate("进货与库存报告", "Purchase and Inventory Report")}</p>
                <p className="text-xs text-muted-foreground">{translate("采购与库存状态", "Purchase and Inventory Status")}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
