import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Clock, Package, Truck, DollarSign, TrendingUp,
  ShoppingCart, Warehouse, Calendar, Bell,
  ShoppingBag, CheckCircle, XCircle, Ban,
} from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.dashboardV11.stats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!stats) return null;

  const alerts: { label: string; count: number; link: string; color: string }[] = [];
  if (stats.alerts.pendingPayment > 0) {
    alerts.push({ label: "待审核付款", count: stats.alerts.pendingPayment, link: "/orders", color: "bg-orange-500" });
  }
  if (stats.alerts.repotOrders > 0) {
    alerts.push({ label: "换盆安排", count: stats.alerts.repotOrders, link: "/packing", color: "bg-blue-500" });
  }
  if (stats.alerts.scheduledToday > 0) {
    alerts.push({ label: "今日预约发货", count: stats.alerts.scheduledToday, link: "/packing", color: "bg-purple-500" });
  }
  if (stats.alerts.holdExpiring > 0) {
    alerts.push({ label: "保留订单", count: stats.alerts.holdExpiring, link: "/orders", color: "bg-yellow-500" });
  }

  const row1 = [
    { title: "待审核付款", value: stats.row1.pendingPayment, icon: Clock, color: "text-orange-500", link: "/orders" },
    { title: "待出货", value: stats.row1.pendingShipment, icon: Package, color: "text-blue-500", link: "/packing" },
    { title: "部分发货", value: stats.row1.partialShipped, icon: Truck, color: "text-cyan-500", link: "/packing" },
  ];

  const row2 = [
    { title: "未汇款订单", value: stats.row2.unpaidOrders, icon: ShoppingCart, color: "text-red-500", link: "/orders" },
    { title: "本月已汇款", value: stats.row2.paidThisMonth, icon: CheckCircle, color: "text-green-500", link: "/orders" },
    { title: "保留订单", value: stats.row2.holdOrders, icon: Ban, color: "text-yellow-500", link: "/orders" },
  ];

  const row3 = [
    { title: "库存不足", value: stats.row3.lowStock, icon: Warehouse, color: "text-orange-500", link: "/products" },
    { title: "缺货商品", value: stats.row3.outOfStock, icon: XCircle, color: "text-red-500", link: "/products" },
  ];

  const row4 = [
    { title: "今日订单", value: stats.row4.todayOrders, icon: ShoppingBag, color: "text-blue-500", link: "/orders" },
    { title: "今日已发货", value: stats.row4.todayShipped, icon: Truck, color: "text-green-500", link: "/packing" },
    { title: "今日销售额", value: `RM ${Number(stats.row4.todaySales).toFixed(2)}`, icon: DollarSign, color: "text-green-600", link: "/business-report" },
    { title: "本月销售额", value: `RM ${Number(stats.row4.monthSales).toFixed(2)}`, icon: TrendingUp, color: "text-primary", link: "/business-report" },
  ];

  const row5 = [
    { title: "今日预约发货", value: stats.row5.scheduledToday, icon: Calendar, color: "text-purple-500", link: "/packing" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">仪表板</h1>
        <span className="text-sm text-muted-foreground">{new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</span>
      </div>

      {/* Order Alerts Banner */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap p-4 rounded-lg border bg-muted/50">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4 text-primary" />
            <span>订单提醒</span>
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

      {/* Row 1: Today's Tasks */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {row1.map((card, i) => (
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

      {/* Row 2: Orders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {row2.map((card, i) => (
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

      {/* Row 3: Inventory */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {row3.map((card, i) => (
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

      {/* Row 4: Business Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {row4.map((card, i) => (
          <Link key={i} href={card.link}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Row 5: Scheduled Shipping */}
      <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
        {row5.map((card, i) => (
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
  );
}
