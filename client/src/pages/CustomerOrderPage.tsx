import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, Truck, MapPin, Phone, User, CheckCircle2, Clock, ExternalLink, Leaf, AlertCircle, RefreshCw } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  "Pending Payment": { label: "待付款", color: "bg-amber-100 text-amber-900", icon: Clock },
  "Payment Review": { label: "付款审核中", color: "bg-sky-100 text-sky-900", icon: Clock },
  "Payment Confirmed": { label: "已确认付款", color: "bg-emerald-100 text-emerald-900", icon: CheckCircle2 },
  "Preparing Goods": { label: "配货中", color: "bg-sky-100 text-sky-900", icon: Package },
  "Partial Shipped": { label: "部分已发货", color: "bg-orange-100 text-orange-900", icon: Truck },
  "Shipped": { label: "已发货", color: "bg-emerald-100 text-emerald-900", icon: Truck },
  "Completed": { label: "已完成", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
  "Cancelled": { label: "已取消", color: "bg-red-100 text-red-900", icon: AlertCircle },
};

export default function CustomerOrderPage(props: any) {
  const orderNumber = props.orderNumber ?? props.match?.params?.orderNumber ?? "";
  const token = props.token ?? props.match?.params?.token ?? "";

  // V2.0.2: refetch every 10s for near real-time updates when Admin/AI adds items
  const { data: order, isLoading, error, isFetching } = trpc.publicOrder.getByToken.useQuery(
    { orderNumber, token },
    {
      enabled: orderNumber.length > 0 && token.length > 0,
      refetchInterval: 10 * 1000,
      refetchOnWindowFocus: true,
      staleTime: 5 * 1000,
    }
  );

  const o = order as any;
  const statusInfo = o ? STATUS_CONFIG[o.customerStatus] || STATUS_CONFIG["Pending Payment"] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Xintian Brand Header */}
      <div className="border-b bg-card">
        <div className="container max-w-2xl mx-auto py-4 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg text-primary">心田 Xintian</span>
          </div>
          {isFetching && !isLoading && (
            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>
      </div>
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-center mb-2">订单查询</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">您的订单状态如下</p>

        {isLoading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">加载中...</CardContent>
          </Card>
        )}

        {error && !isLoading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
              订单链接无效或已过期，请联系客服获取最新订单链接
            </CardContent>
          </Card>
        )}

        {o && !isLoading && (
          <div className="space-y-4">
            {/* Status */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">订单编号</div>
                    <div className="font-semibold">{o.orderNumber}</div>
                  </div>
                  <Badge className={statusInfo?.color}>
                    {statusInfo && <statusInfo.icon className="h-3 w-3 mr-1" />}
                    {statusInfo?.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader><CardTitle className="text-base">商品列表</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {o.items.map((item: any, i: number) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border flex-shrink-0 bg-muted">
                      {item.coverImageUrl ? (
                        <img src={item.coverImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">无图</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{item.productName}</div>
                      {item.variationName && <div className="text-xs text-muted-foreground">{item.variationName}</div>}
                      <div className="text-xs text-muted-foreground">×{item.quantity} @ RM {item.unitPrice}</div>
                    </div>
                    <div className="text-sm font-medium">RM {item.subtotal || (parseFloat(item.unitPrice) * item.quantity).toFixed(2)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Amount Summary - V2.0.2: Complete breakdown */}
            <Card>
              <CardHeader><CardTitle className="text-base">金额明细</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {/* 商品小计 */}
                <div className="flex justify-between">
                  <span>商品小计</span>
                  <span>RM {o.physicalSubtotal || o.totalAmount}</span>
                </div>

                {/* 运费 */}
                <div className="flex justify-between">
                  <span>运费</span>
                  <span>RM {o.shippingFee || "0.00"}</span>
                </div>

                {/* 额外费用 */}
                {parseFloat(o.extraCharge || "0") > 0 && (
                  <div className="flex justify-between">
                    <span>{o.extraChargeDescription || "额外费用"}</span>
                    <span>RM {o.extraCharge}</span>
                  </div>
                )}

                {/* Discount */}
                {parseFloat(o.discountAmount || "0") > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>折扣 (Discount)</span>
                    <span>-RM {o.discountAmount}</span>
                  </div>
                )}

                {/* Credit 扣减 */}
                {parseFloat(o.creditUsed || "0") > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Credit 抵扣</span>
                    <span>-RM {o.creditUsed}</span>
                  </div>
                )}

                <Separator className="my-2" />

                {/* 订单总额 */}
                <div className="flex justify-between font-semibold text-base">
                  <span>订单总额</span>
                  <span>RM {o.totalAmount}</span>
                </div>

                {/* 已付款 */}
                {parseFloat(o.paidAmount || "0") > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>已付款</span>
                    <span>RM {o.paidAmount}</span>
                  </div>
                )}

                {/* 应付款 */}
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg">
                  <span>应付款</span>
                  <span className={parseFloat(o.amountDue || "0") > 0 ? "text-red-600" : "text-emerald-600"}>
                    RM {o.amountDue || "0.00"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader><CardTitle className="text-base">收件信息</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{o.customerName}</div>
                {o.customerPhone && (
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{o.customerPhone}</div>
                )}
                {o.shippingAddress && (
                  <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />{o.shippingAddress}</div>
                )}
              </CardContent>
            </Card>

            {/* Packages / Tracking - Real data from database */}
            {o.packages && o.packages.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">物流信息</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {o.packages.map((pkg: any, i: number) => (
                    <div key={pkg.id || i} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">包裹 {pkg.packageNumber || i + 1} - {pkg.courierCompany || "快递"}</span>
                        <Badge variant={pkg.status === "shipped" ? "default" : "secondary"}>{pkg.status}</Badge>
                      </div>
                      {pkg.trackingNumber && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">追踪号: {pkg.trackingNumber}</span>
                          <a
                            href={`https://www.trackingmore.com/track/${pkg.trackingNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            查询物流 <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {pkg.items && pkg.items.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          包含: {pkg.items.map((pi: any) => `${pi.productName} ×${pi.quantity}`).join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Payment Info */}
            {o.paymentMethodName && (
              <Card>
                <CardHeader><CardTitle className="text-base">付款方式</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  <div className="flex justify-between">
                    <span>付款方式</span>
                    <span className="font-medium">{o.paymentMethodName}</span>
                  </div>
                  {o.receiptUrl && (
                    <div className="mt-2">
                      <a href={o.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        查看汇款单据 <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Order Date */}
            <div className="text-center text-xs text-muted-foreground">
              订单创建时间: {new Date(o.createdAt).toLocaleString("zh-CN")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
