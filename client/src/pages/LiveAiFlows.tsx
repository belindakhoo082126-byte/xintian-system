import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@//_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Copy, Trash2, ArrowUp, ArrowDown, MessageSquare, Bot } from "lucide-react";
import { toast } from "sonner";

export default function LiveAiFlows() {
  const { user } = useAuth();
  const queryClient = trpc.useUtils();
  const flowsQuery = trpc.liveAiFlows.list.useQuery();
  const createMutation = trpc.liveAiFlows.create.useMutation();
  const updateMutation = trpc.liveAiFlows.update.useMutation();
  const deleteMutation = trpc.liveAiFlows.delete.useMutation();
  const duplicateMutation = trpc.liveAiFlows.duplicate.useMutation();
  const reorderMutation = trpc.liveAiFlows.reorder.useMutation();

  const flows = (flowsQuery.data || []) as any[];

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);

  const openCreate = () => {
    setEditingFlow(null);
    setName("");
    setKeywords([]);
    setNewKeyword("");
    setReplyContent("");
    setIsEnabled(true);
    setEditDialogOpen(true);
  };

  const openEdit = (flow: any) => {
    setEditingFlow(flow);
    setName(flow.name);
    try {
      setKeywords(JSON.parse(flow.triggerKeywords));
    } catch {
      setKeywords([]);
    }
    setReplyContent(flow.replyContent);
    setIsEnabled(flow.isEnabled);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("请输入 Flow 名称");
      return;
    }
    if (keywords.length === 0) {
      toast.error("请至少添加一个触发关键词");
      return;
    }
    if (!replyContent.trim()) {
      toast.error("请输入自动回复内容");
      return;
    }

    const payload = {
      name: name.trim(),
      triggerKeywords: JSON.stringify(keywords),
      replyContent: replyContent.trim(),
      isEnabled,
    };

    try {
      if (editingFlow) {
        await updateMutation.mutateAsync({ id: editingFlow.id, ...payload });
        toast.success("Flow 已更新");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Flow 已创建");
      }
      setEditDialogOpen(false);
      queryClient.liveAiFlows.list.invalidate();
    } catch (e: any) {
      toast.error("保存失败: " + e.message);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteId });
      toast.success("Flow 已删除");
      setDeleteDialogOpen(false);
      queryClient.liveAiFlows.list.invalidate();
    } catch (e: any) {
      toast.error("删除失败: " + e.message);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await duplicateMutation.mutateAsync({ id });
      toast.success("Flow 已复制（副本默认停用）");
      queryClient.liveAiFlows.list.invalidate();
    } catch (e: any) {
      toast.error("复制失败: " + e.message);
    }
  };

  const handleToggle = async (flow: any) => {
    try {
      await updateMutation.mutateAsync({ id: flow.id, isEnabled: !flow.isEnabled });
      queryClient.liveAiFlows.list.invalidate();
    } catch (e: any) {
      toast.error("切换失败: " + e.message);
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === flows.length - 1) return;
    const newIds = flows.map((f) => f.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newIds[index], newIds[swapIndex]] = [newIds[swapIndex], newIds[index]];
    try {
      await reorderMutation.mutateAsync({ ids: newIds });
      queryClient.liveAiFlows.list.invalidate();
    } catch (e: any) {
      toast.error("排序失败: " + e.message);
    }
  };

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">请先登录</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            直播 AI 客服
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            基于 Flow 的 Facebook 直播留言自动回复系统 — 仅回复已建立的 Flow，未匹配的留言不回复
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          新增 Flow
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{flows.length}</div>
            <div className="text-xs text-muted-foreground">Flow 总数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {flows.filter((f) => f.isEnabled).length}
            </div>
            <div className="text-xs text-muted-foreground">启用中</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-muted-foreground">
              {flows.filter((f) => !f.isEnabled).length}
            </div>
            <div className="text-xs text-muted-foreground">已停用</div>
          </CardContent>
        </Card>
      </div>

      {/* Flow list */}
      {flowsQuery.isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">加载中...</CardContent></Card>
      ) : flows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">尚未建立任何 AI Flow</p>
            <p className="text-xs mt-1">点击「新增 Flow」开始建立直播自动回复规则</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {flows.map((flow, index) => {
            let parsedKeywords: string[] = [];
            try {
              parsedKeywords = JSON.parse(flow.triggerKeywords);
            } catch { /* ignore */ }
            return (
              <Card key={flow.id} className={!flow.isEnabled ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base">{flow.name}</span>
                        <Badge variant={flow.isEnabled ? "default" : "secondary"}>
                          {flow.isEnabled ? "启用" : "停用"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">#{flow.sortOrder}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {parsedKeywords.map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2 whitespace-pre-wrap">
                        {flow.replyContent}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => handleMove(index, "up")} disabled={index === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleMove(index, "down")} disabled={index === flows.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(flow)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDuplicate(flow.id)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleToggle(flow)}>
                        <Switch checked={flow.isEnabled} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setDeleteId(flow.id); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFlow ? "编辑 Flow" : "新增 Flow"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Flow 名称</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：营业地点、运费、付款方式"
              />
            </div>

            <div className="space-y-2">
              <Label>触发关键词</Label>
              <p className="text-xs text-muted-foreground">
                客户留言内容接近任一关键词即触发自动回复，不需要完全一致
              </p>
              <div className="flex gap-2">
                <Input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  placeholder="输入关键词后按 Enter 添加"
                />
                <Button type="button" onClick={addKeyword} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {keywords.map((kw, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeKeyword(kw)}>
                      {kw} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>自动回复内容</Label>
              <p className="text-xs text-muted-foreground">
                支援文字、Emoji、网址、Google Map、电话号码、换行
              </p>
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={6}
                placeholder={"例如：\n营业时间：9am - 6pm\n地址：123 Jalan Example, KL\nGoogle Map: https://maps.google.com/...\n电话：012-3456789"}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>是否启用</Label>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave}>
              {editingFlow ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个 Flow 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
