import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Plus, Trash2, Pause, Play, XCircle, Copy, MessageSquare,
  Package, DollarSign, ShoppingCart, Boxes, ChevronUp, ChevronDown,
  Search, Eye, Users, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

const productStatusLabels: Record<string, string> = {
  active: "正常",
  paused: "暂停捉单",
  sold_out: "已售完",
};

const productStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  sold_out: "bg-red-100 text-red-700",
};

export default function LiveRoomDetail(props: any) {
  const roomId = props.roomId ?? (props.match?.params?.id ? parseInt(props.match.params.id) : 0);
  const onBack = props.onBack ?? (() => window.history.back());
  const queryClient = trpc.useUtils();
  const roomQuery = trpc.liveRooms.getById.useQuery({ id: roomId });
  const productsQuery = trpc.liveRooms.getProducts.useQuery({ liveRoomId: roomId });
  const statsQuery = trpc.liveRooms.getStats.useQuery({ liveRoomId: roomId });
  const allProductsQuery = trpc.products.list.useQuery({});
  const liveOrdersQuery = trpc.liveRooms.getOrders.useQuery({ liveRoomId: roomId, limit: 50 });

  const room = roomQuery.data as any;
  const liveProducts = (productsQuery.data || []) as any[];
  const stats = (statsQuery.data || {}) as any;
  const allProducts = ((allProductsQuery.data as any)?.items || (allProductsQuery.data as any) || []) as any[];
  const liveOrders = (liveOrdersQuery.data || []) as any[];

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockProductId, setStockProductId] = useState<number | null>(null);
  const [stockForm, setStockForm] = useState({ quantityChange: 0, reason: "other" });
  const [searchKeyword, setSearchKeyword] = useState("");
  const [newProduct, setNewProduct] = useState({
    productId: "",
    variationId: "",
    keyword: "",
    displayName: "",
    price: "",
    stock: 0,
  });

  const addProductMutation = trpc.liveRooms.addProduct.useMutation({
    onSuccess: () => {
      toast.success("商品已加入直播");
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getStats.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getStatsBatch.invalidate();
      setAddDialogOpen(false);
      setNewProduct({ productId: "", variationId: "", keyword: "", displayName: "", price: "", stock: 0 });
    },
    onError: (e: any) => toast.error("加入失败: " + e.message),
  });

  const updateProductMutation = trpc.liveRooms.updateProduct.useMutation({
    onSuccess: () => {
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getStats.invalidate({ liveRoomId: roomId });
    },
    onError: (e: any) => toast.error("操作失败: " + e.message),
  });

  const deleteProductMutation = trpc.liveRooms.deleteProduct.useMutation({
    onSuccess: () => {
      toast.success("已移除");
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getStats.invalidate({ liveRoomId: roomId });
    },
    onError: (e: any) => toast.error("移除失败: " + e.message),
  });

  const adjustStockMutation = trpc.liveRooms.adjustProductStock.useMutation({
    onSuccess: (data: any) => {
      toast.success(`库存已调整，当前库存: ${data.newStock}`);
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
      setStockDialogOpen(false);
      setStockForm({ quantityChange: 0, reason: "other" });
    },
    onError: (e: any) => toast.error("调整失败: " + e.message),
  });

  const reorderMutation = trpc.liveRooms.reorderProducts.useMutation({
    onSuccess: () => {
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
    },
  });

  const copyKeywordMutation = trpc.liveRooms.copyKeyword.useQuery(
    { liveRoomProductId: stockProductId || 0 },
    { enabled: false }
  );

  async function handleCopyKeyword(productId: number) {
    try {
      const result = await queryClient.liveRooms.copyKeyword.fetch({ liveRoomProductId: productId });
      if (result) {
        await navigator.clipboard.writeText(result);
        toast.success("关键词文案已复制到剪贴板");
      }
    } catch (e: any) {
      toast.error("复制失败: " + e.message);
    }
  }

  function handleAddProduct() {
    if (!newProduct.productId || !newProduct.keyword || !newProduct.displayName || !newProduct.price) {
      toast.error("请填写完整信息");
      return;
    }
    addProductMutation.mutate({
      liveRoomId: roomId,
      productId: Number(newProduct.productId),
      variationId: newProduct.variationId ? Number(newProduct.variationId) : undefined,
      keyword: newProduct.keyword,
      displayName: newProduct.displayName,
      price: newProduct.price,
      stock: Number(newProduct.stock),
    });
  }

  function handleStatusChange(id: number, status: "active" | "paused" | "sold_out") {
    updateProductMutation.mutate({ id, status });
  }

  function handleReorder(index: number, direction: "up" | "down") {
    const ordered = [...liveProducts];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
    reorderMutation.mutate({
      liveRoomId: roomId,
      orderedIds: ordered.map((p: any) => p.id),
    });
  }

  function openStockDialog(productId: number) {
    setStockProductId(productId);
    setStockForm({ quantityChange: 0, reason: "other" });
    setStockDialogOpen(true);
  }

  // Filter available products (not already in this live room)
  const availableProducts = (allProducts || []).filter((p: any) => {
    if (!searchKeyword) return true;
    return (p.name || "").toLowerCase().includes(searchKeyword.toLowerCase()) ||
           (p.sku || "").toLowerCase().includes(searchKeyword.toLowerCase());
  });

  if (roomQuery.isLoading) {
    return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  }

  if (!room) {
    return <div className="p-8 text-center text-muted-foreground">直播房间不存在</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{room.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {room.liveType === "import_preorder" ? (
                <Badge className="bg-purple-100 text-purple-700">中国代购</Badge>
              ) : (
                <Badge variant="secondary">本地直播</Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {room.liveDate ? new Date(room.liveDate).toLocaleDateString("zh-CN") : "-"}
              </span>
              {room.facebookLiveUrl && (
                <a href={room.facebookLiveUrl} target="_blank" rel="noopener noreferrer"
                   className="text-blue-600 hover:underline text-sm">
                  Facebook Live Link
                </a>
              )}
            </div>
          </div>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          加入商品
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Package className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">商品数量</p>
              <p className="text-xl font-bold">{stats.productCount || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <ShoppingCart className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">喊单订单数</p>
              <p className="text-xl font-bold">{stats.orderCount || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Boxes className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">喊单商品数量</p>
              <p className="text-xl font-bold">{stats.totalItems || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-sm text-muted-foreground">喊单业绩</p>
              <p className="text-xl font-bold">RM{(Number(stats.totalRevenue) || 0).toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content: left products grid + right orders panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Products grid */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">直播商品</h2>
            <span className="text-sm text-muted-foreground">{liveProducts.length} 个商品</span>
          </div>

          {liveProducts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>暂无直播商品，点击右上角「加入商品」添加</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {liveProducts.map((p: any, index: number) => (
                <Card key={p.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Product image */}
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.displayName} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p.displayName}</p>
                            <p className="text-sm text-muted-foreground">RM{Number(p.price).toFixed(0)} · 关键词: {p.keyword}</p>
                          </div>
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${productStatusColors[p.status] || ""}`}>
                            {productStatusLabels[p.status] || p.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          <span className="text-muted-foreground">库存: <span className={`font-medium ${p.stock <= 0 ? "text-red-600" : ""}`}>{p.stock}</span></span>
                          <span className="text-muted-foreground">已喊单: <span className="font-medium text-blue-600">{p.orderedCount}</span></span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t">
                      {p.status === "active" && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleStatusChange(p.id, "paused")}>
                          <Pause className="h-3 w-3" /> 暂停
                        </Button>
                      )}
                      {p.status === "paused" && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleStatusChange(p.id, "active")}>
                          <Play className="h-3 w-3" /> 恢复
                        </Button>
                      )}
                      {p.status !== "sold_out" && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-red-600" onClick={() => handleStatusChange(p.id, "sold_out")}>
                          <XCircle className="h-3 w-3" /> 售完
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openStockDialog(p.id)}>
                        <Package className="h-3 w-3" /> 库存
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleCopyKeyword(p.id)}>
                        <Copy className="h-3 w-3" /> 复制
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                        const newKeyword = prompt("输入新关键词:", p.keyword);
                        if (newKeyword && newKeyword !== p.keyword) {
                          updateProductMutation.mutate({ id: p.id, keyword: newKeyword });
                          toast.success("关键词已更新");
                        }
                      }}>
                        <Search className="h-3 w-3" /> 关键词
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleReorder(index, "up")} disabled={index === 0}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleReorder(index, "down")} disabled={index === liveProducts.length - 1}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive" onClick={() => {
                        if (confirm("确认移除此商品？")) deleteProductMutation.mutate({ id: p.id });
                      }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right: Live orders panel */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            直播订单
            {liveOrders.length > 0 && (
              <Badge variant="secondary" className="text-xs">{liveOrders.length}</Badge>
            )}
          </h2>
          {liveOrdersQuery.isLoading ? (
            <Card><CardContent className="p-4 text-center text-muted-foreground">加载中...</CardContent></Card>
          ) : liveOrders.length === 0 ? (
            <Card>
              <CardContent className="p-4">
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">暂无直播订单</p>
                  <p className="text-xs mt-1">客户在 Facebook 直播留言后，捉单订单会即时出现在这里</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {liveOrders.map((order: any, idx: number) => (
                <Card key={idx} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{order.customerName || order.facebookName || '未知客户'}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.captureTime ? new Date(order.captureTime).toLocaleTimeString('zh-CN') : ''}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-green-600 flex-shrink-0">
                        RM{Number(order.totalAmount || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {(order.items || []).map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs text-muted-foreground">
                          <span className="truncate">{item.productName} x{item.quantity}</span>
                          <span className="flex-shrink-0">RM{Number(item.subtotal || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    {order.captureMessage && (
                      <p className="text-xs text-muted-foreground mt-2 pt-2 border-t italic">
                        "{order.captureMessage}"
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Product Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>加入直播商品</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>搜索商品</Label>
              <Input
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="输入商品名称或 SKU..."
                className="mb-2"
              />
              <Select
                value={newProduct.productId}
                onValueChange={(v) => {
                  const selected = availableProducts.find((p: any) => String(p.id) === v);
                  setNewProduct({
                    ...newProduct,
                    productId: v,
                    displayName: selected?.name || "",
                    price: selected ? String(selected.basePrice || selected.sellingPrice || "") : "",
                    stock: selected ? Number(selected.stock || 0) : 0,
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="选择商品" /></SelectTrigger>
                <SelectContent>
                  {availableProducts.slice(0, 50).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} {p.sku ? `(${p.sku})` : ""} — RM{Number(p.basePrice || p.sellingPrice || 0).toFixed(0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>关键词 *</Label>
                <Input value={newProduct.keyword} onChange={e => setNewProduct({ ...newProduct, keyword: e.target.value })} placeholder="例如: PRR" />
              </div>
              <div>
                <Label>显示名称 *</Label>
                <Input value={newProduct.displayName} onChange={e => setNewProduct({ ...newProduct, displayName: e.target.value })} placeholder="商品名称" />
              </div>
              <div>
                <Label>售价 *</Label>
                <Input type="number" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="RM" />
              </div>
              <div>
                <Label>库存</Label>
                <Input type="number" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddProduct} disabled={addProductMutation.isPending}>加入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>调整库存</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>数量变化（正数增加，负数减少）</Label>
              <Input
                type="number"
                value={stockForm.quantityChange}
                onChange={e => setStockForm({ ...stockForm, quantityChange: Number(e.target.value) })}
              />
            </div>
            {stockForm.quantityChange < 0 && (
              <div>
                <Label>减少原因</Label>
                <Select value={stockForm.reason} onValueChange={v => setStockForm({ ...stockForm, reason: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plant_death">死亡</SelectItem>
                    <SelectItem value="human_damage">损坏</SelectItem>
                    <SelectItem value="quality_issue">展示品</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialogOpen(false)}>取消</Button>
            <Button
              onClick={() => stockProductId && adjustStockMutation.mutate({ id: stockProductId, ...stockForm })}
              disabled={adjustStockMutation.isPending || stockForm.quantityChange === 0}
            >
              确认调整
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
