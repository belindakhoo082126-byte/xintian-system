import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
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
  pending: { label: translate("挂单", "Pending"), variant: "outline", color: "text-yellow-600" },
  receipt_uploaded: { label: translate("确认汇款", "Payment Confirmed"), variant: "secondary", color: "text-blue-600" },
  partial_payment: { label: translate("部分汇款", "Partial Payment"), variant: "secondary", color: "text-orange-600" },
  hold_order: { label: translate("保留订单", "Hold Order"), variant: "secondary", color: "text-purple-600" },
  packing: { label: translate("待包货", "Packing"), variant: "default", color: "text-cyan-600" },
  shipped: { label: translate("已发货", "Shipped"), variant: "default", color: "text-green-600" },
  partial_shipped: { label: translate("部分发货", "Partial Shipped"), variant: "secondary", color: "text-teal-600" },
  completed: { label: translate("完成订单", "Completed"), variant: "default", color: "text-green-700" },
  cancelled: { label: translate("已取消", "Cancelled"), variant: "destructive", color: "text-red-600" },
};

const SOURCE_LABELS: Record<string, string> = {
  facebook_live: "Facebook Live",
  facebook_post: "Facebook Post",
  facebook_reel: "Facebook Reel",
  messenger: "Messenger",
  store: translate("商城", "Store"),
  manual: translate("手动", "Manual"),
};

export default function OrderDetail({ orderId, onBack }: { orderId: number; onBack: () => void }) {
  const { translate, lang } = useI18n();
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
      toast.success(translate("付款已确认", "Payment confirmed"));
    },
    onError: (e) => toast.error(translate("操作失败", "Operation failed") + `: ${e.message}`),
  });

  const transitionMutation = trpc.orderWorkflow.transition.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      utils.orderWorkflow.invalidate();
      toast.success(translate("订单状态已更新", "Order status updated"));
      setStatusTransitionOpen(false);
      setTransitionNotes("");
    },
    onError: (e) => toast.error(translate("操作失败", "Operation failed") + `: ${e.message}`),
  });

  const createHoldMutation = trpc.holdOrders.create.useMutation({
    onSuccess: () => {
      utils.holdOrders.invalidate();
      utils.orders.invalidate();
      toast.success(translate("保留订单已创建", "Hold order created"));
      setHoldOpen(false);
    },
    onError: (e) => toast.error(translate("操作失败", "Operation failed") + `: ${e.message}`),
  });

  const releaseHoldMutation = trpc.holdOrders.release.useMutation({
    onSuccess: () => {
      utils.holdOrders.invalidate();
      utils.orders.invalidate();
      toast.success(translate("保留订单已释放，状态已更新为待包货", "Hold order released, status updated to packing"));
    },
    onError: (e) => toast.error(translate("操作失败", "Operation failed") + `: ${e.message}`),
  });

  const createRemarkMutation = trpc.orderRemarks.create.useMutation({
    onSuccess: () => {
      utils.orderRemarks.invalidate();
      setRemarkText("");
      toast.success(translate("备注已添加", "Remark added"));
    },
    onError: (e) => toast.error(translate("操作失败", "Operation failed") + `: ${e.message}`),
  });

  const deleteRemarkMutation = trpc.orderRemarks.delete.useMutation({
    onSuccess: () => {
      utils.orderRemarks.invalidate();
      toast.success(translate("备注已删除", "Remark deleted"));
    },
  });

  const createRepotMutation = trpc.repots.create.useMutation({
    onSuccess: () => {
      utils.repots.invalidate();
      setRepotOpen(false);
      toast.success(translate("换盆已安排", "Repot arranged"));
      setRepotForm({ orderItemId: 0, productId: 0, productName: "", potProductId: 0, potProductName: "", quantity: 1 });
    },
    onError: (e) => toast.error(translate("操作失败", "Operation failed") + `: ${e.message}`),
  });

  const deleteRepotMutation = trpc.repots.delete.useMutation({
    onSuccess: () => {
      utils.repots.invalidate();
      toast.success(translate("换盆已取消", "Repot cancelled"));
    },
  });

  const setScheduledDateMutation = trpc.scheduledShipping.setDate.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      toast.success(scheduledDate ? translate("预约发货日期已设置", "Scheduled shipping date set") : translate("预约发货日期已取消", "Scheduled shipping date cancelled"));
    },
    onError: (e) => toast.error(translate("操作失败", "Operation failed") + `: ${e.message}`),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">{translate("加载中...", "Loading...")}</div>;
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />{translate("返回", "Back")}</Button>
        <p className="text-center text-muted-foreground py-20">{translate("订单不存在", "Order does not exist")}</p>
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
      toast.error(translate("请选择目标状态", "Please select target status"));
      return;
    }
    transitionMutation.mutate({ orderId, toStatus: targetStatus as any, notes: transitionNotes || undefined });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />{translate("返回", "Back")}</Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {translate("订单详情", "Order Detail")} <span className="font-mono text-lg text-muted-foreground">#{order.orderNumber}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(order.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")} · {SOURCE_LABELS[order.orderSource] || order.orderSource}
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
            {translate("确认汇款", "Confirm Payment")}
          </Button>
        )}
        {order?.physicalStatus === "receipt_uploaded" && (
          <Button variant="outline" onClick={() => setHoldOpen(true)}>
            <PauseCircle className="h-4 w-4 mr-2" />
            {translate("保留订单", "Hold Order")}
          </Button>
        )}
        {order?.physicalStatus === "hold_order" && holdInfo?.isActive && (
          <Button onClick={() => releaseHoldMutation.mutate({ orderId })} disabled={releaseHoldMutation.isPending}>
            <Package className="h-4 w-4 mr-2" />
            {translate("释放保留 → 待包货", "Release Hold → Packing")}
          </Button>
        )}
        <Button variant="outline" onClick={() => setStatusTransitionOpen(true)}>
          <History className="h-4 w-4 mr-2" />
            {translate("手动变更状态", "Change Status Manually")}
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
                {translate("商品明细 (快照)", "Order Items (Snapshot)")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate("商品名称", "Product Name")}</TableHead>
                    <TableHead>{translate("SKU", "SKU")}</TableHead>
                    <TableHead>{translate("规格", "Specification")}</TableHead>
                    <TableHead>{translate("FB Keyword", "FB Keyword")}</TableHead>
                    <TableHead className="text-right">{translate("数量", "Quantity")}</TableHead>
                    <TableHead className="text-right">{translate("单价", "Unit Price")}</TableHead>
                    <TableHead className="text-right">{translate("折扣", "Discount")}</TableHead>
                    <TableHead className="text-right">{translate("小计", "Subtotal")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{translate("暂无商品", "No products yet")}</TableCell></TableRow>
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
                  {translate("Facebook 留言资料", "Facebook Comment Info")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-mono whitespace-pre-wrap">{order.originalCustomerComment}</p>
                </div>
                {order.commentDate && (
                  <p className="text-sm text-muted-foreground">
                    {translate("留言时间", "Comment Time")}: {new Date(order.commentDate).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}
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
                {translate("状态变更记录", "Status Change History")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate("时间", "Time")}</TableHead>
                    <TableHead>{translate("从", "From")}</TableHead>
                    <TableHead>{translate("到", "To")}</TableHead>
                    <TableHead>{translate("操作人", "Operator")}</TableHead>
                    <TableHead>{translate("备注", "Notes")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusLogs?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{translate("暂无记录", "No records yet")}</TableCell></TableRow>
                  ) : statusLogs?.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">{new Date(log.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</TableCell>
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
            <CardHeader><CardTitle>{translate("订单摘要", "Order Summary")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{translate("商品小计", "Subtotal")}</span>
                <span>RM {Number(order.physicalSubtotal).toFixed(2)}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>{translate("折扣", "Discount")}</span>
                  <span>-RM {Number(order.discountAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{translate("运费", "Shipping Fee")}</span>
                <span>RM {Number(order.shippingFee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{translate("总重量", "Total Weight")}</span>
                <span>{Number(order.totalWeight).toFixed(2)} kg</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold text-lg">
                <span>{translate("总额", "Total Amount")}</span>
                <span>RM {Number(order.totalAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{translate("已付", "Paid")}</span>
                <span className={Number(order.paidAmount) > 0 ? "text-green-600 font-medium" : ""}>
                  RM {Number(order.paidAmount).toFixed(2)}
                </span>
              </div>
              {Number(order.paidAmount) < Number(order.totalAmount) && Number(order.paidAmount) > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>{translate("未付", "Unpaid")}</span>
                  <span>RM {(Number(order.totalAmount) - Number(order.paidAmount)).toFixed(2)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader><CardTitle>{translate("付款方式", "Payment Method")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{translate("方式", "Method")}</span>
                <span className="font-medium">{order.paymentMethodName || "-"}</span>
              </div>
              {order.receiptUrl && (
                <div>
                  <a href={order.receiptUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />{translate("查看付款凭证", "View Payment Proof")}
                    </Button>
                  </a>
                </div>
              )}
              {order.paymentUploadedAt && (
                <p className="text-xs text-muted-foreground">
                  {translate("上传时间", "Upload Time")}: {new Date(order.paymentUploadedAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Hold Order Info */}
          {holdInfo?.isActive && (
            <Card className="border-purple-200">
              <CardHeader><CardTitle className="text-purple-700">{translate("保留订单", "Hold Order")}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{translate("类型", "Type")}</span>
                  <span className="font-medium">
                    {holdInfo.holdType === "wait_next_live" ? translate("等待下次直播", "Wait for next live") :
                     holdInfo.holdType === "scheduled_shipping" ? translate("指定日期发货", "Scheduled Shipping") :
                     holdInfo.holdType === "wait_stock" ? translate("等待缺货商品", "Wait for out of stock products") : translate("其他", "Other")}
                  </span>
                </div>
                {holdInfo.scheduledShippingDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{translate("预定发货日", "Scheduled Shipping Date")}</span>
                    <span>{new Date(holdInfo.scheduledShippingDate).toLocaleDateString("zh-CN")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{translate("允许自动合并", "Allow Auto Merge")}</span>
                  <Badge variant={holdInfo.allowAutoMerge ? "default" : "outline"}>
                    {holdInfo.allowAutoMerge ? translate("是", "Yes") : translate("否", "No")}
                  </Badge>
                </div>
                {holdInfo.holdRemark && (
                  <p className="text-muted-foreground italic">"{holdInfo.holdRemark}"</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {translate("保留时间", "Hold Time")}: {new Date(holdInfo.holdCreatedAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Notification History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {translate("通知记录", "Notification History")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {notifications?.length === 0 ? (
                <p className="text-sm text-muted-foreground">{translate("暂无通知记录", "No notification records yet")}</p>
              ) : notifications?.map((n: any) => (
                <div key={n.id} className="flex items-start gap-2 text-sm p-2 border rounded-lg">
                  <Badge variant={n.status === "sent" ? "default" : n.status === "failed" ? "destructive" : "outline"}>
                    {n.status === "sent" ? translate("已发送", "Sent") : n.status === "failed" ? translate("失败", "Failed") : translate("待发送", "Pending")}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{n.channel} · {n.type}</p>
                    {n.errorMessage && <p className="text-xs text-destructive">{n.errorMessage}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}
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
                {translate("订单备注 (3种类型)", "Order Remarks (3 Types)")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Remark Form */}
          <div className="flex gap-2 items-start">
            <Select value={remarkType} onValueChange={(v) => setRemarkType(v as any)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="live">{translate("直播备注", "Live Remark")}</SelectItem>
                <SelectItem value="customer">{translate("客户备注", "Customer Remark")}</SelectItem>
                <SelectItem value="internal">{translate("内部备注", "Internal Remark")}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              placeholder={translate("输入备注内容...", "Enter remark content...")}
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
              <p className="text-sm text-muted-foreground text-center py-4">{translate("暂无备注", "No remarks yet")}</p>
            ) : remarks?.map((r: any) => (
              <div key={r.id} className="flex items-start gap-2 p-3 border rounded-lg">
                {r.type === "live" ? <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5" /> :
                 r.type === "customer" ? <User className="h-4 w-4 text-green-500 mt-0.5" /> :
                 <Lock className="h-4 w-4 text-orange-500 mt-0.5" />}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={r.type === "live" ? "text-blue-600" : r.type === "customer" ? "text-green-600" : "text-orange-600"}>
                      {r.type === "live" ? translate("直播", "Live") : r.type === "customer" ? translate("客户", "Customer") : translate("内部", "Internal")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{r.createdBy} · {new Date(r.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</span>
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
            {translate("换盆安排", "Repot Arrangement")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button size="sm" onClick={() => setRepotOpen(true)} disabled={items.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            {translate("新增换盆", "Add Repot")}
          </Button>

          {/* Repots List */}
          <div className="space-y-2">
            {repots?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{translate("暂无换盆安排", "No repot arrangements yet")}</p>
            ) : repots?.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <Sprout className="h-5 w-5 text-blue-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.productName} → {r.potProductName}</p>
                  <p className="text-xs text-muted-foreground">{translate("数量", "Quantity")}: {r.quantity}</p>
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
            {translate("预约发货", "Scheduled Shipping")}
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
            {translate("设置预约", "Set Schedule")}
          </Button>
          {order?.scheduledShippingDate && (
            <Button size="sm" variant="outline" onClick={() => { setScheduledDate(""); setScheduledDateMutation.mutate({ orderId, date: null }); }}>
              {translate("取消预约", "Cancel Schedule")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Hold Order Dialog */}
      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("保留订单", "Hold Order")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("保留类型", "Hold Type")}</Label>
              <Select value={holdForm.holdType} onValueChange={(v) => setHoldForm((p: any) => ({ ...p, holdType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wait_next_live">{translate("等待下次直播加单", "Wait for next live order")}</SelectItem>
                  <SelectItem value="scheduled_shipping">{translate("指定日期发货", "Scheduled Shipping")}</SelectItem>
                  <SelectItem value="wait_stock">{translate("等待缺货商品", "Wait for out of stock products")}</SelectItem>
                  <SelectItem value="other">{translate("其他", "Other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {holdForm.holdType === "scheduled_shipping" && (
              <div>
                <Label>{translate("预定发货日期", "Scheduled Shipping Date")}</Label>
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
              <Label>{translate("允许自动合并新订单", "Allow automatic merging of new orders")}</Label>
            </div>
            <div>
              <Label>{translate("保留备注", "Hold Remark")}</Label>
              <Textarea
                value={holdForm.holdRemark}
                onChange={(e) => setHoldForm((p: any) => ({ ...p, holdRemark: e.target.value }))}
                placeholder={translate("保留原因说明...", "Reason for hold...")}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={handleCreateHold} disabled={createHoldMutation.isPending}>{translate("确认保留", "Confirm Hold")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* V1.1: Repot Dialog */}
      <Dialog open={repotOpen} onOpenChange={setRepotOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("新增换盆", "Add Repot")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("选择商品", "Select Product")}</Label>
              <Select value={String(repotForm.orderItemId)} onValueChange={(v) => {
                const item = items.find((i: any) => i.id === Number(v));
                if (item) {
                  setRepotForm((p: any) => ({ ...p, orderItemId: Number(v), productId: item.productId, productName: item.productName }));
                }
              }}>
                <SelectTrigger><SelectValue placeholder={translate("选择订单商品", "Select order product")} /></SelectTrigger>
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
              <Label>{translate("选择花盆", "Select Pot")}</Label>
              <Select value={String(repotForm.potProductId)} onValueChange={(v) => {
                const pot = potProducts?.find((p: any) => p.id === Number(v));
                if (pot) {
                  setRepotForm((p: any) => ({ ...p, potProductId: Number(v), potProductName: pot.name }));
                }
              }}>
                <SelectTrigger><SelectValue placeholder={translate("选择花盆商品", "Select pot product")} /></SelectTrigger>
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
              <Label>{translate("换盆数量", "Repot Quantity")}</Label>
              <Input
                type="number"
                min={1}
                value={repotForm.quantity}
                onChange={(e) => setRepotForm((p: any) => ({ ...p, quantity: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepotOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button
              onClick={() => createRepotMutation.mutate(repotForm)}
              disabled={!repotForm.orderItemId || !repotForm.potProductId || createRepotMutation.isPending}
            >
              {translate("确认换盆", "Confirm Repot")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Transition Dialog */}
      <Dialog open={statusTransitionOpen} onOpenChange={setStatusTransitionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("手动变更订单状态", "Manually Change Order Status")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("当前状态", "Current Status")}</Label>
              <Badge variant={statusCfg.variant} className={statusCfg.color}>{statusCfg.label}</Badge>
            </div>
            <div>
              <Label>{translate("目标状态", "Target Status")}</Label>
              <Select value={targetStatus} onValueChange={setTargetStatus}>
                <SelectTrigger><SelectValue placeholder={translate("选择状态", "Select Status")} /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{translate("备注", "Notes")}</Label>
              <Textarea
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                placeholder={translate("变更原因...", "Reason for change...")}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTransitionOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={handleTransition} disabled={transitionMutation.isPending}>{translate("确认变更", "Confirm Change")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
