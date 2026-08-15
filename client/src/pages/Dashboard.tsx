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
  Crown,
  type LucideIcon,
} from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { getFollowUpDisplayState } from "./dashboardFollowUp";
import { AdminPageHeader } from "@/components/AdminPageHeader";

const REMARK_CATEGORY_LABELS: Record<string, { zh: string; en: string; color: string }> = {
  repotting: { zh: "换盆", en: "Repot", color: "bg-green-100 text-green-700" },
  desired_delivery_date: { zh: "发货日期", en: "Ship Date", color: "bg-yellow-100 text-yellow-700" },
  select_tree: { zh: "选树身", en: "Select Tree", color: "bg-blue-100 text-blue-700" },
  other: { zh: "其他", en: "Other", color: "bg-gray-100 text-gray-700" },
};

const ORDER_STATUS_LABELS: Record<string, { zh: string; en: string; color: string }> = {
  pending: { zh: "待汇款", en: "Pending Payment", color: "bg-amber-100 text-amber-800" },
  receipt_uploaded: { zh: "待审核付款凭证", en: "Payment Review", color: "bg-orange-100 text-orange-800" },
  partial_payment: { zh: "部分汇款", en: "Partial Payment", color: "bg-yellow-100 text-yellow-800" },
  paid: { zh: "已汇款", en: "Paid", color: "bg-emerald-100 text-emerald-800" },
  hold_order: { zh: "保留订单", en: "Hold Order", color: "bg-stone-100 text-stone-800" },
  waiting_stock: { zh: "待备货", en: "Waiting Stock", color: "bg-sky-100 text-sky-800" },
  packing: { zh: "待包货", en: "Pending Packing", color: "bg-blue-100 text-blue-800" },
  ready_to_ship: { zh: "待发货", en: "Ready to Ship", color: "bg-indigo-100 text-indigo-800" },
  scheduled_ship: { zh: "预约发货", en: "Scheduled Shipping", color: "bg-violet-100 text-violet-800" },
  partial_shipped: { zh: "部分发货", en: "Partially Shipped", color: "bg-purple-100 text-purple-800" },
  shipped: { zh: "已发货", en: "Shipped", color: "bg-green-100 text-green-800" },
  completed: { zh: "已完成", en: "Completed", color: "bg-teal-100 text-teal-800" },
  cancelled: { zh: "已取消", en: "Cancelled", color: "bg-red-100 text-red-800" },
};

export const SPECIAL_STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  pending_shipping: { zh: "待补运费", en: "Pending Shipping Fee" },
  pending_refund: { zh: "待退款", en: "Pending Refund" },
  company_bear: { zh: "公司承担", en: "Company Covered" },
  logistics_error: { zh: "物流异常", en: "Logistics Error" },
  incomplete_info: { zh: "资料异常", en: "Incomplete Information" },
  stock_exception: { zh: "库存异常", en: "Stock Exception" },
  partial_payment: { zh: "部分汇款", en: "Partial Payment" },
  over_payment: { zh: "多汇款", en: "Over Payment" },
  amount_changed: { zh: "金额异常", en: "Amount Changed" },
  other: { zh: "其他", en: "Other" },
};

type WorkStatusCard = {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  link: string;
  detail?: string;
  priorityLabel?: string;
  isOverdue?: boolean;
  overdueCount?: number;
};

function formatHandoverWait(minutes: number, lang: "zh" | "en") {
  if (minutes < 60) return lang === "zh" ? `${minutes} 分钟` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === "zh" ? `${hours} 小时` : `${hours} hr`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return lang === "zh"
    ? `${days} 天${remainingHours ? ` ${remainingHours} 小时` : ""}`
    : `${days}d${remainingHours ? ` ${remainingHours}h` : ""}`;
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { data: stats, isLoading } = trpc.dashboardV11.stats.useQuery();
  const { data: followUpStats } = trpc.orders.followUpStats.useQuery();
  const { data: followUpList } = trpc.orders.followUpList.useQuery({ limit: 50 });
  const followUpDisplay = getFollowUpDisplayState(followUpStats, followUpList);
  // 退款管理已经在“工作状态”提供独立待处理入口，Dashboard 的特别状态区块
  // 不再重复展示待退款；订单查询中的 pending_refund 特别原因与退款记录仍完整保留。
  const specialFollowUpItems = ((followUpList as any[] | undefined) || []).filter(
    (item) => item.specialType !== "pending_refund",
  );
  const specialFollowUpItemCount = specialFollowUpItems.length;
  const { data: ordersWithRemarks } = trpc.orderRemarks.ordersWithRemarks.useQuery();
  const { data: handoverStats } = trpc.aiHandover.getStats.useQuery();
  const { data: aiNotificationCenter } = trpc.notifications.aiCenter.useQuery();
  const { data: pendingRefundRows } = trpc.refunds.list.useQuery({ status: "pending" });
  const aiNotificationFailureCount = Array.isArray((aiNotificationCenter as any)?.failures)
    ? (aiNotificationCenter as any).failures.length
    : 0;

  // Group remarks by orderId so each order shows as one card with multiple tags
  const groupedRemarks = (() => {
    const rows = (ordersWithRemarks as any) || [];
    const map = new Map<number, { orderId: number; orderNumber: string; facebookName: string; physicalStatus: string; createdAt: number; categories: string[] }>();
    for (const r of rows) {
      const existing = map.get(r.orderId);
      if (existing) {
        if (!existing.categories.includes(r.remarkCategory)) {
          existing.categories.push(r.remarkCategory);
        }
        // Keep the latest createdAt
        if (r.createdAt && new Date(r.createdAt).getTime() > existing.createdAt) {
          existing.createdAt = new Date(r.createdAt).getTime();
        }
      } else {
        map.set(r.orderId, {
          orderId: r.orderId,
          orderNumber: r.orderNumber || `#${r.orderId}`,
          facebookName: r.facebookName || "",
          physicalStatus: r.physicalStatus || "",
          createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
          categories: [r.remarkCategory],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  })();
  const pendingRemarkCount = groupedRemarks.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!stats) return null;

  // Dashboard Row 1: confirmed cash receipts, not order totals.
  const cashReceiptBreakdown = (stats as any).cashReceiptBreakdown || {};
  const crossChannelMerge = (stats as any).crossChannelMerge || { count: 0, addedAmount: "0.00" };
  const salesRow = [
    {
      title: lang === "zh" ? "本地已收款" : "Local Receipts",
      subtitle: lang === "zh" ? "本月实际确认付款" : "Confirmed This Month",
      value: `RM ${Number(cashReceiptBreakdown.localReceivedMonth || 0).toFixed(2)}`,
      icon: Home,
      color: "text-green-600",
      bg: "border-green-200 bg-green-50 dark:bg-green-950/20",
      link: "/profit-report?nature=normal",
    },
    {
      title: lang === "zh" ? "中国代购已收款" : "Import Pre-order Receipts",
      subtitle: lang === "zh" ? "本月实际确认付款" : "Confirmed This Month",
      value: `RM ${Number(cashReceiptBreakdown.importReceivedMonth || 0).toFixed(2)}`,
      icon: Plane,
      color: "text-purple-600",
      bg: "border-purple-200 bg-purple-50 dark:bg-purple-950/20",
      link: "/profit-report?nature=import_preorder",
    },
    {
      title: lang === "zh" ? "本月总已收款" : "Total Monthly Receipts",
      subtitle: lang === "zh" ? "本地 + 代购，按付款日期" : "Local + Import, by payment date",
      value: `RM ${Number(cashReceiptBreakdown.totalReceivedMonth || 0).toFixed(2)}`,
      icon: TrendingUp,
      color: "text-primary",
      bg: "border-primary/20 bg-primary/5",
      link: "/profit-report",
    },
    {
      title: lang === "zh" ? "本月净实收" : "Net Monthly Receipts",
      subtitle: lang === "zh" ? "已确认收款 − 已完成退款" : "Approved receipts less completed refunds",
      value: `RM ${Number(cashReceiptBreakdown.totalNetReceivedMonth || 0).toFixed(2)}`,
      icon: TrendingUp,
      color: "text-teal-600",
      bg: "border-teal-200 bg-teal-50 dark:bg-teal-950/20",
      link: "/payment-record",
    },
  ];

  // V2.1: 9 fixed work status cards — always visible even at 0
  // Removed "订单备注" from work status (kept as independent section below)
  const handoverPendingCount = Number((handoverStats as any)?.pendingCount || 0);
  const handoverOldestWaitMinutes = Number((handoverStats as any)?.oldestWaitMinutes || 0);
  const handoverOver24HoursCount = Number((handoverStats as any)?.over24HoursCount || 0);
  const handoverHighestPriority = (handoverStats as any)?.highestPriority as "low" | "medium" | "high" | null | undefined;
  const handoverPriorityLabel = handoverHighestPriority
    ? (lang === "zh"
      ? ({ low: "低", medium: "中", high: "高" } as const)[handoverHighestPriority]
      : ({ low: "Low", medium: "Medium", high: "High" } as const)[handoverHighestPriority])
    : undefined;
  const pendingRefundCount = (pendingRefundRows as any[] | undefined)?.length || 0;
  const pendingRefundAmount = ((pendingRefundRows as any[] | undefined) || []).reduce((sum, row) => sum + Number(row.refund?.requestedAmount || 0), 0);

  // V2.1: fixed work status cards — always visible even at 0
  const workCards: WorkStatusCard[] = [
    { title: lang === "zh" ? "待审核付款" : "Pending Payment Review", value: stats.row1.pendingPayment, icon: Clock, color: "text-orange-500", link: "/orders?status=receipt_uploaded" },
    { title: lang === "zh" ? "待包货" : "Pending Packing", value: stats.row1.pendingShipment, icon: Package, color: "text-blue-500", link: "/packing?tab=packing" },
    { title: lang === "zh" ? "今日已发货" : "Today Shipped", value: stats.row4.todayShipped, icon: Truck, color: "text-green-500", link: "/packing?tab=shipped" },
    { title: lang === "zh" ? "今日订单" : "Today Orders", value: stats.row4.todayOrders, icon: ShoppingBag, color: "text-cyan-500", link: "/orders?today=1" },
    { title: lang === "zh" ? "部分发货" : "Partial Shipped", value: stats.row1.partialShipped, icon: Truck, color: "text-indigo-500", link: "/packing?tab=partial_shipped" },
    { title: lang === "zh" ? "保留订单" : "Hold Orders", value: stats.row2.holdOrders, icon: Ban, color: "text-yellow-500", link: "/orders?status=hold_order" },
    { title: lang === "zh" ? "今日预约发货" : "Today Scheduled", value: stats.row5.scheduledToday, icon: Calendar, color: "text-purple-500", link: "/packing?tab=scheduled&date=today" },
    { title: lang === "zh" ? "未读 Messenger" : "Unread Messenger", value: 0, icon: MessageCircle, color: "text-pink-500", link: "/messenger" },
    { title: lang === "zh" ? "库存预警" : "Stock Alert", value: stats.row3.lowStock + stats.row3.outOfStock, icon: Warehouse, color: "text-red-500", link: "/products?stock=low" },
    { title: lang === "zh" ? "待处理退款" : "Pending Refunds", value: pendingRefundCount, icon: AlertTriangle, color: "text-amber-600", link: "/admin/refunds", detail: pendingRefundCount > 0 ? `RM ${pendingRefundAmount.toFixed(2)}` : undefined },
    // V2.1.25: Membership manual follow-up (待人工发送)
    { title: lang === "zh" ? "会员待人工发送" : "Membership Manual Follow Up", value: (stats as any).membershipManualFollowUp || 0, icon: Crown, color: "text-amber-500", link: "/membership" },
    {
      title: lang === "zh" ? "AI 转人工待处理" : "AI Handover Pending",
      value: handoverPendingCount,
      icon: Bot,
      color: handoverOver24HoursCount > 0 ? "text-red-600" : "text-violet-600",
      link: "/ai-handover",
      detail: handoverPendingCount > 0
        ? (lang === "zh"
          ? `最久等待：${formatHandoverWait(handoverOldestWaitMinutes, lang)}`
          : `Oldest: ${formatHandoverWait(handoverOldestWaitMinutes, lang)}`)
        : undefined,
      priorityLabel: handoverPriorityLabel
        ? (lang === "zh" ? `最高优先级：${handoverPriorityLabel}` : `Top priority: ${handoverPriorityLabel}`)
        : undefined,
      isOverdue: handoverOver24HoursCount > 0,
      overdueCount: handoverOver24HoursCount,
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={lang === "zh" ? "仪表板" : "Dashboard"}
        description={new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
      />

      {/* V2.3 Row 1: confirmed receipts and net receipts — 4 cards */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{lang === "zh" ? "营业额（本月）" : "Sales (This Month)"}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{lang === "zh" ? "跨渠道合单（今日）" : "Cross-channel Merges (Today)"}</h2>
        <Card className="border-cyan-200 bg-cyan-50/60 dark:border-cyan-900/60 dark:bg-cyan-950/20">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-cyan-100 p-3 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-200">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">{lang === "zh" ? "今日跨渠道合单" : "Today's Cross-channel Merges"}</p>
                <p className="text-sm text-muted-foreground">
                  {lang === "zh"
                    ? "商城、直播、私聊、AI、帖子及后台追加至未汇款 XT 订单"
                    : "Additions from mall, live, chat, AI, posts, and admin to unpaid XT orders"}
                </p>
              </div>
            </div>
            <div className="flex gap-6 sm:gap-8">
              <div>
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "合单次数" : "Merge Actions"}</p>
                <p className="mt-1 text-2xl font-bold text-cyan-700 dark:text-cyan-300">{Number(crossChannelMerge.count || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "新增商品金额" : "Added Item Amount"}</p>
                <p className="mt-1 text-2xl font-bold text-cyan-700 dark:text-cyan-300">RM {Number(crossChannelMerge.addedAmount || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
              <Card className={`min-h-[112px] flex flex-col hover:shadow-md transition-shadow cursor-pointer ${card.isOverdue ? "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20" : ""}`}>
                <CardHeader className="flex flex-row items-start justify-between pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-medium text-muted-foreground leading-tight line-clamp-2 min-h-[2rem]">{card.title}</CardTitle>
                  <card.icon className={`h-4 w-4 shrink-0 ${card.color}`} />
                </CardHeader>
                <CardContent className="mt-auto px-3 pb-3">
                  <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                  {card.detail && (
                    <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{card.detail}</p>
                  )}
                  {card.priorityLabel && (
                    <p className={`mt-0.5 flex items-center gap-1 text-[10px] leading-tight ${card.isOverdue ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                      {card.isOverdue && <AlertTriangle className="h-3 w-3 shrink-0" />}
                      <span>{card.isOverdue && card.overdueCount ? `${lang === "zh" ? "超 24 小时" : "Over 24h"} × ${card.overdueCount} · ` : ""}{card.priorityLabel}</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Link href="/auto-notifications">
        <Card className="border-violet-200 bg-violet-50/50 transition-colors hover:bg-violet-100/60 dark:border-violet-900/60 dark:bg-violet-950/20 dark:hover:bg-violet-950/35">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-violet-100 p-3 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200"><Send className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{lang === "zh" ? "AI 自动通知失败" : "AI Notification Failures"}</p>
              <p className="text-sm text-muted-foreground">{lang === "zh" ? "独立于特别订单；点击查看失败内容、模板变量与人工处理记录。" : "Separate from special orders. Review failures, variables, and manual actions."}</p>
            </div>
            <span className="text-3xl font-bold text-violet-700 dark:text-violet-300">{aiNotificationFailureCount}</span>
            <ArrowRight className="h-5 w-5 text-violet-500" />
          </CardContent>
        </Card>
      </Link>

      {/* V3.0: Special-status Order Follow-up */}
      <Card className="border-orange-200 bg-orange-50/40 dark:border-orange-900/60 dark:bg-orange-950/10">
        <CardHeader className="flex flex-row items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <CardTitle className="text-base">{lang === "zh" ? "特别状态订单待跟进" : "Special-status Order Follow-up"}</CardTitle>
          <Badge variant="secondary" className="ml-auto">{specialFollowUpItemCount}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Link href="/orders?special=1&type=pending_shipping">
              <div className="rounded-lg border border-orange-100 bg-background/70 p-3 dark:border-orange-900/50 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors cursor-pointer">
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "待补运费" : "Pending Shipping"}</p>
                <p className="mt-1 text-2xl font-bold text-orange-600">{followUpDisplay.pendingShippingCount}</p>
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
            <Link href="/orders?special=1&type=partial_payment">
              <div className="rounded-lg border border-orange-100 bg-background/70 p-3 dark:border-orange-900/50 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors cursor-pointer">
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "部分汇款" : "Partial Payment"}</p>
                <p className="mt-1 text-2xl font-bold text-orange-600">{followUpDisplay.partialPaymentCount}</p>
              </div>
            </Link>
            <Link href="/orders?special=1&type=over_payment">
              <div className="rounded-lg border border-red-100 bg-background/70 p-3 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer">
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "多汇款" : "Over Payment"}</p>
                <p className="mt-1 text-2xl font-bold text-red-600">{followUpDisplay.overPaymentCount}</p>
              </div>
            </Link>
            <Link href="/orders?special=1&type=amount_changed">
              <div className="rounded-lg border border-red-100 bg-background/70 p-3 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer">
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "金额异常" : "Amount Changed"}</p>
                <p className="mt-1 text-2xl font-bold text-red-600">{followUpDisplay.amountChangedCount}</p>
              </div>
            </Link>
            <Link href="/orders?special=1&type=stock_exception">
              <div className="rounded-lg border border-amber-100 bg-background/70 p-3 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer">
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "库存异常" : "Stock Exception"}</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{followUpDisplay.stockExceptionCount}</p>
              </div>
            </Link>
            <Link href="/orders?special=1&type=other">
              <div className="rounded-lg border border-gray-100 bg-background/70 p-3 dark:border-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-950/20 transition-colors cursor-pointer">
                <p className="text-xs text-muted-foreground">{lang === "zh" ? "其他" : "Other"}</p>
                <p className="mt-1 text-2xl font-bold text-gray-600">{followUpDisplay.otherCount}</p>
              </div>
            </Link>
          </div>

          <p className="rounded-md border border-orange-100 bg-background/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground dark:border-orange-900/50">
            {lang === "zh"
              ? "“其他”仅用于已被人工明确标记为其他、且不属于待补运费、退款、物流、资料、库存、汇款或金额异常等已定义分类的订单。待退款请在上方“工作状态”的退款管理卡处理，避免重复计算。"
              : '“Other” only includes orders explicitly marked as other and not covered by a defined shipping, refund, logistics, customer-info, stock, payment, or amount exception. Handle pending refunds from the Refund Management work-status card to avoid duplicate counting.'}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
              <p className="font-semibold">{lang === "zh" ? "库存警告" : "Low-stock warning"}</p>
              <p>{lang === "zh" ? "商品的可售库存低于所设阈值，提醒安排补货；库存记录本身仍一致。" : "Sellable stock is below its configured threshold and needs replenishment; the inventory record itself remains consistent."}</p>
            </div>
            <div className="rounded-md border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs leading-relaxed text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-100">
              <p className="font-semibold">{lang === "zh" ? "库存异常" : "Stock exception"}</p>
              <p>{lang === "zh" ? "库存资料出现需要人工核对的不一致，例如负库存或异常流水；请打开相关订单或库存审计记录处理。" : "Inventory data needs manual review because of an inconsistency, such as negative stock or an irregular ledger entry. Open the related order or inventory audit record to resolve it."}</p>
            </div>
          </div>

          <div className="border-t border-orange-100 pt-3 dark:border-orange-900/60">
            {specialFollowUpItems.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">{lang === "zh" ? "暂无待跟进特别订单；相关统计会在此持续显示。" : "No pending special-status orders. The monitoring framework remains visible here."}</p>
            ) : (
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {specialFollowUpItems.map((item: any) => (
                  <Link key={item.orderId} href={`/orders/${item.orderId}`}>
                    <div className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${item.isOverdue ? "border-red-300 bg-red-50 dark:bg-red-950/20" : "border-transparent"}`}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.orderNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.customerName}{item.lastRemark ? ` · ${item.lastRemark}` : ""}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge className={item.specialTypeColor === "orange" ? "bg-orange-100 text-orange-700" : item.specialTypeColor === "red" ? "bg-red-100 text-red-700" : item.specialTypeColor === "yellow" ? "bg-yellow-100 text-yellow-700" : item.specialTypeColor === "blue" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"} variant="secondary">
                          {SPECIAL_STATUS_LABELS[item.specialType]?.[lang] ?? item.specialTypeLabel}
                        </Badge>
                        {item.orderCategory === 'import' && (
                          <Badge className="bg-purple-100 text-purple-700" variant="secondary">{lang === "zh" ? "中国代购" : "Import Pre-order"}</Badge>
                        )}
                        {item.orderCategory !== 'import' && (
                          <Badge className="bg-green-100 text-green-700" variant="secondary">{lang === "zh" ? "本地" : "Local"}</Badge>
                        )}
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
            groupedRemarks.slice(0, 10).map((r) => {
              return (
                <Link key={r.orderId} href={`/orders/${r.orderId}`}>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{r.orderNumber}</span>
                        {r.facebookName && <span className="text-xs text-muted-foreground">· {r.facebookName}</span>}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(r.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {r.physicalStatus && (() => {
                          const statusInfo = ORDER_STATUS_LABELS[r.physicalStatus];
                          return (
                            <Badge className={`shrink-0 ${statusInfo?.color || "bg-slate-100 text-slate-700"}`} variant="secondary">
                              {lang === "zh" ? (statusInfo?.zh || r.physicalStatus) : (statusInfo?.en || r.physicalStatus)}
                            </Badge>
                          );
                        })()}
                        {r.categories.map((cat) => {
                          const catInfo = REMARK_CATEGORY_LABELS[cat];
                          if (!catInfo) return null;
                          return (
                            <Badge key={cat} className={`shrink-0 ${catInfo.color}`} variant="secondary">
                              {lang === "zh" ? catInfo.zh : catInfo.en}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* AI Tasks Module — Business AI Integration */}
      <div className="grid grid-cols-1 gap-4">
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
