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
  Bot, Monitor, StickyNote, Ban, Link2, ImageIcon, ClipboardPaste, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import { ImageZoomDialog } from "@/components/ImageZoomDialog";

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
  const { t, translate: tt, lang } = useI18n();
  const roomId = props.roomId ?? (props.match?.params?.id ? parseInt(props.match.params.id) : 0);
  const onBack = props.onBack ?? (() => window.history.back());
  const queryClient = trpc.useUtils();
  const roomStatusLabel = (status: string) => ({
    preparing: tt("准备中", "Preparing"),
    live: tt("直播中", "Live"),
    ended: tt("已结束", "Ended"),
    closed: tt("已截止", "Closed"),
  }[status] ?? status);
  const matchResultLabel = (status: string) => ({
    matched: tt("已捉单", "Order captured"),
    no_match: tt("未匹配", "No match"),
    paused: tt("商品暂停", "Product paused"),
    sold_out: tt("已售完", "Sold out"),
    preorder: tt("预购", "Pre-order"),
    duplicate: tt("重复留言", "Duplicate comment"),
    ignored: tt("已忽略", "Ignored"),
    ai_replied: tt("AI回复", "AI replied"),
    order_merged: tt("已合单", "Order merged"),
  }[status] ?? status);
  const formatLiveDate = (value: Date | string) =>
    new Date(value).toLocaleString(lang === "zh" ? "zh-MY" : "en-MY");

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
  const [liveProductSearch, setLiveProductSearch] = useState("");
  const liveProductGroups = (() => {
    const all = (productsQuery.data || []) as any[];
    if (!liveProductSearch.trim()) return all;
    const q = liveProductSearch.trim().toLowerCase();
    return all.filter((g: any) =>
      (g.productName || '').toLowerCase().includes(q) ||
      (g.productSku || '').toLowerCase().includes(q) ||
      (g.productKeyword || '').toLowerCase().includes(q) ||
      (g.variations || []).some((v: any) =>
        (v.keyword || '').toLowerCase().includes(q) ||
        (v.displayName || '').toLowerCase().includes(q)
      )
    );
  })();
  const stats = (statsQuery.data || {}) as any;
  const liveOrders = (liveOrdersQuery.data || []) as any[];
  const ordersByProduct = (ordersByProductQuery.data || []) as any[];
  const comments = (commentsQuery.data || []) as any[];
  const commentStats = (commentStatsQuery.data || {}) as any;
  const report = (reportQuery.data || {}) as any;

  // State
  const [videoCollapsed, setVideoCollapsed] = useState(true); // Default collapsed to maximize product/comment space
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
  // batchAddKeyword removed — live room no longer stores duplicate keyword data
  const [batchAddPriceMode, setBatchAddPriceMode] = useState<"original" | "custom">("original");
  const [batchAddPrice, setBatchAddPrice] = useState("");
  const [selectedComment, setSelectedComment] = useState<any | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [endLiveConfirmOpen, setEndLiveConfirmOpen] = useState(false);
  const [priceEditOpen, setPriceEditOpen] = useState(false);
  const [priceEditId, setPriceEditId] = useState<number | null>(null);
  const [priceEditValue, setPriceEditValue] = useState("");
  const [roomNotes, setRoomNotes] = useState("");
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  // V2.0: Send comment state
  const [commentInput, setCommentInput] = useState("");
  // V2.0: Staff Note state
  const [noteInput, setNoteInput] = useState("");
  // V2.0: Blacklist dialog state
  const [blacklistDialogOpen, setBlacklistDialogOpen] = useState(false);
  const [blacklistCustomer, setBlacklistCustomer] = useState<any>(null);
  const [blacklistReason, setBlacklistReason] = useState("");
  // V2.0: Order search state
  const [orderSearch, setOrderSearch] = useState("");
  // 直播操作优先采用大卡视图；如需提高可视密度，仍可手动切换紧凑视图。
  const [cardMode, setCardMode] = useState<'large' | 'compact'>('large');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('liveCardMode', cardMode);
    }
  }, [cardMode]);

  useEffect(() => {
    setRoomNotes(room?.notes || "");
  }, [room?.id, room?.notes]);

  // V2.0.11: Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+F: focus comment search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const el = document.getElementById('comment-search') as HTMLInputElement;
        if (el) el.focus();
      }
      // Ctrl+K: focus comment input
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const el = document.getElementById('comment-input') as HTMLInputElement;
        if (el) el.focus();
      }
      // Esc: close any open dialog
      if (e.key === 'Escape') {
        if (selectedComment) setSelectedComment(null);
        if (addDialogOpen) setAddDialogOpen(false);
        if (stockDialogOpen) setStockDialogOpen(false);
        if (priceEditOpen) setPriceEditOpen(false);
        if (endLiveConfirmOpen) setEndLiveConfirmOpen(false);
        if (blacklistDialogOpen) setBlacklistDialogOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedComment, addDialogOpen, stockDialogOpen, priceEditOpen, endLiveConfirmOpen, blacklistDialogOpen]);

  // V2.0: Filtered orders by search
  const filteredOrders = useMemo(() => {
    if (!liveOrders) return [];
    if (!orderSearch) return liveOrders;
    const lower = orderSearch.toLowerCase();
    return liveOrders.filter((o: any) =>
      (o.orderNumber || "").toLowerCase().includes(lower) ||
      (o.customerName || "").toLowerCase().includes(lower) ||
      (o.facebookName || "").toLowerCase().includes(lower)
    );
  }, [liveOrders, orderSearch]);

  // Product search for batch add
  const productSearchResults = trpc.liveRooms.searchProducts.useQuery(
    { liveRoomId: roomId, query: productSearchQuery, categoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined },
    { enabled: productSearchQuery.length > 0 }
  );
  const categoriesQuery = trpc.productCategoriesLegacy.list.useQuery({ activeOnly: true });

  // Mutations
  const batchAddMutation = trpc.liveRooms.batchAddProducts.useMutation({
    onSuccess: (data: any) => {
      toast.success(`${t("live.batchAdded")} ${data?.count || 0} ${t("live.productUnit")}`);
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getStats.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getStatsBatch.invalidate();
      setAddDialogOpen(false);
      setBatchSelectedIds([]);
      setBatchSelectedProducts({});
      // batchAddKeyword removed
      setProductSearchQuery("");
    },
    onError: (e: any) => toast.error(t("live.batchAddFailed") + ": " + e.message),
  });

  const updateProductMutation = trpc.liveRooms.updateProduct.useMutation({
    onSuccess: () => {
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getStats.invalidate({ liveRoomId: roomId });
    },
    onError: (e: any) => toast.error(t("live.operationFailed") + ": " + e.message),
  });

  const deleteProductMutation = trpc.liveRooms.deleteProduct.useMutation({
    onSuccess: () => {
      toast.success(t("live.removed"));
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getStats.invalidate({ liveRoomId: roomId });
    },
    onError: (e: any) => toast.error(t("live.removeFailed") + ": " + e.message),
  });

  const adjustStockMutation = trpc.liveRooms.adjustProductStock.useMutation({
    onSuccess: (data: any) => {
      toast.success(`${t("live.stockAdjusted")} ${data.startStock}`);
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
      setStockDialogOpen(false);
      setStockForm({ quantityChange: 0, reason: "other" });
    },
    onError: (e: any) => toast.error(t("live.adjustFailed") + ": " + e.message),
  });

  const togglePreorderMutation = trpc.liveRooms.togglePreorder.useMutation({
    onSuccess: () => {
      queryClient.liveRooms.getProducts.invalidate({ liveRoomId: roomId });
      toast.success(t("live.preorderUpdated"));
    },
    onError: (e: any) => toast.error(t("live.operationFailed") + ": " + e.message),
  });

  const updateRoomMutation = trpc.liveRooms.update.useMutation({
    onSuccess: () => {
      queryClient.liveRooms.getById.invalidate({ id: roomId });
      queryClient.liveRooms.list.invalidate();
      toast.success(t("live.statusUpdated"));
    },
    onError: (e: any) => toast.error(t("live.operationFailed") + ": " + e.message),
  });

  const saveRoomNotesMutation = trpc.liveRooms.saveRoomNotes.useMutation({
    onSuccess: (data) => {
      const savedNotes = data.notes || "";
      setRoomNotes(savedNotes);
      queryClient.liveRooms.getById.setData({ id: roomId }, (current) =>
        current ? { ...current, notes: savedNotes, updatedAt: data.updatedAt } : current
      );
      queryClient.liveRooms.getById.invalidate({ id: roomId });
      queryClient.liveRooms.list.invalidate();
      toast.success(tt("直播备忘录已保存", "Live memo saved"));
    },
    onError: (e: any) => toast.error(`${tt("备忘录保存失败", "Failed to save live memo")}: ${e.message}`),
  });

  const startLiveMutation = trpc.liveRooms.startLive.useMutation({
    onSuccess: () => {
      queryClient.liveRooms.getById.invalidate({ id: roomId });
      queryClient.liveRooms.list.invalidate();
      toast.success(t("live.liveStarted"));
    },
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
      toast.success(t("live.liveEnded"));
    },
    onError: (e: any) => toast.error(t("live.operationFailed") + ": " + e.message),
  });

  const markCommentHandledMutation = trpc.liveRooms.markCommentHandled.useMutation({
    onSuccess: () => {
      queryClient.liveRooms.getComments.invalidate({ liveRoomId: roomId });
      queryClient.liveRooms.getCommentStats.invalidate({ liveRoomId: roomId });
      toast.success(t("live.commentMarked"));
    },
  });

  // V2.0: Send comment mutation
  const sendCommentMutation = trpc.liveRooms.sendComment.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(t("live.commentSent"));
        setCommentInput("");
        queryClient.liveRooms.getComments.invalidate({ liveRoomId: roomId });
      } else {
        toast.error("发送失败: " + (data.error || t("live.unknownError")));
      }
    },
    onError: (e: any) => toast.error(t("live.sendFailed") + ": " + e.message),
  });

  // V2.0: Blacklist the commenter through the same PSID identity used by live capture.
  const blacklistCommenterMutation = trpc.liveRooms.blacklistCommenter.useMutation({
    onSuccess: () => {
      toast.success(t("live.blacklistUpdated"));
      setBlacklistDialogOpen(false);
      setBlacklistCustomer(null);
      setBlacklistReason("");
      queryClient.liveRooms.getComments.invalidate({ liveRoomId: roomId });
    },
    onError: (e: any) => toast.error(t("live.operationFailed") + ": " + e.message),
  });

  // V2.0: Staff Note mutations
  const createNoteMutation = trpc.liveRooms.createNote.useMutation({
    onSuccess: () => {
      toast.success(t("live.noteAdded"));
      setNoteInput("");
      if (selectedComment) {
        queryClient.liveRooms.getCommentNotes.invalidate({ liveCommentId: selectedComment.id });
      }
    },
    onError: (e: any) => toast.error(t("live.addFailed") + ": " + e.message),
  });

  const deleteNoteMutation = trpc.liveRooms.deleteNote.useMutation({
    onSuccess: () => {
      toast.success(t("live.noteDeleted"));
      if (selectedComment) {
        queryClient.liveRooms.getCommentNotes.invalidate({ liveCommentId: selectedComment.id });
      }
    },
    onError: (e: any) => toast.error(t("live.deleteFailed") + ": " + e.message),
  });

  // V2.0: Staff Notes query (for selected comment)
  const commentNotesQuery = trpc.liveRooms.getCommentNotes.useQuery(
    { liveCommentId: selectedComment?.id || 0 },
    { enabled: !!selectedComment }
  );

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
        toast.success(t("live.copyKeyword"));
      }
    } catch (e: any) {
      toast.error(t("live.copyFailed") + ": " + e.message);
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

  function openPriceEdit(id: number, currentPrice: number) {
    setPriceEditId(id);
    setPriceEditValue(String(currentPrice));
    setPriceEditOpen(true);
  }

  function openBlacklistForComment(comment: any) {
    if (comment.isCustomerBlacklisted) {
      toast.info("此客户已在黑名单中，系统不会从直播留言建立订单。");
      return;
    }
    setBlacklistCustomer({
      name: comment.commenterName,
      psid: comment.commenterPsid,
      customerId: comment.customerId,
    });
    setBlacklistReason("");
    setBlacklistDialogOpen(true);
  }

  function handlePriceSave() {
    if (priceEditId && priceEditValue) {
      updateProductMutation.mutate({ id: priceEditId, price: Number(priceEditValue) });
      setPriceEditOpen(false);
    }
  }

  function handleBatchSubmit() {
    const items = batchSelectedIds.map(id => {
      const p = batchSelectedProducts[id];
      if (!p) return null;
      const livePrice = batchAddPriceMode === "custom" && batchAddPrice ? Number(batchAddPrice) : undefined;
      return {
        productId: p.id,
        livePrice,
      };
    }).filter(Boolean);
    if (items.length === 0) {
      toast.error(t("live.selectProducts"));
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
    return <div className="p-8 text-center text-muted-foreground">{t("live.loading")}</div>;
  }
  if (!room) {
    return <div className="p-8 text-center text-muted-foreground">{t("live.notFound")}</div>;
  }

  const isLive = room.status === "live";
  const isEnded = room.status === "ended" || room.status === "closed";

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] gap-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {tt("返回", "Back")}
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Radio className={`h-5 w-5 ${isLive ? "text-green-600 animate-pulse" : "text-muted-foreground"}`} />
              {room.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {room.liveType === "import_preorder" ? (
                <Badge className="bg-purple-100 text-purple-700 text-xs">{t("live.chinaProxy")}</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">{t("live.localLive")}</Badge>
              )}
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${roomStatusColors[room.status] || ""}`}>
                {roomStatusLabel(room.status)}
              </span>
              {room.streamerName && (
                <span className="text-xs text-muted-foreground">{t("live.streamer")} {room.streamerName}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isLive && !isEnded && (
            <Button variant="default" size="sm" className="gap-2"
              onClick={() => startLiveMutation.mutate({ liveRoomId: roomId })}
              disabled={startLiveMutation.isPending}>
              <Play className="h-4 w-4" /> {t("live.startLive")}
            </Button>
          )}
          {isLive && (
            <Button variant="destructive" size="sm" className="gap-2"
              onClick={() => setEndLiveConfirmOpen(true)}>
              <XCircle className="h-4 w-4" /> {t("live.endLive")}
            </Button>
          )}
          {isEnded && (
            <Button variant="outline" size="sm" className="gap-2"
              onClick={() => setShowReport(!showReport)}>
              <BarChart3 className="h-4 w-4" /> {showReport ? t("live.backToConsole") : t("live.viewReport")}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" /> {t("live.addProducts")}
          </Button>
        </div>
      </div>

      {/* Report View (when ended and toggled) */}
      {showReport && isEnded ? (
        <ReportView report={report} />
      ) : (
        <>
          {/* Fixed-height console layout: Top = Header+Video+Stats (compact), Middle = Products+Comments (flex-1), Bottom = Orders (fixed) */}
          {/* Region 1: Live Video (collapsible/closable) - compact */}
          {room.facebookVideoId && !videoClosed && (
            <Collapsible open={!videoCollapsed} onOpenChange={(open) => setVideoCollapsed(!open)}>
              <Card className="flex-shrink-0">
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors py-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Video className="h-4 w-4" /> {t("live.liveVideo")}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={(e) => { e.stopPropagation(); setVideoClosed(true); }}>
                          <XCircle className="h-3 w-3" /> {tt("关闭", "Close")}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 text-xs">
                          {videoCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-2">
                    {videoError ? (
                      <div className="w-full flex flex-col items-center justify-center py-4 text-muted-foreground">
                        <AlertCircle className="h-6 w-6 mb-1 text-orange-500" />
                        <p className="text-xs">{t("live.videoLoadFailed")}</p>
                        <Button variant="outline" size="sm" className="mt-1 text-xs gap-1" onClick={() => setVideoError(false)}>
                          <Video className="h-3 w-3" /> {tt("重试", "Retry")}
                        </Button>
                      </div>
                    ) : (
                      <div className="relative w-full" style={{ paddingBottom: "25%" }}>
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
            <Button variant="outline" size="sm" className="gap-2 flex-shrink-0" onClick={() => { setVideoClosed(false); setVideoError(false); }}>
              <Video className="h-4 w-4" /> {t("live.showVideo")}
            </Button>
          )}

          {/* Stats Bar - inline compact */}
          <div className="flex items-center gap-4 text-xs flex-shrink-0 px-1">
            <span className="flex items-center gap-1" title="商品数为本场已加入的独立商品；商品数量为本场成功捉单的总件数。"><Package className="h-3.5 w-3.5 text-blue-500" /><span className="text-muted-foreground">{t("live.products")}</span> <span className="font-bold">{stats.productCount || 0}</span></span>
            <span className="flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5 text-green-500" /><span className="text-muted-foreground">{t("live.orders")}</span> <span className="font-bold">{stats.orderCount || 0}</span></span>
            <span className="flex items-center gap-1" title="仅统计本场已成功捉单的商品件数，已取消订单会从商品管理的阶段统计中扣除。"><Boxes className="h-3.5 w-3.5 text-orange-500" /><span className="text-muted-foreground">{t("live.items")}</span> <span className="font-bold">{stats.totalItems || 0}</span></span>
            <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5 text-emerald-500" /><span className="text-muted-foreground">{t("live.revenue")}</span> <span className="font-bold">RM{(Number(stats.totalRevenue) || 0).toFixed(2)}</span></span>
          </div>

          <Card className="flex-shrink-0 border-amber-200 bg-amber-50/40">
            <CardContent className="space-y-2 py-2.5">
              <div className="flex items-center gap-2">
                <StickyNote className="h-4 w-4 shrink-0 text-amber-700" />
                <span className="text-xs font-semibold text-amber-900">{tt("直播备忘录", "Live memo")}</span>
                <span className="text-[11px] text-muted-foreground">{tt("仅后台可见", "Visible to staff only")}</span>
              </div>
              <Textarea
                value={roomNotes}
                onChange={(event) => setRoomNotes(event.target.value)}
                placeholder={tt("记录本场规则、补货提醒或交接事项；保存后会立即在此处显示。", "Record rules, restock reminders, or handover notes for this live; saved notes appear here immediately.")}
                aria-label={tt("直播备忘录", "Live memo")}
                className="min-h-16 resize-y bg-background text-xs"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {(room.notes || "").trim()
                    ? tt("已载入最近保存的备忘录", "Most recently saved memo loaded")
                    : tt("尚未保存备忘录", "No memo has been saved")}
                </span>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 shrink-0 px-3 text-xs"
                  disabled={saveRoomNotesMutation.isPending || roomNotes.trim() === (room.notes || "").trim()}
                  onClick={() => saveRoomNotesMutation.mutate({ liveRoomId: roomId, content: roomNotes })}
                >
                  {saveRoomNotesMutation.isPending ? tt("保存中…", "Saving…") : tt("保存备忘", "Save memo")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* V2.0: AI Reply & Continue Monitor Toggles - compact */}
          <div className="flex items-center gap-4 text-xs flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-purple-500" />
              <span className="text-muted-foreground">{t("live.aiAutoReply")}</span>
              <Switch
                checked={room.aiReplyEnabled ?? true}
                onCheckedChange={(val) => updateRoomMutation.mutate({ id: roomId, aiReplyEnabled: val })}
                className="scale-75"
              />
            </div>
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground">{t("live.continuousMonitor")}</span>
              <Switch
                checked={room.continueMonitor ?? true}
                onCheckedChange={(val) => updateRoomMutation.mutate({ id: roomId, continueMonitor: val })}
                className="scale-75"
              />
              <span className="text-muted-foreground">({t("live.keepCapturing")})</span>
            </div>
          </div>

          {/* Two-Column Layout: Products 45% | Comments 55% - flex-1 to fill remaining space */}
          <div className="grid grid-cols-1 gap-3 flex-1 min-h-0" style={{ gridTemplateColumns: 'minmax(0, 50fr) minmax(0, 50fr)' }}>
            {/* Region 2: Products Area (55%) */}
            <Card className="flex flex-col min-h-0">
              <CardHeader className="pb-2 py-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" /> {tt(t("live.productArea"), "Products")}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 rounded-md border p-0.5">
                      <Button variant={cardMode === 'large' ? 'default' : 'ghost'} size="sm" className="h-6 px-2 text-xs"
                        onClick={() => setCardMode('large')}>{tt(t("live.largeCard"), "Large")}</Button>
                      <Button variant={cardMode === 'compact' ? 'default' : 'ghost'} size="sm" className="h-6 px-2 text-xs"
                        onClick={() => setCardMode('compact')}>{tt(t("live.compact"), "Compact")}</Button>
                    </div>
                    <Badge variant="secondary" className="text-xs">{liveProductGroups.length} {t("live.productUnit")}</Badge>
                  </div>
                </div>
              </CardHeader>
              {/* Product search bar */}
              <div className="px-3 pb-1 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={liveProductSearch}
                    onChange={(e) => setLiveProductSearch(e.target.value)}
                    placeholder={tt(t("live.searchProducts"), "Search name/SKU/keyword...")}
                    className="h-7 pl-7 text-xs"
                  />
                </div>
              </div>
              <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
                <ScrollArea className="h-full w-full">
                  <div className="p-2 space-y-1.5">
                    {liveProductGroups.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">{tt(t("live.noProducts"), "No products yet. Click Add Products")}</p>
                      </div>
                    ) : (
                      liveProductGroups.map((group: any) => (
                        <ProductGroupCard
                          key={group.productId}
                          group={group}
                          isLive={isLive}
                          cardMode={cardMode}
                          onStatusChange={handleStatusChange}
                          onTogglePreorder={(id: number, val: boolean) => togglePreorderMutation.mutate({ id, allowPreorder: val })}
                          onAdjustStock={openStockDialog}
                          onPriceEdit={openPriceEdit}
                          onPreview={(url: string, name: string) => setPreviewImage({ url, name })}
                          onDelete={(id: number) => deleteProductMutation.mutate({ id })}
                          onCopyKeyword={handleCopyKeyword}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Region 3: Comments Area (45%) */}
            <Card className="flex flex-col min-h-0">
              <CardHeader className="pb-2 py-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> {tt(t("live.commentArea"), "Comments")}
                    {commentStatsMap["matched"] > 0 && (
                      <Badge variant="secondary" className="text-xs">{commentStatsMap["matched"]}</Badge>
                    )}
                  </CardTitle>
                  <Select value={commentFilter} onValueChange={setCommentFilter}>
                    <SelectTrigger className="h-6 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tt(t("live.allStatus"), "All Status")}</SelectItem>
                      <SelectItem value="matched">{tt("已捉单", "Captured")}</SelectItem>
                      <SelectItem value="no_match">{tt("未匹配", "No Match")}</SelectItem>
                      <SelectItem value="sold_out">{tt("已售完", "Sold Out")}</SelectItem>
                      <SelectItem value="paused">{tt("暂停中", "Paused")}</SelectItem>
                      <SelectItem value="preorder">{tt("预购", "Preorder")}</SelectItem>
                      <SelectItem value="order_merged">{tt("已合单", "Merged")}</SelectItem>
                      <SelectItem value="messenger_failed">{tt(t("live.dmFailed"), "DM Failed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              {/* Row 1: Send comment (top priority) */}
              <div className="px-3 pb-2">
                <div className="flex gap-1">
                  <Input
                    id="comment-input"
                    placeholder={tt(t("live.inputComment"), "Type comment to send to live...")}
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    className="h-7 text-xs"
                    onKeyDown={e => {
                      if (e.key === "Enter" && commentInput.trim() && room.facebookVideoId) {
                        sendCommentMutation.mutate({ videoId: room.facebookVideoId, message: commentInput.trim() });
                        setCommentInput("");
                      }
                    }}
                  />
                  <Button
                    variant="outline" size="sm" className="h-7 px-2 gap-1"
                    title={t("live.pasteClipboard")}
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) setCommentInput(prev => prev ? prev + " " + text : text);
                      } catch { toast.error(t("live.clipboardReadFailed")); }
                    }}
                  >
                    <ClipboardPaste className="h-3 w-3" /> {tt("贴上", "Paste")}
                  </Button>
                  <Button
                    variant="default" size="sm" className="h-7 px-2 gap-1"
                    disabled={!commentInput.trim() || !room.facebookVideoId || sendCommentMutation.isPending}
                    onClick={() => {
                      if (commentInput.trim() && room.facebookVideoId) {
                        sendCommentMutation.mutate({ videoId: room.facebookVideoId, message: commentInput.trim() });
                        setCommentInput("");
                      }
                    }}
                  >
                    <Send className="h-3 w-3" /> {tt("发送", "Send")}
                  </Button>
                </div>
                {!room.facebookVideoId && (
                  <p className="text-xs text-muted-foreground mt-1">{t("live.noVideoId")}</p>
                )}
              </div>
              {/* Row 2: Search */}
              <div className="px-3 pb-1.5">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    id="comment-search"
                    placeholder={tt(t("live.searchComments"), "Search customer/content/keyword/product...")}
                    value={commentSearch}
                    onChange={e => setCommentSearch(e.target.value)}
                    className="h-7 text-xs pl-7"
                  />
                </div>
              </div>
              <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
                <ScrollArea className="h-full w-full">
                  <div className="p-2 space-y-1">
                    {filteredComments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">{tt(t("live.noComments"), "No comments")}</p>
                      </div>
                    ) : (
                      filteredComments.map((comment: any) => (
                        <CommentRow
                          key={comment.id}
                          comment={comment}
                          onClick={() => setSelectedComment(comment)}
                          onMarkHandled={() => markCommentHandledMutation.mutate({ commentId: comment.id })}
                          onAvatarClick={() => openBlacklistForComment(comment)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Region 4: Orders Area (Full Width Bottom) - fixed height */}
          <Card className="flex flex-col flex-shrink-0" style={{ height: "160px" }}>
            <CardHeader className="pb-2 py-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> {tt(t("live.winningOrders"), "Winning Orders")}
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant={orderViewMode === "byCustomer" ? "default" : "outline"}
                    size="sm" className="h-6 text-xs px-2"
onClick={() => setOrderViewMode("byCustomer")}>
                      {tt(t("live.byCustomer"), "By Customer")}
                  </Button>
                  <Button
                    variant={orderViewMode === "byProduct" ? "default" : "outline"}
                    size="sm" className="h-6 text-xs px-2"
                    onClick={() => setOrderViewMode("byProduct")}>
                    {tt(t("live.byProduct"), "By Product")}
                  </Button>
                  <Button
                    variant="outline" size="sm" className="h-6 text-xs px-2 gap-1"
                    onClick={() => {
                      const text = liveOrders.map((o: any) =>
                        `${o.customerName || o.facebookName || "未知"} - ${o.orderNumber} - RM${Number(o.totalAmount || 0).toFixed(2)}`
                      ).join("\n");
                      navigator.clipboard.writeText(text);
                      toast.success(tt(t("live.copyWinningList"), "Winner list copied"));
                    }}
                    title={t("live.copyWinningList")}
                  >
                    <Copy className="h-3 w-3" /> 复制
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 mt-1.5">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder={tt(t("live.searchOrders"), "Search order#/customer...")}
                    value={orderSearch}
                    onChange={e => setOrderSearch(e.target.value)}
                    className="h-7 text-xs pl-7"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
                <ScrollArea className="h-full w-full">
                <div className="p-2 space-y-1.5">
                  {orderViewMode === "byCustomer" ? (
                    filteredOrders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">{orderSearch ? tt(t("live.noMatchingOrder"), "No matching orders") : tt(t("live.noOrders"), "No orders yet")}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {filteredOrders.map((order: any) => (
                          <OrderRow key={order.orderId} order={order} />
                        ))}
                      </div>
                    )
                  ) : (
                    ordersByProduct.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">{tt(t("live.noProductOrders"), "No product orders")}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {ordersByProduct.map((item: any, idx: number) => (
                          <ProductOrderRow key={idx} item={item} />
                        ))}
                      </div>
                    )
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
      {/* Add Products Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("live.addProductsToRoom")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            {/* Search + Category Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("live.searchProducts")}
                  value={productSearchQuery}
                  onChange={e => setProductSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder={t("live.allCategories")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("live.allCategories")}</SelectItem>
                  {(categoriesQuery.data || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  )) as any}
                </SelectContent>
              </Select>
            </div>

            {/* Live price override (optional) */}
            <div className="flex gap-2 items-end">
              <div>
                <Label className="text-xs">{t("live.livePrice")}</Label>
                <Select value={batchAddPriceMode} onValueChange={(v) => setBatchAddPriceMode(v as any)}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">{t("live.useOriginalPrice")}</SelectItem>
                    <SelectItem value="custom">{t("live.customPrice")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {batchAddPriceMode === "custom" && (
                <div>
                  <Label className="text-xs">{t("live.price")}</Label>
                  <Input
                    type="number"
                    placeholder="RM"
                    value={batchAddPrice}
                    onChange={e => setBatchAddPrice(e.target.value)}
                    className="h-8 w-24"
                  />
                </div>
              )}
              <div className="flex-1" />
            </div>

            {/* Search results */}
            {productSearchQuery.length > 0 && (
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                {(productSearchResults.data || []).length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">{t("live.notFoundProduct")}</div>
                ) : (
                  (productSearchResults.data || []).map((p: any) => {
                    const isAdded = !!p.alreadyAdded;
                    const isSelected = batchSelectedIds.includes(p.id);
                    const onHand = p.stockQuantity || 0;
                    const reserved = p.reservedQuantity || 0;
                    const available = onHand - reserved;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-3 p-2 border-b ${isAdded ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"} ${isSelected ? "bg-primary/5" : ""}`}
                        onClick={() => !isAdded && toggleBatchSelection(p)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isAdded}
                          onChange={() => {}}
                          className="h-4 w-4"
                        />
                        {p.coverImageUrl ? (
                          <button
                            type="button"
                            className="h-10 w-10 rounded overflow-hidden flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPreviewImage({ url: p.coverImageUrl, name: p.name || "商品照片" });
                            }}
                            aria-label={`预览并缩放商品图片：${p.name || "商品"}`}
                            title="点击预览并缩放"
                          >
                            <img src={p.coverImageUrl} alt="" className="h-full w-full object-cover" />
                          </button>
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">{t("live.noImage")}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {p.sku || "-"} · On Hand: {onHand} · Reserved: {reserved} · Available: {available}
                          </p>
                          {p.keywords && (
                            <p className="text-xs text-muted-foreground truncate">{t("live.keywords")} {p.keywords}</p>
                          )}
                        </div>
                        {isAdded ? (
                          <Badge variant="outline" className="text-xs text-green-600">{t("live.added")}</Badge>
                        ) : (
                          <span className="text-sm font-medium">RM{Number(p.sellingPrice || 0).toFixed(2)}</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Selected products summary */}
            {batchSelectedIds.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {t("live.selected")} {batchSelectedIds.length} {t("live.productUnit")}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>{t("live.removeProduct")}</Button>
            <Button onClick={handleBatchSubmit} disabled={batchAddMutation.isPending || batchSelectedIds.length === 0}>
              {t("live.batchAdd")} ({batchSelectedIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live Price Edit Dialog */}
      <Dialog open={priceEditOpen} onOpenChange={setPriceEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("live.changePriceTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label>{t("live.livePrice")}</Label>
              <Input
                type="number"
                step="0.01"
                value={priceEditValue}
                onChange={e => setPriceEditValue(e.target.value)}
                placeholder={t("live.inputLivePrice")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("live.priceNote")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceEditOpen(false)}>{t("live.removeProduct")}</Button>
            <Button onClick={handlePriceSave} disabled={updateProductMutation.isPending || !priceEditValue}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageZoomDialog
        open={!!previewImage}
        onOpenChange={(open) => !open && setPreviewImage(null)}
        src={previewImage?.url}
        alt={previewImage?.name || "商品照片"}
        title={previewImage?.name || "商品照片预览"}
      />

      {/* Stock Adjustment Dialog */}
      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("live.adjustStockTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label>{t("live.stockChangeReason")}</Label>
              <Input
                type="number"
                value={stockForm.quantityChange}
                onChange={e => setStockForm({ ...stockForm, quantityChange: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>{t("live.reason")}</Label>
              <Select value={stockForm.reason} onValueChange={v => setStockForm({ ...stockForm, reason: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="other">{t("live.other")}</SelectItem>
                  <SelectItem value="damaged">{t("live.damaged")}</SelectItem>
                  <SelectItem value="scrap">{t("live.scrap")}</SelectItem>
                  <SelectItem value="restock">{t("live.restock")}</SelectItem>
                  <SelectItem value="correction">{t("live.stockCorrection")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">调整会同步至商品管理库存，并自动写入对应商品的库存调整记录。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialogOpen(false)}>{t("live.removeProduct")}</Button>
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
            <DialogTitle>{t("live.confirmEnd")}</DialogTitle>
          </DialogHeader>
          <div className="py-3 text-sm text-muted-foreground">
            {t("live.confirmEndDesc")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndLiveConfirmOpen(false)}>{t("live.removeProduct")}</Button>
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
              <DialogTitle>{t("live.commentDetail")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <div className="flex items-center gap-2">
                <Avatar className={`h-8 w-8 ${selectedComment.isCustomerBlacklisted ? "bg-black text-white ring-2 ring-black" : ""}`}>
                  <AvatarFallback className={`text-xs ${selectedComment.isCustomerBlacklisted ? "bg-black text-white" : ""}`}>{(selectedComment.commenterName || "?").charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{selectedComment.commenterName} {selectedComment.isCustomerBlacklisted && <Badge variant="destructive" className="ml-1 h-5 text-[10px]">{tt("黑名单／不可捉单", "Blacklisted / no order capture")}</Badge>}</p>
                  <p className="text-xs text-muted-foreground">{formatLiveDate(selectedComment.createdAt)}</p>
                </div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-sm">{selectedComment.commentMessage}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">{t("live.keywords")}</span> {selectedComment.parsedKeyword || "-"}</div>
                <div><span className="text-muted-foreground">{t("live.quantity")}</span> {selectedComment.parsedQuantity || "-"}</div>
                <div><span className="text-muted-foreground">{t("live.matchResult")}</span>
                  <span className={`ml-1 inline-flex px-1.5 py-0.5 rounded text-xs ${matchResultColors[selectedComment.matchResult] || ""}`}>
                    {matchResultLabel(selectedComment.matchResult)}
                  </span>
                </div>
                <div><span className="text-muted-foreground">{t("live.product")}</span> {selectedComment.matchedProductName || "-"}</div>
                {selectedComment.orderNumber && (
                  <div className="col-span-2"><span className="text-muted-foreground">{t("live.orderNo")}</span> {selectedComment.orderNumber}</div>
                )}
              </div>
            </div>
            {/* V2.0: Staff Notes Section */}
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">{t("live.staffNote")}</span>
              </div>
              {/* Existing notes */}
              <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
                {(commentNotesQuery.data || []).map((note: any) => (
                  <div key={note.id} className="bg-amber-50 dark:bg-amber-900/20 rounded p-2 text-xs">
                    <p>{note.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-muted-foreground">{note.createdBy || "Admin"} · {formatLiveDate(note.createdAt)}</span>
                      <Button variant="ghost" size="sm" className="h-5 px-1 text-xs text-destructive"
                        onClick={() => { deleteNoteMutation.mutate({ id: note.id }); }}>
                        {tt("删除", "Delete")}
                      </Button>
                    </div>
                  </div>
                ))}
                {(commentNotesQuery.data || []).length === 0 && (
                  <p className="text-xs text-muted-foreground">{t("live.noNotes")}</p>
                )}
              </div>
              {/* Add note input */}
              <div className="flex gap-1">
                <Input
                  placeholder={t("live.addNote")}
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={e => {
                    if (e.key === "Enter" && noteInput.trim() && selectedComment) {
                      createNoteMutation.mutate({
                        liveCommentId: selectedComment.id,
                        liveRoomId: roomId,
                        orderId: selectedComment.orderId,
                        customerId: selectedComment.customerId,
                        content: noteInput.trim(),
                      });
                    }
                  }}
                />
                <Button variant="default" size="sm" className="h-7 px-2"
                  disabled={!noteInput.trim() || createNoteMutation.isPending}
                  onClick={() => {
                    if (noteInput.trim() && selectedComment) {
                      createNoteMutation.mutate({
                        liveCommentId: selectedComment.id,
                        liveRoomId: roomId,
                        orderId: selectedComment.orderId,
                        customerId: selectedComment.customerId,
                        content: noteInput.trim(),
                      });
                    }
                  }}>
                  {tt("添加", "Add")}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" className="gap-1"
                onClick={() => {
                  openBlacklistForComment(selectedComment);
                }}>
                <Ban className="h-4 w-4" /> {t("live.addToBlacklist")}
              </Button>
              {!selectedComment.isHandled && (
                <Button variant="outline" size="sm" className="gap-1"
                  onClick={() => { markCommentHandledMutation.mutate({ commentId: selectedComment.id }); setSelectedComment(null); }}>
                  <CheckCircle2 className="h-4 w-4" /> {t("live.markProcessed")}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedComment(null)}>{t("live.close")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* V2.0: Blacklist Dialog */}
      <Dialog open={blacklistDialogOpen} onOpenChange={setBlacklistDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("live.addToBlacklist")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="text-sm text-muted-foreground">
              {t("live.customer")} {blacklistCustomer?.name || t("live.unknown")}
            </div>
            <div>
              <Label>{t("live.reason")}</Label>
              <Textarea
                value={blacklistReason}
                onChange={e => setBlacklistReason(e.target.value)}
                placeholder={t("live.blacklistReason")}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlacklistDialogOpen(false)}>{t("live.removeProduct")}</Button>
            <Button variant="destructive"
              disabled={blacklistCommenterMutation.isPending || !blacklistReason.trim() || !blacklistCustomer?.name}
              onClick={() => {
                if (blacklistCustomer && blacklistReason.trim()) {
                  blacklistCommenterMutation.mutate({
                    commenterName: blacklistCustomer.name,
                    commenterPsid: blacklistCustomer.psid || undefined,
                    reason: blacklistReason.trim(),
                  });
                }
              }}>
              <Ban className="h-4 w-4" /> {t("live.confirmAdd")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Sub Components ============

function ProductGroupCard({ group, isLive, cardMode, onStatusChange, onTogglePreorder, onAdjustStock, onPriceEdit, onPreview, onDelete, onCopyKeyword }: any) {
  const { t, translate: tt } = useI18n();
  const variations = group.variations || [];
  const hasMultiple = variations.length > 1;
  const totalAvailable = variations.reduce((sum: number, v: any) => sum + (v.availableStock || 0), 0);
  const totalReserved = variations.reduce((sum: number, v: any) => sum + (v.reservedCount || 0), 0);
  const onHand = group.productStockQuantity ?? totalAvailable + totalReserved;

  // Stock color: green >10, yellow 1-10, red =0
  const stockColor = totalAvailable > 10 ? "text-green-600" : totalAvailable > 0 ? "text-yellow-600" : "text-red-600";
  const stockBg = totalAvailable > 10 ? "bg-green-50" : totalAvailable > 0 ? "bg-yellow-50" : "bg-red-50";
  const isCompact = cardMode === 'compact';
  const imgSize = isCompact ? 'w-20 h-20' : 'w-[152px] h-[152px]';
  const imgUrl = group.coverImageUrl || variations[0]?.imageUrl;

  // Placeholder image component (no text, just icon)
  const Placeholder = ({ size = 'h-8 w-8' }: { size?: string }) => (
    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-green-50 to-green-100">
      <ImageIcon className={`${size} text-green-300`} />
    </div>
  );

  return (
    <Card className={`${isCompact ? 'py-1' : ''}`}>
      <CardContent className={isCompact ? 'p-3' : 'p-5'}>
        <div className={`flex ${isCompact ? 'gap-3' : 'gap-5'}`}>
          {/* Left: Product image (fixed ratio, no crop) */}
          <button
            type="button"
            className={`${imgSize} group relative rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary`}
            title={imgUrl ? tt("点击放大商品照片", "Click to enlarge product photo") : tt("商品暂未上传照片", "No product photo uploaded")}
            disabled={!imgUrl}
            onClick={() => imgUrl && onPreview(imgUrl, group.productName || variations[0]?.displayName || tt("商品照片", "Product photo"))}
          >
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={group.productName || ""}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  const ph = img.nextElementSibling;
                  if (ph) ph.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={imgUrl ? 'hidden' : ''}>
              <Placeholder size={isCompact ? 'h-5 w-5' : 'h-8 w-8'} />
            </div>
            {imgUrl ? <span className="absolute inset-0 hidden items-center justify-center bg-black/35 text-white group-hover:flex"><Eye className="h-5 w-5" /></span> : null}
          </button>

          {/* Middle: Product info */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            {isCompact ? (
              <>
                <div className="flex items-center gap-1">
                  <p className="font-bold truncate text-base flex-1">{group.productName}</p>
                  <span className="font-bold text-lg whitespace-nowrap">RM{Number(variations[0]?.price || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <code className="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded font-medium">{group.productKeyword || variations[0]?.keyword || "-"}</code>
                  {hasMultiple && <Badge variant="outline" className="text-xs px-1">{variations.length} {t("live.spec")}</Badge>}
                  {group.productIsPreOrder && <Badge className="bg-blue-100 text-blue-700 text-xs px-1">{t("live.preorder")}</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-base mt-2">
                  <span className="text-muted-foreground">{t("live.inStock")}<b className="text-foreground ml-0.5">{onHand}</b></span>
                  <span className="text-muted-foreground">{t("live.called")}<b className="text-orange-600 ml-0.5">{totalReserved}</b></span>
                  <span className="text-muted-foreground">{t("live.available")}<b className={`${stockColor} ml-0.5`}>{totalAvailable}</b></span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="font-bold truncate text-lg">{group.productName}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{group.productKeyword || variations[0]?.keyword || "-"}</code>
                    {hasMultiple && <Badge variant="outline" className="text-xs px-1">{variations.length} {t("live.spec")}</Badge>}
                    {group.productIsPreOrder && <Badge className="bg-blue-100 text-blue-700 text-xs px-1">{t("live.preorder")}</Badge>}
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  {group.productSellingPrice != null && Number(variations[0]?.price || 0) !== Number(group.productSellingPrice) ? (
                    <span className="text-xl font-bold text-orange-600">RM{Number(variations[0]?.price || 0).toFixed(2)}
                      <span className="line-through text-xs text-muted-foreground/60 ml-1">RM{Number(group.productSellingPrice).toFixed(2)}</span>
                    </span>
                  ) : (
                    <span className="text-xl font-bold">RM{Number(variations[0]?.price || 0).toFixed(2)}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tt("直播价只用于本场新建订单；订单利润按订单商品的成本快照／FIFO成本计算。", "The live price applies only to orders created in this session; order profit uses the item's cost snapshot / FIFO cost.")}</p>
                <div className="flex items-center gap-3 mt-2 text-base">
                  <span className="text-muted-foreground">{t("live.inStock")}<b className="text-foreground ml-0.5">{onHand}</b></span>
                  <span className="text-muted-foreground">{t("live.called")}<b className="text-orange-600 ml-0.5">{totalReserved}</b></span>
                  <span className="text-muted-foreground">{t("live.available")}<b className={`${stockColor} ml-0.5`}>{totalAvailable}</b></span>
                </div>
              </>
            )}
          </div>

          {/* Right: Action buttons - horizontal in compact, vertical in large */}
          {isCompact ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="outline" size="sm" className="h-10 w-10 p-0 justify-center" title={t("live.changePriceTitle")}
                onClick={() => onPriceEdit(variations[0]?.id, Number(variations[0]?.price || 0))}>
                <DollarSign className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-10 w-10 p-0 justify-center" title={t("live.adjustStockTitle")}
                onClick={() => onAdjustStock(variations[0]?.id)}>
                <Package className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-10 w-10 p-0 justify-center" title={t("live.copyKeyword")}
                onClick={() => onCopyKeyword(variations[0]?.id)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-10 w-10 p-0 justify-center text-destructive" title={t("live.removeProduct")}
                onClick={() => onDelete(variations[0]?.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Switch
                checked={variations[0]?.allowPreorder || false}
                onCheckedChange={(val) => onTogglePreorder(variations[0]?.id, val)}
                className="scale-75"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1 flex-shrink-0">
              <Button variant="outline" size="sm" className="h-11 w-12 p-0 justify-center" title={t("live.changePriceTitle")}
                onClick={() => onPriceEdit(variations[0]?.id, Number(variations[0]?.price || 0))}>
                <DollarSign className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-11 w-12 p-0 justify-center" title={t("live.adjustStockTitle")}
                onClick={() => onAdjustStock(variations[0]?.id)}>
                <Package className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-10 w-12 p-0 justify-center" title={t("live.copyKeyword")}
                onClick={() => onCopyKeyword(variations[0]?.id)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-10 w-12 p-0 justify-center text-destructive" title={t("live.removeProduct")}
                onClick={() => onDelete(variations[0]?.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="flex items-center justify-center mt-0.5">
                <Switch
                  checked={variations[0]?.allowPreorder || false}
                  onCheckedChange={(val) => onTogglePreorder(variations[0]?.id, val)}
                  className="scale-75"
                />
              </div>
            </div>
          )}
        </div>

        {/* Multi-variation: show each variation with image + keyword + price */}
        {hasMultiple && (
          <div className="mt-2 space-y-1.5">
            <Separator className="mb-1.5" />
            {variations.map((v: any) => {
              const vAvail = v.availableStock || 0;
              const vColor = vAvail > 10 ? "text-green-600" : vAvail > 0 ? "text-yellow-600" : "text-red-600";
              return (
                <div key={v.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!v.specImage}
                    onClick={() => v.specImage && onPreview(v.specImage, v.displayName || group.productName || "商品规格图片")}
                    className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                    aria-label={v.specImage ? `预览并缩放规格图片：${v.displayName || group.productName || "商品"}` : "暂无规格图片"}
                    title={v.specImage ? "点击预览并缩放" : "暂无规格图片"}
                  >
                    {v.specImage ? (
                      <img src={v.specImage} alt="" className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 text-green-300" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium truncate">{v.displayName}</span>
                    <div className="flex items-center gap-1.5 text-xs">
                      <code className="text-xs bg-muted px-1 rounded">{v.keyword}</code>
                      <span className="font-medium">RM{Number(v.price || 0).toFixed(2)}</span>
                      <span className={vColor}>{t("live.available")}{vAvail}</span>
                      {v.allowPreorder && <Badge className="bg-blue-100 text-blue-700 text-xs px-1">{t("live.preorder")}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {isLive && v.status === "active" && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title={t("live.pause")}
                        onClick={() => onStatusChange(v.id, "paused")}>
                        <Pause className="h-3 w-3" />
                      </Button>
                    )}
                    {isLive && v.status === "paused" && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title={t("live.resume")}
                        onClick={() => onStatusChange(v.id, "active")}>
                        <Play className="h-3 w-3" />
                      </Button>
                    )}
                    {isLive && v.status !== "sold_out" && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title={t("live.soldOut")}
                        onClick={() => onStatusChange(v.id, "sold_out")}>
                        <XCircle className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommentRow({ comment, onClick, onMarkHandled, onAvatarClick }: any) {
  const { t } = useI18n();
  return (
    <div
      className={`flex items-start gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer ${comment.isHandled ? "opacity-60" : ""}`}
      onClick={onClick}
    >
      <button
        type="button"
        title={comment.isCustomerBlacklisted ? "黑名单客户，不可捉单" : "点击将客户加入黑名单"}
        aria-label={comment.isCustomerBlacklisted ? `${comment.commenterName} 已在黑名单` : `将 ${comment.commenterName} 加入黑名单`}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
        onClick={(event) => { event.stopPropagation(); onAvatarClick?.(); }}
      >
        <Avatar className={`h-6 w-6 flex-shrink-0 ${comment.isCustomerBlacklisted ? "bg-black text-white ring-1 ring-black" : ""}`}>
          <AvatarFallback className={`text-xs ${comment.isCustomerBlacklisted ? "bg-black text-white" : ""}`}>{(comment.commenterName || "?").charAt(0)}</AvatarFallback>
        </Avatar>
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium truncate">{comment.commenterName}</span>
          {comment.isCustomerBlacklisted && <Badge variant="destructive" className="h-4 px-1 text-[9px]">黑名单</Badge>}
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
  const { t } = useI18n();
  return (
    <div className="p-2 rounded border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{order.orderNumber}</span>
        <Badge variant="outline" className="text-xs">{order.physicalStatus}</Badge>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {order.customerName || order.facebookName || t("live.unknownCustomer")}
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
  const { t } = useI18n();
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
        {item.orders.length} {t("live.orderUnit")} · {item.orders.filter((o: any) => o.paymentStatus === "paid").length} 已付
      </div>
    </div>
  );
}

function ReportView({ report }: any) {
  const { t } = useI18n();
  const formatTime = (t: any) => {
    if (!t) return "-";
    return new Date(t).toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit" });
  };
  const formatDuration = (mins: number) => {
    if (!mins) return "-";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h} {t("live.hours")} ${m} {t("live.minutes")}` : `${m} {t("live.minutes")}`;
  };
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5" /> {t("live.liveReport")}
      </h2>
      {/* Live time summary */}
      <Card><CardContent className="p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-xs text-muted-foreground">{t("live.startTime")}</p><p className="text-sm font-bold">{formatTime(report.liveStartTime)}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("live.endTime")}</p><p className="text-sm font-bold">{formatTime(report.liveEndTime)}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("live.duration")}</p><p className="text-sm font-bold text-blue-600">{formatDuration(report.durationMinutes || 0)}</p></div>
        </div>
      </CardContent></Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{t("live.totalComments")}</p><p className="text-xl font-bold">{report.totalComments || 0}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{t("live.orderCount")}</p><p className="text-xl font-bold">{report.captureCount || 0}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{t("live.successOrders")}</p><p className="text-xl font-bold">{report.totalOrders || 0}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{t("live.productItems")}</p><p className="text-xl font-bold">{report.totalItems || 0}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{t("live.totalSales")}</p><p className="text-xl font-bold">RM{Number(report.totalRevenue || 0).toFixed(2)}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{t("live.paidAmount")}</p><p className="text-xl font-bold text-green-600">{report.paidOrders || 0}</p></CardContent></Card>
        <Card className="py-2"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{t("live.newCustomers")}</p><p className="text-xl font-bold">{report.newCustomers || 0}</p></CardContent></Card>
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
            <div><p className="text-xs text-muted-foreground">{t("live.sent")}</p><p className="text-lg font-bold text-green-600">{report.messengerSent || 0}</p></div>
            <div><p className="text-xs text-muted-foreground">{t("live.sendFailed")}</p><p className="text-lg font-bold text-red-600">{report.messengerFailed || 0}</p></div>
            <div><p className="text-xs text-muted-foreground">{t("live.successRate")}</p><p className="text-lg font-bold">
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
