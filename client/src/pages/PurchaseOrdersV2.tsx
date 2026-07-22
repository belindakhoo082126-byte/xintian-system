import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Eye, CheckCircle, XCircle, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

export default function PurchaseOrdersV2() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data: orders, isLoading } = trpc.purchaseOrdersV2.list.useQuery({
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const confirmMutation = trpc.purchaseOrdersV2.confirm.useMutation({
    onSuccess: () => { toast.success("进货已确认，FIFO Lot 已建立"); utils.purchaseOrdersV2.list.invalidate(); },
    onError: (e: any) => toast.error(`确认失败: ${e.message}`),
  });

  const cancelMutation = trpc.purchaseOrdersV2.cancel.useMutation({
    onSuccess: () => { toast.success("进货已取消"); utils.purchaseOrdersV2.list.invalidate(); },
    onError: (e: any) => toast.error(`取消失败: ${e.message}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">进货管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理进货记录、FIFO 库存批次与成本</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> 新增进货
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索单号、供应商..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部状态</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="confirmed">已确认</SelectItem>
            <SelectItem value="cancelled">已取消</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>系统进货单号</TableHead>
              <TableHead>供应商单号</TableHead>
              <TableHead>供应商</TableHead>
              <TableHead>进货日期</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">总数量</TableHead>
              <TableHead className="text-right">总金额</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
            ) : !orders?.length ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">暂无进货记录</TableCell></TableRow>
            ) : orders.map((po: any) => (
              <TableRow key={po.id}>
                <TableCell className="font-mono text-sm">{po.purchaseOrderNo || po.poNumber}</TableCell>
                <TableCell>{po.supplierDocumentNo || "-"}</TableCell>
                <TableCell>{po.supplierName || `供应商#${po.supplierId}`}</TableCell>
                <TableCell>{po.purchaseDate ? new Date(po.purchaseDate).toLocaleDateString() : new Date(po.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={po.status === "confirmed" ? "default" : po.status === "draft" ? "secondary" : "destructive"}>
                    {po.status === "confirmed" ? "已确认" : po.status === "draft" ? "草稿" : po.status === "cancelled" ? "已取消" : po.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{po.totalQuantity || "-"}</TableCell>
                <TableCell className="text-right">RM {Number(po.totalAmount).toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDetailId(po.id)} title="查看">
                      <Eye className="h-4 w-4" />
                    </Button>
                    {po.status === "draft" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("确认此进货单？确认后将建立 FIFO Lot 并增加库存，不可修改。")) {
                              confirmMutation.mutate({ id: po.id });
                            }
                          }}
                          title="确认进货"
                          className="text-green-600"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("确定取消此进货单？")) {
                              cancelMutation.mutate({ id: po.id });
                            }
                          }}
                          title="取消"
                          className="text-red-600"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <CreatePurchaseOrderDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />

      {/* Detail Dialog */}
      <PurchaseOrderDetailDialog poId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function CreatePurchaseOrderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const utils = trpc.useUtils();
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierDocumentNo, setSupplierDocumentNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [remark, setRemark] = useState("");
  const [items, setItems] = useState<Array<{
    productId: number;
    productName: string;
    variantId?: number;
    variantName?: string;
    quantity: number;
    unitCost: string;
    subtotal: string;
  }>>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const { data: suppliers } = trpc.suppliersV2.list.useQuery({ activeOnly: true });
  const { data: searchResultsData } = trpc.productsV2.list.useQuery(
    { search: productSearch, limit: 10 },
    { enabled: !!productSearch }
  );
  const searchResults = searchResultsData?.items;

  const createMutation = trpc.purchaseOrdersV2.create.useMutation({
    onSuccess: () => {
      toast.success("进货单已创建（草稿状态）");
      onOpenChange(false);
      resetForm();
      utils.purchaseOrdersV2.list.invalidate();
    },
    onError: (e: any) => toast.error(`创建失败: ${e.message}`),
  });

  function resetForm() {
    setSupplierId(null);
    setSupplierDocumentNo("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setRemark("");
    setItems([]);
    setProductSearch("");
  }

  function addProduct(p: any) {
    const existing = items.find((i) => i.productId === p.id && !i.variantId);
    if (existing) {
      toast.error("此商品已添加");
      return;
    }
    setItems([...items, {
      productId: p.id,
      productName: p.name,
      variantId: undefined,
      variantName: undefined,
      quantity: 1,
      unitCost: p.estimatedCost || p.cost || "0",
      subtotal: p.estimatedCost || p.cost || "0",
    }]);
    setShowProductSearch(false);
    setProductSearch("");
  }

  function addProductWithVariant(p: any, v: any) {
    const existing = items.find((i) => i.productId === p.id && i.variantId === v.id);
    if (existing) {
      toast.error("此规格已添加");
      return;
    }
    setItems([...items, {
      productId: p.id,
      productName: p.name,
      variantId: v.id,
      variantName: v.variantName || `${v.colorName || ""} ${v.sizeName || ""}`.trim(),
      quantity: 1,
      unitCost: v.estimatedCost || "0",
      subtotal: v.estimatedCost || "0",
    }]);
    setShowProductSearch(false);
    setProductSearch("");
  }

  function updateItem(index: number, field: "quantity" | "unitCost", value: string) {
    const newItems = [...items];
    const num = parseFloat(value) || 0;
    if (field === "quantity") {
      newItems[index].quantity = Math.max(1, Math.floor(num));
    } else {
      newItems[index].unitCost = value;
    }
    newItems[index].subtotal = (newItems[index].quantity * parseFloat(newItems[index].unitCost || "0")).toFixed(2);
    setItems(newItems);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.subtotal || "0"), 0);

  function handleSubmit() {
    if (!supplierId) { toast.error("请选择供应商"); return; }
    if (!items.length) { toast.error("请添加至少一个商品"); return; }
    createMutation.mutate({
      supplierId,
      supplierDocumentNo: supplierDocumentNo || undefined,
      purchaseDate: new Date(purchaseDate).getTime(),
      remark: remark || undefined,
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
        unitCost: i.unitCost,
        subtotal: i.subtotal,
      })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增进货</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Header info */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>供应商 *</Label>
              <Select value={supplierId?.toString()} onValueChange={(v) => setSupplierId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="选择供应商" /></SelectTrigger>
                <SelectContent>
                  {suppliers?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>供应商单号</Label>
              <Input value={supplierDocumentNo} onChange={(e) => setSupplierDocumentNo(e.target.value)} placeholder="可选" />
            </div>
            <div>
              <Label>进货日期 *</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>备注</Label>
            <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} placeholder="可选" />
          </div>

          {/* Items section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">商品明细</h3>
              <Button variant="outline" size="sm" onClick={() => setShowProductSearch(!showProductSearch)}>
                <Plus className="h-4 w-4 mr-1" /> 添加商品
              </Button>
            </div>

            {showProductSearch && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <Input
                  placeholder="搜索商品名称或 SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  autoFocus
                />
                {searchResults && searchResults.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {searchResults.map((p: any) => (
                      <div key={p.id} className="border rounded p-2 hover:bg-accent cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{p.name}</span>
                            {p.sku && <span className="text-xs text-muted-foreground ml-2">SKU: {p.sku}</span>}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => addProduct(p)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {p.variants && p.variants.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.variants.map((v: any) => (
                              <Badge
                                key={v.id}
                                variant="outline"
                                className="cursor-pointer hover:bg-accent"
                                onClick={() => addProductWithVariant(p, v)}
                              >
                                {v.variantName || `${v.colorName || ""} ${v.sizeName || ""}`.trim() || `#${v.id}`}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>商品</TableHead>
                    <TableHead>规格</TableHead>
                    <TableHead className="w-24">数量</TableHead>
                    <TableHead className="w-32">单位成本</TableHead>
                    <TableHead className="text-right">小计</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!items.length ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      请添加商品
                    </TableCell></TableRow>
                  ) : items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.variantName || "-"}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(i, "quantity", e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) => updateItem(i, "unitCost", e.target.value)}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">RM {parseFloat(item.subtotal || "0").toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Summary */}
            <div className="flex justify-end gap-6 text-sm">
              <div><span className="text-muted-foreground">商品种类：</span>{items.length}</div>
              <div><span className="text-muted-foreground">总数量：</span>{totalQuantity}</div>
              <div className="text-base font-bold"><span className="text-muted-foreground">总金额：</span>RM {totalAmount.toFixed(2)}</div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>取消</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            保存草稿
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseOrderDetailDialog({ poId, onClose }: { poId: number | null; onClose: () => void }) {
  const { data: po, isLoading } = trpc.purchaseOrdersV2.getById.useQuery(
    { id: poId! },
    { enabled: !!poId }
  );

  if (!poId) return null;

  return (
    <Dialog open={!!poId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>进货单详情</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">加载中...</div>
        ) : po ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">系统单号：</span>{(po as any).purchaseOrderNo || po.poNumber}</div>
              <div><span className="text-muted-foreground">供应商单号：</span>{(po as any).supplierDocumentNo || "-"}</div>
              <div><span className="text-muted-foreground">进货日期：</span>{(po as any).purchaseDate ? new Date((po as any).purchaseDate).toLocaleDateString() : new Date(po.createdAt).toLocaleDateString()}</div>
              <div><span className="text-muted-foreground">状态：</span>
                <Badge variant={po.status === "confirmed" ? "default" : po.status === "draft" ? "secondary" : "destructive"}>
                  {po.status === "confirmed" ? "已确认" : po.status === "draft" ? "草稿" : "已取消"}
                </Badge>
              </div>
              <div><span className="text-muted-foreground">确认人：</span>{(po as any).confirmedBy || "-"}</div>
              <div><span className="text-muted-foreground">确认时间：</span>{(po as any).confirmedAt ? new Date((po as any).confirmedAt).toLocaleString() : "-"}</div>
              {(po as any).remark && <div className="col-span-2"><span className="text-muted-foreground">备注：</span>{(po as any).remark}</div>}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">商品明细</h3>
              <Card className="p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品ID</TableHead>
                      <TableHead>规格ID</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">单位成本</TableHead>
                      <TableHead className="text-right">小计</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!(po as any).items?.length ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">无明细</TableCell></TableRow>
                    ) : (po as any).items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>#{item.productId}</TableCell>
                        <TableCell>{item.variantId ? `#${item.variantId}` : "-"}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">RM {Number(item.unitCost).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">RM {Number(item.subtotal).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>

            <div className="flex justify-end gap-6 text-sm">
              <div><span className="text-muted-foreground">总数量：</span>{(po as any).totalQuantity || "-"}</div>
              <div className="text-base font-bold"><span className="text-muted-foreground">总金额：</span>RM {Number(po.totalAmount).toFixed(2)}</div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
