import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock, Package, Truck, TrendingUp,
  ShoppingCart, Warehouse, Calendar, Bell,
  ShoppingBag, CheckCircle, XCircle, Ban,
  MessageSquare, Bot, ArrowRight, AlertTriangle,
  Plane, Eye, Home,
} from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { getFollowUpDisplayState } from "./dashboardFollowUp";

const REMARK_TYPE_LABELS: Record<string, { zh: string; en: string; color: string }> = {
  live: { zh: "直播备注", en: "Live Remark", color: "bg-blue-100 text-blue-700" },
  customer: { zh: "客户备注", en: "Customer Remark", color: "bg-green-100 text-green-700" },
  internal: { zh: "内部备注", en: "Internal Remark", color: "bg-gray-100 text-gray-700" },
};

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { data: stats, isLoading } = trpc.dashboardV11.stats.useQuery();
  const { data: followUpStats } = trpc.orders.followUpStats.useQuery();
  const { data: followUpList } = trpc.orders.followUpList.useQuery({ limit: 50 });
  const followUpDisplay = getFollowUpDisplayState(followUpStats, followUpList);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!stats) return null;

  const alerts: { label: string; count: number; link: string; color: string }[] = [];
  if (stats.alerts.pendingPayment > 0) {
    alerts.push({ label: t("dashboard.pendingPayment"), count: stats.alerts.pendingPayment, link: "/orders?status=receipt_uploaded", color: "bg-orange-500" });
  }
  if (stats.alerts.repotOrders > 0) {
    alerts.push({ label: t("dashboard.repotOrders"), count: stats.alerts.repotOrders, link: "/packing", color: "bg-blue-500" });
  }
  if (stats.alerts.scheduledToday > 0) {
    alerts.push({ label: t("dashboard.scheduledToday"), count: stats.alerts.scheduledToday, link: "/packing?tab=scheduled", color: "bg-purple-500" });
  }
  if (stats.alerts.holdExpiring > 0) {
    alerts.push({ label: t("dashboard.holdOrders"), count: stats.alerts.holdExpiring, link: "/orders?status=hold_order", color: "bg-yellow-500" });
  }

  // V2.3 Row 1: Sales (营业额) — 3 cards in one row for comparison
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
      subtitle: lang === "zh" ? "本月已付款" : "Paid This Month",
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

  // V2.3 Row 2: Orders (待处理) — 4 cards
  const ordersRow = [
    { title: t("dashboard.pendingPayment"), value: stats.row1.pendingPayment, icon: Clock, color: "text-orange-500", link: "/orders?status=receipt_uploaded" },
    { title: t("dashboard.pendingShipment"), value: stats.row1.pendingShipment, icon: Package, color: "text-blue-500", link: "/packing?tab=packing" },
    { title: t("dashboard.todayShipped"), value: stats.row4.todayShipped, icon: Truck, color: "text-green-500", link: "/packing?tab=shipped" },
    { title: t("dashboard.lowStock"), value: stats.row3.lowStock + stats.row3.outOfStock, icon: Warehouse, color: "text-red-500", link: "/products?stock=low" },
  ];

  const recentRemarks = (stats as any).recentRemarks || [];
  const pendingNotifications = (stats as any).pendingNotifications || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <span className="text-sm text-muted-foreground">{new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</span>
      </div>

      {/* Order Alerts Banner */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap p-4 rounded-lg border bg-muted/50">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4 text-primary" />
            <span>{t("dashboard.orderAlerts")}</span>
          </div>
          {alerts.map((alert, i) => (
            <Link key={i} href={alert.link}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm cursor-pointer hover:opacity-90 transition-opacity ${alert.color}`}>
                <span>{alert.label}</span>
                <span className="font-bold">{alert.count}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* V2.3 Row 1: Sales (营业额) — 3 cards in one row */}
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

      {/* V3.0 Row 2: Emergency (紧急事件) — AI Agent + Recent Remarks side by side */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{lang === "zh" ? "紧急事件" : "Emergency"}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* AI Agent Pending Notifications */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Bot className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-base">{lang === "zh" ? "AI Agent 待人工通知" : "AI Agent Pending Notifications"}</CardTitle>
              <Badge variant="secondary" className="ml-auto">{pendingNotifications.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
              {pendingNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{lang === "zh" ? "暂无待人工通知记录" : "No pending notifications"}</p>
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
            </CardContent>
          </Card>

          {/* Recent Remarks */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{lang === "zh" ? "最近备注记录" : "Recent Remarks"}</CardTitle>
              {recentRemarks.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{recentRemarks.length}</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
              {recentRemarks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{lang === "zh" ? "暂无备注记录" : "No recent remarks"}</p>
              ) : (
                recentRemarks.slice(0, 5).map((r: any) => {
                  const typeInfo = REMARK_TYPE_LABELS[r.type] || { label: r.type, color: "bg-gray-100 text-gray-700" };
                  return (
                    <Link key={r.id} href={`/orders/${r.orderId}`}>
                      <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <Badge className={`shrink-0 ${typeInfo.color}`} variant="secondary">
                          {lang === "zh" ? typeInfo.zh : typeInfo.en}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{r.content}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {r.orderNumber || `#${r.orderId}`} {r.facebookName ? `· ${r.facebookName}` : ""}
                            {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Special-status orders are an urgent workflow and remain visible at zero. */}
          <Card className="lg:col-span-2 border-orange-200 bg-orange-50/40 dark:border-orange-900/60 dark:bg-orange-950/10">
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-base">{lang === "zh" ? "特别状态订单待跟进" : "Special-status Order Follow-up"}</CardTitle>
              <Badge variant="secondary" className="ml-auto">{followUpDisplay.itemCount}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="rounded-lg border border-orange-100 bg-background/70 p-3 dark:border-orange-900/50">
                  <p className="text-xs text-muted-foreground">{lang === "zh" ? "等待补运费" : "Pending Shipping"}</p>
                  <p className="mt-1 text-2xl font-bold text-orange-600">{followUpDisplay.pendingShippingCount}</p>
                </div>
                <div className="rounded-lg border border-red-100 bg-background/70 p-3 dark:border-red-900/50">
                  <p className="text-xs text-muted-foreground">{lang === "zh" ? "等待退款" : "Pending Refund"}</p>
                  <p className="mt-1 text-2xl font-bold text-red-600">{followUpDisplay.pendingRefundCount}</p>
                </div>
                <div className="rounded-lg border border-yellow-100 bg-background/70 p-3 dark:border-yellow-900/50">
                  <p className="text-xs text-muted-foreground">{lang === "zh" ? "物流异常" : "Logistics Error"}</p>
                  <p className="mt-1 text-2xl font-bold text-yellow-600">{followUpDisplay.logisticsErrorCount}</p>
                </div>
                <div className="rounded-lg border border-purple-100 bg-background/70 p-3 dark:border-purple-900/50">
                  <p className="text-xs text-muted-foreground">{lang === "zh" ? "自动通知失败" : "Notification Failed"}</p>
                  <p className="mt-1 text-2xl font-bold text-purple-600">{followUpDisplay.notificationFailedCount}</p>
                </div>
                <div className="rounded-lg border border-amber-100 bg-background/70 p-3 dark:border-amber-900/50">
                  <p className="text-xs text-muted-foreground">{lang === "zh" ? "库存异常" : "Stock Exception"}</p>
                  <p className="mt-1 text-2xl font-bold text-amber-600">{followUpDisplay.stockExceptionCount}</p>
                </div>
                <div className={`rounded-lg border bg-background/70 p-3 ${followUpDisplay.overdueCount > 0 ? "border-red-300" : "border-slate-200 dark:border-slate-800"}`}>
                  <p className="text-xs text-muted-foreground">{lang === "zh" ? "超 24 小时未处理" : "Overdue >24h"}</p>
                  <p className="mt-1 text-2xl font-bold text-red-600">{followUpDisplay.overdueCount}</p>
                </div>
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

              <Link href="/orders?status=special">
                <div className="flex cursor-pointer items-center justify-end gap-1 text-sm font-medium text-orange-700 transition-colors hover:text-orange-800 dark:text-orange-400">
                  <span>{lang === "zh" ? "查看全部特别状态订单" : "View all special-status orders"}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* V3.0 Row 3: Work Status (工作状态) — 4 cards */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{lang === "zh" ? "工作状态" : "Work Status"}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {ordersRow.map((card, i) => (
            <Link key={i} href={card.link}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Other Stats Row: Today's orders, Partial shipped, Hold orders, Scheduled today */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link href="/orders?today=1">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.todayOrders")}</CardTitle>
              <ShoppingBag className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">{stats.row4.todayOrders}</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/packing?tab=partial_shipped">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.partialShipped")}</CardTitle>
              <Truck className="h-5 w-5 text-cyan-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-cyan-500">{stats.row1.partialShipped}</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/orders?status=hold_order">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.holdOrders")}</CardTitle>
              <Ban className="h-5 w-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-500">{stats.row2.holdOrders}</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/packing?tab=scheduled">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.scheduledToday")}</CardTitle>
              <Calendar className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-500">{stats.row5.scheduledToday}</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Inventory — bottom */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/products?stock=low">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.lowStock")}</CardTitle>
              <Warehouse className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">{stats.row3.lowStock}</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/products?stock=out">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.outOfStock")}</CardTitle>
              <XCircle className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">{stats.row3.outOfStock}</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
