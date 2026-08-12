import { useMemo } from "react";
import { BellRing, CheckCircle2, Clipboard, ExternalLink, RefreshCw, Send, TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AiNotificationCenter() {
  const utils = trpc.useUtils();
  const center = trpc.notifications.aiCenter.useQuery(undefined, { refetchInterval: 30_000 });
  const handleFailure = trpc.notifications.handleAiFailure.useMutation({
    onSuccess: () => {
      toast.success("已记录人工处理，系统不会再次把这笔通知列为待发送。");
      utils.notifications.aiCenter.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const failures = center.data?.failures ?? [];
  const totalFailed = useMemo(() => center.data?.stats.reduce((sum, item) => sum + item.failed, 0) ?? 0, [center.data]);

  const copyAndMark = async (failure: typeof failures[number]) => {
    try {
      await navigator.clipboard.writeText(failure.message || "");
      handleFailure.mutate({ notificationLogId: failure.id, action: "manual_sent", note: "管理员已复制内容并改用人工渠道发送" });
      toast.success("通知内容已复制；请在WhatsApp或Messenger完成发送。");
    } catch {
      toast.error("无法复制通知内容，请检查浏览器权限后重试。");
    }
  };

  if (center.isLoading) return <div className="py-12 text-center text-muted-foreground">正在读取自动通知记录...</div>;
  if (center.isError) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"><p className="font-medium text-destructive">自动通知记录暂时无法读取</p><Button className="mt-3" variant="outline" onClick={() => center.refetch()}>重新读取</Button></div>;

  return <div className="space-y-5">
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-primary" />自动通知中心</CardTitle><CardDescription>自动通知失败独立管理，不会再显示为特别订单。人工处理会留下审计记录，已处理的记录不会再次进入待发送队列。</CardDescription></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {(center.data?.stats ?? []).map(stat => <div key={stat.type} className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">{stat.label}</p><p className="mt-1 text-lg font-bold">{stat.sent}<span className="text-xs font-normal text-muted-foreground"> 已发送</span></p><p className={stat.failed ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>{stat.failed} 待处理失败</p></div>)}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><TriangleAlert className="h-5 w-5 text-amber-600" />待人工处理通知 <Badge variant={totalFailed ? "destructive" : "secondary"}>{totalFailed}</Badge></CardTitle><CardDescription>请先确认客户资料及内容；“复制并标记人工发送”只记录管理员已改用外部渠道，不会冒充系统已实际发出。</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {failures.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-600" />目前没有待人工处理的自动通知。</div> : failures.map(failure => <div key={failure.id} className="rounded-xl border p-4"><div className="flex flex-col justify-between gap-3 md:flex-row"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{failure.eventLabel}</Badge><Badge variant="secondary">{failure.channel}</Badge>{failure.orderNumber && <span className="font-medium">{failure.orderNumber}</span>}<span className="text-sm text-muted-foreground">{failure.customerName || "未关联客户"}{failure.customerPhone ? ` · ${failure.customerPhone}` : ""}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{failure.message || "此记录未保存通知正文。"}</p>{failure.errorMessage && <p className="mt-2 text-xs text-destructive">失败原因：{failure.errorMessage}</p>}</div><div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => copyAndMark(failure)} disabled={handleFailure.isPending}><Clipboard className="mr-1 h-3.5 w-3.5" />复制并人工发送</Button><Button size="sm" variant="secondary" onClick={() => handleFailure.mutate({ notificationLogId: failure.id, action: "resolved", note: "管理员确认无需再次发送" })} disabled={handleFailure.isPending}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />无需重发</Button>{failure.orderId && <Button size="sm" variant="ghost" asChild><a href={`/orders/${failure.orderId}`}><ExternalLink className="mr-1 h-3.5 w-3.5" />订单</a></Button>}</div></div></div>)}
      </CardContent>
    </Card>

    <Card><CardHeader className="pb-3"><CardTitle className="text-base">模板变量说明</CardTitle><CardDescription>自动通知正文以实际订单资料代入变量。模板内容本身仍由订单通知设置维护，避免在这里产生第二套发送规则。</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{(center.data?.templates ?? []).map(template => <Badge key={template.type} variant="outline">{template.label}：{template.variables.join("、")}</Badge>)}</CardContent></Card>
  </div>;
}
