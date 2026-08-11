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
  const utils = trpc.useUtils();
  const { data: orders, isLoading } = trpc.packing.list.useQuery({ status: activeTab as any }, { enabled: !isScheduledTab && !isSpecialTab });
  const { data: scheduledOrders, isLoading: scheduledLoading } = trpc.scheduledShipping.list.useQuery(
    { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    { enabled: isScheduledTab }
  );
  const { data: specialOrdersData, isLoading: specialLoading } = trpc.shippingV2.specialOrders.useQuery(
    { status: "pending" },
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
      const productItemCount = (data.items || []).length;
      const useGrid = productItemCount > 2;
      const shippingLabel = data.shippingMethodLabel || data.specialLabel || "西马";

      // Customer info section
      const customerInfoHtml = `
        <div style="margin-bottom:4px;font-size:12px;line-height:1.4">
          <div><strong>下单人:</strong> ${data.facebookName || data.customerName || "-"}</div>
          <div><strong>收件人:</strong> ${data.recipientName || data.customerName || "-"}</div>
          <div><strong>电话:</strong> ${data.recipientPhone || data.customerPhone || ""}</div>
          <div><strong>地址:</strong> ${[
            data.addressLine1,
            data.addressLine2,
            data.postcode || data.recipientPostcode,
            data.recipientCity,
            data.recipientState
          ].filter(Boolean).join(", ")}</div>
        </div>`;

      const itemsHtml = useGrid
        ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${data.items.map((item: any) => `
              <div style="border:2px solid #000;padding:8px;border-radius:6px;min-height:80px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                  <span style="font-size:20px">☐</span>
                  <span style="font-weight:bold;font-size:18px;line-height:1.2">${item.productName}</span>
                </div>
                ${item.keyword ? `<div style="font-size:14px;color:#555;margin-left:26px">${item.keyword}</div>` : ""}
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
                  <span style="font-size:14px">RM${Number(item.unitPrice || 0).toFixed(0)} × ${item.quantity}</span>
                  <span style="font-size:36px;font-weight:bold;border:4px solid #000;padding:4px 12px;border-radius:6px">${item.quantity}</span>
                </div>
                <div style="font-size:13px;text-align:right;margin-top:4px">小计: RM${Number(item.subtotal || 0).toFixed(2)}</div>
              </div>
            `).join("")}
          </div>`
        : data.items.map((item: any) => `
            <div style="margin-bottom:6px;padding-bottom:4px;border-bottom:1px dashed #ccc">
              <div style="display:flex;align-items:center;gap:4px">
                <span style="font-size:16px">☐</span>
                <span style="font-weight:bold;font-size:14px">${item.productName}</span>
                ${item.variationName ? `<span style="font-size:11px">(${item.variationName})</span>` : ""}
              </div>
              ${item.keyword ? `<div style="font-size:11px;color:#555;margin-left:20px">关键词: ${item.keyword}</div>` : ""}
              <div style="margin-left:20px;display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:12px">单价: RM${Number(item.unitPrice || 0).toFixed(2)} × ${item.quantity} = RM${Number(item.subtotal || 0).toFixed(2)}</span>
                <span style="font-size:32px;font-weight:bold;${item.quantity > 1 ? "border:3px solid #000;padding:2px 10px;border-radius:4px" : ""}">${item.quantity}</span>
              </div>
            </div>
          `).join("");

      const giftHtml = data.giftItems && data.giftItems.length > 0
        ? `<div style="border-top:1px solid #000;margin:4px 0"></div>
            ${data.giftItems.map((gift: any) => `
              <div style="margin-bottom:4px">
                <div style="display:flex;align-items:center;gap:4px">
                  <span style="font-size:16px">☐</span>
                  <span><strong>赠品</strong> ${gift.productName}</span>
                </div>
                <div style="margin-left:20px;display:flex;justify-content:flex-end">
                  <span style="font-size:24px;font-weight:bold;border:2px solid #000;padding:1px 8px;border-radius:3px">${gift.quantity}</span>
                </div>
              </div>
            `).join("")}`
        : "";

      // Amount details section
      const s = data.summary || {};
      const amountHtml = `
        <div style="border-top:2px solid #000;margin:4px 0"></div>
        <div style="margin-bottom:6px;font-size:13px;line-height:1.6">
          <div style="display:flex;justify-content:space-between"><span>商品小计:</span><span>RM ${s.physicalSubtotal || s.regularTotal || "0.00"}</span></div>
          <div style="display:flex;justify-content:space-between"><span>运费:</span><span>RM ${s.shippingFee || "0.00"}</span></div>
          ${parseFloat(s.discountAmount || "0") > 0 ? `<div style="display:flex;justify-content:space-between"><span>折扣: ${s.discountReason ? `(${s.discountReason})` : ""}</span><span>-RM ${s.discountAmount}</span></div>` : ""}
          ${parseFloat(s.extraCharge || "0") > 0 ? `<div style="display:flex;justify-content:space-between"><span>额外收费: ${s.extraChargeDescription ? `(${s.extraChargeDescription})` : ""}</span><span>+RM ${s.extraCharge}</span></div>` : ""}
          ${parseFloat(s.creditUsed || "0") > 0 ? `<div style="display:flex;justify-content:space-between"><span>Credit:</span><span>-RM ${s.creditUsed}</span></div>` : ""}
          <div style="border-top:1px solid #000;margin:2px 0"></div>
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold"><span>总金额:</span><span>RM ${s.totalAmount || "0.00"}</span></div>
        </div>`;

      const remarksHtml = data.remarks && data.remarks.length > 0
        ? `<div style="margin-bottom:8px;border:2px solid #000;padding:4px">
            ${data.remarks.map((r: any) => {
              if (r.remarkCategory === "repotting") return `<div style="margin-bottom:4px"><div style="font-weight:bold;font-size:12px">📌 换盆</div><div style="font-size:11px;margin-left:8px">${r.content || ""}</div></div>`;
              if (r.remarkCategory === "desired_delivery_date") return `<div style="margin-bottom:4px"><div style="font-weight:bold;font-size:12px">📌 希望收货日期</div><div style="font-size:11px;margin-left:8px">${r.desiredDeliveryDate ? new Date(r.desiredDeliveryDate).toLocaleDateString() : ""}${r.desiredDeliveryReason ? " — " + r.desiredDeliveryReason : ""}</div></div>`;
              if (r.remarkCategory === "other") return `<div style="margin-bottom:4px"><div style="font-weight:bold;font-size:12px">📌 其他备注</div><div style="font-size:11px;margin-left:8px">${r.content || ""}</div></div>`;
              return "";
            }).join("")}
          </div>`
        : "";

      return `
        <div style="page-break-after:always;width:148mm;padding:8mm;font-family:sans-serif;font-size:12px;color:#000">
          <div style="text-align:center;font-size:36px;font-weight:bold;margin-bottom:4px;border:3px solid #000;padding:6px">${shippingLabel}</div>
          <div style="text-align:center;font-size:28px;font-weight:bold;margin-bottom:4px">${data.orderNumber}</div>
          ${customerInfoHtml}
          <div style="border-top:2px solid #000;margin:4px 0"></div>
          <div style="margin-bottom:8px">${itemsHtml}${giftHtml}</div>
          ${amountHtml}
          ${data.summary.isFreeShipping ? `<div style="text-align:center;font-size:14px;font-weight:bold;color:green;margin-bottom:4px">免邮</div>` : ""}
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
    <div className="space-y-6">
      {/* Hidden iframe for printing */}
      <iframe ref={printFrameRef} style={{ position: "absolute", width: "0", height: "0", border: "none", left: "-9999px" }} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{translate("包货工作台", "Packing")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{translate("包货与发货管理", "Packing and Shipping Management")}</p>
        </div>
        {/* V2.1.26: Batch print button */}
        {selectedOrderIds.size > 0 && !isScheduledTab && (
          <Button variant="default" size="sm" onClick={handleBatchPrint} disabled={isBatchPrinting}>
            <Printer className="h-4 w-4 mr-1" />
            {translate("批量打印 ({count})", "Batch Print ({count})", { count: selectedOrderIds.size })}
          </Button>
        )}
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
                {orderList.map((order: any) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-4">
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
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-sm">{order.orderNumber}</span>
                              {order.specialLabel && (
                                <Badge variant="destructive" className="text-xs">{order.specialLabel}</Badge>
                              )}
                              {/* V2.1.26: Show 免邮 badge */}
                              {order.isFreeShipping && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-300">{translate("免邮", "Free Shipping")}</Badge>
                              )}
                              {/* V2.1.26: Show order category badge for import orders */}
                              {order.orderCategory === "import" && (
                                <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">{translate("中国代购", "Import")}</Badge>
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
                        <div className="flex items-center gap-4 text-right">
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
                            <Button size="sm" variant="outline">{translate("包货", "Pack")}</Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
