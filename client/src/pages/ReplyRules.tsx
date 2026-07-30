import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function ReplyRules() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    triggerKeywords: "",
    replyContent: "",
    priority: 100,
    channels: '["messenger","whatsapp"]',
    isEnabled: true,
  });

  const { data: rules = [], refetch } = trpc.replyRules.list.useQuery();

  const createMutation = trpc.replyRules.create.useMutation({
    onSuccess: () => { refetch(); toast.success("回复规则已创建"); setDialogOpen(false); },
    onError: () => toast.error("创建失败"),
  });

  const updateMutation = trpc.replyRules.update.useMutation({
    onSuccess: () => { refetch(); toast.success("回复规则已更新"); setDialogOpen(false); },
    onError: () => toast.error("更新失败"),
  });

  const deleteMutation = trpc.replyRules.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("回复规则已删除"); },
    onError: () => toast.error("删除失败"),
  });

  const toggleMutation = trpc.replyRules.update.useMutation({
    onSuccess: () => refetch(),
  });

  const handleEdit = (rule: any) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      triggerKeywords: rule.triggerKeywords,
      replyContent: rule.replyContent,
      priority: rule.priority,
      channels: rule.channels || '["messenger","whatsapp"]',
      isEnabled: rule.isEnabled,
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm({ name: "", triggerKeywords: "", replyContent: "", priority: 100, channels: '["messenger","whatsapp"]', isEnabled: true });
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
            <MessageSquare className="w-6 h-6" />
            固定回复规则
          </h1>
          <p className="text-muted-foreground mt-1">管理AI客服的固定回复规则。当客户消息匹配关键词时，系统自动发送对应回复。</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-1" /> 新增规则
        </Button>
      </div>

      <div className="space-y-3">
        {rules.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">暂无回复规则，点击「新增规则」创建第一条</CardContent></Card>
        )}
        {rules.map((rule: any) => {
          const keywords = parseKeywords(rule.triggerKeywords);
          const channels = parseKeywords(rule.channels || '[]');
          return (
            <Card key={rule.id} className={!rule.isEnabled ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{rule.name}</span>
                      <Badge variant="outline">优先级: {rule.priority}</Badge>
                      {channels.map((ch: string) => (
                        <Badge key={ch} variant="secondary">{ch}</Badge>
                      ))}
                      {!rule.isEnabled && <Badge variant="destructive">已停用</Badge>}
                      {rule.usageCount > 0 && (
                        <Badge variant="outline" className="text-blue-600">
                          命中 {rule.usageCount} 次
                        </Badge>
                      )}
                      {rule.lastMatchedAt && (
                        <span className="text-xs text-muted-foreground">
                          最后命中: {new Date(rule.lastMatchedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {keywords.map((kw: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{rule.replyContent}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.isEnabled}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, isEnabled: checked })}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(rule.id)}>
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
            <DialogTitle>{editingId ? "编辑回复规则" : "新增回复规则"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>规则名称</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：运费咨询" />
            </div>
            <div>
              <Label>触发关键词（JSON数组格式）</Label>
              <Input value={form.triggerKeywords} onChange={(e) => setForm({ ...form, triggerKeywords: e.target.value })} placeholder='["运费","免邮","shipping"]' />
              <p className="text-xs text-muted-foreground mt-1">客户消息包含任一关键词时触发回复</p>
            </div>
            <div>
              <Label>回复内容</Label>
              <Textarea value={form.replyContent} onChange={(e) => setForm({ ...form, replyContent: e.target.value })} rows={5} placeholder="发送给客户的回复内容..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>优先级（数字越小越优先）</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 100 })} />
              </div>
              <div>
                <Label>适用渠道（JSON数组）</Label>
                <Input value={form.channels} onChange={(e) => setForm({ ...form, channels: e.target.value })} placeholder='["messenger","whatsapp"]' />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isEnabled} onCheckedChange={(checked) => setForm({ ...form, isEnabled: checked })} />
              <Label>启用此规则</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={handleSubmit} disabled={!form.name || !form.triggerKeywords || !form.replyContent}>
                {editingId ? "保存修改" : "创建规则"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
