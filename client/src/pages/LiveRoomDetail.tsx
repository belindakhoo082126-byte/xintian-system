import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft, Plus, Trash2, Pause, Play, XCircle, Copy, MessageSquare,
  Package, DollarSign, ShoppingCart, Boxes, ChevronUp, ChevronDown,
  Search, Eye, Users, AlertCircle, Video, BarChart3, Send,
  CheckCircle2, Clock, TrendingUp, ShoppingBag, User, Mail, Phone,
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

const roomStatusLabels: Record<string, string> = {
  scheduled: "未开始",
  preparing: "准备中",
  live: "直播中",
  ended: "已结束",
  closed: "已截止",
};

const roomStatusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  preparing: "bg-purple-100 text-purple-700",
  live: "bg-green-100 text-green-700",
  ended: "bg-gray-100 text-gray-600",
  closed: "bg-orange-100 text-orange-700",
};

const matchResultLabels: Record<string, string> = {
  matched: "已捉单",
  no_match: "未匹配",
  paused: "商品暂停",
  sold_out: "已售完",
  preorder: "预购",
  duplicate: "重复留言",
  ignored: "已忽略",
  ai_replied: "AI回复",
};

const matchResultColors: Record<string, string> = {
  matched: "bg-green-100 text-green-700",
  no_match: "bg-gray-100 text-gray-600",
  paused: "bg-yellow-100 text-yellow-700",
  sold_out: "bg-red-100 text-red-700",
  preorder: "bg-blue-100 text-blue-700",
  duplicate: "bg-orange-100 text-orange-700",
  ignored: "bg-gray-100 text-gray-500",
  ai_replied: "bg-purple-100 text-purple-700",
};

const messengerStatusLabels: Record<string, string> = {
  pending: "待发送",
  sent: "已发送",
  failed: "发送失败",
  not_needed: "无需发送",
  manually_handled: "已手动处理",
};

export default function LiveRoomDetail(props: any) {
  const { translate } = useI18n();
  const roomId = props.roomId ?? (props.match?.params?.id ? parseInt(props.match.params.id) : 0);
  const onBack = props.onBack ?? (() => window.history.back());
  const queryClient = trpc.useUtils();

  // Queries
  const roomQuery = trpc.liveRooms.getById.useQuery({ id: roomId });
  const productsQuery = trpc.liveRooms.getProducts.useQuery({ liveRoomId: roomId });
  const statsQuery = trpc.liveRooms.getStats.useQuery({ liveRoomId: roomId });
  const liveOrdersQuery = trpc.liveRooms.getOrders.useQuery({ liveRoomId: roomId, limit: 50 });
  const commentsQuery = trpc.liveRooms.getComments.useQuery({
    liveRoomId: roomId,
    search: undefined,
    matchResult: undefined,
    limit: 100,
  });
  const commentStatsQuery = trpc.liveRooms.getCommentStats.useQuery({ liveRoomId: roomId });
  const reportQuery = trpc.liveRooms.getReport.useQuery({ liveRoomId: roomId });

  const room = roomQuery.data as any;
  const liveProducts = (productsQuery.data || []) as any[];
  const stats = (statsQuery.data || {}) as any;
  const liveOrders = (liveOrdersQuery.data || []) as any[];
  const comments = (commentsQuery.data || []) as any[];
  const commentStats = (commentStatsQuery.data || {}) as any;
  const report = (reportQuery.data || {}) as any;

  // State
  const [activeTab, setActiveTab] = useState("products");
  const [videoCollapsed, setVideoCollapsed] = useState(false);
  const [videoClosed, setVideoClosed] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockProductId, setStockProductId] = useState<number | null>(null);
  const [stockForm, setStockForm] = useState({ quantityChange: 0, reason: "other" });
  const [searchKeyword, setSearchKeyword] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [commentSearch, setCommentSearch] = useState("");
  const [commentFilter, setCommentFilter] = useState("all");
  const [messengerFilter, setMessengerFilter] = useState("all");
  const [selectedComment, setSelectedComment] = useState<any | null>(null);

  const [endLiveConfirmOpen, setEndLiveConfirmOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    productId: "",
    variationId: "",
    keyword: "",
    displayName: "",
    price: "",
    stock: 0,
  });

  // Product search for batch add
  const productSearchResults = trpc.liveRooms.searchProducts.useQuery(
    { liveRoomId: roomId, query: productSearchQuery },
    { enabled: productSearchQuery.length > 0 }
  );

  // Customer search (for comment customer panel)
  const [customerSearchName, setCustomerSearchName] = useState("");
  const customerSearchResults = trpc.customers.list.useQuery(
    { search: customerSearchName },
    { enabled: customerSearchName.length > 0 }
  );

  // Mutations
  const addProductMutation = trpc.liveRooms.addProduct.useMutation({
    onSuccess: () => {
      toast.success("商品已加入直播");
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getStats.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getStatsBatch.invalidate();
      setAddDialogOpen(false);
      setNewProduct({ productId: "", variationId: "", keyword: "", displayName: "", price: "", stock: 0 });
      setProductSearchQuery("");
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
      toast.success(`库存已调整，当前库存: ${data.startStock}`);
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

  const togglePreorderMutation = trpc.liveRooms.togglePreorder.useMutation({
    onSuccess: () => {
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
      toast.success("预购设置已更新");
    },
    onError: (e: any) => toast.error("操作失败: " + e.message),
  });

  const updateRoomMutation = trpc.liveRooms.update.useMutation({
    onSuccess: () => {
      queryClient.liveRooms.getById.invalidate({ id: roomId });
      queryClient.liveRooms.list.invalidate();
      toast.success("直播状态已更新");
    },
    onError: (e: any) => toast.error("操作失败: " + e.message),
  });

  const endLiveMutation = trpc.liveRooms.endLive.useMutation({
    onSuccess: () => {
      queryClient.liveRooms.getById.invalidate({ id: roomId });
      queryClient.liveRooms.list.invalidate();
      queryClient.liveRooms.getStats.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getReport.invalidate({ liveRoomId: roomId });
      setEndLiveConfirmOpen(false);
      toast.success("直播已结束，捉单已停止");
    },
    onError: (e: any) => toast.error("操作失败: " + e.message),
  });

  const markCommentHandledMutation = trpc.liveRooms.markCommentHandled.useMutation({
    onSuccess: () => {
      queryClient.liveRooms.getComments.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getCommentStats.invalidate({ liveRoomId: roomId });
      toast.success("留言已标记为已处理");
    },
    onError: (e: any) => toast.error("操作失败: " + e.message),
  });

  // Filtered comments
  const filteredComments = useMemo(() => {
    if (!comments) return [];
    let result = comments;
    if (commentSearch) {
      const lower = commentSearch.toLowerCase();
      result = result.filter((c: any) =>
        (c.commenterName || "").toLowerCase().includes(lower) ||
        (c.commentMessage || "").toLowerCase().includes(lower) ||
        (c.parsedKeyword || "").toLowerCase().includes(lower) ||
        (c.orderNumber || "").toLowerCase().includes(lower) ||
        (c.matchedProductName || "").toLowerCase().includes(lower)
      );
    }
    if (commentFilter !== "all" && commentFilter !== "messenger_failed") {
      result = result.filter((c: any) => c.matchResult === commentFilter);
    }
    if (commentFilter === "messenger_failed") {
      result = result.filter((c: any) => c.messengerStatus === "failed");
    }
    if (messengerFilter !== "all") {
      result = result.filter((c: any) => c.messengerStatus === messengerFilter);
    }
    return result;
  }, [comments, commentSearch, commentFilter, messengerFilter]);

  // Comment stats derived
  const commentStatsMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (commentStats?.matchResultStats) {
      for (const s of commentStats.matchResultStats) {
        map[s.matchResult] = Number(s.count);
      }
    }
    return map;
  }, [commentStats]);

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

  function handleSearchAndAddProduct() {
    // Use searchProducts API result to select a product
    if (productSearchResults.data && productSearchResults.data.length > 0) {
      const p = productSearchResults.data[0];
      setNewProduct({
        ...newProduct,
        productId: String(p.id),
        displayName: p.name,
        price: String(p.sellingPrice || ""),
        stock: Number(p.stockQuantity || 0),
        keyword: p.keyword || "",
      });
    }
  }

  function openCommentCustomer(comment: any) {
    setSelectedComment(comment);
    setCustomerSearchName("");
    // Auto-search customer by name
    if (comment.commenterName) {
      setCustomerSearchName(comment.commenterName);
    }
  }

  if (roomQuery.isLoading) {
    return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  }

  if (!room) {
    return <div className="p-8 text-center text-muted-foreground">直播房间不存在</div>;
  }

  const isLive = room.status === "live";
  const isEnded = room.status === "ended" || room.status === "closed";

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
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${roomStatusColors[room.status] || ""}`}>
                {roomStatusLabels[room.status] || room.status}
              </span>
              <span className="text-sm text-muted-foreground">
                {room.liveDate ? new Date(room.liveDate).toLocaleDateString("zh-CN") : "-"}
              </span>
              {room.streamerName && (
                <span className="text-sm text-muted-foreground">主播: {room.streamerName}</span>
              )}
              {room.estimatedStartTime && (
                <span className="text-sm text-muted-foreground">预计开始: {room.estimatedStartTime}</span>
              )}
              {room.facebookLiveUrl && (
                <a href={room.facebookLiveUrl} target="_blank" rel="noopener noreferrer"
                   className="text-blue-600 hover:underline text-sm">
                  Facebook Live Link
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isLive && !isEnded && (
            <Button
              variant="default"
              className="gap-2"
              onClick={() => updateRoomMutation.mutate({ id: roomId, status: "live" })}
              disabled={updateRoomMutation.isPending}
            >
              <Play className="h-4 w-4" />
              开始直播
            </Button>
          )}
          {isLive && (
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => setEndLiveConfirmOpen(true)}
            >
              <XCircle className="h-4 w-4" />
              结束直播
            </Button>
          )}
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            加入商品
          </Button>
        </div>
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

      {/* Collapsible Facebook Video Player */}
      {room.facebookVideoId && !videoClosed && (
        <Collapsible open={!videoCollapsed} onOpenChange={(open) => setVideoCollapsed(!open)}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    直播画面
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={(e) => { e.stopPropagation(); setVideoClosed(true); }}>
                      <XCircle className="h-4 w-4" />
                      关闭
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 gap-1">
                      {videoCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                      {videoCollapsed ? "展开" : "收起"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {videoError ? (
                  <div className="w-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mb-2 text-orange-500" />
                    <p className="text-sm">直播画面加载失败，捉单功能不受影响</p>
                    <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => setVideoError(false)}>
                      <Video className="h-3 w-3" /> 重试
                    </Button>
                  </div>
                ) : (
                  <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                    <iframe
                      src={`https://www.facebook.com/plugins/video.php?height=476&href=https://www.facebook.com/facebook/videos/${room.facebookVideoId}&show_text=false&width=560&t=0`}
                      className="absolute top-0 left-0 w-full h-full rounded-lg border-0"
                      scrolling="no"
                      frameBorder="0"
                      allowFullScreen
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      onError={() => setVideoError(true)}
                    />
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
      {room.facebookVideoId && videoClosed && (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { setVideoClosed(false); setVideoError(false); }}>
          <Video className="h-4 w-4" />
          显示直播画面
        </Button>
      )}

      {/* Main Tabs: Products / Comments / Orders / Report */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products" className="gap-1">
            <Package className="h-4 w-4" />
            商品管理
          </TabsTrigger>
          <TabsTrigger value="comments" className="gap-1">
            <MessageSquare className="h-4 w-4" />
            实时留言
            {commentStatsMap["matched"] > 0 && (
              <Badge variant="secondary" className="text-xs ml-1">{commentStatsMap["matched"]}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1">
            <ShoppingCart className="h-4 w-4" />
            直播订单
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            直播报告
          </TabsTrigger>
        </TabsList>

        {/* Tab: Products Management */}
        <TabsContent value="products">
          <div className="space-y-3">
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
                          {/* Stock info */}
                          <div className="flex items-center gap-3 mt-2 text-sm">
                            <span className="text-muted-foreground">
                              开始: <span className="font-medium">{p.startStock ?? p.stock ?? 0}</span>
                            </span>
                            <span className="text-muted-foreground">
                              可售: <span className={`font-medium ${(p.availableStock ?? p.stock ?? 0) <= 0 ? "text-red-600" : ""}`}>{p.availableStock ?? p.stock ?? 0}</span>
                            </span>
                            <span className="text-muted-foreground">
                              已喊单: <span className="font-medium text-blue-600">{p.orderedCount || 0}</span>
                            </span>
                            {p.allowPreorder && (
                              <span className="text-muted-foreground">
                                预购: <span className="font-medium text-purple-600">{p.preorderCount || 0}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Preorder toggle */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                        <Switch
                          checked={!!p.allowPreorder}
                          onCheckedChange={(checked) => togglePreorderMutation.mutate({ id: p.id, allowPreorder: checked })}
                        />
                        <span className="text-xs text-muted-foreground">允许预购（库存为0时继续捉单）</span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-1 mt-2">
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
        </TabsContent>

        {/* Tab: Live Comments */}
        <TabsContent value="comments">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Comments list (2/3) */}
            <div className="lg:col-span-2 space-y-3">
              {/* Comment stats overview */}
              <div className="grid grid-cols-4 gap-2">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">总留言</p>
                    <p className="text-lg font-bold">{Object.values(commentStatsMap).reduce((a: number, b: any) => a + Number(b), 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">已捉单</p>
                    <p className="text-lg font-bold text-green-600">{commentStatsMap["matched"] || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">未匹配</p>
                    <p className="text-lg font-bold text-gray-500">{commentStatsMap["no_match"] || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">预购</p>
                    <p className="text-lg font-bold text-blue-600">{commentStatsMap["preorder"] || 0}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Search and filter */}
              <div className="flex items-center gap-2">
                <Input
                  value={commentSearch}
                  onChange={(e) => setCommentSearch(e.target.value)}
                  placeholder="搜索留言人、内容、关键词、订单号、商品名..."
                  className="flex-1"
                />
                <Select value={commentFilter} onValueChange={setCommentFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="matched">已捉单</SelectItem>
                    <SelectItem value="no_match">未匹配</SelectItem>
                    <SelectItem value="paused">商品暂停</SelectItem>
                    <SelectItem value="sold_out">已售完</SelectItem>
                    <SelectItem value="preorder">预购</SelectItem>
                    <SelectItem value="duplicate">重复留言</SelectItem>
                    <SelectItem value="ai_replied">AI回复</SelectItem>
                    <SelectItem value="messenger_failed">私聊失败</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={messengerFilter} onValueChange={setMessengerFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">私聊全部</SelectItem>
                    <SelectItem value="sent">已发送</SelectItem>
                    <SelectItem value="failed">发送失败</SelectItem>
                    <SelectItem value="pending">待发送</SelectItem>
                    <SelectItem value="not_needed">无需发送</SelectItem>
                    <SelectItem value="manually_handled">已手动处理</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Comments list */}
              {filteredComments.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>暂无留言记录</p>
                    <p className="text-xs mt-1">客户在 Facebook 直播留言后，留言会实时出现在这里</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredComments.map((c: any) => (
                    <Card key={c.id} className={`overflow-hidden ${c.isHandled ? "opacity-60" : ""}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          {/* Avatar - clickable */}
                          <Avatar
                            className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all flex-shrink-0"
                            onClick={() => openCommentCustomer(c)}
                          >
                            {c.commenterAvatarUrl ? (
                              <AvatarImage src={c.commenterAvatarUrl} alt={c.commenterName} />
                            ) : null}
                            <AvatarFallback className="text-xs">
                              {c.commenterName?.charAt(0)?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            {/* Name + time + match result badge */}
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm truncate cursor-pointer hover:text-primary"
                                 onClick={() => openCommentCustomer(c)}>
                                {c.commenterName || "未知用户"}
                              </p>
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${matchResultColors[c.matchResult] || ""}`}>
                                {matchResultLabels[c.matchResult] || c.matchResult}
                              </span>
                              {c.isHandled && (
                                <Badge variant="outline" className="text-xs">已处理</Badge>
                              )}
                              <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                                {c.commentDate ? new Date(c.commentDate).toLocaleTimeString("zh-CN") :
                                 c.createdAt ? new Date(c.createdAt).toLocaleTimeString("zh-CN") : ""}
                              </span>
                            </div>

                            {/* Comment message */}
                            <p className="text-sm text-foreground break-words">{c.commentMessage}</p>

                            {/* Parsed info */}
                            {(c.parsedKeyword || c.matchedProductName || c.orderNumber) && (
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                {c.parsedKeyword && (
                                  <span>关键词: <code className="bg-muted px-1 rounded">{c.parsedKeyword}</code></span>
                                )}
                                {c.parsedQuantity > 0 && <span>数量: {c.parsedQuantity}</span>}
                                {c.matchedProductName && <span>商品: {c.matchedProductName}</span>}
                                {c.orderNumber && (
                                  <span className="text-blue-600">订单: {c.orderNumber}</span>
                                )}
                              </div>
                            )}

                            {/* Messenger status */}
                            {c.messengerStatus && c.messengerStatus !== "not_needed" && (
                              <div className="flex items-center gap-1 mt-1 text-xs">
                                <Send className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  Messenger: {messengerStatusLabels[c.messengerStatus] || c.messengerStatus}
                                </span>
                                {c.messengerError && (
                                  <span className="text-red-500">({c.messengerError})</span>
                                )}
                              </div>
                            )}

                            {/* AI reply */}
                            {c.aiReplyContent && (
                              <div className="mt-1 p-2 bg-purple-50 dark:bg-purple-950/20 rounded text-xs">
                                <span className="text-purple-600 font-medium">AI回复: </span>
                                <span>{c.aiReplyContent}</span>
                              </div>
                            )}

                            {/* Actions */}
                            {!c.isHandled && (
                              <div className="flex gap-1 mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs gap-1"
                                  onClick={() => markCommentHandledMutation.mutate({ commentId: c.id })}
                                >
                                  <CheckCircle2 className="h-3 w-3" /> 标记已处理
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Customer action panel (1/3) */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                客户信息
              </h3>
              {selectedComment ? (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-12">
                        {selectedComment.commenterAvatarUrl ? (
                          <AvatarImage src={selectedComment.commenterAvatarUrl} alt={selectedComment.commenterName} />
                        ) : null}
                        <AvatarFallback>
                          {selectedComment.commenterName?.charAt(0)?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{selectedComment.commenterName || "未知用户"}</p>
                        {selectedComment.commenterPsid && (
                          <p className="text-xs text-muted-foreground font-mono">PSID: {selectedComment.commenterPsid}</p>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">留言内容</p>
                        <p className="break-words">{selectedComment.commentMessage}</p>
                      </div>
                      {selectedComment.parsedKeyword && (
                        <div>
                          <p className="text-muted-foreground text-xs">解析关键词</p>
                          <p><code className="bg-muted px-1 rounded">{selectedComment.parsedKeyword}</code> ×{selectedComment.parsedQuantity || 1}</p>
                        </div>
                      )}
                      {selectedComment.matchedProductName && (
                        <div>
                          <p className="text-muted-foreground text-xs">匹配商品</p>
                          <p>{selectedComment.matchedProductName}</p>
                        </div>
                      )}
                      {selectedComment.orderNumber && (
                        <div>
                          <p className="text-muted-foreground text-xs">关联订单</p>
                          <p className="text-blue-600 font-medium">{selectedComment.orderNumber}</p>
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      {/* Customer search results */}
                      {customerSearchName && customerSearchResults.data && customerSearchResults.data.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">匹配客户 ({customerSearchResults.data.length})</p>
                          {customerSearchResults.data.slice(0, 3).map((c: any) => (
                            <div key={c.id} className="p-3 border rounded-lg space-y-2 text-sm">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{c.name || c.facebookName || "客户 #" + c.id}</p>
                                <Badge variant="outline" className="text-xs">{c.membershipLevel || "regular"}</Badge>
                              </div>
                              {c.phoneNumber && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{c.phoneNumber}</p>}
                              {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</p>}
                              <div className="flex gap-3 text-xs text-muted-foreground">
                                <span>订单: {c.totalOrders || 0}</span>
                                <span>消费: RM{c.totalSpent || "0"}</span>
                                <span>积分: {c.pointsBalance || 0}</span>
                              </div>
                              {/* Action buttons for found customer */}
                              <div className="flex flex-wrap gap-1 pt-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs gap-1"
                                  onClick={() => {
                                    // Navigate to customer detail page
                                    window.open(`#customers?id=${c.id}`, "_blank");
                                  }}
                                >
                                  <Eye className="h-3 w-3" /> 查看资料
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs gap-1"
                                  onClick={() => {
                                    // Navigate to orders filtered by customer
                                    window.open(`#orders?customer=${c.id}`, "_blank");
                                  }}
                                >
                                  <ShoppingBag className="h-3 w-3" /> 历史订单
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs gap-1"
                                  onClick={() => {
                                    // Navigate to manual order creation
                                    window.open(`#orders?new=1&customer=${c.id}`, "_blank");
                                  }}
                                >
                                  <Plus className="h-3 w-3" /> 帮客下单
                                </Button>
                                {c.messengerId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs gap-1"
                                    onClick={() => {
                                      window.open(`https://m.me/${c.messengerId}`, "_blank");
                                    }}
                                  >
                                    <Send className="h-3 w-3" /> 发Messenger
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {customerSearchName && customerSearchResults.data && customerSearchResults.data.length === 0 && (
                        <div className="p-3 border border-orange-200 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 text-center">
                          <AlertCircle className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                          <p className="text-xs text-muted-foreground">未找到匹配客户，可能为新客户</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1 mt-1"
                            onClick={() => {
                              // Navigate to customer creation
                              window.open(`#customers?new=1&fbName=${encodeURIComponent(selectedComment.commenterName || "")}`, "_blank");
                            }}
                          >
                            <Plus className="h-3 w-3" /> 新建客户
                          </Button>
                        </div>
                      )}
                      <Separator />
                      {/* General actions */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          if (selectedComment.commenterName) {
                            setCustomerSearchName(selectedComment.commenterName);
                          }
                        }}
                      >
                        <Search className="h-3 w-3" />
                        搜索客户
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          if (selectedComment.commenterName) {
                            navigator.clipboard.writeText(selectedComment.commenterName);
                            toast.success("客户名称已复制");
                          }
                        }}
                      >
                        <Copy className="h-3 w-3" />
                        复制名称
                      </Button>
                      {selectedComment.orderNumber && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedComment.orderNumber);
                            toast.success("订单号已复制");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                          复制订单号
                        </Button>
                      )}
                      {!selectedComment.isHandled && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            markCommentHandledMutation.mutate({ commentId: selectedComment.id });
                            setSelectedComment({ ...selectedComment, isHandled: true });
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          标记已处理
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">点击留言头像查看客户信息</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab: Live Orders */}
        <TabsContent value="orders">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {liveOrders.map((order: any, idx: number) => (
                  <Card key={idx} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{order.customerName || order.facebookName || "未知客户"}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.captureTime ? new Date(order.captureTime).toLocaleTimeString("zh-CN") : ""}
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
        </TabsContent>

        {/* Tab: Live Report */}
        <TabsContent value="report">
          <div className="space-y-4">
            {/* Report stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <p className="text-sm text-muted-foreground">总留言数</p>
                  </div>
                  <p className="text-2xl font-bold">{report.totalComments || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-muted-foreground">有效关键词数</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{report.matchedComments || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="h-4 w-4 text-orange-500" />
                    <p className="text-sm text-muted-foreground">捉单数</p>
                  </div>
                  <p className="text-2xl font-bold">{report.captureCount || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                    <p className="text-sm text-muted-foreground">销售额</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">RM{Number(report.totalRevenue || 0).toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Second row: orders + items */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">订单数</p>
                  <p className="text-xl font-bold">{report.totalOrders || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">商品件数</p>
                  <p className="text-xl font-bold">{report.totalItems || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">客单价</p>
                  <p className="text-xl font-bold">{(report.totalOrders > 0) ? `RM${(Number(report.totalRevenue || 0) / report.totalOrders).toFixed(2)}` : "—"}</p>
                </CardContent>
              </Card>
            </div>

            {/* Order status summary */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">已付款</p>
                  <p className="text-xl font-bold text-green-600">{report.paidOrders || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">已取消</p>
                  <p className="text-xl font-bold text-red-600">{report.cancelledOrders || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">已退款</p>
                  <p className="text-xl font-bold text-orange-600">{report.refundedOrders || 0}</p>
                </CardContent>
              </Card>
            </div>

            {/* Messenger stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Messenger 发送统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">已发送</p>
                    <p className="text-xl font-bold text-green-600">{report.messengerSent || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">发送失败</p>
                    <p className="text-xl font-bold text-red-600">{report.messengerFailed || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">成功率</p>
                    <p className="text-xl font-bold">
                      {((report.messengerSent || 0) + (report.messengerFailed || 0)) > 0
                        ? `${Math.round((report.messengerSent / ((report.messengerSent || 0) + (report.messengerFailed || 0))) * 100)}%`
                        : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* New customers */}
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">新客户数（首次在此直播下单）</p>
                  <p className="text-xl font-bold">{report.newCustomers || 0}</p>
                </div>
              </CardContent>
            </Card>

            {/* Product sales ranking */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  热卖商品排行
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(report.productSales && report.productSales.length > 0) ? (
                  <div className="space-y-2">
                    {report.productSales.map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6">#{idx + 1}</span>
                          <div>
                            <p className="font-medium text-sm">{p.productName}</p>
                            <p className="text-xs text-muted-foreground">关键词: {p.keyword}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{p.orderedCount || 0} 件</p>
                          <p className="text-xs text-green-600">RM{Number(p.revenue || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">暂无销售数据</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

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
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder="输入商品名称、SKU 或关键词搜索..."
                className="mb-2"
              />
              {productSearchQuery && productSearchResults.data && productSearchResults.data.length > 0 && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {productSearchResults.data.map((p: any) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                      onClick={() => {
                        setNewProduct({
                          ...newProduct,
                          productId: String(p.id),
                          displayName: p.name,
                          price: String(p.sellingPrice || ""),
                          stock: Number(p.stockQuantity || 0),
                          keyword: p.keyword || "",
                        });
                        setProductSearchQuery("");
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {p.coverImageUrl && (
                          <img src={p.coverImageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {p.sku} · {p.hasVariants ? "有规格" : "无规格"}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-medium">RM{Number(p.sellingPrice || 0).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              )}
              {productSearchQuery && productSearchResults.data && productSearchResults.data.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">未找到匹配的商品</p>
              )}
            </div>
            {newProduct.productId && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <p className="text-sm font-medium">已选择: {newProduct.displayName}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>关键词 *</Label>
                <Input value={newProduct.keyword} onChange={(e) => setNewProduct({ ...newProduct, keyword: e.target.value.toUpperCase().replace(/\s+/g, "") })} placeholder="例如: PRR" />
              </div>
              <div>
                <Label>显示名称 *</Label>
                <Input value={newProduct.displayName} onChange={(e) => setNewProduct({ ...newProduct, displayName: e.target.value })} placeholder="商品名称" />
              </div>
              <div>
                <Label>售价 *</Label>
                <Input type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="RM" />
              </div>
              <div>
                <Label>库存</Label>
                <Input type="number" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })} />
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
                onChange={(e) => setStockForm({ ...stockForm, quantityChange: Number(e.target.value) })}
              />
            </div>
            {stockForm.quantityChange < 0 && (
              <div>
                <Label>减少原因</Label>
                <Select value={stockForm.reason} onValueChange={(v) => setStockForm({ ...stockForm, reason: v })}>
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

      {/* End Live Confirmation Dialog */}
      <Dialog open={endLiveConfirmOpen} onOpenChange={setEndLiveConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认结束直播？</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2 text-sm text-muted-foreground">
            <p>结束直播后将停止捉单，不再自动匹配留言创建订单。</p>
            <p>已创建的订单不受影响，可在订单管理中继续处理。</p>
            <p>结束后可查看完整直播报告。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndLiveConfirmOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={() => endLiveMutation.mutate({ liveRoomId: roomId })} disabled={endLiveMutation.isPending}>
              确认结束
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
