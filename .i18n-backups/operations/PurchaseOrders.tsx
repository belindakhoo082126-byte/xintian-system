import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PackagePlus, Plus, Trash2, CheckCircle } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿", ordered: "已下单", received: "已收货", cancelled: "已取消",
};

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ordered: "bg-blue-100 text-blue-700",
  received: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

interface PoItem {
  productId: number | undefined;
  quantity: number;
  unitCost: string;
  subtotal: string;
}

export default function PurchaseOrders() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PoItem[]>([{ productId: undefined, quantity: 1, unitCost: "0", subtotal: "0" }]);
  const utils = trpc.useUtils();

  const { data: purchaseOrders, isLoading } = trpc.purchaseOrders.list.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery({ activeOnly: true });
  const { data: products } = trpc.products.list.useQuery({});

  const createMutation = trpc.purchaseOrders.create.useMutation({
    onSuccess: (r: any) => {
      utils.purchaseOrders.invalidate();
      utils.products.invalidate();
      toast.success(`进货单创建成功: ${r.poNumber}`);
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(`创建失败: ${e.message}`),
  });

  const receiveMutation = trpc.purchaseOrders.receive.useMutation({
    onSuccess: () => {
      utils.purchaseOrders.invalidate();
      utils.products.invalidate();
      toast.success("进货单已标记为已收货");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  function resetForm() {
    setSelectedSupplier("none");
    setNotes("");
    setItems([{ productId: undefined, quantity: 1, unitCost: "0", subtotal: "0" }]);
  }

  function addItem() {
    setItems([...items, { productId: undefined, quantity: 1, unitCost: "0", subtotal: "0" }]);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof PoItem, value: any) {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    if (field === "quantity" || field === "unitCost") {
      const qty = parseFloat(String(newItems[idx].quantity)) || 0;
      const cost = parseFloat(String(newItems[idx].unitCost)) || 0;
      newItems[idx].subtotal = (qty * cost).toFixed(2);
    }
    setItems(newItems);
  }

  function handleSubmit() {
    if (selectedSupplier === "none") { toast.error("请选择供应商"); return; }
    const validItems = items.filter(i => i.productId !== undefined && i.quantity > 0);
    if (validItems.length === 0) { toast.error("请至少添加一个进货商品"); return; }
    createMutation.mutate({
      supplierId: parseInt(selectedSupplier),
      notes: notes || undefined,
      items: validItems.map(i => ({
        productId: i.productId!,
        quantity: i.quantity,
        unitCost: i.unitCost,
        subtotal: i.subtotal,
      })),
    });
  }

  const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.subtotal || "0"), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">进货管理</h1>
          <p className="text-sm text-muted-foreground mt-1">记录每次进货，不同供应商不同成本</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />新增进货单
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>进货单号</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead>总金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>日期</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : purchaseOrders?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">暂无进货单</TableCell></TableRow>
              ) : purchaseOrders?.map(po => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono text-sm">{po.poNumber}</TableCell>
                  <TableCell>{suppliers?.find(s => s.id === po.supplierId)?.name || `供应商#${po.supplierId}`}</TableCell>
                  <TableCell>RM {po.totalAmount}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGES[po.status]} variant="secondary">
                      {STATUS_LABELS[po.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(po.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {po.status === "ordered" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("确认已收货？库存将自动增加。")) {
                            receiveMutation.mutate({ id: po.id });
                          }
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />确认收货
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增进货单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>选择供应商 *</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger><SelectValue placeholder="选择供应商" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">请选择...</SelectItem>
                  {suppliers?.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>进货商品</Label>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" />添加商品
                </Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-lg">
                  <div className="col-span-5">
                    <Label className="text-xs">商品</Label>
                    <Select
                      value={item.productId?.toString() || "none"}
                      onValueChange={(v) => updateItem(idx, "productId", v === "none" ? undefined : parseInt(v))}
                    >
                      <SelectTrigger className="h-8"><SelectValue placeholder="选择商品" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">请选择...</SelectItem>
                        {products?.filter((p: any) => p.type === "physical").map((p: any) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">数量</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">单价 (RM)</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={item.unitCost}
                      onChange={(e) => updateItem(idx, "unitCost", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">小计</Label>
                    <Input className="h-8" value={`RM ${item.subtotal}`} disabled />
                  </div>
                  <div className="col-span-1">
                    {items.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end font-semibold text-lg">
              总计: RM {totalAmount.toFixed(2)}
            </div>

            <div>
              <Label>备注</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              创建进货单
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
