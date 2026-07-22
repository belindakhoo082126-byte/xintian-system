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
import { HelpCircle, Plus, Search, Edit, Trash2 } from "lucide-react";

export default function FAQManagement() {
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    category: "",
    keywords: "",
    question: "",
    answer: "",
    imageUrl: "",
    videoUrl: "",
    pdfUrl: "",
    sortOrder: 0,
    isActive: true,
  });

  const { data: faqs, isLoading } = trpc.faqEntries.list.useQuery({
    search: search || undefined,
    limit: 200,
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.faqEntries.create.useMutation({
    onSuccess: () => { toast.success("FAQ 已创建"); setEditOpen(false); utils.faqEntries.list.invalidate(); },
    onError: (e) => toast.error(`创建失败: ${e.message}`),
  });

  const updateMutation = trpc.faqEntries.update.useMutation({
    onSuccess: () => { toast.success("FAQ 已更新"); setEditOpen(false); utils.faqEntries.list.invalidate(); },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const deleteMutation = trpc.faqEntries.delete.useMutation({
    onSuccess: () => { toast.success("FAQ 已删除"); utils.faqEntries.list.invalidate(); },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
  });

  const handleAdd = () => {
    setEditingId(null);
    setForm({ category: "", keywords: "", question: "", answer: "", imageUrl: "", videoUrl: "", pdfUrl: "", sortOrder: 0, isActive: true });
    setEditOpen(true);
  };

  const handleEdit = (faq: any) => {
    setEditingId(faq.id);
    setForm({
      category: faq.category || "",
      keywords: faq.keywords || "",
      question: faq.question || "",
      answer: faq.answer || "",
      imageUrl: faq.imageUrl || "",
      videoUrl: faq.videoUrl || "",
      pdfUrl: faq.pdfUrl || "",
      sortOrder: faq.sortOrder || 0,
      isActive: faq.isActive ?? true,
    });
    setEditOpen(true);
  };

  const handleSubmit = () => {
    if (!form.category || !form.question || !form.answer) {
      toast.error("分类、问题和答案为必填");
      return;
    }
    const data = {
      category: form.category,
      keywords: form.keywords || undefined,
      question: form.question,
      answer: form.answer,
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

  // Group by category
  const categories: Record<string, any[]> = {};
  faqs?.forEach((f: any) => {
    if (!categories[f.category]) categories[f.category] = [];
    categories[f.category].push(f);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <HelpCircle className="h-6 w-6" /> FAQ 管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">AI 回复使用的常见问题知识库</p>
        </div>
        <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-1" />新增 FAQ</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索问题、答案或关键词..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : faqs && faqs.length > 0 ? (
        <div className="space-y-4">
          {Object.entries(categories).map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  {category}
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((f: any) => (
                  <div key={f.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{f.question}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.answer}</p>
                        {f.keywords && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {f.keywords.split(",").map((kw: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">{kw.trim()}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={f.isActive ? "default" : "secondary"} className="text-xs">
                          {f.isActive ? "启用" : "停用"}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(f)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("确定删除？")) deleteMutation.mutate({ id: f.id }); }}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <HelpCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p>暂无 FAQ 条目</p>
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "编辑 FAQ" : "新增 FAQ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>分类 *</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="例如：配送" />
            </div>
            <div>
              <Label>关键词（逗号分隔）</Label>
              <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="例如：运费,快递,发货" />
            </div>
            <div>
              <Label>问题 *</Label>
              <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="客户可能问的问题" />
            </div>
            <div>
              <Label>答案 *</Label>
              <Textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={4} placeholder="AI 回复内容" />
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
