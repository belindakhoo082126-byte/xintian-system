import { useState, useMemo, useEffect, useRef } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, Save, FileText, User, Truck, DollarSign, Package, X,
  CreditCard, Plus, Upload, Loader2, Trash2, MessageSquare, Sprout,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ORDER_NATURE = {
  retail: { label: "零售", enLabel: "Retail" },
  wholesale: { label: "批发", enLabel: "Wholesale" },
  agent: { label: "代理", enLabel: "Agent" },
} as const;

const SHIPPING_METHODS = {
  west_malaysia: { label: "西马", enLabel: "West Malaysia" },
  east_malaysia_poslaju: { label: "东马 Pos Laju", enLabel: "East Malaysia Pos Laju" },
  east_malaysia_shopee: { label: "东马 Shopee", enLabel: "East Malaysia Shopee" },
  lalamove: { label: "Lalamove", enLabel: "Lalamove" },
  self_pickup: { label: "自取", enLabel: "Self Pickup" },
} as const;

const ORDER_SOURCES = {
  facebook_live: { label: "FB直播", enLabel: "FB Live" },
  facebook_post: { label: "FB贴文", enLabel: "FB Post" },
  facebook_reel: { label: "FB Reel", enLabel: "FB Reel" },
  messenger: { label: "Messenger", enLabel: "Messenger" },
  store: { label: "商城", enLabel: "Store" },
  manual: { label: "Admin手动", enLabel: "Admin Manual" },
} as const;

export default function OrderEditPage({ orderId, onBack }: { orderId: number; onBack: () => void }) {
  const { translate, lang } = useI18n();
  const [_, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: order, isLoading } = trpc.orders.getDetail.useQuery({ id: orderId });
  const { data: remarks } = trpc.orderRemarks.list.useQuery({ orderId });
  const { data: paymentMethods } = trpc.paymentMethods.list.useQuery();

  // Editable form state
  const [formData, setFormData] = useState<any>({
    orderNature: "retail",
    orderSource: "manual",
    orderCategory: "local",
    physicalStatus: "pending",
    shippingMethod: "west_malaysia",
    shippingAddress: "",
    recipientName: "",
    recipientPhone: "",
    discountAmount: "0",
    discountReason: "",
    extraCharge: "0",
    extraChargeDescription: "",
    creditUsed: "0",
    shippingFee: "0",
  });

  // Editable items state
  const [editItems, setEditItems] = useState<any[]>([]);
  const [itemsModified, setItemsModified] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Payment records state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentMethodName: "", receiptUrl: "", notes: "" });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptFileRef = useRef<HTMLInputElement>(null);

  // Remark state
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
  const [remarkForm, setRemarkForm] = useState({
    type: "internal" as "live" | "customer" | "internal",
    content: "",
    remarkCategory: "" as "" | "repotting" | "desired_delivery_date" | "select_tree" | "other",
    desiredDeliveryDate: "",
    repottingEntries: [] as Array<{ plantName: string; potName: string; quantity: number }>,
  });

  // Load order data into form when available
  useEffect(() => {
    if (order) {
      const o = order as any;
      setFormData({
        orderNature: o.orderNature || "retail",
        orderSource: o.orderSource || "manual",
        orderCategory: o.orderCategory || "local",
        physicalStatus: o.physicalStatus || "pending",
        shippingMethod: o.shippingMethod || "west_malaysia",
        shippingAddress: o.shippingAddress || "",
        recipientName: o.recipientName || "",
        recipientPhone: o.recipientPhone || "",
        discountAmount: o.discountAmount || "0",
        discountReason: o.discountReason || "",
        extraCharge: o.extraCharge || "0",
        extraChargeDescription: o.extraChargeDescription || "",
        creditUsed: o.creditUsed || "0",
        shippingFee: o.shippingFee || "0",
      });
      // Load items into editable state
      setEditItems((o.items || []).map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        variationId: item.variationId || null,
        variationName: item.variationName || null,
        itemSource: item.itemSource || "admin",
        priceType: item.priceType || "normal",
      })));
      setItemsModified(false);
    }
  }, [order]);

  const updateDetailsMutation = trpc.orders.updateDetails.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      toast.success(translate("订单更新成功", "Order updated successfully"));
      setLocation(`/orders/browse/${orderId}`);
    },
    onError: (e) => toast.error(translate("更新失败: {message}", "Update failed: {message}", { message: e.message })),
  });

  const updateItemsMutation = trpc.orders.updateItems.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      toast.success(translate("商品更新成功", "Items updated successfully"));
    },
    onError: (e) => toast.error(translate("商品更新失败: {message}", "Items update failed: {message}", { message: e.message })),
  });

  const { data: searchResults } = trpc.orders.searchProductsForOrder.useQuery(
    { query: productSearch },
    { enabled: productSearch.length > 0 }
  );

  const addPaymentMutation = trpc.orders.addPayment.useMutation({
    onSuccess: () => {
      utils.orders.getDetail.invalidate({ id: orderId });
      toast.success(translate("付款记录已添加", "Payment record added"));
      setPaymentDialogOpen(false);
      setPaymentForm({ amount: "", paymentMethodName: "", receiptUrl: "", notes: "" });
    },
    onError: (e: any) => toast.error(translate("添加付款失败: {message}", "Payment failed: {message}", { message: e.message })),
  });

  const createRemarkMutation = trpc.orderRemarks.create.useMutation({
    onSuccess: () => {
      utils.orderRemarks.list.invalidate({ orderId });
      toast.success(translate("备注已添加", "Remark added"));
      setRemarkDialogOpen(false);
      setRemarkForm({
        type: "internal",
        content: "",
        remarkCategory: "",
        desiredDeliveryDate: "",
        repottingEntries: [],
      });
    },
    onError: (e: any) => toast.error(translate("添加备注失败: {message}", "Remark failed: {message}", { message: e.message })),
  });

  const deleteRemarkMutation = trpc.orderRemarks.delete.useMutation({
    onSuccess: () => {
      utils.orderRemarks.list.invalidate({ orderId });
      toast.success(translate("备注已删除", "Remark deleted"));
    },
    onError: (e: any) => toast.error(translate("删除失败: {message}", "Delete failed: {message}", { message: e.message })),
  });

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
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error(translate("请输入有效金额", "Please enter a valid amount"));
      return;
    }
    addPaymentMutation.mutate({
      orderId,
      amount: paymentForm.amount,
      paymentMethod: paymentForm.paymentMethodName || undefined,
      receiptUrl: paymentForm.receiptUrl || undefined,
      notes: paymentForm.notes || undefined,
    });
  }

  function handleAddRemark() {
    // For desired_delivery_date: date is required, content is optional
    if (remarkForm.remarkCategory === "desired_delivery_date" && !remarkForm.desiredDeliveryDate) {
      toast.error(translate("请选择发货日期", "Please select a shipping date"));
      return;
    }
    // For select_tree and other: content is required
    if ((remarkForm.remarkCategory === "" || remarkForm.remarkCategory === "other" || remarkForm.remarkCategory === "select_tree") && !remarkForm.content) {
      toast.error(translate("请输入备注内容", "Please enter remark content"));
      return;
    }
    // Build content: for desired_delivery_date with empty note, use date as content fallback
    let contentToSend = remarkForm.content;
    if (remarkForm.remarkCategory === "desired_delivery_date" && !contentToSend) {
      contentToSend = remarkForm.desiredDeliveryDate; // use date as content so DB notNull is satisfied
    } else if (remarkForm.remarkCategory === "repotting" && !contentToSend) {
      contentToSend = "换盆备注";
    }
    createRemarkMutation.mutate({
      orderId,
      type: remarkForm.type,
      content: contentToSend,
      remarkCategory: remarkForm.remarkCategory || "other",
      desiredDeliveryDate: remarkForm.remarkCategory === "desired_delivery_date" ? remarkForm.desiredDeliveryDate : undefined,
      repottingData: remarkForm.remarkCategory === "repotting" && remarkForm.repottingEntries.length > 0
        ? JSON.stringify(remarkForm.repottingEntries)
        : undefined,
    });
  }

  // Calculate total from editItems (live) or order (fallback)
  const itemsSubtotal = useMemo(() => {
    if (itemsModified && editItems.length > 0) {
      return editItems.reduce((sum, item) => sum + (parseFloat(item.unitPrice) || 0) * (item.quantity || 0), 0);
    }
    if (!order) return 0;
    const o = order as any;
    return parseFloat(o.physicalSubtotal || "0") + parseFloat(o.membershipSubtotal || "0");
  }, [order, editItems, itemsModified]);

  // Item management functions
  function updateEditItem(idx: number, field: string, value: any) {
    setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    setItemsModified(true);
  }

  function removeEditItem(idx: number) {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
    setItemsModified(true);
  }

  function addProductToItems(product: any) {
    setEditItems(prev => [...prev, {
      id: undefined,
      productId: product.id,
      productName: product.name,
      productSku: product.sku || null,
      quantity: 1,
      unitPrice: product.sellingPrice || product.price || "0",
      variationId: null,
      variationName: null,
      itemSource: "admin",
      priceType: "normal",
    }]);
    setItemsModified(true);
    setProductSearch("");
    setShowSearchResults(false);
  }

  const discountNum = parseFloat(formData.discountAmount) || 0;
  const extraChargeNum = parseFloat(formData.extraCharge) || 0;
  const creditUsedNum = parseFloat(formData.creditUsed) || 0;
  const shippingFeeNum = parseFloat(formData.shippingFee) || 0;
  const totalAmount = itemsSubtotal - discountNum + extraChargeNum + shippingFeeNum - creditUsedNum;

  // Payment method filtering based on shipping method
  const isSelfPickup = formData.shippingMethod === "self_pickup";
  const filteredPaymentMethods = useMemo(() => {
    if (!paymentMethods) return [];
    return paymentMethods.filter((method: any) => {
      if (!method.isEnabled) return false;
      if (method.type === "cash" && !isSelfPickup) return false;
      return true;
    });
  }, [paymentMethods, isSelfPickup]);

  // Plant and pot items for repotting
  const orderPlants = useMemo(() => {
    if (!order) return [];
    const o = order as any;
    return (o.items || []).filter((item: any) => !item.isPot && item.productType === "physical");
  }, [order]);

  const orderPots = useMemo(() => {
    if (!order) return [];
    const o = order as any;
    return (o.items || []).filter((item: any) => item.isPot && item.productType === "physical");
  }, [order]);

  async function handleSave() {
    // First save items if modified
    if (itemsModified) {
      try {
        await updateItemsMutation.mutateAsync({
          orderId,
          items: editItems.map(item => ({
            id: item.id,
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice),
            variationId: item.variationId,
            variationName: item.variationName,
            itemSource: item.itemSource || "admin",
            priceType: item.priceType || "normal",
          })),
        });
      } catch (e) {
        return; // Error toast already shown by mutation
      }
    }
    // Then save order details
    updateDetailsMutation.mutate({
      id: orderId,
      ...formData,
      totalAmount: totalAmount.toFixed(2),
    });
  }

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold">{translate("编辑订单", "Edit Order")}</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded animate-pulse mb-3" />
                <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold">{translate("订单未找到", "Order Not Found")}</h1>
        </div>
      </div>
    );
  }

  const o = order as any;
  const orderTypeLabel = o.orderCategory === "import" ? translate("中国代购订单", "Import Order") : translate("本地订单", "Local Order");

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              {translate("编辑订单", "Edit Order")}
              <span className="font-mono text-lg text-muted-foreground">#{o.orderNumber}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{orderTypeLabel}</p>
          </div>
        </div>
        <Badge variant="outline">{translate("编辑模式", "Edit Mode")}</Badge>
      </div>

      {/* Section 1: Order Basic Info (editable) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {translate("订单基本资料", "Order Basic Info")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">{translate("订单编号", "Order Number")}</Label>
            <Input value={o.orderNumber} disabled className="bg-muted/50 font-mono" />
          </div>
          <div>
            <Label className="text-xs">{translate("订单类型", "Order Type")}</Label>
            <Select value={formData.orderCategory} onValueChange={(v) => setFormData({ ...formData, orderCategory: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">{translate("本地订单", "Local Order")}</SelectItem>
                <SelectItem value="import">{translate("中国代购订单", "Import Order")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{translate("订单性质", "Order Nature")}</Label>
            <Select value={formData.orderNature} onValueChange={(v) => setFormData({ ...formData, orderNature: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ORDER_NATURE).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{translate("订单来源", "Order Source")}</Label>
            <Select value={formData.orderSource} onValueChange={(v) => setFormData({ ...formData, orderSource: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ORDER_SOURCES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{translate("订单状态", "Order Status")}</Label>
            <Select value={formData.physicalStatus} onValueChange={(v) => setFormData({ ...formData, physicalStatus: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{translate("未汇款订单", "Unpaid")}</SelectItem>
                <SelectItem value="receipt_uploaded">{translate("待审核付款凭证", "Receipt Uploaded")}</SelectItem>
                <SelectItem value="partial_payment">{translate("部分汇款", "Partial Payment")}</SelectItem>
                <SelectItem value="hold">{translate("保留订单", "Hold")}</SelectItem>
                <SelectItem value="packing">{translate("待包货", "Packing")}</SelectItem>
                <SelectItem value="partial_shipped">{translate("部分发货", "Partial Shipped")}</SelectItem>
                <SelectItem value="shipped">{translate("已发货", "Shipped")}</SelectItem>
                <SelectItem value="completed">{translate("已完成", "Completed")}</SelectItem>
                <SelectItem value="cancelled">{translate("已取消", "Cancelled")}</SelectItem>
                <SelectItem value="special">{translate("特别订单", "Special")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Customer Info (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            {translate("客户资料", "Customer Info")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground">{translate("客户姓名", "Customer Name")}:</span> {o.facebookName || o.customerName || "-"}</div>
          <div><span className="text-muted-foreground">{translate("电话号码", "Phone")}:</span> {o.customerPhone || "-"}</div>
          <div><span className="text-muted-foreground">{translate("Facebook 名称", "FB Name")}:</span> {o.facebookName || "-"}</div>
          <div><span className="text-muted-foreground">{translate("Facebook ID", "FB ID")}:</span> {o.facebookId || "-"}</div>
          <div><span className="text-muted-foreground">{translate("Messenger ID", "Messenger ID")}:</span> {o.messengerId || "-"}</div>
        </CardContent>
      </Card>

      {/* Section 3: Recipient & Shipping (editable) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            {translate("收件人资料与配送方式", "Recipient & Shipping")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">{translate("收件人姓名", "Recipient Name")}</Label>
              <Input value={formData.recipientName} onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("收件人电话", "Recipient Phone")}</Label>
              <Input value={formData.recipientPhone} onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("配送方式", "Shipping Method")}</Label>
              <Select value={formData.shippingMethod} onValueChange={(v) => setFormData({ ...formData, shippingMethod: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SHIPPING_METHODS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">{translate("收件地址", "Shipping Address")}</Label>
            <Textarea
              value={formData.shippingAddress}
              onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Order Items (editable) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            {translate("商品明细", "Order Items")}
            {itemsModified && <Badge variant="secondary" className="text-xs ml-2 bg-amber-100 text-amber-700">{translate("已修改", "Modified")}</Badge>}
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setShowSearchResults(!showSearchResults)}>
              <Plus className="h-3 w-3 mr-1" />{translate("新增商品", "Add Product")}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Product Search */}
          {showSearchResults && (
            <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <Input
                placeholder={translate("搜索商品名称或SKU...", "Search product name or SKU...")}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                autoFocus
              />
              {searchResults && searchResults.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {searchResults.slice(0, 10).map((p: any) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer border"
                      onClick={() => addProductToItems(p)}
                    >
                      <div className="flex items-center gap-2">
                        {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded object-cover" />}
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">RM {parseFloat(p.sellingPrice || p.price || 0).toFixed(2)}</div>
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
              {searchResults && searchResults.length === 0 && productSearch.length > 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">{translate("未找到商品", "No products found")}</p>
              )}
            </div>
          )}
          {/* Editable Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">{translate("商品名称", "Product Name")}</th>
                  <th className="text-left p-2 font-medium">{translate("规格", "Variation")}</th>
                  <th className="text-right p-2 font-medium w-20">{translate("数量", "Qty")}</th>
                  <th className="text-right p-2 font-medium w-28">{translate("单价", "Unit Price")}</th>
                  <th className="text-right p-2 font-medium w-24">{translate("小计", "Subtotal")}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {editItems.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="p-2">{item.productName}</td>
                    <td className="p-2 text-muted-foreground">{item.variationName || "-"}</td>
                    <td className="p-2">
                      <Input
                        type="number"
                        className="h-8 w-16 text-right"
                        value={item.quantity}
                        min={1}
                        onChange={(e) => updateEditItem(idx, "quantity", parseInt(e.target.value) || 1)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        className="h-8 w-24 text-right"
                        value={item.unitPrice}
                        step="0.01"
                        onChange={(e) => updateEditItem(idx, "unitPrice", e.target.value)}
                      />
                    </td>
                    <td className="p-2 text-right font-medium">RM {((parseFloat(item.unitPrice) || 0) * (item.quantity || 0)).toFixed(2)}</td>
                    <td className="p-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeEditItem(idx)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {editItems.length === 0 && (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">{translate("无商品", "No items")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Amount Details (editable) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {translate("金额详情", "Amount Details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">{translate("折扣金额", "Discount Amount")}</Label>
              <Input type="number" value={formData.discountAmount} onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value || "0" })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{translate("折扣原因", "Discount Reason")}</Label>
              <Input value={formData.discountReason} onChange={(e) => setFormData({ ...formData, discountReason: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("额外收费", "Extra Charge")}</Label>
              <Input type="number" value={formData.extraCharge} onChange={(e) => setFormData({ ...formData, extraCharge: e.target.value || "0" })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{translate("收费说明", "Charge Description")}</Label>
              <Input value={formData.extraChargeDescription} onChange={(e) => setFormData({ ...formData, extraChargeDescription: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("使用Credit (自动)", "Credit Used (Auto)")}</Label>
              <Input type="number" value={formData.creditUsed} readOnly disabled className="bg-gray-100 dark:bg-gray-800 cursor-not-allowed" />
            </div>
            <div>
              <Label className="text-xs">{translate("运费", "Shipping Fee")}</Label>
              <Input type="number" value={formData.shippingFee} onChange={(e) => setFormData({ ...formData, shippingFee: e.target.value || "0" })} />
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>{translate("商品小计", "Items Subtotal")}</span><span>RM {itemsSubtotal.toFixed(2)}</span></div>
            {discountNum > 0 && <div className="flex justify-between text-red-600"><span>{translate("折扣", "Discount")}</span><span>-RM {discountNum.toFixed(2)}</span></div>}
            {extraChargeNum > 0 && <div className="flex justify-between"><span>{translate("额外收费", "Extra Charge")}</span><span>+RM {extraChargeNum.toFixed(2)}</span></div>}
            <div className="flex justify-between"><span>{translate("运费", "Shipping Fee")}</span><span>RM {shippingFeeNum.toFixed(2)}</span></div>
            {creditUsedNum > 0 && <div className="flex justify-between text-blue-600"><span>{translate("使用Credit", "Credit Used")}</span><span>-RM {creditUsedNum.toFixed(2)}</span></div>}
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>{translate("总金额", "Total Amount")}</span>
              <span>RM {totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Payment Records */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {translate("区域六：付款记录", "Section 6: Payment Records")}
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setPaymentDialogOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />{translate("新增付款", "Add Payment")}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="p-3">{translate("日期", "Date")}</TableHead>
                  <TableHead className="p-3 text-right">{translate("金额", "Amount")}</TableHead>
                  <TableHead className="p-3">{translate("付款方式", "Method")}</TableHead>
                  <TableHead className="p-3">{translate("付款凭证", "Receipt")}</TableHead>
                  <TableHead className="p-3">{translate("备注", "Notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((order as any)?.payments || []).map((p: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="p-3">{new Date(p.paymentDate || p.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</TableCell>
                    <TableCell className="p-3 text-right font-medium">RM {parseFloat(p.amount).toFixed(2)}</TableCell>
                    <TableCell className="p-3">{p.paymentMethod || p.paymentMethodName || "-"}</TableCell>
                    <TableCell className="p-3">{p.receiptUrl ? <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{translate("查看", "View")}</a> : "-"}</TableCell>
                    <TableCell className="p-3 text-muted-foreground">{p.notes || "-"}</TableCell>
                  </TableRow>
                ))}
                {(!((order as any)?.payments || []).length) && (
                  <TableRow>
                    <TableCell colSpan={5} className="p-6 text-center text-muted-foreground">{translate("无付款记录", "No payment records")}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Section 7: Remarks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {translate("区域七：备注", "Section 7: Remarks")}
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setRemarkDialogOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />{translate("新增备注", "Add Remark")}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(remarks || []).length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{translate("无备注", "No remarks")}</p>
          ) : (
            (remarks || []).map((r: any, idx: number) => (
              <div key={idx} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {r.remarkCategory === "repotting" ? translate("换盆", "Repotting") :
                     r.remarkCategory === "desired_delivery_date" ? translate("发货日期", "Shipping Date") :
                     r.remarkCategory === "select_tree" ? translate("选树身", "Select Tree") :
                     translate("其他", "Other")}
                  </Badge>
                  {r.type === "customer" && <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{translate("客户", "Customer")}</Badge>}
                  {r.type === "internal" && <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{translate("后台", "Admin")}</Badge>}
                  {r.type === "live" && <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{translate("直播", "Live")}</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">{new Date(r.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => deleteRemarkMutation.mutate({ id: r.id })}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
                {r.remarkCategory === "desired_delivery_date" ? (
                  <p className="text-sm text-muted-foreground">
                    {r.desiredDeliveryDate ? new Date(r.desiredDeliveryDate).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US") : ""}
                    {r.desiredDeliveryReason && <span className="ml-2">— {r.desiredDeliveryReason}</span>}
                  </p>
                ) : r.remarkCategory === "repotting" && r.repottingData ? (
                  <div className="space-y-1">
                    <p className="text-sm">{r.content}</p>
                    {(() => {
                      try {
                        const entries = JSON.parse(r.repottingData);
                        return entries.map((e: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-green-50 dark:bg-green-950/20 rounded px-2 py-1">
                            <Sprout className="h-3 w-3 text-green-600" />
                            <span className="font-medium">{e.plantName}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">{e.potName}</span>
                            <span className="text-muted-foreground">x{e.quantity}</span>
                          </div>
                        ));
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                ) : (
                  <p className="text-sm">{r.content}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 pt-4 pb-8">
        <Button variant="outline" onClick={onBack}>
          <X className="h-4 w-4 mr-1" />{translate("取消", "Cancel")}
        </Button>
        <Button onClick={handleSave} disabled={updateDetailsMutation.isPending} size="lg">
          <Save className="h-4 w-4 mr-1" />
          {updateDetailsMutation.isPending ? translate("保存中...", "Saving...") : translate("保存修改", "Save Changes")}
        </Button>
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("新增付款记录", "Add Payment Record")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("金额 (RM)", "Amount (RM)")}</Label>
              <Input type="number" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>{translate("付款方式", "Payment Method")}</Label>
              <Select
                value={paymentForm.paymentMethodName}
                onValueChange={(v) => setPaymentForm(prev => ({ ...prev, paymentMethodName: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={translate("选择付款方式", "Select payment method")} />
                </SelectTrigger>
                <SelectContent>
                  {filteredPaymentMethods.map((method: any) => (
                    <SelectItem key={method.id} value={method.name}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isSelfPickup && (
                <p className="text-xs text-muted-foreground mt-1">{translate("配送订单不支持现金付款", "Cash payment not available for delivery orders")}</p>
              )}
            </div>
            <div>
              <Label>{translate("上传付款单据", "Upload Receipt")}</Label>
              <input ref={receiptFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadReceipt(f); e.target.value = ""; }} />
              {paymentForm.receiptUrl ? (
                <div className="flex items-center gap-2">
                  <a href={paymentForm.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">{translate("查看单据", "View Receipt")}</a>
                  <Button variant="ghost" size="sm" onClick={() => setPaymentForm(prev => ({ ...prev, receiptUrl: "" }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => receiptFileRef.current?.click()} disabled={uploadingReceipt} className="w-full">
                  {uploadingReceipt ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />{translate("上传中...", "Uploading...")}</> : <><Upload className="h-3 w-3 mr-1" />{translate("选择文件", "Choose File")}</>}
                </Button>
              )}
            </div>
            <div>
              <Label>{translate("备注", "Notes")}</Label>
              <Textarea value={paymentForm.notes} onChange={e => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={handleAddPayment} disabled={addPaymentMutation.isPending}>
              {addPaymentMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              {translate("保存", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Remark Dialog */}
      <Dialog open={remarkDialogOpen} onOpenChange={setRemarkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{translate("新增备注", "Add Remark")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("备注类型", "Remark Type")}</Label>
              <Select
                value={remarkForm.remarkCategory}
                onValueChange={(v) => setRemarkForm(prev => ({ ...prev, remarkCategory: v as any }))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder={translate("选择备注类型", "Select remark type")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desired_delivery_date">{translate("发货日期", "Shipping Date")}</SelectItem>
                  <SelectItem value="repotting">{translate("换盆", "Repotting")}</SelectItem>
                  <SelectItem value="select_tree">{translate("选树身", "Select Tree")}</SelectItem>
                  <SelectItem value="other">{translate("其他", "Other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {remarkForm.remarkCategory === "desired_delivery_date" && (
              <div className="space-y-3">
                <div>
                  <Label>{translate("预约发货日期", "Scheduled Shipping Date")} *</Label>
                  <Input
                    type="date"
                    value={remarkForm.desiredDeliveryDate}
                    onChange={(e) => setRemarkForm(prev => ({ ...prev, desiredDeliveryDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{translate("备注（选填）", "Note (optional)")}</Label>
                  <Textarea
                    value={remarkForm.content}
                    onChange={(e) => setRemarkForm(prev => ({ ...prev, content: e.target.value }))}
                    rows={2}
                    placeholder={translate("如有特别要求可填写，否则可留空", "Enter if there are special requirements, otherwise leave blank")}
                  />
                </div>
              </div>
            )}
            {remarkForm.remarkCategory === "repotting" && (
              <div className="space-y-3">
                <Label className="text-xs">{translate("换盆记录（可添加多组）", "Repotting entries (can add multiple)")}</Label>
                {remarkForm.repottingEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-end gap-2 p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                    <div className="flex-1">
                      <Label className="text-xs mb-1 block">{translate("植物名称", "Plant Name")}</Label>
                      <Select
                        value={entry.plantName}
                        onValueChange={(v) => setRemarkForm(prev => ({
                          ...prev,
                          repottingEntries: prev.repottingEntries.map((r, i) => i === idx ? { ...r, plantName: v } : r),
                        }))}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={translate("选择植物", "Select plant")} /></SelectTrigger>
                        <SelectContent>
                          {orderPlants.length === 0 ? (
                            <SelectItem value="__none" disabled>{translate("订单无植物类商品", "No plant items in order")}</SelectItem>
                          ) : (
                            orderPlants.map((item: any, i: number) => (
                              <SelectItem key={i} value={item.productName}>
                                {item.productName}{item.variationName ? ` (${item.variationName})` : ""} ×{item.quantity}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs mb-1 block">{translate("花盆", "Pot")}</Label>
                      <Select
                        value={entry.potName}
                        onValueChange={(v) => setRemarkForm(prev => ({
                          ...prev,
                          repottingEntries: prev.repottingEntries.map((r, i) => i === idx ? { ...r, potName: v } : r),
                        }))}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={translate("选择花盆", "Select pot")} /></SelectTrigger>
                        <SelectContent>
                          {orderPots.length === 0 ? (
                            <SelectItem value="__none" disabled>{translate("订单无花盆类商品", "No pot items in order")}</SelectItem>
                          ) : (
                            orderPots.map((item: any, i: number) => (
                              <SelectItem key={i} value={item.productName}>
                                {item.productName}{item.variationName ? ` (${item.variationName})` : ""} ×{item.quantity}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-16">
                      <Label className="text-xs mb-1 block">{translate("数量", "Qty")}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={entry.quantity}
                        onChange={(e) => setRemarkForm(prev => ({
                          ...prev,
                          repottingEntries: prev.repottingEntries.map((r, i) => i === idx ? { ...r, quantity: Number(e.target.value) } : r),
                        }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setRemarkForm(prev => ({
                        ...prev,
                        repottingEntries: prev.repottingEntries.filter((_, i) => i !== idx),
                      }))}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRemarkForm(prev => ({
                    ...prev,
                    repottingEntries: [...prev.repottingEntries, { plantName: "", potName: "", quantity: 1 }],
                  }))}
                  disabled={orderPlants.length === 0 && orderPots.length === 0}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {translate("添加换盆记录", "Add Repot Entry")}
                </Button>
              </div>
            )}
            {(remarkForm.remarkCategory === "" || remarkForm.remarkCategory === "other" || remarkForm.remarkCategory === "select_tree") && (
              <div>
                <Label>{translate("备注内容", "Remark Content")}</Label>
                <Textarea
                  value={remarkForm.content}
                  onChange={(e) => setRemarkForm(prev => ({ ...prev, content: e.target.value }))}
                  rows={3}
                  placeholder={remarkForm.remarkCategory === "select_tree" ? translate("输入选树身要求，例如：要粗身 / 要高身 / 要多分支", "Enter tree selection requirements, e.g. thick trunk / tall / multi-branch") : translate("输入备注内容", "Enter remark content")}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemarkDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={handleAddRemark} disabled={createRemarkMutation.isPending}>
              {createRemarkMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              {translate("保存", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
