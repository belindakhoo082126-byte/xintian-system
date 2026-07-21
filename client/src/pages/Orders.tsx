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
import { Search, Eye, Truck, Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const PHYSICAL_STATUS = {
  pending: { label: "挂单", variant: "outline" },
  receipt_uploaded: { label: "已上传单据", variant: "secondary" },
  payment_confirmed: { label: "已确认汇款", variant: "default" },
  packing: { label: "配货中", variant: "default" },
  shipped: { label: "已发货", variant: "default" },
  completed: { label: "已完成", variant: "default" },
  cancelled: { label: "已取消", variant: "destructive" },
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
  });

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      utils.orders.invalidate();
      toast.success("订单状态已更新");
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
      utils.orders.invalidate();
      toast.success(`订单创建成功: ${r.orderNumber}`);
      setCreateOpen(false);
      setManualItems([]);
      setCustomerForm({ facebookName: "", facebookId: "", messengerId: "", name: "", phoneNumber: "", address: "", shippingMethod: "west_malaysia" });
    },
    onError: (e) => toast.error(`订单创建失败: ${e.message}`),
  });

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
      updateManualItem(idx, "unitPrice", product.regularPrice || "0");
      // Recalculate subtotal
      const qty = manualItems[idx].quantity;
      const price = parseFloat(product.regularPrice || "0") || 0;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">订单管理</h1>
          <p className="text-sm text-muted-foreground mt-1">实体商品订单处理</p>
        </div>
        <Button onClick={() => { setManualItems([]); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />手动建单
        </Button>
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

      {/* Manual order creation dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>手动建立订单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Customer info */}
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
                      <SelectItem value="west_malaysia">西马</SelectItem>
                      <SelectItem value="east_malaysia_shopee">东马 Shopee</SelectItem>
                      <SelectItem value="east_malaysia_poslaju">东马 Poslaju</SelectItem>
                      <SelectItem value="self_pickup">自取</SelectItem>
                      <SelectItem value="lalamove">Lalamove</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">收件地址</Label>
                <Textarea value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} rows={2} />
              </div>
            </div>

            {/* Order items */}
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
                    <Input type="number" className="h-8" value={item.quantity} onChange={(e) => updateManualItem(idx, "quantity", parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">单价</Label>
                    <Input type="number" className="h-8" value={item.unitPrice} onChange={(e) => updateManualItem(idx, "unitPrice", e.target.value)} />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">小计</Label>
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
                <p className="text-sm text-muted-foreground text-center py-4">点击「添加商品」开始建立订单</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreateOrder} disabled={findCustomerMutation.isPending || createOrderMutation.isPending}>
              创建订单
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
