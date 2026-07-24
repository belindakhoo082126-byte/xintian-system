import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { MessageSquare, Plus, Edit2, Trash2, Send, Clock, AlertCircle } from "lucide-react";

export default function Flows() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: templates, isLoading } = trpc.flows.list.useQuery();

  const { data: steps } = trpc.flows.listSteps.useQuery(
    { templateId: currentTemplateId ?? 0 },
    { enabled: currentTemplateId !== null }
  );

  const createMutation = trpc.flows.create.useMutation({
    onSuccess: () => {
      utils.flows.invalidate();
      toast.success("Flow 模板创建成功");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(`创建失败: ${e.message}`),
  });

  const updateMutation = trpc.flows.update.useMutation({
    onSuccess: () => {
      utils.flows.invalidate();
      toast.success("Flow 模板更新成功");
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const deleteMutation = trpc.flows.delete.useMutation({
    onSuccess: () => {
      utils.flows.invalidate();
      toast.success("Flow 模板已删除");
    },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
  });

  const createStepMutation = trpc.flows.createStep.useMutation({
    onSuccess: () => {
      utils.flows.listSteps.invalidate();
      toast.success("步骤已添加");
    },
    onError: (e) => toast.error(`添加失败: ${e.message}`),
  });

  const deleteStepMutation = trpc.flows.deleteStep.useMutation({
    onSuccess: () => {
      utils.flows.listSteps.invalidate();
      toast.success("步骤已删除");
    },
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    messageContent: "您好，您的心田会员费用已经确认收到❤️\n\n感谢您加入心田会员。\n\n请点击以下按钮进入 Telegram，按照里面的步骤完成会员开通及加入会员群。",
    imageUrl: "",
    videoUrl: "",
    buttonName: "进入心田会员系统",
    buttonLink: "",
    reminderEnabled: true,
    reminderDelayHours: 24,
    reminderMessage: "您好，您还没有完成心田会员入群步骤，请点击以下链接继续操作。",
    reminderMaxCount: 3,
    followUpEnabled: true,
    followUpDelayHours: 72,
    isActive: true,
  });

  const [newStep, setNewStep] = useState({
    stepOrder: 1,
    stepName: "",
    messageType: "text" as "text" | "image" | "video" | "button" | "contact_support",
    messageContent: "",
    mediaUrl: "",
    buttonName: "",
    buttonLink: "",
    delaySeconds: 0,
    conditionType: "always" as "always" | "if_not_clicked" | "if_clicked",
  });

  function resetForm() {
    setForm({
      name: "", description: "",
      messageContent: "您好，您的心田会员费用已经确认收到❤️\n\n感谢您加入心田会员。\n\n请点击以下按钮进入 Telegram，按照里面的步骤完成会员开通及加入会员群。",
      imageUrl: "", videoUrl: "",
      buttonName: "进入心田会员系统", buttonLink: "",
      reminderEnabled: true, reminderDelayHours: 24,
      reminderMessage: "您好，您还没有完成心田会员入群步骤，请点击以下链接继续操作。",
      reminderMaxCount: 3, followUpEnabled: true, followUpDelayHours: 72,
      isActive: true,
    });
    setEditingId(null);
  }

  function openEdit(t: any) {
    setEditingId(t.id);
    setForm({
      name: t.name || "",
      description: t.description || "",
      messageContent: t.messageContent || "",
      imageUrl: t.imageUrl || "",
      videoUrl: t.videoUrl || "",
      buttonName: t.buttonName || "进入心田会员系统",
      buttonLink: t.buttonLink || "",
      reminderEnabled: t.reminderEnabled ?? true,
      reminderDelayHours: t.reminderDelayHours ?? 24,
      reminderMessage: t.reminderMessage || "",
      reminderMaxCount: t.reminderMaxCount ?? 3,
      followUpEnabled: t.followUpEnabled ?? true,
      followUpDelayHours: t.followUpDelayHours ?? 72,
      isActive: t.isActive ?? true,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("请输入 Flow 名称");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  function openSteps(templateId: number) {
    setCurrentTemplateId(templateId);
    setStepsOpen(true);
    setNewStep({ ...newStep, stepOrder: (steps?.length ?? 0) + 1 });
  }

  function handleAddStep() {
    if (!currentTemplateId) return;
    if (!newStep.stepName.trim()) {
      toast.error("请输入步骤名称");
      return;
    }
    createStepMutation.mutate({
      flowTemplateId: currentTemplateId,
      ...newStep,
    });
    setNewStep({
      stepOrder: (steps?.length ?? 0) + 2,
      stepName: "",
      messageType: "text",
      messageContent: "",
      mediaUrl: "",
      buttonName: "",
      buttonLink: "",
      delaySeconds: 0,
      conditionType: "always",
    });
  }

  const MESSAGE_TYPES = [
    { value: "text", label: "文字消息" },
    { value: "image", label: "图片" },
    { value: "video", label: "视频" },
    { value: "button", label: "按钮" },
    { value: "contact_support", label: "联系客服" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flow 编辑器</h1>
          <p className="text-sm text-muted-foreground mt-1">
            配置会员付款成功后的 Messenger 自动发送流程
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          新增 Flow 模板
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flow 名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>按钮名称</TableHead>
                <TableHead>提醒</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : templates?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">暂无 Flow 模板</TableCell></TableRow>
              ) : templates?.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{t.description || "-"}</TableCell>
                  <TableCell>{t.buttonName || "-"}</TableCell>
                  <TableCell>
                    {t.reminderEnabled ? (
                      <Badge variant="default">
                        <Clock className="h-3 w-3 mr-1" />
                        {t.reminderDelayHours}h
                      </Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.isActive ? "default" : "outline"}>
                      {t.isActive ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openSteps(t.id)}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      步骤
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm(`确定删除「${t.name}」？`)) {
                        deleteMutation.mutate({ id: t.id });
                      }
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Flow Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑 Flow 模板" : "新增 Flow 模板"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Flow 名称 *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="会员付款成功 Flow" />
              </div>
              <div>
                <Label>状态</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                  <span className="text-sm">{form.isActive ? "启用" : "停用"}</span>
                </div>
              </div>
            </div>

            <div>
              <Label>描述</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="简要描述此 Flow 的用途" />
            </div>

            <div>
              <Label>消息内容 *</Label>
              <Textarea value={form.messageContent} onChange={(e) => setForm({ ...form, messageContent: e.target.value })}
                rows={5} />
              <p className="text-xs text-muted-foreground mt-1">支持换行，将原样发送给客户</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>图片 URL（可选）</Label>
                <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..." />
              </div>
              <div>
                <Label>视频 URL（可选）</Label>
                <Input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                  placeholder="https://..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>按钮名称</Label>
                <Input value={form.buttonName} onChange={(e) => setForm({ ...form, buttonName: e.target.value })} />
              </div>
              <div>
                <Label>按钮链接（Telegram）</Label>
                <Input value={form.buttonLink} onChange={(e) => setForm({ ...form, buttonLink: e.target.value })}
                  placeholder="https://t.me/..." />
              </div>
            </div>

            {/* Reminder config */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <Label>启用未点击提醒</Label>
                <Switch checked={form.reminderEnabled} onCheckedChange={(v) => setForm({ ...form, reminderEnabled: v })} />
              </div>
              {form.reminderEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>提醒延迟（小时）</Label>
                      <Input type="number" value={form.reminderDelayHours}
                        onChange={(e) => setForm({ ...form, reminderDelayHours: parseInt(e.target.value) || 24 })} />
                    </div>
                    <div>
                      <Label>最大提醒次数</Label>
                      <Input type="number" value={form.reminderMaxCount}
                        onChange={(e) => setForm({ ...form, reminderMaxCount: parseInt(e.target.value) || 3 })} />
                    </div>
                  </div>
                  <div>
                    <Label>提醒消息内容</Label>
                    <Textarea value={form.reminderMessage}
                      onChange={(e) => setForm({ ...form, reminderMessage: e.target.value })}
                      rows={2} />
                  </div>
                </>
              )}
            </div>

            {/* Follow-up config */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <Label>启用人工跟进</Label>
                <Switch checked={form.followUpEnabled} onCheckedChange={(v) => setForm({ ...form, followUpEnabled: v })} />
              </div>
              {form.followUpEnabled && (
                <div>
                  <Label>人工跟进延迟（小时）</Label>
                  <Input type="number" value={form.followUpDelayHours}
                    onChange={(e) => setForm({ ...form, followUpDelayHours: parseInt(e.target.value) || 72 })} />
                  <p className="text-xs text-muted-foreground mt-1">
                    超过此时间客户仍未点击链接，系统将标记为「待人工跟进」
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flow Steps Dialog */}
      <Dialog open={stepsOpen} onOpenChange={setStepsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Flow 步骤配置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing steps */}
            <div className="space-y-2">
              {steps?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无步骤，请添加</p>
              ) : steps?.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">步骤 {s.stepOrder}</Badge>
                    <div>
                      <p className="font-medium text-sm">{s.stepName}</p>
                      <p className="text-xs text-muted-foreground">
                        {MESSAGE_TYPES.find(t => t.value === s.messageType)?.label}
                        {s.delaySeconds ? ` · 延迟 ${s.delaySeconds}s` : ""}
                        {s.conditionType === "if_not_clicked" ? " · 仅未点击时" : ""}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon"
                    onClick={() => deleteStepMutation.mutate({ id: s.id })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add new step */}
            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium text-sm">添加新步骤</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>步骤顺序</Label>
                  <Input type="number" value={newStep.stepOrder}
                    onChange={(e) => setNewStep({ ...newStep, stepOrder: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label>步骤名称</Label>
                  <Input value={newStep.stepName}
                    onChange={(e) => setNewStep({ ...newStep, stepName: e.target.value })}
                    placeholder="确认收款" />
                </div>
              </div>
              <div>
                <Label>消息类型</Label>
                <Select value={newStep.messageType}
                  onValueChange={(v: any) => setNewStep({ ...newStep, messageType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESSAGE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>消息内容</Label>
                <Textarea value={newStep.messageContent}
                  onChange={(e) => setNewStep({ ...newStep, messageContent: e.target.value })}
                  rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>延迟（秒）</Label>
                  <Input type="number" value={newStep.delaySeconds}
                    onChange={(e) => setNewStep({ ...newStep, delaySeconds: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>发送条件</Label>
                  <Select value={newStep.conditionType}
                    onValueChange={(v: any) => setNewStep({ ...newStep, conditionType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always">总是发送</SelectItem>
                      <SelectItem value="if_not_clicked">仅未点击链接时</SelectItem>
                      <SelectItem value="if_clicked">仅已点击链接时</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(newStep.messageType === "button") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>按钮名称</Label>
                    <Input value={newStep.buttonName}
                      onChange={(e) => setNewStep({ ...newStep, buttonName: e.target.value })} />
                  </div>
                  <div>
                    <Label>按钮链接</Label>
                    <Input value={newStep.buttonLink}
                      onChange={(e) => setNewStep({ ...newStep, buttonLink: e.target.value })} />
                  </div>
                </div>
              )}
              <Button onClick={handleAddStep} size="sm" disabled={createStepMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                添加步骤
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
