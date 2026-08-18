import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  BarChart3, TrendingUp, AlertTriangle, BookOpen, MessageSquare,
  HelpCircle, UserCheck, Zap, Lightbulb, Activity, Clock, Target,
  CheckCircle, XCircle, AlertCircle, ChevronRight,
} from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  order_keyword: "下单关键词",
  product: "商品资料",
  reply_rule: "固定回复",
  knowledge: "知识库",
  llm: "LLM生成",
  flow: "Flow触发",
  human_handover: "转人工",
  no_match: "无法匹配",
  error: "错误",
  ai_disabled: "AI已关闭",
  human_claimed: "人工已接手",
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-800",
  medium: "border-yellow-200 bg-yellow-50 text-yellow-800",
  low: "border-blue-200 bg-blue-50 text-blue-800",
};

const SEVERITY_ICONS: Record<string, any> = {
  high: AlertCircle,
  medium: AlertTriangle,
  low: Lightbulb,
};

export default function AiBrainAnalysis() {
  const [days, setDays] = useState("7");
  const [tab, setTab] = useState("dashboard");

  const daysNum = parseInt(days);

  const { data: dashboard, isLoading: dashLoading } = trpc.aiAnalysis.getDashboard.useQuery({ days: daysNum });
  const { data: sourceAnalysis } = trpc.aiAnalysis.getSourceAnalysis.useQuery({ days: daysNum });
  const { data: knowledgeAnalysis } = trpc.aiAnalysis.getKnowledgeAnalysis.useQuery();
  const { data: ruleAnalysis } = trpc.aiAnalysis.getReplyRuleAnalysis.useQuery();
  const { data: noMatchAnalysis } = trpc.aiAnalysis.getNoMatchAnalysis.useQuery({ days: daysNum, limit: 20 });
  const { data: handoverAnalysis } = trpc.aiAnalysis.getHandoverAnalysis.useQuery({ days: daysNum });
  const { data: llmAnalysis } = trpc.aiAnalysis.getLlmAnalysis.useQuery({ days: daysNum });
  const { data: suggestions } = trpc.aiAnalysis.getSuggestions.useQuery();

  return (
    <div className="space-y-6">
      {/* Header with date selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">AI 分析中心</h2>
          <Badge variant="secondary" className="text-xs">仅统计正式 AI日志</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">统计范围</span>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">今日</SelectItem>
              <SelectItem value="7">过去7天</SelectItem>
              <SelectItem value="30">过去30天</SelectItem>
              <SelectItem value="90">过去90天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* AI Improvement Suggestions — always visible at top */}
      {suggestions && suggestions.suggestions.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="w-4 h-4 text-primary" />
              AI 改善建议
              <Badge variant="secondary" className="text-xs">{suggestions.suggestions.length} 项</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.suggestions.map((s, i) => {
              const Icon = SEVERITY_ICONS[s.severity] || Lightbulb;
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${SEVERITY_STYLES[s.severity] || ""}`}>
                  <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs mt-0.5 opacity-80">{s.description}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{s.action}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-7 h-auto">
          <TabsTrigger value="dashboard" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Activity className="w-4 h-4" /> 概览
          </TabsTrigger>
          <TabsTrigger value="source" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Target className="w-4 h-4" /> 来源分析
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex flex-col items-center gap-1 py-2 text-xs">
            <BookOpen className="w-4 h-4" /> 知识库
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex flex-col items-center gap-1 py-2 text-xs">
            <MessageSquare className="w-4 h-4" /> 固定回复
          </TabsTrigger>
          <TabsTrigger value="nomatch" className="flex flex-col items-center gap-1 py-2 text-xs">
            <HelpCircle className="w-4 h-4" /> 无法回答
          </TabsTrigger>
          <TabsTrigger value="handover" className="flex flex-col items-center gap-1 py-2 text-xs">
            <UserCheck className="w-4 h-4" /> 转人工
          </TabsTrigger>
          <TabsTrigger value="llm" className="flex flex-col items-center gap-1 py-2 text-xs">
            <Zap className="w-4 h-4" /> LLM
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Overview */}
        <TabsContent value="dashboard">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            <StatCard icon={MessageSquare} label="AI回复总数" value={dashboard?.totalReplies ?? 0} loading={dashLoading} />
            <StatCard icon={Target} label="AI命中率" value={`${dashboard?.hitRate ?? 0}%`} loading={dashLoading} color="text-green-600" />
            <StatCard icon={UserCheck} label="转人工率" value={`${dashboard?.handoverRate ?? 0}%`} loading={dashLoading} color="text-orange-600" />
            <StatCard icon={XCircle} label="回复失败率" value={`${dashboard?.failureRate ?? 0}%`} loading={dashLoading} color="text-red-600" />
            <StatCard icon={Clock} label="平均处理时间" value={`${dashboard?.avgProcessingMs ?? 0}ms`} loading={dashLoading} />
            <StatCard icon={Zap} label="LLM调用次数" value={dashboard?.llmCallCount ?? 0} loading={dashLoading} />
          </div>

          {/* Source distribution mini chart */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">来源分布</CardTitle>
            </CardHeader>
            <CardContent>
              {sourceAnalysis && sourceAnalysis.total > 0 ? (
                <div className="space-y-2">
                  {sourceAnalysis.sources.map((s) => (
                    <div key={s.source} className="flex items-center gap-3">
                      <div className="w-24 text-sm text-muted-foreground">{SOURCE_LABELS[s.source] || s.source}</div>
                      <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-primary/60 transition-all"
                          style={{ width: `${s.percentage}%` }}
                        />
                      </div>
                      <div className="w-20 text-right text-sm">
                        <span className="font-medium">{s.count}</span>
                        <span className="text-muted-foreground ml-1">({s.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="暂无数据" />
              )}
            </CardContent>
          </Card>

          {/* Detailed counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <StatCard icon={CheckCircle} label="已发送" value={dashboard?.sentCount ?? 0} loading={dashLoading} color="text-green-600" />
            <StatCard icon={XCircle} label="发送失败" value={dashboard?.failedCount ?? 0} loading={dashLoading} color="text-red-600" />
            <StatCard icon={UserCheck} label="转人工" value={dashboard?.handoverCount ?? 0} loading={dashLoading} color="text-orange-600" />
            <StatCard icon={HelpCircle} label="无法匹配" value={dashboard?.noMatchCount ?? 0} loading={dashLoading} color="text-yellow-600" />
          </div>
        </TabsContent>

        {/* Source Analysis */}
        <TabsContent value="source">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI回复来源分布</CardTitle>
            </CardHeader>
            <CardContent>
              {sourceAnalysis && sourceAnalysis.total > 0 ? (
                <div className="space-y-3">
                  {sourceAnalysis.sources.map((s) => (
                    <div key={s.source} className="flex items-center gap-3">
                      <div className="w-28 text-sm font-medium">{SOURCE_LABELS[s.source] || s.source}</div>
                      <div className="flex-1 h-8 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-primary/60 flex items-center justify-end px-2 transition-all"
                          style={{ width: `${Math.max(s.percentage, 3)}%` }}
                        >
                          <span className="text-xs text-white font-medium">{s.percentage}%</span>
                        </div>
                      </div>
                      <div className="w-16 text-right text-sm font-medium">{s.count} 次</div>
                    </div>
                  ))}
                  <div className="pt-2 border-t text-sm text-muted-foreground">
                    总计 {sourceAnalysis.total} 次AI回复
                  </div>
                </div>
              ) : (
                <EmptyState text="所选时间范围内暂无AI回复记录" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Analysis */}
        <TabsContent value="knowledge">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={BookOpen} label="知识库总数" value={knowledgeAnalysis?.total ?? 0} />
              <StatCard icon={CheckCircle} label="已发布" value={knowledgeAnalysis?.publishedCount ?? 0} color="text-green-600" />
              <StatCard icon={AlertCircle} label="草稿" value={knowledgeAnalysis?.draftCount ?? 0} color="text-blue-600" />
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">使用排行</CardTitle></CardHeader>
              <CardContent>
                {knowledgeAnalysis && knowledgeAnalysis.usageRanking.length > 0 ? (
                  <div className="space-y-2">
                    {knowledgeAnalysis.usageRanking.map((k, i) => (
                      <div key={k.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{k.topic}</div>
                          <div className="text-xs text-muted-foreground">{k.category}</div>
                        </div>
                        <Badge variant="secondary" className="text-xs">{k.usageCount} 次</Badge>
                        {k.lastMatchedAt && (
                          <span className="text-xs text-muted-foreground hidden md:inline">
                            {new Date(k.lastMatchedAt as any).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="暂无已发布的知识库条目" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">从未使用</CardTitle></CardHeader>
              <CardContent>
                {knowledgeAnalysis && knowledgeAnalysis.neverUsed.length > 0 ? (
                  <div className="space-y-2">
                    {knowledgeAnalysis.neverUsed.map((k) => (
                      <div key={k.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                        <div>
                          <span className="text-sm font-medium">{k.topic}</span>
                          <span className="text-xs text-muted-foreground ml-2">{k.category}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">0 次</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="所有已发布知识条目均被使用过" />
                )}
              </CardContent>
            </Card>

            {knowledgeAnalysis && knowledgeAnalysis.drafts.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">草稿（不参与正式匹配）</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {knowledgeAnalysis.drafts.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                        <div>
                          <span className="text-sm font-medium">{d.topic}</span>
                          {d.sourceNote && <span className="text-xs text-muted-foreground ml-2">{d.sourceNote}</span>}
                        </div>
                        <Badge variant="secondary" className="text-xs">草稿</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Reply Rule Analysis */}
        <TabsContent value="rules">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={MessageSquare} label="规则总数" value={ruleAnalysis?.total ?? 0} />
              <StatCard icon={CheckCircle} label="已启用" value={ruleAnalysis?.enabledCount ?? 0} color="text-green-600" />
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">最高命中规则</CardTitle></CardHeader>
              <CardContent>
                {ruleAnalysis && ruleAnalysis.topHits.length > 0 ? (
                  <div className="space-y-2">
                    {ruleAnalysis.topHits.filter(r => r.usageCount > 0).map((r, i) => (
                      <div key={r.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-medium text-green-700">{i + 1}</div>
                        <div className="flex-1 text-sm font-medium">{r.name}</div>
                        <Badge variant="secondary" className="text-xs">{r.usageCount} 次</Badge>
                        {r.lastMatchedAt && (
                          <span className="text-xs text-muted-foreground hidden md:inline">
                            {new Date(r.lastMatchedAt as any).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                    {ruleAnalysis.topHits.every(r => r.usageCount === 0) && (
                      <EmptyState text="暂无命中记录" />
                    )}
                  </div>
                ) : (
                  <EmptyState text="暂无固定回复规则" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">从未使用规则</CardTitle></CardHeader>
              <CardContent>
                {ruleAnalysis && ruleAnalysis.neverUsed.length > 0 ? (
                  <div className="space-y-2">
                    {ruleAnalysis.neverUsed.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                        <span className="text-sm font-medium">{r.name}</span>
                        <Badge variant="outline" className="text-xs">0 次</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="所有已启用规则均被命中过" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* No Match Analysis */}
        <TabsContent value="nomatch">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                无法回答的问题
                {noMatchAnalysis && noMatchAnalysis.total > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">共 {noMatchAnalysis.total} 次</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {noMatchAnalysis && noMatchAnalysis.topQuestions.length > 0 ? (
                <div className="space-y-2">
                  {noMatchAnalysis.topQuestions.map((q, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded border">
                      <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center text-xs font-medium text-yellow-700 shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{q.message}</p>
                        {q.lastAskedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            最近询问: {new Date(q.lastAskedAt as any).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">{q.count} 次</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="所选时间范围内没有无法回答的问题" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Handover Analysis */}
        <TabsContent value="handover">
          <div className="space-y-4">
            <StatCard icon={UserCheck} label="转人工总数" value={handoverAnalysis?.total ?? 0} />

            <Card>
              <CardHeader><CardTitle className="text-base">转人工原因分布</CardTitle></CardHeader>
              <CardContent>
                {handoverAnalysis && handoverAnalysis.byReason.length > 0 ? (
                  <div className="space-y-2">
                    {handoverAnalysis.byReason.map((r, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 text-sm">{r.reason}</div>
                        <Badge variant="secondary" className="text-xs">{r.count} 次</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="所选时间范围内没有转人工记录" />
                )}
              </CardContent>
            </Card>

            {handoverAnalysis && handoverAnalysis.recentHandovers.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">最近转人工请求</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {handoverAnalysis.recentHandovers.map((h) => (
                      <div key={h.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{h.reason}</div>
                          {h.customerName && <div className="text-xs text-muted-foreground">{h.customerName}</div>}
                        </div>
                        <Badge variant={h.priority === "high" ? "destructive" : h.priority === "medium" ? "secondary" : "outline"} className="text-xs">
                          {h.priority}
                        </Badge>
                        <Badge variant={h.status === "claimed" ? "default" : "secondary"} className="text-xs">
                          {h.status === "claimed" ? "已接手" : "待处理"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* LLM Analysis */}
        <TabsContent value="llm">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Zap} label="LLM调用总数" value={llmAnalysis?.totalCalls ?? 0} />
              <StatCard icon={CheckCircle} label="成功率" value={`${llmAnalysis?.successRate ?? 0}%`} color="text-green-600" />
              <StatCard icon={Clock} label="平均处理时间" value={`${llmAnalysis?.avgProcessingMs ?? 0}ms`} />
              <StatCard icon={TrendingUp} label="平均输入Token" value={llmAnalysis?.avgInputTokens ?? 0} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={CheckCircle} label="成功次数" value={llmAnalysis?.successCount ?? 0} color="text-green-600" />
              <StatCard icon={XCircle} label="失败次数" value={llmAnalysis?.failedCount ?? 0} color="text-red-600" />
              <StatCard icon={TrendingUp} label="平均输出Token" value={llmAnalysis?.avgOutputTokens ?? 0} />
            </div>

            {llmAnalysis && llmAnalysis.byModel.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">模型分布</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {llmAnalysis.byModel.map((m, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="text-sm font-medium">{m.model}</div>
                        <Badge variant="secondary" className="text-xs">{m.count} 次</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {llmAnalysis && llmAnalysis.totalCalls === 0 && (
              <Card>
                <CardContent className="py-8">
                  <EmptyState text="所选时间范围内没有LLM调用记录。LLM仅在知识库命中且条目启用LLM时触发。" />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  color,
}: {
  icon: any;
  label: string;
  value: string | number;
  loading?: boolean;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-4 h-4 ${color || "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className={`text-2xl font-bold ${color || ""}`}>
          {loading ? "—" : value}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
