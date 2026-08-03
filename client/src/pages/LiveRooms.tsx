import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Video, Calendar, Plane, ChevronRight, Package, ShoppingCart, DollarSign, Boxes, Radio } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import LiveRoomDetail from "./LiveRoomDetail";

const statusColors: Record<string, string> = {
  preparing: "bg-blue-100 text-blue-700",
  live: "bg-green-100 text-green-700",
  ended: "bg-gray-100 text-gray-600",
  closed: "bg-orange-100 text-orange-700",
};

export default function LiveRooms() {
  const { t, lang } = useI18n();
  const queryClient = trpc.useUtils();
  const liveRoomsQuery = trpc.liveRooms.list.useQuery({});
  const batchesQuery = trpc.importBatches.list.useQuery({});
  const liveRooms = liveRoomsQuery.data as any[] | undefined;
  const isLoading = liveRoomsQuery.isLoading;
  const batches = batchesQuery.data as any[] | undefined;

  const [typeFilter, setTypeFilter] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('type') || 'all';
  });

  const [detailRoomId, setDetailRoomId] = useState<number | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setTypeFilter(params.get('type') || 'all');
      const detailId = params.get('detail');
      setDetailRoomId(detailId ? Number(detailId) : null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const roomIds = useMemo(() => (liveRooms || []).map((r: any) => r.id), [liveRooms]);
  const statsQuery = trpc.liveRooms.getStatsBatch.useQuery(
    { liveRoomIds: roomIds },
    { enabled: roomIds.length > 0 }
  );
  const statsMap = (statsQuery.data || {}) as Record<number, any>;

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
    liveType: "normal" as "normal" | "import_preorder",
    facebookLiveUrl: "",
    facebookVideoId: "",
    streamerName: "",
    facebookPageId: "",
    notes: "",
    // Import preorder fields (only shown when liveType is import_preorder)
    importBatchId: "",
    preorderStartDate: "",
    preorderEndDate: "",
    estimatedWaitDays: "",
  });

  const createMutation = trpc.liveRooms.create.useMutation({
    onSuccess: (data: any) => {
      toast.success(t("liveRooms.createSuccess"));
      queryClient.liveRooms.list.invalidate();
      setDialogOpen(false);
      resetForm();
      // Auto-enter the live room after creation
      if (data?.id) {
        setDetailRoomId(data.id);
        const params = new URLSearchParams(window.location.search);
        params.set('detail', String(data.id));
        window.history.pushState({}, '', `${window.location.pathname}?${params}`);
      }
    },
    onError: (e: any) => toast.error(t("liveRooms.createFailed") + ": " + e.message),
  });

  const updateMutation = trpc.liveRooms.update.useMutation({
    onSuccess: () => {
      toast.success(t("liveRooms.updateSuccess"));
      queryClient.liveRooms.list.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(t("liveRooms.updateFailed") + ": " + e.message),
  });

  const deleteMutation = trpc.liveRooms.delete.useMutation({
    onSuccess: () => {
      toast.success(t("liveRooms.deleted"));
      queryClient.liveRooms.list.invalidate();
    },
    onError: (e: any) => toast.error(t("liveRooms.deleteFailed") + ": " + e.message),
  });

  function resetForm() {
    setFormData({
      name: "", liveDate: "", liveType: "normal", facebookLiveUrl: "", facebookVideoId: "",
      streamerName: "", facebookPageId: "", notes: "",
      importBatchId: "", preorderStartDate: "", preorderEndDate: "", estimatedWaitDays: "",
    });
    setEditingId(null);
  }

  function openEdit(room: any) {
    setEditingId(room.id);
    setFormData({
      name: room.name || "",
      liveDate: room.liveDate ? new Date(room.liveDate).toISOString().slice(0, 16) : "",
      liveType: (room.liveType as any) || "normal",
      facebookLiveUrl: room.facebookLiveUrl || "",
      facebookVideoId: room.facebookVideoId || "",
      streamerName: room.streamerName || "",
      facebookPageId: room.facebookPageId || "",
      notes: room.notes || "",
      importBatchId: room.importBatchId ? String(room.importBatchId) : "",
      preorderStartDate: room.preorderStartDate ? new Date(room.preorderStartDate).toISOString().slice(0, 16) : "",
      preorderEndDate: room.preorderEndDate ? new Date(room.preorderEndDate).toISOString().slice(0, 16) : "",
      estimatedWaitDays: room.estimatedWaitDays || "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!formData.name || !formData.liveDate) {
      toast.error(t("liveRooms.fillRequired"));
      return;
    }
    const payload: any = {
      name: formData.name,
      liveDate: new Date(formData.liveDate),
      liveType: formData.liveType,
      facebookLiveUrl: formData.facebookLiveUrl || undefined,
      facebookVideoId: formData.facebookVideoId || undefined,
      streamerName: formData.streamerName || undefined,
      facebookPageId: formData.facebookPageId || undefined,
      notes: formData.notes || undefined,
      status: "preparing",
    };
    if (formData.liveType === "import_preorder") {
      payload.importBatchId = formData.importBatchId ? Number(formData.importBatchId) : undefined;
      payload.preorderStartDate = formData.preorderStartDate ? new Date(formData.preorderStartDate) : undefined;
      payload.preorderEndDate = formData.preorderEndDate ? new Date(formData.preorderEndDate) : undefined;
      payload.estimatedWaitDays = formData.estimatedWaitDays || undefined;
    }
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

  if (detailRoomId !== null) {
    return <LiveRoomDetail roomId={detailRoomId} onBack={closeDetail} />;
  }

  const statusLabelMap: Record<string, string> = {
    preparing: t("liveRooms.statusPreparing"),
    live: t("liveRooms.statusLive"),
    ended: t("liveRooms.statusEnded"),
    closed: t("liveRooms.statusClosed"),
  };

  const localeStr = lang === "en" ? "en-US" : "zh-CN";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Radio className="h-6 w-6 text-green-600" />
            {t("liveRooms.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("liveRooms.subtitle")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("liveRooms.createRoom")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? t("liveRooms.editRoom") : t("liveRooms.createRoom")}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2">
                <Label>{t("liveRooms.roomName")} *</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder={t("liveRooms.roomNamePlaceholder")} />
              </div>
              <div>
                <Label>{t("liveRooms.liveDate")} *</Label>
                <Input type="datetime-local" value={formData.liveDate} onChange={e => setFormData({ ...formData, liveDate: e.target.value })} />
              </div>
              <div>
                <Label>{t("liveRooms.liveType")}</Label>
                <Select value={formData.liveType} onValueChange={v => setFormData({ ...formData, liveType: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">{t("liveRooms.localLive")}</SelectItem>
                    <SelectItem value="import_preorder">{t("liveRooms.importPreorder")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("liveRooms.fbLiveLink")}</Label>
                <Input value={formData.facebookLiveUrl} onChange={e => setFormData({ ...formData, facebookLiveUrl: e.target.value })} placeholder={t("liveRooms.fbLiveLinkPlaceholder")} />
              </div>
              <div>
                <Label>{t("liveRooms.fbVideoId")}</Label>
                <Input value={formData.facebookVideoId} onChange={e => setFormData({ ...formData, facebookVideoId: e.target.value })} placeholder={t("liveRooms.fbVideoIdPlaceholder")} disabled />
              </div>
              <div>
                <Label>{t("liveRooms.streamerOptional")}</Label>
                <Input value={formData.streamerName} onChange={e => setFormData({ ...formData, streamerName: e.target.value })} placeholder={t("liveRooms.streamerPlaceholder")} />
              </div>
              <div>
                <Label>{t("liveRooms.fbPageId")}</Label>
                <Input value={formData.facebookPageId} onChange={e => setFormData({ ...formData, facebookPageId: e.target.value })} placeholder={t("liveRooms.fbPageIdPlaceholder")} />
              </div>
              {formData.liveType === "import_preorder" && (
                <>
                  <div>
                    <Label>{t("liveRooms.importBatch")} *</Label>
                    <Select value={formData.importBatchId} onValueChange={v => setFormData({ ...formData, importBatchId: v })}>
                      <SelectTrigger><SelectValue placeholder={t("liveRooms.selectBatch")} /></SelectTrigger>
                      <SelectContent>
                        {(batches || []).map((b: any) => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.batchNumber} - {b.batchName}</SelectItem>
                        )) as any}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("liveRooms.estimatedWait")} *</Label>
                    <Input value={formData.estimatedWaitDays} onChange={e => setFormData({ ...formData, estimatedWaitDays: e.target.value })} placeholder={t("liveRooms.estimatedWaitPlaceholder")} />
                  </div>
                  <div>
                    <Label>{t("liveRooms.preorderStart")}</Label>
                    <Input type="datetime-local" value={formData.preorderStartDate} onChange={e => setFormData({ ...formData, preorderStartDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("liveRooms.preorderEnd")} *</Label>
                    <Input type="datetime-local" value={formData.preorderEndDate} onChange={e => setFormData({ ...formData, preorderEndDate: e.target.value })} />
                  </div>
                </>
              )}
              <div className="col-span-2">
                <Label>{t("liveRooms.notes")}</Label>
                <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("liveRooms.cancel")}</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? t("liveRooms.save") : t("liveRooms.createAndEnter")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: t("liveRooms.all") },
          { value: 'normal', label: t("liveRooms.localLive") },
          { value: 'import_preorder', label: t("liveRooms.importPreorder") },
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
            <div className="p-8 text-center text-muted-foreground">{t("liveRooms.loading")}</div>
          ) : !filteredRooms || filteredRooms.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{typeFilter === 'import_preorder' ? t("liveRooms.noImportPreorder") : typeFilter === 'normal' ? t("liveRooms.noLocalLive") : t("liveRooms.noLiveAtAll")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("liveRooms.colName")}</TableHead>
                  <TableHead>{t("liveRooms.colType")}</TableHead>
                  <TableHead>{t("liveRooms.colDate")}</TableHead>
                  <TableHead>{t("liveRooms.colStreamer")}</TableHead>
                  <TableHead>{t("liveRooms.colStatus")}</TableHead>
                  <TableHead className="text-center">{t("liveRooms.colProductCount")}</TableHead>
                  <TableHead className="text-center">{t("liveRooms.colOrderCount")}</TableHead>
                  <TableHead className="text-center">{t("liveRooms.colTotalItems")}</TableHead>
                  <TableHead className="text-right">{t("liveRooms.colRevenue")}</TableHead>
                  <TableHead className="text-right">{t("liveRooms.colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room: any) => {
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
                          <Badge className="gap-1 bg-purple-100 text-purple-700"><Plane className="h-3 w-3" />{t("liveRooms.importPreorder")}</Badge>
                        ) : (
                          <Badge variant="secondary">{t("liveRooms.localLive")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {room.liveDate ? new Date(room.liveDate).toLocaleDateString(localeStr) : "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {room.streamerName || "-"}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[room.status] || ""}`}>
                          {statusLabelMap[room.status] || room.status}
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
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm(t("liveRooms.confirmDelete"))) deleteMutation.mutate({ id: room.id } as any); }} className="h-8 w-8 p-0 text-destructive">
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
