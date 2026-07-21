import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Clock, Send, AlertCircle, DollarSign, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  const cards = [
    {
      title: "本月新增会员订单",
      value: stats?.newMembershipOrders ?? 0,
      icon: Crown,
      color: "text-primary",
    },
    {
      title: "待审核订单",
      value: stats?.pendingReviews ?? 0,
      icon: Clock,
      color: "text-orange-500",
    },
    {
      title: "已发送 Flow",
      value: stats?.flowSent ?? 0,
      icon: Send,
      color: "text-blue-500",
    },
    {
      title: "待人工跟进",
      value: stats?.needsFollowUp ?? 0,
      icon: AlertCircle,
      color: "text-red-500",
    },
    {
      title: "会员费总收入",
      value: `RM ${(Number(stats?.membershipRevenue ?? 0)).toFixed(2)}`,
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      title: "Flow 发送成功率",
      value: `${stats?.flowSuccessRate ?? 0}%`,
      icon: TrendingUp,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">仪表板</h1>
        <p className="text-sm text-muted-foreground mt-1">心田会员系统概览</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>系统说明</CardTitle>
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
