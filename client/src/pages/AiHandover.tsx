import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertCircle, Clock, Facebook, Phone, ArrowRight, User, Bot } from "lucide-react";
import { Link } from "wouter";

export default function AiHandover() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"pending" | "claimed" | "all">("pending");

  const { data: stats } = trpc.aiHandover.getStats.useQuery();
  const { data: handovers, isLoading } = trpc.aiHandover.list.useQuery({ status: statusFilter });

  const claimMut = trpc.aiHandover.claim.useMutation({});

  const getPlatformIcon = (platform: string) => {
    return platform === "messenger" ? <Facebook className="h-3 w-3" /> : <Phone className="h-3 w-3" />;
  };

  const getPlatformLabel = (platform: string) => {
    return platform === "messenger" ? "Messenger" : "WhatsApp";
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive" className="text-xs">高</Badge>;
      case "medium":
        return <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">中</Badge>;
      case "low":
        return <Badge variant="outline" className="text-xs">低</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{priority}</Badge>;
    }
  };

  const formatWaitTime = (createdAt: string | Date) => {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) return `${diffDay}天${diffHour % 24}小时`;
    if (diffHour > 0) return `${diffHour}小时${diffMin % 60}分钟`;
    return `${diffMin}分钟`;
  };

  return (
    <div className="container py-6 space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-base">等待人工处理</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.pendingCount || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">位客户等待中</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Clock className="h-5 w-5 text-red-500" />
            <CardTitle className="text-base">最久等待</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {stats?.oldestWaitMinutes ? (
                <>
                  {Math.floor(stats.oldestWaitMinutes / 60)}
                  <span className="text-base font-normal text-muted-foreground ml-1">小时</span>
                  {stats.oldestWaitMinutes % 60}
                  <span className="text-base font-normal text-muted-foreground ml-1">分钟</span>
                </>
              ) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">从最早转人工请求算起</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Bot className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">AI 转人工</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              AI 判断需要人工介入的客户会出现在此列表。点击「接手」后 AI 自动关闭，由工作人员直接处理。
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <Button
          variant={statusFilter === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("pending")}
        >
          等待中 ({stats?.pendingCount || 0})
        </Button>
        <Button
          variant={statusFilter === "claimed" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("claimed")}
        >
          已接手
        </Button>
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("all")}
        >
          全部
        </Button>
      </div>

      {/* Handover List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI 转人工通知列表</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">加载中...</p>
          ) : !handovers || handovers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无转人工通知</p>
          ) : (
            <div className="space-y-3">
              {handovers.map((req: any) => (
                <div
                  key={req.id}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback>
                        {(req.customerName || req.platformId || "?").charAt(0)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      {/* Header row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {req.customerName || "未知客户"}
                        </span>
                        {getPlatformIcon(req.platform)}
                        <span className="text-xs text-muted-foreground">
                          {getPlatformLabel(req.platform)}
                        </span>
                        {getPriorityBadge(req.priority)}
                        {req.status === "claimed" && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                            已接手: {req.claimedBy}
                          </Badge>
                        )}
                      </div>

                      {/* Platform ID */}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {req.platform === "messenger" ? (
                          <span>Messenger ID: <code className="bg-muted px-1 rounded">{req.platformId}</code></span>
                        ) : (
                          <span>WhatsApp: <code className="bg-muted px-1 rounded">{req.platformId}</code></span>
                        )}
                      </div>

                      {/* Reason */}
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground">转人工原因</p>
                        <p className="text-sm mt-0.5">{req.reason}</p>
                      </div>

                      {/* AI Summary */}
                      {req.aiSummary && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground">AI 摘要</p>
                          <p className="text-sm mt-0.5 text-muted-foreground italic">{req.aiSummary}</p>
                        </div>
                      )}

                      {/* Time */}
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatWaitTime(req.createdAt)}
                        </span>
                        <span>{new Date(req.createdAt).toLocaleString("zh-CN")}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {req.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => claimMut.mutate({ id: req.id })}
                          disabled={claimMut.isPending}
                        >
                          接手
                        </Button>
                      )}
                      {req.conversationId && (
                        <Link href={`/chat?conv=${req.conversationId}`}>
                          <Button variant="outline" size="sm">
                            打开对话 <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
