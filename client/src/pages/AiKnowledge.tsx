import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Brain } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["运费", "会员", "商品", "植物养护", "售后", "发货", "付款", "常见问题", "其他"];

export default function AiKnowledge() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [form, setForm] = useState({
    category: "faq",
    topic: "",
    triggerKeywords: "",
    content: "",
    priority: 100,
    useLLM: false,
    isEnabled: true,
  });

  const { data: knowledge = [], refetch } = trpc.aiKnowledge.list.useQuery();

  const createMutation = trpc.aiKnowledge.create.useMutation({
    onSuccess: () => { refetch(); toast.success("知识条目已创建"); setDialogOpen(false); },
    onError: () => toast.error("创建失败"),
  });

  const updateMutation = trpc.aiKnowledge.update.useMutation({
    onSuccess: () => { refetch(); toast.success("知识条目已更新"); setDialogOpen(false); },
    onError: () => toast.error("更新失败"),
  });

  const deleteMutation = trpc.aiKnowledge.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("知识条目已删除"); },
    onError: () => toast.error("删除失败"),
  });

  const toggleMutation = trpc.aiKnowledge.update.useMutation({
    onSuccess: () => refetch(),
  });

  const approveTrainingMutation = trpc.aiKnowledge.approveChatTrainingFeedback.useMutation({
    onSuccess: () => { refetch(); toast.success("训练草稿已审核发布", { description: "此回复现在可参与 AI 自动回复匹配。" }); },
    onError: (error) => toast.error(`审核发布失败：${error.message}`),
  });

  const filtered = filterCategory === "all" ? knowledge : knowledge.filter((k: any) => k.category === filterCategory);

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      category: item.category,
      topic: item.topic,
      triggerKeywords: item.triggerKeywords,
      content: item.content,
      priority: item.priority,
      useLLM: item.useLLM,
      isEnabled: item.isEnabled,
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm({ category: "常见问题", topic: "", triggerKeywords: "", content: "", priority: 100, useLLM: false, isEnabled: true });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const parseKeywords = (json: string) => {
    try { return JSON.parse(json) as string[]; } catch { return []; }
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6" />
            AI 知识库
          </h1>
          <p className="text-muted-foreground mt-1">管理AI客服的知识库条目。固定回复规则未匹配时，系统会查询知识库进行回复。</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-1" /> 新增知识
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant={filterCategory === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterCategory("all")}>全部</Button>
        {CATEGORIES.map((cat) => (
          <Button key={cat} variant={filterCategory === cat ? "default" : "outline"} size="sm" onClick={() => setFilterCategory(cat)}>{cat}</Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">暂无知识条目</CardContent></Card>
        )}
        {filtered.map((item: any) => {
          const keywords = parseKeywords(item.triggerKeywords);
          return (
            <Card key={item.id} className={!item.isEnabled ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{item.category}</Badge>
                      <span className="font-semibold">{item.topic}</span>
                      <Badge variant="outline">优先级: {item.priority}</Badge>
                      {item.useLLM && <Badge variant="default">LLM</Badge>}
                      {!item.isEnabled && <Badge variant="destructive">已停用</Badge>}
                      {item.status === "draft" && <Badge variant="outline" className="border-amber-400 text-amber-700">待审核草稿</Badge>}
                      {item.approvedBy && <span className="text-xs text-muted-foreground">审核：{item.approvedBy}{item.approvedAt ? ` · ${new Date(item.approvedAt).toLocaleString()}` : ""}</span>}
                      <Badge variant="outline" className="text-blue-600">
                        使用 {Number(item.usageCount ?? 0)} 次
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        最后命中: {item.lastMatchedAt ? new Date(item.lastMatchedAt).toLocaleString() : "尚无记录"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {keywords.map((kw: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{item.content}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === "draft" && String(item.sourceNote || "").startsWith("聊天训练草稿｜") && (
                      <Button variant="outline" size="sm" disabled={approveTrainingMutation.isPending} onClick={() => approveTrainingMutation.mutate({ id: item.id })}>
                        审核发布
                      </Button>
                    )}
                    <Switch
                      checked={item.isEnabled}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: item.id, isEnabled: checked })}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑知识条目" : "新增知识条目"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>分类</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>主题</Label>
                <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="例如：运费规则" />
              </div>
            </div>
            <div>
              <Label>触发关键词（JSON数组格式）</Label>
              <Input value={form.triggerKeywords} onChange={(e) => setForm({ ...form, triggerKeywords: e.target.value })} placeholder='["运费","免邮","shipping"]' />
            </div>
            <div>
              <Label>知识内容</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} placeholder="回复内容..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>优先级</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 100 })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.useLLM} onCheckedChange={(checked) => setForm({ ...form, useLLM: checked })} />
                <Label>使用LLM处理</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isEnabled} onCheckedChange={(checked) => setForm({ ...form, isEnabled: checked })} />
              <Label>启用此条目</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={handleSubmit} disabled={!form.topic || !form.triggerKeywords || !form.content}>
                {editingId ? "保存修改" : "创建条目"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
