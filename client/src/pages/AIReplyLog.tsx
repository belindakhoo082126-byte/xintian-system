import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageSquare, ChevronLeft, ChevronRight, Eye } from "lucide-react";

const PLATFORM_LABELS: Record<string, string> = {
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  facebook_comment: "FB 留言",
  live_chat: "直播聊天",
};

const MODULE_LABELS: Record<string, string> = {
  faq: "FAQ",
  knowledge: "Knowledge",
  flow: "Flow",
  plant_diagnostic: "植物诊断",
  order_management: "订单管理",
  product_info: "商品咨询",
  general: "通用",
};

const STATUS_COLORS: Record<string, "outline" | "secondary" | "default" | "destructive"> = {
  sent: "default",
  pending: "outline",
  human_takeover: "destructive",
  failed: "destructive",
};

export default function AIReplyLog() {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [platformFilter, setPlatformFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);

  const { data: logs, isLoading } = trpc.aiReplyLogs.list.useQuery({
    platform: platformFilter !== "all" ? platformFilter : undefined,
    aiModule: moduleFilter !== "all" ? moduleFilter : undefined,
    limit: pageSize,
    offset: page * pageSize,
  });

  const handleViewDetail = (item: any) => {
    setDetailItem(item);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-6 w-6" /> AI 回复记录
        </h1>
        <p className="text-sm text-muted-foreground mt-1">查看所有 AI 自动回复的完整记录与状态</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部平台</SelectItem>
            <SelectItem value="messenger">Messenger</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="facebook_comment">FB 留言</SelectItem>
            <SelectItem value="live_chat">直播聊天</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部模组</SelectItem>
            <SelectItem value="faq">FAQ</SelectItem>
            <SelectItem value="knowledge">Knowledge</SelectItem>
            <SelectItem value="flow">Flow</SelectItem>
            <SelectItem value="plant_diagnostic">植物诊断</SelectItem>
            <SelectItem value="order_management">订单管理</SelectItem>
            <SelectItem value="product_info">商品咨询</SelectItem>
            <SelectItem value="general">通用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : logs && logs.length > 0 ? (
        <div className="space-y-3">
          {logs.map((log: any) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {PLATFORM_LABELS[log.platform] || log.platform}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {MODULE_LABELS[log.aiModule] || log.aiModule}
                      </Badge>
                      <Badge variant={STATUS_COLORS[log.replyStatus] || "outline"} className="text-xs">
                        {log.replyStatus === "sent" ? "已发送" : log.replyStatus === "pending" ? "待发送" : log.replyStatus === "human_takeover" ? "转人工" : log.replyStatus === "failed" ? "失败" : log.replyStatus}
                      </Badge>
                      {log.confidenceScore !== null && (
                        <Badge variant="outline" className="text-xs">
                          信心: {Number(log.confidenceScore).toFixed(0)}%
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">客户问题</p>
                      <p className="text-sm line-clamp-2">{log.customerQuestion}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">AI 回复</p>
                      <p className="text-sm line-clamp-2">{log.aiReply}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleViewDetail(log)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">第 {page + 1} 页</span>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={!logs || logs.length < pageSize}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p>暂无 AI 回复记录</p>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>AI 回复详情</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{PLATFORM_LABELS[detailItem.platform] || detailItem.platform}</Badge>
                <Badge variant="secondary">{MODULE_LABELS[detailItem.aiModule] || detailItem.aiModule}</Badge>
                <Badge variant={STATUS_COLORS[detailItem.replyStatus] || "outline"}>
                  {detailItem.replyStatus}
                </Badge>
                {detailItem.confidenceScore !== null && (
                  <Badge variant="outline">信心: {Number(detailItem.confidenceScore).toFixed(0)}%</Badge>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">时间</p>
                <p className="text-sm">{new Date(detailItem.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">客户</p>
                <p className="text-sm">{detailItem.customerName || detailItem.customerId || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">客户问题</p>
                <p className="text-sm bg-muted/30 p-2 rounded">{detailItem.customerQuestion}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">AI 回复</p>
                <p className="text-sm bg-blue-50/50 p-2 rounded">{detailItem.aiReply}</p>
              </div>
              {detailItem.humanReply && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">人工回复</p>
                  <p className="text-sm bg-green-50/50 p-2 rounded">{detailItem.humanReply}</p>
                </div>
              )}
              {detailItem.matchedFaqId && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">匹配 FAQ ID</p>
                  <p className="text-sm">{detailItem.matchedFaqId}</p>
                </div>
              )}
              {detailItem.matchedKnowledgeId && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">匹配 Knowledge ID</p>
                  <p className="text-sm">{detailItem.matchedKnowledgeId}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
