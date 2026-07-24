import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Package, Truck, MapPin, Phone, User, CheckCircle2, Clock, ExternalLink, Leaf } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

const STATUS_CONFIG_MAP = {
  "等待付款": "pendingPayment",
  "付款审核中": "paymentReview",
  "已确认付款": "paymentConfirmed",
  "正在准备商品": "preparingGoods",
  "部分发货": "partialShipped",
  "已发货": "shipped",
  "已完成": "completed",
  "已取消": "cancelled",
};

const STATUS_CONFIG = {
  "pendingPayment": { zh: "等待付款", en: "Pending Payment", color: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200", icon: Clock },
  "paymentReview": { zh: "付款审核中", en: "Payment Review", color: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200", icon: Clock },
  "paymentConfirmed": { zh: "已确认付款", en: "Payment Confirmed", color: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200", icon: CheckCircle2 },
  "preparingGoods": { zh: "正在准备商品", en: "Preparing Goods", color: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200", icon: Package },
  "partialShipped": { zh: "部分发货", en: "Partial Shipped", color: "bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-200", icon: Truck },
  "shipped": { zh: "已发货", en: "Shipped", color: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200", icon: Truck },
  "completed": { zh: "已完成", en: "Completed", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
  "cancelled": { zh: "已取消", en: "Cancelled", color: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200", icon: Clock },
};

export default function CustomerOrderTracking() {
  const [orderNumber, setOrderNumber] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [searched, setSearched] = useState(false);
  const { translate, lang } = useI18n();

  const { data: order, isLoading } = trpc.orderTracking.query.useQuery(
    { orderNumber, contactNumber: contactNumber || undefined },
    { enabled: searched && orderNumber.length > 0 }
  );

  const handleSearch = () => {
    if (orderNumber.trim().length === 0) return;
    setSearched(true);
  };

  const getStatusInfo = (statusKey: string) => {
    const mappedKey = STATUS_CONFIG_MAP[statusKey as keyof typeof STATUS_CONFIG_MAP] || "pendingPayment";
    const config = STATUS_CONFIG[mappedKey as keyof typeof STATUS_CONFIG];
    return config ? { ...config, translatedText: translate(config.zh, config.en) } : null;
  };

  const statusInfo = order ? getStatusInfo((order as any).customerStatus) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Xintian Brand Header */}
      <div className="border-b bg-card">
        <div className="container max-w-2xl mx-auto py-4 px-4 flex items-center gap-2">
          <Leaf className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg text-primary">{translate("心田 Xintian", "Xintian")}</span>
        </div>
      </div>
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-center mb-2">{translate("订单查询", "Order Tracking")}</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">{translate("输入订单编号查询您的订单状态", "Enter your order number to track your order status")}</p>

        {/* Search Form */}
        <Card className="mb-6">
          <CardContent className="py-4 space-y-3">
            <div>
              <Label htmlFor="orderNumber">{translate("订单编号", "Order Number")}</Label>
              <Input
                id="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder={translate("例如: XT1234567890", "e.g.: XT1234567890")}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div>
              <Label htmlFor="contactNumber">{translate("电话号码（可选验证）", "Phone Number (optional verification)")}</Label>
              <Input
                id="contactNumber"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder={translate("例如: 0123456789", "e.g.: 0123456789")}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} className="w-full" disabled={isLoading}>
              <Search className="h-4 w-4 mr-2" />
              {isLoading ? translate("查询中...", "Searching...") : translate("查询订单", "Track Order")}
            </Button>
          </CardContent>
        </Card>

        {/* Order Result */}
        {searched && !isLoading && !order && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {translate("未找到订单，请检查订单编号是否正确", "Order not found, please check if the order number is correct")}
            </CardContent>
          </Card>
        )}

        {order && (
          <div className="space-y-4">
            {/* Status */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{translate("订单编号", "Order Number")}</div>
                    <div className="font-semibold">{(order as any).orderNumber}</div>
                  </div>
                  <Badge className={statusInfo?.color}>
                    {statusInfo && <statusInfo.icon className="h-3 w-3 mr-1" />}
                    {statusInfo?.translatedText}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader><CardTitle className="text-base">{translate("商品", "Items")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(order as any).items.map((item: any, i: number) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border flex-shrink-0 bg-muted">
                      {item.coverImageUrl ? (
                        <img src={item.coverImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">{translate("无图", "No Image")}</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{lang === "en" && item.productName_en ? item.productName_en : item.productName}</div>
                      {item.variationName && <div className="text-xs text-muted-foreground">{lang === "en" && item.variationName_en ? item.variationName_en : item.variationName}</div>}
                      <div className="text-xs text-muted-foreground">{translate("×{quantity} @ RM {price}", "×{quantity} @ RM {price}", { quantity: item.quantity, price: item.unitPrice })}</div>
                    </div>
                    <div className="text-sm font-medium">RM {item.subtotal || (parseFloat(item.unitPrice) * item.quantity).toFixed(2)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Amount Summary */}
            <Card>
              <CardHeader><CardTitle className="text-base">{translate("金额", "Amount")}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span>{translate("商品总额", "Subtotal")}</span><span>RM {(order as any).totalAmount}</span></div>
                <div className="flex justify-between"><span>{translate("运费", "Shipping Fee")}</span><span>RM {(order as any).shippingFee || "0.00"}</span></div>
                <div className="flex justify-between"><span>{translate("已付款", "Paid Amount")}</span><span>RM {(order as any).paidAmount || "0.00"}</span></div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold"><span>{translate("订单总额", "Total Order Amount")}</span><span>RM {(order as any).totalAmount}</span></div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader><CardTitle className="text-base">{translate("收件信息", "Recipient Information")}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{(order as any).customerName}</div>
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{(order as any).customerPhone}</div>
                <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />{(order as any).shippingAddress}</div>
              </CardContent>
            </Card>

            {/* Packages / Tracking */}
            {(order as any).packages && (order as any).packages.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">{translate("物流信息", "Shipping Information")}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {(order as any).packages.map((pkg: any, i: number) => (
                    <div key={pkg.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{translate("包裹 {packageNumber} - {courier}", "Package {packageNumber} - {courier}", { packageNumber: pkg.packageNumber, courier: pkg.courier })}</span>
                        <Badge variant={pkg.status === "shipped" ? "default" : "secondary"}>{getStatusInfo(pkg.status)?.translatedText ?? pkg.status}</Badge>
                      </div>
                      {pkg.trackingNumber && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{translate("追踪号: {trackingNumber}", "Tracking: {trackingNumber}", { trackingNumber: pkg.trackingNumber })}</span>
                          <a
                            href={`https://www.trackingmore.com/track/${pkg.trackingNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            {translate("查询物流", "Track Shipment")} <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {pkg.items && pkg.items.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {translate("包含: {items}", "Contains: {items}", { items: pkg.items.map((pi: any) => `${lang === "en" && pi.productName_en ? pi.productName_en : pi.productName} ×${pi.quantity}`).join(", ") })}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
