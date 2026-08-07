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
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [exceptionType, setExceptionType] = useState<"out_of_stock" | "quality_issue" | "overcharged_shipping" | "other">("quality_issue");
  const [exceptionDesc, setExceptionDesc] = useState("");
  const [resolutionType, setResolutionType] = useState<"replace" | "wait_restock" | "refund">("replace");
  const [exceptionItemId, setExceptionItemId] = useState<number | "">("");
  const [replacementProductId, setReplacementProductId] = useState<number | "">("");
  const [replacementQty, setReplacementQty] = useState(1);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [packages, setPackages] = useState<Array<{
    courier: string;
    shippingType: "auto" | "manual" | "parcelking";
    trackingNumber: string;
    weight: string;
    serviceId: string;
  }>>([{ courier: "Parcel Daily", shippingType: "manual", trackingNumber: "", weight: "1", serviceId: "" }]);
  const [actualWeightInput, setActualWeightInput] = useState("");

  const { data: specialActions } = trpc.shippingV2.specialOrderActions.useQuery({ orderId }, { enabled: !!detail });
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
      setPackages([{ courier: "Parcel Daily", shippingType: "manual", trackingNumber: "", weight: "1", serviceId: "" }]);
      setSelectedItems([]);
    },
    onError: (err) => toast.error(translate(`Parcel King 发货失败: ${err.message}`, `Parcel King Shipping Failed: ${err.message}`)),
  });

  const createExceptionMutation = trpc.orderException.create.useMutation({
    onSuccess: () => {
      toast.success(translate("异常已记录", "Exception recorded"));
      setExceptionDialogOpen(false);
      setExceptionDesc("");
    },
    onError: (err) => toast.error(translate("创建异常失败: ", "Failed to create exception: ") + err.message),
  });

  const resolveExceptionMutation = trpc.orderException.resolve.useMutation({
    onSuccess: () => {
      toast.success(translate("异常已处理", "Exception resolved"));
      setExceptionDialogOpen(false);
      setExceptionDesc("");
      setExceptionItemId("");
      setReplacementProductId("");
      setReplacementQty(1);
      utils.packing.detail.invalidate({ orderId });
    },
    onError: (err) => toast.error(translate("处理异常失败: ", "Failed to resolve exception: ") + err.message),
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
                    <div className="text-sm">
                      <Badge variant={exc.status === "resolved" ? "secondary" : "destructive"} className="mr-2">
                        {exc.status === "resolved" ? translate("已处理", "Resolved") : translate("待处理", "Open")}
                      </Badge>
                      {exc.exceptionType === "out_of_stock" ? translate("商品缺货", "Out of Stock") :
                       exc.exceptionType === "quality_issue" ? translate("植物品质异常", "Quality Issue") :
                       exc.exceptionType === "overcharged_shipping" ? translate("运费多收", "Overcharged Shipping") :
                       translate("其他异常", "Other")}
                      {exc.description && <span className="text-muted-foreground ml-2">— {exc.description}</span>}
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
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{translate("异常处理", "Exception Handling")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Step 1: Exception Type */}
                  <div className="space-y-2">
                    <Label>{translate("异常类型", "Exception Type")}</Label>
                    <Select value={exceptionType} onValueChange={(v: any) => setExceptionType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="out_of_stock">{translate("商品缺货", "Out of Stock")}</SelectItem>
                        <SelectItem value="quality_issue">{translate("植物品质异常", "Quality Issue")}</SelectItem>
                        <SelectItem value="overcharged_shipping">{translate("运费多收", "Overcharged Shipping")}</SelectItem>
                        <SelectItem value="other">{translate("其他异常", "Other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Step 2: Select affected item */}
                  <div className="space-y-2">
                    <Label>{translate("涉及商品", "Affected Item")}</Label>
                    <Select value={String(exceptionItemId)} onValueChange={(v) => setExceptionItemId(Number(v))}>
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

                  {/* Step 3: Description */}
                  <div className="space-y-2">
                    <Label>{translate("异常描述", "Description")}</Label>
                    <Input
                      value={exceptionDesc}
                      onChange={(e) => setExceptionDesc(e.target.value)}
                      placeholder={translate("描述异常情况...", "Describe the issue...")}
                    />
                  </div>

                  {/* Step 4: Resolution (for quality_issue) */}
                  {exceptionType === "quality_issue" && (
                    <div className="space-y-2">
                      <Label>{translate("客户处理方式", "Customer Resolution")}</Label>
                      <Select value={resolutionType} onValueChange={(v: any) => setResolutionType(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="replace">{translate("更换商品", "Replace Product")}</SelectItem>
                          <SelectItem value="wait_restock">{translate("等待补货", "Wait for Restock")}</SelectItem>
                          <SelectItem value="refund">{translate("退款", "Refund")}</SelectItem>
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
                        if (exceptionType === "quality_issue" && resolutionType !== "wait_restock") {
                          // For replace/refund, create + resolve in one step
                          createExceptionMutation.mutate({
                            orderId,
                            orderItemId: exceptionItemId || undefined,
                            exceptionType,
                            description: exceptionDesc,
                          }, {
                            onSuccess: (created: any) => {
                              resolveExceptionMutation.mutate({
                                exceptionId: created.id,
                                resolutionType,
                                orderId,
                                scrapItems: exceptionItemId ? (d.items as any[])
                                  .filter((it: any) => it.id === exceptionItemId)
                                  .map((it: any) => ({
                                    orderItemId: it.id,
                                    productId: it.productId,
                                    productName: it.productName,
                                    quantity: it.quantity,
                                    unitCost: Number(it.unitPrice) || 0,
                                  })) : [],
                              });
                            },
                          });
                        } else {
                          createExceptionMutation.mutate({
                            orderId,
                            orderItemId: exceptionItemId || undefined,
                            exceptionType,
                            description: exceptionDesc,
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
                          onCheckedChange={() => toggleItem(item.id)}
                        />
                        <label
                          htmlFor={`item-${item.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {item.productName} {item.variationName && `(${item.variationName})`} x {item.quantity}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <Separator />

            <h3 className="font-semibold text-sm">{translate("包裹信息", "Package Information")}:</h3>
            <div className="space-y-3">
              {packages.map((pkg, index) => (
                <div key={index} className="flex items-end gap-2 border p-3 rounded-md relative">
                  <div className="grid grid-cols-2 gap-2 flex-grow">
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
                    <div className="space-y-1">
                      <Label htmlFor={`shipping-type-${index}`}>{translate("发货类型", "Shipping Type")}</Label>
                      <Select
                        value={pkg.shippingType}
                        onValueChange={(value: "auto" | "manual" | "parcelking") => updatePackage(index, "shippingType", value)}
                      >
                        <SelectTrigger id={`shipping-type-${index}`}>
                          <SelectValue placeholder={translate("选择发货类型", "Select shipping type")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">{translate("手动发货", "Manual")}</SelectItem>
                          <SelectItem value="auto">{translate("自动发货 (API)", "Auto (API)")}</SelectItem>
                          <SelectItem value="parcelking">{translate("Parcel King", "Parcel King")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {pkg.shippingType === "manual" && (
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
                    {pkg.shippingType === "parcelking" && (
                      <div className="space-y-1">
                        <Label htmlFor={`parcelking-service-${index}`}>{translate("Parcel King 服务", "Parcel King Service")}</Label>
                        <Select
                          value={pkg.serviceId}
                          onValueChange={(value) => updatePackage(index, "serviceId", value)}
                        >
                          <SelectTrigger id={`parcelking-service-${index}`}>
                            <SelectValue placeholder={translate("选择服务", "Select service")} />
                          </SelectTrigger>
                          <SelectContent>
                            {(parcelKingServicesQuery.data as any)?.success && (parcelKingServicesQuery.data as any).services?.map((service: any) => (
                              <SelectItem key={service.id} value={String(service.id)}>{service.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {(pkg.shippingType === "manual" || pkg.shippingType === "parcelking") && (
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

        {/* V3.0: Order Remarks on A5 Slip — repotting, desired_delivery_date, other */}
        {data.remarks && data.remarks.length > 0 && (
          <div style={{ marginBottom: "8px", border: "2px solid #000", padding: "4px" }}>
            {data.remarks.map((r: any, i: number) => (
              <div key={i} style={{ marginBottom: "4px" }}>
                {r.remarkCategory === "repotting" && (
                  <>
                    <div style={{ fontWeight: "bold", fontSize: "12px" }}>📌 {translate("换盆", "Repotting")}</div>
                    <div style={{ fontSize: "11px", marginLeft: "8px" }}>{r.content}</div>
                  </>
                )}
                {r.remarkCategory === "desired_delivery_date" && (
                  <>
                    <div style={{ fontWeight: "bold", fontSize: "12px" }}>📌 {translate("希望收货日期", "Desired Delivery Date")}</div>
                    <div style={{ fontSize: "11px", marginLeft: "8px" }}>
                      {r.desiredDeliveryDate ? new Date(r.desiredDeliveryDate).toLocaleDateString() : ""}
                      {r.desiredDeliveryReason && <span> — {r.desiredDeliveryReason}</span>}
                    </div>
                  </>
                )}
                {r.remarkCategory === "other" && (
                  <>
                    <div style={{ fontWeight: "bold", fontSize: "12px" }}>📌 {translate("其他备注", "Other Remark")}</div>
                    <div style={{ fontSize: "11px", marginLeft: "8px" }}>{r.content}</div>
                  </>
                )}
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
            <span>{translate("已付:", "Paid:")}</span><span>RM {data.summary.paidAmount}</span>
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
