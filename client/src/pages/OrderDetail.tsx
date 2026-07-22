import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Package, Truck, CheckCircle, Clock, AlertCircle, PauseCircle, Bell, History, FileText, MessageSquare, User, Lock, Trash2, Plus, Sprout, Calendar } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: any; color: string }> = {
  pending: { label: "挂单", variant: "outline", color: "text-yellow-600" },
  receipt_uploaded: { label: "确认汇款", variant: "secondary", color: "text-blue-600" },
  partial_payment: { label: "部分汇款", variant: "secondary", color: "text-orange-600" },
  hold_order: { label: "保留订单", variant: "secondary", color: "text-purple-600" },
  packing: { label: "待包货", variant: "default", color: "text-cyan-600" },
  shipped: { label: "已发货", variant: "default", color: "text-green-600" },
  partial_shipped: { label: "部分发货", variant: "secondary", color: "text-teal-600" },
  completed: { label: "完成订单", variant: "default", color: "text-green-700" },
  cancelled: { label: "已取消", variant: "destructive", color: "text-red-600" },
};

const SOURCE_LABELS: Record<string, string> = {
  facebook_live: "Facebook Live",
  facebook_post: "Facebook Post",
  facebook_reel: "Facebook Reel",
  messenger: "Messenger",
  store: "商城",
  manual: "手动",
};

export default function OrderDetail({ orderId, onBack }: { orderId: number; onBack: () => void }) {
  const [holdOpen, setHoldOpen] = useState(false);
  const [statusTransitionOpen, setStatusTransitionOpen] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [remarkType, setRemarkType] = useState<"live" | "customer" | "internal">("live");
  const [repotOpen, setRepotOpen] = useState(false);
  const [repotForm, setRepotForm] = useState<any>({ orderItemId: 0, productId: 0, productName: "", potProductId: 0, potProductName: "", quantity: 1 });
  const [scheduledDate, setScheduledDate] = useState("");
  const [holdForm, setHoldForm] = useState<any>({
    holdType: "wait_next_live",
    scheduledShippingDate: "",
    allowAutoMerge: true,
    holdRemark: "",
  });
  const [targetStatus, setTargetStatus] = useState("");
  const [transitionNotes, setTransitionNotes] = useState("");
  const utils = trpc.useUtils();

  const { data: orderData, isLoading } = trpc.orders.getById.useQuery({ id: orderId });
  const order = orderData as any;
  const items = (orderData as any)?.items || [];
  const { data: statusLogs } = trpc.orderWorkflow.getStatusLogs.useQuery({ orderId });
  const { data: holdInfo } = trpc.holdOrders.getInfo.useQuery({ orderId });
  const { data: notifications } = trpc.notifications.list.useQuery({ orderId });
  const { data: remarks } = trpc.orderRemarks.list.useQuery({ orderId });
  const { data: repots } = trpc.repots.list.useQuery({ orderId });
  const { data: potProducts } = trpc.repots.potProducts.useQuery();

  const confirmPaymentMutation = trpc.orderWorkflow.confirmPayment.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      utils.orderWorkflow.invalidate();
      toast.success("付款已确认");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const transitionMutation = trpc.orderWorkflow.transition.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      utils.orderWorkflow.invalidate();
      toast.success("订单状态已更新");
      setStatusTransitionOpen(false);
      setTransitionNotes("");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const createHoldMutation = trpc.holdOrders.create.useMutation({
    onSuccess: () => {
      utils.holdOrders.invalidate();
      utils.orders.invalidate();
      toast.success("保留订单已创建");
      setHoldOpen(false);
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const releaseHoldMutation = trpc.holdOrders.release.useMutation({
    onSuccess: () => {
      utils.holdOrders.invalidate();
      utils.orders.invalidate();
      toast.success("保留订单已释放，状态已更新为待包货");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const createRemarkMutation = trpc.orderRemarks.create.useMutation({
    onSuccess: () => {
      utils.orderRemarks.invalidate();
      setRemarkText("");
      toast.success("备注已添加");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const deleteRemarkMutation = trpc.orderRemarks.delete.useMutation({
    onSuccess: () => {
      utils.orderRemarks.invalidate();
      toast.success("备注已删除");
    },
  });

  const createRepotMutation = trpc.repots.create.useMutation({
    onSuccess: () => {
      utils.repots.invalidate();
      setRepotOpen(false);
      toast.success("换盆已安排");
      setRepotForm({ orderItemId: 0, productId: 0, productName: "", potProductId: 0, potProductName: "", quantity: 1 });
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const deleteRepotMutation = trpc.repots.delete.useMutation({
    onSuccess: () => {
      utils.repots.invalidate();
      toast.success("换盆已取消");
    },
  });

  const setScheduledDateMutation = trpc.scheduledShipping.setDate.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      toast.success(scheduledDate ? "预约发货日期已设置" : "预约发货日期已取消");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">加载中...</div>;
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />返回</Button>
        <p className="text-center text-muted-foreground py-20">订单不存在</p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order?.physicalStatus || "pending"] || STATUS_CONFIG.pending;

  function handleConfirmPayment() {
    const hasHold = !!holdInfo?.isActive;
    confirmPaymentMutation.mutate({ orderId, hasHoldOrder: hasHold });
  }

  function handleCreateHold() {
    createHoldMutation.mutate({
      orderId,
      holdType: holdForm.holdType,
      scheduledShippingDate: holdForm.scheduledShippingDate ? new Date(holdForm.scheduledShippingDate).getTime() : undefined,
      allowAutoMerge: holdForm.allowAutoMerge,
      holdRemark: holdForm.holdRemark || undefined,
    });
  }

  function handleTransition() {
    if (!targetStatus) {
      toast.error("请选择目标状态");
      return;
    }
    transitionMutation.mutate({ orderId, toStatus: targetStatus as any, notes: transitionNotes || undefined });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />返回</Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              订单详情 <span className="font-mono text-lg text-muted-foreground">#{order.orderNumber}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(order.createdAt).toLocaleString("zh-CN")} · {SOURCE_LABELS[order.orderSource] || order.orderSource}
              {order.sourceName && ` · ${order.sourceName}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusCfg.variant} className={statusCfg.color}>
            {statusCfg.label}
          </Badge>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {order?.physicalStatus === "receipt_uploaded" && (
          <Button onClick={handleConfirmPayment} disabled={confirmPaymentMutation.isPending} className="bg-primary">
            <CheckCircle className="h-4 w-4 mr-2" />
            确认汇款
          </Button>
        )}
        {order?.physicalStatus === "receipt_uploaded" && (
          <Button variant="outline" onClick={() => setHoldOpen(true)}>
            <PauseCircle className="h-4 w-4 mr-2" />
            保留订单
          </Button>
        )}
        {order?.physicalStatus === "hold_order" && holdInfo?.isActive && (
          <Button onClick={() => releaseHoldMutation.mutate({ orderId })} disabled={releaseHoldMutation.isPending}>
            <Package className="h-4 w-4 mr-2" />
            释放保留 → 待包货
          </Button>
        )}
        <Button variant="outline" onClick={() => setStatusTransitionOpen(true)}>
          <History className="h-4 w-4 mr-2" />
          手动变更状态
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Order Items + Source Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items (Snapshots) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                商品明细 (快照)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>商品名称</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>规格</TableHead>
                    <TableHead>FB Keyword</TableHead>
                    <TableHead className="text-right">数量</TableHead>
                    <TableHead className="text-right">单价</TableHead>
                    <TableHead className="text-right">折扣</TableHead>
                    <TableHead className="text-right">小计</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">暂无商品</TableCell></TableRow>
                  ) : items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{item.productSku || "-"}</TableCell>
                      <TableCell className="text-sm">{item.variationName || "-"}</TableCell>
                      <TableCell>
                        {item.facebookKeyword ? (
                          <Badge variant="outline" className="font-mono">{item.facebookKeyword}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">RM {Number(item.unitPrice).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {Number(item.discount) > 0 ? `-RM ${Number(item.discount).toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">RM {Number(item.subtotal).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Facebook Comment Info */}
          {order.originalCustomerComment && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Facebook 留言资料
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-mono whitespace-pre-wrap">{order.originalCustomerComment}</p>
                </div>
                {order.commentDate && (
                  <p className="text-sm text-muted-foreground">
                    留言时间: {new Date(order.commentDate).toLocaleString("zh-CN")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                状态变更记录
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>从</TableHead>
                    <TableHead>到</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusLogs?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">暂无记录</TableCell></TableRow>
                  ) : statusLogs?.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">{new Date(log.createdAt).toLocaleString("zh-CN")}</TableCell>
                      <TableCell>
                        {log.fromStatus ? (
                          <Badge variant="outline">{STATUS_CONFIG[log.fromStatus]?.label || log.fromStatus}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{STATUS_CONFIG[log.toStatus]?.label || log.toStatus}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.changedBy || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right: Order Summary + Hold Info + Notifications */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader><CardTitle>订单摘要</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">商品小计</span>
                <span>RM {Number(order.physicalSubtotal).toFixed(2)}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>折扣</span>
                  <span>-RM {Number(order.discountAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">运费</span>
                <span>RM {Number(order.shippingFee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">总重量</span>
                <span>{Number(order.totalWeight).toFixed(2)} kg</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold text-lg">
                <span>总额</span>
                <span>RM {Number(order.totalAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">已付</span>
                <span className={Number(order.paidAmount) > 0 ? "text-green-600 font-medium" : ""}>
                  RM {Number(order.paidAmount).toFixed(2)}
                </span>
              </div>
              {Number(order.paidAmount) < Number(order.totalAmount) && Number(order.paidAmount) > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>未付</span>
                  <span>RM {(Number(order.totalAmount) - Number(order.paidAmount)).toFixed(2)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader><CardTitle>付款方式</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">方式</span>
                <span className="font-medium">{order.paymentMethodName || "-"}</span>
              </div>
              {order.receiptUrl && (
                <div>
                  <a href={order.receiptUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />查看付款凭证
                    </Button>
                  </a>
                </div>
              )}
              {order.paymentUploadedAt && (
                <p className="text-xs text-muted-foreground">
                  上传时间: {new Date(order.paymentUploadedAt).toLocaleString("zh-CN")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Hold Order Info */}
          {holdInfo?.isActive && (
            <Card className="border-purple-200">
              <CardHeader><CardTitle className="text-purple-700">保留订单</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">类型</span>
                  <span className="font-medium">
                    {holdInfo.holdType === "wait_next_live" ? "等待下次直播" :
                     holdInfo.holdType === "scheduled_shipping" ? "指定日期发货" :
                     holdInfo.holdType === "wait_stock" ? "等待缺货商品" : "其他"}
                  </span>
                </div>
                {holdInfo.scheduledShippingDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">预定发货日</span>
                    <span>{new Date(holdInfo.scheduledShippingDate).toLocaleDateString("zh-CN")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">允许自动合并</span>
                  <Badge variant={holdInfo.allowAutoMerge ? "default" : "outline"}>
                    {holdInfo.allowAutoMerge ? "是" : "否"}
                  </Badge>
                </div>
                {holdInfo.holdRemark && (
                  <p className="text-muted-foreground italic">"{holdInfo.holdRemark}"</p>
                )}
                <p className="text-xs text-muted-foreground">
                  保留时间: {new Date(holdInfo.holdCreatedAt).toLocaleString("zh-CN")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Notification History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                通知记录
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {notifications?.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无通知记录</p>
              ) : notifications?.map((n: any) => (
                <div key={n.id} className="flex items-start gap-2 text-sm p-2 border rounded-lg">
                  <Badge variant={n.status === "sent" ? "default" : n.status === "failed" ? "destructive" : "outline"}>
                    {n.status === "sent" ? "已发送" : n.status === "failed" ? "失败" : "待发送"}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{n.channel} · {n.type}</p>
                    {n.errorMessage && <p className="text-xs text-destructive">{n.errorMessage}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* V1.1: Remarks Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            订单备注 (3种类型)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Remark Form */}
          <div className="flex gap-2 items-start">
            <Select value={remarkType} onValueChange={(v) => setRemarkType(v as any)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="live">直播备注</SelectItem>
                <SelectItem value="customer">客户备注</SelectItem>
                <SelectItem value="internal">内部备注</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              placeholder="输入备注内容..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && remarkText.trim()) {
                  createRemarkMutation.mutate({ orderId, type: remarkType, content: remarkText.trim() });
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => remarkText.trim() && createRemarkMutation.mutate({ orderId, type: remarkType, content: remarkText.trim() })}
              disabled={!remarkText.trim() || createRemarkMutation.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Remarks List */}
          <div className="space-y-2">
            {remarks?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无备注</p>
            ) : remarks?.map((r: any) => (
              <div key={r.id} className="flex items-start gap-2 p-3 border rounded-lg">
                {r.type === "live" ? <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5" /> :
                 r.type === "customer" ? <User className="h-4 w-4 text-green-500 mt-0.5" /> :
                 <Lock className="h-4 w-4 text-orange-500 mt-0.5" />}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={r.type === "live" ? "text-blue-600" : r.type === "customer" ? "text-green-600" : "text-orange-600"}>
                      {r.type === "live" ? "直播" : r.type === "customer" ? "客户" : "内部"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{r.createdBy} · {new Date(r.createdAt).toLocaleString("zh-CN")}</span>
                  </div>
                  <p className="text-sm mt-1">{r.content}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteRemarkMutation.mutate({ id: r.id })}>
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* V1.1: Repot (换盆) Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sprout className="h-5 w-5" />
            换盆安排
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button size="sm" onClick={() => setRepotOpen(true)} disabled={items.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            新增换盆
          </Button>

          {/* Repots List */}
          <div className="space-y-2">
            {repots?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无换盆安排</p>
            ) : repots?.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <Sprout className="h-5 w-5 text-blue-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.productName} → {r.potProductName}</p>
                  <p className="text-xs text-muted-foreground">数量: {r.quantity}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteRepotMutation.mutate({ id: r.id })}>
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* V1.1: Scheduled Shipping Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            预约发货
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Input
            type="date"
            value={scheduledDate || (order?.scheduledShippingDate ? new Date(order.scheduledShippingDate).toISOString().split("T")[0] : "")}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-48"
          />
          <Button
            size="sm"
            onClick={() => setScheduledDateMutation.mutate({ orderId, date: scheduledDate || null })}
            disabled={setScheduledDateMutation.isPending}
          >
            设置预约
          </Button>
          {order?.scheduledShippingDate && (
            <Button size="sm" variant="outline" onClick={() => { setScheduledDate(""); setScheduledDateMutation.mutate({ orderId, date: null }); }}>
              取消预约
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Hold Order Dialog */}
      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>保留订单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>保留类型</Label>
              <Select value={holdForm.holdType} onValueChange={(v) => setHoldForm((p: any) => ({ ...p, holdType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wait_next_live">等待下次直播加单</SelectItem>
                  <SelectItem value="scheduled_shipping">指定日期发货</SelectItem>
                  <SelectItem value="wait_stock">等待缺货商品</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {holdForm.holdType === "scheduled_shipping" && (
              <div>
                <Label>预定发货日期</Label>
                <Input
                  type="date"
                  value={holdForm.scheduledShippingDate}
                  onChange={(e) => setHoldForm((p: any) => ({ ...p, scheduledShippingDate: e.target.value }))}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={holdForm.allowAutoMerge}
                onChange={(e) => setHoldForm((p: any) => ({ ...p, allowAutoMerge: e.target.checked }))}
                className="rounded"
              />
              <Label>允许自动合并新订单</Label>
            </div>
            <div>
              <Label>保留备注</Label>
              <Textarea
                value={holdForm.holdRemark}
                onChange={(e) => setHoldForm((p: any) => ({ ...p, holdRemark: e.target.value }))}
                placeholder="保留原因说明..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldOpen(false)}>取消</Button>
            <Button onClick={handleCreateHold} disabled={createHoldMutation.isPending}>确认保留</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* V1.1: Repot Dialog */}
      <Dialog open={repotOpen} onOpenChange={setRepotOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增换盆</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>选择商品</Label>
              <Select value={String(repotForm.orderItemId)} onValueChange={(v) => {
                const item = items.find((i: any) => i.id === Number(v));
                if (item) {
                  setRepotForm((p: any) => ({ ...p, orderItemId: Number(v), productId: item.productId, productName: item.productName }));
                }
              }}>
                <SelectTrigger><SelectValue placeholder="选择订单商品" /></SelectTrigger>
                <SelectContent>
                  {items.map((item: any) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.productName} (x{item.quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>选择花盆</Label>
              <Select value={String(repotForm.potProductId)} onValueChange={(v) => {
                const pot = potProducts?.find((p: any) => p.id === Number(v));
                if (pot) {
                  setRepotForm((p: any) => ({ ...p, potProductId: Number(v), potProductName: pot.name }));
                }
              }}>
                <SelectTrigger><SelectValue placeholder="选择花盆商品" /></SelectTrigger>
                <SelectContent>
                  {potProducts?.map((pot: any) => (
                    <SelectItem key={pot.id} value={String(pot.id)}>
                      {pot.name} {pot.potCapacity ? `(${pot.potCapacity})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>换盆数量</Label>
              <Input
                type="number"
                min={1}
                value={repotForm.quantity}
                onChange={(e) => setRepotForm((p: any) => ({ ...p, quantity: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepotOpen(false)}>取消</Button>
            <Button
              onClick={() => createRepotMutation.mutate(repotForm)}
              disabled={!repotForm.orderItemId || !repotForm.potProductId || createRepotMutation.isPending}
            >
              确认换盆
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Transition Dialog */}
      <Dialog open={statusTransitionOpen} onOpenChange={setStatusTransitionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>手动变更订单状态</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>当前状态</Label>
              <Badge variant={statusCfg.variant} className={statusCfg.color}>{statusCfg.label}</Badge>
            </div>
            <div>
              <Label>目标状态</Label>
              <Select value={targetStatus} onValueChange={setTargetStatus}>
                <SelectTrigger><SelectValue placeholder="选择状态" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>备注</Label>
              <Textarea
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                placeholder="变更原因..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTransitionOpen(false)}>取消</Button>
            <Button onClick={handleTransition} disabled={transitionMutation.isPending}>确认变更</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
