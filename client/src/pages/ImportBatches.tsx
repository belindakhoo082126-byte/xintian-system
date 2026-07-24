import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Plane, Package, Calculator, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  in_progress: "进行中",
  closed: "已截止",
  purchased: "已采购",
  preparing: "备货中",
  in_transit: "运输中",
  partial_arrived: "部分到货",
  all_arrived: "全部到货",
  completed: "完成",
};

const statusColors: Record<string, string> = {
  in_progress: "bg-blue-100 text-blue-700",
  closed: "bg-orange-100 text-orange-700",
  purchased: "bg-purple-100 text-purple-700",
  preparing: "bg-yellow-100 text-yellow-700",
  in_transit: "bg-cyan-100 text-cyan-700",
  partial_arrived: "bg-amber-100 text-amber-700",
  all_arrived: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
};

const itemStatusLabels: Record<string, string> = {
  pending: "待到货",
  all_arrived: "全部到货",
  partial_arrived: "部分到货",
  shortage: "数量不足",
  damaged: "损坏",
  dead: "死亡",
  missing: "遗漏",
};

export default function ImportBatches() {
  const queryClient = trpc.useUtils();
  const batchesQuery = trpc.importBatches.list.useQuery({});
  const batches = batchesQuery.data as any[] | undefined;

  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    batchNumber: "",
    batchName: "",
    sourceCountry: "中国",
    supplierName: "",
    liveRoomId: "",
    preorderStartDate: "",
    preorderEndDate: "",
    shippingMethod: "air" as "air" | "sea",
    chinaShippingCost: "0",
    status: "in_progress" as string,
    notes: "",
  });

  const liveRoomsQuery = trpc.liveRooms.list.useQuery({});
  const liveRooms = liveRoomsQuery.data as any[] | undefined;

  const batchItemsQuery = trpc.importBatches.items.useQuery(
    { batchId: selectedBatchId! },
    { enabled: !!selectedBatchId }
  );
  const batchItems = batchItemsQuery.data as any[] | undefined;

  const createMutation = trpc.importBatches.create.useMutation({
    onSuccess: () => {
      toast.success("采购批次创建成功");
      queryClient.importBatches.list.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error("创建失败: " + e.message),
  });

  const updateMutation = trpc.importBatches.update.useMutation({
    onSuccess: () => {
      toast.success("采购批次更新成功");
      queryClient.importBatches.list.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error("更新失败: " + e.message),
  });

  const deleteMutation = trpc.importBatches.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      queryClient.importBatches.list.invalidate();
      setSelectedBatchId(null);
    },
    onError: (e: any) => toast.error("删除失败: " + e.message),
  });

  const allocateMutation = trpc.importBatches.allocateShipping.useMutation({
    onSuccess: (data: any) => {
      toast.success(`运费分摊完成: 每盆 RM${data.allocated?.toFixed(2)}`);
      queryClient.importBatches.items.invalidate();
    },
    onError: (e: any) => toast.error("分摊失败: " + e.message),
  });

  const upsertItemMutation = trpc.importBatches.upsertItem.useMutation({
    onSuccess: () => {
      toast.success("商品明细已更新");
      queryClient.importBatches.items.invalidate();
    },
    onError: (e: any) => toast.error("更新失败: " + e.message),
  });

  function resetForm() {
    setFormData({
      batchNumber: "", batchName: "", sourceCountry: "中国", supplierName: "",
      liveRoomId: "", preorderStartDate: "", preorderEndDate: "",
      shippingMethod: "air", chinaShippingCost: "0", status: "in_progress", notes: "",
    });
    setEditingId(null);
  }

  function openEdit(batch: any) {
    setEditingId(batch.id);
    setFormData({
      batchNumber: batch.batchNumber || "",
      batchName: batch.batchName || "",
      sourceCountry: batch.sourceCountry || "中国",
      supplierName: batch.supplierName || "",
      liveRoomId: batch.liveRoomId ? String(batch.liveRoomId) : "",
      preorderStartDate: batch.preorderStartDate ? new Date(batch.preorderStartDate).toISOString().slice(0, 16) : "",
      preorderEndDate: batch.preorderEndDate ? new Date(batch.preorderEndDate).toISOString().slice(0, 16) : "",
      shippingMethod: batch.shippingMethod || "air",
      chinaShippingCost: batch.chinaShippingCost?.toString() || "0",
      status: batch.status || "in_progress",
      notes: batch.notes || "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!formData.batchNumber || !formData.batchName) {
      toast.error("请填写批次编号和名称");
      return;
    }
    const payload: any = {
      batchNumber: formData.batchNumber,
      batchName: formData.batchName,
      sourceCountry: formData.sourceCountry,
      supplierName: formData.supplierName || undefined,
      liveRoomId: formData.liveRoomId ? Number(formData.liveRoomId) : undefined,
      preorderStartDate: formData.preorderStartDate ? new Date(formData.preorderStartDate) : undefined,
      preorderEndDate: formData.preorderEndDate ? new Date(formData.preorderEndDate) : undefined,
      shippingMethod: formData.shippingMethod,
      chinaShippingCost: formData.chinaShippingCost,
      status: formData.status,
      notes: formData.notes || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">采购批次管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理中国进口代购采购批次，含采购汇总、到货验收、运输费用分摊</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <Plus className="h-4 w-4" />
              新建采购批次
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "编辑采购批次" : "新建采购批次"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <Label>批次编号 *</Label>
                <Input value={formData.batchNumber} onChange={e => setFormData({ ...formData, batchNumber: e.target.value })} placeholder="例如: CN-2026-08-01" disabled={!!editingId} />
              </div>
              <div>
                <Label>批次名称 *</Label>
                <Input value={formData.batchName} onChange={e => setFormData({ ...formData, batchName: e.target.value })} placeholder="例如: 8月中国代购" />
              </div>
              <div>
                <Label>来源国家</Label>
                <Input value={formData.sourceCountry} onChange={e => setFormData({ ...formData, sourceCountry: e.target.value })} />
              </div>
              <div>
                <Label>供应商名称</Label>
                <Input value={formData.supplierName} onChange={e => setFormData({ ...formData, supplierName: e.target.value })} />
              </div>
              <div>
                <Label>关联直播房间</Label>
                <Select value={formData.liveRoomId} onValueChange={v => setFormData({ ...formData, liveRoomId: v })}>
                  <SelectTrigger><SelectValue placeholder="选择直播" /></SelectTrigger>
                  <SelectContent>
                    {(liveRooms || []).map((r: any) => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                    )) as any}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>运输方式</Label>
                <Select value={formData.shippingMethod} onValueChange={v => setFormData({ ...formData, shippingMethod: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="air">空运</SelectItem>
                    <SelectItem value="sea">海运</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>代购开始日期</Label>
                <Input type="datetime-local" value={formData.preorderStartDate} onChange={e => setFormData({ ...formData, preorderStartDate: e.target.value })} />
              </div>
              <div>
                <Label>代购截止日期</Label>
                <Input type="datetime-local" value={formData.preorderEndDate} onChange={e => setFormData({ ...formData, preorderEndDate: e.target.value })} />
              </div>
              <div>
                <Label>中国运输费用 (RM)</Label>
                <Input type="number" value={formData.chinaShippingCost} onChange={e => setFormData({ ...formData, chinaShippingCost: e.target.value })} />
              </div>
              <div>
                <Label>状态</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    )) as any}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>备注</Label>
                <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">批次列表</TabsTrigger>
          {selectedBatchId && <TabsTrigger value="detail">批次详情</TabsTrigger>}
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              {batchesQuery.isLoading ? (
                <div className="p-8 text-center text-muted-foreground">加载中...</div>
              ) : !batches || batches.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Plane className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>暂无采购批次，点击右上角创建</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>批次编号</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>运输方式</TableHead>
                      <TableHead>中国运费</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch: any) => (
                      <TableRow key={batch.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedBatchId(batch.id)}>
                        <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                        <TableCell>{batch.batchName}</TableCell>
                        <TableCell>{batch.shippingMethod === "air" ? "空运" : "海运"}</TableCell>
                        <TableCell>RM {batch.chinaShippingCost?.toString() || "0"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[batch.status] || ""}`}>
                            {statusLabels[batch.status] || batch.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedBatchId(batch.id)} className="h-8 gap-1">
                            <Package className="h-4 w-4" /> 详情
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(batch)} className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { if (confirm("确认删除？")) deleteMutation.mutate({ id: batch.id }); }} className="h-8 w-8 p-0 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {selectedBatchId && (
          <TabsContent value="detail">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">批次商品明细</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => allocateMutation.mutate({ batchId: selectedBatchId })}
                    disabled={allocateMutation.isPending}
                    className="gap-2"
                  >
                    <Calculator className="h-4 w-4" />
                    分摊运费
                  </Button>
                </div>
              </div>

              <Card>
                <CardContent className="p-0">
                  {batchItemsQuery.isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">加载中...</div>
                  ) : !batchItems || batchItems.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>暂无商品明细，代购截止后系统将自动汇总已付款商品</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>商品名称</TableHead>
                          <TableHead>已付款数量</TableHead>
                          <TableHead>最终采购量</TableHead>
                          <TableHead>实际到货</TableHead>
                          <TableHead>健康</TableHead>
                          <TableHead>损坏</TableHead>
                          <TableHead>死亡</TableHead>
                          <TableHead>遗漏</TableHead>
                          <TableHead>单位成本</TableHead>
                          <TableHead>分摊运费</TableHead>
                          <TableHead>总成本</TableHead>
                          <TableHead>状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batchItems.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell>{item.paidQuantity}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="h-8 w-16"
                                value={item.finalPurchaseQuantity}
                                onChange={(e) => upsertItemMutation.mutate({
                                  batchId: selectedBatchId,
                                  productId: item.productId,
                                  productName: item.productName,
                                  finalPurchaseQuantity: Number(e.target.value),
                                })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="h-8 w-16"
                                placeholder="-"
                                defaultValue={item.actualReceivedQty ?? ""}
                                onBlur={(e) => {
                                  if (e.target.value !== "") {
                                    upsertItemMutation.mutate({
                                      batchId: selectedBatchId,
                                      productId: item.productId,
                                      productName: item.productName,
                                      actualReceivedQty: Number(e.target.value),
                                    });
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="h-8 w-14" placeholder="-" defaultValue={item.healthyQty ?? ""}
                                onBlur={(e) => { if (e.target.value !== "") upsertItemMutation.mutate({ batchId: selectedBatchId, productId: item.productId, productName: item.productName, healthyQty: Number(e.target.value) }); }} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="h-8 w-14" placeholder="0" defaultValue={item.damagedQty ?? 0}
                                onBlur={(e) => upsertItemMutation.mutate({ batchId: selectedBatchId, productId: item.productId, productName: item.productName, damagedQty: Number(e.target.value) })} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="h-8 w-14" placeholder="0" defaultValue={item.deadQty ?? 0}
                                onBlur={(e) => upsertItemMutation.mutate({ batchId: selectedBatchId, productId: item.productId, productName: item.productName, deadQty: Number(e.target.value) })} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="h-8 w-14" placeholder="0" defaultValue={item.missingQty ?? 0}
                                onBlur={(e) => upsertItemMutation.mutate({ batchId: selectedBatchId, productId: item.productId, productName: item.productName, missingQty: Number(e.target.value) })} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" step="0.01" className="h-8 w-20" placeholder="0.00" defaultValue={item.unitPurchaseCost ?? ""}
                                onBlur={(e) => { if (e.target.value !== "") upsertItemMutation.mutate({ batchId: selectedBatchId, productId: item.productId, productName: item.productName, unitPurchaseCost: e.target.value }); }} />
                            </TableCell>
                            <TableCell className="text-sm">{item.allocatedShippingCost ? `RM ${item.allocatedShippingCost}` : "-"}</TableCell>
                            <TableCell className="text-sm font-medium">{item.totalUnitCost ? `RM ${item.totalUnitCost}` : "-"}</TableCell>
                            <TableCell>
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                item.itemStatus === "all_arrived" ? "bg-green-100 text-green-700" :
                                item.itemStatus === "pending" ? "bg-gray-100 text-gray-600" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {itemStatusLabels[item.itemStatus] || item.itemStatus}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
