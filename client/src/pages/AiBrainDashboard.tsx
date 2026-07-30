import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, AlertCircle, Plus, BookOpen, MessageSquare, FlaskConical, FileText, Activity, Zap, Brain, TrendingUp, MessageCircle, UserCheck, Bot, Database, Radio, Server, Webhook, CheckCircle, Percent } from "lucide-react";

type StatusState = "ok" | "error" | "unconfigured";

const STATUS_CONFIG: Record<StatusState, { color: string; label: string; dot: string }> = {
  ok: { color: "text-green-600", label: "正常", dot: "bg-green-500" },
  error: { color: "text-red-600", label: "异常", dot: "bg-red-500" },
  unconfigured: { color: "text-gray-400", label: "未配置", dot: "bg-gray-300" },
};

// Row 1: System core — Messenger, Database, Webhook, SSE
// Row 2: Engines — Flow Engine, Reply Rule Engine, Knowledge Engine, Chat
const STATUS_ORDER = [
  "messenger", "database", "webhook", "sse",
  "flowEngine", "replyRuleEngine", "knowledgeEngine", "chat",
];

const STATUS_ICONS: Record<string, any> = {
  messenger: MessageCircle,
  database: Database,
  webhook: Webhook,
  sse: Radio,
  flowEngine: Zap,
  replyRuleEngine: MessageSquare,
  knowledgeEngine: Brain,
  chat: MessageCircle,
};

const STATUS_LABELS: Record<string, string> = {
  messenger: "Messenger",
  database: "Database",
  webhook: "Webhook",
  sse: "SSE 即时同步",
  flowEngine: "Flow Engine",
  replyRuleEngine: "Reply Rule Engine",
  knowledgeEngine: "Knowledge Engine",
  chat: "Chat",
};

const ALERT_ICONS = {
  warning: AlertTriangle,
  info: Info,
  error: AlertCircle,
};

const ALERT_STYLES = {
  warning: "border-yellow-200 bg-yellow-50 text-yellow-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  error: "border-red-200 bg-red-50 text-red-800",
};

export default function AiBrainDashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { data: status, isLoading: statusLoading } = trpc.aiBrain.getStatus.useQuery();
  const { data: stats, isLoading: statsLoading } = trpc.aiBrain.getStats.useQuery();
  const { data: alerts = [] } = trpc.aiBrain.getAlerts.useQuery();

  const orderedStatus = status
    ? STATUS_ORDER.filter(k => k in status).map(k => [k, (status as any)[k]] as [string, any])
    : [];

  return (
    <div className="space-y-6">
      {/* AI 运行状态 */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          AI 运行状态
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statusLoading ? (
            <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">加载中...</CardContent></Card>
          ) : orderedStatus.length > 0 ? (
            orderedStatus.map(([key, val]) => {
              const Icon = STATUS_ICONS[key] || Server;
              const cfg = STATUS_CONFIG[val.state as StatusState] || STATUS_CONFIG.unconfigured;
              return (
                <Card key={key} className="overflow-hidden">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{STATUS_LABELS[key] || key}</span>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                    </div>
                    <div className={`text-xs ${cfg.color}`}>{cfg.label}</div>
                    {val.detail && <div className="text-xs text-muted-foreground mt-1 truncate">{val.detail}</div>}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">无法获取状态</CardContent></Card>
          )}
        </div>
      </div>

      {/* 今日 AI 统计 */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          今日 AI 统计
        </h2>
        {/* Rate cards — prominent */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <RateCard
            label="AI 自动解决率"
            value={stats?.aiResolvedRate ?? 0}
            icon={CheckCircle}
            color="text-green-600"
            loading={statsLoading}
          />
          <RateCard
            label="人工接手率"
            value={stats?.handoverRate ?? 0}
            icon={UserCheck}
            color="text-orange-600"
            loading={statsLoading}
          />
        </div>
        {/* Count cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="今日客户对话" value={stats?.todayConversations ?? 0} loading={statsLoading} icon={MessageCircle} />
          <StatCard label="AI 回复数量" value={stats?.aiReplies ?? 0} loading={statsLoading} icon={Bot} />
          <StatCard label="人工回复数量" value={stats?.staffReplies ?? 0} loading={statsLoading} icon={UserCheck} />
          <StatCard label="转人工数量" value={stats?.handoverCount ?? 0} loading={statsLoading} icon={AlertCircle} />
          <StatCard label="AI 无法回答" value={stats?.aiUnanswered ?? 0} loading={statsLoading} icon={AlertTriangle} />
          <StatCard label="Flow 触发次数" value={stats?.flowTriggers ?? 0} loading={statsLoading} icon={Zap} />
          <StatCard label="固定回复触发" value={stats?.replyRuleTriggers ?? 0} loading={statsLoading} icon={MessageSquare} />
          <StatCard label="知识库触发" value={stats?.knowledgeTriggers ?? 0} loading={statsLoading} icon={Brain} />
        </div>
      </div>

      {/* 快捷操作 + AI 提醒 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 快捷操作 */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            快捷操作
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => onNavigate("knowledge")}>
              <Plus className="w-5 h-5" />
              <span className="text-sm">新增知识库</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => onNavigate("reply-rules")}>
              <Plus className="w-5 h-5" />
              <span className="text-sm">新增固定回复</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => onNavigate("test")}>
              <FlaskConical className="w-5 h-5" />
              <span className="text-sm">AI 测试</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 opacity-50 cursor-not-allowed" disabled>
              <FileText className="w-5 h-5" />
              <span className="text-sm">查看 AI 日志</span>
            </Button>
          </div>
        </div>

        {/* AI 提醒 */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            AI 提醒
          </h2>
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <Card><CardContent className="py-6 text-center text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  系统运行正常，暂无提醒
                </div>
              </CardContent></Card>
            ) : (
              alerts.map((alert: any, i: number) => {
                const Icon = ALERT_ICONS[alert.level as keyof typeof ALERT_ICONS] || Info;
                return (
                  <div key={i} className={`rounded-lg border p-3 flex items-start gap-3 ${ALERT_STYLES[alert.level as keyof typeof ALERT_STYLES] || ALERT_STYLES.info}`}>
                    <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{alert.title}</div>
                      <div className="text-xs opacity-80 mt-0.5">{alert.detail}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, loading, icon: Icon }: { label: string; value: number; loading: boolean; icon: any }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="text-2xl font-bold">
          {loading ? <span className="text-muted-foreground text-base">...</span> : value}
        </div>
      </CardContent>
    </Card>
  );
}

function RateCard({ label, value, icon: Icon, color, loading }: { label: string; value: number; icon: any; color: string; loading: boolean }) {
  return (
    <Card>
      <CardContent className="py-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${color}`} />
            <span className="text-sm font-medium">{label}</span>
          </div>
          <div className={`text-3xl font-bold ${color}`}>
            {loading ? <span className="text-muted-foreground text-base">...</span> : `${value}%`}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
