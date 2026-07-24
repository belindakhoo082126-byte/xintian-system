import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock, Package, Truck, DollarSign, TrendingUp,
  ShoppingCart, Warehouse, Calendar, Bell,
  ShoppingBag, CheckCircle, XCircle, Ban,
  MessageSquare, Bot, ArrowRight, AlertTriangle,
  Plane, Eye, Timer, Home,
} from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";

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

      {/* V2.3 Row 2: Orders (待处理) — 4 cards */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{lang === "zh" ? "待处理" : "Pending Tasks"}</h2>
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

      {/* Special Orders Alert */}
      {(stats as any).specialOrdersCount > 0 && (
        <Link href="/orders?status=special">
          <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div className="flex-1">
                <span className="text-sm font-medium">{t("dashboard.specialOrders") || t("dashboard.specialOrdersFallback")}</span>
                <span className="text-xs text-muted-foreground ml-2">{lang === "zh" ? "等待处理" : "Pending action"}</span>
              </div>
              <span className="text-2xl font-bold text-yellow-600">{(stats as any).specialOrdersCount}</span>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* V2.2: Special Order Follow-up Stats — always show */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{lang === "zh" ? "等待补运费" : "Pending Shipping"}</CardTitle>
            <DollarSign className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{(followUpStats as any)?.pendingShippingCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{lang === "zh" ? "等待退款" : "Pending Refund"}</CardTitle>
            <DollarSign className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{(followUpStats as any)?.pendingRefundCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{lang === "zh" ? "物流异常" : "Logistics Error"}</CardTitle>
            <Truck className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{(followUpStats as any)?.logisticsErrorCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card className={`${(followUpStats as any)?.overdueCount > 0 ? 'border-red-400 bg-red-100 dark:bg-red-950/30' : 'border-gray-200 bg-gray-50 dark:bg-gray-950/20'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{lang === "zh" ? "超24小时未处理" : "Overdue >24h"}</CardTitle>
            <Timer className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{(followUpStats as any)?.overdueCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* V2.2: Special Order Follow-up List — always show frame */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <CardTitle className="text-base">{lang === "zh" ? "特别订单待跟进" : "Special Order Follow-up"}</CardTitle>
          {(followUpList as any)?.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{(followUpList as any).length}</Badge>
          )}
        </CardHeader>
        <CardContent>
          {(!followUpList || (followUpList as any).length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-4">{lang === "zh" ? "暂无待跟进特别订单" : "No pending special orders"}</p>
          ) : (
            <div className="space-y-2">
              {(followUpList as any).map((item: any) => (
                <Link key={item.orderId} href={`/orders/${item.orderId}`}>
                  <div className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${item.isOverdue ? 'border border-red-300 bg-red-50 dark:bg-red-950/20' : 'border border-transparent'}`}>
                    <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                      <div>
                        <p className="text-sm font-medium truncate">{item.orderNumber}</p>
                        {item.subOrders?.length > 0 && (
                          <p className="text-xs text-muted-foreground">{item.subOrders.map((s: any) => s.subOrderNumber).join(', ')}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm truncate">{item.customerName}</p>
                        <p className="text-xs text-muted-foreground">{item.customerPhone || (lang === "zh" ? "无电话" : "No phone")}</p>
                      </div>
                      <div>
                        <Badge className={`shrink-0 ${
                          item.specialTypeColor === 'orange' ? 'bg-orange-100 text-orange-700' :
                          item.specialTypeColor === 'red' ? 'bg-red-100 text-red-700' :
                          item.specialTypeColor === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                          item.specialTypeColor === 'blue' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`} variant="secondary">
                          {item.specialTypeLabel}
                        </Badge>
                        {Number(item.amount) > 0 && (
                          <span className="text-xs ml-1 font-medium">RM {item.amount}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${item.isOverdue ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                          {item.isOverdue ? (lang === "zh" ? `超时 ${item.waitHours}h` : `Overdue ${item.waitHours}h`) : `${item.waitHours}h`}
                        </span>
                        {item.lastRemark && (
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline">· {item.lastRemark}</span>
                        )}
                        <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Recent Remarks (备注记录) — always show frame */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">{lang === "zh" ? "最近备注记录" : "Recent Remarks"}</CardTitle>
          {recentRemarks.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{recentRemarks.length}</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {recentRemarks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{lang === "zh" ? "暂无备注记录" : "No recent remarks"}</p>
          ) : (
            recentRemarks.map((r: any) => {
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
                        {r.createdBy ? ` · ${r.createdBy}` : ""}
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

      {/* AI Agent Pending Notifications (待人工通知) — always show frame */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Bot className="h-5 w-5 text-orange-500" />
          <CardTitle className="text-base">{lang === "zh" ? "AI Agent 待人工通知" : "AI Agent Pending Notifications"}</CardTitle>
          <Badge variant="secondary" className="ml-auto">{pendingNotifications.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{lang === "zh" ? "暂无待人工通知记录" : "No pending notifications"}</p>
          ) : (
            pendingNotifications.map((n: any) => (
              <Link key={n.id} href={n.orderId ? `/orders/${n.orderId}` : "/orders"}>
                <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      <Badge variant="outline" className="mr-2">{n.type}</Badge>
                      {n.message || "(无消息内容)"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {n.orderNumber || `#${n.orderId || ""}`} {n.facebookName ? `· ${n.facebookName}` : ""}
                      {n.createdAt ? ` · ${new Date(n.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
                      {n.errorMessage ? ` · 错误: ${n.errorMessage}` : ""}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

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
