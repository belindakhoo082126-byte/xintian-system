import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Music2, Upload, X } from "lucide-react";

const DEFAULT_MESSAGE = `🎉 欢迎加入【心田会员俱乐部】

感谢您的汇款 ❤️

📱 如您还未安装 Telegram，请先下载并注册 Telegram 账号。

👇 完成后请点击以下链接进入会员群：
https://t.me/+RG2JZFtDkVphNmI1

进入群组后，您会看见【心田精灵管家】发送的欢迎讯息。

只需根据图片步骤操作即可完成注册：
✅ 点击心田精灵管家私聊链接
✅ 点击「分享联系方式」按钮
✅ 填写推荐人（如有）
✅ 选择生日月份与日期（选填）

完成后即可正式成为会员 🌱

如过程中遇到任何问题，欢迎随时在 Telegram 联系心田精灵管家协助 ❤️`;

export default function Flows() {
  const { translate } = useI18n();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const utils = trpc.useUtils();

  const { data: templates, isLoading } = trpc.flows.list.useQuery();

  const createMutation = trpc.flows.create.useMutation({
    onSuccess: () => {
      utils.flows.invalidate();
      toast.success(translate("Flow 模板创建成功", "Flow template created successfully"));
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(translate("创建失败: {message}", "Creation failed: {message}", { message: e.message })),
  });

  const updateMutation = trpc.flows.update.useMutation({
    onSuccess: () => {
      utils.flows.invalidate();
      toast.success(translate("Flow 模板更新成功", "Flow template updated successfully"));
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(translate("更新失败: {message}", "Update failed: {message}", { message: e.message })),
  });

  const deleteMutation = trpc.flows.delete.useMutation({
    onSuccess: () => {
      utils.flows.invalidate();
      toast.success(translate("Flow 模板已删除", "Flow template deleted"));
    },
    onError: (e: any) => toast.error(translate("删除失败: {message}", "Deletion failed: {message}", { message: e.message })),
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    messageContent: DEFAULT_MESSAGE,
    imageUrl: "",
    videoUrl: "",
    audioUrl: "",
    buttonName: "",
    buttonLink: "",
    reminderEnabled: false,
    reminderDelayHours: 24,
    reminderMessage: "",
    reminderMaxCount: 3,
    followUpEnabled: false,
    followUpDelayHours: 72,
    isActive: true,
  });

  function resetForm() {
    setForm({
      name: "",
      description: "",
      messageContent: DEFAULT_MESSAGE,
      imageUrl: "",
      videoUrl: "",
      audioUrl: "",
      buttonName: "",
      buttonLink: "",
      reminderEnabled: false,
      reminderDelayHours: 24,
      reminderMessage: "",
      reminderMaxCount: 3,
      followUpEnabled: false,
      followUpDelayHours: 72,
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
      audioUrl: t.audioUrl || "",
      buttonName: t.buttonName || "",
      buttonLink: t.buttonLink || "",
      reminderEnabled: t.reminderEnabled ?? false,
      reminderDelayHours: t.reminderDelayHours ?? 24,
      reminderMessage: t.reminderMessage || "",
      reminderMaxCount: t.reminderMaxCount ?? 3,
      followUpEnabled: t.followUpEnabled ?? false,
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

  async function handleAudioUpload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error(translate("请上传音频文件", "Please upload an audio file"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(translate("语音文件不能超过 10MB", "Audio file must not exceed 10MB"));
      return;
    }
    setAudioUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to read audio file"));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: dataUrl, filename: file.name, contentType: file.type }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Upload failed");
      setForm(current => ({ ...current, audioUrl: result.url }));
      toast.success(translate("语音已上传", "Voice audio uploaded"));
    } catch (error: any) {
      toast.error(translate("语音上传失败: {message}", "Voice upload failed: {message}", { message: error.message }));
    } finally {
      setAudioUploading(false);
    }
  }

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
                <TableHead>{translate("媒体", "Media")}</TableHead>
                <TableHead>{translate("状态", "Status")}</TableHead>
                <TableHead className="text-right">{translate("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
              ) : templates?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{translate("暂无 Flow 模板", "No Flow templates yet")}</TableCell></TableRow>
              ) : templates?.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{t.description || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.imageUrl && <Badge variant="default">{translate("图片", "Image")}</Badge>}
                      {t.audioUrl && <Badge variant="secondary"><Music2 className="mr-1 h-3 w-3" />{translate("语音", "Audio")}</Badge>}
                      {!t.imageUrl && !t.audioUrl && "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.isActive ? "default" : "outline"}>
                      {t.isActive ? translate("启用", "Enabled") : translate("停用", "Disabled")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm(translate("确定删除「{name}」？", "Are you sure you want to delete '{name}'?", { name: t.name }))) {
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
                rows={12} />
              <p className="text-xs text-muted-foreground mt-1">{translate("支持换行，将原样发送给客户。Telegram 群链接直接写在文案中即可。", "Supports line breaks, will be sent to the customer as is. Telegram group link should be included in the text.")}</p>
            </div>

            <div>
              <Label>{translate("教学图片 URL（可选）", "Tutorial Image URL (optional)")}</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://..." />
              <p className="text-xs text-muted-foreground mt-1">{translate("会员注册教学图片，将在文案发送后自动发送给客户", "Membership tutorial image, will be sent to customer after the message text")}</p>
            </div>

            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <Label>{translate("语音欢迎讯息（可选）", "Voice Greeting (optional)")}</Label>
              <p className="text-xs text-muted-foreground">{translate("会在文字与教学图片后以Messenger语音附件发送。支持常见音频格式，最大10MB。", "Sent as a Messenger audio attachment after the text and tutorial image. Common audio formats supported, up to 10MB.")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input id="flow-audio-upload" type="file" accept="audio/*" className="sr-only" onChange={(e) => handleAudioUpload(e.target.files?.[0])} />
                <Button type="button" variant="outline" size="sm" disabled={audioUploading} onClick={() => document.getElementById("flow-audio-upload")?.click()}>
                  <Upload className="mr-2 h-4 w-4" />{audioUploading ? translate("上传中...", "Uploading...") : translate("上传语音", "Upload Voice")}
                </Button>
                <Input className="min-w-[220px] flex-1" value={form.audioUrl} onChange={(e) => setForm({ ...form, audioUrl: e.target.value })} placeholder={translate("或粘贴安全语音 URL", "Or paste a secure audio URL")} />
              </div>
              {form.audioUrl && <div className="flex items-center gap-2"><audio controls className="h-9 flex-1" src={form.audioUrl} /><Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, audioUrl: "" })} aria-label={translate("移除语音", "Remove audio")}><X className="h-4 w-4" /></Button></div>}
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
    </div>
  );
}
