import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Package, Plus, Search, Edit, Trash2, Eye, RefreshCw, Scissors,
  PackageOpen, TrendingUp, AlertTriangle, History, X, Save,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";

type BundleItem = {
  productId: number;
  variantId?: number;
  productName: string;
  variantName?: string;
  qtyPerBundle: number;
  unitCost: string;
  unitPrice: string;
};

export default function ProductBundles() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showRestock, setShowRestock] = useState(false);
  const [showDisassemble, setShowDisassemble] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedBundleId, setSelectedBundleId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: bundles, isLoading } = trpc.productBundles.list.useQuery({
    search: search || undefined,
  });

  const { data: selectedBundle } = trpc.productBundles.getById.useQuery(
    { id: selectedBundleId! },
    { enabled: selectedBundleId !== null }
  );

  const { data: stockLogs } = trpc.productBundles.stockLogs.useQuery(
    { bundleId: selectedBundleId! },
    { enabled: selectedBundleId !== null && showLogs }
  );

  const { data: productsData } = trpc.productsV2.list.useQuery({ limit: 200 });
  const products = (productsData as any)?.items || (productsData as any) || [];

  const createMutation = trpc.productBundles.create.useMutation({
    onSuccess: () => {
      toast.success("组合包创建成功");
      utils.productBundles.list.invalidate();
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.productBundles.update.useMutation({
    onSuccess: () => {
      toast.success("组合包更新成功");
      utils.productBundles.list.invalidate();
      setShowEdit(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.productBundles.delete.useMutation({
    onSuccess: () => {
      toast.success("组合包已删除");
      utils.productBundles.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const restockMutation = trpc.productBundles.restock.useMutation({
    onSuccess: () => {
      toast.success("补充组合成功");
      utils.productBundles.list.invalidate();
      utils.productBundles.getById.invalidate();
      setShowRestock(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const disassembleMutation = trpc.productBundles.disassemble.useMutation({
    onSuccess: () => {
      toast.success("拆除组合成功");
      utils.productBundles.list.invalidate();
      utils.productBundles.getById.invalidate();
      setShowDisassemble(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">组合包管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            组合包属于可独立销售的商品，库存来源是现有单品
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          创建组合包
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索组合包名称或关键词..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>组合包名称</TableHead>
                <TableHead>关键词</TableHead>
                <TableHead className="text-right">售价</TableHead>
                <TableHead className="text-right">原价合计</TableHead>
                <TableHead className="text-right">组合库存</TableHead>
                <TableHead className="text-center">商品数</TableHead>
                <TableHead className="text-center">状态</TableHead>
                <TableHead className="text-center">商城</TableHead>
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : !bundles || bundles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    暂无组合包，点击「创建组合包」开始
                  </TableCell>
                </TableRow>
              ) : (
                bundles.map((bundle: any) => (
                  <TableRow key={bundle.id}>
                    <TableCell className="font-medium">{bundle.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{bundle.keyword}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      RM {Number(bundle.sellingPrice).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground line-through">
                      RM {Number(bundle.originalTotalPrice).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={bundle.bundleStock <= 0 ? "text-destructive" : "text-foreground"}>
                        {bundle.bundleStock} 组
                      </span>
                    </TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={bundle.status === "active" ? "default" : "secondary"}>
                        {bundle.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={bundle.showInMall ? "outline" : "secondary"}>
                        {bundle.showInMall ? "显示" : "隐藏"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBundleId(bundle.id);
                            setShowDetail(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBundleId(bundle.id);
                            setShowEdit(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBundleId(bundle.id);
                            setShowRestock(true);
                          }}
                          disabled={bundle.status !== "active"}
                          title="补充组合"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBundleId(bundle.id);
                            setShowDisassemble(true);
                          }}
                          disabled={bundle.bundleStock <= 0}
                          title="拆除组合"
                        >
                          <Scissors className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBundleId(bundle.id);
                            setShowLogs(true);
                          }}
                          title="库存日志"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`确定要删除组合包「${bundle.name}」吗？`)) {
                              deleteMutation.mutate({ id: bundle.id });
                            }
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CreateBundleDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        products={products as any[] || []}
        onCreate={(data) => createMutation.mutate(data)}
        operator={user?.name || "admin"}
        isSubmitting={createMutation.isPending}
      />

      {/* Edit Dialog */}
      <EditBundleDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        bundle={selectedBundle as any}
        onSave={(data) => updateMutation.mutate({ id: selectedBundleId!, ...data })}
        isSubmitting={updateMutation.isPending}
      />

      {/* Restock Dialog */}
      <RestockDialog
        open={showRestock}
        onOpenChange={setShowRestock}
        bundle={selectedBundle as any}
        onConfirm={(qty) => restockMutation.mutate({
          bundleId: selectedBundleId!,
          restockQty: qty,
          operator: user?.name || "admin",
        })}
        isSubmitting={restockMutation.isPending}
      />

      {/* Disassemble Dialog */}
      <DisassembleDialog
        open={showDisassemble}
        onOpenChange={setShowDisassemble}
        bundle={selectedBundle as any}
        onConfirm={(data) => disassembleMutation.mutate({
          bundleId: selectedBundleId!,
          ...data,
          operator: user?.name || "admin",
        })}
        isSubmitting={disassembleMutation.isPending}
      />

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>组合包详情</DialogTitle>
          </DialogHeader>
          {selectedBundle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">组合包名称</Label>
                  <p className="font-medium">{(selectedBundle as any).name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">关键词</Label>
                  <p className="font-medium">{(selectedBundle as any).keyword}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">售价</Label>
                  <p className="font-semibold text-primary">RM {Number((selectedBundle as any).sellingPrice).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">原价合计</Label>
                  <p className="text-muted-foreground line-through">RM {Number((selectedBundle as any).originalTotalPrice).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">组合库存</Label>
                  <p className="font-medium">{(selectedBundle as any).bundleStock} 组</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">总成本</Label>
                  <p className="font-medium">RM {Number((selectedBundle as any).totalCost).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">毛利</Label>
                  <p className="font-medium text-green-600">
                    RM {(Number((selectedBundle as any).sellingPrice) - Number((selectedBundle as any).totalCost)).toFixed(2)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">毛利率</Label>
                  <p className="font-medium">
                    {Number((selectedBundle as any).totalCost) > 0
                      ? ((Number((selectedBundle as any).sellingPrice) - Number((selectedBundle as any).totalCost)) / Number((selectedBundle as any).sellingPrice) * 100).toFixed(1)
                      : '0'}%
                  </p>
                </div>
              </div>
              {selectedBundle && (selectedBundle as any).coverImage && (
                <img
                  src={(selectedBundle as any).coverImage}
                  alt={(selectedBundle as any).name}
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
              {selectedBundle && (selectedBundle as any).description && (
                <div>
                  <Label className="text-muted-foreground">商城说明</Label>
                  <p className="text-sm mt-1">{(selectedBundle as any).description}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">组合商品</Label>
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead className="text-right">每组数量</TableHead>
                      <TableHead className="text-right">单价</TableHead>
                      <TableHead className="text-right">成本</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedBundle && (selectedBundle as any).items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.variantName || "-"}</TableCell>
                        <TableCell className="text-right">{item.qtyPerBundle}</TableCell>
                        <TableCell className="text-right">RM {Number(item.unitPrice).toFixed(2)}</TableCell>
                        <TableCell className="text-right">RM {Number(item.unitCost).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stock Logs Dialog */}
      <Dialog open={showLogs} onOpenChange={setShowLogs}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>库存日志 - {selectedBundle?.name}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>操作类型</TableHead>
                <TableHead className="text-right">数量变化</TableHead>
                <TableHead className="text-right">变更前</TableHead>
                <TableHead className="text-right">变更后</TableHead>
                <TableHead>原因/备注</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!stockLogs || stockLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    暂无库存日志
                  </TableCell>
                </TableRow>
              ) : (
                stockLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant={
                        log.actionType === "create" ? "default" :
                        log.actionType === "restock" ? "secondary" :
                        log.actionType === "disassemble" ? "destructive" :
                        log.actionType === "sell" ? "outline" :
                        "secondary"
                      }>
                        {log.actionType === "create" ? "建立" :
                         log.actionType === "restock" ? "补充" :
                         log.actionType === "disassemble" ? "拆除" :
                         log.actionType === "sell" ? "销售" :
                         "调整"}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${log.qtyChange > 0 ? "text-green-600" : "text-red-600"}`}>
                      {log.qtyChange > 0 ? "+" : ""}{log.qtyChange}
                    </TableCell>
                    <TableCell className="text-right">{log.stockBefore}</TableCell>
                    <TableCell className="text-right">{log.stockAfter}</TableCell>
                    <TableCell className="text-sm">{log.reason || log.notes}</TableCell>
                    <TableCell className="text-sm">{log.operator}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("zh-CN")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Create Bundle Dialog
// ============================================================================
function CreateBundleDialog({
  open, onOpenChange, products, onCreate, operator, isSubmitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: any[];
  onCreate: (data: any) => void;
  operator: string;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [specialPrice, setSpecialPrice] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [description, setDescription] = useState("");
  const [showInMall, setShowInMall] = useState(true);
  const [weight, setWeight] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [items, setItems] = useState<BundleItem[]>([]);
  const [bundleQty, setBundleQty] = useState(1);
  const [addingProduct, setAddingProduct] = useState<number | "">("");

  // Calculate totals
  const originalTotal = useMemo(() =>
    items.reduce((sum, i) => sum + Number(i.unitPrice) * i.qtyPerBundle, 0),
    [items]
  );
  const totalCost = useMemo(() =>
    items.reduce((sum, i) => sum + Number(i.unitCost) * i.qtyPerBundle, 0),
    [items]
  );
  const savings = originalTotal - (Number(sellingPrice) || 0);

  // Max bundle qty calculation (client-side estimate)
  const maxBundleQty = useMemo(() => {
    if (items.length === 0) return 0;
    let max = Infinity;
    for (const item of items) {
      const product = products.find((p: any) => p.id === item.productId);
      const stock = product?.stockQuantity || 0;
      const possible = Math.floor(stock / item.qtyPerBundle);
      if (possible < max) max = possible;
    }
    return max === Infinity ? 0 : max;
  }, [items, products]);

  const handleAddProduct = () => {
    if (addingProduct === "") return;
    const product = products.find((p: any) => p.id === addingProduct);
    if (!product) return;
    setItems([...items, {
      productId: product.id,
      productName: product.name,
      qtyPerBundle: 1,
      unitCost: String(product.currentCost || product.estimatedCost || "0"),
      unitPrice: String(product.sellingPrice || "0"),
    }]);
    setAddingProduct("");
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!name || !keyword || !sellingPrice || items.length === 0) {
      toast.error("请填写组合包名称、关键词、售价并添加至少一个商品");
      return;
    }
    if (bundleQty > maxBundleQty) {
      toast.error(`库存不足，最多只能创建 ${maxBundleQty} 组`);
      return;
    }
    onCreate({
      name, nameEn: nameEn || undefined, keyword,
      sellingPrice, specialPrice: specialPrice || undefined,
      coverImage: coverImage || undefined, description: description || undefined,
      showInMall, weight: weight || "0", internalNotes: internalNotes || undefined,
      items, bundleQty, operator,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>创建组合包</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>组合包名称 *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：J5 营养组合" />
            </div>
            <div>
              <Label>英文名称</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div>
              <Label>下单关键词 *</Label>
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="如：J5C" />
            </div>
            <div>
              <Label>组合售价 *</Label>
              <Input value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="如：45" type="number" />
            </div>
            <div>
              <Label>特价（可选）</Label>
              <Input value={specialPrice} onChange={(e) => setSpecialPrice(e.target.value)} placeholder="如：40" type="number" />
            </div>
            <div>
              <Label>重量 (kg)</Label>
              <Input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="如：2.5" type="number" />
            </div>
            <div>
              <Label>封面图片 URL</Label>
              <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={showInMall} onCheckedChange={setShowInMall} />
              <Label>在商城显示</Label>
            </div>
          </div>
          <div>
            <Label>商城说明</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>内部备注</Label>
            <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} />
          </div>

          {/* Price Summary */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">单品原价合计</p>
                  <p className="text-lg font-semibold">RM {originalTotal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">组合售价</p>
                  <p className="text-lg font-semibold text-primary">RM {Number(sellingPrice || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">客户节省</p>
                  <p className="text-lg font-semibold text-green-600">RM {savings > 0 ? savings.toFixed(2) : "0.00"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">组合总成本</p>
                  <p className="text-lg font-semibold">RM {totalCost.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bundle Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>组合商品</Label>
              <div className="flex items-center gap-2">
                <Select value={String(addingProduct)} onValueChange={(v) => setAddingProduct(Number(v))}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="选择商品" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} (库存: {p.stockQuantity || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAddProduct} disabled={addingProduct === ""}>
                  <Plus className="h-4 w-4 mr-1" /> 添加
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品</TableHead>
                  <TableHead className="text-right">每组数量</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">成本</TableHead>
                  <TableHead className="text-right">可用库存</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      点击「添加」选择商品加入组合包
                    </TableCell>
                  </TableRow>
                ) : items.map((item, idx) => {
                  const product = products.find((p: any) => p.id === item.productId);
                  const stock = product?.stockQuantity || 0;
                  return (
                    <TableRow key={idx}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.qtyPerBundle}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx] = { ...item, qtyPerBundle: Number(e.target.value) };
                            setItems(newItems);
                          }}
                          className="w-20 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">RM {Number(item.unitPrice).toFixed(2)}</TableCell>
                      <TableCell className="text-right">RM {Number(item.unitCost).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{stock}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(idx)} className="text-destructive">
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Bundle Quantity */}
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label>创建组合数量（组）</Label>
                <Input
                  type="number"
                  min={1}
                  max={maxBundleQty}
                  value={bundleQty}
                  onChange={(e) => setBundleQty(Number(e.target.value))}
                />
              </div>
              <div className="pt-6">
                <Badge variant={maxBundleQty > 0 ? "default" : "destructive"}>
                  最多可创建 {maxBundleQty} 组
                </Badge>
              </div>
            </div>
            {items.length > 0 && (
              <p className="text-sm text-muted-foreground">
                建立后将从单品库存扣除对应数量，转入组合包库存
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? "创建中..." : "创建组合包"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Edit Bundle Dialog (metadata only - no items if stock exists)
// ============================================================================
function EditBundleDialog({
  open, onOpenChange, bundle, onSave, isSubmitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bundle: any;
  onSave: (data: any) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [specialPrice, setSpecialPrice] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [description, setDescription] = useState("");
  const [showInMall, setShowInMall] = useState(true);
  const [weight, setWeight] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [status, setStatus] = useState("active");

  useMemo(() => {
    if (bundle) {
      setName(bundle.name || "");
      setNameEn(bundle.nameEn || "");
      setKeyword(bundle.keyword || "");
      setSellingPrice(String(bundle.sellingPrice || ""));
      setSpecialPrice(bundle.specialPrice ? String(bundle.specialPrice) : "");
      setCoverImage(bundle.coverImage || "");
      setDescription(bundle.description || "");
      setShowInMall(bundle.showInMall ?? true);
      setWeight(String(bundle.weight || "0"));
      setInternalNotes(bundle.internalNotes || "");
      setStatus(bundle.status || "active");
    }
  }, [bundle]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑组合包</DialogTitle>
        </DialogHeader>
        {bundle?.bundleStock > 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span>组合包有剩余库存 ({bundle.bundleStock}组)，只能修改基本资料，不能修改组合内容。如需修改内容请先拆除现有库存。</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>组合包名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>英文名称</Label>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div>
            <Label>关键词</Label>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
          <div>
            <Label>组合售价</Label>
            <Input value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} type="number" />
          </div>
          <div>
            <Label>特价（可选）</Label>
            <Input value={specialPrice} onChange={(e) => setSpecialPrice(e.target.value)} type="number" />
          </div>
          <div>
            <Label>重量 (kg)</Label>
            <Input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" />
          </div>
          <div>
            <Label>封面图片 URL</Label>
            <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={showInMall} onCheckedChange={setShowInMall} />
            <Label>在商城显示</Label>
          </div>
          <div>
            <Label>状态</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>商城说明</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div>
          <Label>内部备注</Label>
          <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => onSave({
            name, nameEn: nameEn || undefined, keyword,
            sellingPrice, specialPrice: specialPrice || undefined,
            coverImage: coverImage || undefined, description: description || undefined,
            showInMall, weight, internalNotes: internalNotes || undefined, status,
          })} disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Restock Dialog
// ============================================================================
function RestockDialog({
  open, onOpenChange, bundle, onConfirm, isSubmitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bundle: any;
  onConfirm: (qty: number) => void;
  isSubmitting: boolean;
}) {
  const [qty, setQty] = useState(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>补充组合 - {bundle?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              当前组合库存：<span className="font-medium text-foreground">{bundle?.bundleStock || 0} 组</span>
            </p>
            <Label>补充数量（组）</Label>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            补充后将从单品库存扣除对应数量，转入组合包库存。每次补充都会记录库存日志。
          </div>
          {bundle?.items?.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span>{item.productName} × {item.qtyPerBundle}</span>
              <span className="text-muted-foreground">
                需扣除 {item.qtyPerBundle * qty} 个
              </span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => onConfirm(qty)} disabled={isSubmitting}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {isSubmitting ? "补充中..." : "确认补充"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Disassemble Dialog
// ============================================================================
function DisassembleDialog({
  open, onOpenChange, bundle, onConfirm, isSubmitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bundle: any;
  onConfirm: (data: { disassembleQty: number; reason: string; damagedProducts: number[] }) => void;
  isSubmitting: boolean;
}) {
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [damagedProducts, setDamagedProducts] = useState<number[]>([]);

  const reasons = [
    "改为单品出售",
    "修改组合内容",
    "组合活动结束",
    "商品替换",
    "商品损坏",
    "其他",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>拆除组合 - {bundle?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              当前组合库存：<span className="font-medium text-foreground">{bundle?.bundleStock || 0} 组</span>
            </p>
            <Label>拆除数量（组）</Label>
            <Input
              type="number"
              min={1}
              max={bundle?.bundleStock || 0}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>拆除原因</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="选择原因" /></SelectTrigger>
              <SelectContent>
                {reasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {reason === "商品损坏" && bundle?.items && (
            <div>
              <Label>选择损坏的商品（不退回库存，转入报废）</Label>
              <div className="space-y-2 mt-2">
                {bundle.items.map((item: any) => (
                  <label key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={damagedProducts.includes(item.productId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setDamagedProducts([...damagedProducts, item.productId]);
                        } else {
                          setDamagedProducts(damagedProducts.filter(id => id !== item.productId));
                        }
                      }}
                    />
                    <span className="text-sm">{item.productName}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            拆除后正常商品将退回单品库存。损坏商品将转入报废损耗。
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm({ disassembleQty: qty, reason, damagedProducts })}
            disabled={isSubmitting || !reason}
          >
            <Scissors className="h-4 w-4 mr-2" />
            {isSubmitting ? "拆除中..." : "确认拆除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
