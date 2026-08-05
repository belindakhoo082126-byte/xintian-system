import { useState, useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Eye, Truck, Plus, Trash2, X, Package, DollarSign, Clock, FileText, Ban, Calendar, CheckCircle, Sprout, Send, Link2, MessageCircle, Copy } from "lucide-react";
import { useSearch, useLocation } from "wouter";

const PHYSICAL_STATUS = {
  pending: { label: "未汇款订单", enLabel: "Unpaid Order", variant: "outline" },
  receipt_uploaded: { label: "待审核付款凭证", enLabel: "Pending Payment Verification", variant: "secondary" },
  hold_order: { label: "保留订单", enLabel: "Hold Order", variant: "outline" },
  packing: { label: "待包货", enLabel: "Pending Packing", variant: "default" },
  partial_shipped: { label: "部分发货", enLabel: "Partial Shipped", variant: "secondary" },
  shipped: { label: "已发货", enLabel: "Shipped", variant: "default" },
  completed: { label: "已完成", enLabel: "Completed", variant: "default" },
  cancelled: { label: "已取消", enLabel: "Cancelled", variant: "destructive" },
  scheduled: { label: "预约发货", enLabel: "Scheduled Shipping", variant: "secondary" },
  special: { label: "特别订单", enLabel: "Special Order", variant: "secondary" },
} as const;

const ORDER_NATURE = {
  retail: { label: "零售", enLabel: "Retail" },
  wholesale: { label: "批发", enLabel: "Wholesale" },
  agent: { label: "代理", enLabel: "Agent" },
} as const;

const ORDER_SOURCE = {
  facebook_live: { label: "FB直播", enLabel: "FB Live" },
  facebook_post: { label: "FB贴文", enLabel: "FB Post" },
  facebook_reel: { label: "FB Reel", enLabel: "FB Reel" },
  messenger: { label: "Messenger", enLabel: "Messenger" },
  store: { label: "商城", enLabel: "Store" },
  manual: { label: "Admin手动", enLabel: "Admin Manual" },
} as const;

const CANCEL_REASONS = [
  "客户取消",
  "缺货",
  "重复订单",
  "错误下单",
  "客户未付款",
  "其他",
];

interface ManualOrderItem {
  productId: number | undefined;
  productName: string;
  productType: "physical" | "membership" | "gift";
  quantity: number;
  unitPrice: string;
  subtotal: string;
  variationId?: number;
  variationName?: string;
  priceType?: string;
  unitCost?: string;
}

export default function Orders({ orderCategory, ...rest }: { orderCategory?: "local" | "import" | "all" } & Record<string, any> = {}) {
  const { translate, lang } = useI18n();
  const searchParams = useSearch();
  const [_, setLocation] = useLocation();
  const urlStatus = new URLSearchParams(searchParams).get("status");
  const urlToday = new URLSearchParams(searchParams).get("today");
  const urlNature = new URLSearchParams(searchParams).get("nature");
  const urlChannel = new URLSearchParams(searchParams).get("channel");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(urlStatus || "all");
  const [todayOnly, setTodayOnly] = useState(urlToday === "1");
  const [natureFilter, setNatureFilter] = useState(urlNature || "all");
  const [channelFilter, setChannelFilter] = useState(urlChannel || "all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [remarkFilter, setRemarkFilter] = useState("all");
  const [notificationFilter, setNotificationFilter] = useState("all");

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const newStatus = params.get('status');
      const newToday = params.get('today');
      const newNature = params.get('nature');
      const newChannel = params.get('channel');
      if (newStatus !== null) setStatusFilter(newStatus);
      if (newToday !== null) setTodayOnly(newToday === '1');
      if (newNature !== null) setNatureFilter(newNature);
      if (newChannel !== null) setChannelFilter(newChannel);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [shipForm, setShipForm] = useState({ courierCompany: "", trackingNumber: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [manualItems, setManualItems] = useState<ManualOrderItem[]>([]);
  const [customerForm, setCustomerForm] = useState({
    facebookName: "", facebookId: "", messengerId: "",
    name: "", phoneNumber: "", address: "", shippingMethod: "west_malaysia",
  });
  const [orderNature, setOrderNature] = useState("retail");
  const [orderSource, setOrderSource] = useState("manual");
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>(undefined);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentMethodName: "", receiptUrl: "", notes: "" });
  const [remarkForm, setRemarkForm] = useState({ remarkCategory: "", content: "", desiredDeliveryDate: "", desiredDeliveryReason: "", repottingData: "" });
  const [showRemarkForm, setShowRemarkForm] = useState(false);
  const [editingRemarkId, setEditingRemarkId] = useState<number | null>(null);
  // V2.0.42: Custom message template dialog
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageDialogMode, setMessageDialogMode] = useState<"messenger" | "whatsapp">("messenger");
  const [editableMessage, setEditableMessage] = useState("");

  const utils = trpc.useUtils();

  const { data: products } = trpc.products.list.useQuery({});
  const { data: systemSettings } = trpc.settings.get.useQuery();

  const { data: orders, isLoading } = trpc.orders.list.useQuery({
    search: search || undefined,
    physicalStatus: statusFilter !== "all" ? statusFilter : undefined,
    todayOnly: todayOnly || undefined,
    orderNature: natureFilter !== "all" ? natureFilter : undefined,
    orderCategory: orderCategory && orderCategory !== "all" ? orderCategory : undefined,
    salesChannel: channelFilter !== "all" ? channelFilter : undefined,
    hasRemark: remarkFilter !== "all" ? (remarkFilter === "with" ? true : false) : undefined,
    notificationStatus: notificationFilter !== "all" ? notificationFilter : undefined,
  } as any);

  // Get order detail with items, payments, and logs
  const { data: orderDetail, refetch: refetchDetail } = trpc.orders.getDetail.useQuery(
    { id: detailOrderId! },
    { enabled: detailOrderId !== null }
  );

  // Customer search
  const { data: customerSearchResults } = trpc.customers.list.useQuery(
    { search: customerSearchQuery },
    { enabled: customerSearchQuery.length > 0 }
  );

  // Product search for order creation
  const { data: productSearchResults } = trpc.orders.searchProductsForOrder.useQuery(
    { query: productSearchQuery },
    { enabled: productSearchQuery.length > 0 }
  );

  // Order remarks
  const { data: orderRemarksData, refetch: refetchRemarks } = trpc.orderRemarks.list.useQuery(
    { orderId: detailOrderId! },
    { enabled: detailOrderId !== null }
  );

  const createRemarkMutation = trpc.orderRemarks.create.useMutation({
    onSuccess: () => {
      refetchRemarks();
      utils.orderRemarks.ordersWithRemarks.invalidate();
      utils.orders.invalidate();
      setRemarkForm({ remarkCategory: "", content: "", desiredDeliveryDate: "", desiredDeliveryReason: "", repottingData: "" });
      setShowRemarkForm(false);
      toast.success(translate("备注已添加", "Remark added"));
    },
    onError: (e: any) => toast.error(translate("操作失败: {message}", "Operation failed: {message}", { message: e.message })),
  });

  const updateRemarkMutation = trpc.orderRemarks.update.useMutation({
    onSuccess: () => {
      refetchRemarks();
      utils.orderRemarks.ordersWithRemarks.invalidate();
      setEditingRemarkId(null);
      toast.success(translate("备注已更新", "Remark updated"));
    },
    onError: (e: any) => toast.error(translate("操作失败: {message}", "Operation failed: {message}", { message: e.message })),
  });

  const deleteRemarkMutation = trpc.orderRemarks.delete.useMutation({
    onSuccess: () => {
      refetchRemarks();
      utils.orderRemarks.ordersWithRemarks.invalidate();
      toast.success(translate("备注已删除", "Remark deleted"));
    },
    onError: (e: any) => toast.error(translate("操作失败: {message}", "Operation failed: {message}", { message: e.message })),
  });

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      if (detailOrderId) refetchDetail();
      toast.success(translate("订单状态已更新", "Order status updated"));
    },
    onError: (e) => toast.error(translate("操作失败: {message}", "Operation failed: {message}", { message: e.message })),
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
          variationId: i.variationId,
          variationName: i.variationName,
          priceType: i.priceType,
          unitCost: i.unitCost,
        })),
        shippingAddress: customerForm.address || undefined,
        shippingMethod: customerForm.shippingMethod || undefined,
        orderNature,
        orderSource: orderSource,
      });
    },
    onError: (e) => toast.error(translate("客户创建失败: {message}", "Customer creation failed: {message}", { message: e.message })),
  });

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: (r: any) => {
      utils.orders.invalidate();
      toast.success(translate("订单创建成功: {orderNumber}", "Order created successfully: {orderNumber}", { orderNumber: r.orderNumber }));
      setCreateOpen(false);
      setManualItems([]);
      setCustomerForm({ facebookName: "", facebookId: "", messengerId: "", name: "", phoneNumber: "", address: "", shippingMethod: "west_malaysia" });
      setSelectedCustomerId(undefined);
      setCustomerSearchQuery("");
      setProductSearchQuery("");
      setOrderNature("retail");
      setOrderSource("manual");
      setIsWalkIn(false);
    },
    onError: (e) => toast.error(translate("订单创建失败: {message}", "Order creation failed: {message}", { message: e.message })),
  });

  const addPaymentMutation = trpc.orders.addPayment.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      if (detailOrderId) refetchDetail();
      toast.success(translate("付款记录已添加", "Payment record added"));
      setPaymentDialogOpen(false);
      setPaymentForm({ amount: "", paymentMethodName: "", receiptUrl: "", notes: "" });
    },
    onError: (e) => toast.error(translate("添加付款失败: {message}", "Payment failed: {message}", { message: e.message })),
  });

  const cancelOrderMutation = trpc.orders.cancelOrder.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      if (detailOrderId) refetchDetail();
      toast.success(translate("订单已取消", "Order cancelled"));
      setCancelDialogOpen(false);
      setCancelReason("");
      setDetailOpen(false);
    },
    onError: (e) => toast.error(translate("取消失败: {message}", "Cancel failed: {message}", { message: e.message })),
  });
  // V2.0.33: Send checkout to Messenger
  const sendCheckoutMutation = trpc.orders.sendCheckout.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      if (detailOrderId) refetchDetail();
      toast.success(translate("Checkout 链接已发送到 Messenger", "Checkout link sent to Messenger"));
    },
    onError: (e) => toast.error(translate("发送失败: {message}", "Send failed: {message}", { message: e.message })),
  });
  const resendCheckoutMutation = trpc.orders.resendCheckout.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      if (detailOrderId) refetchDetail();
      toast.success(translate("Checkout 链接已发送到 Messenger", "Checkout link sent to Messenger"));
    },
    onError: (e) => toast.error(translate("发送失败: {message}", "Send failed: {message}", { message: e.message })),
  });
  const batchSendCheckoutMutation = trpc.orders.batchSendCheckout.useMutation({
    onSuccess: (data: any) => {
      utils.orders.invalidate();
      const total = data.total || 0;
      const sent = data.sent || 0;
      const failed = data.failed || 0;
      const skipped = data.skipped || 0;
      const failedList = (data.failedOrders || []).map((o: any) => `${o.orderNumber} - ${o.customerName} (${o.error})`).join("\n");
      const summary = lang === "zh"
        ? `共找到 ${total} 张未汇款订单\n发送成功: ${sent}\n发送失败: ${failed}\n跳过: ${skipped}`
        : `Found ${total} unpaid orders\nSent: ${sent}\nFailed: ${failed}\nSkipped: ${skipped}`;
      if (failed > 0 && failedList) {
        toast.error(`${summary}\n\n${lang === "zh" ? "失败名单:" : "Failed orders:"}\n${failedList}`, { duration: 10000 });
      } else {
        toast.success(summary, { duration: 6000 });
      }
    },
    onError: (e) => toast.error(translate("批量发送失败: {message}", "Batch send failed: {message}", { message: e.message })),
  });

  function addManualItem() {
    setManualItems((currentItems) => [
      ...currentItems,
      { productId: undefined, productName: "", productType: "physical", quantity: 1, unitPrice: "0", subtotal: "0" },
    ]);
  }

  function removeManualItem(idx: number) {
    setManualItems((currentItems) => currentItems.filter((_, i) => i !== idx));
  }

  function updateManualItem(idx: number, field: keyof ManualOrderItem, value: any) {
    setManualItems((currentItems) => currentItems.map((item, i) => {
      if (i !== idx) return item;
      const updatedItem = { ...item, [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        const qty = parseFloat(String(updatedItem.quantity)) || 0;
        const price = parseFloat(String(updatedItem.unitPrice)) || 0;
        updatedItem.subtotal = (qty * price).toFixed(2);
      }
      return updatedItem;
    }));
  }

  function handleManualItemProductSelect(idx: number, productId: string) {
    if (productId === "none") return;
    const product = (productSearchResults || products)?.find((p: any) => p.id === parseInt(productId));
    if (!product) return;

    setManualItems((currentItems) => currentItems.map((item, i) => {
      if (i !== idx) return item;
      const unitPrice = product.sellingPrice || product.regularPrice || "0";
      const quantity = parseFloat(String(item.quantity)) || 0;
      const price = parseFloat(unitPrice) || 0;
      return {
        ...item,
        productId: product.id,
        productName: product.name,
        productType: product.type,
        unitPrice,
        subtotal: (quantity * price).toFixed(2),
        unitCost: (product as any).costPrice || (product as any).supplierCost || "0",
        priceType: orderNature === "wholesale" ? "wholesale" : orderNature === "agent" ? "agent" : "retail",
      };
    }));
  }

  function handleCreateOrder() {
    if (manualItems.length === 0 || manualItems.every(i => i.productId === undefined)) {
      toast.error(translate("请至少添加一个商品", "Please add at least one product"));
      return;
    }
    if (!customerForm.name.trim() && !customerForm.facebookName.trim() && !isWalkIn) {
      toast.error(translate("请输入客户名称或 Facebook 名称", "Please enter customer name or Facebook name"));
      return;
    }
    if (isWalkIn) {
      // For walk-in, create a minimal customer
      findCustomerMutation.mutate({
        name: customerForm.name || "Walk-in Customer",
        phoneNumber: customerForm.phoneNumber || undefined,
      });
    } else if (selectedCustomerId) {
      // Use selected existing customer
      createOrderMutation.mutate({
        customerId: selectedCustomerId,
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
          variationId: i.variationId,
          variationName: i.variationName,
          priceType: i.priceType,
          unitCost: i.unitCost,
        })),
        shippingAddress: customerForm.address || undefined,
        shippingMethod: customerForm.shippingMethod || undefined,
        orderNature,
        orderSource,
      });
    } else {
      findCustomerMutation.mutate({
        facebookId: customerForm.facebookId || undefined,
        facebookName: customerForm.facebookName || undefined,
        messengerId: customerForm.messengerId || undefined,
        name: customerForm.name || undefined,
        phoneNumber: customerForm.phoneNumber || undefined,
      });
    }
  }

  function openDetail(orderId: number) {
    setLocation(`/orders/browse/${orderId}`);
  }

  function handleShip() {
    if (!detailOrderId) return;
    if (!shipForm.courierCompany || !shipForm.trackingNumber) {
      toast.error(translate("请填写快递公司和追踪号码", "Please fill in courier company and tracking number"));
      return;
    }
    updateStatusMutation.mutate({
      id: detailOrderId,
      physicalStatus: "shipped",
      courierCompany: shipForm.courierCompany,
      trackingNumber: shipForm.trackingNumber,
    });
    setShipForm({ courierCompany: "", trackingNumber: "" });
  }

  function handleAddPayment() {
    if (!detailOrderId) return;
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error(translate("请输入有效金额", "Please enter a valid amount"));
      return;
    }
    addPaymentMutation.mutate({
      orderId: detailOrderId,
      amount: paymentForm.amount,
      paymentMethodName: paymentForm.paymentMethodName || undefined,
      receiptUrl: paymentForm.receiptUrl || undefined,
      notes: paymentForm.notes || undefined,
    });
  }

  function handleCancelOrder() {
    if (!detailOrderId) return;
    if (!cancelReason) {
      toast.error(translate("请选择取消原因", "Please select a cancel reason"));
      return;
    }
    cancelOrderMutation.mutate({ id: detailOrderId, reason: cancelReason });
  }

  const totalPaid = orderDetail?.payments?.reduce((sum: number, p: any) => sum + parseFloat(String(p.amount)), 0) || 0;
  const totalAmount = orderDetail ? parseFloat(String(orderDetail.totalAmount)) : 0;
  const remainingAmount = totalAmount - totalPaid;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {orderCategory === "import" ? translate("中国代购订单", "Import Orders") :
             orderCategory === "local" ? translate("本地订单", "Local Orders") :
             translate("订单查询", "Order Search")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {orderCategory === "import" ? translate("中国代购订单管理与处理", "Import order management & processing") :
             orderCategory === "local" ? translate("本地订单管理与处理", "Local order management & processing") :
             translate("搜索与筛选所有订单", "Search and filter all orders")}
          </p>
        </div>
        {orderCategory !== "all" && (
          <Button onClick={() => setLocation(`/orders/create/${orderCategory === "import" ? "import" : "local"}`)}>
            <Plus className="h-4 w-4 mr-2" />{translate("手动建单", "Create Manual Order")}
          </Button>
        )}
      </div>

      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={translate("搜索订单号/客户/追踪号...", "Search order/customer/tracking...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={translate("订单状态", "Order Status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{translate("全部状态", "All Statuses")}</SelectItem>
            {Object.entries(PHYSICAL_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={natureFilter} onValueChange={setNatureFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={translate("订单性质", "Order Nature")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{translate("全部性质", "All Natures")}</SelectItem>
            {Object.entries(ORDER_NATURE).map(([k, v]) => (
              <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={translate("订单来源", "Order Source")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{translate("全部来源", "All Sources")}</SelectItem>
            {Object.entries(ORDER_SOURCE).map(([k, v]) => (
              <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={remarkFilter} onValueChange={setRemarkFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={translate("订单备注", "Order Remarks")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{translate("全部备注", "All Remarks")}</SelectItem>
            <SelectItem value="with">{translate("有备注", "With Remarks")}</SelectItem>
            <SelectItem value="without">{translate("无备注", "No Remarks")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={notificationFilter} onValueChange={setNotificationFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={translate("通知状态", "Notification")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{translate("全部通知", "All Notifications")}</SelectItem>
            <SelectItem value="unsent">{translate("未发送", "Not Sent")}</SelectItem>
            <SelectItem value="sent">{translate("已发送", "Sent")}</SelectItem>
            <SelectItem value="failed">{translate("发送失败", "Failed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {orderCategory !== "all" && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">{translate("Checkout 通知管理", "Checkout Notification Management")}</p>
            <p className="text-xs text-muted-foreground">{translate("一键发送 Checkout Link 给所有未发送或发送失败的订单", "Send Checkout Link to all pending or failed orders")}</p>
          </div>
          <Button
            size="sm"
            variant="default"
            onClick={() => batchSendCheckoutMutation.mutate({ status: statusFilter === "all" ? undefined : statusFilter })}
            disabled={batchSendCheckoutMutation.isPending}
          >
            <Send className="h-4 w-4 mr-1" />
            {translate("发送全部未发送订单", "Send All Pending")}
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate("订单号", "Order No.")}</TableHead>
                <TableHead>{translate("客户", "Customer")}</TableHead>
                <TableHead>{translate("来源", "Source")}</TableHead>
                <TableHead>{translate("性质", "Nature")}</TableHead>
                <TableHead>{translate("已付", "Paid")}</TableHead>
                <TableHead>{translate("总金额", "Total")}</TableHead>
                <TableHead>{translate("状态", "Status")}</TableHead>
                <TableHead>{translate("通知", "Notification")}</TableHead>
                <TableHead className="text-right">{translate("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
              ) : orders?.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{translate("暂无订单", "No orders yet")}</TableCell></TableRow>
              ) : orders?.filter((o: any) => {
                if (sourceFilter === "all") return true;
                return (o as any).orderSource === sourceFilter;
              }).map((o: any) => (
                <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(o.id)}>
                  <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                  <TableCell>{o.facebookName || "-"}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {ORDER_SOURCE[(o as any).orderSource as keyof typeof ORDER_SOURCE]
                        ? translate(ORDER_SOURCE[(o as any).orderSource as keyof typeof ORDER_SOURCE].label, ORDER_SOURCE[(o as any).orderSource as keyof typeof ORDER_SOURCE].enLabel)
                        : translate("-", "-")}
                    </span>
                  </TableCell>
                  <TableCell>
                    {ORDER_NATURE[(o as any).orderNature as keyof typeof ORDER_NATURE]
                      ? <Badge variant="secondary">{translate(ORDER_NATURE[(o as any).orderNature as keyof typeof ORDER_NATURE].label, ORDER_NATURE[(o as any).orderNature as keyof typeof ORDER_NATURE].enLabel)}</Badge>
                      : <Badge variant="secondary">{translate("普通", "Normal")}</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-sm">
                    {parseFloat(String(o.paidAmount || 0)) > 0 ? (
                      <span className="text-green-600">RM {o.paidAmount}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">RM {o.totalAmount}</TableCell>
                  <TableCell>
                    <Badge variant={PHYSICAL_STATUS[o.physicalStatus as keyof typeof PHYSICAL_STATUS]?.variant || "outline"}>
                      {translate(PHYSICAL_STATUS[o.physicalStatus as keyof typeof PHYSICAL_STATUS]?.label || o.physicalStatus, PHYSICAL_STATUS[o.physicalStatus as keyof typeof PHYSICAL_STATUS]?.enLabel || o.physicalStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(o as any).notificationStatus === "sent" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        {translate("已发送", "Sent")}
                      </span>
                    ) : (o as any).notificationStatus === "failed" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        {translate("发送失败", "Failed")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-gray-300" />
                        {translate("未发送", "Not Sent")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title={translate("查看详情", "View Details")} onClick={(e) => { e.stopPropagation(); openDetail(o.id); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {(o as any).checkoutLink && (
                        <>
                          <Button variant="ghost" size="icon" title={translate("复制结单链接", "Copy Checkout Link")} onClick={(e) => {
                            e.stopPropagation();
                            const fullLink = `https://xintian.com.my${(o as any).checkoutLink}`;
                            navigator.clipboard.writeText(fullLink);
                            toast.success(translate("结单链接已复制", "Checkout link copied"));
                          }}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title={translate("发送到 Messenger", "Send to Messenger")} onClick={(e) => {
                            e.stopPropagation();
                            if (!(o as any).messengerId) {
                              toast.error(translate("该订单没有 Messenger ID，无法发送", "No Messenger ID for this order"));
                              return;
                            }
                            const fullLink = `https://xintian.com.my${(o as any).checkoutLink}`;
                            const template = (systemSettings as any)?.checkoutMessageTemplate ||
                              "Hello, here is your order. Please click the link below to fill in your details and complete payment. Thank you.\n\n{link}";
                            const msg = template.replace(/\{link\}/g, fullLink);
                            sendCheckoutMutation.mutate({ orderId: (o as any).id, customMessage: msg });
                          }}>
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Order Detail Dialog with Tabs */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate("订单详情", "Order Details")} - {orderDetail?.orderNumber}</DialogTitle>
          </DialogHeader>
          {orderDetail && (
            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="info">{translate("基本资料", "Info")}</TabsTrigger>
                <TabsTrigger value="items">{translate("商品内容", "Items")}</TabsTrigger>
                <TabsTrigger value="payment">{translate("金额/付款", "Payment")}</TabsTrigger>
                <TabsTrigger value="shipping">{translate("包货/发货", "Shipping")}</TabsTrigger>
                <TabsTrigger value="remarks">{translate("备注", "Remarks")}</TabsTrigger>
                <TabsTrigger value="logs">{translate("操作日志", "Logs")}</TabsTrigger>
              </TabsList>

              {/* Tab: Basic Info */}
              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{translate("订单号", "Order Number")}</p>
                    <p className="font-mono font-medium">{orderDetail.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{translate("客户名称", "Customer Name")}</p>
                    <p className="font-medium">{orderDetail.facebookName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{translate("订单性质", "Order Nature")}</p>
                    <Badge variant="secondary">
                      {ORDER_NATURE[(orderDetail as any).orderNature as keyof typeof ORDER_NATURE]
                        ? translate(ORDER_NATURE[(orderDetail as any).orderNature as keyof typeof ORDER_NATURE].label, ORDER_NATURE[(orderDetail as any).orderNature as keyof typeof ORDER_NATURE].enLabel)
                        : translate("普通", "Normal")}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{translate("订单来源", "Order Source")}</p>
                    <Badge variant="outline">
                      {ORDER_SOURCE[(orderDetail as any).orderSource as keyof typeof ORDER_SOURCE]
                        ? translate(ORDER_SOURCE[(orderDetail as any).orderSource as keyof typeof ORDER_SOURCE].label, ORDER_SOURCE[(orderDetail as any).orderSource as keyof typeof ORDER_SOURCE].enLabel)
                        : translate("手动", "Manual")}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{translate("创建时间", "Created At")}</p>
                    <p className="font-medium">{new Date(orderDetail.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{translate("订单状态", "Order Status")}</p>
                    <Badge variant={PHYSICAL_STATUS[orderDetail.physicalStatus as keyof typeof PHYSICAL_STATUS]?.variant || "outline"}>
                      {translate(PHYSICAL_STATUS[orderDetail.physicalStatus as keyof typeof PHYSICAL_STATUS]?.label || orderDetail.physicalStatus, PHYSICAL_STATUS[orderDetail.physicalStatus as keyof typeof PHYSICAL_STATUS]?.enLabel || orderDetail.physicalStatus)}
                    </Badge>
                  </div>
                  {orderDetail.shippingAddress && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">{translate("收件地址", "Shipping Address")}</p>
                      <p className="font-medium">{orderDetail.shippingAddress}</p>
                    </div>
                  )}
                  {orderDetail.trackingNumber && (
                    <div>
                      <p className="text-muted-foreground">{translate("追踪号码", "Tracking Number")}</p>
                      <p className="font-mono text-sm">{orderDetail.trackingNumber}</p>
                    </div>
                  )}
                  {orderDetail.courierCompany && (
                    <div>
                      <p className="text-muted-foreground">{translate("快递公司", "Courier Company")}</p>
                      <p className="font-medium">{orderDetail.courierCompany}</p>
                    </div>
                  )}
                  {(orderDetail as any).cancelReason && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">{translate("取消原因", "Cancel Reason")}</p>
                      <p className="font-medium text-destructive">{(orderDetail as any).cancelReason}</p>
                    </div>
                  )}
                </div>

                {/* V2.0.33: Checkout Link section */}
                <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{translate("Checkout 链接", "Checkout Link")}</p>
                      <p className="font-mono text-sm break-all">{(orderDetail as any).checkoutLink || "-"}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => {
                        const link = (orderDetail as any).checkoutLink || "";
                        if (link) {
                          navigator.clipboard.writeText(`https://xintian.com.my${link}`);
                          toast.success(translate("链接已复制到剪贴板", "Link copied to clipboard"));
                        }
                      }}>
                        {translate("复制链接", "Copy Link")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const link = (orderDetail as any).checkoutLink || "";
                        if (link) window.open(`https://xintian.com.my${link}`, "_blank");
                      }}>
                        {translate("打开链接", "Open Link")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const link = (orderDetail as any).checkoutLink || "";
                        const phone = (orderDetail as any).phoneNumber || "";
                        if (link && phone) {
                          const fullLink = `https://xintian.com.my${link}`;
                          const template = (systemSettings as any)?.checkoutMessageTemplate ||
                            "Hello, here is your order. Please click the link below to fill in your details and complete payment. Thank you.\n\n{link}";
                          const msg = template.replace(/\{link\}/g, fullLink);
                          setMessageDialogMode("whatsapp");
                          setEditableMessage(msg);
                          setMessageDialogOpen(true);
                        } else if (!phone) {
                          toast.error(translate("客户没有电话号码", "Customer has no phone number"));
                        }
                      }}>
                        {translate("WhatsApp 分享", "Share via WhatsApp")}
                      </Button>
                      <Button size="sm" onClick={() => {
                        const link = (orderDetail as any).checkoutLink || "";
                        if (link) {
                          const fullLink = `https://xintian.com.my${link}`;
                          const template = (systemSettings as any)?.checkoutMessageTemplate ||
                            "Hello, here is your order. Please click the link below to fill in your details and complete payment. Thank you.\n\n{link}";
                          const msg = template.replace(/\{link\}/g, fullLink);
                          setMessageDialogMode("messenger");
                          setEditableMessage(msg);
                          setMessageDialogOpen(true);
                        }
                      }} disabled={sendCheckoutMutation.isPending}>
                        {translate("发送 Checkout 到 Messenger", "Send Checkout to Messenger")}
                      </Button>
                    </div>
                  </div>
                  {(orderDetail as any).notificationStatus && (
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{translate("通知状态", "Notification Status")}:</span>
                        <Badge variant={
                          (orderDetail as any).notificationStatus === "sent" ? "default" :
                          (orderDetail as any).notificationStatus === "failed" ? "destructive" : "outline"
                        }>
                          {translate(
                            (orderDetail as any).notificationStatus === "sent" ? "已发送" :
                            (orderDetail as any).notificationStatus === "failed" ? "发送失败" : "待发送",
                            (orderDetail as any).notificationStatus === "sent" ? "Sent" :
                            (orderDetail as any).notificationStatus === "failed" ? "Failed" : "Pending"
                          )}
                        </Badge>
                        {(orderDetail as any).notificationStatus === "failed" && (
                          <Button size="sm" variant="outline" onClick={() => {
                            const link = (orderDetail as any).checkoutLink || "";
                            if (link) {
                              const fullLink = `https://xintian.com.my${link}`;
                              const template = (systemSettings as any)?.checkoutMessageTemplate ||
                                "Hello, here is your order. Please click the link below to fill in your details and complete payment. Thank you.\n\n{link}";
                              const msg = template.replace(/\{link\}/g, fullLink);
                              setMessageDialogMode("messenger");
                              setEditableMessage(msg);
                              setMessageDialogOpen(true);
                            }
                          }} disabled={resendCheckoutMutation.isPending}>
                            {translate("重新发送", "Resend")}
                          </Button>
                        )}
                      </div>
                      {(orderDetail as any).notificationSentAt && (
                        <div className="text-xs text-muted-foreground">
                          {translate("最后发送时间", "Last Sent")}: {new Date((orderDetail as any).notificationSentAt).toLocaleString()}
                        </div>
                      )}
                      {(orderDetail as any).notificationStatus === "failed" && (orderDetail as any).notificationError && (
                        <div className="text-xs text-destructive">
                          {translate("失败原因", "Error")}: {(orderDetail as any).notificationError}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Status actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {(orderDetail.physicalStatus === "pending" || orderDetail.physicalStatus === "receipt_uploaded") && (
                    <Button size="sm"
                      onClick={() => {
                        updateStatusMutation.mutate({ id: orderDetail.id, physicalStatus: "packing" });
                      }}>
                      {translate("确认收款并转交包货", "Confirm Payment & Transfer to Packing")}
                    </Button>
                  )}
                  {orderDetail.physicalStatus === "receipt_uploaded" && (
                    <Button size="sm" variant="outline"
                      onClick={() => {
                        updateStatusMutation.mutate({ id: orderDetail.id, physicalStatus: "pending" });
                      }}>
                      {translate("驳回付款凭证", "Reject Payment Receipt")}
                    </Button>
                  )}
                  {orderDetail.physicalStatus === "shipped" && (
                    <Button size="sm" variant="outline"
                      onClick={() => {
                        updateStatusMutation.mutate({ id: orderDetail.id, physicalStatus: "completed" });
                      }}>
                      {translate("标记完成", "Mark as Completed")}
                    </Button>
                  )}
                  {orderDetail.physicalStatus !== "completed" && orderDetail.physicalStatus !== "cancelled" && orderDetail.physicalStatus !== "shipped" && (
                    <Button size="sm" variant="destructive"
                      onClick={() => setCancelDialogOpen(true)}>
                      <Ban className="h-4 w-4 mr-1" />{translate("取消订单", "Cancel Order")}
                    </Button>
                  )}
                </div>
              </TabsContent>

              {/* Tab: Items */}
              <TabsContent value="items" className="space-y-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">{translate("商品图片", "Image")}</TableHead>
                      <TableHead className="min-w-[200px]">{translate("商品名称", "Product Name")}</TableHead>
                      <TableHead>{translate("SKU", "SKU")}</TableHead>
                      <TableHead>{translate("关键字", "Keyword")}</TableHead>
                      <TableHead>{translate("规格", "Variant")}</TableHead>
                      <TableHead>{translate("数量", "Qty")}</TableHead>
                      <TableHead>{translate("单价", "Unit Price")}</TableHead>
                      <TableHead>{translate("小计", "Subtotal")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderDetail.items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.productImage ? (
                            <img src={item.productImage} alt={item.productName} className="h-20 w-20 rounded-lg object-cover border" />
                          ) : (
                            <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">{translate("无图", "No Img")}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium" style={{ whiteSpace: "normal", wordBreak: "break-word", maxWidth: "300px" }}>{item.productName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">{item.productSku || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.keyword || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.variationName || "-"}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>RM {item.unitPrice}</TableCell>
                        <TableCell className="font-semibold">RM {item.subtotal}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Tab: Payment */}
              <TabsContent value="payment" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">{translate("订单总额", "Total Amount")}</p>
                      <p className="text-2xl font-bold">RM {orderDetail.totalAmount}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">{translate("已付金额", "Total Paid")}</p>
                      <p className="text-2xl font-bold text-green-600">RM {totalPaid.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">{translate("未付金额", "Remaining")}</p>
                      <p className={`text-2xl font-bold ${remainingAmount > 0 ? "text-orange-600" : "text-green-600"}`}>
                        RM {remainingAmount.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{translate("付款记录", "Payment Records")}</h3>
                  {orderDetail.physicalStatus !== "cancelled" && orderDetail.physicalStatus !== "completed" && (
                    <Button size="sm" variant="outline" onClick={() => setPaymentDialogOpen(true)}>
                      <DollarSign className="h-4 w-4 mr-1" />{translate("添加付款", "Add Payment")}
                    </Button>
                  )}
                </div>

                {orderDetail.payments?.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{translate("日期", "Date")}</TableHead>
                        <TableHead>{translate("金额", "Amount")}</TableHead>
                        <TableHead>{translate("付款方式", "Method")}</TableHead>
                        <TableHead>{translate("备注", "Notes")}</TableHead>
                        <TableHead>{translate("操作人", "Recorded By")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderDetail.payments.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{new Date(p.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="font-semibold text-green-600">RM {p.amount}</TableCell>
                          <TableCell>{p.paymentMethodName || "-"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.notes || "-"}</TableCell>
                          <TableCell className="text-sm">{p.recordedBy || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">{translate("暂无付款记录", "No payment records")}</p>
                )}

                {orderDetail.receiptUrl && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">{translate("付款凭证", "Payment Receipt")}</p>
                    <a href={orderDetail.receiptUrl} target="_blank" rel="noreferrer" className="inline-block rounded-lg border bg-muted/30 p-1 transition-opacity hover:opacity-80">
                      <img src={orderDetail.receiptUrl} alt={translate("付款凭证", "Payment Receipt")} className="h-32 w-48 rounded object-cover" />
                    </a>
                  </div>
                )}
              </TabsContent>

              {/* Tab: Shipping */}
              <TabsContent value="shipping" className="space-y-4">
                {orderDetail.physicalStatus === "packing" && (
                  <div className="space-y-3 p-4 border rounded-lg">
                    <h3 className="font-medium">{translate("填写发货信息", "Fill Shipping Info")}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>{translate("快递公司", "Courier Company")}</Label>
                        <Input value={shipForm.courierCompany}
                          onChange={(e) => setShipForm({ ...shipForm, courierCompany: e.target.value })}
                          placeholder="J&T, Poslaju..." />
                      </div>
                      <div>
                        <Label>{translate("追踪号码", "Tracking Number")}</Label>
                        <Input value={shipForm.trackingNumber}
                          onChange={(e) => setShipForm({ ...shipForm, trackingNumber: e.target.value })}
                          placeholder="Tracking number" />
                      </div>
                    </div>
                    <Button size="sm" onClick={handleShip}>
                      <Truck className="h-4 w-4 mr-2" />
                      {translate("确认发货", "Confirm Shipment")}
                    </Button>
                  </div>
                )}

                {orderDetail.physicalStatus === "shipped" && (
                  <div className="space-y-3">
                    <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-5 w-5 text-green-600" />
                        <span className="font-medium">{translate("已发货", "Shipped")}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">{translate("快递公司", "Courier Company")}</p>
                          <p className="font-medium">{orderDetail.courierCompany || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{translate("追踪号码", "Tracking Number")}</p>
                          <p className="font-mono">{orderDetail.trackingNumber || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{translate("发货时间", "Shipped At")}</p>
                          <p className="font-medium">{orderDetail.shippedAt ? new Date(orderDetail.shippedAt).toLocaleString() : "-"}</p>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline"
                      onClick={() => updateStatusMutation.mutate({ id: orderDetail.id, physicalStatus: "completed" })}>
                      {translate("标记完成", "Mark as Completed")}
                    </Button>
                  </div>
                )}

                {orderDetail.physicalStatus === "completed" && (
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{translate("订单已完成", "Order Completed")}</span>
                    </div>
                    {orderDetail.completedAt && (
                      <p className="text-sm text-muted-foreground mt-1">{translate("完成时间", "Completed at")}: {new Date(orderDetail.completedAt).toLocaleString()}</p>
                    )}
                  </div>
                )}

                {orderDetail.physicalStatus === "cancelled" && (
                  <div className="p-4 border rounded-lg bg-destructive/10">
                    <div className="flex items-center gap-2">
                      <Ban className="h-5 w-5 text-destructive" />
                      <span className="font-medium text-destructive">{translate("订单已取消", "Order Cancelled")}</span>
                    </div>
                    {(orderDetail as any).cancelReason && (
                      <p className="text-sm mt-1">{translate("取消原因", "Cancel Reason")}: {(orderDetail as any).cancelReason}</p>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Tab: Order Remarks */}
              <TabsContent value="remarks" className="space-y-3">
                {/* Add remark form */}
                {showRemarkForm ? (
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">{translate("添加备注", "Add Remark")}</Label>
                      <Button variant="ghost" size="sm" onClick={() => setShowRemarkForm(false)}><X className="h-4 w-4" /></Button>
                    </div>
                    <div>
                      <Label className="text-sm">{translate("备注类别", "Remark Category")}</Label>
                      <Select value={remarkForm.remarkCategory} onValueChange={(v) => setRemarkForm({ ...remarkForm, remarkCategory: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder={translate("选择类别", "Select category")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="repotting">{translate("换盆", "Repotting")}</SelectItem>
                          <SelectItem value="desired_delivery_date">{translate("希望收货日期", "Desired Delivery Date")}</SelectItem>
                          <SelectItem value="other">{translate("其他", "Other")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {remarkForm.remarkCategory === "desired_delivery_date" && (
                      <div className="space-y-2">
                        <div>
                          <Label className="text-sm">{translate("希望收货日期", "Desired Delivery Date")}</Label>
                          <Input
                            type="date"
                            value={remarkForm.desiredDeliveryDate}
                            onChange={(e) => setRemarkForm({ ...remarkForm, desiredDeliveryDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">{translate("原因", "Reason")}</Label>
                          <Input
                            placeholder={translate("例如：生日、搬家、出国等", "e.g. Birthday, Moving, Travel, etc.")}
                            value={remarkForm.desiredDeliveryReason}
                            onChange={(e) => setRemarkForm({ ...remarkForm, desiredDeliveryReason: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                    {remarkForm.remarkCategory === "repotting" && (
                      <div className="space-y-2">
                        <Label className="text-sm">{translate("换盆内容（格式：植物 → 花盆 x 数量）", "Repotting details (format: Plant → Pot x Qty)")}</Label>
                        <Textarea
                          placeholder={translate("例如：玫瑰 ×1 → BABA170 白盆 ×1", "e.g. Rose ×1 → BABA170 White Pot ×1")}
                          value={remarkForm.content}
                          onChange={(e) => setRemarkForm({ ...remarkForm, content: e.target.value })}
                          rows={3}
                        />
                      </div>
                    )}
                    {remarkForm.remarkCategory === "other" && (
                      <div>
                        <Label className="text-sm">{translate("备注内容", "Remark Content")}</Label>
                        <Textarea
                          value={remarkForm.content}
                          onChange={(e) => setRemarkForm({ ...remarkForm, content: e.target.value })}
                          rows={3}
                        />
                      </div>
                    )}
                    <Button
                      size="sm"
                      disabled={!remarkForm.remarkCategory || (remarkForm.remarkCategory !== "desired_delivery_date" && !remarkForm.content) || (remarkForm.remarkCategory === "desired_delivery_date" && !remarkForm.desiredDeliveryDate)}
                      onClick={() => {
                        if (editingRemarkId) {
                          updateRemarkMutation.mutate({
                            id: editingRemarkId,
                            content: remarkForm.content || (remarkForm.remarkCategory === "desired_delivery_date" ? `希望收货日期: ${remarkForm.desiredDeliveryDate}${remarkForm.desiredDeliveryReason ? " — " + remarkForm.desiredDeliveryReason : ""}` : ""),
                            remarkCategory: remarkForm.remarkCategory as any,
                            desiredDeliveryDate: remarkForm.desiredDeliveryDate || undefined,
                            desiredDeliveryReason: remarkForm.desiredDeliveryReason || undefined,
                          });
                        } else {
                          createRemarkMutation.mutate({
                            orderId: orderDetail.id,
                            type: "internal",
                            content: remarkForm.content || (remarkForm.remarkCategory === "desired_delivery_date" ? `希望收货日期: ${remarkForm.desiredDeliveryDate}${remarkForm.desiredDeliveryReason ? " — " + remarkForm.desiredDeliveryReason : ""}` : ""),
                            remarkCategory: remarkForm.remarkCategory as any,
                            desiredDeliveryDate: remarkForm.desiredDeliveryDate || undefined,
                            desiredDeliveryReason: remarkForm.desiredDeliveryReason || undefined,
                          });
                        }
                      }}
                    >
                      {editingRemarkId ? translate("更新备注", "Update Remark") : translate("保存备注", "Save Remark")}
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditingRemarkId(null);
                    setRemarkForm({ remarkCategory: "", content: "", desiredDeliveryDate: "", desiredDeliveryReason: "", repottingData: "" });
                    setShowRemarkForm(true);
                  }}>
                    <Plus className="h-4 w-4 mr-1" />
                    {translate("添加备注", "Add Remark")}
                  </Button>
                )}
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {orderRemarksData?.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{translate("暂无备注", "No remarks")}</p>
                    ) : (
                      orderRemarksData?.map((r: any) => (
                        <div key={r.id} className="p-3 border rounded-lg space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {r.type === "live" ? translate("直播", "Live") : r.type === "customer" ? translate("客户", "Customer") : translate("后台", "Internal")}
                            </Badge>
                            {r.remarkCategory && (
                              <Badge variant="secondary" className="text-xs">
                                {r.remarkCategory === "repotting" ? translate("换盆", "Repotting") :
                                 r.remarkCategory === "desired_delivery_date" ? translate("希望收货日期", "Desired Delivery Date") :
                                 translate("其他", "Other")}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm">{r.content}</p>
                          {r.desiredDeliveryDate && (
                            <p className="text-xs text-purple-600 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {translate("希望收货日期", "Desired delivery date")}: {new Date(r.desiredDeliveryDate).toLocaleDateString()}
                              {r.desiredDeliveryReason && <span className="ml-2">— {r.desiredDeliveryReason}</span>}
                            </p>
                          )}
                          {r.repottingData && (
                            <div className="text-xs text-green-700 bg-green-50 dark:bg-green-950/20 p-2 rounded">
                              <Sprout className="h-3 w-3 inline mr-1" />
                              {translate("换盆", "Repotting")}: {r.repottingData}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{translate("建立人", "Created by")}: {r.createdBy || "-"}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-auto h-6 text-xs"
                              onClick={() => {
                                setEditingRemarkId(r.id);
                                setRemarkForm({
                                  remarkCategory: r.remarkCategory || "",
                                  content: r.content || "",
                                  desiredDeliveryDate: r.desiredDeliveryDate ? new Date(r.desiredDeliveryDate).toISOString().split('T')[0] : "",
                                  desiredDeliveryReason: r.desiredDeliveryReason || "",
                                  repottingData: r.repottingData || "",
                                });
                                setShowRemarkForm(true);
                              }}
                            >
                              {translate("编辑", "Edit")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-red-600"
                              onClick={() => {
                                if (confirm(translate("确认删除此备注？", "Delete this remark?"))) {
                                  deleteRemarkMutation.mutate(r.id);
                                }
                              }}
                            >
                              {translate("删除", "Delete")}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab: Operation Logs */}
              <TabsContent value="logs" className="space-y-3">
                {orderDetail.logs?.length > 0 ? (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {orderDetail.logs.map((log: any) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                          <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{log.operationType}</Badge>
                              <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                            </div>
                            {log.description && <p className="text-sm mt-1">{log.description}</p>}
                            {log.operator && <p className="text-xs text-muted-foreground mt-1">{translate("操作人", "Operator")}: {log.operator}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">{translate("暂无操作日志", "No operation logs")}</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("取消订单", "Cancel Order")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("取消原因", "Cancel Reason")}</Label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger>
                  <SelectValue placeholder={translate("请选择取消原因", "Please select a cancel reason")} />
                </SelectTrigger>
                <SelectContent>
                  {CANCEL_REASONS.map(r => (
                    <SelectItem key={r} value={r}>{translate(r, r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(orderDetail as any)?.paidAmount && parseFloat(String((orderDetail as any).paidAmount)) > 0 && (
              <div className="p-3 border rounded-lg bg-orange-50 dark:bg-orange-950/20 text-sm">
                {translate("此订单已有付款记录，取消后需处理退款或Credit。", "This order has payment records. Refund or credit must be processed after cancellation.")}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>{translate("返回", "Back")}</Button>
            <Button variant="destructive" onClick={handleCancelOrder} disabled={cancelOrderMutation.isPending}>
              {translate("确认取消", "Confirm Cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("添加付款记录", "Add Payment Record")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("付款金额 (RM)", "Payment Amount (RM)")}</Label>
              <Input type="number" step="0.01" value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                placeholder="0.00" />
            </div>
            <div>
              <Label>{translate("付款方式", "Payment Method")}</Label>
              <Input value={paymentForm.paymentMethodName}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethodName: e.target.value })}
                placeholder={translate("如：银行转账/TNG/现金", "e.g. Bank Transfer/TNG/Cash")} />
            </div>
            <div>
              <Label>{translate("付款凭证 URL", "Receipt URL")}</Label>
              <Input value={paymentForm.receiptUrl}
                onChange={(e) => setPaymentForm({ ...paymentForm, receiptUrl: e.target.value })}
                placeholder="https://..." />
            </div>
            <div>
              <Label>{translate("备注", "Notes")}</Label>
              <Textarea value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                rows={2} />
            </div>
            {remainingAmount > 0 && (
              <p className="text-sm text-muted-foreground">
                {translate("剩余未付", "Remaining unpaid")}: RM {remainingAmount.toFixed(2)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={handleAddPayment} disabled={addPaymentMutation.isPending}>
              {translate("确认添加", "Confirm Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual order creation dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate("手动建立订单", "Create Manual Order")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Order Nature & Source */}
            <div className="grid grid-cols-3 gap-3 p-4 border rounded-lg">
              <div>
                <Label className="text-xs">{translate("订单性质", "Order Nature")}</Label>
                <Select value={orderNature} onValueChange={setOrderNature}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_NATURE).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{translate("订单来源", "Order Source")}</Label>
                <Select value={orderSource} onValueChange={setOrderSource} disabled={isWalkIn}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_SOURCE).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>

            {/* Customer info */}
            <div className="space-y-3 p-4 border rounded-lg">
              <h3 className="font-medium text-sm">{translate("客户信息", "Customer Information")}</h3>
              {/* Customer search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={translate("搜索现有客户(姓名/号码/FB名/Messenger/编号)...", "Search existing customer (name/phone/FB/Messenger/ID)...")}
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {customerSearchResults && customerSearchResults.length > 0 && customerSearchQuery && (
                <ScrollArea className="h-[120px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {customerSearchResults.slice(0, 10).map((c: any) => (
                      <button key={c.id} onClick={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerForm({
                          ...customerForm,
                          name: c.name || "",
                          facebookName: c.facebookName || "",
                          facebookId: c.facebookId || "",
                          messengerId: c.messengerId || "",
                          phoneNumber: c.phoneNumber || "",
                          address: c.address || "",
                        });
                        setCustomerSearchQuery("");
                      }} className="w-full text-left p-2 rounded hover:bg-muted text-sm">
                        <span className="font-medium">{c.name || c.facebookName || c.displayName || "Unknown"}</span>
                        <span className="text-muted-foreground ml-2">{c.phoneNumber || c.customerId || ""}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
              {selectedCustomerId && (
                <Badge variant="secondary" className="w-fit">
                  {translate("已选客户 ID", "Selected Customer ID")}: {selectedCustomerId}
                  <button onClick={() => { setSelectedCustomerId(undefined); setCustomerForm({ facebookName: "", facebookId: "", messengerId: "", name: "", phoneNumber: "", address: "", shippingMethod: "west_malaysia" }); }} className="ml-2">×</button>
                </Badge>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{translate("客户姓名", "Customer Name")}</Label>
                  <Input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} placeholder={translate("收件人姓名", "Recipient Name")} />
                </div>
                <div>
                  <Label className="text-xs">{translate("电话号码", "Phone Number")}</Label>
                  <Input value={customerForm.phoneNumber} onChange={(e) => setCustomerForm({ ...customerForm, phoneNumber: e.target.value })} placeholder="012-3456789" />
                </div>
                <div>
                  <Label className="text-xs">{translate("Facebook 名称", "Facebook Name")}</Label>
                  <Input value={customerForm.facebookName} onChange={(e) => setCustomerForm({ ...customerForm, facebookName: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{translate("Facebook ID", "Facebook ID")}</Label>
                  <Input value={customerForm.facebookId} onChange={(e) => setCustomerForm({ ...customerForm, facebookId: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{translate("Messenger ID", "Messenger ID")}</Label>
                  <Input value={customerForm.messengerId} onChange={(e) => setCustomerForm({ ...customerForm, messengerId: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{translate("运送方式", "Shipping Method")}</Label>
                  <Select value={customerForm.shippingMethod} onValueChange={(v) => setCustomerForm({ ...customerForm, shippingMethod: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="west_malaysia">{translate("西马", "West Malaysia")}</SelectItem>
                      <SelectItem value="east_malaysia_shopee">{translate("东马 Shopee", "East Malaysia Shopee")}</SelectItem>
                      <SelectItem value="east_malaysia_poslaju">{translate("东马 Poslaju", "East Malaysia Poslaju")}</SelectItem>
                      <SelectItem value="self_pickup">{translate("自取", "Self Pickup")}</SelectItem>
                      <SelectItem value="lalamove">{translate("Lalamove", "Lalamove")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">{translate("收件地址", "Shipping Address")}</Label>
                <Textarea value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} rows={2} />
              </div>
            </div>

            {/* Product search */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={translate("搜索商品(名称/编号/关键词/SKU)...", "Search product (name/SKU/keyword)...")}
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Order items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{translate("订单商品", "Order Items")}</Label>
                <Button variant="outline" size="sm" onClick={addManualItem}>
                  <Plus className="h-3 w-3 mr-1" />{translate("添加商品", "Add Product")}
                </Button>
              </div>
              {manualItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-lg">
                  <div className="col-span-4">
                    <Label className="text-xs">{translate("商品", "Product")}</Label>
                    <Select
                      value={item.productId?.toString() || "none"}
                      onValueChange={(v) => handleManualItemProductSelect(idx, v)}
                    >
                      <SelectTrigger className="h-8"><SelectValue placeholder={translate("选择商品", "Select Product")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{translate("请选择...", "Please select...")}</SelectItem>
                        {(productSearchResults || products || [])?.slice(0, 50).map((p: any) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.sku})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">{translate("数量", "Quantity")}</Label>
                    <Input type="number" className="h-8" value={item.quantity} onChange={(e) => updateManualItem(idx, "quantity", parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">{translate("单价", "Unit Price")}</Label>
                    <Input type="number" className="h-8" value={item.unitPrice} onChange={(e) => updateManualItem(idx, "unitPrice", e.target.value)} />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">{translate("小计", "Subtotal")}</Label>
                    <Input className="h-8" value={`RM ${item.subtotal}`} disabled />
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" onClick={() => removeManualItem(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {manualItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{translate("点击「添加商品」开始建立订单", "Click 'Add Product' to start creating an order")}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={handleCreateOrder} disabled={findCustomerMutation.isPending || createOrderMutation.isPending}>
              {translate("创建订单", "Create Order")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* V2.0.42: Custom message template dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {messageDialogMode === "messenger"
                ? translate("编辑 Messenger 消息", "Edit Messenger Message")
                : translate("编辑 WhatsApp 消息", "Edit WhatsApp Message")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {translate("发送前可以修改消息内容。", "You can edit the message before sending.")}
            </p>
            <Textarea
              value={editableMessage}
              onChange={(e) => setEditableMessage(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {translate("提示：链接已自动填入消息中，可直接修改文字内容。", "Tip: The link is auto-filled. You can edit the text directly.")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialogOpen(false)}>
              {translate("取消", "Cancel")}
            </Button>
            {messageDialogMode === "whatsapp" ? (
              <Button onClick={() => {
                const phone = (orderDetail as any).phoneNumber || "";
                if (!phone) {
                  toast.error(translate("客户没有电话号码", "Customer has no phone number"));
                  return;
                }
                const msg = encodeURIComponent(editableMessage);
                window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
                setMessageDialogOpen(false);
              }}>
                {translate("发送", "Send")}
              </Button>
            ) : (
              <Button onClick={() => {
                sendCheckoutMutation.mutate(
                  { orderId: orderDetail!.id, customMessage: editableMessage },
                  { onSuccess: () => setMessageDialogOpen(false) }
                );
              }} disabled={sendCheckoutMutation.isPending}>
                {translate("发送", "Send")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
