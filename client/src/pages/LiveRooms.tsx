import { useState, useEffect, useMemo } from "react";
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
import { Plus, Pencil, Trash2, Video, Calendar, Clock, Plane, ChevronRight, Package, ShoppingCart, DollarSign, Boxes } from "lucide-react";
import { toast } from "sonner";
import LiveRoomDetail from "./LiveRoomDetail";

const liveTypeLabels: Record<string, string> = {
  normal: "本地直播",
  import_preorder: "中国代购",
};

const statusLabels: Record<string, string> = {
  preparing: "准备中",
  live: "直播中",
  ended: "已结束",
  closed: "已截止",
};

const statusColors: Record<string, string> = {
  preparing: "bg-blue-100 text-blue-700",
  live: "bg-green-100 text-green-700",
  ended: "bg-gray-100 text-gray-600",
  closed: "bg-orange-100 text-orange-700",
};

export default function LiveRooms() {
  const queryClient = trpc.useUtils();
  const liveRoomsQuery = trpc.liveRooms.list.useQuery({});
  const batchesQuery = trpc.importBatches.list.useQuery({});
  const liveRooms = liveRoomsQuery.data as any[] | undefined;
  const isLoading = liveRoomsQuery.isLoading;
  const batches = batchesQuery.data as any[] | undefined;

  // Read ?type= URL param to filter by live type (normal / import_preorder)
  const [typeFilter, setTypeFilter] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('type') || 'all';
  });

  // Detail view state — when set, show LiveRoomDetail instead of list
  const [detailRoomId, setDetailRoomId] = useState<number | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setTypeFilter(params.get('type') || 'all');
      // Check for ?detail=ID param
      const detailId = params.get('detail');
      setDetailRoomId(detailId ? Number(detailId) : null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch batch stats for all visible rooms
  const roomIds = useMemo(() => (liveRooms || []).map((r: any) => r.id), [liveRooms]);
  const statsQuery = trpc.liveRooms.getStatsBatch.useQuery(
    { liveRoomIds: roomIds },
    { enabled: roomIds.length > 0 }
  );
  const statsMap = (statsQuery.data || {}) as Record<number, any>;

  // Filter rooms by type
  const filteredRooms = (liveRooms || []).filter((room: any) => {
    if (typeFilter === 'all') return true;
    if (typeFilter === 'import_preorder') return room.liveType === 'import_preorder';
    if (typeFilter === 'normal') return room.liveType !== 'import_preorder';
    return true;
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    liveDate: "",
    facebookLiveUrl: "",
    facebookVideoId: "",
    liveType: "normal" as "normal" | "import_preorder",
    importBatchId: "",
    preorderStartDate: "",
    preorderEndDate: "",
    estimatedWaitDays: "",
    status: "preparing" as "preparing" | "live" | "ended" | "closed",
    notes: "",
  });

  const createMutation = trpc.liveRooms.create.useMutation({
    onSuccess: () => {
      toast.success("直播房间创建成功");
      queryClient.liveRooms.list.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error("创建失败: " + e.message),
  });

  const updateMutation = trpc.liveRooms.update.useMutation({
    onSuccess: () => {
      toast.success("直播房间更新成功");
      queryClient.liveRooms.list.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error("更新失败: " + e.message),
  });

  const deleteMutation = trpc.liveRooms.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      queryClient.liveRooms.list.invalidate();
    },
    onError: (e: any) => toast.error("删除失败: " + e.message),
  });

  function resetForm() {
    setFormData({
      name: "", liveDate: "", facebookLiveUrl: "", facebookVideoId: "",
      liveType: "normal", importBatchId: "", preorderStartDate: "", preorderEndDate: "",
      estimatedWaitDays: "", status: "preparing", notes: "",
    });
    setEditingId(null);
  }

  function openEdit(room: any) {
    setEditingId(room.id);
    setFormData({
      name: room.name || "",
      liveDate: room.liveDate ? new Date(room.liveDate).toISOString().slice(0, 16) : "",
      facebookLiveUrl: room.facebookLiveUrl || "",
      facebookVideoId: room.facebookVideoId || "",
      liveType: (room.liveType as any) || "normal",
      importBatchId: room.importBatchId ? String(room.importBatchId) : "",
      preorderStartDate: room.preorderStartDate ? new Date(room.preorderStartDate).toISOString().slice(0, 16) : "",
      preorderEndDate: room.preorderEndDate ? new Date(room.preorderEndDate).toISOString().slice(0, 16) : "",
      estimatedWaitDays: room.estimatedWaitDays || "",
      status: (room.status as any) || "preparing",
      notes: room.notes || "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!formData.name || !formData.liveDate) {
      toast.error("请填写直播名称和日期");
      return;
    }
    const payload: any = {
      name: formData.name,
      liveDate: new Date(formData.liveDate),
      facebookLiveUrl: formData.facebookLiveUrl || undefined,
      facebookVideoId: formData.facebookVideoId || undefined,
      liveType: formData.liveType,
      importBatchId: formData.importBatchId ? Number(formData.importBatchId) : undefined,
      preorderStartDate: formData.preorderStartDate ? new Date(formData.preorderStartDate) : undefined,
      preorderEndDate: formData.preorderEndDate ? new Date(formData.preorderEndDate) : undefined,
      estimatedWaitDays: formData.estimatedWaitDays || undefined,
      status: formData.status,
      notes: formData.notes || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function openDetail(roomId: number) {
    setDetailRoomId(roomId);
    const params = new URLSearchParams(window.location.search);
    params.set('detail', String(roomId));
    window.history.pushState({}, '', `${window.location.pathname}?${params}`);
  }

  function closeDetail() {
    setDetailRoomId(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('detail');
    const qs = params.toString();
    window.history.pushState({}, '', `${window.location.pathname}${qs ? '?' + qs : ''}`);
  }

  // Show detail view if set
  if (detailRoomId !== null) {
    return <LiveRoomDetail roomId={detailRoomId} onBack={closeDetail} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">直播管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理本地直播和中国代购直播</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <Plus className="h-4 w-4" />
              新增直播
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "编辑直播" : "新增直播"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2">
                <Label>直播名称 *</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="例如: 7月直播" />
              </div>
              <div>
                <Label>直播日期 *</Label>
                <Input type="datetime-local" value={formData.liveDate} onChange={e => setFormData({ ...formData, liveDate: e.target.value })} />
              </div>
              <div>
                <Label>直播类型</Label>
                <Select value={formData.liveType} onValueChange={v => setFormData({ ...formData, liveType: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">本地直播</SelectItem>
                    <SelectItem value="import_preorder">中国代购直播</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.liveType === "import_preorder" && (
                <>
                  <div>
                    <Label>所属采购批次 *</Label>
                    <Select value={formData.importBatchId} onValueChange={v => setFormData({ ...formData, importBatchId: v })}>
                      <SelectTrigger><SelectValue placeholder="选择批次" /></SelectTrigger>
                      <SelectContent>
                        {(batches || []).map((b: any) => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.batchNumber} - {b.batchName}</SelectItem>
                        )) as any}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>预计等待时间 *</Label>
                    <Input value={formData.estimatedWaitDays} onChange={e => setFormData({ ...formData, estimatedWaitDays: e.target.value })} placeholder="例如: 30~45天" />
                  </div>
                  <div>
                    <Label>代购开始日期</Label>
                    <Input type="datetime-local" value={formData.preorderStartDate} onChange={e => setFormData({ ...formData, preorderStartDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>代购截止日期 *</Label>
                    <Input type="datetime-local" value={formData.preorderEndDate} onChange={e => setFormData({ ...formData, preorderEndDate: e.target.value })} />
                  </div>
                </>
              )}
              <div>
                <Label>Facebook Live Link</Label>
                <Input value={formData.facebookLiveUrl} onChange={e => setFormData({ ...formData, facebookLiveUrl: e.target.value })} placeholder="https://www.facebook.com/..." />
              </div>
              <div>
                <Label>Facebook Video ID</Label>
                <Input value={formData.facebookVideoId} onChange={e => setFormData({ ...formData, facebookVideoId: e.target.value })} placeholder="用于嵌入回放" />
              </div>
              <div>
                <Label>状态</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preparing">准备中</SelectItem>
                    <SelectItem value="live">直播中</SelectItem>
                    <SelectItem value="ended">已结束</SelectItem>
                    <SelectItem value="closed">已截止</SelectItem>
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

      {/* Type filter tabs */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: '全部' },
          { value: 'normal', label: '本地直播' },
          { value: 'import_preorder', label: '中国代购' },
        ].map(tab => (
          <Button
            key={tab.value}
            variant={typeFilter === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTypeFilter(tab.value);
              const params = new URLSearchParams(window.location.search);
              if (tab.value === 'all') params.delete('type');
              else params.set('type', tab.value);
              const qs = params.toString();
              window.history.replaceState({}, '', `${window.location.pathname}${qs ? '?' + qs : ''}`);
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : !filteredRooms || filteredRooms.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{typeFilter === 'import_preorder' ? '暂无中国代购直播' : typeFilter === 'normal' ? '暂无本地直播' : '暂无直播，点击右上角新增'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>直播名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>直播日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-center">商品数</TableHead>
                  <TableHead className="text-center">订单数</TableHead>
                  <TableHead className="text-center">商品数量</TableHead>
                  <TableHead className="text-right">喊单业绩</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room: any) => {
                  const batch = (batches || []).find((b: any) => b.id === room.importBatchId) as any;
                  const stats = statsMap[room.id] || { productCount: 0, orderCount: 0, totalItems: 0, totalRevenue: "0.00" };
                  return (
                    <TableRow key={room.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(room.id)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          {room.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {room.liveType === "import_preorder" ? (
                          <Badge className="gap-1 bg-purple-100 text-purple-700"><Plane className="h-3 w-3" />中国代购</Badge>
                        ) : (
                          <Badge variant="secondary">本地直播</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {room.liveDate ? new Date(room.liveDate).toLocaleDateString("zh-CN") : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[room.status] || ""}`}>
                          {statusLabels[room.status] || room.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Package className="h-3 w-3 text-muted-foreground" />
                          {stats.productCount || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                          {stats.orderCount || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Boxes className="h-3 w-3 text-muted-foreground" />
                          {stats.totalItems || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 text-sm font-medium">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          RM{(Number(stats.totalRevenue) || 0).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(room)} className="h-8 w-8 p-0">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("确认删除？")) deleteMutation.mutate({ id: room.id } as any); }} className="h-8 w-8 p-0 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
