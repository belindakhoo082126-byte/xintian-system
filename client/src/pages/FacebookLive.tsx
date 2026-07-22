import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Radio, Plus, Play, Pause, Square, Eye, Users, Package,
  DollarSign, AlertCircle, Search, ChevronLeft, ChevronRight,
  TrendingUp, AlertTriangle, Layers,
} from "lucide-react";

const SESSION_TYPE_LABELS: Record<string, string> = {
  facebook_live: "FB 直播",
  facebook_post: "FB 贴文",
  facebook_reel: "FB Reel",
};

const SESSION_STATUS_LABELS: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  not_listening: { label: "未监听", variant: "outline" },
  comments_only: { label: "仅同步留言", variant: "secondary" },
  order_capture_active: { label: "捉单中", variant: "default" },
  paused: { label: "已暂停", variant: "secondary" },
  ended: { label: "已结束", variant: "destructive" },
};

const COMMENT_STATUS_LABELS: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  pending: { label: "待处理", variant: "outline" },
  matched: { label: "已匹配", variant: "default" },
  no_match: { label: "无匹配", variant: "secondary" },
  failed: { label: "失败", variant: "destructive" },
  duplicate: { label: "重复", variant: "secondary" },
  blacklisted: { label: "黑名单", variant: "destructive" },
  out_of_stock: { label: "缺货", variant: "destructive" },
  preorder_full: { label: "预售满", variant: "destructive" },
};

export default function FacebookLive() {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    sessionType: "facebook_live" as string,
    title: "",
    facebookPostId: "",
    facebookLiveVideoId: "",
  });
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    productId: "",
    keyword: "",
    sellingPrice: "",
    physicalStockAtStart: "0",
  });

  const { data: sessions, isLoading } = trpc.salesSessions.list.useQuery({
    limit: pageSize,
    offset: page * pageSize,
  });

  const { data: selectedSession } = trpc.salesSessions.getById.useQuery(
    { id: selectedSessionId! },
    { enabled: selectedSessionId !== null }
  );

  const { data: sessionStats } = trpc.salesSessions.stats.useQuery(
    { sessionId: selectedSessionId! },
    { enabled: selectedSessionId !== null }
  );

  const { data: sessionProducts } = trpc.sessionProducts.list.useQuery(
    { sessionId: selectedSessionId! },
    { enabled: selectedSessionId !== null }
  );

  const { data: sessionComments } = trpc.facebookComments.list.useQuery(
    { sessionId: selectedSessionId!, limit: 50 },
    { enabled: selectedSessionId !== null }
  );

  const { data: sessionVariants } = trpc.sessionProductVariants.list.useQuery(
    { sessionId: selectedSessionId! },
    { enabled: selectedSessionId !== null }
  );

  const { data: liveDashboard } = trpc.liveSelling.getDashboardStats.useQuery(
    { sessionId: selectedSessionId! },
    { enabled: selectedSessionId !== null }
  );

  const { data: products } = trpc.productsV2.list.useQuery({
    limit: 100,
    offset: 0,
  });

  const createSessionMutation = trpc.salesSessions.create.useMutation({
    onSuccess: () => {
      setCreateOpen(false);
      setCreateForm({ sessionType: "facebook_live", title: "", facebookPostId: "", facebookLiveVideoId: "" });
      toast.success("场次已创建");
      window.location.reload();
    },
  });

  const updateStatusMutation = trpc.salesSessions.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("状态已更新");
      window.location.reload();
    },
  });

  const addProductMutation = trpc.sessionProducts.add.useMutation({
    onSuccess: () => {
      setAddProductOpen(false);
      setProductForm({ productId: "", keyword: "", sellingPrice: "", physicalStockAtStart: "0" });
      toast.success("商品已添加");
      window.location.reload();
    },
  });

  const updateProductMutation = trpc.sessionProducts.update.useMutation({
    onSuccess: () => {
      toast.success("商品已更新");
      window.location.reload();
    },
  });

  if (selectedSessionId !== null) {
    return <LiveControlCenter
      sessionId={selectedSessionId}
      session={selectedSession}
      stats={sessionStats}
      products={sessionProducts}
      variants={sessionVariants}
      comments={sessionComments}
      allProducts={products}
      liveDashboard={liveDashboard}
      onBack={() => setSelectedSessionId(null)}
      onUpdateStatus={(status: string) => updateStatusMutation.mutate({ id: selectedSessionId, status })}
      onAddProduct={() => setAddProductOpen(true)}
      onUpdateProduct={(id: number, updates: any) => updateProductMutation.mutate({ id, ...updates })}
      addProductOpen={addProductOpen}
      productForm={productForm}
      setProductForm={setProductForm}
      onAddProductSubmit={() => {
        if (!productForm.productId || !productForm.keyword) return;
        addProductMutation.mutate({
          sessionId: selectedSessionId,
          productId: parseInt(productForm.productId),
          keyword: productForm.keyword,
          sellingPrice: productForm.sellingPrice || undefined,
          physicalStockAtStart: parseInt(productForm.physicalStockAtStart) || 0,
        });
      }}
    />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facebook 销售管理</h1>
          <p className="text-sm text-muted-foreground mt-1">直播、贴文、Reel 共用同一套留言与捉单引擎</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />新建场次
        </Button>
      </div>

      {/* Session List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : sessions && sessions.length > 0 ? (
            <div className="divide-y">
              {sessions.map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedSessionId(s.id)}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg ${s.sessionType === "facebook_live" ? "bg-red-50" : s.sessionType === "facebook_post" ? "bg-blue-50" : "bg-purple-50"}`}>
                      <Radio className={`h-5 w-5 ${s.sessionType === "facebook_live" ? "text-red-500" : s.sessionType === "facebook_post" ? "text-blue-500" : "text-purple-500"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{s.title}</p>
                        <Badge variant={SESSION_STATUS_LABELS[s.status as string]?.variant || "outline"} className="text-xs">
                          {SESSION_STATUS_LABELS[s.status as string]?.label || s.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>{SESSION_TYPE_LABELS[s.sessionType as string] || s.sessionType}</span>
                        <span>{s.sessionCode}</span>
                        {s.startedAt && <span>开始: {new Date(s.startedAt).toLocaleString()}</span>}
                        {s.endedAt && <span>结束: {new Date(s.endedAt).toLocaleString()}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.status === "order_capture_active" && (
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: s.id, status: "paused" }); }}>
                        <Pause className="h-3 w-3 mr-1" />暂停
                      </Button>
                    )}
                    {s.status === "paused" && (
                      <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: s.id, status: "order_capture_active" }); }}>
                        <Play className="h-3 w-3 mr-1" />继续
                      </Button>
                    )}
                    {(s.status === "not_listening" || s.status === "comments_only") && (
                      <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: s.id, status: "order_capture_active" }); }}>
                        <Play className="h-3 w-3 mr-1" />开始捉单
                      </Button>
                    )}
                    {s.status !== "ended" && s.status !== "not_listening" && (
                      <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: s.id, status: "ended" }); }}>
                        <Square className="h-3 w-3 mr-1" />结束
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedSessionId(s.id); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Radio className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>暂无销售场次</p>
              <p className="text-xs mt-1">点击「新建场次」开始你的第一场直播捉单</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {sessions && sessions.length >= pageSize && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">第 {page + 1} 页</span>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Create Session Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建销售场次</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>类型</Label>
              <Select value={createForm.sessionType} onValueChange={(v) => setCreateForm({ ...createForm, sessionType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook_live">FB 直播</SelectItem>
                  <SelectItem value="facebook_post">FB 贴文</SelectItem>
                  <SelectItem value="facebook_reel">FB Reel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>标题</Label>
              <Input value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="例如：2026年7月直播" />
            </div>
            <div>
              <Label>Facebook Post ID（选填）</Label>
              <Input value={createForm.facebookPostId}
                onChange={(e) => setCreateForm({ ...createForm, facebookPostId: e.target.value })}
                placeholder="贴文 ID" />
            </div>
            <div>
              <Label>Facebook Live Video ID（选填）</Label>
              <Input value={createForm.facebookLiveVideoId}
                onChange={(e) => setCreateForm({ ...createForm, facebookLiveVideoId: e.target.value })}
                placeholder="直播视频 ID" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button
              onClick={() => {
                if (!createForm.title) return;
                const code = `S${Date.now().toString(36).toUpperCase()}`;
                createSessionMutation.mutate({
                  sessionCode: code,
                  sessionType: createForm.sessionType as any,
                  title: createForm.title,
                  facebookPostId: createForm.facebookPostId || undefined,
                  facebookLiveVideoId: createForm.facebookLiveVideoId || undefined,
                });
              }}
              disabled={createSessionMutation.isPending || !createForm.title}>
              创建场次
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Live Control Center - Three Column Layout
// ============================================================================

function LiveControlCenter({
  sessionId,
  session,
  stats,
  products,
  variants,
  comments,
  allProducts,
  liveDashboard,
  onBack,
  onUpdateStatus,
  onAddProduct,
  onUpdateProduct,
  addProductOpen,
  productForm,
  setProductForm,
  onAddProductSubmit,
}: any) {
  if (!session) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />返回列表
          </Button>
          <h1 className="text-xl font-semibold">{session.title}</h1>
          <Badge variant={SESSION_STATUS_LABELS[session.status]?.variant || "outline"}>
            {SESSION_STATUS_LABELS[session.status]?.label || session.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {session.status === "not_listening" && (
            <Button size="sm" variant="default" onClick={() => onUpdateStatus("order_capture_active")}>
              <Play className="h-3 w-3 mr-1" />开始捉单
            </Button>
          )}
          {session.status === "order_capture_active" && (
            <Button size="sm" variant="outline" onClick={() => onUpdateStatus("paused")}>
              <Pause className="h-3 w-3 mr-1" />暂停
            </Button>
          )}
          {session.status === "paused" && (
            <Button size="sm" variant="default" onClick={() => onUpdateStatus("order_capture_active")}>
              <Play className="h-3 w-3 mr-1" />继续
            </Button>
          )}
          {session.status !== "ended" && (
            <Button size="sm" variant="destructive" onClick={() => onUpdateStatus("ended")}>
              <Square className="h-3 w-3 mr-1" />结束
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard icon={Users} label="下单客户" value={stats.orderStats?.customerCount || 0} color="text-blue-500" />
          <StatCard icon={Package} label="商品件数" value={stats.orderStats?.itemCount || 0} color="text-purple-500" />
          <StatCard icon={DollarSign} label="总金额" value={`RM ${Number(stats.orderStats?.totalAmount || 0).toFixed(2)}`} color="text-green-600" />
          <StatCard icon={AlertCircle} label="待付款" value={stats.orderStats?.pending || 0} color="text-orange-500" />
          <StatCard icon={TrendingUp} label="已付款" value={stats.orderStats?.paid || 0} color="text-green-600" />
          <StatCard icon={AlertCircle} label="需要处理" value={stats.pendingActionCount || 0} color="text-red-500" />
        </div>
      )}

      {/* Live Dashboard Alerts */}
      {liveDashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Out of Stock Alerts */}
          {(liveDashboard.outOfStockAlerts?.products?.length > 0 || liveDashboard.outOfStockAlerts?.variants?.length > 0) && (
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-700">缺货提醒</span>
                </div>
                <div className="space-y-1">
                  {liveDashboard.outOfStockAlerts.products.map((p: any) => (
                    <div key={p.id} className="text-xs flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">{p.keyword}</Badge>
                      <span className="text-red-600">实体库存已售完，未开预售</span>
                    </div>
                  ))}
                  {liveDashboard.outOfStockAlerts.variants.map((v: any) => (
                    <div key={v.id} className="text-xs flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">{v.keyword}</Badge>
                      <span className="text-red-600">Variant 库存已售完</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {/* Preorder Alerts */}
          {liveDashboard.preorderAlerts?.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium text-orange-700">预售中</span>
                </div>
                <div className="space-y-1">
                  {liveDashboard.preorderAlerts.map((p: any) => (
                    <div key={p.id} className="text-xs flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">{p.keyword}</Badge>
                      <span className="text-orange-600">预售: {p.sold}/{p.limit === null ? "∞" : p.limit}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Session Products */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">商品区 ({products?.length || 0})</CardTitle>
            <Button size="sm" variant="outline" onClick={onAddProduct}>
              <Plus className="h-3 w-3 mr-1" />添加
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {/* Regular Products */}
            {products && products.length > 0 ? (
              products.map((sp: any) => {
                const remaining = sp.physicalStockAtStart - sp.physicalSoldQuantity;
                const isOutOfStock = remaining <= 0 && !sp.preorderEnabled;
                return (
                <div key={sp.id} className={`p-3 border rounded-lg space-y-2 ${isOutOfStock ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant="secondary" className="font-mono">{sp.keyword}</Badge>
                      <span className="text-xs text-muted-foreground ml-2">
                        {sp.sellingPrice ? `RM ${sp.sellingPrice}` : ""}
                      </span>
                    </div>
                    <Badge variant={sp.sellingStatus === "available" ? "default" : "destructive"} className="text-xs">
                      {sp.sellingStatus === "available" ? "在售" : "停售"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">实体: </span>
                      <span className="font-medium">{sp.physicalStockAtStart - sp.physicalSoldQuantity}/{sp.physicalStockAtStart}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">预售: </span>
                      <span className="font-medium">
                        {sp.preorderEnabled
                          ? `${sp.preorderLimit === null ? "∞" : (sp.preorderLimit as number) - sp.preorderSoldQuantity}/${sp.preorderLimit === null ? "∞" : sp.preorderLimit}`
                          : "未开"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                      onClick={() => onUpdateProduct(sp.id, {
                        sellingStatus: sp.sellingStatus === "available" ? "stopped" : "available",
                      })}>
                      {sp.sellingStatus === "available" ? "停售" : "继续"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                      onClick={() => onUpdateProduct(sp.id, {
                        preorderEnabled: !sp.preorderEnabled,
                        preorderLimit: sp.preorderEnabled ? null : null,
                      })}>
                      {sp.preorderEnabled ? "关预售" : "开预售"}
                    </Button>
                  </div>
                </div>
              );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                请添加商品到本场次
              </div>
            )}

            {/* Variant Products */}
            {variants && variants.length > 0 && (
              <div className="pt-2 border-t mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-2 mt-2">规格商品 (Variant)</p>
                {variants.map((sv: any) => {
                  const vRemaining = sv.physicalStockAtStart - sv.physicalSoldQuantity;
                  const vOutOfStock = vRemaining <= 0 && !sv.preorderEnabled;
                  return (
                  <div key={sv.id} className={`p-3 border rounded-lg space-y-2 mb-2 ${vOutOfStock ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge variant="secondary" className="font-mono">{sv.keyword}</Badge>
                        <span className="text-xs text-muted-foreground ml-2">
                          {sv.sellingPrice ? `RM ${sv.sellingPrice}` : ""}
                        </span>
                      </div>
                      <Badge variant={sv.sellingStatus === "available" ? "default" : "destructive"} className="text-xs">
                        {sv.sellingStatus === "available" ? "在售" : "停售"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">实体: </span>
                        <span className="font-medium">{vRemaining}/{sv.physicalStockAtStart}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">预售: </span>
                        <span className="font-medium">
                          {sv.preorderEnabled
                            ? `${sv.preorderLimit === null ? "∞" : (sv.preorderLimit as number) - sv.preorderSoldQuantity}/${sv.preorderLimit === null ? "∞" : sv.preorderLimit}`
                            : "未开"}
                        </span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 2: Comments Stream */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">
              留言区 ({comments?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {comments && comments.length > 0 ? (
              comments.map((c: any) => (
                <div key={c.id} className="p-3 border rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                        {(c.facebookUserId || "?").slice(-2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">FB ID: {c.facebookUserId?.slice(-8)}</p>
                      </div>
                    </div>
                    <Badge variant={COMMENT_STATUS_LABELS[c.processingStatus]?.variant || "outline"} className="text-xs shrink-0">
                      {COMMENT_STATUS_LABELS[c.processingStatus]?.label || c.processingStatus}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">{c.messageOriginal}</p>
                  {c.keywordDetected && (
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary" className="font-mono">{c.keywordDetected}</Badge>
                      <span className="text-muted-foreground">数量: {c.quantityDetected}</span>
                    </div>
                  )}
                  {c.failureReason && (
                    <p className="text-xs text-red-500">{c.failureReason}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Radio className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                等待留言同步...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 3: Order Operations */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">客户订单操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
            {stats && (
              <div className="space-y-2">
                <div className="p-3 bg-muted/30 rounded-lg space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">总留言</span>
                    <span className="font-medium">{stats.commentStats?.total || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">已匹配</span>
                    <span className="font-medium text-green-600">{stats.commentStats?.matched || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">重复</span>
                    <span className="font-medium text-orange-500">{stats.commentStats?.duplicate || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">黑名单</span>
                    <span className="font-medium text-red-500">{stats.commentStats?.blacklisted || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">失败</span>
                    <span className="font-medium text-red-500">{stats.commentStats?.failed || 0}</span>
                  </div>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">已付款</span>
                    <span className="font-medium text-green-600">{stats.orderStats?.paid || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">待付款</span>
                    <span className="font-medium text-orange-500">{stats.orderStats?.pending || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">已取消</span>
                    <span className="font-medium text-red-500">{stats.orderStats?.cancelled || 0}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="text-center text-xs text-muted-foreground py-4 border-t">
              <p>客户快速操作将在 V1.1 版本加入</p>
              <p className="mt-1">当前版本支持关键词自动捉单</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Product Dialog */}
      <Dialog open={addProductOpen} onOpenChange={(open: boolean) => { if (!open) onAddProduct(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加商品到场次</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>商品</Label>
              <Select value={productForm.productId} onValueChange={(v) => setProductForm({ ...productForm, productId: v })}>
                <SelectTrigger><SelectValue placeholder="选择商品" /></SelectTrigger>
                <SelectContent>
                  {allProducts?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.nameZh || p.nameEn || `Product #${p.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>关键词</Label>
              <Input value={productForm.keyword}
                onChange={(e) => setProductForm({ ...productForm, keyword: e.target.value.toUpperCase() })}
                placeholder="例如：MP1" />
              <p className="text-xs text-muted-foreground mt-1">客户留言时使用此关键词 + 数量下单</p>
            </div>
            <div>
              <Label>售价 (RM)</Label>
              <Input type="number" step="0.01" value={productForm.sellingPrice}
                onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                placeholder="留空使用商品默认价" />
            </div>
            <div>
              <Label>实体库存</Label>
              <Input type="number" value={productForm.physicalStockAtStart}
                onChange={(e) => setProductForm({ ...productForm, physicalStockAtStart: e.target.value })}
                placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onAddProduct(false)}>取消</Button>
            <Button onClick={onAddProductSubmit}
              disabled={!productForm.productId || !productForm.keyword}>
              添加商品
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card className="border-0 bg-muted/30">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
