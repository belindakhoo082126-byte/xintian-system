import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
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
  const { lang, translate } = useI18n();
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
      toast.success(translate("Flow 模板创建成功", "Flow template created successfully"));
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(translate("创建失败: {message}", "Creation failed: {message}", { message: e.message })),
  });

  const updateMutation = trpc.flows.update.useMutation({
    onSuccess: () => {
      utils.flows.invalidate();
      toast.success(translate("Flow 模板更新成功", "Flow template updated successfully"));
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(translate("更新失败: {message}", "Update failed: {message}", { message: e.message })),
  });

  const deleteMutation = trpc.flows.delete.useMutation({
    onSuccess: () => {
      utils.flows.invalidate();
      toast.success(translate("Flow 模板已删除", "Flow template deleted"));
    },
    onError: (e) => toast.error(translate("删除失败: {message}", "Deletion failed: {message}", { message: e.message })),
  });

  const createStepMutation = trpc.flows.createStep.useMutation({
    onSuccess: () => {
      utils.flows.listSteps.invalidate();
      toast.success(translate("步骤已添加", "Step added successfully"));
    },
    onError: (e) => toast.error(translate("添加失败: {message}", "Add failed: {message}", { message: e.message })),
  });

  const deleteStepMutation = trpc.flows.deleteStep.useMutation({
    onSuccess: () => {
      utils.flows.listSteps.invalidate();
      toast.success(translate("步骤已删除", "Step deleted successfully"));
    },
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    messageContent: translate("您好，您的心田会员费用已经确认收到❤️\n\n感谢您加入心田会员。\n\n请点击以下按钮进入 Telegram，按照里面的步骤完成会员开通及加入会员群。", "Hello, your Xintian membership fee has been confirmed ❤️\n\nThank you for joining Xintian membership.\n\nPlease click the button below to enter Telegram and follow the steps to activate your membership and join the member group."),
    imageUrl: "",
    videoUrl: "",
    buttonName: translate("进入心田会员系统", "Enter Xintian Membership System"),
    buttonLink: "",
    reminderEnabled: true,
    reminderDelayHours: 24,
    reminderMessage: translate("您好，您还没有完成心田会员入群步骤，请点击以下链接继续操作。", "Hello, you have not yet completed the steps to join the Xintian member group. Please click the link below to continue."),
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
      messageContent: translate("您好，您的心田会员费用已经确认收到❤️\n\n感谢您加入心田会员。\n\n请点击以下按钮进入 Telegram，按照里面的步骤完成会员开通及加入会员群。", "Hello, your Xintian membership fee has been confirmed ❤️\n\nThank you for joining Xintian membership.\n\nPlease click the button below to enter Telegram and follow the steps to activate your membership and join the member group."),
      imageUrl: "", videoUrl: "",
      buttonName: translate("进入心田会员系统", "Enter Xintian Membership System"), buttonLink: "",
      reminderEnabled: true, reminderDelayHours: 24,
      reminderMessage: translate("您好，您还没有完成心田会员入群步骤，请点击以下链接继续操作。", "Hello, you have not yet completed the steps to join the Xintian member group. Please click the link below to continue."),
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
      buttonName: t.buttonName || translate("进入心田会员系统", "Enter Xintian Membership System"),
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
      toast.error(translate("请输入 Flow 名称", "Please enter Flow name"));
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
      toast.error(translate("请输入步骤名称", "Please enter step name"));
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
    { value: "text", label: translate("文字消息", "Text Message") },
    { value: "image", label: translate("图片", "Image") },
    { value: "video", label: translate("视频", "Video") },
    { value: "button", label: translate("按钮", "Button") },
    { value: "contact_support", label: translate("联系客服", "Contact Support") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("Flow 编辑器", "Flow Editor")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {translate("配置会员付款成功后的 Messenger 自动发送流程", "Configure Messenger automated sending process after successful membership payment")}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          {translate("新增 Flow 模板", "Add Flow Template")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate("Flow 名称", "Flow Name")}</TableHead>
                <TableHead>{translate("描述", "Description")}</TableHead>
                <TableHead>{translate("按钮名称", "Button Name")}</TableHead>
                <TableHead>{translate("提醒", "Reminder")}</TableHead>
                <TableHead>{translate("状态", "Status")}</TableHead>
                <TableHead className="text-right">{translate("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
              ) : templates?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{translate("暂无 Flow 模板", "No Flow templates yet")}</TableCell></TableRow>
              ) : templates?.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{t.description || "-"}</TableCell>
                  <TableCell>{t.buttonName || "-"}</TableCell>
                  <TableCell>
                    {t.reminderEnabled ? (
                      <Badge variant="default">
                        <Clock className="h-3 w-3 mr-1" />
                        {translate("{hours}h", "{hours}h", { hours: t.reminderDelayHours })}
                      </Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.isActive ? "default" : "outline"}>
                      {t.isActive ? translate("启用", "Enabled") : translate("停用", "Disabled")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openSteps(t.id)}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      {translate("步骤", "Steps")}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm(translate("确定删除「{name}」？", "Are you sure you want to delete \'{name}\'?", { name: t.name }))) {
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
            <DialogTitle>{editingId ? translate("编辑 Flow 模板", "Edit Flow Template") : translate("新增 Flow 模板", "Add Flow Template")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{translate("Flow 名称 *", "Flow Name *")}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={translate("会员付款成功 Flow", "Membership Payment Success Flow")} />
              </div>
              <div>
                <Label>{translate("状态", "Status")}</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                  <span className="text-sm">{form.isActive ? translate("启用", "Enabled") : translate("停用", "Disabled")}</span>
                </div>
              </div>
            </div>

            <div>
              <Label>{translate("描述", "Description")}</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={translate("简要描述此 Flow 的用途", "Briefly describe the purpose of this Flow")} />
            </div>

            <div>
              <Label>{translate("消息内容 *", "Message Content *")}</Label>
              <Textarea value={form.messageContent} onChange={(e) => setForm({ ...form, messageContent: e.target.value })}
                rows={5} />
              <p className="text-xs text-muted-foreground mt-1">{translate("支持换行，将原样发送给客户", "Supports line breaks, will be sent to the customer as is")}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{translate("图片 URL（可选）", "Image URL (optional)")}</Label>
                <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..." />
              </div>
              <div>
                <Label>{translate("视频 URL（可选）", "Video URL (optional)")}</Label>
                <Input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                  placeholder="https://..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{translate("按钮名称", "Button Name")}</Label>
                <Input value={form.buttonName} onChange={(e) => setForm({ ...form, buttonName: e.target.value })} />
              </div>
              <div>
                <Label>{translate("按钮链接（Telegram）", "Button Link (Telegram)")}</Label>
                <Input value={form.buttonLink} onChange={(e) => setForm({ ...form, buttonLink: e.target.value })}
                  placeholder="https://t.me/..." />
              </div>
            </div>

            {/* Reminder config */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <Label>{translate("启用未点击提醒", "Enable unclicked reminder")}</Label>
                <Switch checked={form.reminderEnabled} onCheckedChange={(v) => setForm({ ...form, reminderEnabled: v })} />
              </div>
              {form.reminderEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{translate("提醒延迟（小时）", "Reminder Delay (hours)")}</Label>
                      <Input type="number" value={form.reminderDelayHours}
                        onChange={(e) => setForm({ ...form, reminderDelayHours: parseInt(e.target.value) || 24 })} />
                    </div>
                    <div>
                      <Label>{translate("最大提醒次数", "Max Reminder Count")}</Label>
                      <Input type="number" value={form.reminderMaxCount}
                        onChange={(e) => setForm({ ...form, reminderMaxCount: parseInt(e.target.value) || 3 })} />
                    </div>
                  </div>
                  <div>
                    <Label>{translate("提醒消息内容", "Reminder Message Content")}</Label>
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
                <Label>{translate("启用人工跟进", "Enable Manual Follow-up")}</Label>
                <Switch checked={form.followUpEnabled} onCheckedChange={(v) => setForm({ ...form, followUpEnabled: v })} />
              </div>
              {form.followUpEnabled && (
                <div>
                  <Label>{translate("人工跟进延迟（小时）", "Manual Follow-up Delay (hours)")}</Label>
                  <Input type="number" value={form.followUpDelayHours}
                    onChange={(e) => setForm({ ...form, followUpDelayHours: parseInt(e.target.value) || 72 })} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {translate("超过此时间客户仍未点击链接，系统将标记为「待人工跟进」", "If the customer still hasn\'t clicked the link after this time, the system will mark it as \'Pending Manual Follow-up\'")}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? translate("保存", "Save") : translate("创建", "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flow Steps Dialog */}
      <Dialog open={stepsOpen} onOpenChange={setStepsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate("Flow 步骤配置", "Flow Step Configuration")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing steps */}
            <div className="space-y-2">
              {steps?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{translate("暂无步骤，请添加", "No steps yet, please add")}</p>
              ) : steps?.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{translate("步骤 {stepOrder}", "Step {stepOrder}", { stepOrder: s.stepOrder })}</Badge>
                    <div>
                      <p className="font-medium text-sm">{s.stepName}</p>
                      <p className="text-xs text-muted-foreground">
                        {MESSAGE_TYPES.find(t => t.value === s.messageType)?.label}
                        {s.delaySeconds ? translate(" · 延迟 {delaySeconds}s", " · Delay {delaySeconds}s", { delaySeconds: s.delaySeconds }) : ""}
                        {s.conditionType === "if_not_clicked" ? translate(" · 仅未点击时", " · Only if not clicked") : ""}
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
              <h4 className="font-medium text-sm">{translate("添加新步骤", "Add New Step")}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{translate("步骤顺序", "Step Order")}</Label>
                  <Input type="number" value={newStep.stepOrder}
                    onChange={(e) => setNewStep({ ...newStep, stepOrder: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label>{translate("步骤名称", "Step Name")}</Label>
                  <Input value={newStep.stepName}
                    onChange={(e) => setNewStep({ ...newStep, stepName: e.target.value })}
                    placeholder={translate("确认收款", "Confirm Receipt")} />
                </div>
              </div>
              <div>
                <Label>{translate("消息类型", "Message Type")}</Label>
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
                <Label>{translate("消息内容", "Message Content")}</Label>
                <Textarea value={newStep.messageContent}
                  onChange={(e) => setNewStep({ ...newStep, messageContent: e.target.value })}
                  rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{translate("延迟（秒）", "Delay (seconds)")}</Label>
                  <Input type="number" value={newStep.delaySeconds}
                    onChange={(e) => setNewStep({ ...newStep, delaySeconds: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>{translate("发送条件", "Sending Condition")}</Label>
                  <Select value={newStep.conditionType}
                    onValueChange={(v: any) => setNewStep({ ...newStep, conditionType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always">{translate("总是发送", "Always Send")}</SelectItem>
                      <SelectItem value="if_not_clicked">{translate("仅未点击链接时", "Only if link not clicked")}</SelectItem>
                      <SelectItem value="if_clicked">{translate("仅已点击链接时", "Only if link clicked")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(newStep.messageType === "button") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{translate("按钮名称", "Button Name")}</Label>
                    <Input value={newStep.buttonName}
                      onChange={(e) => setNewStep({ ...newStep, buttonName: e.target.value })} />
                  </div>
                  <div>
                    <Label>{translate("按钮链接", "Button Link")}</Label>
                    <Input value={newStep.buttonLink}
                      onChange={(e) => setNewStep({ ...newStep, buttonLink: e.target.value })} />
                  </div>
                </div>
              )}
              <Button onClick={handleAddStep} size="sm" disabled={createStepMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                {translate("添加步骤", "Add Step")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
