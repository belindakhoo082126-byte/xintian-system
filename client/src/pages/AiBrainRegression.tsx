import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, Play, GitBranch, Tag, History, CheckCircle, XCircle, AlertTriangle, FlaskConical } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function AiBrainRegression() {
  const { user } = useAuth();
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [showCreateSet, setShowCreateSet] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [showVersionCreate, setShowVersionCreate] = useState(false);
  const [showRunDetails, setShowRunDetails] = useState<number | null>(null);
  const [newSet, setNewSet] = useState({ name: "", description: "", category: "" });
  const [newQuestion, setNewQuestion] = useState<{ question: string; expectedSource: string; expectedKeywords: string; category: string; priority: "low" | "medium" | "high" }>({ question: "", expectedSource: "", expectedKeywords: "", category: "", priority: "medium" });
  const [newVersion, setNewVersion] = useState({ versionNumber: "", label: "", description: "" });

  // Queries
  const { data: sets, refetch: refetchSets } = trpc.aiRegression.listSets.useQuery();
  const { data: setData } = trpc.aiRegression.getSet.useQuery(
    { id: selectedSetId! },
    { enabled: !!selectedSetId }
  );
  const { data: runs } = trpc.aiRegression.listRuns.useQuery(
    { setId: selectedSetId! },
    { enabled: !!selectedSetId }
  );
  const { data: runDetails } = trpc.aiRegression.getRunDetails.useQuery(
    { runId: showRunDetails! },
    { enabled: !!showRunDetails }
  );
  const { data: versions, refetch: refetchVersions } = trpc.aiVersion.list.useQuery();
  const { data: latestPublished } = trpc.aiVersion.getLatestPublished.useQuery();

  // Mutations
  const createSet = trpc.aiRegression.createSet.useMutation({
    onSuccess: () => { refetchSets(); setShowCreateSet(false); setNewSet({ name: "", description: "", category: "" }); toast.success("回归测试集创建成功"); },
  });
  const deleteSet = trpc.aiRegression.deleteSet.useMutation({
    onSuccess: () => { refetchSets(); setSelectedSetId(null); toast.success("已删除"); },
  });
  const addQuestion = trpc.aiRegression.addQuestion.useMutation({
    onSuccess: () => { setShowAddQuestion(false); setNewQuestion({ question: "", expectedSource: "", expectedKeywords: "", category: "", priority: "medium" }); toast.success("问题已添加"); },
  });
  const deleteQuestion = trpc.aiRegression.deleteQuestion.useMutation({
    onSuccess: () => { toast.success("已删除"); },
  });
  const runRegression = trpc.aiRegression.run.useMutation({
    onSuccess: (result) => {
      toast.success(`回归测试完成：${result.passedCount} 通过，${result.failedCount} 失败，准确率 ${result.accuracy.toFixed(1)}%`);
    },
    onError: (err) => toast.error(`回归测试失败：${err.message}`),
  });
  const createVersion = trpc.aiVersion.create.useMutation({
    onSuccess: () => { refetchVersions(); setShowVersionCreate(false); setNewVersion({ versionNumber: "", label: "", description: "" }); toast.success("AI 版本已创建"); },
  });
  const publishVersion = trpc.aiVersion.publish.useMutation({
    onSuccess: () => { refetchVersions(); toast.success("版本已发布"); },
  });
  const rollbackVersion = trpc.aiVersion.rollback.useMutation({
    onSuccess: () => { refetchVersions(); toast.success("已回滚到指定版本"); },
  });

  const isAdmin = user?.role === "admin";
  const selectedRun = runDetails?.run;
  const details = runDetails?.details || [];

  return (
    <div className="space-y-6">
      {/* Safety Notice */}
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <FlaskConical className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          <strong>回归测试</strong> · 使用正式 AI 引擎执行 Dry Run · 不会发送给客户 · 不会建立对话 · 不会影响正式统计
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="regression">
        <TabsList>
          <TabsTrigger value="regression" className="gap-2"><FlaskConical className="w-4 h-4" /> 回归测试</TabsTrigger>
          <TabsTrigger value="version" className="gap-2"><GitBranch className="w-4 h-4" /> AI 版本</TabsTrigger>
        </TabsList>

        {/* Regression Tab */}
        <TabsContent value="regression" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">回归测试集</h2>
            {isAdmin && (
              <Dialog open={showCreateSet} onOpenChange={setShowCreateSet}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> 新建测试集</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新建回归测试集</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>名称</Label>
                      <Input value={newSet.name} onChange={(e) => setNewSet({ ...newSet, name: e.target.value })} placeholder="如：Shipping FAQ" />
                    </div>
                    <div>
                      <Label>描述</Label>
                      <Textarea value={newSet.description} onChange={(e) => setNewSet({ ...newSet, description: e.target.value })} placeholder="可选" />
                    </div>
                    <div>
                      <Label>分类</Label>
                      <Input value={newSet.category} onChange={(e) => setNewSet({ ...newSet, category: e.target.value })} placeholder="如：Shipping" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => createSet.mutate(newSet)} disabled={!newSet.name || createSet.isPending}>创建</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Sets List */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sets?.map((set) => (
              <Card
                key={set.id}
                className={`cursor-pointer transition-all ${selectedSetId === set.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                onClick={() => setSelectedSetId(set.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{set.name}</CardTitle>
                    {set.isEnabled ? <Badge variant="default">启用</Badge> : <Badge variant="secondary">禁用</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {set.description || "无描述"}
                  {set.category && <div className="mt-2"><Badge variant="outline">{set.category}</Badge></div>}
                </CardContent>
              </Card>
            ))}
            {(!sets || sets.length === 0) && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">暂无回归测试集，请创建第一个测试集</div>
            )}
          </div>

          {/* Selected Set Details */}
          {selectedSetId && setData && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{setData.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{setData.description}</p>
                    </div>
                    <div className="flex gap-2">
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowAddQuestion(true)}>
                            <Plus className="w-4 h-4" /> 添加问题
                          </Button>
                          <Button
                            size="sm"
                            className="gap-2"
                            onClick={() => runRegression.mutate({ setId: selectedSetId })}
                            disabled={runRegression.isPending}
                          >
                            <Play className="w-4 h-4" /> {runRegression.isPending ? "执行中..." : "运行回归"}
                          </Button>
                          <Button size="sm" variant="destructive" className="gap-2" onClick={() => { if (confirm("确认删除此测试集？")) deleteSet.mutate({ id: selectedSetId }); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Questions Table */}
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">问题</th>
                          <th className="text-left p-2 font-medium">期望来源</th>
                          <th className="text-left p-2 font-medium">分类</th>
                          <th className="text-left p-2 font-medium">优先级</th>
                          <th className="text-left p-2 font-medium">状态</th>
                          {isAdmin && <th className="p-2"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {setData.questions?.map((q) => (
                          <tr key={q.id} className="border-t">
                            <td className="p-2">{q.question}</td>
                            <td className="p-2">{q.expectedSource ? <Badge variant="outline">{q.expectedSource}</Badge> : "—"}</td>
                            <td className="p-2">{q.category || "—"}</td>
                            <td className="p-2">
                              <Badge variant={q.priority === "high" ? "destructive" : q.priority === "medium" ? "default" : "secondary"}>
                                {q.priority}
                              </Badge>
                            </td>
                            <td className="p-2">{q.isEnabled ? <Badge>启用</Badge> : <Badge variant="secondary">禁用</Badge>}</td>
                            {isAdmin && (
                              <td className="p-2">
                                <Button size="sm" variant="ghost" onClick={() => { if (confirm("删除此问题？")) deleteQuestion.mutate({ id: q.id }); }}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {(!setData.questions || setData.questions.length === 0) && (
                          <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">暂无问题，请添加测试问题</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Run History */}
              {runs && runs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" /> 执行历史</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2">时间</th>
                            <th className="text-left p-2">类型</th>
                            <th className="text-left p-2">状态</th>
                            <th className="text-left p-2">通过/总数</th>
                            <th className="text-left p-2">准确率</th>
                            <th className="text-left p-2">耗时</th>
                            <th className="p-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {runs.map((r) => (
                            <tr key={r.id} className="border-t">
                              <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
                              <td className="p-2">{r.isBaseline ? <Badge variant="default">Baseline</Badge> : <Badge variant="outline">回归</Badge>}</td>
                              <td className="p-2">
                                {r.status === "completed" ? <Badge className="gap-1"><CheckCircle className="w-3 h-3" /> 完成</Badge> :
                                 r.status === "running" ? <Badge variant="secondary">运行中</Badge> :
                                 <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> 失败</Badge>}
                              </td>
                              <td className="p-2">{r.passedCount}/{r.totalQuestions}</td>
                              <td className="p-2 font-medium">{Number(r.accuracy).toFixed(1)}%</td>
                              <td className="p-2">{r.avgProcessingMs}ms</td>
                              <td className="p-2">
                                <Button size="sm" variant="ghost" onClick={() => setShowRunDetails(r.id)}>详情</Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* AI Version Tab */}
        <TabsContent value="version" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">AI 版本管理</h2>
              {latestPublished && (
                <p className="text-sm text-muted-foreground mt-1">
                  当前发布版本：<Badge variant="default">{latestPublished.versionNumber}</Badge>
                  {latestPublished.label && <span className="ml-2">{latestPublished.label}</span>}
                </p>
              )}
            </div>
            {isAdmin && (
              <Dialog open={showVersionCreate} onOpenChange={setShowVersionCreate}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Tag className="w-4 h-4" /> 创建版本</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>创建 AI 版本</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>版本号</Label>
                      <Input value={newVersion.versionNumber} onChange={(e) => setNewVersion({ ...newVersion, versionNumber: e.target.value })} placeholder="如：v1.0" />
                    </div>
                    <div>
                      <Label>标签</Label>
                      <Input value={newVersion.label} onChange={(e) => setNewVersion({ ...newVersion, label: e.target.value })} placeholder="如：Initial Release" />
                    </div>
                    <div>
                      <Label>描述</Label>
                      <Textarea value={newVersion.description} onChange={(e) => setNewVersion({ ...newVersion, description: e.target.value })} placeholder="可选" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => createVersion.mutate(newVersion)} disabled={!newVersion.versionNumber || createVersion.isPending}>创建</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Versions List */}
          <div className="grid grid-cols-1 gap-4">
            {versions?.map((ver) => (
              <Card key={ver.id} className={ver.status === "published" ? "ring-2 ring-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{ver.versionNumber}</CardTitle>
                      {ver.label && <Badge variant="outline">{ver.label}</Badge>}
                      {ver.status === "published" ? <Badge className="gap-1"><CheckCircle className="w-3 h-3" /> 已发布</Badge> :
                       ver.status === "draft" ? <Badge variant="secondary">草稿</Badge> :
                       <Badge variant="secondary">已归档</Badge>}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        {ver.status !== "published" && (
                          <Button size="sm" variant="outline" onClick={() => { if (confirm("确认发布此版本？")) publishVersion.mutate({ id: ver.id }); }}>
                            发布
                          </Button>
                        )}
                        {ver.status !== "published" && !!ver.knowledgeSnapshot && (
                          <Button size="sm" variant="destructive" onClick={() => { if (confirm("确认回滚到此版本？这将恢复知识库和规则到该版本快照。")) rollbackVersion.mutate({ id: ver.id }); }}>
                            回滚
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="text-sm">
                  {ver.description && <p className="text-muted-foreground mb-3">{ver.description}</p>}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>知识库：{ver.knowledgeCount} 条</span>
                    <span>规则：{ver.ruleCount} 条</span>
                    {ver.regressionAccuracy && <span>回归准确率：{Number(ver.regressionAccuracy).toFixed(1)}%</span>}
                    {ver.publishedAt && <span>发布于：{new Date(ver.publishedAt).toLocaleString()}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!versions || versions.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">暂无 AI 版本，创建第一个版本以开始管理</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Question Dialog */}
      <Dialog open={showAddQuestion} onOpenChange={setShowAddQuestion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加回归测试问题</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>问题内容</Label>
              <Textarea value={newQuestion.question} onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })} placeholder="如：请问运费多少？" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>期望来源（可选）</Label>
                <Select value={newQuestion.expectedSource} onValueChange={(v) => setNewQuestion({ ...newQuestion, expectedSource: v })}>
                  <SelectTrigger><SelectValue placeholder="不指定" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reply_rule">固定回复</SelectItem>
                    <SelectItem value="knowledge">知识库</SelectItem>
                    <SelectItem value="product">商品</SelectItem>
                    <SelectItem value="llm">LLM</SelectItem>
                    <SelectItem value="no_match">无法匹配</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>优先级</Label>
                <Select value={newQuestion.priority} onValueChange={(v) => setNewQuestion({ ...newQuestion, priority: v as "low" | "medium" | "high" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>期望关键词（可选）</Label>
              <Input value={newQuestion.expectedKeywords} onChange={(e) => setNewQuestion({ ...newQuestion, expectedKeywords: e.target.value })} placeholder="如：运费,免邮" />
            </div>
            <div>
              <Label>分类（可选）</Label>
              <Input value={newQuestion.category} onChange={(e) => setNewQuestion({ ...newQuestion, category: e.target.value })} placeholder="如：Shipping" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addQuestion.mutate({ setId: selectedSetId!, ...newQuestion })} disabled={!newQuestion.question || addQuestion.isPending}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Details Dialog */}
      <Dialog open={!!showRunDetails} onOpenChange={(open) => !open && setShowRunDetails(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>回归测试结果详情</DialogTitle>
          </DialogHeader>
          {selectedRun && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="p-3">
                  <div className="text-2xl font-bold text-green-600">{selectedRun.passedCount}</div>
                  <div className="text-xs text-muted-foreground">通过</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-red-600">{selectedRun.failedCount}</div>
                  <div className="text-xs text-muted-foreground">失败</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold">{Number(selectedRun.accuracy).toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">准确率</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold">{selectedRun.avgProcessingMs}ms</div>
                  <div className="text-xs text-muted-foreground">平均耗时</div>
                </Card>
              </div>

              {/* Difference Summary */}
              {(selectedRun.sourceChanged > 0 || selectedRun.replyChanged > 0 || selectedRun.noMatchIncreased > 0 || selectedRun.handoverIncreased > 0) && (
                <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 dark:text-amber-300">
                    {selectedRun.sourceChanged > 0 && <span>来源变化：{selectedRun.sourceChanged} · </span>}
                    {selectedRun.replyChanged > 0 && <span>回复变化：{selectedRun.replyChanged} · </span>}
                    {selectedRun.noMatchIncreased > 0 && <span>新增无法匹配：{selectedRun.noMatchIncreased} · </span>}
                    {selectedRun.noMatchDecreased > 0 && <span>减少无法匹配：{selectedRun.noMatchDecreased} · </span>}
                    {selectedRun.handoverIncreased > 0 && <span>新增转人工：{selectedRun.handoverIncreased} · </span>}
                    {selectedRun.newHits > 0 && <span>{`新增命中：${selectedRun.newHits} · `}</span>}
                    {selectedRun.lostHits > 0 && <span>{`丢失命中：${selectedRun.lostHits}`}</span>}
                  </AlertDescription>
                </Alert>
              )}

              {/* Failed Questions */}
              <ScrollArea className="h-[300px] rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">问题</th>
                      <th className="text-left p-2">当前来源</th>
                      <th className="text-left p-2">基线来源</th>
                      <th className="text-left p-2">结果</th>
                      <th className="text-left p-2">建议</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d) => (
                      <tr key={d.id} className="border-t">
                        <td className="p-2 max-w-xs truncate">{d.question}</td>
                        <td className="p-2"><Badge variant="outline">{d.finalSource}</Badge></td>
                        <td className="p-2">{d.baselineSource ? <Badge variant="outline">{d.baselineSource}</Badge> : "—"}</td>
                        <td className="p-2">{d.isPassed ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}</td>
                        <td className="p-2 text-xs text-muted-foreground max-w-xs truncate">{d.suggestion || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
