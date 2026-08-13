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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Search, Plus, Trash2, X, ArrowLeft, Eye, Save,
  User, Package, DollarSign, Truck, FileText, CreditCard, Maximize2,
  Sprout, Upload, Loader2,
} from "lucide-react";
import { parseLegacyAddress } from "@shared/parseAddress";
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

const LOCAL_ORDER_STATUSES = [
  { value: "pending", label: "未汇款订单", enLabel: "Unpaid Order" },
  { value: "receipt_uploaded", label: "待审核付款凭证", enLabel: "Pending Payment Verification" },
  { value: "partial_payment", label: "部分汇款", enLabel: "Partial Payment" },
  { value: "packing", label: "待包货", enLabel: "Pending Packing" },
  { value: "partial_shipped", label: "部分发货", enLabel: "Partial Shipped" },
  { value: "shipped", label: "已发货", enLabel: "Shipped" },
  { value: "completed", label: "已完成", enLabel: "Completed" },
  { value: "cancelled", label: "已取消", enLabel: "Cancelled" },
  { value: "hold_order", label: "保留订单", enLabel: "Hold Order" },
];

// V2.0.99: XTC Import Order Statuses (final unified version)
const IMPORT_ORDER_STATUSES = [
  { value: "pending", label: "挂单", enLabel: "Pending" },
  { value: "receipt_uploaded", label: "待审核付款凭证", enLabel: "Pending Payment Verification" },
  { value: "partial_payment", label: "部分汇款", enLabel: "Partial Payment" },
  { value: "waiting_stock", label: "待备货", enLabel: "Waiting Stock" },
  { value: "ready_to_ship", label: "待发货", enLabel: "Ready to Ship" },
  { value: "scheduled_ship", label: "预约发货", enLabel: "Scheduled Shipping" },
  { value: "partial_shipped", label: "部分发货", enLabel: "Partial Shipped" },
  { value: "shipped", label: "已发货", enLabel: "Shipped" },
  { value: "completed", label: "已完成", enLabel: "Completed" },
  { value: "cancelled", label: "取消", enLabel: "Cancelled" },
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
  availableStock?: number;
  allowOversold?: boolean;
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
  // V2.0.43: Auto-sync customerForm to recipientForm when buyer is recipient
  useEffect(() => {
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
  const [quickRestockProduct, setQuickRestockProduct] = useState<any>(null);
  const [quickRestockQuantity, setQuickRestockQuantity] = useState("1");
  const [quickRestockSupplierId, setQuickRestockSupplierId] = useState("");
  const [quickRestockRemark, setQuickRestockRemark] = useState("");

  // Amounts
  const [discountAmount, setDiscountAmount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [extraCharge, setExtraCharge] = useState("0");
  const [extraChargeDescription, setExtraChargeDescription] = useState("");
  // V2.0.78: Credit is now auto-calculated, not manually entered
  const customerCreditBalance = parseFloat(selectedCustomer?.creditBalance || "0");
  const autoCreditUsed = useMemo(() => {
    const subtotal = manualItems.filter(i => i.productId !== undefined).reduce((sum, i) => sum + parseFloat(i.subtotal || "0"), 0);
    return Math.min(customerCreditBalance, Math.max(0, subtotal - (parseFloat(discountAmount) || 0) + (parseFloat(extraCharge) || 0)));
  }, [customerCreditBalance, manualItems, discountAmount, extraCharge]);
  const creditUsed = autoCreditUsed.toFixed(2);
  const creditUsedNum = autoCreditUsed;

  // Remarks
  const [remark, setRemark] = useState("");
  const [createRemarkCategory, setCreateRemarkCategory] = useState("");
  const [createRemarkDeliveryDate, setCreateRemarkDeliveryDate] = useState("");
  // V2.0.60: Multiple repotting entries for order creation
  // V2.0.65: Plant & pot both selected from Section 4 items (manualItems)
  const [repottingEntries, setRepottingEntries] = useState<Array<{ plantName: string; plantProductId?: number; potName: string; potProductId?: number; quantity: number }>>([]);
  // Local payment records (submitted after order creation)
  const [localPayments, setLocalPayments] = useState<Array<{ amount: string; paymentMethodName: string; receiptUrl: string; notes: string }>>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentMethodName: "", receiptUrl: "", notes: "" });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptFileRef = useRef<HTMLInputElement>(null);
  const { data: potProducts } = trpc.repots.potProducts.useQuery();
  // V2.0.65: Items added in Section 4, filtered to those with a real productId
  const section4Items = manualItems.filter(i => i.productId !== undefined);
  // V2.0.66: Plant items (isPot=false) and pot items (isPot=true) for repotting remarks
  const section4Plants = section4Items.filter(i => !i.isPot);
  const section4Pots = section4Items.filter(i => i.isPot);

  // Preview mode
  const [previewMode, setPreviewMode] = useState(false);
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
    { query: productSearchQuery, orderCategory },
    { enabled: productSearchQuery.length > 0 }
  );
  const { data: quickRestockSuppliers = [] } = trpc.suppliers.list.useQuery({ activeOnly: true });
  const quickRestockCostQuery = trpc.purchaseOrders.lastProductCost.useQuery(
    {
      productId: quickRestockProduct?.id ?? 0,
      supplierId: Number(quickRestockSupplierId) || 0,
    },
    { enabled: !!quickRestockProduct && !!quickRestockSupplierId },
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
        shippingAddress: isWalkIn ? undefined : [recipientForm.addressLine1, recipientForm.addressLine2, recipientForm.city, recipientForm.state, recipientForm.postcode, recipientForm.country].filter(Boolean).join(", "),
        shippingMethod: isWalkIn ? "self_pickup" : shippingMethod,
        orderNature,
        orderSource,
        orderCategory,
        discountAmount,
        discountReason: discountReason || undefined,
        extraCharge,
        extraChargeDescription: extraChargeDescription || undefined,
        recipientName: isWalkIn ? undefined : recipientForm.recipientName || undefined,
        recipientPhone: isWalkIn ? undefined : recipientForm.recipientPhone || undefined,
        // V2.1.17: Pass structured address fields for customer profile auto-sync
        addressLine1: isWalkIn ? undefined : recipientForm.addressLine1 || undefined,
        addressLine2: isWalkIn ? undefined : recipientForm.addressLine2 || undefined,
        city: isWalkIn ? undefined : recipientForm.city || undefined,
        state: isWalkIn ? undefined : recipientForm.state || undefined,
        postcode: isWalkIn ? undefined : recipientForm.postcode || undefined,
        country: isWalkIn ? undefined : recipientForm.country || undefined,
        repottingData: createRemarkCategory === "repotting" && repottingEntries.length > 0 ? JSON.stringify(repottingEntries) : undefined,
      });
    },
    onError: (e) => toast.error(translate("客户创建失败: {message}", "Customer creation failed: {message}", { message: e.message })),
  });

  const addPaymentMutation = trpc.orders.addPayment.useMutation({
    onError: (e: any) => toast.error(translate("付款记录添加失败: {message}", "Payment record failed: {message}", { message: e.message })),
  });

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: async (r: any) => {
      utils.orders.invalidate();
      // Submit any local payment records after order creation
      if (localPayments.length > 0 && r.orderId) {
        for (const p of localPayments) {
          try {
            await addPaymentMutation.mutateAsync({
              orderId: r.orderId,
              amount: p.amount,
              paymentMethod: p.paymentMethodName || undefined,
              receiptUrl: p.receiptUrl || undefined,
              notes: p.notes || undefined,
            });
          } catch (e) {
            // Continue even if one payment fails
          }
        }
        setLocalPayments([]);
      }
      toast.success(translate("订单创建成功: {orderNumber}", "Order created successfully: {orderNumber}", { orderNumber: r.orderNumber }));
      setLocation("/orders/" + (orderCategory === "import" ? "import" : "local"));
    },
    onError: (e) => toast.error(translate("订单创建失败: {message}", "Order creation failed: {message}", { message: e.message })),
  });

  const quickRestockMutation = trpc.purchaseOrders.quickRestock.useMutation({
    onSuccess: (result) => {
      utils.inventoryAdjustment.invalidate();
      utils.purchaseOrders.invalidate();
      utils.orders.searchProductsForOrder.invalidate();
      utils.productsV2.invalidate();
      const allocationSuffix = result.allocatedQuantity > 0
        ? translate("；已自动分配 {quantity} 件等待补货商品（{count} 笔异常）", "; automatically allocated {quantity} waiting-restock item(s) across {count} exception(s)", {
            quantity: result.allocatedQuantity,
            count: result.allocatedExceptionIds.length,
          })
        : "";
      toast.success(translate("补货已登记，库存、厂家批次与成本记录已同步", "Restock recorded; stock, supplier lot, and cost are synchronized") + allocationSuffix);
      setQuickRestockProduct(null);
      setQuickRestockQuantity("1");
      setQuickRestockSupplierId("");
      setQuickRestockRemark("");
    },
    onError: (error) => toast.error(translate("补货失败: {message}", "Restock failed: {message}", { message: error.message })),
  });

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
  const regularItemsSubtotal = useMemo(() => {
    return manualItems
      .filter((item) => item.productId !== undefined && item.priceType !== "special")
      .reduce((sum, item) => sum + parseFloat(item.subtotal || "0"), 0);
  }, [manualItems]);
  const specialItemsSubtotal = useMemo(() => {
    return manualItems
      .filter((item) => item.productId !== undefined && item.priceType === "special")
      .reduce((sum, item) => sum + parseFloat(item.subtotal || "0"), 0);
  }, [manualItems]);
  const discountNum = parseFloat(discountAmount) || 0;
  const extraChargeNum = parseFloat(extraCharge) || 0;

  // Settled amount for free shipping threshold
  const settledAmount = itemsSubtotal - discountNum;

  // Shipping calculation
  const totalWeight = useMemo(() => {
    return manualItems
      .filter(i => i.productType === "physical" || i.productType === "gift")
      .reduce((sum, i) => sum + 0.5 * i.quantity, 0);
  }, [manualItems]);

  const { data: shippingResult } = trpc.orders.calculateShipping.useQuery(
    { totalWeight, orderTotal: settledAmount, shippingMethod: shippingMethod as any },
    { enabled: manualItems.length > 0 }
  );

  const shippingFee = shippingMethod === "self_pickup" ? 0 : (shippingResult?.shippingFee ?? 0);
  const freeShipping = shippingResult?.isFreeShipping ?? false;

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
    // V2.1.22: Auto-fill recipient from customer profile (including full structured address)
    // If customer has structured fields (addressLine1, city, state, postcode), use them directly.
    // If only legacy `address` field exists, parse it into structured fields.
    if (buyerIsRecipient) {
      const hasStructured = c.addressLine1 || c.city || c.state || c.postcode || c.postalCode;
      if (hasStructured) {
        setRecipientForm(prev => ({
          ...prev,
          recipientName: c.name || c.displayName || "",
          recipientPhone: c.phoneNumber || "",
          addressLine1: c.addressLine1 || "",
          addressLine2: c.addressLine2 || "",
          city: c.city || "",
          state: c.state || "",
          postcode: c.postcode || c.postalCode || "",
          country: c.country || "Malaysia",
        }));
      } else if (c.address) {
        // V2.1.22: Parse legacy single-line address into structured fields
        const parsed = parseLegacyAddress(c.address);
        setRecipientForm(prev => ({
          ...prev,
          recipientName: c.name || c.displayName || "",
          recipientPhone: c.phoneNumber || "",
          addressLine1: parsed.addressLine1 || c.address,
          addressLine2: parsed.addressLine2 || "",
          city: parsed.city || "",
          state: parsed.state || "",
          postcode: parsed.postcode || "",
          country: parsed.country || "Malaysia",
        }));
      } else {
        setRecipientForm(prev => ({
          ...prev,
          recipientName: c.name || c.displayName || "",
          recipientPhone: c.phoneNumber || "",
        }));
      }
    }
    setCustomerSearchQuery("");
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
        availableStock: Number((product as any).stockQuantity ?? 0),
        allowOversold: !!(product as any).allowOversold,
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
    if (hasStockShortage) {
      toast.error(translate("商品数量超过可售库存，请调整后再提交", "One or more quantities exceed available stock. Please adjust before submitting."));
      return;
    }
    if (isWalkIn) {
      findCustomerMutation.mutate({
        name: customerForm.name || "Walk in",
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
        shippingAddress: isWalkIn ? undefined : [recipientForm.addressLine1, recipientForm.addressLine2, recipientForm.city, recipientForm.state, recipientForm.postcode, recipientForm.country].filter(Boolean).join(", "),
        shippingMethod: isWalkIn ? "self_pickup" : shippingMethod,
        orderNature,
        orderSource,
        orderCategory,
        discountAmount,
        discountReason: discountReason || undefined,
        extraCharge,
        extraChargeDescription: extraChargeDescription || undefined,
        recipientName: isWalkIn ? undefined : recipientForm.recipientName || undefined,
        recipientPhone: isWalkIn ? undefined : recipientForm.recipientPhone || undefined,
        // V2.1.17: Pass structured address fields for customer profile auto-sync
        addressLine1: isWalkIn ? undefined : recipientForm.addressLine1 || undefined,
        addressLine2: isWalkIn ? undefined : recipientForm.addressLine2 || undefined,
        city: isWalkIn ? undefined : recipientForm.city || undefined,
        state: isWalkIn ? undefined : recipientForm.state || undefined,
        postcode: isWalkIn ? undefined : recipientForm.postcode || undefined,
        country: isWalkIn ? undefined : recipientForm.country || undefined,
        remark: remark || (createRemarkCategory === "desired_delivery_date" && createRemarkDeliveryDate ? createRemarkDeliveryDate : undefined),
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

  function handleAddLocalPayment() {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error(translate("请输入有效金额", "Please enter a valid amount"));
      return;
    }
    setLocalPayments(prev => [...prev, { ...paymentForm }]);
    setPaymentForm({ amount: "", paymentMethodName: "", receiptUrl: "", notes: "" });
    setPaymentDialogOpen(false);
    toast.success(translate("付款记录已添加（订单创建后自动提交）", "Payment added (will be submitted after order creation)"));
  }

  const localPaymentsTotal = localPayments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);

  const isSubmitting = findCustomerMutation.isPending || createOrderMutation.isPending || addPaymentMutation.isPending;
  const stockShortageItems = manualItems.filter((item) =>
    item.productType === "physical"
    && !item.allowOversold
    && item.availableStock !== undefined
    && item.quantity > item.availableStock,
  );
  const hasStockShortage = stockShortageItems.length > 0;
  const orderTypeLabel = orderCategory === "import" ? translate("中国代购订单", "Import Order") : translate("本地订单", "Local Order");
  const orderNumberPrefix = orderCategory === "import" ? "XTC" : "XT";
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
            <Checkbox checked={isWalkIn} onCheckedChange={(v) => {
              const enabled = !!v;
              setIsWalkIn(enabled);
              if (enabled) {
                setSelectedCustomerId(undefined);
                setSelectedCustomer(null);
                setCustomerSearchQuery("");
                setCustomerForm({ name: "Walk in", phoneNumber: "", facebookName: "", facebookId: "", messengerId: "" });
                setShippingMethod("self_pickup");
                setBuyerIsRecipient(false);
              }
            }} id="walkin" />
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
          {!isWalkIn && <>
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
                {customerSearchResults.slice(0, 15).map((c: any) => {
                  // V2.1.17: Build address summary from customer profile
                  const addrParts = [c.address, c.city, c.state, c.postalCode].filter(Boolean);
                  const addressSummary = addrParts.length > 0 ? addrParts.join(", ") : null;
                  return (
                  <button key={c.id} onClick={() => handleCustomerSelect(c)} className="w-full text-left p-2 rounded hover:bg-muted text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{c.name || c.facebookName || c.displayName || "Unknown"}</span>
                        <span className="text-muted-foreground ml-2">{c.phoneNumber || c.customerId || ""}</span>
                      </div>
                      {c.creditBalance && parseFloat(c.creditBalance) > 0 && (
                        <Badge variant="secondary" className="text-xs">Credit: RM {parseFloat(c.creditBalance).toFixed(2)}</Badge>
                      )}
                    </div>
                    {addressSummary && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{addressSummary}</div>
                    )}
                  </button>
                  );
                })}
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

          </>}
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
            {!isWalkIn && <div>
              <Label className="text-xs">{translate("Facebook 名称", "Facebook Name")}</Label>
              <Input value={customerForm.facebookName} onChange={(e) => setCustomerForm({ ...customerForm, facebookName: e.target.value })} />
            </div>}
            {!isWalkIn && <div>
              <Label className="text-xs">{translate("Facebook ID", "Facebook ID")}</Label>
              <Input value={customerForm.facebookId} onChange={(e) => setCustomerForm({ ...customerForm, facebookId: e.target.value })} />
            </div>}
            {!isWalkIn && <div>
              <Label className="text-xs">{translate("Messenger ID", "Messenger ID")}</Label>
              <Input value={customerForm.messengerId} onChange={(e) => setCustomerForm({ ...customerForm, messengerId: e.target.value })} />
            </div>}
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Recipient Info */}
      {!isWalkIn && <Card>
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
      </Card>}

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
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-3 space-y-2">
                {(productSearchResults as any[]).slice(0, 20).map((p: any) => {
                  const outOfStock = (p.stockQuantity ?? 0) <= 0 && !p.allowOversold;
                  return (
                  <div key={p.id} className={`rounded-lg border ${outOfStock ? "bg-muted/30" : "bg-card"}`}>
                    <button
                      disabled={outOfStock}
                      onClick={() => {
                        if (outOfStock) return;
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
                          availableStock: Number(p.stockQuantity ?? 0),
                          allowOversold: Boolean(p.allowOversold),
                          isPot: p.isPot || false,
                          categoryId: p.categoryId,
                        }]);
                        setProductSearchQuery("");
                      }}
                      className={`w-full text-left p-3 rounded-lg text-base flex items-center justify-between gap-3 ${outOfStock ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {(p.coverImageUrl || p.imageUrl) && <img src={p.coverImageUrl || p.imageUrl} alt="" className="w-14 h-14 rounded-md object-cover flex-shrink-0" />}
                        <div>
                          <div className="font-semibold leading-6">{p.name}</div>
                          <div className="text-sm text-muted-foreground">{translate("库存", "Stock")}: <span className={p.stockQuantity <= 0 ? "text-red-500 font-semibold" : "text-green-600 font-semibold"}>{p.stockQuantity ?? 0}</span> {p.keywords && `· ${p.keywords}`}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-lg">RM {p.sellingPrice || p.regularPrice || "0"}</div>
                        {outOfStock && <div className="text-sm text-red-500">{translate("库存不足", "Out of stock")}</div>}
                        {p.wholesalePrice && !outOfStock && <div className="text-sm text-muted-foreground">{translate("批发", "Wholesale")}: RM {p.wholesalePrice}</div>}
                      </div>
                    </button>
                    {outOfStock && (
                      <div className="flex items-center justify-between gap-2 border-t px-2 pb-2 pt-1">
                        <span className="text-xs text-muted-foreground">{translate("补货后即可加入本订单", "Restock before adding to this order")}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setQuickRestockProduct(p);
                            setQuickRestockQuantity("1");
                            setQuickRestockSupplierId("");
                            setQuickRestockRemark("");
                          }}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          {translate("快捷修改库存", "Quick Restock")}
                        </Button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <Dialog open={!!quickRestockProduct} onOpenChange={(open) => {
            if (!open) {
              setQuickRestockProduct(null);
              setQuickRestockQuantity("1");
              setQuickRestockSupplierId("");
              setQuickRestockRemark("");
            }
          }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{translate("快捷修改库存", "Quick Restock")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="font-medium">{quickRestockProduct?.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {translate("当前库存", "Current stock")}: {quickRestockProduct?.stockQuantity ?? 0}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-restock-quantity">{translate("补充数量", "Quantity to add")}</Label>
                  <Input
                    id="quick-restock-quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={quickRestockQuantity}
                    onChange={(event) => setQuickRestockQuantity(event.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    {translate("库存会即时增加，并写入该厂家的采购与库存批次记录。", "Stock increases immediately and is recorded in this supplier's purchase and inventory lot.")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{translate("进货厂家", "Supplier")} <span className="text-destructive">*</span></Label>
                  <Select value={quickRestockSupplierId} onValueChange={setQuickRestockSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder={translate("请选择厂家", "Select supplier")} />
                    </SelectTrigger>
                    <SelectContent>
                      {quickRestockSuppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {quickRestockSuppliers.length === 0 && (
                    <p className="text-xs text-destructive">{translate("尚未建立可用厂家，请先到进货管理新增厂家。", "No active supplier found. Please add one in purchase management first.")}</p>
                  )}
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-sm font-medium">{translate("单位成本", "Unit Cost")}</div>
                  {!quickRestockSupplierId ? (
                    <p className="mt-1 text-sm text-muted-foreground">{translate("选择厂家后，自动带出该厂家此商品最近一次已收货的成本。", "Select a supplier to load this product's most recent received cost from that supplier.")}</p>
                  ) : quickRestockCostQuery.isLoading ? (
                    <p className="mt-1 text-sm text-muted-foreground">{translate("读取历史成本中...", "Loading cost history...")}</p>
                  ) : quickRestockCostQuery.data ? (
                    <div className="mt-1">
                      <p className="text-lg font-semibold text-emerald-700">RM {Number(quickRestockCostQuery.data.unitCost).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{translate("来源", "Source")}: {quickRestockCostQuery.data.poNumber || "-"}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-destructive">{translate("此厂家尚无该商品的已收货成本记录。请先在进货管理建立并收货后再快捷补货。", "This supplier has no received cost record for this product. Create and receive a purchase record first.")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-restock-remark">{translate("备注", "Remark")}</Label>
                  <Textarea
                    id="quick-restock-remark"
                    value={quickRestockRemark}
                    onChange={(event) => setQuickRestockRemark(event.target.value)}
                    placeholder={translate("例如：厂家今日补货、货品批次说明", "e.g. supplier delivery or batch note")}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setQuickRestockProduct(null)} disabled={quickRestockMutation.isPending}>
                  {translate("取消", "Cancel")}
                </Button>
                <Button
                  onClick={() => {
                    const quantity = Math.floor(Number(quickRestockQuantity));
                    if (!quickRestockProduct || !Number.isFinite(quantity) || quantity < 1) {
                      toast.error(translate("请输入大于 0 的补货数量", "Enter a restock quantity greater than 0"));
                      return;
                    }
                    if (!quickRestockSupplierId) {
                      toast.error(translate("请选择进货厂家", "Select a supplier"));
                      return;
                    }
                    if (!quickRestockCostQuery.data) {
                      toast.error(translate("该厂家没有此商品的历史成本，无法建立正确的利润记录", "This supplier has no cost history for this product, so a correct profit record cannot be created"));
                      return;
                    }
                    quickRestockMutation.mutate({
                      productId: quickRestockProduct.id,
                      supplierId: Number(quickRestockSupplierId),
                      quantity,
                      remark: quickRestockRemark.trim() || undefined,
                    });
                  }}
                  disabled={quickRestockMutation.isPending || !quickRestockSupplierId || !quickRestockCostQuery.data}
                >
                  {quickRestockMutation.isPending ? translate("保存中...", "Saving...") : translate("确认补货", "Confirm Restock")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
                        {item.keyword && <span><span className="font-medium">{translate("关键字", "Keyword")}:</span> {item.keyword}</span>}
                      </div>
                      {item.variationName && (
                        <div className="text-xs text-muted-foreground"><span className="font-medium">{translate("规格", "Variant")}:</span> {item.variationName}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">{translate("售价", "Price")}:</span> RM {item.sellingPrice || item.unitPrice}
                        {item.priceType === "special" && <Badge variant="secondary" className="ml-2 h-5 bg-amber-100 text-amber-800">{translate("特价", "Special")}</Badge>}
                        {item.priceType !== "special" && <Badge variant="outline" className="ml-2 h-5">{translate("原价", "Regular")}</Badge>}
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
                    <Input
                      type="number"
                      min="1"
                      className={`h-9 ${item.productType === "physical" && !item.allowOversold && item.availableStock !== undefined && item.quantity > item.availableStock ? "border-destructive text-destructive focus-visible:ring-destructive" : ""}`}
                      value={item.quantity}
                      onChange={(e) => updateManualItem(idx, "quantity", e.target.value === "" ? "" : parseInt(e.target.value) || 0)}
                    />
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
                {item.productType === "physical" && !item.allowOversold && item.availableStock !== undefined && item.quantity > item.availableStock && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {translate("库存不足：可售库存只剩 {stock} 件，当前数量为 {quantity} 件。请调整数量后再提交。", "Insufficient stock: only {stock} unit(s) are available, but the quantity is {quantity}. Adjust it before submitting.", {
                      stock: String(Math.max(0, item.availableStock)),
                      quantity: String(item.quantity),
                    })}
                  </div>
                )}
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
                  <Label className="text-xs">{translate("使用Credit (自动)", "Credit Used (Auto)")}</Label>
                  <Input type="number" value={creditUsed} readOnly disabled className="bg-gray-100 dark:bg-gray-800 cursor-not-allowed" />
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
              <span>{translate("原价商品", "Regular-price Items")}</span>
              <span className="font-medium">RM {regularItemsSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>{translate("特价商品", "Special-price Items")}</span>
              <span className="font-medium text-amber-700">RM {specialItemsSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
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
                <SelectItem value="desired_delivery_date">{translate("发货日期", "Shipping Date")}</SelectItem>
                <SelectItem value="repotting">{translate("换盆", "Repotting")}</SelectItem>
                <SelectItem value="select_tree">{translate("选树身", "Select Tree")}</SelectItem>
                <SelectItem value="other">{translate("其他", "Other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {createRemarkCategory === "desired_delivery_date" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1.5 block">{translate("预约发货日期", "Scheduled Shipping Date")} *</Label>
                <Input type="date" value={createRemarkDeliveryDate} onChange={(e) => setCreateRemarkDeliveryDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">{translate("备注（选填）", "Note (optional)")}</Label>
                <Input
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder={translate("如有特别要求可填写，否则可留空", "Enter if there are special requirements, otherwise leave blank")}
                  className="text-sm"
                />
              </div>
            </div>
          )}
          {createRemarkCategory === "repotting" && (
            <div className="space-y-3">
              <Label className="text-xs">{translate("换盆记录（可添加多组，建单后还可在订单详情继续添加）", "Repotting entries (can add multiple groups, more can be added in order detail after creation)")}</Label>
              {repottingEntries.map((entry, idx) => (
                <div key={idx} className="flex items-end gap-2 p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                  <div className="flex-1">
                    <Label className="text-xs mb-1 block">{translate("植物名称", "Plant Name")}</Label>
                    <Select
                      value={entry.plantName}
                      onValueChange={(v) => {
                        const item = section4Plants.find(i => i.productName === v);
                        setRepottingEntries(prev => prev.map((r, i) => i === idx ? { ...r, plantName: v, plantProductId: item?.productId } : r));
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={translate("选择植物", "Select plant")} /></SelectTrigger>
                      <SelectContent>
                        {section4Plants.length === 0 ? (
                          <SelectItem value="__none" disabled>{translate("区域四无植物类商品", "No plant items in Section 4")}</SelectItem>
                        ) : (
                          section4Plants.map((item, i) => (
                            <SelectItem key={`${item.productId}-${i}`} value={item.productName}>
                              {item.productName}{item.variationName ? ` (${item.variationName})` : ""} {translate("×{qty}", " ×{qty}", { qty: String(item.quantity) })}
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
                              {item.productName}{item.variationName ? ` (${item.variationName})` : ""} {translate("×{qty}", " ×{qty}", { qty: String(item.quantity) })}
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
                      onChange={(e) => setRepottingEntries(prev => prev.map((r, i) => i === idx ? { ...r, quantity: Number(e.target.value) } : r))}
                      className="h-8 text-sm"
                    />
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
              ))}
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
          {(createRemarkCategory === "" || createRemarkCategory === "general" || createRemarkCategory === "other" || createRemarkCategory === "select_tree") && (
            <Textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              placeholder={createRemarkCategory === "select_tree" ? translate("输入选树身要求，例如：要粗身 / 要高身 / 要多分支", "Enter tree selection requirements, e.g. thick trunk / tall / multi-branch") : translate("普通备注，例如：星期五才方便收货 / 送礼不要放价格 / 两张订单一起发", "General remark, e.g. Friday delivery preferred / No price tag for gift")}
            />
          )}
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 pt-4 pb-8">
        <Button variant="outline" onClick={() => window.history.back()}>
          {translate("取消", "Cancel")}
        </Button>
        <Button variant="outline" onClick={() => setPreviewMode(true)} disabled={manualItems.length === 0 || hasStockShortage}>
          <Eye className="h-4 w-4 mr-1" />
          {translate("浏览订单", "Preview Order")}
        </Button>
        <Button onClick={handleCreateOrder} disabled={isSubmitting || manualItems.length === 0 || hasStockShortage} size="lg">
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

      {/* Section 7: Payment Records (local, submitted after order creation) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {translate("区域七：付款记录", "Section 7: Payment Records")}
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setPaymentDialogOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />{translate("新增付款", "Add Payment")}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {localPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{translate("无付款记录，订单创建后可补添加", "No payment records. Can add after order creation.")}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate("金额", "Amount")}</TableHead>
                    <TableHead>{translate("付款方式", "Method")}</TableHead>
                    <TableHead>{translate("单据", "Receipt")}</TableHead>
                    <TableHead>{translate("备注", "Notes")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localPayments.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">RM {parseFloat(p.amount).toFixed(2)}</TableCell>
                      <TableCell>{p.paymentMethodName || "-"}</TableCell>
                      <TableCell>{p.receiptUrl ? <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{translate("查看", "View")}</a> : "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.notes || "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setLocalPayments(prev => prev.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 text-sm text-muted-foreground">
                {translate("已添加付款总额", "Total payments added")}: RM {localPaymentsTotal.toFixed(2)}
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
              <Input value={paymentForm.paymentMethodName} onChange={e => setPaymentForm(prev => ({ ...prev, paymentMethodName: e.target.value }))} placeholder={translate("例如: QR Pay (Tng/Duit Now)", "e.g. QR Pay (Tng/Duit Now)")} />
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
            <Button onClick={handleAddLocalPayment}>
              {translate("保存", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
