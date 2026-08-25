import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, Search, Package, Truck, CheckCircle, Clock, XCircle, ExternalLink } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "未汇款订单", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  receipt_uploaded: { label: "待审核付款凭证", color: "bg-blue-100 text-blue-800", icon: Clock },
  hold_order: { label: "保留订单", color: "bg-purple-100 text-purple-800", icon: Clock },
  packing: { label: "待包货", color: "bg-green-100 text-green-800", icon: Package },
  partial_shipped: { label: "部分发货", color: "bg-cyan-100 text-cyan-800", icon: Truck },
  shipped: { label: "已发货", color: "bg-indigo-100 text-indigo-800", icon: Truck },
  completed: { label: "已完成", color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-800", icon: XCircle },
};

export default function MallOrderQuery() {
  const [orderNumber, setOrderNumber] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [searched, setSearched] = useState(false);

  const { data: order, isFetching } = trpc.orderTracking.query.useQuery(
    { orderNumber, contactNumber: contactNumber || undefined },
    { enabled: searched && !!orderNumber && !!contactNumber }
  );

  function handleSearch() {
    if (!orderNumber || !contactNumber) return;
    setSearched(true);
  }

  const statusInfo = order ? STATUS_MAP[order.physicalStatus as string] || STATUS_MAP.pending : null;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/mall"><Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button></Link>
          <h1 className="font-semibold text-lg">订单查询</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-3">
              <div>
                <Label>订单号</Label>
                <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="XT..." />
              </div>
              <div>
                <Label>联系电话</Label>
                <Input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="011-12345678" />
              </div>
              <Button className="w-full bg-[#2d6a4f] hover:bg-[#40916c]" onClick={handleSearch} disabled={isFetching}>
                <Search className="h-4 w-4 mr-2" />查询
              </Button>
            </div>
          </CardContent>
        </Card>

        {searched && order && (
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>订单详情</span>
                {statusInfo && (
                  <Badge className={statusInfo.color}>
                    {statusInfo.label}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">订单号:</span> {order.orderNumber}</div>
                <div><span className="text-muted-foreground">下单时间:</span> {new Date(order.createdAt).toLocaleString("zh-CN")}</div>
                <div><span className="text-muted-foreground">总金额:</span> <span className="font-semibold text-[#2d6a4f]">RM {order.totalAmount}</span></div>
                <div><span className="text-muted-foreground">已付:</span> RM {order.paidAmount || "0.00"}</div>
                <div><span className="text-muted-foreground">配送:</span> {order.shippingMethod}</div>
              </div>

              <div className="space-y-2 md:hidden" aria-label="订单商品">
                {order.items?.map((item: any, i: number) => (
                  <article key={i} className="rounded-xl border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 break-words font-medium">{item.productName}</p>
                      <Badge variant="outline" className="max-w-full whitespace-normal text-left">规格：{item.variationName || "-"}</Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div><dt className="text-xs text-muted-foreground">数量</dt><dd className="mt-1 font-medium">{item.quantity}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">单价</dt><dd className="mt-1 font-medium">RM {item.unitPrice}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">小计</dt><dd className="mt-1 font-semibold text-[#2d6a4f]">RM {item.subtotal}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>

              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>商品</TableHead>
                    <TableHead>规格</TableHead>
                    <TableHead className="text-center">数量</TableHead>
                    <TableHead className="text-right">单价</TableHead>
                    <TableHead className="text-right">小计</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items?.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.variationName || "-"}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">RM {item.unitPrice}</TableCell>
                      <TableCell className="text-right">RM {item.subtotal}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {order.packages && order.packages.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Truck className="h-4 w-4 text-primary" />物流信息
                  </div>
                  {order.packages.map((pkg: any) => (
                    <div key={pkg.id} className="rounded-lg border bg-muted/25 p-3 text-sm">
                      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-medium">包裹 {pkg.packageNumber} · {pkg.courier}</span>
                        <Badge variant={pkg.status === "shipped" ? "default" : "secondary"}>{pkg.status === "shipped" ? "已发货" : pkg.status}</Badge>
                      </div>
                      {pkg.trackingNumber && (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted-foreground">Tracking: {pkg.trackingNumber}</span>
                          <a href={`https://www.trackingmore.com/track/${pkg.trackingNumber}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            查询物流 <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {pkg.items?.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">包含：{pkg.items.map((item: any) => `${item.productName} ×${item.quantity}`).join("、")}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {order.physicalStatus === "pending" && (
                <Link href={`/mall/payment/${order.orderNumber}?phone=${encodeURIComponent(contactNumber)}`}>
                  <Button className="w-full bg-[#2d6a4f] hover:bg-[#40916c]">去付款</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {searched && !order && !isFetching && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>未找到订单，请检查订单号和联系电话</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
