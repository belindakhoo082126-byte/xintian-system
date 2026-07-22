import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BookOpen, Plus, Search, Edit, Trash2 } from "lucide-react";

export default function KnowledgeManagement() {
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    topic: "",
    content: "",
    tags: "",
    imageUrl: "",
    videoUrl: "",
    pdfUrl: "",
    sortOrder: 0,
    isActive: true,
  });

  const { data: entries, isLoading } = trpc.knowledgeEntries.list.useQuery({
    search: search || undefined,
    limit: 200,
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.knowledgeEntries.create.useMutation({
    onSuccess: () => { toast.success("Knowledge 已创建"); setEditOpen(false); utils.knowledgeEntries.list.invalidate(); },
    onError: (e) => toast.error(`创建失败: ${e.message}`),
  });

  const updateMutation = trpc.knowledgeEntries.update.useMutation({
    onSuccess: () => { toast.success("Knowledge 已更新"); setEditOpen(false); utils.knowledgeEntries.list.invalidate(); },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const deleteMutation = trpc.knowledgeEntries.delete.useMutation({
    onSuccess: () => { toast.success("Knowledge 已删除"); utils.knowledgeEntries.list.invalidate(); },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
  });

  const handleAdd = () => {
    setEditingId(null);
    setForm({ topic: "", content: "", tags: "", imageUrl: "", videoUrl: "", pdfUrl: "", sortOrder: 0, isActive: true });
    setEditOpen(true);
  };

  const handleEdit = (entry: any) => {
    setEditingId(entry.id);
    setForm({
      topic: entry.topic || "",
      content: entry.content || "",
      tags: entry.tags || "",
      imageUrl: entry.imageUrl || "",
      videoUrl: entry.videoUrl || "",
      pdfUrl: entry.pdfUrl || "",
      sortOrder: entry.sortOrder || 0,
      isActive: entry.isActive ?? true,
    });
    setEditOpen(true);
  };

  const handleSubmit = () => {
    if (!form.topic || !form.content) {
      toast.error("主题和内容为必填");
      return;
    }
    const data = {
      topic: form.topic,
      content: form.content,
      tags: form.tags || undefined,
      imageUrl: form.imageUrl || undefined,
      videoUrl: form.videoUrl || undefined,
      pdfUrl: form.pdfUrl || undefined,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
    };
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Knowledge 管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">AI 回复使用的深度知识库（植物知识、养护指南等）</p>
        </div>
        <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1" />新增 Knowledge</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索主题、内容或标签..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : entries && entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map((e: any) => (
            <Card key={e.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{e.topic}</p>
                      <Badge variant={e.isActive ? "default" : "secondary"} className="text-xs">
                        {e.isActive ? "启用" : "停用"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">{e.content}</p>
                    {e.tags && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {e.tags.split(",").map((tag: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{tag.trim()}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(e)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("确定删除？")) deleteMutation.mutate({ id: e.id }); }}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p>暂无 Knowledge 条目</p>
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "编辑 Knowledge" : "新增 Knowledge"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>主题 *</Label>
              <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="例如：龟背竹养护指南" />
            </div>
            <div>
              <Label>内容 *</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} placeholder="详细知识内容" />
            </div>
            <div>
              <Label>标签（逗号分隔）</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="例如：龟背竹,养护,光照" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>图片 URL</Label>
                <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="选填" />
              </div>
              <div>
                <Label>影片 URL</Label>
                <Input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="选填" />
              </div>
            </div>
            <div>
              <Label>PDF URL</Label>
              <Input value={form.pdfUrl} onChange={(e) => setForm({ ...form, pdfUrl: e.target.value })} placeholder="选填" />
            </div>
            <div className="flex items-center justify-between">
              <Label>启用</Label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId !== null ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
