import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock, Package, Truck, TrendingUp,
  ShoppingCart, Warehouse, Calendar,
  ShoppingBag, CheckCircle, XCircle, Ban,
  Bot, ArrowRight, AlertTriangle,
  Plane, Eye, Home, FileText, MessageCircle, Send,
} from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { getFollowUpDisplayState } from "./dashboardFollowUp";

const REMARK_CATEGORY_LABELS: Record<string, { zh: string; en: string; color: string }> = {
  repotting: { zh: "客户换盆", en: "Customer Repot", color: "bg-green-100 text-green-700" },
  customer_other: { zh: "客户备注", en: "Customer Note", color: "bg-blue-100 text-blue-700" },
  scheduled_shipping: { zh: "预约发货", en: "Scheduled Ship", color: "bg-purple-100 text-purple-700" },
  internal_repotting: { zh: "后台换盆", en: "Internal Repot", color: "bg-amber-100 text-amber-700" },
  select_tree: { zh: "选树身", en: "Select Tree", color: "bg-orange-100 text-orange-700" },
  internal_other: { zh: "后台备注", en: "Internal Note", color: "bg-gray-100 text-gray-700" },
};

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { data: stats, isLoading } = trpc.dashboardV11.stats.useQuery();
  const { data: followUpStats } = trpc.orders.followUpStats.useQuery();
  const { data: followUpList } = trpc.orders.followUpList.useQuery({ limit: 50 });
  const followUpDisplay = getFollowUpDisplayState(followUpStats, followUpList);
  const { data: ordersWithRemarks } = trpc.orderRemarks.ordersWithRemarks.useQuery();


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!stats) return null;

  // V2.3 Row 1: Sales (营业额) — 3 cards
  const salesRow = [
    {
      title: lang === "zh" ? "本地销售额" : "Local Sales",
      subtitle: lang === "zh" ? "本月" : "This Month",
      value: `RM ${Number((stats as any).salesBreakdown?.localSalesMonth || 0).toFixed(2)}`,
      icon: Home,
      color: "text-green-600",
      bg: "border-green-200 bg-green-50 dark:bg-green-950/20",
      link: "/profit-report?nature=normal",
    },
    {
      title: lang === "zh" ? "中国代购销售额" : "Import Pre-order Sales",
      subtitle: lang === "zh" ? "本月销售额" : "Sales This Month",
      value: `RM ${Number((stats as any).salesBreakdown?.importSalesMonth || 0).toFixed(2)}`,
      icon: Plane,
      color: "text-purple-600",
      bg: "border-purple-200 bg-purple-50 dark:bg-purple-950/20",
      link: "/profit-report?nature=import_preorder",
    },
    {
      title: lang === "zh" ? "本月总销售额" : "Total Monthly Sales",
      subtitle: lang === "zh" ? "本地 + 代购" : "Local + Import",
      value: `RM ${Number((stats as any).salesBreakdown?.totalMonthSales || 0).toFixed(2)}`,
      icon: TrendingUp,
      color: "text-primary",
      bg: "border-primary/20 bg-primary/5",
      link: "/profit-report",
    },
  ];

  // V2.1: 9 fixed work status cards — always visible even at 0
  // Removed "订单备注" from work status (kept as independent section below)
  const workCards = [
    { title: lang === "zh" ? "待审核付款" : "Pending Payment Review", value: stats.row1.pendingPayment, icon: Clock, color: "text-orange-500", link: "/orders?status=receipt_uploaded" },
    { title: lang === "zh" ? "待包货" : "Pending Packing", value: stats.row1.pendingShipment, icon: Package, color: "text-blue-500", link: "/packing?tab=packing" },
    { title: lang === "zh" ? "今日已发货" : "Today Shipped", value: stats.row4.todayShipped, icon: Truck, color: "text-green-500", link: "/packing?tab=shipped" },
    { title: lang === "zh" ? "今日订单" : "Today Orders", value: stats.row4.todayOrders, icon: ShoppingBag, color: "text-cyan-500", link: "/orders?today=1" },
    { title: lang === "zh" ? "部分发货" : "Partial Shipped", value: stats.row1.partialShipped, icon: Truck, color: "text-indigo-500", link: "/packing?tab=partial_shipped" },
    { title: lang === "zh" ? "保留订单" : "Hold Orders", value: stats.row2.holdOrders, icon: Ban, color: "text-yellow-500", link: "/orders?status=hold_order" },
    { title: lang === "zh" ? "今日预约发货" : "Today Scheduled", value: stats.row5.scheduledToday, icon: Calendar, color: "text-purple-500", link: "/packing?tab=scheduled" },
    { title: lang === "zh" ? "未读 Messenger" : "Unread Messenger", value: 0, icon: MessageCircle, color: "text-pink-500", link: "/messenger" },
    { title: lang === "zh" ? "库存预警" : "Stock Alert", value: stats.row3.lowStock + stats.row3.outOfStock, icon: Warehouse, color: "text-red-500", link: "/products-v2?stock=low" },
  ];


  const pendingNotifications = (stats as any).pendingNotifications || [];
  const pendingRemarkCount = (ordersWithRemarks as any)?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <span className="text-sm text-muted-foreground">{new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</span>
      </div>

      {/* V2.3 Row 1: Sales (营业额) — 3 cards */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{lang === "zh" ? "营业额（本月）" : "Sales (This Month)"}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {salesRow.map((card, i) => (
            <Link key={i} href={card.link}>
              <Card className={`${card.bg} hover:shadow-md transition-shadow cursor-pointer`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                    <span className="text-xs text-muted-foreground">{card.subtitle}</span>
                  </div>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* V2.0.51: Notification Success Rate */}
      {(stats as any).notificationStats && (stats as any).notificationStats.totalThisMonth > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">{lang === "zh" ? "通知发送统计（本月）" : "Notification Stats (This Month)"}</h2>
          <Card className="border-blue-200 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/10">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium">{lang === "zh" ? "Checkout 通知发送成功率" : "Checkout Notification Success Rate"}</span>
                </div>
                <Badge variant="secondary" className="text-base font-bold">{(stats as any).notificationStats.successRate}%</Badge>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${(stats as any).notificationStats.successRate}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">{lang === "zh" ? "发送成功" : "Sent"}</span>
                  <span className="font-bold text-green-600">{(stats as any).notificationStats.sentThisMonth}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">{lang === "zh" ? "发送失败" : "Failed"}</span>
                  <span className="font-bold text-red-600">{(stats as any).notificationStats.failedThisMonth}</span>
                </div>
                <div className="text-muted-foreground">
                  {lang === "zh" ? "总计" : "Total"}: <span className="font-bold">{(stats as any).notificationStats.totalThisMonth}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* V2.1: 9 Fixed Work Status Cards — always visible */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{lang === "zh" ? "工作状态" : "Work Status"}</h2>
        <div className="grid grid-cols-3 sm:grid-cols-9 gap-4">
          {workCards.map((card, i) => (
            <Link key={i} href={card.link}>
              <Card className="h-[112px] flex flex-col hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-start justify-between pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-medium text-muted-foreground leading-tight line-clamp-2 min-h-[2rem]">{card.title}</CardTitle>
                  <card.icon className={`h-4 w-4 shrink-0 ${card.color}`} />
                </CardHeader>
                <CardContent className="mt-auto px-3 pb-3">
                  <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* V3.0: Special-status Order Follow-up */}
      <Card className="border-orange-200 bg-orange-50/40 dark:border-orange-900/60 dark:bg-orange-950/10">
        <CardHeader className="flex flex-row items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <CardTitle className="text-base">{lang === "zh" ? "特别状态订单待跟进" : "Special-status Order Follow-up"}</CardTitle>
          <Badge variant="secondary" className="ml-auto">{followUpDisplay.itemCount}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Link href="/orders?special=1&type=pending_shipping">
              <div className="rounded-lg border border-orange-100 bg-background/70 p-3 dark:border-orange-900/50 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors cursor-pointer">
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "待补运费" : "Pending Shipping"}</p>
                <p className="mt-1 text-2xl font-bold text-orange-600">{followUpDisplay.pendingShippingCount}</p>
              </div>
            </Link>
            <Link href="/orders?special=1&type=pending_refund">
              <div className="rounded-lg border border-red-100 bg-background/70 p-3 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer">
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "待退款" : "Pending Refund"}</p>
                <p className="mt-1 text-2xl font-bold text-red-600">{followUpDisplay.pendingRefundCount}</p>
              </div>
            </Link>
            <Link href="/orders?special=1&type=logistics_error">
              <div className="rounded-lg border border-yellow-100 bg-background/70 p-3 dark:border-yellow-900/50 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 transition-colors cursor-pointer">
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "物流异常" : "Logistics Error"}</p>
                <p className="mt-1 text-2xl font-bold text-yellow-600">{followUpDisplay.logisticsErrorCount}</p>
              </div>
            </Link>
            <Link href="/orders?special=1&type=incomplete_info">
              <div className="rounded-lg border border-blue-100 bg-background/70 p-3 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors cursor-pointer">
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "客户资料不完整" : "Incomplete Info"}</p>
                <p className="mt-1 text-2xl font-bold text-blue-600">{followUpDisplay.incompleteInfoCount}</p>
              </div>
            </Link>
            <Link href="/orders?special=1&type=notification_failed">
              <div className="rounded-lg border border-purple-100 bg-background/70 p-3 dark:border-purple-900/50 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors cursor-pointer">
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "自动通知失败" : "Notification Failed"}</p>
                <p className="mt-1 text-2xl font-bold text-purple-600">{followUpDisplay.notificationFailedCount}</p>
              </div>
            </Link>
            <Link href="/orders?special=1&type=stock_exception">
              <div className="rounded-lg border border-amber-100 bg-background/70 p-3 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer">
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "库存异常" : "Stock Exception"}</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{followUpDisplay.stockExceptionCount}</p>
              </div>
            </Link>
            <Link href="/orders?special=1&type=overdue">
              <div className={`rounded-lg border bg-background/70 p-3 ${followUpDisplay.overdueCount > 0 ? "border-red-300" : "border-slate-200 dark:border-slate-800"} hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer`}>
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "超 24 小时未处理" : "Overdue >24h"}</p>
                <p className="mt-1 text-2xl font-bold text-red-600">{followUpDisplay.overdueCount}</p>
              </div>
            </Link>
          </div>

          <div className="border-t border-orange-100 pt-3 dark:border-orange-900/60">
            {(!followUpList || (followUpList as any).length === 0) ? (
              <p className="py-3 text-center text-sm text-muted-foreground">{lang === "zh" ? "暂无待跟进特别订单；相关统计会在此持续显示。" : "No pending special-status orders. The monitoring framework remains visible here."}</p>
            ) : (
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {(followUpList as any).map((item: any) => (
                  <Link key={item.orderId} href={`/orders/${item.orderId}`}>
                    <div className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${item.isOverdue ? "border-red-300 bg-red-50 dark:bg-red-950/20" : "border-transparent"}`}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.orderNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.customerName}{item.lastRemark ? ` · ${item.lastRemark}` : ""}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge className={item.specialTypeColor === "orange" ? "bg-orange-100 text-orange-700" : item.specialTypeColor === "red" ? "bg-red-100 text-red-700" : item.specialTypeColor === "yellow" ? "bg-yellow-100 text-yellow-700" : item.specialTypeColor === "blue" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"} variant="secondary">
                          {item.specialTypeLabel}
                        </Badge>
                        <span className={`text-xs ${item.isOverdue ? "font-bold text-red-600" : "text-muted-foreground"}`}>
                          {item.isOverdue ? (lang === "zh" ? `超时 ${item.waitHours}h` : `Overdue ${item.waitHours}h`) : `${item.waitHours}h`}
                        </span>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link href="/orders?special=1&type=all">
            <div className="flex cursor-pointer items-center justify-end gap-1 text-sm font-medium text-orange-700 transition-colors hover:text-orange-800 dark:text-orange-400">
              <span>{lang === "zh" ? "查看全部特别状态订单" : "View all special-status orders"}</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* V2.1: Order Remarks Section — pending remarks list */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <FileText className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">{lang === "zh" ? "订单备注" : "Order Remarks"}</CardTitle>
          <Badge variant="secondary" className="ml-auto">{pendingRemarkCount}</Badge>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
          {pendingRemarkCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{lang === "zh" ? "暂无备注订单" : "No orders with remarks"}</p>
          ) : (
            (ordersWithRemarks as any).slice(0, 10).map((r: any) => {
              const catInfo = REMARK_CATEGORY_LABELS[r.remarkCategory] || null;
              return (
                <Link key={r.remarkId} href={`/orders/${r.orderId}`}>
                  <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    {catInfo && (
                      <Badge className={`shrink-0 ${catInfo.color}`} variant="secondary">
                        {lang === "zh" ? catInfo.zh : catInfo.en}
                      </Badge>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{r.content}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.orderNumber || `#${r.orderId}`} {r.facebookName ? `· ${r.facebookName}` : ""}
                        {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* AI Agent Pending Notifications & Handover */}
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Bot className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-base">{lang === "zh" ? "AI 转人工通知" : "AI Handover Notifications"}</CardTitle>
            <Badge variant="secondary" className="ml-auto">{pendingNotifications.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
            {pendingNotifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{lang === "zh" ? "暂无转人工通知" : "No handover notifications"}</p>
            ) : (
              pendingNotifications.slice(0, 5).map((n: any) => (
                <Link key={n.id} href={n.orderId ? `/orders/${n.orderId}` : "/orders"}>
                  <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        <Badge variant="outline" className="mr-2">{n.type}</Badge>
                        {n.message || "(无消息内容)"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {n.orderNumber || `#${n.orderId || ""}`}
                        {n.createdAt ? ` · ${new Date(n.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </Link>
              ))
            )}
            <Link href="/ai-handover" className="block">
              <Button variant="outline" size="sm" className="w-full mt-2">
                查看全部转人工通知 <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* AI Tasks Module — Business AI Integration */}
        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              {lang === "zh" ? "AI 任务队列" : "AI Tasks Queue"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Link href="/draft-orders?status=waiting_approval" className="block">
                <div className="rounded-lg border border-purple-200 bg-white p-3 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{lang === "zh" ? "草稿订单待审批" : "Draft Orders"}</span>
                    <ShoppingCart className="h-4 w-4 text-purple-500" />
                  </div>
                  <p className="text-2xl font-bold text-purple-700 mt-1">
                    <DraftOrderCount />
                  </p>
                </div>
              </Link>
              <Link href="/order-change-requests?status=waiting_approval" className="block">
                <div className="rounded-lg border border-purple-200 bg-white p-3 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{lang === "zh" ? "变更请求待审批" : "Change Requests"}</span>
                    <FileText className="h-4 w-4 text-purple-500" />
                  </div>
                  <p className="text-2xl font-bold text-purple-700 mt-1">
                    <ChangeRequestCount />
                  </p>
                </div>
              </Link>
            </div>
            <Link href="/ai-brain?tab=analytics" className="block">
              <Button variant="outline" size="sm" className="w-full">
                {lang === "zh" ? "AI 分析中心" : "AI Analysis"} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function DraftOrderCount() {
  const { data } = trpc.draftOrders.list.useQuery({ status: "waiting_approval", limit: 1, offset: 0 });
  return <span>{data?.length || 0}</span>;
}

function ChangeRequestCount() {
  const { data } = trpc.orderChangeRequests.list.useQuery({ status: "waiting_approval", limit: 1, offset: 0 });
  return <span>{data?.length || 0}</span>;
}
