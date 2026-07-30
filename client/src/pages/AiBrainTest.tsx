import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useAuth } from "../_core/hooks/useAuth";
import { Loader2, Play, RotateCw, Trash2, GitCompare, FilePlus, AlertTriangle, Clock, CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react";

// Source label mapping
const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  order_keyword: { label: "下单关键词", color: "bg-blue-100 text-blue-700" },
  product: { label: "商品资料", color: "bg-purple-100 text-purple-700" },
  reply_rule: { label: "固定回复", color: "bg-green-100 text-green-700" },
  knowledge: { label: "知识库", color: "bg-amber-100 text-amber-700" },
  llm: { label: "LLM", color: "bg-indigo-100 text-indigo-700" },
  no_match: { label: "无法匹配", color: "bg-gray-100 text-gray-700" },
  error: { label: "错误", color: "bg-red-100 text-red-700" },
  ai_disabled: { label: "AI已关闭", color: "bg-orange-100 text-orange-700" },
  human_claimed: { label: "人工已接手", color: "bg-cyan-100 text-cyan-700" },
};

export default function AiBrainTest() {
  const { user } = useAuth();
  const trpcUtils = trpc.useUtils();
  const [testMessage, setTestMessage] = useState("");
  const [platform, setPlatform] = useState<"messenger" | "whatsapp">("messenger");
  const [language, setLanguage] = useState("auto");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [handoverStatus, setHandoverStatus] = useState<"none" | "pending" | "claimed">("none");
  const [enableLLM, setEnableLLM] = useState(true);
  const [simulatedCustomerName, setSimulatedCustomerName] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [draftTestRunId, setDraftTestRunId] = useState<number | null>(null);
  const [draftTopic, setDraftTopic] = useState("");
  const [draftKeywords, setDraftKeywords] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftCategory, setDraftCategory] = useState("faq");
  const [draftNote, setDraftNote] = useState("");

  // Run test mutation
  const runMutation = trpc.aiTest.run.useMutation({
    onSuccess: () => {
      trpcUtils.aiTest.list.invalidate();
    },
  });

  // List query
  const listQuery = trpc.aiTest.list.useQuery({
    page: 1,
    pageSize: 50,
  });

  // Rerun mutation
  const rerunMutation = trpc.aiTest.rerun.useMutation({
    onSuccess: () => {
      trpcUtils.aiTest.list.invalidate();
    },
  });

  // Delete mutation
  const deleteMutation = trpc.aiTest.delete.useMutation({
    onSuccess: () => {
      trpcUtils.aiTest.list.invalidate();
    },
  });

  // Batch delete mutation
  const batchDeleteMutation = trpc.aiTest.batchDelete.useMutation({
    onSuccess: () => {
      trpcUtils.aiTest.list.invalidate();
    },
  });

  // Convert to draft mutation
  const convertToDraftMutation = trpc.aiTest.convertToDraft.useMutation({
    onSuccess: () => {
      setDraftDialogOpen(false);
      trpcUtils.aiTest.list.invalidate();
    },
  });

  // Compare query
  const compareQuery = trpc.aiTest.compare.useQuery(
    { runIdA: compareA!, runIdB: compareB! },
    { enabled: compareA !== null && compareB !== null && compareDialogOpen }
  );

  const handleRunTest = () => {
    if (!testMessage.trim()) return;
    runMutation.mutate({
      platform,
      language,
      aiEnabled,
      handoverStatus,
      enableLLM,
      simulatedCustomerName: simulatedCustomerName || undefined,
      isMember: false,
      hasOrder: false,
      testMessage: testMessage.trim(),
    });
  };

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRerun = (id: number) => {
    rerunMutation.mutate({ id });
  };

  const handleDelete = (id: number) => {
    if (confirm("确认删除此测试记录？此操作不可撤销。")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleOpenDraft = (runId: number, message: string, reply: string | null) => {
    setDraftTestRunId(runId);
    setDraftTopic(`来自测试 #${runId}`);
    setDraftKeywords("");
    setDraftContent(reply || "");
    setDraftNote(`源自AI测试中心，测试问题: ${message.slice(0, 100)}`);
    setDraftDialogOpen(true);
  };

  const handleConvertToDraft = () => {
    if (!draftTestRunId || !draftTopic.trim() || !draftKeywords.trim() || !draftContent.trim()) return;
    convertToDraftMutation.mutate({
      testRunId: draftTestRunId,
      category: draftCategory,
      topic: draftTopic,
      triggerKeywords: draftKeywords,
      content: draftContent,
      sourceNote: draftNote,
    });
  };

  const testRuns = listQuery.data?.items || [];
  const latestResult = runMutation.data || rerunMutation.data;

  return (
    <div className="space-y-4">
      {/* Fixed simulation warning banner */}
      <Alert className="border-amber-300 bg-amber-50">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-800 font-medium">
          模拟测试 — 不会发送给客户 · 不会建立对话 · 不影响正式统计
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">测试配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Test Message */}
            <div className="space-y-2">
              <Label>客户问题</Label>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="输入要测试的客户消息..."
                rows={3}
                maxLength={2000}
              />
            </div>

            {/* Platform & Language */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>模拟渠道</Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="messenger">Messenger</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>语言</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动检测</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ms">Bahasa Melayu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Simulated Customer Name */}
            <div className="space-y-2">
              <Label>模拟客户名称（可选）</Label>
              <Input
                value={simulatedCustomerName}
                onChange={(e) => setSimulatedCustomerName(e.target.value)}
                placeholder="例如：测试客户"
              />
            </div>

            {/* AI Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>AI 开启</Label>
                <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <Label>启用 LLM</Label>
                <Switch checked={enableLLM} onCheckedChange={setEnableLLM} />
              </div>
              <div className="space-y-2">
                <Label>人工接手状态</Label>
                <Select value={handoverStatus} onValueChange={(v) => setHandoverStatus(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未接手</SelectItem>
                    <SelectItem value="pending">等待中</SelectItem>
                    <SelectItem value="claimed">已接手</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reserved options (disabled) */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between opacity-50">
                <div>
                  <Label>模拟会员</Label>
                  <p className="text-xs text-muted-foreground">尚未接入，未来开放</p>
                </div>
                <Switch disabled />
              </div>
              <div className="flex items-center justify-between opacity-50">
                <div>
                  <Label>模拟有订单</Label>
                  <p className="text-xs text-muted-foreground">尚未接入，未来开放</p>
                </div>
                <Switch disabled />
              </div>
            </div>

            {/* Run Button */}
            <Button
              onClick={handleRunTest}
              disabled={!testMessage.trim() || runMutation.isPending}
              className="w-full"
            >
              {runMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 执行测试中...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> 执行测试</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right: Latest Result */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">测试结果</CardTitle>
          </CardHeader>
          <CardContent>
            {runMutation.isPending || rerunMutation.isPending ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : latestResult ? (
              <TestResultDisplay result={latestResult} onConvertToDraft={() => handleOpenDraft(0, testMessage, latestResult.aiReply)} />
            ) : runMutation.error ? (
              <Alert className="border-red-300 bg-red-50">
                <XCircle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  测试执行失败: {runMutation.error.message}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Play className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">输入客户问题并点击「执行测试」查看结果</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">历史测试记录</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompareDialogOpen(true)}
                disabled={testRuns.length < 2}
              >
                <GitCompare className="w-4 h-4 mr-1" /> 比较两次结果
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : testRuns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              暂无测试记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>测试问题</TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>AI回复</TableHead>
                  <TableHead>转人工</TableHead>
                  <TableHead>耗时</TableHead>
                  <TableHead>测试人</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testRuns.map((run: any) => (
                  <>
                    <TableRow key={run.id}>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => toggleRow(run.id)}>
                          {expandedRows.has(run.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="text-xs">{new Date(run.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="max-w-32 truncate text-sm">{run.testMessage}</TableCell>
                      <TableCell><Badge variant="outline">{run.platform}</Badge></TableCell>
                      <TableCell>
                        <Badge className={SOURCE_LABELS[run.finalSource]?.color || "bg-gray-100"}>
                          {SOURCE_LABELS[run.finalSource]?.label || run.finalSource}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-sm">{run.aiReply || "-"}</TableCell>
                      <TableCell>{run.shouldHandover ? <Badge variant="destructive">是</Badge> : <Badge variant="outline">否</Badge>}</TableCell>
                      <TableCell className="text-xs">{run.processingTimeMs}ms</TableCell>
                      <TableCell className="text-xs">{run.testedBy}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleRerun(run.id)} title="重新运行">
                            <RotateCw className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDraft(run.id, run.testMessage, run.aiReply)} title="转为知识库草稿">
                            <FilePlus className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(run.id)} title="删除">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(run.id) && (
                      <TableRow key={`${run.id}-detail`}>
                        <TableCell colSpan={10} className="bg-muted/30">
                          <TestRunDetail run={run} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Compare Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>比较两次测试结果</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>选择记录 A</Label>
              <Select value={compareA?.toString() || ""} onValueChange={(v) => setCompareA(Number(v))}>
                <SelectTrigger><SelectValue placeholder="选择..." /></SelectTrigger>
                <SelectContent>
                  {testRuns.map((r: any) => (
                    <SelectItem key={r.id} value={r.id.toString()}>#{r.id} - {r.testMessage.slice(0, 30)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>选择记录 B</Label>
              <Select value={compareB?.toString() || ""} onValueChange={(v) => setCompareB(Number(v))}>
                <SelectTrigger><SelectValue placeholder="选择..." /></SelectTrigger>
                <SelectContent>
                  {testRuns.map((r: any) => (
                    <SelectItem key={r.id} value={r.id.toString()}>#{r.id} - {r.testMessage.slice(0, 30)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {compareQuery.data && (
            <CompareDisplay data={compareQuery.data} />
          )}
        </DialogContent>
      </Dialog>

      {/* Convert to Draft Dialog */}
      <Dialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>转为知识库草稿</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>分类</Label>
              <Select value={draftCategory} onValueChange={setDraftCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faq">FAQ</SelectItem>
                  <SelectItem value="shipping">物流</SelectItem>
                  <SelectItem value="membership">会员</SelectItem>
                  <SelectItem value="product">商品</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>主题</Label>
              <Input value={draftTopic} onChange={(e) => setDraftTopic(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>触发关键词（逗号分隔）</Label>
              <Input value={draftKeywords} onChange={(e) => setDraftKeywords(e.target.value)} placeholder="例如：运费,快递,发货" />
            </div>
            <div className="space-y-2">
              <Label>回复内容</Label>
              <Textarea value={draftContent} onChange={(e) => setDraftContent(e.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input value={draftNote} onChange={(e) => setDraftNote(e.target.value)} />
            </div>
            {convertToDraftMutation.error && (
              <Alert className="border-red-300 bg-red-50">
                <AlertDescription className="text-red-700 text-sm">
                  {convertToDraftMutation.error.message}
                </AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground">
              草稿创建后状态为 draft、isEnabled=false，不参与正式引擎匹配。需在知识库页面发布后才生效。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftDialogOpen(false)}>取消</Button>
            <Button onClick={handleConvertToDraft} disabled={convertToDraftMutation.isPending}>
              {convertToDraftMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              确认创建草稿
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test Result Display Component
// ---------------------------------------------------------------------------

function TestResultDisplay({ result, onConvertToDraft }: { result: any; onConvertToDraft?: () => void }) {
  const sourceInfo = SOURCE_LABELS[result.finalSource] || { label: result.finalSource, color: "bg-gray-100" };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge className={sourceInfo.color}>{sourceInfo.label}</Badge>
        {result.shouldHandover && <Badge variant="destructive">建议转人工</Badge>}
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" /> {result.processingTimeMs}ms
        </span>
      </div>

      {result.aiReply && (
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-1">模拟回复</p>
          <p className="text-sm whitespace-pre-wrap">{result.aiReply}</p>
        </div>
      )}

      {result.handoverReason && (
        <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
          <p className="text-xs text-orange-700">转人工原因: {result.handoverReason}</p>
        </div>
      )}

      {/* LLM Tracking */}
      {result.llmCalled && (
        <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 space-y-1">
          <p className="text-xs font-medium text-indigo-700">LLM 追踪</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-indigo-600">
            <span>模型: {result.llmModel || "-"}</span>
            <span>耗时: {result.llmProcessingTimeMs || 0}ms</span>
            <span>输入Tokens: {result.llmInputTokens || "-"}</span>
            <span>输出Tokens: {result.llmOutputTokens || "-"}</span>
            <span>状态: {result.llmSuccess ? "成功" : "失败"}</span>
            {result.llmTimedOut && <span className="text-red-600">超时</span>}
            {result.llmErrorCode && <span>错误码: {result.llmErrorCode}</span>}
          </div>
        </div>
      )}

      {/* Processing Steps */}
      {result.processingSteps && result.processingSteps.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">处理轨迹</p>
          <ScrollArea className="h-48 rounded border p-2">
            <div className="space-y-1">
              {result.processingSteps.map((step: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground w-6 text-right">{i + 1}.</span>
                  <div className="flex-1">
                    <span className="font-medium">{step.label}</span>
                    {step.detail && <span className="text-muted-foreground"> — {step.detail}</span>}
                    {step.result && (
                      <Badge
                        variant="outline"
                        className={`ml-2 text-xs ${
                          step.result === "hit" ? "border-green-400 text-green-600" :
                          step.result === "missed" ? "border-gray-300 text-gray-500" :
                          step.result === "skipped" ? "border-blue-300 text-blue-500" :
                          step.result === "error" ? "border-red-400 text-red-600" :
                          step.result === "handover" ? "border-orange-400 text-orange-600" :
                          ""
                        }`}
                      >
                        {step.result}
                      </Badge>
                    )}
                    {step.durationMs !== undefined && (
                      <span className="text-muted-foreground ml-2">({step.durationMs}ms)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Error Info */}
      {result.errorCode && (
        <Alert className="border-red-300 bg-red-50">
          <XCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-700 text-sm">
            错误: {result.errorStage} / {result.errorCode} — {result.errorMessage}
          </AlertDescription>
        </Alert>
      )}

      {onConvertToDraft && result.aiReply && (
        <Button variant="outline" size="sm" onClick={onConvertToDraft}>
          <FilePlus className="w-3.5 h-3.5 mr-1" /> 转为知识库草稿
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test Run Detail (expanded row)
// ---------------------------------------------------------------------------

function TestRunDetail({ run }: { run: any }) {
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">测试配置</p>
          <div className="mt-1 space-y-0.5 text-xs">
            <p>渠道: {run.platform} | 语言: {run.language}</p>
            <p>AI: {run.aiEnabled ? "开启" : "关闭"} | LLM: {run.enableLLM ? "启用" : "关闭"}</p>
            <p>人工状态: {run.handoverStatus}</p>
            {run.simulatedCustomerName && <p>模拟客户: {run.simulatedCustomerName}</p>}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">命中信息</p>
          <div className="mt-1 space-y-0.5 text-xs">
            {run.matchedRuleId && <p>规则 ID: {run.matchedRuleId}</p>}
            {run.matchedKnowledgeId && <p>知识 ID: {run.matchedKnowledgeId}</p>}
            {run.matchedProductId && <p>商品 ID: {run.matchedProductId}</p>}
            {run.llmCalled && <p>LLM: {run.llmModel} ({run.llmProcessingTimeMs}ms)</p>}
          </div>
        </div>
      </div>
      <Separator />
      {run.processingSteps && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">完整处理轨迹</p>
          <div className="space-y-1">
            {run.processingSteps.map((step: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground w-6 text-right">{i + 1}.</span>
                <div className="flex-1">
                  <span className="font-medium">{step.label}</span>
                  {step.detail && <span className="text-muted-foreground"> — {step.detail}</span>}
                  {step.result && (
                    <Badge variant="outline" className={`ml-2 text-xs ${
                      step.result === "hit" ? "border-green-400 text-green-600" :
                      step.result === "missed" ? "border-gray-300 text-gray-500" :
                      step.result === "skipped" ? "border-blue-300 text-blue-500" :
                      step.result === "error" ? "border-red-400 text-red-600" :
                      step.result === "handover" ? "border-orange-400 text-orange-600" : ""
                    }`}>
                      {step.result}
                    </Badge>
                  )}
                  {step.durationMs !== undefined && <span className="text-muted-foreground ml-2">({step.durationMs}ms)</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compare Display
// ---------------------------------------------------------------------------

function CompareDisplay({ data }: { data: any }) {
  const { runA, runB } = data;
  return (
    <div className="grid grid-cols-2 gap-4 mt-4">
      {[
        { label: "记录 A", run: runA },
        { label: "记录 B", run: runB },
      ].map(({ label, run }) => (
        <div key={label} className="space-y-2 border rounded-lg p-3">
          <p className="font-medium text-sm">{label} — #{run.id}</p>
          <p className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString()}</p>
          <div className="text-xs space-y-1">
            <p>问题: {run.testMessage}</p>
            <p>来源: <Badge className={SOURCE_LABELS[run.finalSource]?.color || ""}>{SOURCE_LABELS[run.finalSource]?.label || run.finalSource}</Badge></p>
            <p>回复: {run.aiReply || "-"}</p>
            <p>转人工: {run.shouldHandover ? "是" : "否"}</p>
            <p>耗时: {run.processingTimeMs}ms</p>
            <p>AI: {run.aiEnabled ? "开" : "关"} | LLM: {run.enableLLM ? "开" : "关"}</p>
            <p>测试人: {run.testedBy}</p>
          </div>
          {run.processingSteps && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium mb-1">轨迹</p>
              <div className="space-y-0.5">
                {run.processingSteps.map((s: any, i: number) => (
                  <p key={i} className="text-xs">
                    {i + 1}. {s.label} — {s.result || ""}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
