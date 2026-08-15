import { useState, useEffect, useRef } from "react";
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
import { Search, Eye, Truck, Plus, Trash2, X, Package, DollarSign, Clock, FileText, Ban, Calendar, CheckCircle, AlertCircle, Sprout, Send, Link2, MessageCircle, Copy, RotateCw, RotateCcw, Bell, Upload, Loader2, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useSearch, useLocation } from "wouter";
import { ITEM_SOURCE_LABELS } from "@shared/const";
import { getSpecialOrderHandlingLabel, getSpecialOrderReasonLabel, SPECIAL_ORDER_FILTER_OPTIONS } from "@shared/specialOrderDisplay";
import { ProductImagePreview } from "@/components/ProductImagePreview";
import { AdminPageHeader } from "@/components/AdminPageHeader";

const PHYSICAL_STATUS = {
  pending: { label: "未汇款订单", enLabel: "Unpaid Order", variant: "outline" },
  receipt_uploaded: { label: "待审核付款凭证", enLabel: "Pending Payment Verification", variant: "secondary" },
  partial_payment: { label: "部分汇款", enLabel: "Partial Payment", variant: "secondary" },
  hold_order: { label: "保留订单", enLabel: "Hold Order", variant: "outline" },
  packing: { label: "待包货", enLabel: "Pending Packing", variant: "default" },
  partial_shipped: { label: "部分发货", enLabel: "Partial Shipped", variant: "secondary" },
  shipped: { label: "已发货", enLabel: "Shipped", variant: "default" },
  completed: { label: "已完成", enLabel: "Completed", variant: "default" },
  cancelled: { label: "已取消", enLabel: "Cancelled", variant: "destructive" },
} as const;

// V2.0.99: XTC Import order statuses (final unified version)
const IMPORT_STATUS = {
  pending: { label: "挂单", enLabel: "Pending", variant: "outline" },
  receipt_uploaded: { label: "待审核付款凭证", enLabel: "Pending Payment Verification", variant: "secondary" },
  partial_payment: { label: "部分汇款", enLabel: "Partial Payment", variant: "secondary" },
  waiting_stock: { label: "待备货", enLabel: "Waiting Stock", variant: "secondary" },
  ready_to_ship: { label: "待发货", enLabel: "Ready to Ship", variant: "default" },
  scheduled_ship: { label: "预约发货", enLabel: "Scheduled Shipping", variant: "secondary" },
  partial_shipped: { label: "部分发货", enLabel: "Partial Shipped", variant: "secondary" },
  shipped: { label: "已发货", enLabel: "Shipped", variant: "default" },
  completed: { label: "已完成", enLabel: "Completed", variant: "default" },
  cancelled: { label: "取消", enLabel: "Cancelled", variant: "destructive" },
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

const MERGE_SOURCE_LABELS: Record<string, { zh: string; en: string }> = {
  mall: { zh: "商城", en: "Mall" },
  store: { zh: "商城", en: "Mall" },
  facebook_live: { zh: "FB直播", en: "FB Live" },
  facebook_post: { zh: "FB贴文", en: "FB Post" },
  facebook_reel: { zh: "FB短片", en: "FB Reel" },
  messenger: { zh: "Messenger 私聊", en: "Messenger chat" },
  private_chat: { zh: "Messenger 私聊", en: "Messenger chat" },
  ai: { zh: "AI 客服", en: "AI assistant" },
  manual: { zh: "后台手动", en: "Admin manual" },
  admin: { zh: "后台手动", en: "Admin manual" },
};

const CANCEL_REASONS = [
  { zh: "客户取消", en: "Customer cancelled" },
  { zh: "缺货", en: "Out of stock" },
  { zh: "重复订单", en: "Duplicate order" },
  { zh: "错误下单", en: "Incorrect order" },
  { zh: "客户未付款", en: "Customer did not pay" },
  { zh: "其他", en: "Other" },
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
  const urlSpecial = new URLSearchParams(searchParams).get("special");
  const urlSpecialType = new URLSearchParams(searchParams).get("type");
  const urlCrossChannelMergeToday = new URLSearchParams(searchParams).get("crossChannelMergeToday");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(urlStatus || "all");
  const [todayOnly, setTodayOnly] = useState(urlToday === "1");
  const [natureFilter, setNatureFilter] = useState(urlNature || "all");
  const [channelFilter, setChannelFilter] = useState(urlChannel || "all");
  const [specialFilter, setSpecialFilter] = useState(urlSpecial === "1" || Boolean(urlSpecialType));
  const [specialTypeFilter, setSpecialTypeFilter] = useState(urlSpecialType || "all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [remarkFilter, setRemarkFilter] = useState("all");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [crossChannelMergeToday, setCrossChannelMergeToday] = useState(urlCrossChannelMergeToday === "1");

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const newStatus = params.get('status');
      const newToday = params.get('today');
      const newNature = params.get('nature');
      const newChannel = params.get('channel');
      const newSpecial = params.get('special');
      const newSpecialType = params.get('type');
      const newCrossChannelMergeToday = params.get('crossChannelMergeToday');
      if (newStatus !== null) setStatusFilter(newStatus);
      setSpecialFilter(newSpecial === '1' || Boolean(newSpecialType));
      setSpecialTypeFilter(newSpecialType || 'all');
      if (newToday !== null) setTodayOnly(newToday === '1');
      if (newNature !== null) setNatureFilter(newNature);
      if (newChannel !== null) setChannelFilter(newChannel);
      setCrossChannelMergeToday(newCrossChannelMergeToday === '1');
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
  // V2.0.86: Recipient form (separate from buyer/customer info)
  // V2.1.07: Added recipient address fields for auto-fill from customer profile
  const [recipientForm, setRecipientForm] = useState({
    recipientName: "", recipientPhone: "",
    recipientAddress: "", recipientCity: "", recipientState: "", recipientPostcode: "", recipientCountry: "",
  });
  const [buyerIsRecipient, setBuyerIsRecipient] = useState(true);
  // V2.0.86: Auto-sync customer name/phone to recipient when buyer is recipient
  useEffect(() => {
    if (buyerIsRecipient) {
      setRecipientForm(prev => ({
        ...prev,
        recipientName: customerForm.name,
        recipientPhone: customerForm.phoneNumber,
      }));
    }
  }, [customerForm.name, customerForm.phoneNumber, buyerIsRecipient]);
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
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectPaymentId, setRejectPaymentId] = useState<number | null>(null);
  // V2.1.15: Edit payment and refund state
  const [editPaymentId, setEditPaymentId] = useState<number | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({ amount: "", paymentMethod: "", receiptUrl: "", notes: "" });
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundForm, setRefundForm] = useState({ amount: "", refundMethod: "bank_transfer", receiptUrl: "", notes: "" });
  // V2.1.18: Overpayment processing state
  const [overpaymentDialogOpen, setOverpaymentDialogOpen] = useState(false);
  const [overpaymentForm, setOverpaymentForm] = useState({ amount: "", method: "credit" as 'credit' | 'tng' | 'cash' | 'bank_transfer' | 'other', notes: "" });
  // V2.1.19: Special status management state
  const [specialStatusFilter, setSpecialStatusFilter] = useState<'pending' | 'resolved' | 'all' | null>(null);
  const [resolveSpecialDialogOpen, setResolveSpecialDialogOpen] = useState(false);
  const [resolveSpecialForm, setResolveSpecialForm] = useState({ specialStatusId: 0, resolutionMethod: "credit" as 'credit' | 'tng' | 'cash' | 'bank_transfer' | 'other' | 'data_corrected' | 'company_bear' | 'false_positive', resolutionRemark: "" });
  const [addSpecialDialogOpen, setAddSpecialDialogOpen] = useState(false);
  const [addSpecialForm, setAddSpecialForm] = useState({ type: "other" as string, reason: "", amount: "" });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptFileRef = useRef<HTMLInputElement>(null);
  const [remarkForm, setRemarkForm] = useState({ remarkCategory: "", content: "", desiredDeliveryDate: "", desiredDeliveryReason: "", repottingData: "" });
  // V2.0.53: Repotting groups — multiple repot pairs with plant selection from order items
  const [repotGroups, setRepotGroups] = useState<{ selectedPlantIds: number[]; potName: string }[]>([{ selectedPlantIds: [], potName: "" }]);
  const [showRemarkForm, setShowRemarkForm] = useState(false);
  const [editingRemarkId, setEditingRemarkId] = useState<number | null>(null);
  // V2.0.42: Custom message template dialog
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageDialogMode, setMessageDialogMode] = useState<"messenger" | "whatsapp">("messenger");
  const [editableMessage, setEditableMessage] = useState("");
  // V2.0.48: Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const utils = trpc.useUtils();

  const { data: products } = trpc.products.list.useQuery({});
  const { data: systemSettings } = trpc.settings.get.useQuery();

  const isImportCategory = orderCategory === "import";
  const { data: orders, isLoading } = trpc.orders.list.useQuery({
    search: search || undefined,
    physicalStatus: !isImportCategory && statusFilter !== "all" ? statusFilter : undefined,
    importStatus: isImportCategory && statusFilter !== "all" ? statusFilter : undefined,
    todayOnly: todayOnly || undefined,
    orderNature: natureFilter !== "all" ? natureFilter : undefined,
    orderCategory: orderCategory && orderCategory !== "all" ? orderCategory : undefined,
    salesChannel: channelFilter !== "all" ? channelFilter : undefined,
    hasRemark: remarkFilter !== "all" ? (remarkFilter === "with" ? true : false) : undefined,
    notificationStatus: notificationFilter !== "all" ? notificationFilter : undefined,
    isSpecialOrder: specialFilter || undefined,
    specialOrderStatus: specialFilter && specialStatusFilter && specialStatusFilter !== "all" ? specialStatusFilter : undefined,
    specialOrderType: specialFilter && specialTypeFilter !== "all" ? specialTypeFilter : undefined,
    crossChannelMergeToday: crossChannelMergeToday || undefined,
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
        recipientName: recipientForm.recipientName || undefined,
        recipientPhone: recipientForm.recipientPhone || undefined,
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
      setRecipientForm({ recipientName: "", recipientPhone: "", recipientAddress: "", recipientCity: "", recipientState: "", recipientPostcode: "", recipientCountry: "" });
      setBuyerIsRecipient(true);
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

  const reviewPaymentMutation = trpc.orders.reviewPayment.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      if (detailOrderId) refetchDetail();
      toast.success(translate("付款审核已更新", "Payment review updated"));
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: (e) => toast.error(translate("审核失败: {message}", "Review failed: {message}", { message: e.message })),
  });

  // V2.1.15: Edit payment mutation
  const editPaymentMutation = trpc.orders.editPayment.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      if (detailOrderId) refetchDetail();
      toast.success(translate("付款记录已更新", "Payment record updated"));
      setEditPaymentDialogOpen(false);
      setEditPaymentId(null);
    },
    onError: (e) => toast.error(translate("更新失败: {message}", "Update failed: {message}", { message: e.message })),
  });

  // V2.1.15: Add refund mutation
  const addRefundMutation = trpc.orders.addRefund.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      if (detailOrderId) refetchDetail();
      toast.success(translate("退款已记录", "Refund recorded"));
      setRefundDialogOpen(false);
      setRefundForm({ amount: "", refundMethod: "bank_transfer", receiptUrl: "", notes: "" });
    },
    onError: (e) => toast.error(translate("退款失败: {message}", "Refund failed: {message}", { message: e.message })),
  });

  // V2.1.18: Process overpayment mutation
  const processOverpaymentMutation = trpc.orders.processOverpayment.useMutation({
    onSuccess: (data) => {
      utils.orders.invalidate();
      if (detailOrderId) refetchDetail();
      toast.success(translate("多汇款已处理", "Overpayment processed"));
      setOverpaymentDialogOpen(false);
      setOverpaymentForm({ amount: "", method: "credit", notes: "" });
    },
    onError: (e) => toast.error(translate("处理失败: {message}", "Processing failed: {message}", { message: e.message })),
  });

  // V2.1.19: Special status mutations
  const createSpecialStatusMutation = trpc.orders.createSpecialStatus.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      if (detailOrderId) refetchDetail();
      toast.success(translate("特别状态已新增", "Special status added"));
      setAddSpecialDialogOpen(false);
      setAddSpecialForm({ type: "other", reason: "", amount: "" });
    },
    onError: (e) => toast.error(translate("新增失败: {message}", "Failed: {message}", { message: e.message })),
  });

  const resolveSpecialStatusMutation = trpc.orders.resolveSpecialStatus.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      if (detailOrderId) refetchDetail();
      toast.success(translate("特别状态已处理", "Special status resolved"));
      setResolveSpecialDialogOpen(false);
      setResolveSpecialForm({ specialStatusId: 0, resolutionMethod: "credit", resolutionRemark: "" });
    },
    onError: (e) => toast.error(translate("处理失败: {message}", "Failed: {message}", { message: e.message })),
  });

  const migrateSpecialStatusesMutation = trpc.orders.migrateSpecialStatuses.useMutation({
    onSuccess: (data: any) => {
      utils.orders.invalidate();
      toast.success(translate(`已迁移 ${data?.migrated || 0} 张订单`, `Migrated ${data?.migrated || 0} orders`));
    },
    onError: (e) => toast.error(translate("迁移失败: {message}", "Migration failed: {message}", { message: e.message })),
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
  // V2.0.48: Batch send selected orders
  const batchSendSelectedMutation = trpc.orders.batchSendSelected.useMutation({
    onSuccess: (data: any) => {
      utils.orders.invalidate();
      setSelectedIds(new Set());
      const total = data.total || 0;
      const sent = data.sent || 0;
      const failed = data.failed || 0;
      const skipped = data.skipped || 0;
      const failedList = (data.failedOrders || []).map((o: any) => `${o.orderNumber} - ${o.customerName} (${o.error})`).join("\n");
      const summary = lang === "zh"
        ? `选中 ${total} 张订单\n发送成功: ${sent}\n发送失败: ${failed}\n跳过: ${skipped}`
        : `Selected ${total} orders\nSent: ${sent}\nFailed: ${failed}\nSkipped: ${skipped}`;
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
        recipientName: recipientForm.recipientName || undefined,
        recipientPhone: recipientForm.recipientPhone || undefined,
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

  async function handleUploadReceipt(file: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(translate("文件大小不能超过 10MB", "File size cannot exceed 10MB"));
      return;
    }
    setUploadingReceipt(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: base64, filename: file.name, contentType: file.type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      setPaymentForm(prev => ({ ...prev, receiptUrl: data.url }));
      toast.success(translate("单据已上传", "Receipt uploaded"));
    } catch (e: any) {
      toast.error(translate("上传失败: {message}", "Upload failed: {message}", { message: e.message }));
    } finally {
      setUploadingReceipt(false);
    }
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
      paymentMethod: paymentForm.paymentMethodName || undefined,
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

  const totalPaid = orderDetail?.payments?.filter((p: any) => p.reviewStatus === 'approved').reduce((sum: number, p: any) => sum + parseFloat(String(p.amount)), 0) || 0;
  const totalAmount = orderDetail ? parseFloat(String(orderDetail.totalAmount)) : 0;
  const remainingAmount = totalAmount - totalPaid;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={crossChannelMergeToday ? translate("今日跨渠道合单", "Today's Cross-channel Merges") : orderCategory === "import" ? translate("中国代购订单", "Import Orders") : orderCategory === "local" ? translate("本地订单", "Local Orders") : translate("订单管理", "Order Management")}
        description={crossChannelMergeToday ? translate("以下为今天实际追加至未汇款 XT，以及截止日期内 XTC 订单的合单记录；点击订单可查看完整详情。", "These are today's additions to unpaid XT and eligible in-window XTC orders. Click an order for full details.") : orderCategory === "import" ? translate("中国代购订单管理与处理", "Import order management & processing") : orderCategory === "local" ? translate("本地订单管理与处理", "Local order management & processing") : translate("搜索与筛选所有订单", "Search and filter all orders")}
        actions={orderCategory !== "all" ? (
          <Button className="w-full sm:w-auto" onClick={() => setLocation(`/orders/create/${orderCategory === "import" ? "import" : "local"}`)}>
            <Plus className="h-4 w-4 mr-2" />{translate("手动建单", "Create Manual Order")}
          </Button>
        ) : undefined}
      />

      {crossChannelMergeToday && (
        <Card className="border-cyan-200 bg-cyan-50/60 dark:border-cyan-900/60 dark:bg-cyan-950/20" data-cross-channel-merge-list>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-cyan-900 dark:text-cyan-100">{translate("今天实际发生的合单明细", "Today's actual merge details")}</p>
                <p className="text-sm text-muted-foreground">{translate("每一项代表一次追加动作；同一订单当天可出现多次。", "Each item is one addition action; an order can appear more than once today.")}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setCrossChannelMergeToday(false); setLocation("/orders"); }}>
                {translate("查看全部订单", "View all orders")}
              </Button>
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{translate("加载合单明细中...", "Loading merge details...")}</p>
            ) : orders?.length === 0 ? (
              <p className="rounded-md border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">{translate("今天暂时没有跨渠道合单记录。", "No cross-channel merge records today.")}</p>
            ) : (
              <div className="space-y-2">
                {(orders || []).flatMap((order: any) => ((order.crossChannelMergeDetails || []).map((detail: any, index: number) => ({ order, detail, index })))).map(({ order, detail, index }: any) => {
                  const originalSource = ORDER_SOURCE[order.orderSource as keyof typeof ORDER_SOURCE];
                  const addedSources = (detail.addedSources || []).map((source: string) => {
                    const label = MERGE_SOURCE_LABELS[source];
                    return label ? translate(label.zh, label.en) : source;
                  }).join("、") || detail.operator;
                  return (
                    <button
                      type="button"
                      key={`${order.id}-${detail.mergedAt}-${index}`}
                      className="grid w-full gap-2 rounded-lg border bg-background/75 p-3 text-left transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:grid-cols-[minmax(120px,0.8fr)_minmax(120px,0.9fr)_minmax(150px,1.4fr)_auto] sm:items-center"
                      onClick={() => openDetail(order.id)}
                      aria-label={translate("查看订单 {orderNumber} 的合单详情", "View merge details for order {orderNumber}", { orderNumber: order.orderNumber })}
                    >
                      <div>
                        <p className="font-mono text-sm font-semibold text-cyan-800 dark:text-cyan-200">{order.orderNumber}</p>
                        <p className="text-xs text-muted-foreground">{order.customerName || order.facebookName || "-"}</p>
                        <p className="mt-1 text-xs font-medium text-cyan-700 dark:text-cyan-300">
                          {order.orderCategory === "import" ? translate("XTC 中国代购", "XTC Import") : translate("XT 本地订单", "XT Local")}
                        </p>
                      </div>
                      <div className="text-sm">
                        <p>{translate("原订单来源：{source}", "Original source: {source}", { source: originalSource ? translate(originalSource.label, originalSource.enLabel) : "-" })}</p>
                        <p className="text-muted-foreground">{translate("新增来源：{source}", "Added from: {source}", { source: addedSources })}</p>
                      </div>
                      <div className="min-w-0 text-sm">
                        <p className="truncate" title={detail.itemSummary}>{detail.itemSummary}</p>
                        <p className="text-xs text-muted-foreground">{new Date(detail.mergedAt).toLocaleString(lang === "zh" ? "zh-MY" : "en-MY", { dateStyle: "short", timeStyle: "short" })}</p>
                      </div>
                      <p className="text-base font-bold text-cyan-700 dark:text-cyan-300">RM {Number(detail.addedAmount || 0).toFixed(2)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={translate("搜索订单号/客户/追踪号...", "Search order/customer/tracking...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] shrink-0 sm:w-[180px]">
            <SelectValue placeholder={translate("订单状态", "Order Status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{translate("全部状态", "All Statuses")}</SelectItem>
            {Object.entries(isImportCategory ? IMPORT_STATUS : PHYSICAL_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={natureFilter} onValueChange={setNatureFilter}>
          <SelectTrigger className="w-[145px] shrink-0 sm:w-[160px]">
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
          <SelectTrigger className="w-[135px] shrink-0 sm:w-[150px]">
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
          <SelectTrigger className="w-[135px] shrink-0 sm:w-[150px]">
            <SelectValue placeholder={translate("订单备注", "Order Remarks")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{translate("全部备注", "All Remarks")}</SelectItem>
            <SelectItem value="with">{translate("有备注", "With Remarks")}</SelectItem>
            <SelectItem value="without">{translate("无备注", "No Remarks")}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={specialFilter ? "default" : "outline"}
          size="sm"
          onClick={() => setSpecialFilter(!specialFilter)}
          className="h-9 shrink-0"
        >
          {translate("特别订单", "Special Orders")}
        </Button>
        {specialFilter && (
          <>
          <Select
            value={specialStatusFilter || "pending"}
            onValueChange={(v) => setSpecialStatusFilter(v as any)}
          >
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">{translate("待处理", "Pending")}</SelectItem>
              <SelectItem value="resolved">{translate("已处理", "Resolved")}</SelectItem>
              <SelectItem value="all">{translate("全部", "All")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={specialTypeFilter} onValueChange={setSpecialTypeFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder={translate("异常原因", "Special Reason")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{translate("全部原因", "All Reasons")}</SelectItem>
              {SPECIAL_ORDER_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {translate(option.zh, option.en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">{translate("结单通知管理", "Checkout Notification Management")}</p>
          <p className="text-xs text-muted-foreground">{translate("勾选订单后点击「发送选中」批量发送结单通知到 Messenger", "Select orders and click \"Send Selected\" to batch send checkout notifications via Messenger")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">{translate("已选 {count} 张", "{count} selected", { count: selectedIds.size })}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                {translate("清空选择", "Clear")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => batchSendSelectedMutation.mutate({ orderIds: Array.from(selectedIds) })}
                disabled={batchSendSelectedMutation.isPending}
              >
                <Send className="h-4 w-4 mr-1" />
                {translate("发送选中 ({count})", "Send Selected ({count})", { count: selectedIds.size })}
              </Button>
            </>
          )}
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
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardContent className="overflow-x-auto p-0">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={(() => {
                      const selectable = orders || [];
                      return selectable.length > 0 && selectable.every((o: any) => selectedIds.has(o.id));
                    })()}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const newSet = new Set<number>();
                        (orders || []).forEach((o: any) => newSet.add(o.id));
                        setSelectedIds(newSet);
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </TableHead>
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
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
              ) : orders?.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">{translate("暂无订单", "No orders yet")}</TableCell></TableRow>
              ) : orders?.filter((o: any) => {
                if (sourceFilter === "all") return true;
                return (o as any).orderSource === sourceFilter;
              }).map((o: any) => (
                <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(o.id)}>
                  <TableCell className="w-[40px]" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(o.id)}
                      onCheckedChange={(checked) => {
                        setSelectedIds((prev) => {
                          const newSet = new Set(prev);
                          if (checked) newSet.add(o.id);
                          else newSet.delete(o.id);
                          return newSet;
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                  <TableCell>{(o as any).customerName || o.facebookName || "-"}</TableCell>
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
                    {(() => {
                      const statusMap = o.orderCategory === 'import' ? IMPORT_STATUS : PHYSICAL_STATUS;
                      const statusVal = o.orderCategory === 'import' ? o.importStatus : o.physicalStatus;
                      return (
                        <>
                          <Badge variant={statusMap[statusVal as keyof typeof statusMap]?.variant || "outline"}>
                            {translate(statusMap[statusVal as keyof typeof statusMap]?.label || statusVal, statusMap[statusVal as keyof typeof statusMap]?.enLabel || statusVal)}
                          </Badge>
                          {(o as any).isSpecialOrder && (() => {
                            const reason = getSpecialOrderReasonLabel((o as any).specialOrderType);
                            const handling = getSpecialOrderHandlingLabel((o as any).isResolved, (o as any).specialOrderStatus);
                            return (
                              <>
                                <Badge variant="destructive" className="ml-1 text-xs">
                                  {translate("特别", "Special")}
                                </Badge>
                                <Badge variant="outline" className={`ml-1 inline-flex items-center gap-1 text-xs ${reason.className}`}>
                                  <span aria-hidden="true" className="font-bold leading-none">{reason.icon}</span>
                                  {translate(reason.zh, reason.en)}
                                </Badge>
                                <Badge variant="outline" className={`ml-1 text-xs ${handling.className}`}>
                                  {translate(handling.zh, handling.en)}
                                </Badge>
                              </>
                            );
                          })()}
                        </>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {(o as any).notificationStatus === "sent" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        {translate("已发送", "Sent")}
                      </span>
                    ) : (o as any).notificationStatus === "failed" ? (
                      <span className="inline-flex max-w-[220px] items-center gap-1 text-xs text-red-600">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                        <span>{translate("发送失败", "Failed")}</span>
                        {(o as any).specialOrderType === "notification_failed" && (o as any).specialOrderReason && (
                          <span className="truncate text-[10px] text-muted-foreground" title={(o as any).specialOrderReason}>
                            — {(o as any).specialOrderReason}
                          </span>
                        )}
                        {(o as any).specialType === "notification_failed" && (o as any).checkoutLink && (o as any).messengerId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="ml-1 h-6 gap-1 px-2 text-[11px]"
                            title={translate("重新发送", "Resend")}
                            onClick={(e) => {
                              e.stopPropagation();
                              resendCheckoutMutation.mutate({ orderId: (o as any).id });
                            }}
                            disabled={resendCheckoutMutation.isPending}
                          >
                            <RotateCw className="h-3 w-3" />
                            {translate("重新发送", "Resend")}
                          </Button>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-gray-300" />
                        {translate("未发送", "Not Sent")}
                      </span>
                    )}
                    {(o as any).notificationSentAt && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date((o as any).notificationSentAt).toLocaleDateString()} {new Date((o as any).notificationSentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title={translate("查看详情", "View Details")} onClick={(e) => { e.stopPropagation(); openDetail(o.id); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {(o as any).checkoutLink && (
                        <>
                          <Button variant="ghost" size="icon" title={translate("复制结单通知", "Copy Checkout Notification")} onClick={(e) => {
                            e.stopPropagation();
                            const fullLink = `${window.location.origin}${(o as any).checkoutLink}`;
                            const msg = `您好，感恩您的支持 ❤️\n\n目前还没收到您的汇款及确认信息。\n\n请您点击以下链接查询您的订单（${(o as any).orderNumber || ""}）：\n\n${fullLink}\n\n进入订单后，除了可以查询订单，也可以继续到商城加单 ❤️\n\n西马消费满 RM150（特价商品除外），10kg 内即可享受免邮优惠。`;
                            navigator.clipboard.writeText(msg);
                            toast.success(translate("结单通知已复制", "Checkout notification copied"), {
                              description: msg.substring(0, 100) + "...",
                              duration: 5000,
                            });
                          }}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title={translate("发送到 Messenger", "Send to Messenger")} onClick={(e) => {
                            e.stopPropagation();
                            if (!(o as any).messengerId) {
                              toast.error(translate("该订单没有 Messenger ID，无法发送", "No Messenger ID for this order"));
                              return;
                            }
                            const fullLink = `${window.location.origin}${(o as any).checkoutLink}`;
                            const msg = `您好，感恩您的支持 ❤️\n\n目前还没收到您的汇款及确认信息。\n\n请您点击以下链接查询您的订单（${(o as any).orderNumber || ""}）：\n\n${fullLink}\n\n进入订单后，除了可以查询订单，也可以继续到商城加单 ❤️\n\n西马消费满 RM150（特价商品除外），10kg 内即可享受免邮优惠。`;
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
                          const fullLink = `${window.location.origin}${link}`;
                          const msg = `您好，感恩您的支持 ❤️\n\n目前还没收到您的汇款及确认信息。\n\n请您点击以下链接查询您的订单（${(orderDetail as any).orderNumber || ""}）：\n\n${fullLink}\n\n进入订单后，除了可以查询订单，也可以继续到商城加单 ❤️\n\n西马消费满 RM150（特价商品除外），10kg 内即可享受免邮优惠。`;
                          navigator.clipboard.writeText(msg);
                          toast.success(translate("结单通知已复制", "Checkout notification copied"), {
                            description: fullLink,
                            duration: 5000,
                          });
                        }
                      }}>
                        {translate("复制结单链接", "Copy Checkout Link")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const link = (orderDetail as any).checkoutLink || "";
                        if (link) window.open(`${window.location.origin}${link}`, "_blank");
                      }}>
                        {translate("打开链接", "Open Link")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const link = (orderDetail as any).checkoutLink || "";
                        const phone = (orderDetail as any).phoneNumber || "";
                        if (link && phone) {
                          const fullLink = `${window.location.origin}${link}`;
                          const msg = `您好，感恩您的支持 ❤️\n\n目前还没收到您的汇款及确认信息。\n\n请您点击以下链接查询您的订单（${(orderDetail as any).orderNumber || ""}）：\n\n${fullLink}\n\n进入订单后，除了可以查询订单，也可以继续到商城加单 ❤️\n\n西马消费满 RM150（特价商品除外），10kg 内即可享受免邮优惠。`;
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
                          const fullLink = `${window.location.origin}${link}`;
                          const msg = `您好，感恩您的支持 ❤️\n\n目前还没收到您的汇款及确认信息。\n\n请您点击以下链接查询您的订单（${(orderDetail as any).orderNumber || ""}）：\n\n${fullLink}\n\n进入订单后，除了可以查询订单，也可以继续到商城加单 ❤️\n\n西马消费满 RM150（特价商品除外），10kg 内即可享受免邮优惠。`;
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
                              const fullLink = `${window.location.origin}${link}`;
                              const msg = `您好，感恩您的支持 ❤️\n\n目前还没收到您的汇款及确认信息。\n\n请您点击以下链接查询您的订单（${(orderDetail as any).orderNumber || ""}）：\n\n${fullLink}\n\n进入订单后，除了可以查询订单，也可以继续到商城加单 ❤️\n\n西马消费满 RM150（特价商品除外），10kg 内即可享受免邮优惠。`;
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

                {/* V2.0.50: Notification History */}
                {orderDetail && <NotificationHistory orderId={orderDetail.id} />}

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
                      <TableHead>{translate("来源", "Source")}</TableHead>
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
                          <ProductImagePreview
                            src={item.productImage}
                            alt={item.productName}
                            className="h-20 w-20"
                            label={translate("预览商品图片", "Preview product image")}
                          />
                        </TableCell>
                        <TableCell className="font-medium" style={{ whiteSpace: "normal", wordBreak: "break-word", maxWidth: "300px" }}>{item.productName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ITEM_SOURCE_LABELS[item.itemSource] || item.itemSource || "-"}</TableCell>
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

                {/* V2.1.18: Overpayment processing section */}
                {(() => {
                  const overpaid = parseFloat(String(orderDetail.overpaidAmount || "0"));
                  const resolved = parseFloat(String((orderDetail as any).resolvedOverpaymentAmount || "0"));
                  const pending = Math.max(0, overpaid - resolved);
                  if (overpaid > 0.01) {
                    return (
                      <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-amber-100 text-amber-700">{translate("多汇款", "Overpayment")}</Badge>
                              <span className="text-sm font-medium">{translate("客户多付", "Customer overpaid")}: RM {overpaid.toFixed(2)}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {translate("已处理", "Processed")}: RM {resolved.toFixed(2)} | {translate("待处理", "Pending")}: <span className={pending > 0.01 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>RM {pending.toFixed(2)}</span>
                            </div>
                          </div>
                          {pending > 0.01 && orderDetail.physicalStatus !== "cancelled" && (
                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => {
                              setOverpaymentForm({ amount: pending.toFixed(2), method: "credit", notes: "" });
                              setOverpaymentDialogOpen(true);
                            }}>
                              {translate("处理多汇款", "Process Overpayment")}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* V2.1.19: Special status panel */}
                <SpecialStatusPanel orderId={orderDetail.id} orderStatus={orderDetail.physicalStatus || ""} />

                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{translate("付款记录", "Payment Records")}</h3>
                  <div className="flex gap-2">
                    {orderDetail.physicalStatus !== "cancelled" && orderDetail.physicalStatus !== "completed" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setPaymentDialogOpen(true)}>
                          <DollarSign className="h-4 w-4 mr-1" />{translate("添加付款", "Add Payment")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setRefundForm({ amount: "", refundMethod: "bank_transfer", receiptUrl: "", notes: "" });
                          setRefundDialogOpen(true);
                        }}>
                          <RotateCcw className="h-4 w-4 mr-1" />{translate("退款", "Refund")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {orderDetail.payments?.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{translate("日期", "Date")}</TableHead>
                        <TableHead>{translate("金额", "Amount")}</TableHead>
                        <TableHead>{translate("付款方式", "Method")}</TableHead>
                        <TableHead>{translate("审核状态", "Status")}</TableHead>
                        <TableHead>{translate("备注", "Notes")}</TableHead>
                        <TableHead>{translate("操作人", "Recorded By")}</TableHead>
                        <TableHead>{translate("操作", "Action")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderDetail.payments.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{new Date(p.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="font-semibold text-green-600">RM {p.amount}</TableCell>
                          <TableCell>{p.paymentMethodName || p.paymentMethod || "-"}</TableCell>
                          <TableCell>
                            {p.reviewStatus === 'approved' && (
                              <Badge className="bg-green-100 text-green-700">{translate("已确认", "Approved")}</Badge>
                            )}
                            {p.reviewStatus === 'pending' && (
                              <Badge className="bg-orange-100 text-orange-700">{translate("待审核", "Pending")}</Badge>
                            )}
                            {p.reviewStatus === 'rejected' && (
                              <Badge className="bg-red-100 text-red-700">{translate("审核失败", "Rejected")}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.notes || "-"}
                            {p.rejectReason && (
                              <div className="text-red-500 text-xs mt-1">{p.rejectReason}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {p.operatorName || (p.paymentSource === 'customer_upload' ? translate("客户", "Customer") : "-")}
                            {p.reviewedBy && (
                              <div className="text-xs text-muted-foreground">{translate("审核人", "Reviewer")}: {p.reviewedBy}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {p.reviewStatus === 'pending' && (
                              <div className="flex gap-1">
                                {p.receiptUrl && (
                                  <a href={p.receiptUrl} target="_blank" rel="noreferrer">
                                    <Button size="sm" variant="outline" className="h-7 px-2">
                                      <Eye className="h-3 w-3 mr-1" />{translate("查看", "View")}
                                    </Button>
                                  </a>
                                )}
                                <Button
                                  size="sm"
                                  className="h-7 px-2 bg-green-600 hover:bg-green-700"
                                  disabled={reviewPaymentMutation.isPending}
                                  onClick={() => {
                                    reviewPaymentMutation.mutate({ paymentId: p.id, action: 'approve' });
                                  }}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />{translate("通过", "Approve")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2"
                                  disabled={reviewPaymentMutation.isPending}
                                  onClick={() => {
                                    setRejectPaymentId(p.id);
                                    setRejectReason("");
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  <X className="h-3 w-3 mr-1" />{translate("失败", "Reject")}
                                </Button>
                              </div>
                            )}
                            {p.reviewStatus === 'approved' && (
                              <div className="flex gap-1">
                                {p.receiptUrl && (
                                  <a href={p.receiptUrl} target="_blank" rel="noreferrer">
                                    <Button size="sm" variant="ghost" className="h-7 px-2">
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  </a>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => {
                                    setEditPaymentId(p.id);
                                    setEditPaymentForm({
                                      amount: String(p.amount),
                                      paymentMethod: p.paymentMethod || "",
                                      receiptUrl: p.receiptUrl || "",
                                      notes: p.notes || "",
                                    });
                                    setEditPaymentDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
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
                    <ProductImagePreview
                      src={orderDetail.receiptUrl}
                      alt={translate("付款凭证", "Payment Receipt")}
                      className="h-32 w-48 rounded-lg"
                      label={translate("预览并缩放付款凭证", "Preview and zoom payment receipt")}
                    />
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
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">{translate("换盆组（可新增多组）", "Repotting Groups (Add multiple)")}</Label>
                        {repotGroups.map((group, gIdx) => (
                          <div key={gIdx} className="space-y-2 p-3 border rounded-lg bg-green-50/30 dark:bg-green-950/10">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-green-700">{translate(`换盆 ${gIdx + 1}`, `Repot ${gIdx + 1}`)}</span>
                              {repotGroups.length > 1 && (
                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setRepotGroups(repotGroups.filter((_, i) => i !== gIdx))}>
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs">{translate("选择植物（从本订单商品）", "Select Plants (from order items)")}</Label>
                              <div className="space-y-1 mt-1">
                                {orderDetail.items?.map((item: any) => (
                                  <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                                    <input
                                      type="checkbox"
                                      checked={group.selectedPlantIds.includes(item.id)}
                                      onChange={(e) => {
                                        const newGroups = [...repotGroups];
                                        if (e.target.checked) {
                                          newGroups[gIdx].selectedPlantIds = [...group.selectedPlantIds, item.id];
                                        } else {
                                          newGroups[gIdx].selectedPlantIds = group.selectedPlantIds.filter((id: number) => id !== item.id);
                                        }
                                        setRepotGroups(newGroups);
                                      }}
                                      className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <span className="flex-1 truncate">{item.productName}{item.variationName ? ` (${item.variationName})` : ""}</span>
                                    <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">{translate("花盆", "Pot")}</Label>
                              <Input
                                placeholder={translate("例如：White Pot 8\"", "e.g. White Pot 8\"")}
                                value={group.potName}
                                onChange={(e) => {
                                  const newGroups = [...repotGroups];
                                  newGroups[gIdx].potName = e.target.value;
                                  setRepotGroups(newGroups);
                                }}
                                className="text-sm"
                              />
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => setRepotGroups([...repotGroups, { selectedPlantIds: [], potName: "" }])}>
                          <Plus className="h-4 w-4 mr-1" />{translate("新增换盆", "Add Repot Group")}
                        </Button>
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
                      disabled={!remarkForm.remarkCategory || 
                        (remarkForm.remarkCategory === "desired_delivery_date" && !remarkForm.desiredDeliveryDate) ||
                        (remarkForm.remarkCategory === "repotting" && repotGroups.every(g => g.selectedPlantIds.length === 0 || !g.potName.trim())) ||
                        (remarkForm.remarkCategory === "other" && !remarkForm.content.trim())
                      }
                      onClick={() => {
                        // V2.0.53: Generate repotting content and data from repotGroups
                        let submitContent = remarkForm.content;
                        let submitRepottingData: string | undefined;
                        if (remarkForm.remarkCategory === "repotting") {
                          const groups = repotGroups.filter(g => g.selectedPlantIds.length > 0 && g.potName.trim());
                          const itemMap = new Map((orderDetail.items || []).map((it: any) => [it.id, it]));
                          const lines = groups.map((g, i) => {
                            const plants = g.selectedPlantIds.map(id => {
                              const it = itemMap.get(id);
                              return it ? `${it.productName}${it.variationName ? ` (${it.variationName})` : ""}` : `Item#${id}`;
                            }).join(" + ");
                            return `换盆${i + 1}: ${plants} → ${g.potName.trim()}`;
                          });
                          submitContent = lines.join("\n");
                          submitRepottingData = JSON.stringify(groups.map(g => ({
                            plantItemIds: g.selectedPlantIds,
                            plantNames: g.selectedPlantIds.map(id => {
                              const it = itemMap.get(id);
                              return it ? it.productName : "";
                            }),
                            potName: g.potName.trim(),
                          })));
                        } else if (remarkForm.remarkCategory === "desired_delivery_date") {
                          submitContent = `希望收货日期: ${remarkForm.desiredDeliveryDate}${remarkForm.desiredDeliveryReason ? " — " + remarkForm.desiredDeliveryReason : ""}`;
                        }
                        if (editingRemarkId) {
                          updateRemarkMutation.mutate({
                            id: editingRemarkId,
                            content: submitContent || "",
                            remarkCategory: remarkForm.remarkCategory as any,
                            desiredDeliveryDate: remarkForm.desiredDeliveryDate || undefined,
                            desiredDeliveryReason: remarkForm.desiredDeliveryReason || undefined,
                            repottingData: submitRepottingData,
                          });
                        } else {
                          createRemarkMutation.mutate({
                            orderId: orderDetail.id,
                            type: "customer",
                            content: submitContent || "",
                            remarkCategory: remarkForm.remarkCategory as any,
                            desiredDeliveryDate: remarkForm.desiredDeliveryDate || undefined,
                            desiredDeliveryReason: remarkForm.desiredDeliveryReason || undefined,
                            repottingData: submitRepottingData,
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
                  {CANCEL_REASONS.map(reason => (
                    <SelectItem key={reason.zh} value={reason.zh}>{translate(reason.zh, reason.en)}</SelectItem>
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
                placeholder={translate("如：QR Pay (Tng/Duit Now)/银行转账/现金", "e.g. QR Pay (Tng/Duit Now)/Bank Transfer/Cash")} />
            </div>
            <div>
              <Label>{translate("付款凭证", "Receipt")}</Label>
              <input
                ref={receiptFileRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadReceipt(file);
                  e.target.value = "";
                }}
              />
              {paymentForm.receiptUrl ? (
                <div className="flex items-center gap-2">
                  <a href={paymentForm.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">{translate("查看单据", "View Receipt")}</a>
                  <Button variant="ghost" size="sm" onClick={() => setPaymentForm({ ...paymentForm, receiptUrl: "" })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => receiptFileRef.current?.click()} disabled={uploadingReceipt}>
                  {uploadingReceipt ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  {uploadingReceipt ? translate("上传中...", "Uploading...") : translate("上传付款单据", "Upload Receipt")}
                </Button>
              )}
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

      {/* V2.1.15: Edit Payment Dialog */}
      <Dialog open={editPaymentDialogOpen} onOpenChange={setEditPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("编辑付款记录", "Edit Payment Record")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("付款金额 (RM)", "Payment Amount (RM)")}</Label>
              <Input type="number" step="0.01" value={editPaymentForm.amount}
                onChange={(e) => setEditPaymentForm({ ...editPaymentForm, amount: e.target.value })}
                placeholder="0.00" />
            </div>
            <div>
              <Label>{translate("付款方式", "Payment Method")}</Label>
              <Input value={editPaymentForm.paymentMethod}
                onChange={(e) => setEditPaymentForm({ ...editPaymentForm, paymentMethod: e.target.value })} />
            </div>
            <div>
              <Label>{translate("备注", "Notes")}</Label>
              <Textarea value={editPaymentForm.notes}
                onChange={(e) => setEditPaymentForm({ ...editPaymentForm, notes: e.target.value })}
                rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPaymentDialogOpen(false)}>{translate("返回", "Back")}</Button>
            <Button onClick={() => {
              if (!editPaymentId) return;
              editPaymentMutation.mutate({
                paymentId: editPaymentId,
                amount: editPaymentForm.amount,
                paymentMethod: editPaymentForm.paymentMethod,
                notes: editPaymentForm.notes,
              });
            }} disabled={editPaymentMutation.isPending}>
              {translate("保存", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* V2.1.15: Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("记录退款", "Record Refund")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("退款金额 (RM)", "Refund Amount (RM)")}</Label>
              <Input type="number" step="0.01" value={refundForm.amount}
                onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                placeholder="0.00" />
            </div>
            <div>
              <Label>{translate("退款方式", "Refund Method")}</Label>
              <Select value={refundForm.refundMethod} onValueChange={(v) => setRefundForm({ ...refundForm, refundMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">{translate("银行转账", "Bank Transfer")}</SelectItem>
                  <SelectItem value="duitnow">{translate("DuitNow", "DuitNow")}</SelectItem>
                  <SelectItem value="cash">{translate("现金", "Cash")}</SelectItem>
                  <SelectItem value="credit">{translate("Credit", "Credit")}</SelectItem>
                  <SelectItem value="other">{translate("其他", "Other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{translate("备注", "Notes")}</Label>
              <Textarea value={refundForm.notes}
                onChange={(e) => setRefundForm({ ...refundForm, notes: e.target.value })}
                rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>{translate("返回", "Back")}</Button>
            <Button onClick={() => {
              if (!refundForm.amount || parseFloat(refundForm.amount) <= 0) {
                toast.error(translate("请输入有效退款金额", "Please enter a valid refund amount"));
                return;
              }
              addRefundMutation.mutate({
                orderId: detailOrderId!,
                amount: refundForm.amount,
                refundMethod: refundForm.refundMethod,
                notes: refundForm.notes,
              });
            }} disabled={addRefundMutation.isPending}>
              {translate("确认退款", "Confirm Refund")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* V2.1.18: Overpayment processing dialog */}
      <Dialog open={overpaymentDialogOpen} onOpenChange={setOverpaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("处理多汇款", "Process Overpayment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-sm">
              {translate("客户多付", "Customer overpaid")}: <span className="font-bold">RM {(() => {
                const overpaid = parseFloat(String(orderDetail?.overpaidAmount || "0"));
                const resolved = parseFloat(String((orderDetail as any)?.resolvedOverpaymentAmount || "0"));
                return Math.max(0, overpaid - resolved).toFixed(2);
              })()}</span>
            </div>
            <div>
              <Label>{translate("处理金额", "Process Amount")}</Label>
              <Input
                type="number"
                value={overpaymentForm.amount}
                onChange={(e) => setOverpaymentForm({ ...overpaymentForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>{translate("处理方式", "Method")}</Label>
              <Select value={overpaymentForm.method} onValueChange={(v) => setOverpaymentForm({ ...overpaymentForm, method: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">{translate("转入客户 Credit", "Transfer to Customer Credit")}</SelectItem>
                  <SelectItem value="tng">{translate("TNG 退款", "TNG Refund")}</SelectItem>
                  <SelectItem value="cash">{translate("Cash 退款", "Cash Refund")}</SelectItem>
                  <SelectItem value="bank_transfer">{translate("银行转账退款", "Bank Transfer Refund")}</SelectItem>
                  <SelectItem value="other">{translate("其他", "Other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{translate("备注", "Notes")}</Label>
              <Textarea
                value={overpaymentForm.notes}
                onChange={(e) => setOverpaymentForm({ ...overpaymentForm, notes: e.target.value })}
                placeholder={translate("可选备注", "Optional notes")}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverpaymentDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button
              disabled={processOverpaymentMutation.isPending}
              onClick={() => {
                if (!overpaymentForm.amount || parseFloat(overpaymentForm.amount) <= 0) {
                  toast.error(translate("请输入有效金额", "Please enter a valid amount"));
                  return;
                }
                processOverpaymentMutation.mutate({
                  orderId: orderDetail!.id,
                  amount: overpaymentForm.amount,
                  method: overpaymentForm.method,
                  notes: overpaymentForm.notes,
                });
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {processOverpaymentMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />{translate("处理中...", "Processing...")}</>
              ) : (
                translate("确认处理", "Confirm")
              )}
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
                        // V2.0.86/V2.1.07: Auto-populate recipient from customer profile (including address)
                        setRecipientForm({
                          recipientName: c.name || c.displayName || "",
                          recipientPhone: c.phoneNumber || "",
                          recipientAddress: c.address || "",
                          recipientCity: c.city || "",
                          recipientState: c.state || "",
                          recipientPostcode: c.postalCode || "",
                          recipientCountry: c.country || "",
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
                  <button onClick={() => { setSelectedCustomerId(undefined); setCustomerForm({ facebookName: "", facebookId: "", messengerId: "", name: "", phoneNumber: "", address: "", shippingMethod: "west_malaysia" }); setRecipientForm({ recipientName: "", recipientPhone: "", recipientAddress: "", recipientCity: "", recipientState: "", recipientPostcode: "", recipientCountry: "" }); }} className="ml-2">×</button>
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
              {/* V2.0.86: Recipient info section */}
              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="buyer-recipient-orders"
                    checked={buyerIsRecipient}
                    onCheckedChange={(v) => setBuyerIsRecipient(v === true)}
                  />
                  <Label htmlFor="buyer-recipient-orders" className="text-sm cursor-pointer">{translate("买家是收件人", "Buyer is Recipient")}</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{translate("收件人姓名", "Recipient Name")}</Label>
                    <Input
                      value={recipientForm.recipientName}
                      onChange={(e) => { setRecipientForm({ ...recipientForm, recipientName: e.target.value }); if (buyerIsRecipient) setBuyerIsRecipient(false); }}
                      placeholder={translate("收件人姓名", "Recipient Name")}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{translate("收件人电话", "Recipient Phone")}</Label>
                    <Input
                      value={recipientForm.recipientPhone}
                      onChange={(e) => { setRecipientForm({ ...recipientForm, recipientPhone: e.target.value }); if (buyerIsRecipient) setBuyerIsRecipient(false); }}
                      placeholder="012-3456789"
                    />
                  </div>
                </div>
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

// V2.1.19: Special Status Panel Component
function SpecialStatusPanel({ orderId, orderStatus }: { orderId: number; orderStatus: string }) {
  const { data: specialStatuses } = trpc.orders.getSpecialStatuses.useQuery({ orderId });
  const { translate } = useI18n();
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveForm, setResolveForm] = useState({ specialStatusId: 0, resolutionMethod: "credit" as 'credit' | 'tng' | 'cash' | 'bank_transfer' | 'other' | 'data_corrected' | 'company_bear' | 'false_positive', resolutionRemark: "" });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ type: "other" as string, reason: "", amount: "" });
  const utils = trpc.useUtils();

  const createMutation = trpc.orders.createSpecialStatus.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      toast.success(translate("特别状态已新增", "Special status added"));
      setAddDialogOpen(false);
      setAddForm({ type: "other", reason: "", amount: "" });
    },
    onError: (e: any) => toast.error(translate("新增失败: {message}", "Failed: {message}", { message: e.message })),
  });

  const resolveMutation = trpc.orders.resolveSpecialStatus.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      toast.success(translate("特别状态已处理", "Special status resolved"));
      setResolveDialogOpen(false);
      setResolveForm({ specialStatusId: 0, resolutionMethod: "credit", resolutionRemark: "" });
    },
    onError: (e: any) => toast.error(translate("处理失败: {message}", "Failed: {message}", { message: e.message })),
  });

  const SPECIAL_TYPE_LABELS: Record<string, { cn: string; en: string; color: string }> = {
    over_payment: { cn: "多汇款", en: "Overpayment", color: "bg-amber-100 text-amber-700" },
    pending_shipping: { cn: "待补运费", en: "Pending Shipping Fee", color: "bg-blue-100 text-blue-700" },
    pending_refund: { cn: "待退款", en: "Pending Refund", color: "bg-red-100 text-red-700" },
    company_bear: { cn: "公司承担", en: "Company Bear", color: "bg-purple-100 text-purple-700" },
    logistics_error: { cn: "物流异常", en: "Logistics Error", color: "bg-orange-100 text-orange-700" },
    incomplete_info: { cn: "资料不完整", en: "Incomplete Info", color: "bg-yellow-100 text-yellow-700" },
    notification_failed: { cn: "通知失败", en: "Notification Failed", color: "bg-pink-100 text-pink-700" },
    stock_exception: { cn: "库存异常", en: "Stock Exception", color: "bg-indigo-100 text-indigo-700" },
    overdue: { cn: "超时未处理", en: "Overdue", color: "bg-red-100 text-red-700" },
    amount_changed: { cn: "金额修改", en: "Amount Changed", color: "bg-cyan-100 text-cyan-700" },
    amount_anomaly: { cn: "金额异常", en: "Amount Anomaly", color: "bg-rose-100 text-rose-700" },
    other: { cn: "其他", en: "Other", color: "bg-gray-100 text-gray-700" },
  };

  const RESOLUTION_METHOD_LABELS: Record<string, { cn: string; en: string }> = {
    credit: { cn: "转入 Credit", en: "To Credit" },
    tng: { cn: "TNG 退款", en: "TNG Refund" },
    cash: { cn: "Cash 退款", en: "Cash Refund" },
    bank_transfer: { cn: "银行转账退款", en: "Bank Transfer Refund" },
    other: { cn: "其他", en: "Other" },
    data_corrected: { cn: "资料已修正", en: "Data Corrected" },
    company_bear: { cn: "公司承担", en: "Company Bear" },
    false_positive: { cn: "误报", en: "False Positive" },
  };

  const pendingStatuses = (specialStatuses || []).filter((s: any) => s.status === 'pending');
  const resolvedStatuses = (specialStatuses || []).filter((s: any) => s.status === 'resolved');

  if (orderStatus === 'cancelled') return null;

  return (
    <div className="space-y-2">
      {/* Pending special statuses */}
      {pendingStatuses.length > 0 && (
        <div className="p-3 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">{translate("待处理特别状态", "Pending Special Statuses")} ({pendingStatuses.length})</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />{translate("新增", "Add")}
            </Button>
          </div>
          <div className="space-y-2">
            {pendingStatuses.map((s: any) => {
              const label = SPECIAL_TYPE_LABELS[s.type] || SPECIAL_TYPE_LABELS.other;
              return (
                <div key={s.id} className="flex items-center justify-between p-2 rounded bg-background/50">
                  <div className="flex items-center gap-2">
                    <Badge className={label.color}>{translate(label.cn, label.en)}</Badge>
                    {s.amount && parseFloat(s.amount) > 0 && (
                      <span className="text-sm font-medium">RM {parseFloat(s.amount).toFixed(2)}</span>
                    )}
                    {s.reason && (
                      <span className="text-sm text-muted-foreground truncate max-w-xs">{s.reason}</span>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    setResolveForm({ specialStatusId: s.id, resolutionMethod: s.type === 'over_payment' ? 'credit' : 'data_corrected', resolutionRemark: "" });
                    setResolveDialogOpen(true);
                  }}>
                    {translate("处理", "Resolve")}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resolved special statuses (history) */}
      {resolvedStatuses.length > 0 && (
        <details className="p-3 border rounded-lg bg-muted/30">
          <summary className="text-sm font-medium cursor-pointer flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            {translate("已处理特别状态", "Resolved Special Statuses")} ({resolvedStatuses.length})
          </summary>
          <div className="mt-2 space-y-2">
            {resolvedStatuses.map((s: any) => {
              const label = SPECIAL_TYPE_LABELS[s.type] || SPECIAL_TYPE_LABELS.other;
              const resolution = RESOLUTION_METHOD_LABELS[s.resolutionMethod] || { cn: s.resolutionMethod, en: s.resolutionMethod };
              return (
                <div key={s.id} className="flex items-center justify-between p-2 rounded bg-background/50">
                  <div className="flex items-center gap-2">
                    <Badge className={label.color}>{translate(label.cn, label.en)}</Badge>
                    {s.amount && parseFloat(s.amount) > 0 && (
                      <span className="text-sm">RM {parseFloat(s.amount).toFixed(2)}</span>
                    )}
                    <Badge variant="outline" className="text-xs">{translate(resolution.cn, resolution.en)}</Badge>
                    {s.resolutionRemark && (
                      <span className="text-sm text-muted-foreground truncate max-w-xs">{s.resolutionRemark}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {s.resolvedAt ? new Date(s.resolvedAt).toLocaleDateString() : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* Add special status dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("新增特别状态", "Add Special Status")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{translate("类型", "Type")}</Label>
              <Select value={addForm.type} onValueChange={(v) => setAddForm({ ...addForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SPECIAL_TYPE_LABELS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{translate(val.cn, val.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{translate("金额 (可选)", "Amount (optional)")}</Label>
              <Input type="number" step="0.01" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })} />
            </div>
            <div>
              <Label>{translate("原因", "Reason")}</Label>
              <Textarea value={addForm.reason} onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={() => createMutation.mutate({ orderId, type: addForm.type as any, reason: addForm.reason || undefined, amount: addForm.amount || undefined })} disabled={createMutation.isPending}>
              {translate("确认", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve special status dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("处理特别状态", "Resolve Special Status")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{translate("处理方式", "Resolution Method")}</Label>
              <Select value={resolveForm.resolutionMethod} onValueChange={(v) => setResolveForm({ ...resolveForm, resolutionMethod: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RESOLUTION_METHOD_LABELS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{translate(val.cn, val.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{translate("备注", "Remark")}</Label>
              <Textarea value={resolveForm.resolutionRemark} onChange={(e) => setResolveForm({ ...resolveForm, resolutionRemark: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={() => resolveMutation.mutate(resolveForm)} disabled={resolveMutation.isPending}>
              {translate("确认", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// V2.0.50: Notification History Component
function NotificationHistory({ orderId }: { orderId: number }) {
  const { data: logs, isLoading } = trpc.notifications.list.useQuery({ orderId });
  const { translate } = useI18n();

  if (isLoading) return null;
  if (!logs || logs.length === 0) return null;

  return (
    <div className="mt-3 p-3 rounded-lg border bg-muted/30">
      <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
        <Bell className="h-3.5 w-3.5" />
        {translate("通知发送历史", "Notification History")}
        <Badge variant="secondary" className="ml-1">{logs.length}</Badge>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {logs.map((log: any) => (
          <div key={log.id} className="flex items-start gap-2 text-xs p-2 rounded bg-background/50">
            <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${log.status === "sent" ? "bg-green-500" : "bg-red-500"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{log.status === "sent" ? translate("发送成功", "Sent") : translate("发送失败", "Failed")}</span>
                <span className="text-muted-foreground">
                  {log.sentAt ? new Date(log.sentAt).toLocaleString() : new Date(log.createdAt).toLocaleString()}
                </span>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">{log.channel}</Badge>
              </div>
              {log.errorMessage && (
                <div className="text-destructive mt-0.5 truncate">{log.errorMessage}</div>
              )}
              {log.message && (
                <div className="text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap">{log.message}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
