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
import { ArrowLeft, Printer, Truck, Package, Plus, X, MapPin, Phone, User, Ship, CheckCircle2, Sprout, MessageSquare, RefreshCw, AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { ITEM_SOURCE_LABELS } from "@shared/const";

// V2.1.30: Only show Parcel Daily services (Poslaju for east Malaysia, Line Clear for west Malaysia)
const COURIERS = [
  { zh: "Poslaju", en: "Poslaju" },
  { zh: "Line Clear", en: "Line Clear" },
];

// V2.1.30: Auto-set courier based on order shipping method
function getAutoCourier(shippingMethod: string): string {
  if (shippingMethod === "east_malaysia_poslaju") return "Poslaju";
  if (shippingMethod === "west_malaysia") return "Line Clear";
  if (shippingMethod === "lalamove") return "Lalamove";
  if (shippingMethod === "east_malaysia_shopee") return "Shopee Xpress";
  return "Line Clear";
}

// V2.1.30: Check if shipping method has fixed courier (no user selection needed)
function isFixedCourier(shippingMethod: string): boolean {
  return shippingMethod === "lalamove" || shippingMethod === "east_malaysia_shopee";
}

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
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [exceptionType, setExceptionType] = useState<"out_of_stock" | "quality_issue" | "overcharged_shipping" | "other">("quality_issue");
  const [exceptionDesc, setExceptionDesc] = useState("");
  const [resolutionType, setResolutionType] = useState<"replace" | "wait_restock" | "refund">("replace");
  const [exceptionItemId, setExceptionItemId] = useState<number | "">("");
  const [replacementProductId, setReplacementProductId] = useState<number | "">("");
  const [replacementQty, setReplacementQty] = useState(1);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  // V2.1.26补充4: Per-item ship quantity for partial shipping (Issue 7)
  const [shipQuantities, setShipQuantities] = useState<Record<number, number>>({});
  // V2.1.26补充4: New state for enhanced exception handling (Issue 6)
  const [exceptionQuantity, setExceptionQuantity] = useState<number>(1);
  const [customerAction, setCustomerAction] = useState<"replace_product" | "wait_restock" | "refund" | "pending">("pending");
  const [refundMethod, setRefundMethod] = useState<"credit" | "tng" | "cash">("credit");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [replacementUnitPrice, setReplacementUnitPrice] = useState<number>(0);
  const [replacementProductName, setReplacementProductName] = useState("");
  const [packages, setPackages] = useState<Array<{
    courier: string;
    shippingType: "auto" | "manual" | "parcelking";
    trackingNumber: string;
    weight: string;
    serviceId: string;
  }>>([{ courier: "Line Clear", shippingType: "manual", trackingNumber: "", weight: "1", serviceId: "" }]);
  const [actualWeightInput, setActualWeightInput] = useState("");

  const { data: specialActions } = trpc.shippingV2.specialOrderActions.useQuery({ orderId }, { enabled: !!detail });

  // V2.1.30: Auto-set courier based on order shipping method when detail loads
  useEffect(() => {
    if (detail) {
      const shippingMethod = (detail as any).shippingMethod || "west_malaysia";
      const autoCourier = getAutoCourier(shippingMethod);
      setPackages((prev) => prev.map((p) => ({
        ...p,
        courier: autoCourier,
      })));
    }
  }, [detail]);
  const updateWeightMutation = trpc.shippingV2.updateActualWeight.useMutation({
    onSuccess: (data) => {
      if (data.needsSpecialOrder) {
        toast.warning(translate("已记录实际重量，订单需特别处理", "Actual weight recorded, order needs special handling"));
      } else {
        toast.success(translate("实际重量已更新", "Actual weight updated"));
      }
      utils.packing.detail.invalidate({ orderId });
      setActualWeightInput("");
    },
    onError: (err: any) => toast.error(translate("更新失败: ", "Update failed: ") + err.message),
  });
  const specialOrderMutation = trpc.shippingV2.processSpecialOrder.useMutation({
    onSuccess: () => {
      toast.success(translate("特别订单已处理", "Special order processed"));
      utils.packing.detail.invalidate({ orderId });
      utils.shippingV2.specialOrderActions.invalidate({ orderId });
    },
    onError: (err: any) => toast.error(translate("处理失败: ", "Processing failed: ") + err.message),
  });

  const parcelKingServicesQuery = trpc.parcelking.getServices.useQuery(undefined, {
    enabled: !!detail,
  });

  const createParcelKingMutation = trpc.shipping.createParcelKing.useMutation({
    onSuccess: (data: any) => {
            toast.success(translate(
        "Parcel King 运单已创建！追踪号: {trackingNumber}{testSuffix}",
        "Parcel King waybill created. Tracking No: {trackingNumber}{testSuffix}",
        { trackingNumber: data.trackingNumber, testSuffix: data.testMode ? " (Test)" : "" },
      ));
      utils.packing.list.invalidate();
      utils.packing.detail.invalidate({ orderId });
      utils.shipping.packages.invalidate({ orderId });
      setPackages([{ courier: "Line Clear", shippingType: "manual", trackingNumber: "", weight: "1", serviceId: "" }]);
      setSelectedItems([]);
    },
    onError: (err) => toast.error(translate(`Parcel King 发货失败: ${err.message}`, `Parcel King Shipping Failed: ${err.message}`)),
  });

  const createExceptionMutation = trpc.orderException.create.useMutation({
    onSuccess: () => {
      // V2.1.26补充4: Don't close dialog here - the inline onSuccess in save handler decides whether to close
      // This global onSuccess just invalidates queries to refresh data
      utils.packing.detail.invalidate({ orderId });
      utils.orderException.list.invalidate({ orderId });
    },
    onError: (err) => toast.error("创建异常失败: " + err.message),
  });

  // V2.1.26补充6: Delete exception mutation (Issue 2)
  const deleteExceptionMutation = trpc.orderException.delete.useMutation({
    onSuccess: () => {
      toast.success("异常已删除");
      utils.packing.detail.invalidate({ orderId });
      utils.orderException.list.invalidate({ orderId });
      utils.packing.list.invalidate();
    },
    onError: (err) => toast.error("删除失败: " + err.message),
  });

  // V2.1.26补充6: Mark exception as resolved (Issue 8)
  const markResolvedMutation = trpc.orderException.markResolved.useMutation({
    onSuccess: () => {
      toast.success("异常已处理");
      utils.packing.detail.invalidate({ orderId });
      utils.orderException.list.invalidate({ orderId });
      utils.packing.list.invalidate();
    },
    onError: (err) => toast.error("处理失败: " + err.message),
  });

  const resolveExceptionMutation = trpc.orderException.resolve.useMutation({
    onSuccess: () => {
      toast.success("异常已处理");
      setExceptionDialogOpen(false);
      setExceptionDesc("");
      setExceptionItemId("");
      setReplacementProductId("");
      setReplacementQty(1);
      setExceptionQuantity(1);
      setCustomerAction("pending");
      setRefundMethod("credit");
      setProductSearchQuery("");
      setProductSearchResults([]);
      setReplacementUnitPrice(0);
      setReplacementProductName("");
      utils.packing.detail.invalidate({ orderId });
      utils.packing.list.invalidate();
    },
    onError: (err) => toast.error("处理异常失败: " + err.message),
  });

  const { data: exceptions } = trpc.orderException.list.useQuery({ orderId }, { enabled: !!detail });

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
      // V2.1.26补充4: Pass per-item ship quantities (Issue 7)
      const itemQuantities = selectedItems
        .filter((itemId) => shipQuantities[itemId] !== undefined)
        .map((itemId) => ({ itemId: String(itemId), quantity: shipQuantities[itemId] }));
      partialShipMutation.mutate({
        orderId,
        itemIds: selectedItems,
        packageData: {
          courier: pkg.courier,
          shippingType: pkg.shippingType as "auto" | "manual",
          trackingNumber: pkg.trackingNumber || undefined,
          weight: pkg.weight || undefined,
        },
        itemQuantities: itemQuantities.length > 0 ? itemQuantities : undefined,
      });
    }
  };

  const toggleItem = (itemId: number) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // V2.1.26补充4: Update ship quantity for a specific item (Issue 7)
  const updateShipQuantity = (itemId: number, qty: number, maxQty: number) => {
    const clampedQty = Math.max(1, Math.min(qty, maxQty));
    setShipQuantities((prev) => ({ ...prev, [itemId]: clampedQty }));
  };

  const addPackage = () => {
    setPackages((prev) => [...prev, { courier: "Line Clear", shippingType: "manual", trackingNumber: "", weight: "1", serviceId: "" }]);
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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{d.orderNumber}</h1>
              {/* V2.1.26: Move A5 print button next to order number */}
              <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />{translate("A5打印", "A5 Print")}</Button>
            </div>
            {specialLabel && <Badge variant="destructive" className="mt-1">{specialLabel}</Badge>}
          </div>
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
                    <div className="text-xs text-muted-foreground">{translate("来源:", "Source:")} {ITEM_SOURCE_LABELS[item.itemSource] || item.itemSource || "-"}</div>
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
                        <Printer className="h-4 w-4 mr-1" />{translate("下载标签", "Download Label")}
                      </Button>
                    </>
                  )}
                  {/* Resync tracking button for Parcel King packages */}
                  {pkg.providerOrderId && pkg.trackingNumber && pkg.shippingType === "parcelking" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resyncTrackingMutation.mutate({ trackingNo: pkg.trackingNumber, packageId: pkg.id })}
                      disabled={resyncTrackingMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />{translate("同步追踪", "Sync Tracking")}
                    </Button>
                  )}
                  {pkg.status && (
                    <Badge
                      className={`text-xs ${pkg.status === "shipped" ? "bg-green-500" : pkg.status === "pending" ? "bg-yellow-500" : "bg-gray-500"}`}
                    >
                      {pkg.status === "shipped" ? translate("已发货", "Shipped") : pkg.status === "pending" ? translate("待处理", "Pending") : translate("未知", "Unknown")}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Exception Handling - only show for packing/partial_shipped status */}
      {canShip && (
        <Card className="print-hide border-orange-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              {translate("异常处理", "Exception Handling")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing exceptions */}
            {exceptions && (exceptions as any[]).length > 0 && (
              <div className="space-y-2">
                {(exceptions as any[]).map((exc: any) => (
                  <div key={exc.id} className="flex items-center justify-between border rounded-lg p-3 bg-orange-50 dark:bg-orange-950/20">
                    <div className="text-sm flex-1">
                      <Badge variant={exc.status === "resolved" ? "secondary" : "destructive"} className="mr-2">
                        {exc.status === "resolved" ? translate("已处理", "Resolved") : translate("待处理", "Open")}
                      </Badge>
                      {exc.exceptionType === "out_of_stock" ? translate("商品缺货", "Out of Stock") :
                       exc.exceptionType === "quality_issue" ? translate("植物品质异常", "Quality Issue") :
                       exc.exceptionType === "overcharged_shipping" ? translate("运费多收", "Overcharged Shipping") :
                       translate("其他异常", "Other")}
                      {exc.quantity > 0 && <span className="text-muted-foreground ml-2">×{exc.quantity}</span>}
                      {exc.customerAction && exc.customerAction !== "pending" && (
                        <span className="text-muted-foreground ml-2">—
                          {exc.customerAction === "replace_product" ? translate("更换商品", "Replace Product") :
                           exc.customerAction === "wait_restock" ? translate("等待补货", "Wait Restock") :
                           exc.customerAction === "refund" ? translate("退款", "Refund") : ""}
                        </span>
                      )}
                      {exc.description && <span className="text-muted-foreground ml-2">— {exc.description}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      {exc.status !== "resolved" && (
                        <>
                          {/* V2.1.26补充6: Mark as resolved button (Issue 8) */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-300 text-green-600 hover:bg-green-50"
                            onClick={() => markResolvedMutation.mutate({ exceptionId: exc.id })}
                            disabled={markResolvedMutation.isPending}
                          >
                            {translate("已处理", "Resolved")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setExceptionType(exc.exceptionType);
                              setExceptionDesc(exc.description || "");
                              setExceptionItemId(exc.orderItemId ? Number(exc.orderItemId) : "");
                              setExceptionQuantity(exc.quantity || 1);
                              setCustomerAction(exc.customerAction || "pending");
                              setExceptionDialogOpen(true);
                            }}
                          >
                            {translate("修改", "Edit")}
                          </Button>
                        </>
                      )}
                      {/* V2.1.26补充6: Delete button (Issue 2) */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("确定删除此异常记录?")) {
                            deleteExceptionMutation.mutate({ exceptionId: exc.id });
                          }
                        }}
                        disabled={deleteExceptionMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Dialog open={exceptionDialogOpen} onOpenChange={setExceptionDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-orange-300 text-orange-600">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {translate("新增异常处理", "New Exception")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{translate("异常处理", "Exception Handling")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Step 1: Exception Type */}
                  <div className="space-y-2">
                    <Label>{translate("异常类型", "Exception Type")}</Label>
                    <Select value={exceptionType} onValueChange={(v: any) => { setExceptionType(v); setCustomerAction("pending"); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="out_of_stock">{translate("商品缺货", "Out of Stock")}</SelectItem>
                        <SelectItem value="quality_issue">{translate("植物品质异常", "Quality Issue")}</SelectItem>
                        <SelectItem value="overcharged_shipping">{translate("运费多收", "Overcharged Shipping")}</SelectItem>
                        <SelectItem value="other">{translate("其他异常", "Other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* V2.1.26补充6: Step 2: Select affected item - hidden for overcharged_shipping (Issue 9) */}
                  {exceptionType !== "overcharged_shipping" && (
                  <div className="space-y-2">
                    <Label>{translate("涉及商品", "Affected Item")}</Label>
                    <Select value={String(exceptionItemId)} onValueChange={(v) => { setExceptionItemId(Number(v)); const item = (d.items as any[]).find((it: any) => it.id === Number(v)); if (item) setExceptionQuantity(item.quantity); }}>
                      <SelectTrigger><SelectValue placeholder={translate("选择商品", "Select item")} /></SelectTrigger>
                      <SelectContent>
                        {(d.items as any[]).map((item: any) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.productName} {item.variationName && `(${item.variationName})`} ×{item.quantity}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}

                  {/* V2.1.26补充6: Refund amount input for overcharged_shipping (Issue 9) */}
                  {exceptionType === "overcharged_shipping" && (
                    <div className="space-y-2 border rounded-lg p-3 bg-orange-50 dark:bg-orange-950/20">
                      <Label>{translate("退款金额 (RM)", "Refund Amount (RM)")}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={exceptionQuantity}
                        onChange={(e) => setExceptionQuantity(Math.max(0, Number(e.target.value)))}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-muted-foreground">{translate("输入需退给客户的运费差额", "Enter shipping overcharge to refund")}</p>
                    </div>
                  )}

                  {/* V2.1.26补充4: Step 2b: Quantity input (Issue 6a/6c/6e) - show for out_of_stock, quality_issue, other */}
                  {exceptionType !== "overcharged_shipping" && exceptionItemId !== "" && (
                    <div className="space-y-2">
                      <Label>{translate("异常数量", "Affected Quantity")}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={(d.items as any[]).find((it: any) => it.id === exceptionItemId)?.quantity || 1}
                        value={exceptionQuantity}
                        onChange={(e) => setExceptionQuantity(Math.max(1, Math.min(Number(e.target.value), (d.items as any[]).find((it: any) => it.id === exceptionItemId)?.quantity || 1)))}
                      />
                      <p className="text-xs text-muted-foreground">{translate("填写受影响的数量", "Enter the affected quantity")}</p>
                    </div>
                  )}

                  {/* Step 3: Description */}
                  <div className="space-y-2">
                    <Label>{translate("异常描述", "Description")}</Label>
                    <Input
                      value={exceptionDesc}
                      onChange={(e) => setExceptionDesc(e.target.value)}
                      placeholder={translate("描述异常情况...", "Describe the issue...")}
                    />
                  </div>

                  {/* V2.1.26补充4: Step 4: Customer Action (Issue 6b/6f) - show for out_of_stock, quality_issue, other */}
                  {exceptionType !== "overcharged_shipping" && (
                    <div className="space-y-2">
                      <Label>{translate("客户处理方式", "Customer Action")}</Label>
                      <Select value={customerAction} onValueChange={(v: any) => setCustomerAction(v)}>
                        <SelectTrigger><SelectValue placeholder={translate("选择处理方式", "Select action")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="replace_product">{translate("更换商品", "Replace Product")}</SelectItem>
                          <SelectItem value="wait_restock">{translate("等待补货", "Wait for Restock")}</SelectItem>
                          <SelectItem value="refund">{translate("退款", "Refund")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* V2.1.26补充4: Step 5: Product Search for replacement (Issue 6g) */}
                  {customerAction === "replace_product" && (
                    <div className="space-y-2 border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20">
                      <Label>{translate("搜索更换商品", "Search Replacement Product")}</Label>
                      <Input
                        value={productSearchQuery}
                        onChange={(e) => {
                          setProductSearchQuery(e.target.value);
                          if (e.target.value.length >= 2) {
                            utils.products.list.fetch({ search: e.target.value }).then((res: any) => setProductSearchResults((res || []).slice(0, 10)));
                          } else {
                            setProductSearchResults([]);
                          }
                        }}
                        placeholder={translate("输入商品名称或关键词...", "Enter product name or keyword...")}
                      />
                      {productSearchResults.length > 0 && (
                        <div className="max-h-40 overflow-y-auto border rounded-md">
                          {productSearchResults.map((p: any) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between p-2 hover:bg-accent cursor-pointer border-b last:border-0"
                              onClick={() => {
                                setReplacementProductId(p.id);
                                setReplacementProductName(p.name);
                                setReplacementUnitPrice(Number(p.sellingPrice || p.price) || 0);
                                setProductSearchQuery(p.name);
                                setProductSearchResults([]);
                              }}
                            >
                              <div>
                                <div className="font-medium text-sm">{p.name}</div>
                                <div className="text-xs text-muted-foreground">RM {Number(p.sellingPrice || p.price || 0).toFixed(2)} {p.stock !== undefined && `| ${translate("库存", "Stock")}: ${p.stock}`}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {replacementProductId !== "" && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">{translate("已选:", "Selected:")} {replacementProductName}</Badge>
                          <span className="text-xs">RM {replacementUnitPrice.toFixed(2)}</span>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs">{translate("数量:", "Qty:")}</Label>
                            <Input
                              type="number"
                              min={1}
                              value={replacementQty}
                              onChange={(e) => setReplacementQty(Math.max(1, Number(e.target.value)))}
                              className="w-16 h-8"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* V2.1.26补充4: Step 6: Refund Method (Issue 6j) */}
                  {customerAction === "refund" && (
                    <div className="space-y-2 border rounded-lg p-3 bg-orange-50 dark:bg-orange-950/20">
                      <Label>{translate("退款方式", "Refund Method")}</Label>
                      <Select value={refundMethod} onValueChange={(v: any) => setRefundMethod(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="credit">{translate("退款到Credit", "Refund to Credit")}</SelectItem>
                          <SelectItem value="tng">{translate("退款TNG", "Refund to TNG")}</SelectItem>
                          <SelectItem value="cash">{translate("退款Cash", "Refund to Cash")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setExceptionDialogOpen(false)}>
                      {translate("取消", "Cancel")}
                    </Button>
                    <Button
                      onClick={() => {
                        const actionMap: Record<string, string> = { replace_product: "replace", wait_restock: "wait_restock", refund: "refund" };
                        const needsResolve = customerAction !== "pending" && customerAction !== "wait_restock";
                        if (needsResolve) {
                          // For replace/refund, create + resolve in one step
                          createExceptionMutation.mutate({
                            orderId,
                            orderItemId: exceptionItemId || undefined,
                            exceptionType,
                            description: exceptionDesc,
                            quantity: exceptionQuantity,
                            customerAction,
                          }, {
                            onSuccess: (created: any) => {
                              toast.success("异常已记录");
                              const selectedItem = (d.items as any[]).find((it: any) => it.id === exceptionItemId);
                              resolveExceptionMutation.mutate({
                                exceptionId: created.id,
                                resolutionType: actionMap[customerAction] as any,
                                orderId,
                                quantity: exceptionQuantity,
                                customerAction,
                                replacementProductId: customerAction === "replace_product" && replacementProductId !== "" ? Number(replacementProductId) : undefined,
                                replacementProductName: customerAction === "replace_product" ? replacementProductName : undefined,
                                replacementQuantity: customerAction === "replace_product" ? replacementQty : undefined,
                                replacementUnitPrice: customerAction === "replace_product" ? replacementUnitPrice : undefined,
                                refundMethod: customerAction === "refund" ? refundMethod : undefined,
                                scrapItems: exceptionType === "quality_issue" && exceptionItemId ? (d.items as any[])
                                  .filter((it: any) => it.id === exceptionItemId)
                                  .map((it: any) => ({
                                    orderItemId: it.id,
                                    productId: it.productId,
                                    productName: it.productName,
                                    quantity: exceptionQuantity,
                                    unitCost: Number(it.unitPrice) || 0,
                                  })) : [],
                                replacementItems: customerAction === "replace_product" && replacementProductId !== "" ? [{
                                  productId: Number(replacementProductId),
                                  productName: replacementProductName,
                                  quantity: replacementQty,
                                  unitPrice: replacementUnitPrice,
                                  subtotal: replacementUnitPrice * replacementQty,
                                }] : undefined,
                              });
                            },
                          });
                        } else {
                          // For wait_restock or pending, just create the exception
                          createExceptionMutation.mutate({
                            orderId,
                            orderItemId: exceptionItemId || undefined,
                            exceptionType,
                            description: exceptionDesc,
                            quantity: exceptionQuantity,
                            customerAction,
                          }, {
                            onSuccess: () => {
                              toast.success("异常已记录");
                              setExceptionDialogOpen(false);
                              setExceptionDesc("");
                              setExceptionItemId("");
                              setExceptionQuantity(1);
                              setCustomerAction("pending");
                              setRefundMethod("credit");
                              setProductSearchQuery("");
                              setProductSearchResults([]);
                              setReplacementProductId("");
                              setReplacementQty(1);
                              setReplacementUnitPrice(0);
                              setReplacementProductName("");
                            },
                          });
                        }
                      }}
                      disabled={createExceptionMutation.isPending || resolveExceptionMutation.isPending}
                    >
                      {translate("确认", "Confirm")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Actual Weight & Shipping Difference - only for packing status */}
      {canShip && (
        <Card className="print-hide border-blue-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              {translate("实际重量与运费", "Actual Weight & Shipping")}
              {/* V2.1.26补充6: Show 免邮 badge — west_malaysia & lalamove only (Issue 6 sync with Packing.tsx) */}
              {detail && (detail.shippingMethod === "west_malaysia" || detail.shippingMethod === "lalamove") && Number((detail as any).physicalSubtotal || 0) >= 150 && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">{translate("免邮", "Free Shipping")}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Estimated weight display */}
            {detail && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{translate("预估重量", "Estimated Weight")}: </span>
                  <span className="font-medium">{Number(detail.estimatedWeight || detail.totalWeight || 0).toFixed(2)} kg</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{translate("客户已付运费", "Customer Paid Shipping")}: </span>
                  <span className="font-medium">RM {Number(detail.customerPaidShipping || detail.shippingFee || 0).toFixed(2)}</span>
                </div>
                {/* V2.1.26: Show 商品金额 and 免邮 status */}
                <div>
                  <span className="text-muted-foreground">{translate("商品金额", "Subtotal")}: </span>
                  <span className="font-medium">RM {Number((detail as any).physicalSubtotal || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{translate("免邮状态", "Free Shipping")}: </span>
                  <span className="font-medium">{(detail.shippingMethod === "west_malaysia" || detail.shippingMethod === "lalamove") ? (Number((detail as any).physicalSubtotal || 0) >= 150 ? translate("是（满RM150免邮）", "Yes (Free shipping over RM150)") : translate("否（未满RM150）", "No (Under RM150)")) : translate("不适用", "N/A")}</span>
                </div>
              </div>
            )}

            {/* Actual weight / Lalamove fee input */}
            {detail && !detail.actualWeight && (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label>
                    {d.shippingMethod === "lalamove"
                      ? translate("Lalamove 实际配送费用 (RM)", "Lalamove Actual Delivery Fee (RM)")
                      : translate("实际重量 (kg)", "Actual Weight (kg)")}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={actualWeightInput}
                    onChange={(e) => setActualWeightInput(e.target.value)}
                  />
                  {d.shippingMethod === "lalamove" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {translate("公司承担 RM15 + 客户已付 RM" + (Number(d.customerPaidShipping || d.shippingFee || 0)).toFixed(0), "Company bears RM15 + Customer paid RM" + (Number(d.customerPaidShipping || d.shippingFee || 0)).toFixed(0))}
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => {
                    const w = parseFloat(actualWeightInput);
                    if (!w || w <= 0) {
                      toast.error(translate("请输入有效数值", "Please enter a valid value"));
                      return;
                    }
                    updateWeightMutation.mutate({ orderId, actualWeight: w });
                  }}
                  disabled={updateWeightMutation.isPending || !actualWeightInput}
                >
                  {translate("确认", "Confirm")}
                </Button>
              </div>
            )}

            {/* Actual weight result */}
            {detail?.actualWeight && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20">
                  <div>
                    <span className="text-muted-foreground block">{d.shippingMethod === "lalamove" ? translate("Lalamove 费用", "Lalamove Fee") : translate("实际重量", "Actual Weight")}</span>
                    <span className="font-medium">{d.shippingMethod === "lalamove" ? `RM ${Number(detail.actualWeight).toFixed(2)}` : `${Number(detail.actualWeight).toFixed(2)} kg`}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{translate("实际运费", "Actual Shipping")}</span>
                    <span className="font-medium">RM {Number(detail.actualShippingFee || 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{translate("差额", "Difference")}</span>
                    <span className={`font-medium ${Number(detail.shippingDifference || 0) > 0 ? "text-red-600" : Number(detail.shippingDifference || 0) < 0 ? "text-green-600" : ""}`}>
                      RM {Number(detail.shippingDifference || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Special order handling */}
                {detail.isSpecialOrder && detail.specialOrderStatus === "pending" && (
                  <div className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-950/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium text-sm">
                        {detail.specialOrderType === "pending_shipping"
                          ? translate("等待补运费", "Pending Additional Shipping Fee")
                          : detail.specialOrderType === "pending_refund"
                          ? translate("等待退款", "Pending Refund")
                          : translate("特别订单", "Special Order")}
                      </span>
                      <Badge variant="destructive">RM {Math.abs(Number(detail.shippingDifference || 0)).toFixed(2)}</Badge>
                    </div>

                    {/* Special order action buttons */}
                    <div className="flex flex-wrap gap-2">
                      {detail.specialOrderType === "pending_shipping" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              specialOrderMutation.mutate({
                                orderId,
                                actionType: "notify_shortage",
                                amount: Math.abs(Number(detail.shippingDifference || 0)),
                                remark: translate("已通知客户补运费", "Customer notified for additional shipping fee"),
                              });
                            }}
                            disabled={specialOrderMutation.isPending}
                          >
                            {translate("通知补运费", "Notify Additional Shipping")}
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              specialOrderMutation.mutate({
                                orderId,
                                actionType: "confirm_received",
                                amount: Math.abs(Number(detail.shippingDifference || 0)),
                                remark: translate("已收到补运费", "Additional shipping fee received"),
                              });
                            }}
                            disabled={specialOrderMutation.isPending}
                          >
                            {translate("确认收到", "Confirm Received")}
                          </Button>
                        </>
                      )}
                      {detail.specialOrderType === "pending_refund" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            specialOrderMutation.mutate({
                              orderId,
                              actionType: "refund",
                              amount: Math.abs(Number(detail.shippingDifference || 0)),
                              remark: translate("退款已完成", "Refund completed"),
                            });
                          }}
                          disabled={specialOrderMutation.isPending}
                        >
                          {translate("退款", "Refund")}
                        </Button>
                      )}
                      {detail.specialOrderType === "pending_refund" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            specialOrderMutation.mutate({
                              orderId,
                              actionType: "convert_to_credit",
                              amount: Math.abs(Number(detail.shippingDifference || 0)),
                              remark: translate("运费差额转为客户 Credit", "Convert shipping difference to customer Credit"),
                            });
                          }}
                          disabled={specialOrderMutation.isPending}
                        >
                          {translate("转 Credit", "Convert to Credit")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          specialOrderMutation.mutate({
                            orderId,
                            actionType: "company_bear",
                            amount: Math.abs(Number(detail.shippingDifference || 0)),
                            remark: translate("公司承担", "Company bears the cost"),
                          });
                        }}
                        disabled={specialOrderMutation.isPending}
                      >
                        {translate("公司承担", "Company Bear")}
                      </Button>
                    </div>

                    {/* Special order actions history */}
                    {specialActions && (specialActions as any[]).length > 0 && (
                      <div className="space-y-1 mt-2">
                        {(specialActions as any[]).map((action: any) => (
                          <div key={action.id} className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{new Date(action.createdAt).toLocaleString()}</span>
                            <span>{action.performedBy}</span>
                            <Badge variant="secondary" className="text-xs">
                              {action.actionType === "notify_shortage" ? translate("通知补运费", "Notify") :
                               action.actionType === "confirm_received" ? translate("确认收到", "Confirmed") :
                               action.actionType === "refund" ? translate("退款", "Refund") :
                               action.actionType === "company_bear" ? translate("公司承担", "Company Bear") :
                               translate("备注", "Remark")}
                            </Badge>
                            {action.remark && <span>— {action.remark}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Resolved special order */}
                {detail.isSpecialOrder && detail.specialOrderStatus === "resolved" && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {translate("特别订单已处理", "Special order resolved")}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shipping Actions */}
      <Card className="print-hide">
        <CardHeader>
          <CardTitle className="text-base">{translate("发货操作", "Shipping Actions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canShip ? <>
            <div className="flex items-center space-x-4">
              <Label htmlFor="shipping-mode" className="text-right">{translate("发货模式", "Shipping Mode")}:</Label>
              <Select
                value={activeShippingMode}
                onValueChange={(value: "full" | "partial") => setShippingMode(value)}
                disabled={d.physicalStatus === "partial_shipped"}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={translate("选择发货模式", "Select shipping mode")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{translate("完整发货", "Full Shipment")}</SelectItem>
                  <SelectItem value="partial">{translate("部分发货", "Partial Shipment")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activeShippingMode === "partial" && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">{translate("选择本次发货的商品", "Select items for this shipment")}:</h3>
                <div className="grid gap-2">
                  {shippableItems.length === 0 ? (
                    <div className="text-muted-foreground text-sm">{translate("所有商品均已发货或无待发货商品", "All items have been shipped or no items to ship")}</div>
                  ) : (
                    shippableItems.map((item: any) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`item-${item.id}`}
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => {
                            toggleItem(item.id);
                            // Initialize ship quantity to full quantity when first selected
                            if (!selectedItems.includes(item.id)) {
                              setShipQuantities((prev) => ({ ...prev, [item.id]: item.quantity }));
                            }
                          }}
                        />
                        <label
                          htmlFor={`item-${item.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {item.productName} {item.variationName && `(${item.variationName})`} x {item.quantity}
                        </label>
                        {/* V2.1.26补充4: Quantity input for partial shipping (Issue 7) */}
                        {selectedItems.includes(item.id) && item.quantity > 1 && (
                          <div className="flex items-center gap-1 ml-auto">
                            <Label className="text-xs text-muted-foreground">{translate("发货数量", "Ship Qty")}:</Label>
                            <Input
                              type="number"
                              min={1}
                              max={item.quantity}
                              value={shipQuantities[item.id] ?? item.quantity}
                              onChange={(e) => updateShipQuantity(item.id, Number(e.target.value), item.quantity)}
                              className="w-16 h-8 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">/ {item.quantity}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <Separator />

            <h3 className="font-semibold text-sm">{translate("包裹信息", "Package Information")}:</h3>
            <div className="space-y-3">
              {packages.map((pkg, index) => {
                const fixedCourier = isFixedCourier(d.shippingMethod || "west_malaysia");
                return (
                <div key={index} className="flex items-end gap-2 border p-3 rounded-md relative">
                  <div className="grid grid-cols-2 gap-2 flex-grow">
                    {/* V2.1.30: For lalamove/shopee, show courier as read-only text */}
                    {fixedCourier ? (
                      <div className="space-y-1 col-span-2">
                        <Label>{translate("快递公司", "Courier")}</Label>
                        <div className="border rounded-md px-3 py-2 bg-muted/50 text-sm font-medium">{pkg.courier}</div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label htmlFor={`courier-${index}`}>{translate("快递公司", "Courier")}</Label>
                        <Select
                          value={pkg.courier}
                          onValueChange={(value) => updatePackage(index, "courier", value)}
                        >
                          <SelectTrigger id={`courier-${index}`}>
                            <SelectValue placeholder={translate("选择快递公司", "Select courier")} />
                          </SelectTrigger>
                          <SelectContent>
                            {COURIERS.map((c) => (
                              <SelectItem key={c.en} value={c.zh}>{lang === "zh" ? c.zh : c.en}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {/* V2.1.30: Hide shipping type for fixed courier methods */}
                    {!fixedCourier && (
                      <div className="space-y-1">
                        <Label htmlFor={`shipping-type-${index}`}>{translate("发货类型", "Shipping Type")}</Label>
                        <Select
                          value={pkg.shippingType}
                          onValueChange={(value: "auto" | "manual") => updatePackage(index, "shippingType", value)}
                        >
                          <SelectTrigger id={`shipping-type-${index}`}>
                            <SelectValue placeholder={translate("选择发货类型", "Select shipping type")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">{translate("手动发货", "Manual")}</SelectItem>
                            <SelectItem value="auto">{translate("自动发货 (API)", "Auto (API)")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {/* V2.1.30: For lalamove/shopee, always show tracking number input */}
                    {(pkg.shippingType === "manual" || fixedCourier) && (
                      <div className="space-y-1 col-span-2">
                        <Label htmlFor={`tracking-number-${index}`}>{translate("追踪号", "Tracking Number")}</Label>
                        <Input
                          id={`tracking-number-${index}`}
                          value={pkg.trackingNumber}
                          onChange={(e) => updatePackage(index, "trackingNumber", e.target.value)}
                          placeholder={translate("输入追踪号", "Enter tracking number")}
                        />
                      </div>
                    )}
                    {!fixedCourier && (
                      <div className="space-y-1">
                        <Label htmlFor={`weight-${index}`}>{translate("重量 (kg)", "Weight (kg)")}</Label>
                        <Input
                          id={`weight-${index}`}
                          type="number"
                          value={pkg.weight}
                          onChange={(e) => updatePackage(index, "weight", e.target.value)}
                          placeholder={translate("输入重量", "Enter weight")}
                        />
                      </div>
                    )}
                  </div>
                  {packages.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePackage(index)}
                      className="absolute top-2 right-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                );
              })}
              {/* V2.1.30: Hide add package button for fixed courier methods */}
              {!isFixedCourier(d.shippingMethod || "west_malaysia") && (
                <Button variant="outline" size="sm" onClick={addPackage}>
                  <Plus className="h-4 w-4 mr-1" />{translate("新增包裹", "Add Package")}
                </Button>
              )}
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

  // V2.1.26: Simplified A5 Packing Slip - no images, large order number, large quantity, keywords, unit price, shipping method
  function A5PackingSlip({ data, translate, lang }: { data: any; translate: (zh: string, en: string, params?: Record<string, string | number>) => string; lang: "zh" | "en" }) {
    const allItems = [...(data.items || []), ...(data.giftItems || [])];
    // V2.1.26补充4: Only use grid when more than 2 product items (Issue 5e)
    const productItemCount = (data.items || []).length;
    const useGrid = productItemCount > 2;
    return (
      <div className="a5-slip" style={{ width: "148mm", padding: "8mm", fontFamily: "sans-serif", fontSize: "12px", color: "#000" }}>
        {/* V2.1.26: Large shipping method label at top */}
        <div style={{ textAlign: "center", fontSize: "36px", fontWeight: "bold", marginBottom: "4px", border: "3px solid #000", padding: "6px" }}>
          {data.shippingMethodLabel || data.specialLabel || "西马"}
        </div>

        {/* V2.1.26: Large order number */}
        <div style={{ textAlign: "center", fontSize: "28px", fontWeight: "bold", marginBottom: "4px" }}>
          {data.orderNumber}
        </div>

        {/* V2.1.26: Customer info */}
        <div style={{ marginBottom: "4px", fontSize: "12px", lineHeight: "1.4" }}>
          {data.facebookName && (
            <div><strong>FB:</strong> {data.facebookName}</div>
          )}
          <div><strong>{translate("收件人:", "Recipient:")}</strong> {data.recipientName || data.customerName}</div>
          <div><strong>{translate("电话:", "Phone:")}</strong> {data.recipientPhone || data.customerPhone}</div>
          <div><strong>{translate("地址:", "Address:")}</strong> {
            [
              data.addressLine1,
              data.addressLine2,
              data.postcode || data.recipientPostcode,
              data.recipientCity,
              data.recipientState
            ].filter(Boolean).join(", ")
          }</div>
        </div>

        <div style={{ borderTop: "2px solid #000", margin: "4px 0" }} />

        {/* V2.1.26: Items - large quantity, keywords, unit price, subtotal */}
        <div style={{ marginBottom: "8px" }}>
          {useGrid ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {data.items.map((item: any, i: number) => (
                <div key={i} style={{ border: "2px solid #000", padding: "8px", borderRadius: "6px", minHeight: "80px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "20px" }}>☐</span>
                    <span style={{ fontWeight: "bold", fontSize: "18px", lineHeight: "1.2" }}>{item.productName}</span>
                  </div>
                  {item.keyword && <div style={{ fontSize: "14px", color: "#555", marginLeft: "26px" }}>{item.keyword}</div>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                    <span style={{ fontSize: "14px" }}>RM{Number(item.unitPrice || 0).toFixed(0)} × {item.quantity}</span>
                    <span style={{ fontSize: "36px", fontWeight: "bold", border: "4px solid #000", padding: "4px 12px", borderRadius: "6px" }}>
                      {item.quantity}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", textAlign: "right", marginTop: "4px" }}>小计: RM{Number(item.subtotal || 0).toFixed(2)}</div>
                </div>
              ))}
            </div>
          ) : (
            data.items.map((item: any, i: number) => (
              <div key={i} style={{ marginBottom: "6px", paddingBottom: "4px", borderBottom: "1px dashed #ccc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "16px" }}>☐</span>
                  <span style={{ fontWeight: "bold", fontSize: "14px" }}>{item.productName}</span>
                  {item.variationName && <span style={{ fontSize: "11px" }}>({item.variationName})</span>}
                </div>
                {item.keyword && <div style={{ fontSize: "11px", color: "#555", marginLeft: "20px" }}>{translate("关键词:", "Keyword:")} {item.keyword}</div>}
                <div style={{ marginLeft: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px" }}>{translate("单价:", "Unit Price:")} RM{Number(item.unitPrice || 0).toFixed(2)} × {item.quantity} = RM{Number(item.subtotal || 0).toFixed(2)}</span>
                  <span style={{
                    fontSize: "32px",
                    fontWeight: "bold",
                    border: item.quantity > 1 ? "3px solid #000" : "none",
                    padding: item.quantity > 1 ? "2px 10px" : "0",
                    borderRadius: "4px",
                  }}>
                    {item.quantity}
                  </span>
                </div>
              </div>
            ))
          )}

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
                    <span style={{ fontSize: "24px", fontWeight: "bold", border: "2px solid #000", padding: "1px 8px", borderRadius: "3px" }}>
                      {gift.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* V2.1.26补充4: Order amount details (Issue 5c) */}
        <div style={{ borderTop: "2px solid #000", margin: "4px 0" }} />
        <div style={{ marginBottom: "6px", fontSize: "13px", lineHeight: "1.6" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{translate("商品小计:", "Item Subtotal:")}</span>
            <span>RM {data.summary.physicalSubtotal || data.summary.regularTotal}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{translate("运费:", "Shipping Fee:")}</span>
            <span>RM {data.summary.shippingFee}</span>
          </div>
          {parseFloat(data.summary.discountAmount || "0") > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{translate("折扣:", "Discount:")} {data.summary.discountReason ? `(${data.summary.discountReason})` : ""}</span>
              <span>-RM {data.summary.discountAmount}</span>
            </div>
          )}
          {parseFloat(data.summary.extraCharge || "0") > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{translate("额外收费:", "Extra Charge:")} {data.summary.extraChargeDescription ? `(${data.summary.extraChargeDescription})` : ""}</span>
              <span>+RM {data.summary.extraCharge}</span>
            </div>
          )}
          {parseFloat(data.summary.creditUsed || "0") > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{translate("Credit:", "Credit:")}</span>
              <span>-RM {data.summary.creditUsed}</span>
            </div>
          )}
          <div style={{ borderTop: "1px solid #000", margin: "2px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: "bold" }}>
            <span>{translate("总金额:", "Total Amount:")}</span>
            <span>RM {data.summary.totalAmount}</span>
          </div>
        </div>
        {data.summary.isFreeShipping && (
          <div style={{ textAlign: "center", fontSize: "14px", fontWeight: "bold", color: "green", marginBottom: "4px" }}>
            {translate("免邮", "Free Shipping")}
          </div>
        )}

        {/* V2.1.26补充6: Customer Remark (Issue 4) */}
        {data.customerRemark && (
          <div style={{ marginBottom: "4px", border: "2px solid #000", padding: "4px" }}>
            <div style={{ fontWeight: "bold", fontSize: "12px" }}>📌 {translate("客户备注", "Customer Remark")}</div>
            <div style={{ fontSize: "11px", marginLeft: "8px" }}>{data.customerRemark}</div>
          </div>
        )}

        {/* V2.1.26补充6: Admin Remarks (Issue 4) */}
        {data.adminRemarks && data.adminRemarks.length > 0 && (
          <div style={{ marginBottom: "8px", border: "2px solid #000", padding: "4px" }}>
            <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>📌 {translate("后台备注", "Admin Remarks")}</div>
            {data.adminRemarks.map((r: any, i: number) => (
              <div key={i} style={{ marginBottom: "4px" }}>
                <div style={{ fontSize: "11px", marginLeft: "8px" }}>
                  {r.remarkCategory === "repotting" ? translate("换盆", "Repotting") :
                   r.remarkCategory === "desired_delivery_date" ? translate("发货日期", "Delivery Date") :
                   r.remarkCategory === "select_tree" ? translate("选树身", "Select Tree") :
                   r.remarkCategory === "other" ? translate("其他", "Other") : r.remarkCategory}
                  {r.content && <span> — {r.content}</span>}
                  {r.desiredDeliveryDate && <span> — {new Date(r.desiredDeliveryDate).toLocaleDateString()}</span>}
                  {r.desiredDeliveryReason && <span> ({r.desiredDeliveryReason})</span>}
                </div>
              </div>
            ))}
          </div>
        )}


      </div>
    );
  }
