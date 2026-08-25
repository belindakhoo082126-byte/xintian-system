import { useState, useRef } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Truck, CheckCircle2, Clock, MapPin, Phone, User, ArrowLeft, Printer, Ship, Calendar, Filter, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";
import { toast } from "sonner";
import { getSpecialOrderHandlingLabel, getSpecialOrderReasonLabel, SPECIAL_ORDER_FILTER_OPTIONS } from "@shared/specialOrderDisplay";
import { getPackingSlipRemarkRows, renderPackingSlipRemarkHtml } from "@shared/packingSlipRemarks";
import { getPackingShippingControl } from "@shared/packingSpecialOrderRules";

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

function getShippingLabelClassName(label: string | undefined): string {
  const normalizedLabel = (label || "").toLowerCase();
  if (normalizedLabel.includes("poslaju")) return "bg-red-100 text-red-800";
  if (normalizedLabel.includes("shopee")) return "bg-orange-100 text-orange-800";
  if (normalizedLabel.includes("lalamove")) return "bg-yellow-100 text-yellow-800";
  if (normalizedLabel.includes("自取")) return "bg-purple-100 text-purple-800";
  return "bg-gray-100 text-gray-800";
}

const STATUS_TABS = [
  { key: "packing", label: { zh: "待包货", en: "Packing" }, icon: Clock, color: "text-blue-600" },
  { key: "scheduled", label: { zh: "预约发货", en: "Scheduled" }, icon: Calendar, color: "text-purple-600" },
  { key: "shipped", label: { zh: "已发货", en: "Shipped" }, icon: Truck, color: "text-green-600" },
  { key: "partial_shipped", label: { zh: "部分发货", en: "Partial Shipped" }, icon: Package, color: "text-orange-600" },
  { key: "completed", label: { zh: "今日已发货", en: "Today's Shipped" }, icon: CheckCircle2, color: "text-gray-600" },
  { key: "special", label: { zh: "特别订单", en: "Special Orders" }, icon: AlertCircle, color: "text-red-600" },
] as const;

export default function Packing() {
  const { translate, lang } = useI18n();
  const searchParams = useSearch();
  const urlTab = new URLSearchParams(searchParams).get("tab");
  const [activeTab, setActiveTab] = useState<string>(urlTab || "packing");

  const isScheduledTab = activeTab === "scheduled";
  const isSpecialTab = activeTab === "special";
  const urlDate = new URLSearchParams(searchParams).get("date");
  const todayStr = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState<string>(urlDate === "today" ? todayStr : "");
  const [dateTo, setDateTo] = useState<string>(urlDate === "today" ? todayStr : "");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const urlSpecialType = new URLSearchParams(searchParams).get("type");
  const [specialTypeFilter, setSpecialTypeFilter] = useState<string>(urlSpecialType || "all");
  const utils = trpc.useUtils();
  const { data: orders, isLoading } = trpc.packing.list.useQuery({ status: activeTab as any }, { enabled: !isScheduledTab && !isSpecialTab });
  const { data: scheduledOrders, isLoading: scheduledLoading } = trpc.scheduledShipping.list.useQuery(
    { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    { enabled: isScheduledTab }
  );
  const { data: specialOrdersData, isLoading: specialLoading } = trpc.shippingV2.specialOrders.useQuery(
    { type: specialTypeFilter !== "all" ? specialTypeFilter : undefined },
    { enabled: isSpecialTab }
  );
  const rawOrderList = isScheduledTab
    ? ((scheduledOrders as any[]) || [])
    : isSpecialTab
      ? (Array.isArray(specialOrdersData) ? (specialOrdersData as any[]) : ((specialOrdersData as any)?.items || []) as any[])
      : ((orders as any[]) || []);
  const orderList = (isScheduledTab || isSpecialTab) && statusFilter !== "all"
    ? rawOrderList.filter((o: any) => (o.physicalStatus || o.importStatus) === statusFilter)
    : rawOrderList;
  const isLoadingCombined = isLoading || scheduledLoading || specialLoading;

  // V2.1.26: Batch print state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  const toggleOrderSelection = (orderId: number) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === orderList.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orderList.map((o: any) => o.id)));
    }
  };

  // V2.1.26: Single order print - use utils client to fetch slip data
  const handleSinglePrint = async (orderId: number) => {
    try {
      const slipData = await utils.packing.slipData.fetch({ orderId });
      if (slipData) {
        printSlipData([slipData as any]);
      } else {
        toast.error(translate("获取打印数据失败", "Failed to fetch print data"));
      }
    } catch (err) {
      toast.error(translate("获取打印数据失败", "Failed to fetch print data"));
    }
  };

  // V2.1.26: Batch print - fetch all selected orders' slip data
  const handleBatchPrint = async () => {
    if (selectedOrderIds.size === 0) {
      toast.error(translate("请选择要打印的订单", "Please select orders to print"));
      return;
    }
    setIsBatchPrinting(true);
    try {
      const ids = Array.from(selectedOrderIds);
      const results = await Promise.all(
        ids.map((id) => utils.packing.slipData.fetch({ orderId: id }))
      );
      printSlipData(results.filter(Boolean) as any[]);
      setSelectedOrderIds(new Set());
    } catch (err) {
      toast.error(translate("批量打印失败", "Batch print failed"));
    } finally {
      setIsBatchPrinting(false);
    }
  };

  // V2.1.26: Render slip data into HTML and print via hidden iframe - unified with A5PackingSlip format
  const printSlipData = (slipDataList: any[]) => {
    const html = slipDataList.map((data) => {
      const shippingLabel = data.shippingMethodLabel || data.specialLabel || "西马";

      const customerInfoHtml = `
        <div style="margin:0 0 5px;font-size:12px;line-height:1.35">
          <div style="margin-bottom:1px"><strong>下单人:</strong> <span style="font-size:17px;font-weight:800;line-height:1.25">${data.facebookName || data.customerName || "-"}</span></div>
          <div style="margin-bottom:1px"><strong>收件人:</strong> <span style="font-size:17px;font-weight:800;line-height:1.25">${data.recipientName || data.customerName || "-"}</span></div>
          <div><strong>电话:</strong> ${data.recipientPhone || data.customerPhone || ""}</div>
          <div style="word-break:break-word"><strong>地址:</strong> ${[
            data.addressLine1,
            data.addressLine2,
            data.postcode || data.recipientPostcode,
            data.recipientCity,
            data.recipientState
          ].filter(Boolean).join(", ")}</div>
        </div>`;

      const itemsHtml = data.items.map((item: any) => `
        <div style="position:relative;min-height:62px;margin-bottom:5px;padding:4px 50px 6px 0;border-bottom:1px solid #d1d5db">
          <div style="display:flex;align-items:flex-start;gap:5px">
            <span style="font-size:15px;line-height:1.15">☐</span>
            <div style="font-weight:800;font-size:16px;line-height:1.22">${item.productName}${item.variationName ? ` <span style="font-size:11px;font-weight:500">(${item.variationName})</span>` : ""}</div>
          </div>
          ${item.keyword ? `<div style="font-size:11px;line-height:1.25;margin:2px 0 0 20px;color:#333">关键词: ${item.keyword}</div>` : ""}
          <div style="font-size:11px;line-height:1.3;margin:4px 0 0 20px">单价: RM${Number(item.unitPrice || 0).toFixed(2)} × ${item.quantity} = RM${Number(item.subtotal || 0).toFixed(2)}</div>
          <div style="position:absolute;right:1px;top:50%;transform:translateY(-50%);min-width:36px;text-align:center;font-size:31px;line-height:1;font-weight:900;${Number(item.quantity) > 1 ? "border:2px solid #000;border-radius:3px;padding:4px 7px" : ""}">${item.quantity}</div>
        </div>
      `).join("");

      const giftHtml = data.giftItems && data.giftItems.length > 0
          ? `<div style="margin:4px 0 2px;border-top:1px solid #000"></div>
            ${data.giftItems.map((gift: any) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 2px;font-size:14px"><span>☐ <strong>赠品</strong> ${gift.productName}</span><strong style="font-size:23px">${gift.quantity}</strong></div>`).join("")}`
        : "";

      // Amount details section
      const s = data.summary || {};
      const amountHtml = `
        <div style="border-top:2px solid #000;margin:5px 0 3px"></div>
        <div style="margin-bottom:6px;font-size:12px;line-height:1.45">
          <div style="display:flex;justify-content:space-between"><span>商品小计:</span><span>RM ${s.physicalSubtotal || s.regularTotal || "0.00"}</span></div>
          <div style="display:flex;justify-content:space-between"><span>运费:</span><span>RM ${s.shippingFee || "0.00"}</span></div>
          ${parseFloat(s.discountAmount || "0") > 0 ? `<div style="display:flex;justify-content:space-between"><span>折扣: ${s.discountReason ? `(${s.discountReason})` : ""}</span><span>-RM ${s.discountAmount}</span></div>` : ""}
          ${parseFloat(s.extraCharge || "0") > 0 ? `<div style="display:flex;justify-content:space-between"><span>额外收费: ${s.extraChargeDescription ? `(${s.extraChargeDescription})` : ""}</span><span>+RM ${s.extraCharge}</span></div>` : ""}
          ${parseFloat(s.creditUsed || "0") > 0 ? `<div style="display:flex;justify-content:space-between"><span>Credit:</span><span>-RM ${s.creditUsed}</span></div>` : ""}
          <div style="border-top:1px solid #000;margin:2px 0"></div>
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900"><span>总金额:</span><span>RM ${s.totalAmount || "0.00"}</span></div>
        </div>`;

      const remarkRows = getPackingSlipRemarkRows([
        ...(data.remarks || []),
        ...(data.adminRemarks || []),
        ...(data.customerRemark ? [{ remarkCategory: "customer", content: data.customerRemark }] : []),
      ], lang === "en" ? "en" : "zh");
      const remarksHtml = remarkRows.length > 0
        ? `<div style="margin-top:7px;margin-bottom:4px;border:2px solid #000;padding:6px 7px">
            <div style="font-weight:900;font-size:16px;margin-bottom:5px">${lang === "en" ? "Order Notes" : "订单备注"}</div>
            <div style="font-size:14px;font-weight:700;line-height:1.4">${renderPackingSlipRemarkHtml(remarkRows)}</div>
          </div>`
        : "";

      return `
        <div style="page-break-after:always;box-sizing:border-box;width:148mm;min-height:210mm;padding:7mm 8mm;font-family:Arial,'Microsoft JhengHei',sans-serif;font-size:12px;color:#000;background:#fff">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;margin-bottom:5px"><span>${new Date().toLocaleString("en-MY")}</span><span>A5 Packing Slip</span></div>
          <div style="text-align:center;font-size:26px;line-height:1.12;font-weight:900;letter-spacing:.4px;margin-bottom:3px;border:2px solid #000;padding:7px 5px">${shippingLabel}</div>
          <div style="text-align:center;font-size:25px;line-height:1.1;font-weight:900;margin-bottom:6px">${data.orderNumber}</div>
          ${customerInfoHtml}
          <div style="border-top:2px solid #000;margin:5px 0 4px"></div>
          <div style="margin-bottom:4px">${itemsHtml}${giftHtml}</div>
          ${amountHtml}
          ${remarksHtml}
        </div>
      `;
    }).join("");

    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>A5 Packing Slip</title>
      <style>@media print{body{margin:0;padding:0}}</style>
      </head><body>${html}</body></html>`;

    const iframe = printFrameRef.current;
    if (iframe) {
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(fullHtml);
        doc.close();
        iframe.contentWindow?.focus();
        setTimeout(() => {
          iframe.contentWindow?.print();
        }, 500);
      }
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Hidden iframe for printing */}
      <iframe ref={printFrameRef} style={{ position: "absolute", width: "0", height: "0", border: "none", left: "-9999px" }} />

      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">{translate("包货工作台", "Packing")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{translate("包货与发货管理", "Packing and Shipping Management")}</p>
        </div>
        {/* V2.1.26: Batch print button */}
        {selectedOrderIds.size > 0 && !isScheduledTab && (
          <Button className="w-full sm:w-auto" variant="default" size="sm" onClick={handleBatchPrint} disabled={isBatchPrinting}>
            <Printer className="h-4 w-4 mr-1" />
            {translate("批量打印 ({count})", "Batch Print ({count})", { count: selectedOrderIds.size })}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <TabsList className="h-auto min-w-max justify-start gap-1 whitespace-nowrap p-1">
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
        </div>

        <TabsContent value={activeTab} className="mt-4">
          {isScheduledTab && (
            <Card className="mb-4"><CardContent className="py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
                <div className="w-full sm:w-auto">
                  <Label className="text-xs">{translate("开始日期", "Start Date")}</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-40" />
                </div>
                <div className="w-full sm:w-auto">
                  <Label className="text-xs">{translate("结束日期", "End Date")}</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-40" />
                </div>
                <div className="w-full sm:w-auto">
                  <Label className="text-xs">{translate("状态筛选", "Status Filter")}</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder={translate("全部状态", "All Status")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{translate("全部状态", "All Status")}</SelectItem>
                      {Object.entries(SCHEDULED_STATUS_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>{lang === "zh" ? cfg.label.zh : cfg.label.en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isSpecialTab && (
                  <div className="w-full sm:w-auto">
                    <Label className="text-xs">{translate("异常原因", "Special Reason")}</Label>
                    <Select value={specialTypeFilter} onValueChange={setSpecialTypeFilter}>
                      <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{translate("全部原因", "All Reasons")}</SelectItem>
                        {SPECIAL_ORDER_FILTER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {translate(option.zh, option.en)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(dateFrom || dateTo || statusFilter !== "all" || specialTypeFilter !== "all") && (
                  <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); setSpecialTypeFilter("all"); }}>{translate("清除筛选", "Clear Filters")}</Button>
                )}
                <div className="text-sm text-muted-foreground sm:ml-auto">{translate("共 {count} 单", "Total {count} orders", { count: orderList.length })}</div>
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
            <div className="space-y-3">
              {/* V2.1.26: Select all checkbox row */}
              {!isScheduledTab && orderList.length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <Checkbox
                    id="select-all"
                    checked={selectedOrderIds.size === orderList.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    {translate("全选 ({selected}/{total})", "Select All ({selected}/{total})", { selected: selectedOrderIds.size, total: orderList.length })}
                  </label>
                </div>
              )}
              <div className="grid gap-3">
                {orderList.map((order: any) => {
                  const packingShippingControl = order.packingShippingControl || getPackingShippingControl(order);
                  const isPackingBlocked = packingShippingControl.mode === "block" || packingShippingControl.mode === "requires_release";
                  const pendingSpecialReason = getSpecialOrderReasonLabel(order.specialOrderType);
                  return (
                  <Card key={order.id} className={isPackingBlocked ? "border-amber-300 bg-amber-50/30" : "hover:shadow-md transition-shadow"}>
                    <CardContent className="py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* V2.1.26: Per-order checkbox for batch print */}
                          {!isScheduledTab && (
                            <Checkbox
                              checked={selectedOrderIds.has(order.id)}
                              onCheckedChange={() => toggleOrderSelection(order.id)}
                              className="mt-1"
                            />
                          )}
                          <Link href={`/packing/${order.id}`} className="flex-1 min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-sm">{order.orderNumber}</span>
                              {order.specialLabel && (
                                <Badge variant="outline" className={`text-xs border-0 ${getShippingLabelClassName(order.specialLabel)}`}>{order.specialLabel}</Badge>
                              )}
                              {isPackingBlocked && (
                                <>
                                  <Badge variant="outline" className={`text-xs ${pendingSpecialReason.className}`}>{translate(pendingSpecialReason.zh, pendingSpecialReason.en)}</Badge>
                                  <Badge variant="outline" className="border-amber-300 bg-amber-100 text-xs text-amber-900">{translate("待处理，暂停包货", "Pending, packing paused")}</Badge>
                                </>
                              )}
                              {packingShippingControl.mode === "partial_only" && (
                                <>
                                  <Badge variant="outline" className={`text-xs ${pendingSpecialReason.className}`}>{translate(pendingSpecialReason.zh, pendingSpecialReason.en)}</Badge>
                                  <Badge variant="outline" className="border-violet-300 bg-violet-50 text-xs text-violet-900">{translate("可先部分发货", "Partial shipment allowed")}</Badge>
                                </>
                              )}
                              {packingShippingControl.reason === "pending_refund" && (
                                <>
                                  <Badge variant="outline" className={`text-xs ${pendingSpecialReason.className}`}>{translate(pendingSpecialReason.zh, pendingSpecialReason.en)}</Badge>
                                  <Badge variant="outline" className="border-rose-300 bg-rose-50 text-xs text-rose-900">{translate("退款不阻止发货", "Refund does not block shipping")}</Badge>
                                </>
                              )}
                              {isSpecialTab && (() => {
                                const reason = getSpecialOrderReasonLabel(order.specialOrderType);
                                const handling = getSpecialOrderHandlingLabel(order.isResolved, order.specialOrderStatus);
                                return (
                                  <>
                                    <Badge variant="outline" className={`text-xs ${reason.className}`}>
                                      {translate(reason.zh, reason.en)}
                                    </Badge>
                                    <Badge variant="outline" className={`text-xs ${handling.className}`}>
                                      {translate(handling.zh, handling.en)}
                                    </Badge>
                                  </>
                                );
                              })()}
                              {isSpecialTab && order.specialOrderType === "notification_failed" && order.specialOrderReason && (
                                <span className="block max-w-[360px] truncate text-xs text-muted-foreground" title={order.specialOrderReason}>
                                  {translate("失败内容", "Failed content")}: {order.specialOrderReason}
                                </span>
                              )}
                              {/* V2.1.26: Show 免邮 badge */}
                              {order.isFreeShipping && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-300">{translate("免邮", "Free Shipping")}</Badge>
                              )}
                              {/* V2.1.26: Show order category badge for import orders */}
                              {order.orderCategory === "import" && (
                                <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">{translate("代购", "Import")}</Badge>
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
                              {/* V2.1.26: Show customer paid shipping */}
                              <span className="flex items-center gap-1">
                                <Truck className="h-3 w-3" />
                                {translate("客户付运费", "Paid Shipping")}: RM {Number(order.customerPaidShipping || order.shippingFee || 0).toFixed(2)}
                              </span>
                            </div>
                          </Link>
                        </div>
                        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3 text-right sm:w-auto sm:flex-nowrap sm:border-0 sm:pt-0">
                          <div>
                            <div className="text-xs text-muted-foreground">{translate("商品种类", "Item Types")}</div>
                            <div className="font-semibold">{order.itemTypes}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">{translate("总数量", "Total Quantity")}</div>
                            <div className="font-semibold text-lg">{order.totalQuantity}</div>
                          </div>
                          {/* V2.1.26: Per-order print button */}
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSinglePrint(order.id);
                            }}
                            title={translate("打印", "Print")}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Link href={`/packing/${order.id}`}>
                            <Button size="sm" variant={isPackingBlocked ? "secondary" : "outline"} className={isPackingBlocked ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : undefined}>
                              {isPackingBlocked ? translate("处理特别状态", "Resolve Special Status") : translate("包货", "Pack")}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )})}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
