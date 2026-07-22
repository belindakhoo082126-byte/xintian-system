import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Truck, CheckCircle2, Clock, MapPin, Phone, User, ArrowLeft, Printer, Ship, Calendar, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUS_TABS = [
  { key: "packing", label: "待包货", icon: Clock, color: "text-blue-600" },
  { key: "scheduled", label: "预约发货", icon: Calendar, color: "text-purple-600" },
  { key: "shipped", label: "已发货", icon: Truck, color: "text-green-600" },
  { key: "partial_shipped", label: "部分发货", icon: Package, color: "text-orange-600" },
  { key: "completed", label: "今日已发货", icon: CheckCircle2, color: "text-gray-600" },
] as const;

export default function Packing() {
  const [activeTab, setActiveTab] = useState<string>("packing");

  const isScheduledTab = activeTab === "scheduled";
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const { data: orders, isLoading } = trpc.packing.list.useQuery({ status: activeTab as any }, { enabled: !isScheduledTab });
  const { data: scheduledOrders, isLoading: scheduledLoading } = trpc.scheduledShipping.list.useQuery(
    { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    { enabled: isScheduledTab }
  );
  const orderList = isScheduledTab ? ((scheduledOrders as any[]) || []) : ((orders as any[]) || []);
  const isLoadingCombined = isLoading || scheduledLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">包货工作台</h1>
          <p className="text-sm text-muted-foreground mt-1">包货与发货管理</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="gap-2">
              <tab.icon className={`h-4 w-4 ${tab.color}`} />
              {tab.label}
              {orderList.length > 0 && activeTab === tab.key && (
                <Badge variant="secondary" className="ml-1">{orderList.length}</Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isScheduledTab && (
            <Card className="mb-4"><CardContent className="py-3">
              <div className="flex items-end gap-4">
                <div>
                  <Label className="text-xs">开始日期</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
                </div>
                <div>
                  <Label className="text-xs">结束日期</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
                </div>
                {(dateFrom || dateTo) && (
                  <Button variant="outline" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>清除筛选</Button>
                )}
                <div className="ml-auto text-sm text-muted-foreground">共 {orderList.length} 单</div>
              </div>
            </CardContent></Card>
          )}
          {isLoadingCombined ? (
            <div className="text-center py-12 text-muted-foreground">加载中...</div>
          ) : orderList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                暂无{STATUS_TABS.find((t) => t.key === activeTab)?.label}订单
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {orderList.map((order: any) => (
                <Link key={order.id} href={`/packing/${order.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-sm">{order.orderNumber}</span>
                            {order.specialLabel && (
                              <Badge variant="destructive" className="text-xs">{order.specialLabel}</Badge>
                            )}
                            {isScheduledTab && order.scheduledShippingDate && (
                              <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(order.scheduledShippingDate).toLocaleDateString()}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{order.customerName}</span>
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{order.customerPhone}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{(order.shippingAddress || "").substring(0, 40)}...</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <div className="text-xs text-muted-foreground">商品种类</div>
                            <div className="font-semibold">{order.itemTypes}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">总数量</div>
                            <div className="font-semibold text-lg">{order.totalQuantity}</div>
                          </div>
                          <Button size="sm" variant="outline">包货</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
