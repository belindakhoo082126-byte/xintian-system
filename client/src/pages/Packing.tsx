import { useState } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Truck, CheckCircle2, Clock, MapPin, Phone, User, ArrowLeft, Printer, Ship, Calendar, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";

// V2.1.13: Status color mapping for scheduled shipping orders (8 statuses)
const SCHEDULED_STATUS_CONFIG: Record<string, { label: { zh: string; en: string }; color: string; bgColor: string; borderColor: string }> = {
  pending: { label: { zh: "未汇款", en: "Unpaid" }, color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
  packing: { label: { zh: "待包货", en: "Packing" }, color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
  hold_order: { label: { zh: "保留订单", en: "Hold" }, color: "text-yellow-600", bgColor: "bg-yellow-50", borderColor: "border-yellow-200" },
  receipt_uploaded: { label: { zh: "待审核付款凭证", en: "Receipt Uploaded" }, color: "text-orange-600", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
  partial_payment: { label: { zh: "部分汇款", en: "Partial Payment" }, color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
  waiting_stock: { label: { zh: "待备货", en: "Waiting Stock" }, color: "text-purple-600", bgColor: "bg-purple-50", borderColor: "border-purple-200" },
  ready_to_ship: { label: { zh: "待发货", en: "Ready to Ship" }, color: "text-indigo-600", bgColor: "bg-indigo-50", borderColor: "border-indigo-200" },
  scheduled_ship: { label: { zh: "预约发货", en: "Scheduled Ship" }, color: "text-cyan-600", bgColor: "bg-cyan-50", borderColor: "border-cyan-200" },
};

function getStatusBadge(status: string, lang: string) {
  const config = SCHEDULED_STATUS_CONFIG[status];
  if (!config) return null;
  const label = lang === "zh" ? config.label.zh : config.label.en;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bgColor} border ${config.borderColor}`}>
      {label}
    </span>
  );
}

const STATUS_TABS = [
  { key: "packing", label: { zh: "待包货", en: "Packing" }, icon: Clock, color: "text-blue-600" },
  { key: "scheduled", label: { zh: "预约发货", en: "Scheduled" }, icon: Calendar, color: "text-purple-600" },
  { key: "shipped", label: { zh: "已发货", en: "Shipped" }, icon: Truck, color: "text-green-600" },
  { key: "partial_shipped", label: { zh: "部分发货", en: "Partial Shipped" }, icon: Package, color: "text-orange-600" },
  { key: "completed", label: { zh: "今日已发货", en: "Today's Shipped" }, icon: CheckCircle2, color: "text-gray-600" },
] as const;

export default function Packing() {
  const { translate, lang } = useI18n();
  const searchParams = useSearch();
  const urlTab = new URLSearchParams(searchParams).get("tab");
  const [activeTab, setActiveTab] = useState<string>(urlTab || "packing");

  const isScheduledTab = activeTab === "scheduled";
  // V2.1.12: Default to today's date when entering scheduled tab (supports date=today URL param)
  const urlDate = new URLSearchParams(searchParams).get("date");
  const todayStr = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState<string>(urlDate === "today" ? todayStr : "");
  const [dateTo, setDateTo] = useState<string>(urlDate === "today" ? todayStr : "");
  // V2.1.13: Status filter for scheduled tab
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: orders, isLoading } = trpc.packing.list.useQuery({ status: activeTab as any }, { enabled: !isScheduledTab });
  const { data: scheduledOrders, isLoading: scheduledLoading } = trpc.scheduledShipping.list.useQuery(
    { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    { enabled: isScheduledTab }
  );
  const rawOrderList = isScheduledTab ? ((scheduledOrders as any[]) || []) : ((orders as any[]) || []);
  // V2.1.13: Apply status filter on scheduled tab
  const orderList = isScheduledTab && statusFilter !== "all"
    ? rawOrderList.filter((o: any) => (o.physicalStatus || o.importStatus) === statusFilter)
    : rawOrderList;
  const isLoadingCombined = isLoading || scheduledLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{translate("包货工作台", "Packing")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{translate("包货与发货管理", "Packing and Shipping Management")}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="gap-2">
              <tab.icon className={`h-4 w-4 ${tab.color}`} />
              {lang === "zh" ? tab.label.zh : tab.label.en}
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
                  <Label className="text-xs">{translate("开始日期", "Start Date")}</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
                </div>
                <div>
                  <Label className="text-xs">{translate("结束日期", "End Date")}</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
                </div>
                <div>
                  <Label className="text-xs">{translate("状态筛选", "Status Filter")}</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40"><SelectValue placeholder={translate("全部状态", "All Status")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{translate("全部状态", "All Status")}</SelectItem>
                      {Object.entries(SCHEDULED_STATUS_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>{lang === "zh" ? cfg.label.zh : cfg.label.en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(dateFrom || dateTo || statusFilter !== "all") && (
                  <Button variant="outline" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); }}>{translate("清除筛选", "Clear Filters")}</Button>
                )}
                <div className="ml-auto text-sm text-muted-foreground">{translate("共 {count} 单", "Total {count} orders", { count: orderList.length })}</div>
              </div>
            </CardContent></Card>
          )}
          {isLoadingCombined ? (
            <div className="text-center py-12 text-muted-foreground">{translate("加载中...", "Loading...")}</div>
          ) : orderList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {translate("暂无{status}订单", "No {status} orders", { status: lang === "zh" ? STATUS_TABS.find((t) => t.key === activeTab)?.label.zh : STATUS_TABS.find((t) => t.key === activeTab)?.label.en })}
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
                            {isScheduledTab && (order.physicalStatus || order.importStatus) && getStatusBadge(order.physicalStatus || order.importStatus, lang)}
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
                            <div className="text-xs text-muted-foreground">{translate("商品种类", "Item Types")}</div>
                            <div className="font-semibold">{order.itemTypes}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">{translate("总数量", "Total Quantity")}</div>
                            <div className="font-semibold text-lg">{order.totalQuantity}</div>
                          </div>
                          <Button size="sm" variant="outline">{translate("包货", "Pack")}</Button>
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
