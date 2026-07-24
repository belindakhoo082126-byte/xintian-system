import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Printer, Truck, Package, Plus, X, MapPin, Phone, User, Ship, CheckCircle2, Sprout, MessageSquare, RefreshCw } from "lucide-react";

const COURIERS = [
  { zh: "Parcel Daily", en: "Parcel Daily" },
  { zh: "Parcel King", en: "Parcel King" },
  { zh: "PosLaju", en: "PosLaju" },
  { zh: "JNT", en: "JNT" },
  { zh: "Ninja Van", en: "Ninja Van" },
  { zh: "DHL", en: "DHL" },
  { zh: "Lalamove", en: "Lalamove" },
  { zh: "Shopee Xpress", en: "Shopee Xpress" },
  { zh: "其他", en: "Other" },
];

export default function PackingDetail() {
  const { id } = useParams<{ id: string }>();
  const { translate, lang } = useI18n();
  const orderId = parseInt(id);
  const utils = trpc.useUtils();

  const { data: detail, isLoading } = trpc.packing.detail.useQuery({ orderId });
  const { data: slipData } = trpc.packing.slipData.useQuery({ orderId });
  const { data: existingPackages } = trpc.shipping.packages.useQuery({ orderId });
  const { data: remarks } = trpc.orderRemarks.list.useQuery({ orderId });
  const { data: repots } = trpc.repots.list.useQuery({ orderId });

  const [shippingMode, setShippingMode] = useState<"full" | "partial">("full");
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [packages, setPackages] = useState<Array<{
    courier: string;
    shippingType: "auto" | "manual" | "parcelking";
    trackingNumber: string;
    weight: string;
    serviceId: string;
  }>>([{ courier: "Parcel Daily", shippingType: "manual", trackingNumber: "", weight: "1", serviceId: "" }]);

  const parcelKingServicesQuery = trpc.parcelking.getServices.useQuery(undefined, {
    enabled: !!detail,
  });

  const createParcelKingMutation = trpc.shipping.createParcelKing.useMutation({
    onSuccess: (data: any) => {
            toast.success(translate(
        `Parcel King 运单已创建！追踪号: ${data.trackingNumber}${data.testMode ? " (Test)" : ""}`,
        `Parcel King Waybill Created! Tracking No: ${data.trackingNumber}${data.testMode ? " (Test)" : ""}`
      ));
      utils.packing.list.invalidate();
      utils.packing.detail.invalidate({ orderId });
      utils.shipping.packages.invalidate({ orderId });
      setPackages([{ courier: "Parcel Daily", shippingType: "manual", trackingNumber: "", weight: "1", serviceId: "" }]);
      setSelectedItems([]);
    },
    onError: (err) => toast.error(translate(`Parcel King 发货失败: ${err.message}`, `Parcel King Shipping Failed: ${err.message}`)),
  });

  const redownloadLabelMutation = trpc.shipping.redownloadLabel.useMutation({
    onSuccess: (data: any) => {
      if (data.success && data.url) {
        window.open(data.url, "_blank");
              toast.success(translate("标签已打开", "Label opened"));
      } else {
              toast.error(translate("下载标签失败: ", "Failed to download label: ") + (data.error || translate("未知错误", "Unknown error")));
      }
    },
    onError: (err: any) => toast.error(translate("下载标签失败: ", "Failed to download label: ") + err.message),
  });

  const resyncTrackingMutation = trpc.shipping.resyncTracking.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
              toast.success(translate(`追踪已同步！最新状态: ${data.newStatus}`, `Tracking synced! Latest status: ${data.newStatus}`));
        utils.shipping.packages.invalidate({ orderId });
      } else {
              toast.error(translate("同步失败: ", "Sync failed: ") + (data.error || translate("未知错误", "Unknown error")));
      }
    },
    onError: (err) => toast.error(translate("同步失败: ", "Sync failed: ") + err.message),
  });

  const fullShipMutation = trpc.shipping.fullShip.useMutation({
    onSuccess: () => {
            toast.success(translate("发货成功！订单状态已更新为已发货", "Shipment successful! Order status updated to shipped"));
      utils.packing.list.invalidate();
      utils.packing.detail.invalidate({ orderId });
      utils.shipping.packages.invalidate({ orderId });
    },
    onError: (err) => toast.error(translate(`发货失败: ${err.message}`, `Shipment failed: ${err.message}`)),
  });

  const partialShipMutation = trpc.shipping.partialShip.useMutation({
    onSuccess: (data: any) => {
      if (data.allShipped) {
                toast.success(translate("部分发货成功！所有商品已全部发出，订单状态更新为已发货", "Partial shipment successful! All items have been sent, order status updated to shipped"));
      } else {
                toast.success(translate("部分发货成功！订单状态更新为部分发货", "Partial shipment successful! Order status updated to partial shipped"));
      }
      utils.packing.list.invalidate();
      utils.packing.detail.invalidate({ orderId });
      utils.shipping.packages.invalidate({ orderId });
      setSelectedItems([]);
    },
    onError: (err) => toast.error(translate(`发货失败: ${err.message}`, `Shipment failed: ${err.message}`)),
  });

  const handleShip = (mode: "full" | "partial") => {
    // Check for Parcel King packages
    const hasParcelKing = packages.some((p) => p.shippingType === "parcelking");
    if (hasParcelKing) {
      const pkPkg = packages.find((p) => p.shippingType === "parcelking")!;
      if (!pkPkg.serviceId) {
                toast.error(translate("请选择 Parcel King 服务", "Please select Parcel King service"));
        return;
      }
      if (!pkPkg.weight || parseFloat(pkPkg.weight) <= 0) {
                toast.error(translate("请输入包裹重量", "Please enter package weight"));
        return;
      }
      createParcelKingMutation.mutate({
        orderId,
        serviceId: parseInt(pkPkg.serviceId),
        weightKg: parseFloat(pkPkg.weight),
        isPartial: mode === "partial",
        itemIds: mode === "partial" ? selectedItems : undefined,
      });
      return;
    }

    if (mode === "full") {
      if (packages.length === 0) {
                toast.error(translate("请至少添加一个包裹", "Please add at least one package"));
        return;
      }
      const hasEmptyTracking = packages.some((p) => !p.trackingNumber && p.shippingType === "manual");
      if (hasEmptyTracking) {
                toast.error(translate("手动物流必须填写 Tracking Number", "Manual logistics must have a Tracking Number"));
        return;
      }
      fullShipMutation.mutate({
        orderId,
        packages: packages.map((p) => ({
          courier: p.courier,
          shippingType: p.shippingType as "auto" | "manual",
          trackingNumber: p.trackingNumber || undefined,
          weight: p.weight || undefined,
        })),
      });
    } else {
      if (selectedItems.length === 0) {
                toast.error(translate("请选择本次发出的商品", "Please select items for this shipment"));
        return;
      }
      if (packages.length === 0) {
                toast.error(translate("请至少添加一个包裹", "Please add at least one package"));
        return;
      }
      const pkg = packages[0];
      if (!pkg.trackingNumber && pkg.shippingType === "manual") {
                toast.error(translate("手动物流必须填写 Tracking Number", "Manual logistics must have a Tracking Number"));
        return;
      }
      partialShipMutation.mutate({
        orderId,
        itemIds: selectedItems,
        packageData: {
          courier: pkg.courier,
          shippingType: pkg.shippingType as "auto" | "manual",
          trackingNumber: pkg.trackingNumber || undefined,
          weight: pkg.weight || undefined,
        },
      });
    }
  };

  const toggleItem = (itemId: number) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const addPackage = () => {
    setPackages((prev) => [...prev, { courier: "Parcel Daily", shippingType: "manual", trackingNumber: "", weight: "1", serviceId: "" }]);
  };

  const removePackage = (index: number) => {
    setPackages((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePackage = (index: number, field: string, value: string) => {
    setPackages((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
        return <div className="text-center py-12 text-muted-foreground">{translate("加载中...", "Loading...")}</div>;
  }

  if (!detail) {
        return <div className="text-center py-12 text-muted-foreground">{translate("订单不存在", "Order not found")}</div>;
  }

  const d = detail as any;
  const specialLabel = d.shippingMethod === "lalamove" ? "LALAMOVE" :
    d.shippingMethod === "east_malaysia_shopee" ? translate("东马 SHOPEE", "East Malaysia SHOPEE") :
    d.shippingMethod === "east_malaysia_poslaju" ? translate("东马 POSLAJU", "East Malaysia POSLAJU") : "";
  const canShip = d.physicalStatus === "packing" || d.physicalStatus === "partial_shipped";
  const activeShippingMode = d.physicalStatus === "partial_shipped" ? "partial" : shippingMode;
  const shippedItemIds = new Set(
    ((existingPackages || []) as any[]).flatMap((pkg) =>
      ((pkg.items || []) as any[]).map((item) => Number(item.orderItemId))
    )
  );
  const shippableItems = (d.items as any[]).filter((item) => !shippedItemIds.has(Number(item.id)));

  return (
    <div className="space-y-6">
      {/* Header - not printable */}
      <div className="flex items-center justify-between print-hide">
        <div className="flex items-center gap-4">
          <Link href="/packing">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />{translate("返回", "Back")}</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{d.orderNumber}</h1>
            {specialLabel && <Badge variant="destructive" className="mt-1">{specialLabel}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />{translate("A5 包货单", "A5 Packing Slip")}</Button>
        </div>
      </div>

      {/* Customer Info */}
      <Card className="print-hide">
        <CardHeader><CardTitle className="text-base">{translate("客户信息", "Customer Information")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" />{d.customerName}</div>
          <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{d.customerPhone}</div>
          <div className="flex items-start gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />{d.shippingAddress}</div>
        </CardContent>
      </Card>

      {/* Product Items - Color display for packing */}
      <Card className="print-hide">
        <CardHeader><CardTitle className="text-base">{translate("商品列表（彩色照片）", "Product List (Color Photos)")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {(d.items as any[]).map((item) => (
              <div key={item.id} className="flex gap-4 items-start border rounded-lg p-3">
                {/* Product Image */}
                <div className="w-24 h-24 rounded-lg overflow-hidden border flex-shrink-0 bg-muted">
                  {item.coverImageUrl ? (
                    <img src={item.coverImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">{translate("无图", "No Image")}</div>
                  )}
                </div>
                {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{item.productName}</div>
                    {item.variationName && <div className="text-sm text-muted-foreground">{item.variationName}</div>}
                    {item.productSku && <div className="text-xs text-muted-foreground">{translate("SKU:", "SKU:")} {item.productSku}</div>}
                    {item.keyword && <div className="text-xs text-muted-foreground">{translate("关键词:", "Keyword:")} {item.keyword}</div>}
                  </div>
                {/* Large Quantity */}
                <div className="flex flex-col items-center justify-center">
                  <div className={`text-3xl font-bold ${item.quantity > 1 ? "border-4 border-primary rounded-lg px-3 py-1" : ""}`}>
                    ×{item.quantity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Existing Packages */}
      {existingPackages && (existingPackages as any[]).length > 0 && (
        <Card className="print-hide">
          <CardHeader><CardTitle className="text-base">{translate("已有包裹", "Existing Packages")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(existingPackages as any[]).map((pkg: any) => (
              <div key={pkg.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">{translate("包裹", "Package")} {pkg.packageNumber} - {pkg.courier}</div>
                    <div className="text-xs text-muted-foreground">{translate("追踪号:", "Tracking:")} {pkg.trackingNumber || translate("未填写", "Not filled")}</div>
                    {pkg.weight && <div className="text-xs text-muted-foreground">{translate("重量", "Weight")}: {pkg.weight} kg</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Download label button for Parcel King packages */}
                  {pkg.providerOrderId && pkg.trackingNumber && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => redownloadLabelMutation.mutate({ trackingNo: pkg.trackingNumber })}
                        disabled={redownloadLabelMutation.isPending}
                      >
                        <Package className="h-3 w-3 mr-1" />{translate("下载标签", "Download Label")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resyncTrackingMutation.mutate({ trackingNo: pkg.trackingNumber, packageId: pkg.id })}
                        disabled={resyncTrackingMutation.isPending}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />{translate("同步追踪", "Sync Tracking")}
                      </Button>
                    </>
                  )}
                  <Badge variant={pkg.status === "shipped" ? "default" : "secondary"}>{translate(pkg.status, pkg.status)}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* V1.1: Remarks Display (Live + Customer only, not Internal) */}
      {remarks && (remarks as any[]).filter((r: any) => r.type === "live" || r.type === "customer").length > 0 && (
        <Card className="print-hide">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" />{translate("备注", "Remarks")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(remarks as any[]).filter((r: any) => r.type === "live" || r.type === "customer").map((r: any) => (
              <div key={r.id} className="flex items-start gap-2 p-2 border rounded-lg">
                <Badge variant="outline" className={r.type === "live" ? "text-blue-600" : "text-green-600"}>
                  {r.type === "live" ? translate("直播", "Live") : translate("客户", "Customer")}
                </Badge>
                <p className="text-sm">{r.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* V1.1: Repot Display */}
      {repots && (repots as any[]).length > 0 && (
        <Card className="border-blue-300 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 text-blue-700"><Sprout className="h-4 w-4" />{translate("换盆安排", "Repotting Arrangement")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(repots as any[]).map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-2 border border-blue-200 rounded-lg">
                <Sprout className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">{r.productName} → {r.potProductName}</p>
                  <p className="text-xs text-muted-foreground">{translate("数量", "Quantity")}: {r.quantity}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Shipping Section */}
      <Card className="print-hide">
        <CardHeader><CardTitle className="text-base">{translate("发货", "Shipment")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canShip ? <>
          {/* Shipping Mode Toggle */}
          <div className="flex gap-2">
            {d.physicalStatus === "packing" && (
              <Button
                variant={activeShippingMode === "full" ? "default" : "outline"}
                onClick={() => setShippingMode("full")}
                size="sm"
              >
                <Truck className="h-4 w-4 mr-1" />{translate("完整发货", "Full Shipment")}
              </Button>
            )}
            <Button
              variant={activeShippingMode === "partial" ? "default" : "outline"}
              onClick={() => setShippingMode("partial")}
              size="sm"
            >
              <Package className="h-4 w-4 mr-1" />{translate("部分发货", "Partial Shipment")}
            </Button>
          </div>

          {/* Partial: Item Selection */}
          {activeShippingMode === "partial" && (
            <div className="border rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">{translate("请选择本次发出的商品", "Please select items for this shipment")}</div>
              {shippableItems.length > 0 ? shippableItems.map((item) => (
                <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                  <span className="text-sm">{item.productName} {item.variationName && `- ${item.variationName}`} ×{item.quantity}</span>
                </label>
              )) : (
                <p className="text-sm text-muted-foreground">{translate("所有商品均已装入包裹，无待发商品。", "All items have been packed, no items pending shipment.")}</p>
              )}
            </div>
          )}

          {/* Package List */}
          <div className="space-y-3">
            {packages.map((pkg, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{translate("包裹", "Package")} {index + 1}</span>
                  {packages.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removePackage(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{translate("快递公司", "Courier")}</Label>
                    <Select value={pkg.courier} onValueChange={(v) => updatePackage(index, "courier", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COURIERS.map((c) => <SelectItem key={c.zh} value={c.zh}>{translate(c.zh, c.en)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{translate("物流类型", "Shipping Type")}</Label>
                    <Select value={pkg.shippingType} onValueChange={(v) => updatePackage(index, "shippingType", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">{translate("手动填写 Tracking", "Manual Tracking Entry")}</SelectItem>
                        <SelectItem value="auto">{translate("自动获取 (ParcelDaily)", "Auto Fetch (ParcelDaily)")}</SelectItem>
                        <SelectItem value="parcelking">{translate("Parcel King 自动发货", "Parcel King Auto Shipment")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {pkg.shippingType === "parcelking" ? (
                    <div className="col-span-2 space-y-3">
                      <div>
                        <Label className="text-xs">{translate("Parcel King 服务", "Parcel King Service")}</Label>
                        <Select value={pkg.serviceId} onValueChange={(v) => updatePackage(index, "serviceId", v)}>
                          <SelectTrigger><SelectValue placeholder={translate("选择服务", "Select Service")} /></SelectTrigger>
                          <SelectContent>
                            {(parcelKingServicesQuery.data as any)?.success && (parcelKingServicesQuery.data as any).services?.map((svc: any) => (
                              <SelectItem key={svc.service_id} value={String(svc.service_id)}>
                                {svc.service_name} {svc.estimated_days ? `(~${svc.estimated_days})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">{translate("重量 (kg)", "Weight (kg)")}</Label>
                          <Input
                            value={pkg.weight}
                            onChange={(e) => updatePackage(index, "weight", e.target.value)}
                            placeholder="1"
                            type="number"
                          />
                        </div>
                        <div className="flex items-end">
                          <p className="text-xs text-muted-foreground">{translate("追踪号将在提交后自动获取", "Tracking number will be automatically generated after submission")}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label className="text-xs">{translate("追踪号", "Tracking Number")}</Label>
                        <Input
                          value={pkg.trackingNumber}
                          onChange={(e) => updatePackage(index, "trackingNumber", e.target.value)}
                          placeholder={translate("输入追踪号", "Enter tracking number")}
                          disabled={pkg.shippingType === "auto"}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{translate("重量 (kg)", "Weight (kg)")}</Label>
                        <Input
                          value={pkg.weight}
                          onChange={(e) => updatePackage(index, "weight", e.target.value)}
                          placeholder="1"
                          type="number"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addPackage}>
              <Plus className="h-4 w-4 mr-1" />{translate("新增包裹", "Add Package")}
            </Button>
          </div>

            <Button
              onClick={() => handleShip(activeShippingMode)}
              disabled={fullShipMutation.isPending || partialShipMutation.isPending || createParcelKingMutation.isPending}
              className="w-full"
            >
              <Ship className="h-4 w-4 mr-2" />
              {activeShippingMode === "full" ? translate("确认完整发货", "Confirm Full Shipment") : translate("确认部分发货", "Confirm Partial Shipment")}
            </Button>
          </> : <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
            {translate("此订单当前状态为", "This order's current status is")} “{d.physicalStatus === "shipped" ? translate("已发货", "Shipped") : d.physicalStatus === "completed" ? translate("已完成", "Completed") : translate("已取消", "Cancelled")}”，{translate("不可再次创建包裹或发货。", "cannot create packages or ship again.")}
          </div>}
        </CardContent>
      </Card>

      {/* A5 Packing Slip - Print Only */}
      {slipData && (
        <div className="print-only hidden">
          <A5PackingSlip data={slipData as any} translate={translate} lang={lang} />
        </div>
      )}
    </div>
  );
}

// A5 Packing Slip Component (print only)
function A5PackingSlip({ data, translate, lang }: { data: any; translate: (zh: string, en: string, params?: Record<string, string | number>) => string; lang: "zh" | "en" }) {
  return (
    <div className="a5-slip" style={{ width: "148mm", padding: "10mm", fontFamily: "sans-serif", fontSize: "12px", color: "#000" }}>
      {/* Header - Special Label */}
      {data.specialLabel && (
        <div style={{ textAlign: "center", fontSize: "28px", fontWeight: "bold", marginBottom: "8px", border: "2px solid #000", padding: "4px" }}>
          {data.specialLabel}
        </div>
      )}

      {/* Customer Info */}
      <div style={{ marginBottom: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{translate("订单编号:", "Order No:")} <strong>{data.orderNumber}</strong></span>
        </div>
        <div>{translate("客户姓名:", "Customer Name:")} <strong>{data.customerName}</strong></div>
        <div>{translate("电话号码:", "Phone No:")} <strong>{data.customerPhone}</strong></div>
        {data.paymentConfirmedAt && (
          <div>{translate("汇款日期:", "Payment Date:")} {new Date(data.paymentConfirmedAt).toLocaleDateString()}</div>
        )}
        <div>{translate("地址:", "Address:")} {data.shippingAddress}</div>
      </div>

      <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />

      {/* Items */}
      <div style={{ marginBottom: "8px" }}>
        {data.items.map((item: any, i: number) => (
          <div key={i} style={{ marginBottom: "6px", paddingBottom: "4px", borderBottom: "1px dashed #ccc" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "16px" }}>☐</span>
              <span><strong>{item.productName}</strong></span>
              {item.variationName && <span style={{ fontSize: "11px" }}>({item.variationName})</span>}
            </div>
            <div style={{ marginLeft: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px" }}>{item.productSku || ""}</span>
              <span style={{
                fontSize: "24px",
                fontWeight: "bold",
                border: item.quantity > 1 ? "3px solid #000" : "none",
                padding: item.quantity > 1 ? "2px 8px" : "0",
                borderRadius: "4px",
              }}>
                【 ×{item.quantity} 】
              </span>
            </div>
          </div>
        ))}

        {/* Gift Items */}
        {data.giftItems && data.giftItems.length > 0 && (
          <>
            <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />
            {data.giftItems.map((gift: any, i: number) => (
              <div key={i} style={{ marginBottom: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "16px" }}>☐</span>
                  <span><strong>{translate("赠品", "Gift")}</strong> {gift.productName}</span>
                </div>
                <div style={{ marginLeft: "20px", display: "flex", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "20px", fontWeight: "bold", border: "2px solid #000", padding: "1px 6px", borderRadius: "3px" }}>
                    【 ×{gift.quantity} 】
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* V1.1: Customer Remarks on A5 Slip */}
      {data.customerRemarks && data.customerRemarks.length > 0 && (
        <div style={{ marginBottom: "8px" }}>
          <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "2px" }}>{translate("客户备注:", "Customer Remarks:")}</div>
          {data.customerRemarks.map((r: any, i: number) => (
            <div key={i} style={{ fontSize: "11px", marginLeft: "8px" }}>• {r.content}</div>
          ))}
        </div>
      )}

      {/* V1.1: Repot on A5 Slip */}
      {data.repots && data.repots.length > 0 && (
        <div style={{ marginBottom: "8px", border: "2px solid #000", padding: "4px" }}>
          <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "2px" }}>⚠ {translate("换盆安排:", "Repotting Arrangement:")}</div>
          {data.repots.map((r: any, i: number) => (
            <div key={i} style={{ fontSize: "11px", marginLeft: "8px" }}>
              • {r.productName} → {r.potProductName} (×{r.quantity})
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />

      {/* Summary */}
      <div style={{ fontSize: "11px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{translate("商品种类:", "Item Types:")} {data.summary.itemTypes}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{translate("普通商品:", "Regular Items:")}</span><span>RM {data.summary.regularTotal}</span>
        </div>
        {parseFloat(data.summary.discountTotal) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{translate("特价商品:", "Discounted Items:")} <span style={{ fontSize: "10px" }}>({translate("共", "Total")} {data.summary.discountCount}{translate("件", " items")})</span></span>
            <span>RM {data.summary.discountTotal}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{translate("运费:", "Shipping Fee:")}</span><span>RM {data.summary.shippingFee}</span>
        </div>
        {parseFloat(data.summary.discountAmount) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{translate("折扣:", "Discount:")}</span><span>-RM {data.summary.discountAmount}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{translate("已付款:", "Paid:")}</span><span>RM {data.summary.paidAmount}</span>
        </div>
        {parseFloat(data.summary.balance) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{translate("尚欠:", "Balance Due:")}</span><span style={{ fontWeight: "bold" }}>RM {data.summary.balance}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #000", marginTop: "2px", paddingTop: "2px" }}>
          <span><strong>{translate("订单总额:", "Total Order:")}</strong></span><span><strong>RM {data.summary.totalAmount}</strong></span>
        </div>
      </div>
    </div>
  );
}
