import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardCheck, Check, X, Edit, Eye } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  pending: { label: "待审核", variant: "outline" },
  approved: { label: "已批准", variant: "default" },
  rejected: { label: "已拒绝", variant: "destructive" },
  modified: { label: "已修改", variant: "default" },
  ignored: { label: "已忽略", variant: "secondary" },
};

export default function AIReviewCenter() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [modifiedReply, setModifiedReply] = useState("");

  const utils = trpc.useUtils();

  const { data: items, isLoading } = trpc.aiReviewItems.list.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    limit: pageSize,
    offset: page * pageSize,
  });

  const updateStatusMutation = trpc.aiReviewItems.updateStatus.useMutation({
    onSuccess: () => { toast.success("状态已更新"); utils.aiReviewItems.list.invalidate(); },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const handleApprove = (id: number) => {
    updateStatusMutation.mutate({ id, status: "approved" });
  };

  const handleReject = (id: number) => {
    updateStatusMutation.mutate({ id, status: "rejected" });
  };

  const handleIgnore = (id: number) => {
    updateStatusMutation.mutate({ id, status: "ignored" });
  };

  const handleEditOpen = (item: any) => {
    setEditingItem(item);
    setModifiedReply(item.aiSuggestion || "");
    setEditOpen(true);
  };

  const handleSaveModified = () => {
    if (!editingItem) return;
    updateStatusMutation.mutate({
      id: editingItem.id,
      status: "modified",
      modifiedReply,
    });
    setEditOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6" /> AI Review Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">审核 AI 学习建议，批准、修改或拒绝 AI 回复</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">待审核</SelectItem>
            <SelectItem value="approved">已批准</SelectItem>
            <SelectItem value="rejected">已拒绝</SelectItem>
            <SelectItem value="modified">已修改</SelectItem>
            <SelectItem value="ignored">已忽略</SelectItem>
            <SelectItem value="all">全部</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : items && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item: any) => (
            <Card key={item.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_LABELS[item.status]?.variant || "outline"} className="text-xs">
                        {STATUS_LABELS[item.status]?.label || item.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">客户问题</p>
                      <p className="text-sm">{item.customerQuestion}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">人工回复</p>
                      <p className="text-sm bg-muted/30 p-2 rounded">{item.humanReply || "（无）"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">AI 建议回复</p>
                      <p className="text-sm bg-blue-50/50 p-2 rounded">{item.aiSuggestion || "（无）"}</p>
                    </div>
                    {item.modifiedReply && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">修改后回复</p>
                        <p className="text-sm bg-green-50/50 p-2 rounded">{item.modifiedReply}</p>
                      </div>
                    )}
                  </div>
                  {item.status === "pending" && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button size="sm" variant="default" onClick={() => handleApprove(item.id)}>
                        <Check className="h-3 w-3 mr-1" />批准
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEditOpen(item)}>
                        <Edit className="h-3 w-3 mr-1" />修改
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(item.id)}>
                        <X className="h-3 w-3 mr-1" />拒绝
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleIgnore(item.id)}>
                        忽略
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {items.length >= pageSize && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</Button>
              <span className="text-sm text-muted-foreground">第 {page + 1} 页</span>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)}>下一页</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p>暂无审核项目</p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>修改 AI 回复</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>客户问题</Label>
              <p className="text-sm bg-muted/30 p-2 rounded">{editingItem?.customerQuestion}</p>
            </div>
            <div>
              <Label>AI 建议回复</Label>
              <p className="text-sm bg-blue-50/50 p-2 rounded">{editingItem?.aiSuggestedReply}</p>
            </div>
            <div>
              <Label>修改后回复</Label>
              <Textarea
                value={modifiedReply}
                onChange={(e) => setModifiedReply(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleSaveModified} disabled={updateStatusMutation.isPending}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
