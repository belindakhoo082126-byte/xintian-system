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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Search, Plus, Trash2, X, ArrowLeft, Eye, Save, ClipboardPaste,
  User, Package, DollarSign, Truck, FileText, Sparkles, CreditCard, Maximize2,
  Sprout,
} from "lucide-react";
import { PaymentRecordsEditor } from "@/components/PaymentRecordsEditor";
import type { PaymentRecord } from "@/components/PaymentRecordsEditor";

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

const LOCAL_ORDER_STATUSES = [
  { value: "pending", label: "未汇款订单", enLabel: "Unpaid Order" },
  { value: "receipt_uploaded", label: "待审核付款凭证", enLabel: "Pending Payment Verification" },
  { value: "packing", label: "待包货", enLabel: "Pending Packing" },
  { value: "partial_shipped", label: "部分发货", enLabel: "Partial Shipped" },
  { value: "shipped", label: "已发货", enLabel: "Shipped" },
  { value: "completed", label: "已完成", enLabel: "Completed" },
  { value: "cancelled", label: "已取消", enLabel: "Cancelled" },
  { value: "scheduled", label: "预约发货", enLabel: "Scheduled Shipping" },
  { value: "hold_order", label: "保留订单", enLabel: "Hold Order" },
];

const IMPORT_ORDER_STATUSES = [
  { value: "pending", label: "未汇款订单", enLabel: "Unpaid Order" },
  { value: "receipt_uploaded", label: "待审核付款凭证", enLabel: "Pending Payment Verification" },
  { value: "packing", label: "待包货", enLabel: "Pending Packing" },
  { value: "partial_shipped", label: "部分发货", enLabel: "Partial Shipped" },
  { value: "shipped", label: "已发货", enLabel: "Shipped" },
  { value: "completed", label: "已完成", enLabel: "Completed" },
  { value: "cancelled", label: "已取消", enLabel: "Cancelled" },
  { value: "scheduled", label: "预约发货", enLabel: "Scheduled Shipping" },
  { value: "hold_order", label: "保留订单", enLabel: "Hold Order" },
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
  image?: string;
  sku?: string;
  keyword?: string;
  sellingPrice?: string;
  // V2.0.66: Product classification for repotting remarks filtering
  isPot?: boolean;
  categoryId?: number;
}

export default function OrderCreatePage({ orderCategory = "local" }: { orderCategory?: "local" | "import" }) {
  const { translate, lang } = useI18n();
  const [_, setLocation] = useLocation();

  // ===== State =====
  const [orderNature, setOrderNature] = useState("retail");
  const [orderSource] = useState("manual"); // Fixed: Admin manual
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [initialStatus, setInitialStatus] = useState("pending");

  // Customer search
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>(undefined);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Customer form
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phoneNumber: "",
    facebookName: "",
    facebookId: "",
    messengerId: "",
  });

  // Smart Paste
  const [smartPasteText, setSmartPasteText] = useState("");
  const [smartPasteLoading, setSmartPasteLoading] = useState(false);

  // Recipient form
  const [recipientForm, setRecipientForm] = useState({
    recipientName: "",
    recipientPhone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postcode: "",
    country: "Malaysia",
  });
    const [buyerIsRecipient, setBuyerIsRecipient] = useState(true);
  // V2.0.62: Ref to prevent useEffect from overwriting Smart Parse results
  const smartParseUpdatingRef = useRef(false);
  // V2.0.43: Auto-sync customerForm to recipientForm when buyer is recipient
  // V2.0.69: Only sync when buyerIsRecipient is true AND smartParseUpdatingRef is false
  // This prevents AI Smart Parse results from being overwritten by stale customerForm values
  useEffect(() => {
    // Skip if Smart Parse is currently updating (it sets recipientForm directly)
    if (smartParseUpdatingRef.current) return;
    if (buyerIsRecipient) {
      setRecipientForm(prev => ({
        ...prev,
        recipientName: customerForm.name,
        recipientPhone: customerForm.phoneNumber,
      }));
    }
  }, [customerForm.name, customerForm.phoneNumber, buyerIsRecipient]);

  // Shipping
  const [shippingMethod, setShippingMethod] = useState("west_malaysia");

  // Product search
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [manualItems, setManualItems] = useState<ManualOrderItem[]>([]);

  // Amounts
  const [discountAmount, setDiscountAmount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [extraCharge, setExtraCharge] = useState("0");
  const [extraChargeDescription, setExtraChargeDescription] = useState("");
  const [creditUsed, setCreditUsed] = useState("0");

  // Remarks
  const [remark, setRemark] = useState("");
  const [createRemarkCategory, setCreateRemarkCategory] = useState("");
  const [createRemarkDeliveryDate, setCreateRemarkDeliveryDate] = useState("");
  // V2.0.60: Multiple repotting entries for order creation
  // V2.0.65: Plant & pot both selected from Section 4 items (manualItems)
  const [repottingEntries, setRepottingEntries] = useState<Array<{ plantName: string; plantProductId?: number; potName: string; potProductId?: number; quantity: number }>>([]);
  const { data: potProducts } = trpc.repots.potProducts.useQuery();
  // V2.0.65: Items added in Section 4, filtered to those with a real productId
  const section4Items = manualItems.filter(i => i.productId !== undefined);
  // V2.0.66: Plant items (isPot=false) and pot items (isPot=true) for repotting remarks
  const section4Plants = section4Items.filter(i => !i.isPot);
  const section4Pots = section4Items.filter(i => i.isPot);

  // Preview mode
  const [previewMode, setPreviewMode] = useState(false);
  const [localPayments, setLocalPayments] = useState<PaymentRecord[]>([]);
  // Product image preview (lightbox) with multi-image support
  const [previewProduct, setPreviewProduct] = useState<ManualOrderItem | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  // Helper: get all images for a product (currently single image, but architecture supports multiple)
  const getProductImages = (item: ManualOrderItem | null): string[] => {
    if (!item || !item.image) return [];
    // Future: return item.images || [item.image]
    return [item.image];
  };

  // ===== Queries =====
  const utils = trpc.useUtils();

  // Customer search
  const { data: customerSearchResults } = trpc.customers.list.useQuery(
    { search: customerSearchQuery },
    { enabled: customerSearchQuery.length > 0 }
  );

  // Product search
  const { data: productSearchResults } = trpc.orders.searchProductsForOrder.useQuery(
    { query: productSearchQuery },
    { enabled: productSearchQuery.length > 0 }
  );

  // ===== Mutations =====
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
        shippingAddress: [recipientForm.addressLine1, recipientForm.addressLine2, recipientForm.city, recipientForm.state, recipientForm.postcode, recipientForm.country].filter(Boolean).join(", "),
        shippingMethod,
        orderNature,
        orderSource,
        orderCategory,
        discountAmount,
        discountReason: discountReason || undefined,
        extraCharge,
        extraChargeDescription: extraChargeDescription || undefined,
        creditUsed: creditUsed !== "0" ? creditUsed : undefined,
        recipientName: recipientForm.recipientName || undefined,
        recipientPhone: recipientForm.recipientPhone || undefined,
        addressLine1: recipientForm.addressLine1 || undefined,
        addressLine2: recipientForm.addressLine2 || undefined,
        city: recipientForm.city || undefined,
        state: recipientForm.state || undefined,
        postcode: recipientForm.postcode || undefined,
        country: recipientForm.country || undefined,
        repottingData: createRemarkCategory === "repotting" && repottingEntries.length > 0 ? JSON.stringify(repottingEntries) : undefined,
      });
    },
    onError: (e) => toast.error(translate("客户创建失败: {message}", "Customer creation failed: {message}", { message: e.message })),
  });

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: async (r: any) => {
      utils.orders.invalidate();
      // Batch-submit any locally collected payment records
      if (localPayments.length > 0 && r.orderId) {
        try {
          for (const p of localPayments) {
            await trpc.orders.addPayment.useMutation().mutateAsync({
              orderId: r.orderId,
              amount: p.amount,
              paymentMethod: p.paymentMethod,
              paymentDate: p.paymentDate ? new Date(p.paymentDate).toISOString() : undefined,
              receiptFiles: p.receiptFiles && p.receiptFiles.length > 0 ? JSON.stringify(p.receiptFiles) : undefined,
              notes: p.notes || undefined,
              purpose: p.purpose || undefined,
            });
          }
          toast.success(translate("订单创建成功，已保存 {count} 笔付款记录", "Order created, {count} payment record(s) saved", { count: String(localPayments.length) }));
        } catch (err: any) {
          toast.success(translate("订单创建成功: {orderNumber}（付款记录保存失败，请到订单页手动添加）", "Order created: {orderNumber} (payment records failed to save, please add manually)", { orderNumber: r.orderNumber }));
        }
      } else {
        toast.success(translate("订单创建成功: {orderNumber}", "Order created successfully: {orderNumber}", { orderNumber: r.orderNumber }));
      }
      setLocation("/orders/" + (orderCategory === "import" ? "import" : "local"));
    },
    onError: (e) => toast.error(translate("订单创建失败: {message}", "Order creation failed: {message}", { message: e.message })),
  });

  const smartParseMutation = trpc.orders.aiSmartParse.useQuery(
    { text: smartPasteText },
    { enabled: false }
  );

  // ===== Computed values =====
  const physicalSubtotal = useMemo(() => {
    return manualItems
      .filter(i => i.productType === "physical" || i.productType === "gift")
      .reduce((sum, i) => sum + parseFloat(i.subtotal || "0"), 0);
  }, [manualItems]);

  const membershipSubtotal = useMemo(() => {
    return manualItems
      .filter(i => i.productType === "membership")
      .reduce((sum, i) => sum + parseFloat(i.subtotal || "0"), 0);
  }, [manualItems]);

  const itemsSubtotal = physicalSubtotal + membershipSubtotal;
  const discountNum = parseFloat(discountAmount) || 0;
  const extraChargeNum = parseFloat(extraCharge) || 0;
  const creditUsedNum = parseFloat(creditUsed) || 0;

  // Settled amount for free shipping threshold
  const settledAmount = itemsSubtotal - discountNum;

  // Shipping calculation
  const totalWeight = useMemo(() => {
    return manualItems
      .filter(i => i.productType === "physical" || i.productType === "gift")
      .reduce((sum, i) => sum + 0.5 * i.quantity, 0);
  }, [manualItems]);

  const { data: shippingResult } = trpc.orders.calculateShipping.useQuery(
    { totalWeight, orderTotal: settledAmount },
    { enabled: shippingMethod === "west_malaysia" && manualItems.length > 0 }
  );

  const shippingFee = shippingMethod === "self_pickup" ? 0 : (shippingResult?.shippingFee ?? 0);
  const freeShipping = shippingResult?.freeShipping ?? false;

  const totalAmount = useMemo(() => {
    return itemsSubtotal - discountNum + extraChargeNum + shippingFee - creditUsedNum;
  }, [itemsSubtotal, discountNum, extraChargeNum, shippingFee, creditUsedNum]);

  // ===== Handlers =====
  function handleCustomerSelect(c: any) {
    setSelectedCustomerId(c.id);
    setSelectedCustomer(c);
    setCustomerForm({
      name: c.name || "",
      phoneNumber: c.phoneNumber || "",
      facebookName: c.facebookName || "",
      facebookId: c.facebookId || "",
      messengerId: c.messengerId || "",
    });
    // Auto-set order nature based on customer type
    if (c.customerType === "wholesale") setOrderNature("wholesale");
    else if (c.customerType === "agent") setOrderNature("agent");
    else setOrderNature("retail");
    // Auto-fill recipient if buyer is recipient
    if (buyerIsRecipient) {
      setRecipientForm(prev => ({
        ...prev,
        recipientName: c.name || "",
        recipientPhone: c.phoneNumber || "",
      }));
    }
    setCustomerSearchQuery("");
  }

  async function handleSmartPaste() {
    if (!smartPasteText.trim()) {
      toast.error(translate("请粘贴客户资料文字", "Please paste customer info text"));
      return;
    }
    setSmartPasteLoading(true);

    // V2.0.69: Debug log BEFORE AI Smart Parse
    console.log("[AI Smart Parse] BEFORE:", {
      "customerForm.name": customerForm.name,
      "customerForm.phoneNumber": customerForm.phoneNumber,
      "recipientForm.recipientName": recipientForm.recipientName,
      "recipientForm.recipientPhone": recipientForm.recipientPhone,
      buyerIsRecipient,
    });

    // V2.0.69: Snapshot customerForm before AI Smart to detect any unauthorized modification
    const customerNameBefore = customerForm.name;
    const customerPhoneBefore = customerForm.phoneNumber;

    try {
      const result = await utils.orders.aiSmartParse.fetch({ text: smartPasteText });
      if (result) {
        // V2.0.69: Debug log AI result
        console.log("[AI Smart Parse] API Result:", result);

        // V2.0.68: AI Smart Parse only updates Region 3 (Recipient), NEVER Region 2 (Customer Profile)
        // Customer Profile (name, facebookName, facebookId, messengerId) must not be overwritten by recipient data
        smartParseUpdatingRef.current = true;

        // V2.0.69: Single batch update for recipientForm only — NO customerForm changes
        // AI Smart Parse is NOT allowed to modify: customerForm.name, customerForm.phoneNumber,
        // customerForm.facebookName, customerForm.facebookId, customerForm.messengerId
        setRecipientForm(prev => ({
          ...prev,
          recipientName: result.customerName || prev.recipientName,
          recipientPhone: result.contactNumber || prev.recipientPhone,
          addressLine1: result.addressLine1 || prev.addressLine1,
          addressLine2: result.addressLine2 || prev.addressLine2,
          city: result.city || prev.city,
          state: result.state || prev.state,
          postcode: result.postcode || prev.postcode,
          country: result.country || prev.country,
        }));

        if (result.area === "East Malaysia") {
          setShippingMethod("east_malaysia_poslaju");
        }

        // V2.0.69: Debug log AFTER AI Smart Parse (check after state flush)
        setTimeout(() => {
          console.log("[AI Smart Parse] AFTER (after 100ms):", {
            "customerForm.name (should be unchanged)": customerForm.name,
            "customerForm.phoneNumber (should be unchanged)": customerForm.phoneNumber,
            "recipientForm.recipientName (should be AI result)": recipientForm.recipientName,
            "recipientForm.recipientPhone (should be AI result)": recipientForm.recipientPhone,
            "customerNameBefore": customerNameBefore,
            "customerPhoneBefore": customerPhoneBefore,
            "customerNameChanged": customerForm.name !== customerNameBefore,
          });
        }, 100);

        toast.success(translate("Smart Parse 完成（{method}）", "Smart Parse complete ({method})", { method: result.method }));
        // Reset flag after state updates have flushed
        setTimeout(() => { smartParseUpdatingRef.current = false; }, 200);
      }
    } catch (e: any) {
      toast.error(translate("Smart Parse 失败: {message}", "Smart Parse failed: {message}", { message: e.message }));
    } finally {
      setSmartPasteLoading(false);
    }
  }

  function addManualItem() {
    setManualItems(prev => [
      ...prev,
      { productId: undefined, productName: "", productType: "physical", quantity: 1, unitPrice: "0", subtotal: "0" },
    ]);
  }

  function removeManualItem(idx: number) {
    setManualItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateManualItem(idx: number, field: keyof ManualOrderItem, value: any) {
    setManualItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        const qty = parseFloat(String(updated.quantity)) || 0;
        const price = parseFloat(String(updated.unitPrice)) || 0;
        updated.subtotal = (qty * price).toFixed(2);
      }
      return updated;
    }));
  }

    function handleProductSelect(idx: number, productId: string) {
    if (productId === "none") return;
    const product = (productSearchResults as any)?.find((p: any) => p.id === parseInt(productId));
    if (!product) return;
    const priceField = orderNature === "wholesale" ? "wholesalePrice" : orderNature === "agent" ? "agentPrice" : "sellingPrice";
    const unitPrice = (product as any)[priceField] || product.sellingPrice || product.regularPrice || "0";
    const quantity = 1;
    setManualItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const price = parseFloat(unitPrice) || 0;
      return {
        ...item,
        productId: product.id,
        productName: product.name,
        productType: product.type || "physical",
        unitPrice,
        subtotal: (quantity * price).toFixed(2),
        unitCost: (product as any).costPrice || (product as any).supplierCost || "0",
        priceType: orderNature,
        image: (product as any).coverImageUrl || (product as any).imageUrl || (product as any).image,
        sku: (product as any).sku,
        keyword: (product as any).keyword || "",
        sellingPrice: (product as any).sellingPrice || (product as any).regularPrice || "0",
        isPot: (product as any).isPot || false,
        categoryId: (product as any).categoryId,
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
    if (creditUsedNum > 0 && selectedCustomerId) {
      const customerCredit = parseFloat(selectedCustomer?.creditBalance || "0");
      if (creditUsedNum > customerCredit) {
        toast.error(translate("使用Credit不得超过客户余额 (RM {balance})", "Credit used cannot exceed customer balance (RM {balance})", { balance: customerCredit.toFixed(2) }));
        return;
      }
    }

    if (isWalkIn) {
      findCustomerMutation.mutate({
        name: customerForm.name || "Walk-in Customer",
        phoneNumber: customerForm.phoneNumber || undefined,
      });
    } else if (selectedCustomerId) {
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
        shippingAddress: [recipientForm.addressLine1, recipientForm.addressLine2, recipientForm.city, recipientForm.state, recipientForm.postcode, recipientForm.country].filter(Boolean).join(", "),
        shippingMethod,
        orderNature,
        orderSource,
        orderCategory,
        discountAmount,
        discountReason: discountReason || undefined,
        extraCharge,
        extraChargeDescription: extraChargeDescription || undefined,
        creditUsed: creditUsed !== "0" ? creditUsed : undefined,
        recipientName: recipientForm.recipientName || undefined,
        recipientPhone: recipientForm.recipientPhone || undefined,
        remark: remark || undefined,
        remarkCategory: createRemarkCategory || undefined,
        remarkDeliveryDate: createRemarkDeliveryDate || undefined,
        repottingData: createRemarkCategory === "repotting" && repottingEntries.length > 0 ? JSON.stringify(repottingEntries) : undefined,
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

  const isSubmitting = findCustomerMutation.isPending || createOrderMutation.isPending;
  const orderTypeLabel = orderCategory === "import" ? translate("中国代购订单", "Import Order") : translate("本地订单", "Local Order");
  const orderNumberPrefix = orderCategory === "import" ? "CXT" : "XT";
  const statusOptions = orderCategory === "import" ? IMPORT_ORDER_STATUSES : LOCAL_ORDER_STATUSES;

  // ===== Preview Mode =====
  if (previewMode) {
    return (
      <div className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setPreviewMode(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">{translate("订单预览", "Order Preview")} - {orderTypeLabel}</h1>
          </div>
          <Badge variant="secondary" className="text-lg font-mono">{orderNumberPrefix}_____</Badge>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">{translate("订单基本资料", "Order Basic Info")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">{translate("订单类型", "Order Type")}:</span> {orderTypeLabel}</div>
            <div><span className="text-muted-foreground">{translate("订单性质", "Order Nature")}:</span> {translate(ORDER_NATURE[orderNature as keyof typeof ORDER_NATURE]?.label || "零售", ORDER_NATURE[orderNature as keyof typeof ORDER_NATURE]?.enLabel || "Retail")}</div>
            <div><span className="text-muted-foreground">{translate("订单来源", "Order Source")}:</span> {translate("Admin手动", "Admin Manual")}</div>
            <div><span className="text-muted-foreground">{translate("初始状态", "Initial Status")}:</span> {translate(statusOptions.find(s => s.value === initialStatus)?.label || "未汇款订单", statusOptions.find(s => s.value === initialStatus)?.enLabel || "Unpaid Order")}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{translate("客户资料", "Customer Info")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><span className="text-muted-foreground">{translate("姓名", "Name")}:</span> {customerForm.name || "-"}</div>
            <div><span className="text-muted-foreground">{translate("电话", "Phone")}:</span> {customerForm.phoneNumber || "-"}</div>
            <div><span className="text-muted-foreground">{translate("FB名称", "FB Name")}:</span> {customerForm.facebookName || "-"}</div>
            <div><span className="text-muted-foreground">{translate("FB ID", "FB ID")}:</span> {customerForm.facebookId || "-"}</div>
            <div><span className="text-muted-foreground">{translate("Messenger ID", "Messenger ID")}:</span> {customerForm.messengerId || "-"}</div>
            {selectedCustomer && (
              <div><span className="text-muted-foreground">{translate("Credit余额", "Credit Balance")}:</span> RM {parseFloat(selectedCustomer.creditBalance || "0").toFixed(2)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{translate("收件人资料", "Recipient Info")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><span className="text-muted-foreground">{translate("收件人", "Recipient")}:</span> {recipientForm.recipientName || "-"}</div>
            <div><span className="text-muted-foreground">{translate("电话", "Phone")}:</span> {recipientForm.recipientPhone || "-"}</div>
            <div className="col-span-2"><span className="text-muted-foreground">{translate("地址", "Address")}:</span> {[recipientForm.addressLine1, recipientForm.addressLine2].filter(Boolean).join(", ") || "-"}</div>
            <div><span className="text-muted-foreground">{translate("城市", "City")}:</span> {recipientForm.city || "-"}</div>
            <div><span className="text-muted-foreground">{translate("州属", "State")}:</span> {recipientForm.state || "-"}</div>
            <div><span className="text-muted-foreground">{translate("Postcode", "Postcode")}:</span> {recipientForm.postcode || "-"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{translate("商品明细", "Order Items")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {manualItems.filter(i => i.productId).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                  <span className="font-medium">{item.productName}</span>
                  <span className="text-muted-foreground">x {item.quantity}</span>
                  <span>RM {parseFloat(item.subtotal).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{translate("金额详情", "Amount Details")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>{translate("商品小计", "Items Subtotal")}</span><span>RM {itemsSubtotal.toFixed(2)}</span></div>
            {discountNum > 0 && <div className="flex justify-between text-red-600"><span>{translate("人工折扣", "Manual Discount")}</span><span>-RM {discountNum.toFixed(2)}</span></div>}
            {extraChargeNum > 0 && <div className="flex justify-between"><span>{translate("额外收费", "Extra Charge")}</span><span>+RM {extraChargeNum.toFixed(2)}</span></div>}
            <div className="flex justify-between"><span>{translate("运费", "Shipping Fee")} {freeShipping && <Badge variant="secondary" className="ml-1 text-xs">{translate("免邮", "Free Shipping")}</Badge>}</span><span>RM {shippingFee.toFixed(2)}</span></div>
            {creditUsedNum > 0 && <div className="flex justify-between text-blue-600"><span>{translate("使用Credit", "Credit Used")}</span><span>-RM {creditUsedNum.toFixed(2)}</span></div>}
            <Separator />
            <div className="flex justify-between font-bold text-base"><span>{translate("总金额", "Total Amount")}</span><span>RM {totalAmount.toFixed(2)}</span></div>
          </CardContent>
        </Card>

        {remark && (
          <Card>
            <CardHeader><CardTitle className="text-base">{translate("备注", "Remark")}</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{remark}</CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => setPreviewMode(false)}>
            <ArrowLeft className="h-4 w-4 mr-1" />{translate("返回编辑", "Back to Edit")}
          </Button>
          <Button onClick={handleCreateOrder} disabled={isSubmitting} size="lg">
            <Save className="h-4 w-4 mr-1" />
            {translate("确认建立订单", "Confirm Create Order")}
          </Button>
        </div>
      </div>
    );
  }

  // ===== Edit Mode =====
  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{translate("手动建立订单", "Create Manual Order")}</h1>
            <p className="text-sm text-muted-foreground">{orderTypeLabel} · {orderNumberPrefix}_____</p>
          </div>
        </div>
        <Badge variant="outline">{translate("Admin手动", "Admin Manual")}</Badge>
      </div>

      {/* Section 1: Order Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {translate("区域一：订单基本资料", "Section 1: Order Basic Info")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">{translate("订单类型", "Order Type")}</Label>
            <Input value={orderTypeLabel} disabled className="bg-muted/50" />
          </div>
          <div>
            <Label className="text-xs">{translate("订单性质", "Order Nature")}</Label>
            <Select value={orderNature} onValueChange={setOrderNature}>
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
            <Input value={translate("Admin手动", "Admin Manual")} disabled className="bg-muted/50" />
          </div>
          <div>
            <Label className="text-xs">{translate("初始状态", "Initial Status")}</Label>
            <Select value={initialStatus} onValueChange={setInitialStatus}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((s, i) => (
                  <SelectItem key={`${s.value}-${i}`} value={s.value}>{translate(s.label, s.enLabel)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 col-span-2 md:col-span-4">
            <Checkbox checked={isWalkIn} onCheckedChange={(v) => setIsWalkIn(!!v)} id="walkin" />
            <Label htmlFor="walkin" className="text-sm cursor-pointer">{translate("Walk-in 客户", "Walk-in Customer")}</Label>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Customer Info + Smart Paste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            {translate("区域二：客户信息", "Section 2: Customer Info")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Customer Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={translate("搜索现有客户（姓名/电话/FB名/Messenger/编号）...", "Search existing customer (name/phone/FB/Messenger/ID)...")}
              value={customerSearchQuery}
              onChange={(e) => setCustomerSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {customerSearchResults && customerSearchResults.length > 0 && customerSearchQuery && (
            <ScrollArea className="h-[150px] border rounded-lg">
              <div className="p-2 space-y-1">
                {customerSearchResults.slice(0, 15).map((c: any) => (
                  <button key={c.id} onClick={() => handleCustomerSelect(c)} className="w-full text-left p-2 rounded hover:bg-muted text-sm flex items-center justify-between">
                    <div>
                      <span className="font-medium">{c.name || c.facebookName || c.displayName || "Unknown"}</span>
                      <span className="text-muted-foreground ml-2">{c.phoneNumber || c.customerId || ""}</span>
                    </div>
                    {c.creditBalance && parseFloat(c.creditBalance) > 0 && (
                      <Badge variant="secondary" className="text-xs">Credit: RM {parseFloat(c.creditBalance).toFixed(2)}</Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
          {selectedCustomerId && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {translate("已选客户", "Selected Customer")}: {selectedCustomer?.name || selectedCustomer?.facebookName || `ID: ${selectedCustomerId}`}
                {selectedCustomer?.creditBalance && parseFloat(selectedCustomer.creditBalance) > 0 && (
                  <span className="ml-2">| Credit: RM {parseFloat(selectedCustomer.creditBalance).toFixed(2)}</span>
                )}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => {
                setSelectedCustomerId(undefined);
                setSelectedCustomer(null);
                setCustomerForm({ name: "", phoneNumber: "", facebookName: "", facebookId: "", messengerId: "" });
              }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Smart Paste */}
          <div className="border rounded-lg p-3 bg-muted/30">
            <Label className="text-xs flex items-center gap-1 mb-2">
              <Sparkles className="h-3 w-3" />
              {translate("AI Smart Paste / AI智能地址", "AI Smart Paste")}
            </Label>
            <Textarea
              value={smartPasteText}
              onChange={(e) => setSmartPasteText(e.target.value)}
              rows={4}
              placeholder={translate("粘贴客户姓名、电话及地址...\n例如:\nAlice Tan\n012-3456789\n12 Jalan ABC\nTaman Mutiara\n11900 Bayan Lepas\nPulau Pinang", "Paste customer name, phone and address...\ne.g:\nAlice Tan\n012-3456789\n12 Jalan ABC\nTaman Mutiara\n11900 Bayan Lepas\nPulau Pinang")}
            />
            <Button variant="outline" size="sm" className="mt-2" onClick={handleSmartPaste} disabled={smartPasteLoading}>
              <ClipboardPaste className="h-3 w-3 mr-1" />
              {smartPasteLoading ? translate("识别中...", "Parsing...") : translate("智能识别", "Smart Parse")}
            </Button>
          </div>

          {/* Customer form fields */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">{translate("客户姓名", "Customer Name")}</Label>
              <Input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
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
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Recipient Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            {translate("区域三：收件人详情", "Section 3: Recipient Details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={buyerIsRecipient} onCheckedChange={(v) => {
                setBuyerIsRecipient(!!v);
                if (v) {
                  setRecipientForm(prev => ({ ...prev, recipientName: customerForm.name, recipientPhone: customerForm.phoneNumber }));
                }
              }} id="buyer-recipient" />
              <Label htmlFor="buyer-recipient" className="text-sm cursor-pointer">{translate("买家是收件人", "Buyer is Recipient")}</Label>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">{translate("收件人姓名", "Recipient Name")}</Label>
              <Input value={recipientForm.recipientName} onChange={(e) => setRecipientForm({ ...recipientForm, recipientName: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("联系电话", "Contact Phone")}</Label>
              <Input value={recipientForm.recipientPhone} onChange={(e) => setRecipientForm({ ...recipientForm, recipientPhone: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("Postcode", "Postcode")}</Label>
              <Input value={recipientForm.postcode} onChange={(e) => setRecipientForm({ ...recipientForm, postcode: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("国家", "Country")}</Label>
              <Input value={recipientForm.country} onChange={(e) => setRecipientForm({ ...recipientForm, country: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{translate("地址第一行", "Address Line 1")}</Label>
              <Input value={recipientForm.addressLine1} onChange={(e) => setRecipientForm({ ...recipientForm, addressLine1: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{translate("地址第二行", "Address Line 2")}</Label>
              <Input value={recipientForm.addressLine2} onChange={(e) => setRecipientForm({ ...recipientForm, addressLine2: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("城市／地区", "City / Area")}</Label>
              <Input value={recipientForm.city} onChange={(e) => setRecipientForm({ ...recipientForm, city: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("州属", "State")}</Label>
              <Input value={recipientForm.state} onChange={(e) => setRecipientForm({ ...recipientForm, state: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{translate("配送方式", "Shipping Method")}</Label>
              <Select value={shippingMethod} onValueChange={setShippingMethod}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SHIPPING_METHODS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{translate(v.label, v.enLabel)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Product Search & Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            {translate("区域四：商品搜索与加入订单", "Section 4: Product Search & Order Items")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={translate("搜索商品（名称/英文名/关键词/SKU/规格名/规格关键词）...", "Search product (name/keyword/SKU/variation)...")}
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Product results dropdown */}
          {productSearchResults && (productSearchResults as any[]).length > 0 && productSearchQuery && (
            <ScrollArea className="h-[200px] border rounded-lg">
              <div className="p-2 space-y-1">
                {(productSearchResults as any[]).slice(0, 20).map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      const unitPrice = orderNature === "wholesale" ? (p.wholesalePrice || p.sellingPrice || "0") : orderNature === "agent" ? (p.agentPrice || p.sellingPrice || "0") : (p.sellingPrice || p.regularPrice || "0");
                      setManualItems(prev => [...prev, {
                        productId: p.id,
                        productName: p.name,
                        productType: p.type || "physical",
                        quantity: 1,
                        unitPrice,
                        subtotal: unitPrice,
                        priceType: orderNature,
                        unitCost: p.costPrice || p.supplierCost || "0",
                        image: p.coverImageUrl || p.imageUrl || p.image,
                        sku: p.sku,
                        keyword: p.keyword || "",
                        sellingPrice: p.sellingPrice || p.regularPrice || "0",
                        isPot: p.isPot || false,
                        categoryId: p.categoryId,
                      }]);
                      setProductSearchQuery("");
                    }}
                    className="w-full text-left p-2 rounded hover:bg-muted text-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {(p.coverImageUrl || p.imageUrl) && <img src={p.coverImageUrl || p.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />}
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">SKU: {p.sku} {p.keywords && `· ${p.keywords}`}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">RM {p.sellingPrice || p.regularPrice || "0"}</div>
                      {p.wholesalePrice && <div className="text-xs text-muted-foreground">{translate("批发", "Wholesale")}: RM {p.wholesalePrice}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Order items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{translate("订单商品", "Order Items")} ({manualItems.length})</Label>
              <Button variant="outline" size="sm" onClick={addManualItem}>
                <Plus className="h-3 w-3 mr-1" />{translate("添加商品", "Add Product")}
              </Button>
            </div>
            {manualItems.map((item, idx) => (
              <div key={idx} className="p-3 border rounded-lg space-y-3">
                {/* Product info display */}
                {item.productId && (
                  <div className="flex items-start gap-3 p-2 bg-muted/50 rounded-lg">
                    {/* Clickable image with preview - entire image area is clickable */}
                    {item.image ? (
                      <button
                        onClick={() => setPreviewProduct(item)}
                        className="relative shrink-0 cursor-pointer rounded-lg overflow-hidden border hover:border-primary transition-colors"
                        title={translate("点击预览大图", "Click to preview")}
                      >
                        <img src={item.image} alt={item.productName} className="w-20 h-20 object-cover" />
                        <div className="absolute bottom-0 right-0 bg-black/50 rounded-tl px-1.5 py-0.5">
                          <Maximize2 className="h-3 w-3 text-white" />
                        </div>
                      </button>
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {/* Product details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="font-medium text-sm leading-snug" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.productName}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {item.sku && <span><span className="font-medium">SKU:</span> {item.sku}</span>}
                        {item.keyword && <span><span className="font-medium">{translate("关键字", "Keyword")}:</span> {item.keyword}</span>}
                      </div>
                      {item.variationName && (
                        <div className="text-xs text-muted-foreground"><span className="font-medium">{translate("规格", "Variant")}:</span> {item.variationName}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">{translate("售价", "Price")}:</span> RM {item.sellingPrice || item.unitPrice}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeManualItem(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
                {/* Product selector (only shown when no product selected) */}
                {!item.productId && (
                  <div>
                    <Label className="text-xs">{translate("选择商品", "Select Product")}</Label>
                    <Select
                      value={item.productId?.toString() || "none"}
                      onValueChange={(v) => handleProductSelect(idx, v)}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder={translate("选择商品", "Select Product")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{translate("请选择...", "Please select...")}</SelectItem>
                        {(productSearchResults as any[] || [])?.slice(0, 50).map((p: any) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.sku})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {/* Quantity / Price / Subtotal */}
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <Label className="text-xs">{translate("数量", "Quantity")}</Label>
                    <Input type="number" className="h-9" value={item.quantity} onChange={(e) => updateManualItem(idx, "quantity", e.target.value === "" ? "" : parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">{translate("单价", "Unit Price")}</Label>
                    <Input type="number" className="h-9" value={item.unitPrice} onChange={(e) => updateManualItem(idx, "unitPrice", e.target.value)} />
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs">{translate("小计", "Subtotal")}</Label>
                    <Input className="h-9" value={`RM ${parseFloat(item.subtotal).toFixed(2)}`} disabled />
                  </div>
                  <div className="col-span-2">
                    {item.productId && (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => removeManualItem(idx)}>
                        <Trash2 className="h-3 w-3 mr-1" />{translate("移除", "Remove")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {manualItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{translate("搜索并添加商品开始建立订单", "Search and add products to start creating an order")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Amount Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {translate("区域五：金额计算", "Section 5: Amount Calculation")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">{translate("折扣金额", "Discount Amount")}</Label>
              <Input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{translate("折扣原因", "Discount Reason")}</Label>
              <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder={translate("例如：植物叶片轻微损伤", "e.g. Slightly damaged leaves")} />
            </div>
            <div>
              <Label className="text-xs">{translate("额外收费", "Extra Charge")}</Label>
              <Input type="number" value={extraCharge} onChange={(e) => setExtraCharge(e.target.value)} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{translate("收费说明", "Charge Description")}</Label>
              <Input value={extraChargeDescription} onChange={(e) => setExtraChargeDescription(e.target.value)} placeholder={translate("例如：特别包装+急件处理", "e.g. Special packaging + rush handling")} />
            </div>
            {selectedCustomerId && selectedCustomer?.creditBalance && parseFloat(selectedCustomer.creditBalance) > 0 && (
              <>
                <div>
                  <Label className="text-xs">{translate("使用Credit", "Use Credit")}</Label>
                  <Input type="number" value={creditUsed} onChange={(e) => setCreditUsed(e.target.value)} placeholder="0.00" />
                </div>
                <div className="col-span-2 flex items-end">
                  <Badge variant="secondary" className="mb-2">
                    {translate("Credit余额", "Credit Balance")}: RM {parseFloat(selectedCustomer.creditBalance).toFixed(2)}
                  </Badge>
                </div>
              </>
            )}
          </div>

          <Separator />

          {/* Amount summary */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>{translate("商品小计", "Items Subtotal")}</span>
              <span className="font-medium">RM {itemsSubtotal.toFixed(2)}</span>
            </div>
            {discountNum > 0 && (
              <div className="space-y-0.5">
                <div className="flex justify-between text-red-600">
                  <span>{translate("人工折扣", "Manual Discount")}</span>
                  <span>-RM {discountNum.toFixed(2)}</span>
                </div>
                {discountReason && (
                  <div className="text-xs text-muted-foreground pl-2">↳ {discountReason}</div>
                )}
              </div>
            )}
            {extraChargeNum > 0 && (
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span>{translate("额外收费", "Extra Charge")}</span>
                  <span>+RM {extraChargeNum.toFixed(2)}</span>
                </div>
                {extraChargeDescription && (
                  <div className="text-xs text-muted-foreground pl-2">↳ {extraChargeDescription}</div>
                )}
              </div>
            )}
            <div className="flex justify-between">
              <span>{translate("运费", "Shipping Fee")} {freeShipping && <Badge variant="secondary" className="ml-1 text-xs">{translate("免邮", "Free Shipping")}</Badge>}</span>
              <span className="font-medium">RM {shippingFee.toFixed(2)}</span>
            </div>
            {creditUsedNum > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>{translate("使用Credit", "Credit Used")}</span>
                <span>-RM {creditUsedNum.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>{translate("总金额", "Total Amount")}</span>
              <span>RM {totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Remark */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {translate("区域六：备注", "Section 6: Remark")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs mb-1.5 block">{translate("备注类型", "Remark Type")}</Label>
            <Select value={createRemarkCategory} onValueChange={(v) => setCreateRemarkCategory(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder={translate("选择备注类型（可选）", "Select remark type (optional)")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">{translate("普通备注", "General Remark")}</SelectItem>
                <SelectItem value="desired_delivery_date">{translate("发货日期", "Shipping Date")}</SelectItem>
                <SelectItem value="repotting">{translate("换盆", "Repotting")}</SelectItem>
                <SelectItem value="other">{translate("其他", "Other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {createRemarkCategory === "desired_delivery_date" && (
            <div>
              <Label className="text-xs mb-1.5 block">{translate("预约发货日期", "Scheduled Shipping Date")}</Label>
              <Input type="date" value={createRemarkDeliveryDate} onChange={(e) => setCreateRemarkDeliveryDate(e.target.value)} />
            </div>
          )}
          {createRemarkCategory === "repotting" && (
            <div className="space-y-3">
              <Label className="text-xs">{translate("换盆记录（可添加多组，建单后还可在订单详情继续添加）", "Repotting entries (can add multiple groups, more can be added in order detail after creation)")}</Label>
              {repottingEntries.map((entry, idx) => {
                // V2.0.70: Find selected plant & pot items to show purchase quantity
                const selectedPlant = section4Plants.find(i => i.productName === entry.plantName);
                const selectedPot = section4Pots.find(i => i.productName === entry.potName);
                return (
                <div key={idx} className="space-y-2 p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs mb-1 block">{translate("植物名称", "Plant Name")}</Label>
                      <Select
                        value={entry.plantName}
                        onValueChange={(v) => {
                          const item = section4Plants.find(i => i.productName === v);
                          // V2.0.70: Auto-set repot quantity to plant purchase quantity
                          setRepottingEntries(prev => prev.map((r, i) => i === idx ? { ...r, plantName: v, plantProductId: item?.productId, quantity: item ? item.quantity : r.quantity } : r));
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={translate("选择植物", "Select plant")} /></SelectTrigger>
                        <SelectContent>
                          {section4Plants.length === 0 ? (
                            <SelectItem value="__none" disabled>{translate("区域四无植物类商品", "No plant items in Section 4")}</SelectItem>
                          ) : (
                            section4Plants.map((item, i) => (
                              <SelectItem key={`${item.productId}-${i}`} value={item.productName}>
                                {item.productName}{item.variationName ? ` (${item.variationName})` : ""}
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
                        onValueChange={(v) => {
                          const item = section4Pots.find(i => i.productName === v);
                          setRepottingEntries(prev => prev.map((r, i) => i === idx ? { ...r, potName: v, potProductId: item?.productId } : r));
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={translate("选择花盆", "Select pot")} /></SelectTrigger>
                        <SelectContent>
                          {section4Pots.length === 0 ? (
                            <SelectItem value="__none" disabled>{translate("区域四无花盆类商品", "No pot items in Section 4")}</SelectItem>
                          ) : (
                            section4Pots.map((item, i) => (
                              <SelectItem key={`${item.productId}-${i}`} value={item.productName}>
                                {item.productName}{item.variationName ? ` (${item.variationName})` : ""}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setRepottingEntries(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  {/* V2.0.70: Show purchase quantities (read-only) and repot quantity (editable, defaults to plant purchase qty) */}
                  {(selectedPlant || selectedPot) && (
                    <div className="flex items-center gap-4 pl-1 text-xs">
                      {selectedPlant && (
                        <span className="text-muted-foreground">
                          {translate("植物购买数量: {qty}（唯读）", "Plant Purchased Qty: {qty} (read-only)", { qty: String(selectedPlant.quantity) })}
                        </span>
                      )}
                      {selectedPot && (
                        <span className="text-muted-foreground">
                          {translate("花盆购买数量: {qty}（唯读）", "Pot Purchased Qty: {qty} (read-only)", { qty: String(selectedPot.quantity) })}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pl-1">
                    <Label className="text-xs whitespace-nowrap">{translate("换盆数量", "Repot Qty")}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={entry.quantity}
                      onChange={(e) => setRepottingEntries(prev => prev.map((r, i) => i === idx ? { ...r, quantity: Number(e.target.value) } : r))}
                      className="h-8 text-sm w-24"
                    />
                    <span className="text-xs text-muted-foreground">{translate("（预设等于植物购买数量，可修改）", "(defaults to plant purchase qty, editable)")}</span>
                  </div>
                </div>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRepottingEntries(prev => [...prev, { plantName: "", potName: "", quantity: 1 }])}
                disabled={section4Plants.length === 0 && section4Pots.length === 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                {translate("添加换盆记录", "Add Repot Entry")}
              </Button>
              {section4Plants.length === 0 && section4Pots.length === 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  {translate("请先在区域四添加植物和花盆商品后再使用换盆备注", "Please add plant and pot products in Section 4 first before using repotting remarks")}
                </div>
              )}
              {repottingEntries.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {translate("已添加 {count} 条换盆记录", "{count} repot entries added", { count: String(repottingEntries.length) })}
                </div>
              )}
              <Input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={translate("补充说明（可选）", "Additional notes (optional)")}
                className="text-sm"
              />
            </div>
          )}
          {(createRemarkCategory === "" || createRemarkCategory === "general" || createRemarkCategory === "other") && (
            <Textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              placeholder={translate("普通备注，例如：星期五才方便收货 / 送礼不要放价格 / 两张订单一起发", "General remark, e.g. Friday delivery preferred / No price tag for gift")}
            />
          )}
        </CardContent>
      </Card>

      {/* Payment Records (Create Mode) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            {translate("付款记录", "Payment Records")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentRecordsEditor
            mode="create"
            totalAmount={totalAmount}
            paidAmount={localPayments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0)}
            payments={localPayments}
            onLocalPaymentsChange={setLocalPayments}
          />
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 pt-4 pb-8">
        <Button variant="outline" onClick={() => window.history.back()}>
          {translate("取消", "Cancel")}
        </Button>
        <Button variant="outline" onClick={() => setPreviewMode(true)} disabled={manualItems.length === 0}>
          <Eye className="h-4 w-4 mr-1" />
          {translate("浏览订单", "Preview Order")}
        </Button>
        <Button onClick={handleCreateOrder} disabled={isSubmitting || manualItems.length === 0} size="lg">
          <Save className="h-4 w-4 mr-1" />
          {isSubmitting ? translate("保存中...", "Saving...") : translate("确认建立订单", "Confirm Create Order")}
        </Button>
      </div>
      {/* Product Image Preview Modal (Lightbox) */}
      <Dialog open={!!previewProduct} onOpenChange={(open) => { if (!open) { setPreviewProduct(null); setPreviewImageIndex(0); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{previewProduct?.productName || ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const images = getProductImages(previewProduct);
              if (images.length === 0) {
                return (
                  <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                    <Package className="h-16 w-16 text-muted-foreground" />
                  </div>
                );
              }
              return (
                <div className="relative">
                  <div className="flex justify-center">
                    <img src={images[previewImageIndex]} alt={previewProduct?.productName} className="max-w-[600px] max-h-[600px] w-full h-auto object-contain rounded-lg border" />
                  </div>
                  {/* Left/Right navigation (shown when multiple images) */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setPreviewImageIndex((i) => (i - 1 + images.length) % images.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                      >
                        <X className="h-5 w-5 rotate-45" />
                      </button>
                      <button
                        onClick={() => setPreviewImageIndex((i) => (i + 1) % images.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                      >
                        <X className="h-5 w-5 -rotate-45" />
                      </button>
                      {/* Thumbnail list */}
                      <div className="flex justify-center gap-2 mt-3">
                        {images.map((img, i) => (
                          <button
                            key={i}
                            onClick={() => setPreviewImageIndex(i)}
                            className={`w-16 h-16 rounded-lg object-cover border-2 transition-colors ${i === previewImageIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
                          >
                            <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full rounded-lg object-cover" />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {previewProduct?.sku && (
                <div><span className="font-medium text-muted-foreground">SKU:</span> <span className="font-mono">{previewProduct.sku}</span></div>
              )}
              {previewProduct?.keyword && (
                <div><span className="font-medium text-muted-foreground">{translate("关键字", "Keyword")}:</span> {previewProduct.keyword}</div>
              )}
              {previewProduct?.variationName && (
                <div><span className="font-medium text-muted-foreground">{translate("规格", "Variant")}:</span> {previewProduct.variationName}</div>
              )}
              <div><span className="font-medium text-muted-foreground">{translate("售价", "Price")}:</span> RM {previewProduct?.sellingPrice || previewProduct?.unitPrice || "0"}</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
