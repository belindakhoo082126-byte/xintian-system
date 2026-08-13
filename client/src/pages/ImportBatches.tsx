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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Plane, Package, Calculator, CheckCircle2, AlertTriangle, Printer, CalendarDays, Layers3, Link2, Clock3, FileCheck2 } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  draft: "草稿",
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
  draft: "bg-gray-100 text-gray-500",
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
  wrong_item: "错发",
};

const differenceReasonLabels: Record<string, string> = {
  none: "无差异",
  supplier_short: "供应商少发",
  over_supply: "供应商多发",
  damaged: "运输损坏",
  dead: "到货死亡",
  wrong_item: "错发商品",
  not_arrived: "未到货",
  other: "其他",
};

export default function ImportBatches() {
  const queryClient = trpc.useUtils();
  const batchesQuery = trpc.importBatches.list.useQuery({});
  const batches = batchesQuery.data as any[] | undefined;
  const cnIbSummaryQuery = trpc.importBatches.getDashboardSummary.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const cnIbSummary = cnIbSummaryQuery.data as any | undefined;

  // Read ?tab= URL param to switch between CN (China Purchase) and IB (Import Batch) views
  const [urlTab, setUrlTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'cn';
  });
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setUrlTab(params.get('tab') || 'cn');
      // Return to list view when tab changes via URL navigation
      setSelectedBatchId(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 按单据类型区分 CN / IB，避免自动创建且仍在等待到货的 IB 被状态筛选隐藏。
  const filteredBatches = (batches || []).filter((batch: any) => {
    if (urlTab === 'cn') return batch.documentType === 'cn';
    if (urlTab === 'ib') return batch.documentType === 'ib';
    return true;
  });
  const selectedBatch = (batches || []).find((batch: any) => batch.id === selectedBatchId) as any | undefined;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [cnCreateOpen, setCnCreateOpen] = useState(false);
  const [cnStep, setCnStep] = useState<1 | 2 | 3>(1);
  const [cnRange, setCnRange] = useState({ startDate: "", endDate: "" });
  const [selectedSessionMap, setSelectedSessionMap] = useState<Record<number, boolean>>({});
  const [selectedProductQuantities, setSelectedProductQuantities] = useState<Record<string, number>>({});
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
    status: "draft" as string,
    notes: "",
    supplierOrderNumber: "",
    chinaTrackingNumber: "",
    otherFees: "0",
    paymentDeadline: "",
  });

  const liveRoomsQuery = trpc.liveRooms.list.useQuery({});
  const liveRooms = liveRoomsQuery.data as any[] | undefined;

  const cnSessionInput = useMemo(() => ({ startDate: cnRange.startDate, endDate: cnRange.endDate }), [cnRange.startDate, cnRange.endDate]);
  const cnSessionsQuery = trpc.importBatches.getCnEligibleLiveSessions.useQuery(cnSessionInput, {
    enabled: cnCreateOpen && Boolean(cnRange.startDate && cnRange.endDate && cnRange.startDate <= cnRange.endDate),
  });
  const selectedLiveSessionIds = useMemo(
    () => Object.entries(selectedSessionMap).filter(([, selected]) => selected).map(([id]) => Number(id)),
    [selectedSessionMap],
  );
  const cnMergedInput = useMemo(() => ({ liveSessionIds: selectedLiveSessionIds }), [selectedLiveSessionIds]);
  const cnMergedProductsQuery = trpc.importBatches.getCnMergedProducts.useQuery(cnMergedInput, {
    enabled: cnCreateOpen && selectedLiveSessionIds.length > 0,
  });

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

  const updateCnWithAuditMutation = trpc.importBatches.updateCnWithAudit.useMutation({
    onSuccess: () => {
      toast.success("CN 已更新，修改内容已写入审计记录。");
      queryClient.importBatches.list.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(`更新 CN 失败：${e.message}`),
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

  const confirmCnMutation = trpc.importBatches.confirmCn.useMutation({
    onSuccess: (data: any) => {
      toast.success(`CN确认成功！预计成本: RM ${data.estimatedCost?.toFixed(2)}`);
      queryClient.importBatches.list.invalidate();
      queryClient.importBatches.items.invalidate();
    },
    onError: (e: any) => toast.error("CN确认失败: " + e.message),
  });

  const completeIbMutation = trpc.importBatches.completeIb.useMutation({
    onSuccess: (data: any) => {
      toast.success(`IB验货完成！库存已更新，${data.matchedOrders || 0}张XTC订单已自动匹配`);
      queryClient.importBatches.list.invalidate();
      queryClient.importBatches.items.invalidate();
    },
    onError: (e: any) => toast.error("IB完成失败: " + e.message),
  });

  const createSplitArrivalIbMutation = trpc.importBatches.createSplitArrivalIb.useMutation({
    onSuccess: (data: any) => {
      toast.success(`已建立分批到货 ${data.batchNumber}，请填写本批实际到货数量。`);
      queryClient.importBatches.list.invalidate();
      setSelectedBatchId(data.ibId);
      setUrlTab('ib');
      window.history.replaceState({}, '', `${window.location.pathname}?tab=ib`);
    },
    onError: (e: any) => toast.error(`建立分批到货 IB 失败：${e.message}`),
  });

  const allocateAllMutation = trpc.importBatches.allocateAllCosts.useMutation({
    onSuccess: (data: any) => {
      toast.success(`费用分摊完成！`);
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

  const lockIbMutation = trpc.importBatches.lock.useMutation({
    onSuccess: () => {
      toast.success("IB 已锁定；如需修改，请先解锁并说明原因。");
      queryClient.importBatches.list.invalidate();
    },
    onError: (e: any) => toast.error(`锁定失败：${e.message}`),
  });

  const unlockIbMutation = trpc.importBatches.unlock.useMutation({
    onSuccess: () => {
      toast.success("IB 已解锁，原因已记录在审计日志。");
      queryClient.importBatches.list.invalidate();
    },
    onError: (e: any) => toast.error(`解锁失败：${e.message}`),
  });

  const createCnWithAutoIbMutation = trpc.importBatches.createCnWithAutoIb.useMutation({
    onSuccess: (data: any) => {
      toast.success(`已建立 ${data.cnNumber}，并自动关联 ${data.ibNumber}（等待到货）。`);
      queryClient.importBatches.list.invalidate();
      queryClient.importBatches.items.invalidate();
      setCnCreateOpen(false);
      setSelectedBatchId(data.cnId);
      setUrlTab('cn');
      window.history.replaceState({}, '', `${window.location.pathname}?tab=cn`);
      resetCnWizard();
    },
    onError: (e: any) => toast.error(`建立 CN 失败：${e.message}`),
  });

  function resetCnWizard() {
    setCnStep(1);
    setCnRange({ startDate: "", endDate: "" });
    setSelectedSessionMap({});
    setSelectedProductQuantities({});
  }

  function productKey(product: any) {
    return `${product.productId}:${product.variantId ?? "base"}`;
  }

  function toggleCnProduct(product: any, selected: boolean) {
    const key = productKey(product);
    setSelectedProductQuantities(previous => {
      const next = { ...previous };
      if (selected) next[key] = product.paidQuantity || 0;
      else delete next[key];
      return next;
    });
  }

  function printCurrentBatch() {
    const batch = (batches || []).find((item: any) => item.id === selectedBatchId);
    if (!batch) return;
    const escapeHtml = (value: unknown) => String(value ?? "-")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
    const rows = (batchItems || []).map((item: any) => `<tr><td>${escapeHtml(item.productName)}</td><td>${escapeHtml(item.finalPurchaseQuantity ?? item.paidQuantity)}</td><td>${escapeHtml(item.unitPurchaseCost ? `RM ${item.unitPurchaseCost}` : "-")}</td></tr>`).join("");
    const title = batch.documentType === 'ib' ? 'IB 入库单' : 'CN 中国采购单';
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=850,height=900');
    if (!printWindow) { toast.error('浏览器阻止了打印窗口，请允许弹出窗口后重试。'); return; }
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title} ${escapeHtml(batch.batchNumber)}</title><style>body{font-family:Arial,"Noto Sans SC",sans-serif;color:#1f2937;margin:28px}h1{color:#14532d;font-size:24px;margin:0 0 4px}.meta{color:#475569;margin-bottom:20px}.card{border:1px solid #cbd5e1;border-radius:8px;padding:16px;margin:12px 0}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f0fdf4;color:#14532d}@media print{body{margin:12mm}.no-print{display:none}}</style></head><body><h1>心田 Xintian · ${title}</h1><p class="meta">单据编号：${escapeHtml(batch.batchNumber)}　打印日期：${new Date().toLocaleString('zh-MY')}</p><div class="card"><strong>批次名称：</strong>${escapeHtml(batch.batchName)}<br><strong>供应商：</strong>${escapeHtml(batch.supplierName)}<br><strong>开始／截止：</strong>${escapeHtml(batch.startDate || batch.preorderStartDate)} ～ ${escapeHtml(batch.endDate || batch.preorderEndDate)}<br><strong>状态：</strong>${escapeHtml(statusLabels[batch.status] || batch.status)}</div><table><thead><tr><th>商品</th><th>采购数量</th><th>单位成本</th></tr></thead><tbody>${rows || '<tr><td colspan="3">暂无商品</td></tr>'}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
  }

  function resetForm() {
    setFormData({
      batchNumber: "", batchName: "", sourceCountry: "中国", supplierName: "",
      liveRoomId: "", preorderStartDate: "", preorderEndDate: "",
      shippingMethod: "air", chinaShippingCost: "0", status: "draft", notes: "",
      supplierOrderNumber: "", chinaTrackingNumber: "", otherFees: "0", paymentDeadline: "",
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
      status: batch.status || "draft",
      notes: batch.notes || "",
      supplierOrderNumber: batch.supplierOrderNumber || "",
      chinaTrackingNumber: batch.chinaTrackingNumber || "",
      otherFees: batch.otherFees?.toString() || "0",
      paymentDeadline: batch.paymentDeadline || "",
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
      supplierOrderNumber: formData.supplierOrderNumber || undefined,
      chinaTrackingNumber: formData.chinaTrackingNumber || undefined,
      otherFees: formData.otherFees || undefined,
    };
    if (editingId && selectedBatch?.documentType === 'cn') {
      const toDateOnly = (value: string) => value ? value.slice(0, 10) : undefined;
      updateCnWithAuditMutation.mutate({
        cnId: editingId,
        changes: {
          batchName: formData.batchName,
          supplierName: formData.supplierName || null,
          supplierOrderNumber: formData.supplierOrderNumber || null,
          chinaTrackingNumber: formData.chinaTrackingNumber || null,
          startDate: toDateOnly(formData.preorderStartDate),
          endDate: toDateOnly(formData.preorderEndDate),
          paymentDeadline: formData.paymentDeadline || undefined,
          chinaShippingCost: formData.chinaShippingCost,
          otherFees: formData.otherFees,
          notes: formData.notes || null,
          status: formData.status,
        },
      });
    } else if (editingId) {
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
        {urlTab === 'cn' ? (<>
          <Dialog open={cnCreateOpen} onOpenChange={(open) => { setCnCreateOpen(open); if (!open) resetCnWizard(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetCnWizard}>
                <Plus className="h-4 w-4" />
                新建 CN 采购单
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>新建中国采购单（CN）</DialogTitle>
                <p className="text-sm text-muted-foreground">选日期 → 选直播 → 合并商品 → 确认采购，系统会自动建立关联 IB（等待到货）。</p>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {[['1', '选择日期与直播'], ['2', '合并并选择商品'], ['3', '确认采购数量']].map(([step, label]) => (
                  <div key={step} className={`rounded-lg border px-3 py-2 ${cnStep === Number(step) ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'text-muted-foreground'}`}>
                    <span className="font-semibold">步骤 {step}</span> · {label}
                  </div>
                ))}
              </div>

              {cnStep === 1 && (
                <div className="space-y-4 py-2">
                  <Card className="border-emerald-100 bg-emerald-50/40">
                    <CardContent className="grid gap-4 p-4 md:grid-cols-2">
                      <div><Label>直播开始日期 *</Label><Input type="date" value={cnRange.startDate} onChange={e => setCnRange(prev => ({ ...prev, startDate: e.target.value }))} /></div>
                      <div><Label>直播截止日期 *</Label><Input type="date" min={cnRange.startDate || undefined} value={cnRange.endDate} onChange={e => setCnRange(prev => ({ ...prev, endDate: e.target.value }))} /></div>
                    </CardContent>
                  </Card>
                  {!cnRange.startDate || !cnRange.endDate ? <p className="text-sm text-muted-foreground">请先选择日期范围，系统会列出期间内的中国代购直播场次。</p> : cnSessionsQuery.isLoading ? <p className="text-sm text-muted-foreground">正在查询直播场次…</p> : (cnSessionsQuery.data || []).length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">该日期范围没有中国代购直播场次。</p> : (
                    <div className="space-y-2">
                      {(cnSessionsQuery.data as any[]).map(session => (
                        <label key={session.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/30">
                          <input type="checkbox" checked={Boolean(selectedSessionMap[session.id])} onChange={e => setSelectedSessionMap(prev => ({ ...prev, [session.id]: e.target.checked }))} className="h-4 w-4 accent-emerald-700" />
                          <CalendarDays className="h-4 w-4 text-emerald-700" />
                          <span className="font-medium">{session.name}</span>
                          <span className="ml-auto text-sm text-muted-foreground">{session.liveDate ? new Date(session.liveDate).toLocaleDateString('zh-MY') : '-'} · {session.productCount} 项商品</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {cnStep === 2 && (
                <div className="space-y-3 py-2">
                  <p className="text-sm text-muted-foreground">同一商品 ID 已按所选直播自动合并；数字为互斥阶段，部分发货按实际发货数量拆分。展开可查看每场直播的贡献。</p>
                  {cnMergedProductsQuery.isLoading ? <p className="text-sm text-muted-foreground">正在合并商品…</p> : (cnMergedProductsQuery.data || []).length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">所选直播没有可合并的商品。</p> : (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader><TableRow><TableHead>选择</TableHead><TableHead>商品／出现直播</TableHead><TableHead>已下单</TableHead><TableHead>已汇款</TableHead><TableHead>已完成</TableHead><TableHead>各场次明细</TableHead></TableRow></TableHeader>
                        <TableBody>{(cnMergedProductsQuery.data as any[]).map(product => {
                          const key = productKey(product); const selected = key in selectedProductQuantities;
                          return <TableRow key={key} className={selected ? 'bg-emerald-50/50' : ''}>
                            <TableCell><input aria-label={`选择${product.productName}`} type="checkbox" checked={selected} onChange={e => toggleCnProduct(product, e.target.checked)} className="h-4 w-4 accent-emerald-700" /></TableCell>
                            <TableCell><div className="font-medium">{product.productName}</div><div className="text-xs text-muted-foreground">{product.liveSessionCount} 场直播</div></TableCell>
                            <TableCell>{product.orderedQuantity}</TableCell><TableCell className="font-semibold text-sky-700">{product.paidQuantity}</TableCell><TableCell className="text-emerald-700">{product.completedQuantity}</TableCell>
                            <TableCell><details><summary className="cursor-pointer text-xs text-muted-foreground">查看分场次</summary><div className="mt-2 space-y-1 text-xs">{product.sessions.map((session: any) => <div key={session.liveRoomId}>{session.liveRoomName}：下单 {session.orderedQuantity}／汇款 {session.paidQuantity}／完成 {session.completedQuantity}</div>)}</div></details></TableCell>
                          </TableRow>;
                        })}</TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {cnStep === 3 && (
                <div className="space-y-4 py-2">
                  <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-3 text-sm text-sky-900">本次采购数量已默认带入每项商品的「已汇款」数量。您可调整最终采购量；未勾选商品不会进入 CN，也不会改变本地库存。</div>
                  <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>商品</TableHead><TableHead>已下单</TableHead><TableHead>已汇款</TableHead><TableHead>已完成</TableHead><TableHead>本次采购数量</TableHead></TableRow></TableHeader><TableBody>{(cnMergedProductsQuery.data as any[] || []).filter(product => productKey(product) in selectedProductQuantities).map(product => { const key = productKey(product); return <TableRow key={key}><TableCell className="font-medium">{product.productName}</TableCell><TableCell>{product.orderedQuantity}</TableCell><TableCell>{product.paidQuantity}</TableCell><TableCell>{product.completedQuantity}</TableCell><TableCell><Input type="number" min="0" className="h-8 w-28" value={selectedProductQuantities[key]} onChange={e => setSelectedProductQuantities(prev => ({ ...prev, [key]: Math.max(0, Number(e.target.value) || 0) }))} /></TableCell></TableRow>; })}</TableBody></Table></div>
                  <p className="text-sm text-muted-foreground">汇款期限将自动设为截止日期后两天：<strong className="ml-1 text-foreground">{cnRange.endDate ? new Date(`${cnRange.endDate}T00:00:00`).toLocaleDateString('zh-MY', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'}</strong>（保存后可在 CN 编辑）。</p>
                </div>
              )}

              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="outline" onClick={() => { if (cnStep === 1) { setCnCreateOpen(false); resetCnWizard(); } else setCnStep((cnStep - 1) as 1 | 2 | 3); }}> {cnStep === 1 ? '取消' : '上一步'} </Button>
                {cnStep < 3 ? <Button onClick={() => { if (cnStep === 1 && selectedLiveSessionIds.length === 0) { toast.error('请至少勾选一场中国代购直播。'); return; } if (cnStep === 2 && Object.keys(selectedProductQuantities).length === 0) { toast.error('请至少勾选一个要采购的商品。'); return; } setCnStep((cnStep + 1) as 1 | 2 | 3); }}>下一步</Button> : <Button disabled={createCnWithAutoIbMutation.isPending || Object.keys(selectedProductQuantities).length === 0} onClick={() => { const products = (cnMergedProductsQuery.data as any[] || []).filter(product => productKey(product) in selectedProductQuantities); createCnWithAutoIbMutation.mutate({ startDate: cnRange.startDate, endDate: cnRange.endDate, liveSessionIds: selectedLiveSessionIds, items: products.map(product => ({ productId: product.productId, productName: product.productName, variantId: product.variantId ?? null, paidQuantity: product.paidQuantity, finalPurchaseQuantity: selectedProductQuantities[productKey(product)] })) }); }}>建立 CN 并自动生成 IB</Button>}
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>编辑中国采购单（CN）</DialogTitle>
                <p className="text-sm text-muted-foreground">保存时会逐项记录修改前后内容、操作人及时间。</p>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-4 py-3 md:grid-cols-2">
                <div><Label>CN 编号</Label><Input value={formData.batchNumber} disabled /></div>
                <div><Label>采购单名称 *</Label><Input value={formData.batchName} onChange={e => setFormData({ ...formData, batchName: e.target.value })} /></div>
                <div><Label>供应商</Label><Input value={formData.supplierName} onChange={e => setFormData({ ...formData, supplierName: e.target.value })} /></div>
                <div><Label>供应商订单号</Label><Input value={formData.supplierOrderNumber} onChange={e => setFormData({ ...formData, supplierOrderNumber: e.target.value })} /></div>
                <div><Label>开始日期</Label><Input type="date" value={formData.preorderStartDate.slice(0, 10)} onChange={e => setFormData({ ...formData, preorderStartDate: e.target.value })} /></div>
                <div><Label>截止日期</Label><Input type="date" value={formData.preorderEndDate.slice(0, 10)} onChange={e => setFormData({ ...formData, preorderEndDate: e.target.value })} /></div>
                <div><Label>汇款期限</Label><Input type="date" value={formData.paymentDeadline} onChange={e => setFormData({ ...formData, paymentDeadline: e.target.value })} /></div>
                <div><Label>中国快递单号</Label><Input value={formData.chinaTrackingNumber} onChange={e => setFormData({ ...formData, chinaTrackingNumber: e.target.value })} /></div>
                <div><Label>中国境内运费（RM）</Label><Input type="number" value={formData.chinaShippingCost} onChange={e => setFormData({ ...formData, chinaShippingCost: e.target.value })} /></div>
                <div><Label>其他费用（RM）</Label><Input type="number" value={formData.otherFees} onChange={e => setFormData({ ...formData, otherFees: e.target.value })} /></div>
                <div><Label>状态</Label><Select value={formData.status} onValueChange={value => setFormData({ ...formData, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                <div className="md:col-span-2"><Label>备注</Label><Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={3} /></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button><Button onClick={handleSubmit} disabled={updateCnWithAuditMutation.isPending}>保存并记录审计</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </>) : (
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
              <div>
                <Label>供应商订单号</Label>
                <Input value={formData.supplierOrderNumber} onChange={e => setFormData({ ...formData, supplierOrderNumber: e.target.value })} placeholder="供应商订单号" />
              </div>
              <div>
                <Label>中国快递单号</Label>
                <Input value={formData.chinaTrackingNumber} onChange={e => setFormData({ ...formData, chinaTrackingNumber: e.target.value })} placeholder="中国快递单号" />
              </div>
              <div>
                <Label>其他费用 (RM)</Label>
                <Input type="number" value={formData.otherFees} onChange={e => setFormData({ ...formData, otherFees: e.target.value })} />
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
        )}
      </div>

      {cnIbSummaryQuery.isError ? (
        <Card role="alert" className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">CN／IB摘要暂时无法加载</p>
                <p className="mt-1 text-sm">关联订单数与最近超期处理结果未能读取；为避免误导，系统不会显示零值统计。</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => cnIbSummaryQuery.refetch()} disabled={cnIbSummaryQuery.isFetching}>重新载入摘要</Button>
          </CardContent>
        </Card>
      ) : (
      <section aria-label="CN／IB工作摘要" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-sky-100 bg-gradient-to-br from-sky-50 to-white shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <span className="rounded-lg bg-sky-100 p-2 text-sky-700"><Link2 className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-medium text-slate-600">关联订单数</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{cnIbSummaryQuery.isLoading ? "—" : cnIbSummary?.activeLinkedOrderCount ?? 0}</p>
              <p className="text-xs text-slate-500">有效XTC订单；累计关联 {cnIbSummary?.linkedOrderCount ?? 0} 张</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-violet-100 bg-gradient-to-br from-violet-50 to-white shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <span className="rounded-lg bg-violet-100 p-2 text-violet-700"><Package className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-medium text-slate-600">CN／IB单据</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{cnIbSummaryQuery.isLoading ? "—" : `${cnIbSummary?.cnCount ?? 0} / ${cnIbSummary?.ibCount ?? 0}`}</p>
              <p className="text-xs text-slate-500">CN采购单／IB入库单</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-white shadow-sm sm:col-span-2 xl:col-span-1">
          <CardContent className="flex items-start gap-3 p-4">
            <span className="rounded-lg bg-amber-100 p-2 text-amber-700"><Clock3 className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-600">最近超期处理结果</p>
              {cnIbSummary?.lastExpiryRun ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-slate-900">检查 {cnIbSummary.lastExpiryRun.inspectedCount} 张，自动取消 {cnIbSummary.lastExpiryRun.cancelledCount} 张{cnIbSummary.lastExpiryRun.failedCount ? `，失败 ${cnIbSummary.lastExpiryRun.failedCount} 张` : ""}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{new Date(cnIbSummary.lastExpiryRun.runAt).toLocaleString("zh-MY")}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-500">尚未有超期巡检记录</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
      )}

      <Tabs value={selectedBatchId ? "detail" : "list"} className="w-full">
        <TabsList>
          <TabsTrigger value="list" onClick={() => setSelectedBatchId(null)}>
            {urlTab === 'cn' ? '中国采购列表' : '进口批次列表'}
          </TabsTrigger>
          {selectedBatchId && <TabsTrigger value="detail">批次详情</TabsTrigger>}
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              {batchesQuery.isLoading ? (
                <div className="p-8 text-center text-muted-foreground">加载中...</div>
              ) : !filteredBatches || filteredBatches.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Plane className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{urlTab === 'cn' ? '暂无中国采购批次' : '暂无进口批次'}</p>
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
                    {filteredBatches.map((batch: any) => (
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
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={printCurrentBatch} className="gap-2">
                    <Printer className="h-4 w-4" /> 打印{selectedBatch?.documentType === 'ib' ? ' IB 单' : ' CN 单'}
                  </Button>
                  {urlTab === 'cn' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => confirmCnMutation.mutate({ batchId: selectedBatchId })}
                        disabled={confirmCnMutation.isPending}
                        className="gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        确认采购 (CN)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => createSplitArrivalIbMutation.mutate({ cnId: selectedBatchId })}
                        disabled={createSplitArrivalIbMutation.isPending}
                      >
                        新增分批到货 IB
                      </Button>
                    </>
                  )}
                  {urlTab === 'ib' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => completeIbMutation.mutate({ batchId: selectedBatchId })}
                        disabled={completeIbMutation.isPending || Boolean(selectedBatch?.isLocked)}
                        className="gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        完成验货 (IB)
                      </Button>
                      {selectedBatch?.isLocked ? (
                        <Button variant="outline" size="sm" onClick={() => {
                          const reason = window.prompt('请填写解锁原因（此原因会记录到CN/IB审计日志）：');
                          if (reason?.trim()) unlockIbMutation.mutate({ ibId: selectedBatchId, reason: reason.trim() });
                        }} disabled={unlockIbMutation.isPending}>
                          解锁 IB
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => lockIbMutation.mutate({ ibId: selectedBatchId })} disabled={lockIbMutation.isPending}>
                          锁定 IB
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => allocateAllMutation.mutate({ batchId: selectedBatchId })}
                    disabled={allocateAllMutation.isPending || Boolean(selectedBatch?.isLocked)}
                    className="gap-2"
                  >
                    <Calculator className="h-4 w-4" />
                    分摊所有费用
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => allocateMutation.mutate({ batchId: selectedBatchId })}
                    disabled={allocateMutation.isPending || Boolean(selectedBatch?.isLocked)}
                    className="gap-2"
                  >
                    <Calculator className="h-4 w-4" />
                    仅分摊运费
                  </Button>
                </div>
              </div>

              {selectedBatch?.isLocked && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">此 IB 已在入库完成后锁定。若需要更改成本或到货数量，请先点击「解锁 IB」并填写原因；所有操作都会记录审计日志。</div>}
              <fieldset disabled={Boolean(selectedBatch?.isLocked)} className="min-w-0 disabled:opacity-65">
              <Card>
                <CardContent className="p-0">
                  {batchItemsQuery.isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">加载中...</div>
                  ) : !batchItems || batchItems.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>暂无商品明细，代购截止后系统将自动汇总已付商品</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>商品名称</TableHead>
                          <TableHead>已付数量</TableHead>
                          <TableHead>最终采购量</TableHead>
                          <TableHead>实际到货</TableHead>
                          <TableHead>健康</TableHead>
                          <TableHead>损坏</TableHead>
                          <TableHead>死亡</TableHead>
                          <TableHead>遗漏</TableHead>
                          <TableHead>单位成本</TableHead>
                          <TableHead>分摊运费</TableHead>
                          <TableHead>总成本</TableHead>
                          <TableHead>差异原因</TableHead>
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
                            <TableCell className="text-xs">
                              {item.differenceReason && item.differenceReason !== 'none' ? (
                                <span className="text-amber-600">{differenceReasonLabels[item.differenceReason] || item.differenceReason}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
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
              </fieldset>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
