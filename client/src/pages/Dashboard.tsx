import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, DollarSign, ShoppingBag, Radio, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const sourceLabels: Record<string, string> = {
  facebook_live: "FB直播",
  facebook_post: "FB贴文",
  facebook_reel: "FB Reel",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  store_checkout: "商城",
  admin: "后台",
  customer_service: "客服",
};

const sourceColors: Record<string, string> = {
  facebook_live: "bg-red-100 text-red-700",
  facebook_post: "bg-blue-100 text-blue-700",
  facebook_reel: "bg-purple-100 text-purple-700",
  messenger: "bg-sky-100 text-sky-700",
  whatsapp: "bg-green-100 text-green-700",
  store_checkout: "bg-orange-100 text-orange-700",
  admin: "bg-gray-100 text-gray-700",
  customer_service: "bg-amber-100 text-amber-700",
};

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.workCenter.stats.useQuery();
  const { data: recentActions } = trpc.workCenter.recentActions.useQuery();
  const completeMutation = trpc.workCenter.completeAction.useMutation();

  const [completingId, setCompletingId] = useState<number | null>(null);

  const handleComplete = (id: number) => {
    setCompletingId(id);
    completeMutation.mutate({ id }, {
      onSuccess: () => {
        setCompletingId(null);
        // Invalidate queries to refresh
        window.location.reload();
      },
      onError: () => setCompletingId(null),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  const cards = [
    {
      title: "需要处理",
      value: stats?.pendingActionCount ?? 0,
      icon: AlertCircle,
      color: "text-red-500",
      bgColor: "bg-red-50",
      link: "/orders",
    },
    {
      title: "待付款",
      value: stats?.pendingPaymentCount ?? 0,
      subtitle: stats?.pendingPaymentCount ? `RM ${Number(stats.pendingPaymentAmount).toFixed(2)}` : "",
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-50",
      link: "/orders",
    },
    {
      title: "已付款",
      value: stats?.paidCount ?? 0,
      subtitle: stats?.paidCount ? `RM ${Number(stats.paidAmount).toFixed(2)}` : "",
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
      link: "/orders",
    },
    {
      title: "今日订单",
      value: stats?.todayCustomerCount ?? 0,
      subtitle: stats?.todayCustomerCount ? `${stats.todayItemCount} 件 · RM ${Number(stats.todayTotalAmount).toFixed(2)}` : "",
      icon: ShoppingBag,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
      link: "/orders",
    },
    {
      title: "今日直播",
      value: stats?.todayLiveCount ?? 0,
      icon: Radio,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
      link: "/facebook-live",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">工作中心</h1>
        <p className="text-sm text-muted-foreground mt-1">Dashboard 是工作入口，不只是报表</p>
      </div>

      {/* 5 Big Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {cards.map((card, i) => (
          <Link key={i} href={card.link}>
            <Card className={`hover:shadow-md transition-shadow cursor-pointer ${card.bgColor} border-0`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{card.value}</div>
                {card.subtitle && (
                  <div className="text-xs text-muted-foreground mt-1">{card.subtitle}</div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Action Items Preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            需要处理 ({stats?.pendingActionCount ?? 0})
          </CardTitle>
          <Link href="/orders">
            <Button variant="ghost" size="sm" className="gap-1">
              查看全部 <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentActions && recentActions.length > 0 ? (
            <div className="space-y-3">
              {recentActions.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge className={`shrink-0 ${sourceColors[item.source] || sourceColors.admin}`} variant="secondary">
                      {sourceLabels[item.source] || item.source}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{item.content}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.createdByName && `由 ${item.createdByName} · `}
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.orderId && (
                      <Link href={`/orders?id=${item.orderId}`}>
                        <Button variant="outline" size="sm">查看订单</Button>
                      </Link>
                    )}
                    <Button
                      size="sm"
                      variant="default"
                      disabled={completingId === item.id}
                      onClick={() => handleComplete(item.id)}
                      className="gap-1"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {completingId === item.id ? "处理中..." : "完成"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>所有事项已处理完毕</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legacy stats - keep for backward compat */}
      <Card>
        <CardHeader>
          <CardTitle>会员系统概览</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Facebook 系统</strong>负责：会员下单、收款审核及发送 Telegram 入群流程。
          </p>
          <p>
            <strong className="text-foreground">Telegram 系统</strong>负责：会员开通、会员期限、续费、积分、到期提醒及会员群管理。
          </p>
          <p className="text-xs">
            客户上传单据后，系统不会自动发送入群 Flow。必须由后台工作人员审核并点击「确认会员费」后，才会自动发送 Messenger 入群流程。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
