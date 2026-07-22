import { useState } from "react";
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
import { ArrowLeft, Printer, Truck, Package, Plus, X, MapPin, Phone, User, Ship, CheckCircle2 } from "lucide-react";

const COURIERS = [
  "Parcel Daily", "Parcel King", "PosLaju", "JNT", "Ninja Van", "DHL", "Lalamove", "Shopee Xpress", "Other"
];

export default function PackingDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = parseInt(id);
  const utils = trpc.useUtils();

  const { data: detail, isLoading } = trpc.packing.detail.useQuery({ orderId });
  const { data: slipData } = trpc.packing.slipData.useQuery({ orderId });
  const { data: existingPackages } = trpc.shipping.packages.useQuery({ orderId });

  const [shippingMode, setShippingMode] = useState<"full" | "partial">("full");
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [packages, setPackages] = useState<Array<{
    courier: string;
    shippingType: "auto" | "manual";
    trackingNumber: string;
    weight: string;
  }>>([{ courier: "Parcel Daily", shippingType: "manual", trackingNumber: "", weight: "1" }]);

  const fullShipMutation = trpc.shipping.fullShip.useMutation({
    onSuccess: () => {
      toast.success("发货成功！订单状态已更新为已发货");
      utils.packing.list.invalidate();
      utils.packing.detail.invalidate({ orderId });
      utils.shipping.packages.invalidate({ orderId });
    },
    onError: (err) => toast.error(`发货失败: ${err.message}`),
  });

  const partialShipMutation = trpc.shipping.partialShip.useMutation({
    onSuccess: (data: any) => {
      if (data.allShipped) {
        toast.success("部分发货成功！所有商品已全部发出，订单状态更新为已发货");
      } else {
        toast.success("部分发货成功！订单状态更新为部分发货");
      }
      utils.packing.list.invalidate();
      utils.packing.detail.invalidate({ orderId });
      utils.shipping.packages.invalidate({ orderId });
      setSelectedItems([]);
    },
    onError: (err) => toast.error(`发货失败: ${err.message}`),
  });

  const handleShip = () => {
    if (shippingMode === "full") {
      if (packages.length === 0) {
        toast.error("请至少添加一个包裹");
        return;
      }
      const hasEmptyTracking = packages.some((p) => !p.trackingNumber && p.shippingType === "manual");
      if (hasEmptyTracking) {
        toast.error("手动物流必须填写 Tracking Number");
        return;
      }
      fullShipMutation.mutate({
        orderId,
        packages: packages.map((p) => ({
          courier: p.courier,
          shippingType: p.shippingType,
          trackingNumber: p.trackingNumber || undefined,
          weight: p.weight || undefined,
        })),
      });
    } else {
      if (selectedItems.length === 0) {
        toast.error("请选择本次发出的商品");
        return;
      }
      if (packages.length === 0) {
        toast.error("请至少添加一个包裹");
        return;
      }
      const pkg = packages[0];
      if (!pkg.trackingNumber && pkg.shippingType === "manual") {
        toast.error("手动物流必须填写 Tracking Number");
        return;
      }
      partialShipMutation.mutate({
        orderId,
        itemIds: selectedItems,
        packageData: {
          courier: pkg.courier,
          shippingType: pkg.shippingType,
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
    setPackages((prev) => [...prev, { courier: "Parcel Daily", shippingType: "manual", trackingNumber: "", weight: "1" }]);
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
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>;
  }

  if (!detail) {
    return <div className="text-center py-12 text-muted-foreground">订单不存在</div>;
  }

  const d = detail as any;
  const specialLabel = d.shippingMethod === "lalamove" ? "LALAMOVE" :
    d.shippingMethod === "east_malaysia_shopee" ? "东马 SHOPEE" :
    d.shippingMethod === "east_malaysia_poslaju" ? "东马 POSLAJU" : "";

  return (
    <div className="space-y-6">
      {/* Header - not printable */}
      <div className="flex items-center justify-between print-hide">
        <div className="flex items-center gap-4">
          <Link href="/packing">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />返回</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{d.orderNumber}</h1>
            {specialLabel && <Badge variant="destructive" className="mt-1">{specialLabel}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />A5 包货单</Button>
        </div>
      </div>

      {/* Customer Info */}
      <Card className="print-hide">
        <CardHeader><CardTitle className="text-base">客户信息</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" />{d.customerName}</div>
          <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{d.customerPhone}</div>
          <div className="flex items-start gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />{d.shippingAddress}</div>
        </CardContent>
      </Card>

      {/* Product Items - Color display for packing */}
      <Card className="print-hide">
        <CardHeader><CardTitle className="text-base">商品列表（彩色照片）</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {(d.items as any[]).map((item) => (
              <div key={item.id} className="flex gap-4 items-start border rounded-lg p-3">
                {/* Product Image */}
                <div className="w-24 h-24 rounded-lg overflow-hidden border flex-shrink-0 bg-muted">
                  {item.coverImageUrl ? (
                    <img src={item.coverImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">无图</div>
                  )}
                </div>
                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{item.productName}</div>
                  {item.variationName && <div className="text-sm text-muted-foreground">{item.variationName}</div>}
                  {item.productSku && <div className="text-xs text-muted-foreground">SKU: {item.productSku}</div>}
                  {item.keyword && <div className="text-xs text-muted-foreground">Keyword: {item.keyword}</div>}
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
          <CardHeader><CardTitle className="text-base">已有包裹</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(existingPackages as any[]).map((pkg: any) => (
              <div key={pkg.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">包裹 {pkg.packageNumber} - {pkg.courier}</div>
                    <div className="text-xs text-muted-foreground">Tracking: {pkg.trackingNumber || "未填写"}</div>
                  </div>
                </div>
                <Badge variant={pkg.status === "shipped" ? "default" : "secondary"}>{pkg.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Shipping Section */}
      <Card className="print-hide">
        <CardHeader><CardTitle className="text-base">发货</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Shipping Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={shippingMode === "full" ? "default" : "outline"}
              onClick={() => setShippingMode("full")}
              size="sm"
            >
              <Truck className="h-4 w-4 mr-1" />完整发货
            </Button>
            <Button
              variant={shippingMode === "partial" ? "default" : "outline"}
              onClick={() => setShippingMode("partial")}
              size="sm"
            >
              <Package className="h-4 w-4 mr-1" />部分发货
            </Button>
          </div>

          {/* Partial: Item Selection */}
          {shippingMode === "partial" && (
            <div className="border rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">请选择本次发出的商品</div>
              {(d.items as any[]).map((item) => (
                <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                  <span className="text-sm">{item.productName} {item.variationName && `- ${item.variationName}`} ×{item.quantity}</span>
                </label>
              ))}
            </div>
          )}

          {/* Package List */}
          <div className="space-y-3">
            {packages.map((pkg, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">包裹 {index + 1}</span>
                  {packages.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removePackage(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Courier</Label>
                    <Select value={pkg.courier} onValueChange={(v) => updatePackage(index, "courier", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COURIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">物流类型</Label>
                    <Select value={pkg.shippingType} onValueChange={(v) => updatePackage(index, "shippingType", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">手动填写 Tracking</SelectItem>
                        <SelectItem value="auto">自动获取 (ParcelDaily)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tracking Number</Label>
                    <Input
                      value={pkg.trackingNumber}
                      onChange={(e) => updatePackage(index, "trackingNumber", e.target.value)}
                      placeholder="输入追踪号"
                      disabled={pkg.shippingType === "auto"}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">重量 (kg)</Label>
                    <Input
                      value={pkg.weight}
                      onChange={(e) => updatePackage(index, "weight", e.target.value)}
                      placeholder="1"
                      type="number"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addPackage}>
              <Plus className="h-4 w-4 mr-1" />新增包裹
            </Button>
          </div>

          <Button
            onClick={handleShip}
            disabled={fullShipMutation.isPending || partialShipMutation.isPending}
            className="w-full"
          >
            <Ship className="h-4 w-4 mr-2" />
            {shippingMode === "full" ? "确认完整发货" : "确认部分发货"}
          </Button>
        </CardContent>
      </Card>

      {/* A5 Packing Slip - Print Only */}
      {slipData && (
        <div className="print-only hidden">
          <A5PackingSlip data={slipData as any} />
        </div>
      )}
    </div>
  );
}

// A5 Packing Slip Component (print only)
function A5PackingSlip({ data }: { data: any }) {
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
          <span>订单编号: <strong>{data.orderNumber}</strong></span>
        </div>
        <div>客户姓名: <strong>{data.customerName}</strong></div>
        <div>电话号码: <strong>{data.customerPhone}</strong></div>
        {data.paymentConfirmedAt && (
          <div>汇款日期: {new Date(data.paymentConfirmedAt).toLocaleDateString()}</div>
        )}
        <div>地址: {data.shippingAddress}</div>
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
                  <span><strong>赠品</strong> {gift.productName}</span>
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

      <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />

      {/* Summary */}
      <div style={{ fontSize: "11px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>商品种类: {data.summary.itemTypes}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>普通商品:</span><span>RM {data.summary.regularTotal}</span>
        </div>
        {parseFloat(data.summary.discountTotal) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>特价商品: <span style={{ fontSize: "10px" }}>(共{data.summary.discountCount}件)</span></span>
            <span>RM {data.summary.discountTotal}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>运费:</span><span>RM {data.summary.shippingFee}</span>
        </div>
        {parseFloat(data.summary.discountAmount) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>折扣:</span><span>-RM {data.summary.discountAmount}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>已付款:</span><span>RM {data.summary.paidAmount}</span>
        </div>
        {parseFloat(data.summary.balance) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>尚欠:</span><span style={{ fontWeight: "bold" }}>RM {data.summary.balance}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #000", marginTop: "2px", paddingTop: "2px" }}>
          <span><strong>订单总额:</strong></span><span><strong>RM {data.summary.totalAmount}</strong></span>
        </div>
      </div>
    </div>
  );
}
