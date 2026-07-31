import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Check, X, Clock, Eye } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  waiting_approval: "待审批",
  approved: "已批准",
  rejected: "已拒绝",
  expired: "已过期",
};

const STATUS_COLORS: Record<string, string> = {
  waiting_approval: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-500",
};

export default function DraftOrders() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rejectDialog, setRejectDialog] = useState<{ id: number } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detailDialog, setDetailDialog] = useState<any>(null);

  const { data: drafts, isLoading, refetch } = trpc.draftOrders.list.useQuery({
    status: statusFilter as any,
    limit: 50,
    offset: 0,
  });

  const approveMutation = trpc.draftOrders.approve.useMutation({
    onSuccess: (data) => {
      toast.success(`草稿订单已批准，正式订单号：${data.orderNumber}`);
      refetch();
    },
    onError: (e) => toast.error(`批准失败：${e.message}`),
  });

  const rejectMutation = trpc.draftOrders.reject.useMutation({
    onSuccess: () => {
      toast.success("草稿订单已拒绝，库存已释放");
      setRejectDialog(null);
      setRejectReason("");
      refetch();
    },
    onError: (e) => toast.error(`拒绝失败：${e.message}`),
  });

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">草稿订单（AI 生成）</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI 识别客户购买意图后自动创建的草稿订单，需人工审批后转为正式订单
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="waiting_approval">待审批</SelectItem>
            <SelectItem value="approved">已批准</SelectItem>
            <SelectItem value="rejected">已拒绝</SelectItem>
            <SelectItem value="expired">已过期</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : !drafts || drafts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>暂无草稿订单</p>
            <p className="text-xs mt-1">AI 识别购买意图后将自动出现在此处</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {drafts.map((draft: any) => (
            <Card key={draft.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium">{draft.draftNumber}</span>
                      <Badge className={STATUS_COLORS[draft.status] || ""}>
                        {STATUS_LABELS[draft.status] || draft.status}
                      </Badge>
                      {draft.detectedIntent && (
                        <Badge variant="outline">{draft.detectedIntent}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span>客户：{draft.customerName || "未知"}</span>
                      <span className="mx-2">|</span>
                      <span>金额：RM {Number(draft.totalAmount).toFixed(2)}</span>
                      <span className="mx-2">|</span>
                      <span>{new Date(draft.createdAt).toLocaleString()}</span>
                    </div>
                    {draft.originalMessage && (
                      <div className="text-sm bg-muted/50 rounded px-3 py-1.5 italic">
                        "{draft.originalMessage}"
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      商品：{(draft.items as any[])?.map((item: any) => `${item.productName} x${item.quantity}`).join("，") || "无"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDetailDialog(draft)}
                    >
                      <Eye className="h-4 w-4 mr-1" /> 详情
                    </Button>
                    {draft.status === "waiting_approval" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate({ id: draft.id })}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" /> 批准
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setRejectDialog({ id: draft.id })}
                        >
                          <X className="h-4 w-4 mr-1" /> 拒绝
                        </Button>
                      </>
                    )}
                    {draft.status === "approved" && draft.officialOrderId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { window.location.href = `/orders/${draft.officialOrderId}`; }}
                      >
                        查看正式订单
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝草稿订单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">拒绝后预留库存将自动释放，此操作不可撤销。</p>
            <Textarea
              placeholder="拒绝原因（可选）"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => rejectDialog && rejectMutation.mutate({ id: rejectDialog.id, reason: rejectReason })}
              disabled={rejectMutation.isPending}
            >
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>草稿订单详情 — {detailDialog?.draftNumber}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">客户：</span>{detailDialog?.customerName || "未知"}</div>
                <div><span className="text-muted-foreground">平台：</span>{detailDialog?.platform}</div>
                <div><span className="text-muted-foreground">意图：</span>{detailDialog?.detectedIntent || "—"}</div>
                <div><span className="text-muted-foreground">金额：</span>RM {Number(detailDialog?.totalAmount || 0).toFixed(2)}</div>
                <div><span className="text-muted-foreground">创建时间：</span>{detailDialog && new Date(detailDialog.createdAt).toLocaleString()}</div>
                <div><span className="text-muted-foreground">状态：</span>{STATUS_LABELS[detailDialog?.status] || detailDialog?.status}</div>
              </div>
              {detailDialog?.originalMessage && (
                <div>
                  <div className="text-sm font-medium mb-1">客户原始消息</div>
                  <div className="text-sm bg-muted/50 rounded px-3 py-2 italic">"{detailDialog.originalMessage}"</div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium mb-2">商品列表</div>
                <div className="space-y-1">
                  {(detailDialog?.items as any[])?.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm border-b pb-1">
                      <span>{item.productName} x{item.quantity}</span>
                      <span>RM {Number(item.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {detailDialog?.approvedBy && (
                <div className="text-sm">
                  <span className="text-muted-foreground">批准人：</span>{detailDialog.approvedBy}
                  <span className="mx-2 text-muted-foreground">|</span>
                  <span className="text-muted-foreground">批准时间：</span>{new Date(detailDialog.approvedAt).toLocaleString()}
                </div>
              )}
              {detailDialog?.rejectedBy && (
                <div className="text-sm">
                  <span className="text-muted-foreground">拒绝人：</span>{detailDialog.rejectedBy}
                  {detailDialog.rejectReason && (
                    <div className="mt-1 text-muted-foreground">原因：{detailDialog.rejectReason}</div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
