import { useState } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Eye, Truck, Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useSearch } from "wouter";

const PHYSICAL_STATUS = {
  pending: { label: "待付款", enLabel: "Pending Payment", variant: "outline" },
  receipt_uploaded: { label: "待审核付款凭证", enLabel: "Pending Payment Verification", variant: "secondary" },
  partial_payment: { label: "部分付款", enLabel: "Partial Payment", variant: "secondary" },
  hold_order: { label: "保留订单", enLabel: "Hold Order", variant: "outline" },
  packing: { label: "待包货", enLabel: "Pending Packing", variant: "default" },
  partial_shipped: { label: "部分发货", enLabel: "Partial Shipped", variant: "secondary" },
  shipped: { label: "已发货", enLabel: "Shipped", variant: "default" },
  completed: { label: "已完成", enLabel: "Completed", variant: "default" },
  cancelled: { label: "已取消", enLabel: "Cancelled", variant: "destructive" },
} as const;

interface ManualOrderItem {
  productId: number | undefined;
  productName: string;
  productType: "physical" | "membership" | "gift";
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export default function Orders() {
  const { translate, lang } = useI18n();
  const searchParams = useSearch();
  const urlStatus = new URLSearchParams(searchParams).get("status");
  const urlToday = new URLSearchParams(searchParams).get("today");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(urlStatus || "all");
  const [todayOnly, setTodayOnly] = useState(urlToday === "1");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [shipForm, setShipForm] = useState({ courierCompany: "", trackingNumber: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [manualItems, setManualItems] = useState<ManualOrderItem[]>([]);
  const [customerForm, setCustomerForm] = useState({
    facebookName: "", facebookId: "", messengerId: "",
    name: "", phoneNumber: "", address: "", shippingMethod: "west_malaysia",
  });
  const utils = trpc.useUtils();

  const { data: products } = trpc.products.list.useQuery({});

  const { data: orders, isLoading } = trpc.orders.list.useQuery({
    search: search || undefined,
    physicalStatus: statusFilter !== "all" ? statusFilter : undefined,
    todayOnly: todayOnly || undefined,
  });

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
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
        })),
        shippingAddress: customerForm.address || undefined,
        shippingMethod: customerForm.shippingMethod || undefined,
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
    },
    onError: (e) => toast.error(translate("订单创建失败: {message}", "Order creation failed: {message}", { message: e.message })),
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
    const product = products?.find((p: any) => p.id === parseInt(productId));
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
      };
    }));
  }

  function handleCreateOrder() {
    if (manualItems.length === 0 || manualItems.every(i => i.productId === undefined)) {
      toast.error(translate("请至少添加一个商品", "Please add at least one product"));
      return;
    }
    if (!customerForm.name.trim() && !customerForm.facebookName.trim()) {
      toast.error(translate("请输入客户名称或 Facebook 名称", "Please enter customer name or Facebook name"));
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

  function openDetail(order: any) {
    setDetailOrder(order);
    setDetailOpen(true);
  }

  function handleShip() {
    if (!detailOrder) return;
    if (!shipForm.courierCompany || !shipForm.trackingNumber) {
      toast.error(translate("请填写快递公司和追踪号码", "Please fill in courier company and tracking number"));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("订单管理", "Order Management")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{translate("实体商品订单处理", "Physical product order processing")}</p>
        </div>
        <Button onClick={() => { setManualItems([]); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />{translate("手动建单", "Create Manual Order")}
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={translate("搜索订单号或客户名...", "Search order number or customer name...")}
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
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate("订单号", "Order No.")}</TableHead>
                <TableHead>{translate("客户", "Customer")}</TableHead>
                <TableHead>{translate("类型", "Type")}</TableHead>
                <TableHead>{translate("来源", "Source")}</TableHead>
                <TableHead>{translate("性质", "Nature")}</TableHead>
                <TableHead>{translate("实体金额", "Physical Amount")}</TableHead>
                <TableHead>{translate("运费", "Shipping Fee")}</TableHead>
                <TableHead>{translate("总金额", "Total Amount")}</TableHead>
                <TableHead>{translate("状态", "Status")}</TableHead>
                <TableHead className="text-right">{translate("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
              ) : orders?.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">{translate("暂无订单", "No orders yet")}</TableCell></TableRow>
              ) : orders?.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                  <TableCell>{o.facebookName || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {o.orderType === "mixed" ? translate("混合", "Mixed") : o.orderType === "membership" ? translate("会员", "Membership") : translate("实体", "Physical")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {(o as any).orderSource === "admin" ? translate("Admin", "Admin") :
                       (o as any).orderSource === "facebook_live" ? translate("直播", "Live") :
                       (o as any).orderSource === "messenger" ? translate("Messenger", "Messenger") :
                       (o as any).orderSource === "mall" ? translate("商城", "Mall") : translate("-", "-")}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(o as any).orderNature === "import_preorder" ? (
                      <Badge className="bg-purple-100 text-purple-700">{translate("中国代购", "Import")}</Badge>
                    ) : (
                      <Badge variant="secondary">{translate("普通", "Normal")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>RM {o.physicalSubtotal}</TableCell>
                  <TableCell>RM {o.shippingFee}</TableCell>
                  <TableCell className="font-semibold">RM {o.totalAmount}</TableCell>
                  <TableCell>
                    <Badge variant={PHYSICAL_STATUS[o.physicalStatus as keyof typeof PHYSICAL_STATUS]?.variant || "outline"}>
                      {translate(PHYSICAL_STATUS[o.physicalStatus as keyof typeof PHYSICAL_STATUS]?.label || o.physicalStatus, PHYSICAL_STATUS[o.physicalStatus as keyof typeof PHYSICAL_STATUS]?.enLabel || o.physicalStatus)}
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
            <DialogTitle>{translate("订单详情", "Order Details")} - {detailOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{translate("客户名称", "Customer Name")}</p>
                  <p className="font-medium">{detailOrder.facebookName || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("订单类型", "Order Type")}</p>
                  <p className="font-medium">{detailOrder.orderType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("实体商品金额", "Physical Product Amount")}</p>
                  <p className="font-medium">RM {detailOrder.physicalSubtotal}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("会员费金额", "Membership Fee Amount")}</p>
                  <p className="font-medium">RM {detailOrder.membershipSubtotal}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("运费", "Shipping Fee")}</p>
                  <p className="font-medium">RM {detailOrder.shippingFee}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("订单总金额", "Total Order Amount")}</p>
                  <p className="font-bold text-lg">RM {detailOrder.totalAmount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("实体订单状态", "Physical Order Status")}</p>
                  <Badge variant={PHYSICAL_STATUS[detailOrder.physicalStatus as keyof typeof PHYSICAL_STATUS]?.variant || "outline"}>
                    {translate(PHYSICAL_STATUS[detailOrder.physicalStatus as keyof typeof PHYSICAL_STATUS]?.label || detailOrder.physicalStatus, PHYSICAL_STATUS[detailOrder.physicalStatus as keyof typeof PHYSICAL_STATUS]?.enLabel || detailOrder.physicalStatus)}
                  </Badge>
                </div>
                {detailOrder.courierCompany && (
                  <div>
                    <p className="text-muted-foreground">{translate("快递公司", "Courier Company")}</p>
                    <p className="font-medium">{detailOrder.courierCompany}</p>
                  </div>
                )}
                {detailOrder.trackingNumber && (
                  <div>
                    <p className="text-muted-foreground">{translate("追踪号码", "Tracking Number")}</p>
                    <p className="font-mono text-sm">{detailOrder.trackingNumber}</p>
                  </div>
                )}
                {detailOrder.receiptUrl && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground mb-2">{translate("付款凭证", "Payment Receipt")}</p>
                    <a href={detailOrder.receiptUrl} target="_blank" rel="noreferrer" className="inline-block rounded-lg border bg-muted/30 p-1 transition-opacity hover:opacity-80">
                      <img src={detailOrder.receiptUrl} alt={translate("付款凭证", "Payment Receipt")} className="h-32 w-48 rounded object-cover" />
                    </a>
                    <a href={detailOrder.receiptUrl} target="_blank" rel="noreferrer" className="ml-3 text-sm text-primary underline underline-offset-4">{translate("查看原图", "View Original")}</a>
                  </div>
                )}
              </div>

              {/* Status actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {(detailOrder.physicalStatus === "pending" || detailOrder.physicalStatus === "receipt_uploaded") && (
                  <Button size="sm"
                    onClick={() => {
                      updateStatusMutation.mutate({ id: detailOrder.id, physicalStatus: "packing" });
                      setDetailOpen(false);
                    }}>
                    {translate("确认收款并转交包货", "Confirm Payment & Transfer to Packing")}
                  </Button>
                )}
                {detailOrder.physicalStatus === "receipt_uploaded" && (
                  <Button size="sm" variant="outline"
                    onClick={() => {
                      updateStatusMutation.mutate({ id: detailOrder.id, physicalStatus: "pending" });
                      setDetailOpen(false);
                    }}>
                    {translate("驳回付款凭证", "Reject Payment Receipt")}
                  </Button>
                )}
                {detailOrder.physicalStatus === "packing" && (
                  <div className="w-full space-y-3">
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
                {detailOrder.physicalStatus === "shipped" && (
                  <Button size="sm" variant="outline"
                    onClick={() => {
                      updateStatusMutation.mutate({ id: detailOrder.id, physicalStatus: "completed" });
                      setDetailOpen(false);
                    }}>
                    {translate("标记完成", "Mark as Completed")}
                  </Button>
                )}
                {detailOrder.physicalStatus !== "completed" && detailOrder.physicalStatus !== "cancelled" && (
                  <Button size="sm" variant="destructive"
                    onClick={() => {
                      if (confirm(translate("确定取消此订单？", "Are you sure you want to cancel this order?"))) {
                        updateStatusMutation.mutate({ id: detailOrder.id, physicalStatus: "cancelled" });
                        setDetailOpen(false);
                      }
                    }}>
                    {translate("取消订单", "Cancel Order")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual order creation dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate("手动建立订单", "Create Manual Order")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Customer info */}
            <div className="space-y-3 p-4 border rounded-lg">
              <h3 className="font-medium text-sm">{translate("客户信息", "Customer Information")}</h3>
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
                    <SelectTrigger className="h-8"><SelectValue placeholder={translate("选择运送方式", "Select Shipping Method")} /></SelectTrigger>
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
                        {products?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
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
    </div>
  );
}
