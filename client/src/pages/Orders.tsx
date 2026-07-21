import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Eye, Truck } from "lucide-react";

const PHYSICAL_STATUS = {
  pending: { label: "挂单", variant: "outline" },
  receipt_uploaded: { label: "已上传单据", variant: "secondary" },
  payment_confirmed: { label: "已确认汇款", variant: "default" },
  packing: { label: "配货中", variant: "default" },
  shipped: { label: "已发货", variant: "default" },
  completed: { label: "已完成", variant: "default" },
  cancelled: { label: "已取消", variant: "destructive" },
} as const;

export default function Orders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [shipForm, setShipForm] = useState({ courierCompany: "", trackingNumber: "" });
  const utils = trpc.useUtils();

  const { data: orders, isLoading } = trpc.orders.list.useQuery({
    search: search || undefined,
    physicalStatus: statusFilter !== "all" ? statusFilter : undefined,
  });

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      toast.success("订单状态已更新");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  function openDetail(order: any) {
    setDetailOrder(order);
    setDetailOpen(true);
  }

  function handleShip() {
    if (!detailOrder) return;
    if (!shipForm.courierCompany || !shipForm.trackingNumber) {
      toast.error("请填写快递公司和追踪号码");
      return;
    }
    updateStatusMutation.mutate({
      id: detailOrder.id,
      physicalStatus: "shipped",
      courierCompany: shipForm.courierCompany,
      trackingNumber: shipForm.trackingNumber,
    });
    setShipForm({ courierCompany: "", trackingNumber: "" });
    setDetailOpen(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">订单管理</h1>
        <p className="text-sm text-muted-foreground mt-1">实体商品订单处理</p>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索订单号或客户名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="订单状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(PHYSICAL_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单号</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>实体金额</TableHead>
                <TableHead>运费</TableHead>
                <TableHead>总金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : orders?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">暂无订单</TableCell></TableRow>
              ) : orders?.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                  <TableCell>{o.facebookName || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {o.orderType === "mixed" ? "混合" : o.orderType === "membership" ? "会员" : "实体"}
                    </Badge>
                  </TableCell>
                  <TableCell>RM {o.physicalSubtotal}</TableCell>
                  <TableCell>RM {o.shippingFee}</TableCell>
                  <TableCell className="font-semibold">RM {o.totalAmount}</TableCell>
                  <TableCell>
                    <Badge variant={PHYSICAL_STATUS[o.physicalStatus as keyof typeof PHYSICAL_STATUS]?.variant || "outline"}>
                      {PHYSICAL_STATUS[o.physicalStatus as keyof typeof PHYSICAL_STATUS]?.label || o.physicalStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDetail(o)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>订单详情 - {detailOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">客户名称</p>
                  <p className="font-medium">{detailOrder.facebookName || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">订单类型</p>
                  <p className="font-medium">{detailOrder.orderType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">实体商品金额</p>
                  <p className="font-medium">RM {detailOrder.physicalSubtotal}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">会员费金额</p>
                  <p className="font-medium">RM {detailOrder.membershipSubtotal}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">运费</p>
                  <p className="font-medium">RM {detailOrder.shippingFee}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">订单总金额</p>
                  <p className="font-bold text-lg">RM {detailOrder.totalAmount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">实体订单状态</p>
                  <Badge variant={PHYSICAL_STATUS[detailOrder.physicalStatus as keyof typeof PHYSICAL_STATUS]?.variant || "outline"}>
                    {PHYSICAL_STATUS[detailOrder.physicalStatus as keyof typeof PHYSICAL_STATUS]?.label}
                  </Badge>
                </div>
                {detailOrder.courierCompany && (
                  <div>
                    <p className="text-muted-foreground">快递公司</p>
                    <p className="font-medium">{detailOrder.courierCompany}</p>
                  </div>
                )}
                {detailOrder.trackingNumber && (
                  <div>
                    <p className="text-muted-foreground">追踪号码</p>
                    <p className="font-mono text-sm">{detailOrder.trackingNumber}</p>
                  </div>
                )}
              </div>

              {/* Status actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {detailOrder.physicalStatus === "pending" && (
                  <Button size="sm" variant="outline"
                    onClick={() => {
                      updateStatusMutation.mutate({ id: detailOrder.id, physicalStatus: "payment_confirmed" });
                      setDetailOpen(false);
                    }}>
                    确认汇款
                  </Button>
                )}
                {detailOrder.physicalStatus === "payment_confirmed" && (
                  <Button size="sm" variant="outline"
                    onClick={() => {
                      updateStatusMutation.mutate({ id: detailOrder.id, physicalStatus: "packing" });
                      setDetailOpen(false);
                    }}>
                    开始配货
                  </Button>
                )}
                {detailOrder.physicalStatus === "packing" && (
                  <div className="w-full space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>快递公司</Label>
                        <Input value={shipForm.courierCompany}
                          onChange={(e) => setShipForm({ ...shipForm, courierCompany: e.target.value })}
                          placeholder="J&T, Poslaju..." />
                      </div>
                      <div>
                        <Label>追踪号码</Label>
                        <Input value={shipForm.trackingNumber}
                          onChange={(e) => setShipForm({ ...shipForm, trackingNumber: e.target.value })}
                          placeholder="Tracking number" />
                      </div>
                    </div>
                    <Button size="sm" onClick={handleShip}>
                      <Truck className="h-4 w-4 mr-2" />
                      确认发货
                    </Button>
                  </div>
                )}
                {detailOrder.physicalStatus === "shipped" && (
                  <Button size="sm" variant="outline"
                    onClick={() => {
                      updateStatusMutation.mutate({ id: detailOrder.id, physicalStatus: "completed" });
                      setDetailOpen(false);
                    }}>
                    标记完成
                  </Button>
                )}
                {detailOrder.physicalStatus !== "completed" && detailOrder.physicalStatus !== "cancelled" && (
                  <Button size="sm" variant="destructive"
                    onClick={() => {
                      if (confirm("确定取消此订单？")) {
                        updateStatusMutation.mutate({ id: detailOrder.id, physicalStatus: "cancelled" });
                        setDetailOpen(false);
                      }
                    }}>
                    取消订单
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
