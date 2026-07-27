import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Plus, Trash2, Pause, Play, XCircle, Copy, MessageSquare,
  Package, DollarSign, ShoppingCart, Boxes, ChevronUp, ChevronDown,
  Search, AlertCircle, Video, BarChart3, Send,
  CheckCircle2, TrendingUp, User, Edit, Radio, Layers,
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
  preparing: "准备中",
  live: "直播中",
  ended: "已结束",
  closed: "已截止",
};

const roomStatusColors: Record<string, string> = {
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
  order_merged: "已合单",
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
  order_merged: "bg-teal-100 text-teal-700",
};

export default function LiveRoomDetail(props: any) {
  const roomId = props.roomId ?? (props.match?.params?.id ? parseInt(props.match.params.id) : 0);
  const onBack = props.onBack ?? (() => window.history.back());
  const queryClient = trpc.useUtils();

  // Queries
  const roomQuery = trpc.liveRooms.getById.useQuery({ id: roomId });
  const productsQuery = trpc.liveRooms.getProducts.useQuery({ liveRoomId: roomId });
  const statsQuery = trpc.liveRooms.getStats.useQuery({ liveRoomId: roomId });
  const liveOrdersQuery = trpc.liveRooms.getOrders.useQuery({ liveRoomId: roomId, limit: 100 });
  const ordersByProductQuery = trpc.liveRooms.getOrdersByProduct.useQuery({ liveRoomId: roomId });
  const commentsQuery = trpc.liveRooms.getComments.useQuery({
    liveRoomId: roomId,
    search: undefined,
    matchResult: undefined,
    limit: 200,
  });
  const commentStatsQuery = trpc.liveRooms.getCommentStats.useQuery({ liveRoomId: roomId });
  const reportQuery = trpc.liveRooms.getReport.useQuery({ liveRoomId: roomId });

  const room = roomQuery.data as any;
  const liveProductGroups = (productsQuery.data || []) as any[];
  const stats = (statsQuery.data || {}) as any;
  const liveOrders = (liveOrdersQuery.data || []) as any[];
  const ordersByProduct = (ordersByProductQuery.data || []) as any[];
  const comments = (commentsQuery.data || []) as any[];
  const commentStats = (commentStatsQuery.data || {}) as any;
  const report = (reportQuery.data || {}) as any;

  // State
  const [videoCollapsed, setVideoCollapsed] = useState(false);
  const [videoClosed, setVideoClosed] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockProductId, setStockProductId] = useState<number | null>(null);
  const [stockForm, setStockForm] = useState({ quantityChange: 0, reason: "other" });
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [commentSearch, setCommentSearch] = useState("");
  const [commentFilter, setCommentFilter] = useState("all");
  const [messengerFilter, setMessengerFilter] = useState("all");
  const [orderViewMode, setOrderViewMode] = useState<"byCustomer" | "byProduct">("byCustomer");
  const [batchSelectedIds, setBatchSelectedIds] = useState<number[]>([]);
  const [batchSelectedProducts, setBatchSelectedProducts] = useState<Record<number, any>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [batchAddKeyword, setBatchAddKeyword] = useState("");
  const [batchAddPriceMode, setBatchAddPriceMode] = useState<"original" | "custom">("original");
  const [batchAddPrice, setBatchAddPrice] = useState("");
  const [selectedComment, setSelectedComment] = useState<any | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [endLiveConfirmOpen, setEndLiveConfirmOpen] = useState(false);

  // Product search for batch add
  const productSearchResults = trpc.liveRooms.searchProducts.useQuery(
    { liveRoomId: roomId, query: productSearchQuery, categoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined },
    { enabled: productSearchQuery.length > 0 }
  );
  const categoriesQuery = trpc.categories.list.useQuery({ activeOnly: true });

  // Mutations
  const batchAddMutation = trpc.liveRooms.batchAddProducts.useMutation({
    onSuccess: (data: any) => {
      toast.success(`已批量加入 ${data?.count || 0} 个商品`);
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getStats.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getStatsBatch.invalidate();
      setAddDialogOpen(false);
      setBatchSelectedIds([]);
      setBatchSelectedProducts({});
      setBatchAddKeyword("");
      setProductSearchQuery("");
    },
    onError: (e: any) => toast.error("批量加入失败: " + e.message),
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
      queryClient.liveRooms.getOrders.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getOrdersByProduct.invalidate({ liveRoomId: roomId });
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

  function handleStatusChange(id: number, status: "active" | "paused" | "sold_out") {
    updateProductMutation.mutate({ id, status });
  }

  function openStockDialog(productId: number) {
    setStockProductId(productId);
    setStockForm({ quantityChange: 0, reason: "other" });
    setStockDialogOpen(true);
  }

  function handleBatchSubmit() {
    const items = batchSelectedIds.map(id => {
      const p = batchSelectedProducts[id];
      if (!p) return null;
      const price = batchAddPriceMode === "custom" && batchAddPrice ? Number(batchAddPrice) : Number(p.sellingPrice || 0);
      return {
        productId: p.id,
        keyword: batchAddKeyword || p.keyword || p.name,
        displayName: p.name,
        price,
        stock: Number(p.stockQuantity || 0),
        imageUrl: p.coverImageUrl || undefined,
      };
    }).filter(Boolean);
    if (items.length === 0) {
      toast.error("请选择至少一个商品");
      return;
    }
    batchAddMutation.mutate({ liveRoomId: roomId, items: items as any });
  }

  function toggleBatchSelection(p: any) {
    const id = p.id;
    setBatchSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
    setBatchSelectedProducts(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = p;
      return next;
    });
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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Radio className={`h-5 w-5 ${isLive ? "text-green-600 animate-pulse" : "text-muted-foreground"}`} />
              {room.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {room.liveType === "import_preorder" ? (
                <Badge className="bg-purple-100 text-purple-700 text-xs">中国代购</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">本地直播</Badge>
              )}
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${roomStatusColors[room.status] || ""}`}>
                {roomStatusLabels[room.status] || room.status}
              </span>
              {room.streamerName && (
                <span className="text-xs text-muted-foreground">主播: {room.streamerName}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isLive && !isEnded && (
            <Button variant="default" size="sm" className="gap-2"
              onClick={() => updateRoomMutation.mutate({ id: roomId, status: "live" })}
              disabled={updateRoomMutation.isPending}>
              <Play className="h-4 w-4" /> 开始直播
            </Button>
          )}
          {isLive && (
            <Button variant="destructive" size="sm" className="gap-2"
              onClick={() => setEndLiveConfirmOpen(true)}>
              <XCircle className="h-4 w-4" /> 结束直播
            </Button>
          )}
          {isEnded && (
            <Button variant="outline" size="sm" className="gap-2"
              onClick={() => setShowReport(!showReport)}>
              <BarChart3 className="h-4 w-4" /> {showReport ? "返回控制台" : "查看报告"}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" /> 加入商品
          </Button>
        </div>
      </div>

      {/* Report View (when ended and toggled) */}
      {showReport && isEnded ? (
        <ReportView report={report} />
      ) : (
        <>
          {/* Four-Region Layout: Top = Video + Stats, Bottom = 3-column grid */}
          {/* Region 1: Live Video (collapsible/closable) */}
          {room.facebookVideoId && !videoClosed && (
            <Collapsible open={!videoCollapsed} onOpenChange={(open) => setVideoCollapsed(!open)}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Video className="h-4 w-4" /> 直播画面
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={(e) => { e.stopPropagation(); setVideoClosed(true); }}>
                          <XCircle className="h-3 w-3" /> 关闭
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 text-xs">
                          {videoCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-3">
                    {videoError ? (
                      <div className="w-full flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <AlertCircle className="h-6 w-6 mb-1 text-orange-500" />
                        <p className="text-xs">直播画面加载失败，捉单功能不受影响</p>
                        <Button variant="outline" size="sm" className="mt-1 text-xs gap-1" onClick={() => setVideoError(false)}>
                          <Video className="h-3 w-3" /> 重试
                        </Button>
                      </div>
                    ) : (
                      <div className="relative w-full max-h-[300px]" style={{ paddingBottom: "33.75%" }}>
                        <iframe
                          src={`https://www.facebook.com/plugins/video.php?height=476&href=https://www.facebook.com/facebook/videos/${room.facebookVideoId}&show_text=false&width=560&t=0`}
                          className="absolute top-0 left-0 w-full h-full rounded-lg border-0"
                          scrolling="no" frameBorder="0" allowFullScreen
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
              <Video className="h-4 w-4" /> 显示直播画面
            </Button>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-2">
            <Card className="py-2">
              <CardContent className="flex items-center gap-2 p-2">
                <Package className="h-6 w-6 text-blue-500" />
                <div><p className="text-xs text-muted-foreground">商品</p><p className="text-base font-bold">{stats.productCount || 0}</p></div>
              </CardContent>
            </Card>
            <Card className="py-2">
              <CardContent className="flex items-center gap-2 p-2">
                <ShoppingCart className="h-6 w-6 text-green-500" />
                <div><p className="text-xs text-muted-foreground">订单</p><p className="text-base font-bold">{stats.orderCount || 0}</p></div>
              </CardContent>
            </Card>
            <Card className="py-2">
              <CardContent className="flex items-center gap-2 p-2">
                <Boxes className="h-6 w-6 text-orange-500" />
                <div><p className="text-xs text-muted-foreground">件数</p><p className="text-base font-bold">{stats.totalItems || 0}</p></div>
              </CardContent>
            </Card>
            <Card className="py-2">
              <CardContent className="flex items-center gap-2 p-2">
                <DollarSign className="h-6 w-6 text-emerald-500" />
                <div><p className="text-xs text-muted-foreground">业绩</p><p className="text-base font-bold">RM{(Number(stats.totalRevenue) || 0).toFixed(2)}</p></div>
              </CardContent>
            </Card>
          </div>

          {/* Three-Column Layout: Products | Comments | Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" style={{ minHeight: "500px" }}>
            {/* Region 2: Products Area */}
            <Card className="flex flex-col" style={{ maxHeight: "calc(100vh - 280px)" }}>
              <CardHeader className="pb-2 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" /> 商品区
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">{liveProductGroups.length} 个</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full" style={{ height: "calc(100vh - 320px)" }}>
                  <div className="p-3 space-y-2">
                    {liveProductGroups.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">暂无商品，点击「加入商品」</p>
                      </div>
                    ) : (
                      liveProductGroups.map((group: any) => (
                        <ProductGroupCard
                          key={group.productId}
                          group={group}
                          isLive={isLive}
                          onStatusChange={handleStatusChange}
                          onTogglePreorder={(id: number, val: boolean) => togglePreorderMutation.mutate({ id, allowPreorder: val })}
                          onAdjustStock={openStockDialog}
                          onDelete={(id: number) => deleteProductMutation.mutate({ id })}
                          onCopyKeyword={handleCopyKeyword}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Region 3: Comments Area */}
            <Card className="flex flex-col" style={{ maxHeight: "calc(100vh - 280px)" }}>
              <CardHeader className="pb-2 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> 留言区
                    {commentStatsMap["matched"] > 0 && (
                      <Badge variant="secondary" className="text-xs">{commentStatsMap["matched"]}</Badge>
                    )}
                  </CardTitle>
                </div>
                {/* Search + Filter */}
                <div className="space-y-1.5 mt-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="搜索客户/内容/关键词/商品..."
                      value={commentSearch}
                      onChange={e => setCommentSearch(e.target.value)}
                      className="h-7 text-xs pl-7"
                    />
                  </div>
                  <div className="flex gap-1">
                    <Select value={commentFilter} onValueChange={setCommentFilter}>
                      <SelectTrigger className="h-6 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部状态</SelectItem>
                        <SelectItem value="matched">已捉单</SelectItem>
                        <SelectItem value="no_match">未匹配</SelectItem>
                        <SelectItem value="sold_out">已售完</SelectItem>
                        <SelectItem value="paused">暂停中</SelectItem>
                        <SelectItem value="preorder">预购</SelectItem>
                        <SelectItem value="order_merged">已合单</SelectItem>
                        <SelectItem value="messenger_failed">私聊失败</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full" style={{ height: "calc(100vh - 380px)" }}>
                  <div className="p-2 space-y-1">
                    {filteredComments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">暂无留言</p>
                      </div>
                    ) : (
                      filteredComments.map((comment: any) => (
                        <CommentRow
                          key={comment.id}
                          comment={comment}
                          onClick={() => setSelectedComment(comment)}
                          onMarkHandled={() => markCommentHandledMutation.mutate({ commentId: comment.id })}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Region 4: Orders Area */}
            <Card className="flex flex-col" style={{ maxHeight: "calc(100vh - 280px)" }}>
              <CardHeader className="pb-2 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" /> 订单区
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant={orderViewMode === "byCustomer" ? "default" : "outline"}
                      size="sm" className="h-6 text-xs px-2"
                      onClick={() => setOrderViewMode("byCustomer")}>
                      按客户
                    </Button>
                    <Button
                      variant={orderViewMode === "byProduct" ? "default" : "outline"}
                      size="sm" className="h-6 text-xs px-2"
                      onClick={() => setOrderViewMode("byProduct")}>
                      按商品
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full" style={{ height: "calc(100vh - 320px)" }}>
                  <div className="p-2 space-y-1.5">
                    {orderViewMode === "byCustomer" ? (
                      liveOrders.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-xs">暂无订单</p>
                        </div>
                      ) : (
                        liveOrders.map((order: any) => (
                          <OrderRow key={order.orderId} order={order} />
                        ))
                      )
                    ) : (
                      ordersByProduct.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-xs">暂无商品订单</p>
                        </div>
                      ) : (
                        ordersByProduct.map((item: any, idx: number) => (
                          <ProductOrderRow key={idx} item={item} />
                        ))
                      )
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Add Products Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>加入商品到直播房</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            {/* Search + Category Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索商品名称/SKU/关键词..."
                  value={productSearchQuery}
                  onChange={e => setProductSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="全部分类" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {(categoriesQuery.data || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  )) as any}
                </SelectContent>
              </Select>
            </div>

            {/* Batch settings */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">关键词前缀（可选）</Label>
                <Input
                  placeholder="统一关键词前缀"
                  value={batchAddKeyword}
                  onChange={e => setBatchAddKeyword(e.target.value)}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">价格模式</Label>
                <Select value={batchAddPriceMode} onValueChange={(v) => setBatchAddPriceMode(v as any)}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">原价</SelectItem>
                    <SelectItem value="custom">自定义价</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {batchAddPriceMode === "custom" && (
                <div>
                  <Label className="text-xs">价格</Label>
                  <Input
                    type="number"
                    placeholder="RM"
                    value={batchAddPrice}
                    onChange={e => setBatchAddPrice(e.target.value)}
                    className="h-8 w-24"
                  />
                </div>
              )}
            </div>

            {/* Search results */}
            {productSearchQuery.length > 0 && (
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                {(productSearchResults.data || []).length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">未找到商品</div>
                ) : (
                  (productSearchResults.data || []).map((p: any) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-2 border-b cursor-pointer hover:bg-muted/50 ${batchSelectedIds.includes(p.id) ? "bg-primary/5" : ""}`}
                      onClick={() => toggleBatchSelection(p)}
                    >
                      <input
                        type="checkbox"
                        checked={batchSelectedIds.includes(p.id)}
                        onChange={() => {}}
                        className="h-4 w-4"
                      />
                      {p.coverImageUrl && (
                        <img src={p.coverImageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          SKU: {p.sku || "-"} · 库存: {p.stockQuantity || 0} · {p.hasVariants ? "有规格" : "无规格"}
                        </p>
                      </div>
                      <span className="text-sm font-medium">RM{Number(p.sellingPrice || 0).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Selected products summary */}
            {batchSelectedIds.length > 0 && (
              <div className="text-sm text-muted-foreground">
                已选 {batchSelectedIds.length} 个商品
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>取消</Button>
            <Button onClick={handleBatchSubmit} disabled={batchAddMutation.isPending || batchSelectedIds.length === 0}>
              批量加入 ({batchSelectedIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>调整库存</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label>数量变化（正数增加，负数减少）</Label>
              <Input
                type="number"
                value={stockForm.quantityChange}
                onChange={e => setStockForm({ ...stockForm, quantityChange: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>原因</Label>
              <Select value={stockForm.reason} onValueChange={v => setStockForm({ ...stockForm, reason: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="other">其他</SelectItem>
                  <SelectItem value="damaged">损坏</SelectItem>
                  <SelectItem value="scrap">报废</SelectItem>
                  <SelectItem value="restock">补货</SelectItem>
                  <SelectItem value="correction">库存修正</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialogOpen(false)}>取消</Button>
            <Button
              onClick={() => {
                if (stockProductId && stockForm.quantityChange !== 0) {
                  adjustStockMutation.mutate({ id: stockProductId, quantityChange: stockForm.quantityChange, reason: stockForm.reason });
                }
              }}
              disabled={adjustStockMutation.isPending || stockForm.quantityChange === 0}>
              确认调整
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Live Confirmation */}
      <Dialog open={endLiveConfirmOpen} onOpenChange={setEndLiveConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认结束直播？</DialogTitle>
          </DialogHeader>
          <div className="py-3 text-sm text-muted-foreground">
            结束后将停止捉单，所有订单将自动整理。客户将收到结单通知。
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndLiveConfirmOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={() => endLiveMutation.mutate({ liveRoomId: roomId })} disabled={endLiveMutation.isPending}>
              确认结束
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comment Detail Dialog */}
      {selectedComment && (
        <Dialog open={!!selectedComment} onOpenChange={(open) => !open && setSelectedComment(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>留言详情</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{(selectedComment.commenterName || "?").charAt(0)}</AvatarFallback></Avatar>
                <div>
                  <p className="text-sm font-medium">{selectedComment.commenterName}</p>
                  <p className="text-xs text-muted-foreground">{new Date(selectedComment.createdAt).toLocaleString("zh-CN")}</p>
                </div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-sm">{selectedComment.commentMessage}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">关键词:</span> {selectedComment.parsedKeyword || "-"}</div>
                <div><span className="text-muted-foreground">数量:</span> {selectedComment.parsedQuantity || "-"}</div>
                <div><span className="text-muted-foreground">匹配结果:</span>
                  <span className={`ml-1 inline-flex px-1.5 py-0.5 rounded text-xs ${matchResultColors[selectedComment.matchResult] || ""}`}>
                    {matchResultLabels[selectedComment.matchResult] || selectedComment.matchResult}
                  </span>
                </div>
                <div><span className="text-muted-foreground">商品:</span> {selectedComment.matchedProductName || "-"}</div>
                {selectedComment.orderNumber && (
                  <div className="col-span-2"><span className="text-muted-foreground">订单号:</span> {selectedComment.orderNumber}</div>
                )}
              </div>
            </div>
            <DialogFooter>
              {!selectedComment.isHandled && (
                <Button variant="outline" size="sm" className="gap-1"
                  onClick={() => { markCommentHandledMutation.mutate({ commentId: selectedComment.id }); setSelectedComment(null); }}>
                  <CheckCircle2 className="h-4 w-4" /> 标记已处理
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedComment(null)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============ Sub Components ============

function ProductGroupCard({ group, isLive, onStatusChange, onTogglePreorder, onAdjustStock, onDelete, onCopyKeyword }: any) {
  const variations = group.variations || [];
  const hasMultiple = variations.length > 1;
  const totalOrdered = variations.reduce((sum: number, v: any) => sum + (v.orderedCount || 0), 0);
  const totalAvailable = variations.reduce((sum: number, v: any) => sum + (v.availableStock || 0), 0);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-2.5">
        {/* Product header */}
        <div className="flex items-start gap-2">
          {(group.coverImageUrl || variations[0]?.imageUrl) && (
            <img src={group.coverImageUrl || variations[0]?.imageUrl} alt="" className="h-12 w-12 rounded object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{group.productName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>已喊: {totalOrdered}</span>
              <span>剩余: {totalAvailable}</span>
              {hasMultiple && <Badge variant="outline" className="text-xs">{variations.length} 规格</Badge>}
            </div>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Variation rows */}
        <div className="space-y-1.5">
          {variations.map((v: any) => (
            <div key={v.id} className="flex items-center gap-2 text-xs">
              {/* Spec image */}
              {v.specImage && (
                <img src={v.specImage} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
              )}
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-medium truncate">{v.displayName}</span>
                  <span className={`inline-flex px-1 py-0.5 rounded text-xs ${productStatusColors[v.status] || ""}`}>
                    {productStatusLabels[v.status] || v.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground mt-0.5">
                  <span>关键词: <code className="text-xs bg-muted px-1 rounded">{v.keyword}</code></span>
                  <span>RM{Number(v.price || 0).toFixed(2)}</span>
                  <span>库: {v.availableStock}</span>
                  <span>喊: {v.orderedCount}</span>
                  {v.allowPreorder && <Badge className="bg-blue-100 text-blue-700 text-xs">预购</Badge>}
                  {v.preorderCount > 0 && <span className="text-blue-600">预:{v.preorderCount}</span>}
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {isLive && (
                  <>
                    {v.status === "active" && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="暂停捉单"
                        onClick={() => onStatusChange(v.id, "paused")}>
                        <Pause className="h-3 w-3" />
                      </Button>
                    )}
                    {v.status === "paused" && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="恢复捉单"
                        onClick={() => onStatusChange(v.id, "active")}>
                        <Play className="h-3 w-3" />
                      </Button>
                    )}
                    {v.status !== "sold_out" && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="标记售完"
                        onClick={() => onStatusChange(v.id, "sold_out")}>
                        <XCircle className="h-3 w-3" />
                      </Button>
                    )}
                  </>
                )}
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="调整库存"
                  onClick={() => onAdjustStock(v.id)}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="复制关键词文案"
                  onClick={() => onCopyKeyword(v.id)}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="删除"
                  onClick={() => onDelete(v.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Preorder toggle for single-variation products */}
        {variations.length === 1 && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t">
            <Switch
              checked={variations[0].allowPreorder}
              onCheckedChange={(val) => onTogglePreorder(variations[0].id, val)}
              className="scale-75"
            />
            <span className="text-xs text-muted-foreground">允许预购（库存到0后可继续捉单）</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommentRow({ comment, onClick, onMarkHandled }: any) {
  return (
    <div
      className={`flex items-start gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer ${comment.isHandled ? "opacity-60" : ""}`}
      onClick={onClick}
    >
      <Avatar className="h-6 w-6 flex-shrink-0">
        <AvatarFallback className="text-xs">{(comment.commenterName || "?").charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium truncate">{comment.commenterName}</span>
          <span className={`inline-flex px-1 py-0.5 rounded text-xs ${matchResultColors[comment.matchResult] || ""}`}>
            {matchResultLabels[comment.matchResult] || comment.matchResult}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{comment.commentMessage}</p>
        {comment.matchedProductName && (
          <p className="text-xs text-blue-600 truncate">→ {comment.matchedProductName} {comment.orderNumber && `· ${comment.orderNumber}`}</p>
        )}
      </div>
      {!comment.isHandled && comment.matchResult === "matched" && (
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 flex-shrink-0" onClick={(e) => { e.stopPropagation(); onMarkHandled(); }}>
          <CheckCircle2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function OrderRow({ order }: any) {
  return (
    <div className="p-2 rounded border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{order.orderNumber}</span>
        <Badge variant="outline" className="text-xs">{order.physicalStatus}</Badge>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {order.customerName || order.facebookName || "未知客户"}
      </div>
      <div className="text-xs mt-0.5">
        {order.items?.map((item: any, idx: number) => (
          <span key={idx} className="text-muted-foreground">
            {item.productName}{item.variationName ? ` (${item.variationName})` : ""} x{item.quantity}
            {idx < order.items.length - 1 ? ", " : ""}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs font-medium">RM{Number(order.totalAmount || 0).toFixed(2)}</span>
        {order.paymentStatus && (
          <Badge variant={order.paymentStatus === "paid" ? "default" : "secondary"} className="text-xs">
            {order.paymentStatus}
          </Badge>
        )}
      </div>
    </div>
  );
}

function ProductOrderRow({ item }: any) {
  return (
    <div className="p-2 rounded border bg-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium truncate">{item.productName}</span>
        <Badge variant="secondary" className="text-xs">x{item.totalQuantity}</Badge>
      </div>
      {item.variationName && (
        <div className="text-xs text-muted-foreground">{item.variationName}</div>
      )}
      <div className="text-xs text-muted-foreground mt-0.5">
        {item.orders.length} 笔订单 · {item.orders.filter((o: any) => o.paymentStatus === "paid").length} 已付
      </div>
    </div>
  );
}

function ReportView({ report }: any) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5" /> 直播报告
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">总留言</p><p className="text-xl font-bold">{report.totalComments || 0}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">有效关键词</p><p className="text-xl font-bold">{report.matchedComments || 0}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">捉单数</p><p className="text-xl font-bold">{report.captureCount || 0}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">订单数</p><p className="text-xl font-bold">{report.totalOrders || 0}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">商品件数</p><p className="text-xl font-bold">{report.totalItems || 0}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">销售额</p><p className="text-xl font-bold">RM{Number(report.totalRevenue || 0).toFixed(2)}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">已付款</p><p className="text-xl font-bold">{report.paidOrders || 0}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">新客户</p><p className="text-xl font-bold">{report.newCustomers || 0}</p></CardContent></Card>
      </div>

      {/* Hot Products */}
      {report.productSales && report.productSales.length > 0 && (
        <Card>
          <CardHeader className="py-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> 热卖商品</CardTitle></CardHeader>
          <CardContent className="p-2">
            <div className="space-y-1">
              {report.productSales.map((p: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                  <span className="font-medium">{idx + 1}. {p.productName} <code className="text-xs bg-muted px-1 rounded">{p.keyword}</code></span>
                  <span className="text-muted-foreground">x{p.orderedCount} · RM{Number(p.revenue || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messenger Stats */}
      <Card>
        <CardHeader className="py-2"><CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" /> Messenger 通知</CardTitle></CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs text-muted-foreground">已发送</p><p className="text-lg font-bold text-green-600">{report.messengerSent || 0}</p></div>
            <div><p className="text-xs text-muted-foreground">发送失败</p><p className="text-lg font-bold text-red-600">{report.messengerFailed || 0}</p></div>
            <div><p className="text-xs text-muted-foreground">成功率</p><p className="text-lg font-bold">
              {report.messengerSent + report.messengerFailed > 0
                ? Math.round((report.messengerSent / (report.messengerSent + report.messengerFailed)) * 100)
                : 0}%
            </p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
