import { useState, useMemo } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, Eye, FileEdit, Ban } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  waiting_approval: "待审批",
  approved: "已批准",
  rejected: "已拒绝",
  invalid: "已失效",
};

const STATUS_COLORS: Record<string, string> = {
  waiting_approval: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  invalid: "bg-gray-100 text-gray-500",
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  add_item: "添加商品",
  remove_item: "移除商品",
  change_quantity: "修改数量",
  change_address: "修改地址",
  change_phone: "修改电话",
  cancel_item: "取消商品",
  other: "其他",
};

export default function OrderChangeRequests() {
  // V2.1.23: Read ?status= from URL for Dashboard auto-filter
  const search = useSearch();
  const urlStatus = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("status") || "all";
  }, [search]);

  const [statusFilter, setStatusFilter] = useState<string>(urlStatus);
  const [rejectDialog, setRejectDialog] = useState<{ id: number } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [invalidDialog, setInvalidDialog] = useState<{ id: number } | null>(null);
  const [invalidReason, setInvalidReason] = useState("");
  const [detailDialog, setDetailDialog] = useState<any>(null);

  const { data: requests, isLoading, refetch } = trpc.orderChangeRequests.list.useQuery({
    status: statusFilter as any,
    limit: 50,
    offset: 0,
  });

  const approveMutation = trpc.orderChangeRequests.approve.useMutation({
    onSuccess: () => {
      toast.success("变更请求已批准，订单已更新");
      refetch();
    },
    onError: (e) => toast.error(`批准失败：${e.message}`),
  });

  const rejectMutation = trpc.orderChangeRequests.reject.useMutation({
    onSuccess: () => {
      toast.success("变更请求已拒绝，预留库存已释放");
      setRejectDialog(null);
      setRejectReason("");
      refetch();
    },
    onError: (e) => toast.error(`拒绝失败：${e.message}`),
  });

  const markInvalidMutation = trpc.orderChangeRequests.markInvalid.useMutation({
    onSuccess: () => {
      toast.success("变更请求已标记为失效");
      setInvalidDialog(null);
      setInvalidReason("");
      refetch();
    },
    onError: (e) => toast.error(`标记失效失败：${e.message}`),
  });

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">订单变更请求（AI 生成）</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI 识别客户修改订单意图后创建的变更请求，需人工审批后执行
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
            <SelectItem value="invalid">已失效</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : !requests || requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileEdit className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>暂无变更请求</p>
            <p className="text-xs mt-1">AI 识别订单修改意图后将自动出现在此处</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req: any) => (
            <Card key={req.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium">{req.requestNumber}</span>
                      <Badge className={STATUS_COLORS[req.status] || ""}>
                        {STATUS_LABELS[req.status] || req.status}
                      </Badge>
                      <Badge variant="outline">
                        {REQUEST_TYPE_LABELS[req.requestType] || req.requestType}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span>订单：{req.orderNumber}</span>
                      <span className="mx-2">|</span>
                      <span>客户：{req.customerName || "未知"}</span>
                      <span className="mx-2">|</span>
                      <span>{new Date(req.createdAt).toLocaleString()}</span>
                    </div>
                    {req.originalMessage && (
                      <div className="text-sm bg-muted/50 rounded px-3 py-1.5 italic">
                        "{req.originalMessage}"
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDetailDialog(req)}
                    >
                      <Eye className="h-4 w-4 mr-1" /> 详情
                    </Button>
                    {req.status === "waiting_approval" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate({ id: req.id })}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" /> 批准
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setRejectDialog({ id: req.id })}
                        >
                          <X className="h-4 w-4 mr-1" /> 拒绝
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInvalidDialog({ id: req.id })}
                        >
                          <Ban className="h-4 w-4 mr-1" /> 标记失效
                        </Button>
                      </>
                    )}
                    {req.status === "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { window.location.href = `/orders/${req.orderId}`; }}
                      >
                        查看订单
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
            <DialogTitle>拒绝变更请求</DialogTitle>
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

      {/* Mark Invalid Dialog */}
      <Dialog open={!!invalidDialog} onOpenChange={(open) => !open && setInvalidDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>标记变更请求为失效</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">当原订单已发货/完成/取消，无法再执行变更时可标记为失效。失效后预留库存将自动释放。</p>
            <Textarea
              placeholder="失效原因（可选）"
              value={invalidReason}
              onChange={(e) => setInvalidReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvalidDialog(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => invalidDialog && markInvalidMutation.mutate({ id: invalidDialog.id, reason: invalidReason })}
              disabled={markInvalidMutation.isPending}
            >
              确认标记失效
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>变更请求详情 — {detailDialog?.requestNumber}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">订单号：</span>{detailDialog?.orderNumber}</div>
                <div><span className="text-muted-foreground">客户：</span>{detailDialog?.customerName || "未知"}</div>
                <div><span className="text-muted-foreground">类型：</span>{REQUEST_TYPE_LABELS[detailDialog?.requestType] || detailDialog?.requestType}</div>
                <div><span className="text-muted-foreground">状态：</span>{STATUS_LABELS[detailDialog?.status] || detailDialog?.status}</div>
                <div><span className="text-muted-foreground">创建时间：</span>{detailDialog && new Date(detailDialog.createdAt).toLocaleString()}</div>
                <div><span className="text-muted-foreground">意图：</span>{detailDialog?.detectedIntent || "—"}</div>
              </div>
              {detailDialog?.originalMessage && (
                <div>
                  <div className="text-sm font-medium mb-1">客户原始消息</div>
                  <div className="text-sm bg-muted/50 rounded px-3 py-2 italic">"{detailDialog.originalMessage}"</div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium mb-2">变更详情</div>
                <pre className="text-xs bg-muted/50 rounded px-3 py-2 overflow-auto">
                  {JSON.stringify(detailDialog?.changeDetails, null, 2)}
                </pre>
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
