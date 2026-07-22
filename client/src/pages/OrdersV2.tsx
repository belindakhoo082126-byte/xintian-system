import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Search, Eye, Truck, Plus, Copy, CheckCircle, XCircle, Clock,
  Package, AlertTriangle, Banknote, Bell, FileText, ChevronLeft, ChevronRight,
  StickyNote, ListChecks, Trash2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const PHYSICAL_STATUS: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  pending: { label: "挂单", variant: "outline" },
  receipt_uploaded: { label: "已上传单据", variant: "secondary" },
  payment_confirmed: { label: "已确认汇款", variant: "default" },
  packing: { label: "配货中", variant: "default" },
  shipped: { label: "已发货", variant: "default" },
  completed: { label: "已完成", variant: "default" },
  cancelled: { label: "已取消", variant: "destructive" },
};

const ORDER_SOURCE: Record<string, string> = {
  facebook_live: "FB 直播",
  facebook_comment: "FB 留言",
  facebook_messenger: "FB Messenger",
  whatsapp: "WhatsApp",
  store: "商城",
  backend: "后台",
};

const SHIPPING_METHOD: Record<string, string> = {
  west_malaysia: "西马",
  east_malaysia_shopee: "东马 Shopee",
  east_malaysia_poslaju: "东马 Poslaju",
  self_pickup: "自取",
  lalamove: "Lalamove",
};

const PAYMENT_METHOD: Record<string, string> = {
  online_banking: "网银转账",
  tng: "Touch n Go",
  cash: "现金",
  shopee: "Shopee",
  bank_transfer: "银行转账",
  other: "其他",
};

interface ManualOrderItem {
  productId: number | undefined;
  productName: string;
  productType: "physical" | "membership" | "gift";
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export default function OrdersV2() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [shippingFilter, setShippingFilter] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({
    noteType: "internal_note" as "customer_note" | "internal_note" | "checkout_note",
    content: "",
    needsAction: false,
  });

  // Order notes query
  const { data: orderNotes, refetch: refetchNotes } = trpc.orderNotes.list.useQuery(
    { orderId: detailOrderId!, includeInternal: true },
    { enabled: detailOrderId !== null }
  );

  // Action items for this order
  const { data: orderActionItems, refetch: refetchActions } = trpc.actionItems.list.useQuery(
    { limit: 50, offset: 0 },
    { enabled: detailOrderId !== null }
  );

  const addNoteMutation = trpc.orderNotes.add.useMutation({
    onSuccess: () => {
      refetchNotes();
      refetchActions();
      setAddNoteOpen(false);
      setNoteForm({ noteType: "internal_note", content: "", needsAction: false });
      toast.success("备注已添加");
    },
  });

  const deleteNoteMutation = trpc.orderNotes.delete.useMutation({
    onSuccess: () => { refetchNotes(); toast.success("备注已删除"); },
  });

  const completeActionMutation = trpc.actionItems.complete.useMutation({
    onSuccess: () => { refetchActions(); toast.success("事项已完成"); },
  });
  const [shipForm, setShipForm] = useState({ courierId: "", trackingNumber: "", shipmentDate: "" });
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [manualItems, setManualItems] = useState<ManualOrderItem[]>([]);
  const [customerForm, setCustomerForm] = useState({
    facebookName: "", facebookId: "", messengerId: "",
    name: "", phoneNumber: "", address: "", shippingMethod: "west_malaysia",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "", paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "online_banking", purpose: "", notes: "",
  });
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);

  const utils = trpc.useUtils();

  // Queries
  const { data: workQueue } = trpc.ordersV2.workQueue.useQuery();
  const { data: couriers } = trpc.couriers.list.useQuery({ activeOnly: true });
  const { data: products } = trpc.products.list.useQuery({});
  const { data: ordersData, isLoading } = trpc.ordersV2.list.useQuery({
    search: search || undefined,
    physicalStatus: statusFilter !== "all" ? statusFilter : undefined,
    orderSource: sourceFilter !== "all" ? sourceFilter : undefined,
    shippingMethod: shippingFilter !== "all" ? shippingFilter : undefined,
    limit: pageSize,
    offset: page * pageSize,
  });

  const orders = ordersData?.items ?? [];
  const total = ordersData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Detail query - separate to get full detail with payments/notifications/audit
  const { data: detailOrder, refetch: refetchDetail } = trpc.ordersV2.getById.useQuery(
    { id: detailOrderId! },
    { enabled: detailOrderId !== null }
  );

  // Mutations
  const shipMutation = trpc.ordersV2.ship.useMutation({
    onSuccess: () => {
      utils.ordersV2.invalidate();
      toast.success("发货成功");
      setShipDialogOpen(false);
      setShipForm({ courierId: "", trackingNumber: "", shipmentDate: "" });
      refetchDetail();
    },
    onError: (e) => toast.error(`发货失败: ${e.message}`),
  });

  const cancelMutation = trpc.ordersV2.cancel.useMutation({
    onSuccess: () => {
      utils.ordersV2.invalidate();
      toast.success("订单已取消");
      refetchDetail();
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const completeMutation = trpc.ordersV2.complete.useMutation({
    onSuccess: () => {
      utils.ordersV2.invalidate();
      toast.success("订单已完成");
      refetchDetail();
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const addPaymentMutation = trpc.orderPayments.add.useMutation({
    onSuccess: () => {
      utils.ordersV2.invalidate();
      toast.success("付款纪录已添加");
      setAddPaymentOpen(false);
      setPaymentForm({ amount: "", paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: "online_banking", purpose: "", notes: "" });
      refetchDetail();
    },
    onError: (e) => toast.error(`添加失败: ${e.message}`),
  });

  const markManualMutation = trpc.orderNotifications.markManual.useMutation({
    onSuccess: () => {
      utils.orderNotifications.invalidate();
      toast.success("已标记为人工通知");
      refetchDetail();
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const findCustomerMutation = trpc.customers.findOrCreate.useMutation({
    onSuccess: (customer: any) => {
      createOrderMutation.mutate({
        customerId: customer.id,
        facebookName: customerForm.facebookName || undefined,
        facebookId: customerForm.facebookId || undefined,
        messengerId: customerForm.messengerId || undefined,
        items: manualItems.filter(i => i.productId !== undefined).map(i => ({
          productId: i.productId!,
          productName: i.productName,
          productType: i.productType,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal,
        })),
        shippingAddress: customerForm.address || undefined,
        shippingMethod: customerForm.shippingMethod || undefined,
      });
    },
    onError: (e) => toast.error(`客户创建失败: ${e.message}`),
  });

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: (r: any) => {
      utils.ordersV2.invalidate();
      toast.success(`订单创建成功: ${r.orderNumber}`);
      setCreateOpen(false);
      setManualItems([]);
      setCustomerForm({ facebookName: "", facebookId: "", messengerId: "", name: "", phoneNumber: "", address: "", shippingMethod: "west_malaysia" });
    },
    onError: (e) => toast.error(`订单创建失败: ${e.message}`),
  });

  // Helpers
  function addManualItem() {
    setManualItems([...manualItems, { productId: undefined, productName: "", productType: "physical", quantity: 1, unitPrice: "0", subtotal: "0" }]);
  }

  function removeManualItem(idx: number) {
    setManualItems(manualItems.filter((_, i) => i !== idx));
  }

  function updateManualItem(idx: number, field: keyof ManualOrderItem, value: any) {
    const newItems = [...manualItems];
    newItems[idx] = { ...newItems[idx], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      const qty = parseFloat(String(newItems[idx].quantity)) || 0;
      const price = parseFloat(String(newItems[idx].unitPrice)) || 0;
      newItems[idx].subtotal = (qty * price).toFixed(2);
    }
    setManualItems(newItems);
  }

  function handleManualItemProductSelect(idx: number, productId: string) {
    if (productId === "none") return;
    const product = products?.find((p: any) => p.id === parseInt(productId));
    if (product) {
      updateManualItem(idx, "productId", product.id);
      updateManualItem(idx, "productName", product.name);
      updateManualItem(idx, "productType", product.type);
      updateManualItem(idx, "unitPrice", product.sellingPrice || product.regularPrice || "0");
      const qty = manualItems[idx].quantity;
      const price = parseFloat(product.sellingPrice || product.regularPrice || "0") || 0;
      const newItems = [...manualItems];
      newItems[idx] = { ...newItems[idx], subtotal: (qty * price).toFixed(2) };
      setManualItems(newItems);
    }
  }

  function handleCreateOrder() {
    if (manualItems.length === 0 || manualItems.every(i => i.productId === undefined)) {
      toast.error("请至少添加一个商品");
      return;
    }
    if (!customerForm.name.trim() && !customerForm.facebookName.trim()) {
      toast.error("请输入客户名称或 Facebook 名称");
      return;
    }
    findCustomerMutation.mutate({
      facebookId: customerForm.facebookId || undefined,
      facebookName: customerForm.facebookName || undefined,
      messengerId: customerForm.messengerId || undefined,
      name: customerForm.name || undefined,
      phoneNumber: customerForm.phoneNumber || undefined,
    });
  }

  function openDetail(orderId: number) {
    setDetailOrderId(orderId);
    setDetailOpen(true);
  }

  function handleShip() {
    if (!detailOrder) return;
    if (!shipForm.trackingNumber) {
      toast.error("请填写追踪号码");
      return;
    }
    shipMutation.mutate({
      id: detailOrder.id,
      courierId: shipForm.courierId ? parseInt(shipForm.courierId) : undefined,
      trackingNumber: shipForm.trackingNumber,
      shipmentDate: shipForm.shipmentDate || undefined,
    });
  }

  function handleAddPayment() {
    if (!detailOrder) return;
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error("请输入有效金额");
      return;
    }
    addPaymentMutation.mutate({
      orderId: detailOrder.id,
      amount: paymentForm.amount,
      paymentDate: new Date(paymentForm.paymentDate).toISOString(),
      paymentMethod: paymentForm.paymentMethod as any,
      purpose: paymentForm.purpose || undefined,
      notes: paymentForm.notes || undefined,
    });
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} 已复制`);
    }).catch(() => {
      toast.error("复制失败");
    });
  }

  function buildShippingNotice(order: any): string {
    const courier = order.courierCompany || "";
    const tracking = order.trackingNumber || "";
    const trackingMyUrl = tracking ? `https://www.tracking.my/track/${tracking}` : "";
    return `亲爱的 ${order.facebookName || "顾客"}，您的订单已发货！\n快递: ${courier}\n追踪号码: ${tracking}\n查询链接: ${trackingMyUrl}\n如有疑问请联系我们，谢谢！`;
  }

  // Work queue cards
  const queueCards = [
    { key: "pending", label: "挂单", icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
    { key: "payment_confirmed", label: "确认汇款", icon: Banknote, color: "text-green-600", bg: "bg-green-50" },
    { key: "east_malaysia_shopee", label: "东马 Shopee", icon: Package, color: "text-orange-600", bg: "bg-orange-50" },
    { key: "shipping_shortfall", label: "欠运费", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
    { key: "reserved", label: "保留", icon: FileText, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">订单管理</h1>
          <p className="text-sm text-muted-foreground mt-1">XLCS V1.0 增强版订单处理</p>
        </div>
        <Button onClick={() => { setManualItems([]); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />手动建单
        </Button>
      </div>

      {/* Work Queue Stats Bar */}
      {workQueue && (
        <div className="grid grid-cols-5 gap-3">
          {queueCards.map(card => {
            const count = (workQueue as any)[card.key] ?? 0;
            const Icon = card.icon;
            return (
              <Card
                key={card.key}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  if (card.key === "east_malaysia_shopee") {
                    setShippingFilter("east_malaysia_shopee");
                    setStatusFilter("all");
                  } else if (card.key === "shipping_shortfall") {
                    setStatusFilter("all");
                    setShippingFilter("all");
                    toast.info("欠运费筛选需要手动检查");
                  } else if (card.key === "reserved") {
                    setStatusFilter("packing");
                  } else {
                    setStatusFilter(card.key);
                  }
                  setPage(0);
                }}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${card.bg}`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索订单号..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="订单状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(PHYSICAL_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="订单来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            {Object.entries(ORDER_SOURCE).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={shippingFilter} onValueChange={(v) => { setShippingFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="配送方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部配送</SelectItem>
            {Object.entries(SHIPPING_METHOD).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单号</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>总金额</TableHead>
                <TableHead>已付</TableHead>
                <TableHead>配送</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">暂无订单</TableCell></TableRow>
              ) : orders.map((o: any) => (
                <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(o.id)}>
                  <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {ORDER_SOURCE[o.orderSource] || o.orderSource}
                    </Badge>
                  </TableCell>
                  <TableCell>{o.facebookName || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {o.orderType === "mixed" ? "混合" : o.orderType === "membership" ? "会员" : "实体"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">RM {o.totalAmount}</TableCell>
                  <TableCell className={Number(o.paidAmount) >= Number(o.totalAmount) ? "text-green-600" : "text-red-600"}>
                    RM {o.paidAmount}
                  </TableCell>
                  <TableCell className="text-xs">
                    {SHIPPING_METHOD[o.shippingMethod] || o.shippingMethod || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={PHYSICAL_STATUS[o.physicalStatus]?.variant || "outline"}>
                      {PHYSICAL_STATUS[o.physicalStatus]?.label || o.physicalStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => openDetail(o.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            第 {page + 1} / {totalPages} 页，共 {total} 条
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setDetailOrderId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              订单详情 - {detailOrder?.orderNumber}
              {detailOrder && (
                <Badge variant="outline" className="text-xs">
                  {ORDER_SOURCE[detailOrder.orderSource] || detailOrder.orderSource}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-4">
              {/* Order Info Grid */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">客户名称</p>
                  <p className="font-medium">{detailOrder.facebookName || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">订单类型</p>
                  <p className="font-medium">
                    {detailOrder.orderType === "mixed" ? "混合" : detailOrder.orderType === "membership" ? "会员" : "实体"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">配送方式</p>
                  <p className="font-medium">{SHIPPING_METHOD[detailOrder.shippingMethod as string] || detailOrder.shippingMethod || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">实体商品金额</p>
                  <p className="font-medium">RM {detailOrder.physicalSubtotal}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">运费</p>
                  <p className="font-medium">RM {detailOrder.shippingFee}</p>
                  {detailOrder.estimatedShippingFee && Number(detailOrder.estimatedShippingFee) > 0 && (
                    <p className="text-xs text-muted-foreground">预估: RM {detailOrder.estimatedShippingFee}</p>
                  )}
                  {detailOrder.actualShippingFee && (
                    <p className="text-xs text-muted-foreground">实际: RM {detailOrder.actualShippingFee}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">订单总金额</p>
                  <p className="font-bold text-lg">RM {detailOrder.totalAmount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">已付金额</p>
                  <p className={`font-bold ${Number(detailOrder.paidAmount) >= Number(detailOrder.totalAmount) ? "text-green-600" : "text-red-600"}`}>
                    RM {detailOrder.paidAmount}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">实体订单状态</p>
                  <Badge variant={PHYSICAL_STATUS[detailOrder.physicalStatus as string]?.variant || "outline"}>
                    {PHYSICAL_STATUS[detailOrder.physicalStatus as string]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">创建时间</p>
                  <p className="font-medium text-xs">{new Date(detailOrder.createdAt).toLocaleString()}</p>
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
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm">{detailOrder.trackingNumber}</p>
                      <Button variant="ghost" size="icon" className="h-6 w-6"
                        onClick={() => copyToClipboard(detailOrder.trackingNumber || "", "追踪号码")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <a href={`https://www.tracking.my/track/${detailOrder.trackingNumber}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline">
                      Tracking.my 查询
                    </a>
                  </div>
                )}
                {detailOrder.shipmentDate && (
                  <div>
                    <p className="text-muted-foreground">发货日期</p>
                    <p className="font-medium text-xs">{new Date(detailOrder.shipmentDate).toLocaleDateString()}</p>
                  </div>
                )}
                {detailOrder.reservedAt && (
                  <div>
                    <p className="text-muted-foreground">保留时间</p>
                    <p className="font-medium text-xs">
                      {new Date(detailOrder.reservedAt).toLocaleDateString()}
                      <span className="text-muted-foreground ml-1">
                        ({Math.floor((Date.now() - new Date(detailOrder.reservedAt).getTime()) / 86400000)} 天)
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Order Items */}
              {detailOrder.items && detailOrder.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>商品</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead className="text-right">数量</TableHead>
                        <TableHead className="text-right">单价</TableHead>
                        <TableHead className="text-right">小计</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailOrder.items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.productName}
                            {item.variationName && <span className="text-xs text-muted-foreground ml-2">({item.variationName})</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.productType === "physical" ? "实体" : item.productType === "membership" ? "会员" : "礼品"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">RM {item.unitPrice}</TableCell>
                          <TableCell className="text-right font-semibold">RM {item.subtotal}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Tabs: Payments / Notifications / Audit Logs */}
              <Tabs defaultValue="payments">
                <TabsList>
                  <TabsTrigger value="payments">付款纪录</TabsTrigger>
                  <TabsTrigger value="notes">备注</TabsTrigger>
                  <TabsTrigger value="actions">需要处理</TabsTrigger>
                  <TabsTrigger value="notifications">通知历史</TabsTrigger>
                  <TabsTrigger value="audit">审计日志</TabsTrigger>
                </TabsList>

                {/* Payments Tab */}
                <TabsContent value="payments" className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">付款纪录 ({detailOrder.payments?.length || 0})</p>
                    <Button size="sm" variant="outline" onClick={() => setAddPaymentOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" />添加付款
                    </Button>
                  </div>
                  {detailOrder.payments && detailOrder.payments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>日期</TableHead>
                          <TableHead>金额</TableHead>
                          <TableHead>方式</TableHead>
                          <TableHead>用途</TableHead>
                          <TableHead>操作人</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailOrder.payments.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs">{new Date(p.paymentDate).toLocaleDateString()}</TableCell>
                            <TableCell className="font-semibold">RM {p.amount}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{PAYMENT_METHOD[p.paymentMethod] || p.paymentMethod}</Badge></TableCell>
                            <TableCell className="text-xs">{p.purpose || "-"}</TableCell>
                            <TableCell className="text-xs">{p.operatorName || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无付款纪录</p>
                  )}
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">
                      <StickyNote className="h-4 w-4 inline mr-1" />
                      备注 ({orderNotes?.length || 0})
                    </p>
                    <Button size="sm" variant="outline" onClick={() => setAddNoteOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" />添加备注
                    </Button>
                  </div>
                  {orderNotes && orderNotes.length > 0 ? (
                    <div className="space-y-2">
                      {orderNotes.map((note: any) => (
                        <div key={note.id} className="flex items-start gap-3 p-3 border rounded-lg text-sm">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                {note.noteType === "customer_note" ? "客户可见" :
                                 note.noteType === "internal_note" ? "内部备注" : "Checkout 备注"}
                              </Badge>
                              {note.needsAction && (
                                <Badge variant="destructive" className="text-xs">需要处理</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {note.createdByName || "系统"} · {new Date(note.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm">{note.content}</p>
                          </div>
                          <Button size="icon" variant="ghost" className="h-6 w-6"
                            onClick={() => deleteNoteMutation.mutate({ id: note.id })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无备注</p>
                  )}
                </TabsContent>

                {/* Action Items Tab */}
                <TabsContent value="actions" className="space-y-3">
                  <p className="text-sm font-medium">
                    <ListChecks className="h-4 w-4 inline mr-1" />
                    需要处理事项
                  </p>
                  {orderActionItems && orderActionItems.filter((a: any) => a.orderId === detailOrder?.id).length > 0 ? (
                    <div className="space-y-2">
                      {orderActionItems
                        .filter((a: any) => a.orderId === detailOrder?.id)
                        .map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={item.status === "pending" ? "destructive" : "default"} className="text-xs">
                                  {item.status === "pending" ? "待处理" : "已完成"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {item.createdByName || "系统"} · {new Date(item.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm">{item.content}</p>
                              {item.status === "completed" && item.completedByName && (
                                <p className="text-xs text-green-600 mt-1">
                                  由 {item.completedByName} 于 {new Date(item.completedAt).toLocaleString()} 完成
                                </p>
                              )}
                            </div>
                            {item.status === "pending" && (
                              <Button size="sm" variant="default"
                                onClick={() => completeActionMutation.mutate({ id: item.id })}>
                                <CheckCircle className="h-3 w-3 mr-1" />完成
                              </Button>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无需要处理事项</p>
                  )}
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="space-y-3">
                  <p className="text-sm font-medium">通知历史 ({detailOrder.notifications?.length || 0})</p>
                  {detailOrder.notifications && detailOrder.notifications.length > 0 ? (
                    <div className="space-y-2">
                      {detailOrder.notifications.map((n: any) => (
                        <div key={n.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                          <div className="flex items-center gap-3">
                            <Bell className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">
                                {n.notificationType === "order_link" ? "订单链接" :
                                 n.notificationType === "shipping_notice" ? "发货通知" :
                                 n.notificationType === "payment_reminder" ? "付款提醒" : "自定义"}
                              </p>
                              <p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={n.messengerStatus === "sent" ? "default" : n.messengerStatus === "failed" ? "destructive" : "outline"} className="text-xs">
                              Messenger: {n.messengerStatus}
                            </Badge>
                            <Badge variant={n.whatsappStatus === "sent" ? "default" : n.whatsappStatus === "failed" ? "destructive" : "outline"} className="text-xs">
                              WhatsApp: {n.whatsappStatus}
                            </Badge>
                            {!n.isManualNotified && (n.messengerStatus === "failed" || n.whatsappStatus === "failed") && (
                              <Button size="sm" variant="outline" onClick={() => markManualMutation.mutate({ notificationId: n.id })}>
                                标记已人工通知
                              </Button>
                            )}
                            {n.isManualNotified && (
                              <Badge variant="default" className="text-xs">已人工通知</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无通知纪录</p>
                  )}
                </TabsContent>

                {/* Audit Logs Tab */}
                <TabsContent value="audit" className="space-y-3">
                  <p className="text-sm font-medium">审计日志 ({detailOrder.auditLogs?.length || 0})</p>
                  {detailOrder.auditLogs && detailOrder.auditLogs.length > 0 ? (
                    <div className="space-y-2">
                      {detailOrder.auditLogs.map((log: any) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium">{log.action}</p>
                            {log.fieldName && (
                              <p className="text-xs text-muted-foreground">
                                字段: {log.fieldName}
                                {log.oldValue && ` | ${log.oldValue} → ${log.newValue}`}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(log.createdAt).toLocaleString()} · {log.operatorName || "系统"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无审计日志</p>
                  )}
                </TabsContent>
              </Tabs>

              {/* Shipping Notice Copy Section */}
              {detailOrder.physicalStatus === "shipped" && detailOrder.trackingNumber && (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                  <p className="text-sm font-medium">发货通知（可复制）</p>
                  <Textarea
                    value={buildShippingNotice(detailOrder)}
                    readOnly
                    rows={4}
                    className="text-sm bg-background"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline"
                      onClick={() => copyToClipboard(detailOrder.trackingNumber || "", "追踪号码")}>
                      <Copy className="h-3 w-3 mr-1" />复制 Tracking
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => copyToClipboard(`https://www.tracking.my/track/${detailOrder.trackingNumber || ""}`, "Tracking.my 链接")}>
                      <Copy className="h-3 w-3 mr-1" />复制 Tracking.my
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => copyToClipboard(buildShippingNotice(detailOrder), "发货通知")}>
                      <Copy className="h-3 w-3 mr-1" />复制发货信息
                    </Button>
                  </div>
                </div>
              )}

              {/* Status Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {detailOrder.physicalStatus === "pending" && (
                  <Button size="sm" variant="outline"
                    onClick={() => {
                      // Use legacy updateStatus for confirm payment
                      utils.ordersV2.invalidate();
                      toast.success("请使用付款纪录功能确认汇款");
                    }}>
                    <Banknote className="h-4 w-4 mr-1" />确认汇款
                  </Button>
                )}
                {detailOrder.physicalStatus === "payment_confirmed" && (
                  <Button size="sm" variant="outline"
                    onClick={() => setShipDialogOpen(true)}>
                    <Truck className="h-4 w-4 mr-1" />发货
                  </Button>
                )}
                {detailOrder.physicalStatus === "packing" && (
                  <Button size="sm" variant="outline"
                    onClick={() => setShipDialogOpen(true)}>
                    <Truck className="h-4 w-4 mr-1" />发货
                  </Button>
                )}
                {detailOrder.physicalStatus === "shipped" && (
                  <Button size="sm" variant="outline"
                    onClick={() => completeMutation.mutate({ id: detailOrder.id })}>
                    <CheckCircle className="h-4 w-4 mr-1" />标记完成
                  </Button>
                )}
                {detailOrder.physicalStatus !== "completed" && detailOrder.physicalStatus !== "cancelled" && (
                  <Button size="sm" variant="destructive"
                    onClick={() => {
                      if (confirm("确定取消此订单？")) {
                        cancelMutation.mutate({ id: detailOrder.id });
                      }
                    }}>
                    <XCircle className="h-4 w-4 mr-1" />取消订单
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ship Dialog */}
      <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认发货</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>快递公司</Label>
              <Select value={shipForm.courierId} onValueChange={(v) => setShipForm({ ...shipForm, courierId: v })}>
                <SelectTrigger><SelectValue placeholder="选择快递公司" /></SelectTrigger>
                <SelectContent>
                  {couriers?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>追踪号码</Label>
              <Input value={shipForm.trackingNumber}
                onChange={(e) => setShipForm({ ...shipForm, trackingNumber: e.target.value })}
                placeholder="Tracking number" />
            </div>
            <div>
              <Label>发货日期</Label>
              <Input type="date" value={shipForm.shipmentDate}
                onChange={(e) => setShipForm({ ...shipForm, shipmentDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipDialogOpen(false)}>取消</Button>
            <Button onClick={handleShip} disabled={shipMutation.isPending}>
              <Truck className="h-4 w-4 mr-2" />确认发货
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={addPaymentOpen} onOpenChange={setAddPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加付款纪录</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>金额 (RM)</Label>
              <Input type="number" step="0.01" value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                placeholder="0.00" />
            </div>
            <div>
              <Label>付款日期</Label>
              <Input type="date" value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} />
            </div>
            <div>
              <Label>付款方式</Label>
              <Select value={paymentForm.paymentMethod} onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>用途</Label>
              <Input value={paymentForm.purpose}
                onChange={(e) => setPaymentForm({ ...paymentForm, purpose: e.target.value })}
                placeholder="商品/运费/补运费等" />
            </div>
            <div>
              <Label>备注</Label>
              <Textarea value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPaymentOpen(false)}>取消</Button>
            <Button onClick={handleAddPayment} disabled={addPaymentMutation.isPending}>确认添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual order creation dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>手动建立订单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3 p-4 border rounded-lg">
              <h3 className="font-medium text-sm">客户信息</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">客户姓名</Label>
                  <Input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} placeholder="收件人姓名" />
                </div>
                <div>
                  <Label className="text-xs">电话号码</Label>
                  <Input value={customerForm.phoneNumber} onChange={(e) => setCustomerForm({ ...customerForm, phoneNumber: e.target.value })} placeholder="012-3456789" />
                </div>
                <div>
                  <Label className="text-xs">Facebook 名称</Label>
                  <Input value={customerForm.facebookName} onChange={(e) => setCustomerForm({ ...customerForm, facebookName: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Facebook ID</Label>
                  <Input value={customerForm.facebookId} onChange={(e) => setCustomerForm({ ...customerForm, facebookId: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Messenger ID</Label>
                  <Input value={customerForm.messengerId} onChange={(e) => setCustomerForm({ ...customerForm, messengerId: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">运送方式</Label>
                  <Select value={customerForm.shippingMethod} onValueChange={(v) => setCustomerForm({ ...customerForm, shippingMethod: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SHIPPING_METHOD).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">收件地址</Label>
                <Textarea value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} rows={2} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>订单商品</Label>
                <Button variant="outline" size="sm" onClick={addManualItem}>
                  <Plus className="h-3 w-3 mr-1" />添加商品
                </Button>
              </div>
              {manualItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-lg">
                  <div className="col-span-4">
                    <Label className="text-xs">商品</Label>
                    <Select
                      value={item.productId?.toString() || "none"}
                      onValueChange={(v) => handleManualItemProductSelect(idx, v)}
                    >
                      <SelectTrigger className="h-8"><SelectValue placeholder="选择商品" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">请选择...</SelectItem>
                        {products?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">数量</Label>
                    <Input type="number" className="h-8" value={item.quantity}
                      onChange={(e) => updateManualItem(idx, "quantity", parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">单价</Label>
                    <Input type="number" step="0.01" className="h-8" value={item.unitPrice}
                      onChange={(e) => updateManualItem(idx, "unitPrice", e.target.value)} />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">小计</Label>
                    <Input className="h-8" value={item.subtotal} readOnly />
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeManualItem(idx)}>
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {manualItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">请添加至少一个商品</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreateOrder} disabled={createOrderMutation.isPending || findCustomerMutation.isPending}>
              创建订单
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加备注</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>备注类型</Label>
              <Select value={noteForm.noteType} onValueChange={(v) => setNoteForm({ ...noteForm, noteType: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal_note">内部备注（仅后台可见）</SelectItem>
                  <SelectItem value="customer_note">客户备注（客户可见）</SelectItem>
                  <SelectItem value="checkout_note">Checkout 备注</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>内容</Label>
              <Textarea value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                placeholder="输入备注内容..." rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="needsAction" checked={noteForm.needsAction}
                onChange={(e) => setNoteForm({ ...noteForm, needsAction: e.target.checked })}
                className="rounded" />
              <Label htmlFor="needsAction" className="text-sm cursor-pointer">
                标记为需要后续处理（将加入 Dashboard 需要处理清单）
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNoteOpen(false)}>取消</Button>
            <Button
              onClick={() => {
                if (!detailOrder || !noteForm.content.trim()) return;
                addNoteMutation.mutate({
                  orderId: detailOrder.id,
                  customerId: detailOrder.customerId,
                  noteType: noteForm.noteType,
                  visibility: noteForm.noteType === "customer_note" ? "customer" : "internal",
                  content: noteForm.content,
                  needsAction: noteForm.needsAction,
                });
              }}
              disabled={addNoteMutation.isPending || !noteForm.content.trim()}>
              添加备注
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
