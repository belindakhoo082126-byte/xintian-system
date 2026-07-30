import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "../_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, ExternalLink, Search, Filter, AlertCircle, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  order_keyword: "订单关键词",
  product: "商品资料",
  reply_rule: "固定回复",
  knowledge: "知识库",
  llm: "LLM",
  flow: "Flow",
  human_handover: "转人工",
  no_match: "未匹配",
  ai_disabled: "AI已关闭",
  human_claimed: "人工接手",
  error: "错误",
};

const EVENT_SOURCE_LABELS: Record<string, string> = {
  private_chat: "私聊",
  facebook_live: "Facebook Live",
  facebook_post: "Facebook 帖子",
  facebook_reel: "Facebook Reel",
};

const SEND_STATUS_LABELS: Record<string, string> = {
  sent: "已发送",
  failed: "发送失败",
  not_sent: "未发送",
  pending: "发送中",
};

const SEND_STATUS_COLORS: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  not_sent: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
};

export default function AiBrainLog() {
  const [_, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Filters
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [platform, setPlatform] = useState("all");
  const [sourceType, setSourceType] = useState("all");
  const [finalSource, setFinalSource] = useState("all");
  const [sendStatus, setSendStatus] = useState("all");
  const [isHandover, setIsHandover] = useState<string>("all");
  const [keyword, setKeyword] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Build query params
  const queryParams = useMemo(() => ({
    page,
    pageSize,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    customerName: customerName || undefined,
    platform: platform === "all" ? undefined : platform,
    sourceType: sourceType === "all" ? undefined : sourceType as "private_chat" | "facebook_live" | "facebook_post" | "facebook_reel",
    finalSource: finalSource === "all" ? undefined : finalSource,
    sendStatus: sendStatus === "all" ? undefined : sendStatus,
    isHandover: isHandover === "all" ? undefined : isHandover === "yes",
    keyword: keyword || undefined,
  }), [page, pageSize, dateFrom, dateTo, customerName, platform, sourceType, finalSource, sendStatus, isHandover, keyword]);

  const { data, isLoading, refetch } = trpc.aiLog.list.useQuery(queryParams, {
    enabled: isAdmin,
  });
  const { data: stats } = trpc.aiLog.getStats.useQuery({ days: 1 }, { enabled: isAdmin });

  const { data: detail } = trpc.aiLog.getDetail.useQuery(
    { id: expandedId! },
    { enabled: !!expandedId && isAdmin }
  );

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">AI日志仅管理员可查看</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">今日日志</p>
            <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">已发送</p>
            <p className="text-2xl font-bold text-green-600">{stats?.sent ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">发送失败</p>
            <p className="text-2xl font-bold text-red-600">{stats?.failed ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">转人工</p>
            <p className="text-2xl font-bold text-orange-600">{stats?.handover ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">平均处理时间</p>
            <p className="text-2xl font-bold">{stats?.avgProcessingMs ? `${stats.avgProcessingMs}ms` : "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">错误数</p>
            <p className="text-2xl font-bold text-red-600">
              {Object.values(stats?.errorByStage ?? {}).reduce((a: number, b: any) => a + b, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4 px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">起始日期</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">结束日期</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">客户名称</label>
              <Input placeholder="搜索客户名称" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">关键词</label>
              <Input placeholder="搜索消息内容" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">渠道</label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="messenger">Messenger</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">事件来源</label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="private_chat">私聊</SelectItem>
                  <SelectItem value="facebook_live">Facebook Live</SelectItem>
                  <SelectItem value="facebook_post">Facebook 帖子</SelectItem>
                  <SelectItem value="facebook_reel">Facebook Reel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">回复来源</label>
              <Select value={finalSource} onValueChange={setFinalSource}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="product">商品资料</SelectItem>
                  <SelectItem value="reply_rule">固定回复</SelectItem>
                  <SelectItem value="knowledge">知识库</SelectItem>
                  <SelectItem value="llm">LLM</SelectItem>
                  <SelectItem value="flow">Flow</SelectItem>
                  <SelectItem value="order_keyword">订单关键词</SelectItem>
                  <SelectItem value="human_handover">转人工</SelectItem>
                  <SelectItem value="no_match">未匹配</SelectItem>
                  <SelectItem value="ai_disabled">AI已关闭</SelectItem>
                  <SelectItem value="human_claimed">人工接手</SelectItem>
                  <SelectItem value="error">错误</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">发送状态</label>
              <Select value={sendStatus} onValueChange={setSendStatus}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="sent">已发送</SelectItem>
                  <SelectItem value="failed">发送失败</SelectItem>
                  <SelectItem value="not_sent">未发送</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">转人工</label>
              <Select value={isHandover} onValueChange={setIsHandover}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="yes">是</SelectItem>
                  <SelectItem value="no">否</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end mt-3 gap-2">
            <Button variant="outline" size="sm" onClick={() => { setPage(1); refetch(); }}>
              <Search className="h-4 w-4 mr-1" /> 筛选
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              setDateFrom(""); setDateTo(""); setCustomerName(""); setPlatform("all"); setSourceType("all");
              setFinalSource("all"); setSendStatus("all"); setIsHandover("all"); setKeyword("");
              setPage(1);
            }}>
              <RefreshCw className="h-4 w-4 mr-1" /> 重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI处理日志 ({total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>暂无日志记录</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((log: any) => (
                <div key={log.id}>
                  {/* Log Row */}
                  <div className="flex items-start gap-3 p-4 hover:bg-accent/50 transition-colors">
                    <button
                      type="button"
                      className="flex flex-1 min-w-0 items-start gap-3 text-left"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      aria-expanded={expandedId === log.id}
                      aria-label={`查看 AI日志 #${log.id} 的处理详情`}
                    >
                      {expandedId === log.id ? (
                        <ChevronDown className="h-4 w-4 mt-1 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mt-1 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="text-xs">
                            {SOURCE_LABELS[log.finalSource] ?? log.finalSource}
                          </Badge>
                          <Badge className="text-xs bg-slate-100 text-slate-700">
                            {EVENT_SOURCE_LABELS[log.sourceType] ?? log.sourceType ?? "私聊"}
                          </Badge>
                          <Badge className={`text-xs ${SEND_STATUS_COLORS[log.sendStatus] ?? ""}`}>
                            {SEND_STATUS_LABELS[log.sendStatus] ?? log.sendStatus}
                          </Badge>
                          {log.isHandover && (
                            <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">转人工</Badge>
                          )}
                          {log.errorCode && (
                            <Badge variant="outline" className="text-xs border-red-300 text-red-700">
                              {log.errorCode}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {log.customerName ?? "未知客户"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString("zh-CN")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {log.processingTimeMs}ms
                          </span>
                        </div>
                        <p className="text-sm truncate text-foreground">
                          {log.customerMessage || "(无文字内容)"}
                        </p>
                      </div>
                    </button>
                    {log.conversationId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => navigate(`/chat?conversationId=${log.conversationId}`)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Chat
                      </Button>
                    )}
                  </div>

                  {/* Expanded Detail */}
                  {expandedId === log.id && detail && (
                    <div className="px-4 pb-4 bg-muted/30">
                      {(detail.sourceType !== "private_chat" || detail.sourceEventId || detail.sourceBindingId) && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg border bg-background p-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">事件来源</p>
                            <p className="font-medium">{EVENT_SOURCE_LABELS[detail.sourceType] ?? detail.sourceType ?? "私聊"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">来源事件 ID</p>
                            <p className="font-medium break-all">{detail.sourceEventId ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">来源绑定 / Flow ID</p>
                            <p className="font-medium">{detail.sourceBindingId ?? detail.matchedFlowId ?? "—"}</p>
                          </div>
                        </div>
                      )}

                      {/* Processing Steps */}
                      <div className="mt-2">
                        <h4 className="text-sm font-semibold mb-2">处理轨迹</h4>
                        <div className="space-y-1">
                          {Array.isArray(detail.processingSteps) && detail.processingSteps.map((step: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-muted-foreground shrink-0 w-6 text-right">{idx + 1}.</span>
                              <div className="flex-1">
                                <span className="font-medium">{step.label}</span>
                                {step.detail && (
                                  <span className="text-muted-foreground ml-2">— {step.detail}</span>
                                )}
                                {step.result && (
                                  <Badge
                                    variant="outline"
                                    className={`ml-2 text-xs ${
                                      step.result === "hit" ? "border-green-300 text-green-700" :
                                      step.result === "missed" ? "border-gray-300 text-gray-500" :
                                      step.result === "skipped" ? "border-blue-300 text-blue-600" :
                                      step.result === "handover" ? "border-orange-300 text-orange-700" :
                                      step.result === "error" ? "border-red-300 text-red-700" : ""
                                    }`}
                                  >
                                    {step.result}
                                  </Badge>
                                )}
                                {step.durationMs !== undefined && (
                                  <span className="text-xs text-muted-foreground ml-2">{step.durationMs}ms</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Reply */}
                      {detail.aiReply && (
                        <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                          <p className="text-xs font-semibold text-blue-700 mb-1">AI回复</p>
                          <p className="text-sm whitespace-pre-wrap">{detail.aiReply}</p>
                        </div>
                      )}

                      {/* Error Info */}
                      {detail.errorMessage && (
                        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                          <p className="text-xs font-semibold text-red-700 mb-1">
                            错误信息 ({detail.errorCode ?? "unknown"} @ {detail.errorStage ?? "unknown"})
                          </p>
                          <p className="text-sm text-red-600">{detail.errorMessage}</p>
                        </div>
                      )}

                      {/* Delivery Attempts */}
                      {Array.isArray(detail.deliveryAttempts) && detail.deliveryAttempts.length > 0 && (
                        <div className="mt-3">
                          <h4 className="text-sm font-semibold mb-2">发送记录</h4>
                          <div className="space-y-1">
                            {detail.deliveryAttempts.map((att: any) => (
                              <div key={att.id} className="flex items-center gap-2 text-sm">
                                {att.sendStatus === "sent" ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : att.sendStatus === "failed" ? (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                ) : (
                                  <Clock className="h-4 w-4 text-yellow-600" />
                                )}
                                <span>第 {att.attemptNumber} 次 — {SEND_STATUS_LABELS[att.sendStatus] ?? att.sendStatus}</span>
                                {att.platformMessageId && (
                                  <span className="text-xs text-muted-foreground">ID: {att.platformMessageId}</span>
                                )}
                                {att.errorMessage && (
                                  <span className="text-xs text-red-500">{att.errorMessage}</span>
                                )}
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {new Date(att.createdAt).toLocaleString("zh-CN")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Handover Info */}
                      {detail.isHandover && detail.handoverReason && (
                        <div className="mt-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                          <p className="text-xs font-semibold text-orange-700 mb-1">转人工原因</p>
                          <p className="text-sm">{detail.handoverReason}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <span className="text-sm text-muted-foreground">
                第 {page} / {totalPages} 页，共 {total} 条
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  上一页
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
