import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bot, MessageSquare, Brain, Shield, Package, AlertCircle } from "lucide-react";

export default function AISettings() {
  const { data: settings, isLoading } = trpc.aiSettings.get.useQuery();
  const updateMutation = trpc.aiSettings.update.useMutation({
    onSuccess: () => toast.success("AI 设置已更新"),
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const [form, setForm] = useState<any>(null);

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>;
  if (!settings) return <div className="text-center py-12 text-muted-foreground">无法加载 AI 设置</div>;

  const current = form || settings;

  const handleUpdate = (key: string, value: any) => {
    const newForm = { ...current, [key]: value };
    setForm(newForm);
  };

  const handleSave = () => {
    updateMutation.mutate({
      autoReplyEnabled: current.autoReplyEnabled,
      learningMode: current.learningMode,
      minConfidenceThreshold: current.minConfidenceThreshold?.toString() || "70.00",
      messengerAiEnabled: current.messengerAiEnabled,
      whatsappAiEnabled: current.whatsappAiEnabled,
      facebookCommentsOrderOnly: current.facebookCommentsOrderOnly,
      plantDiagnosticForceHuman: current.plantDiagnosticForceHuman,
      paymentRequiresHumanConfirm: current.paymentRequiresHumanConfirm,
      parcelAnomalyDays: current.parcelAnomalyDays,
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Bot className="h-6 w-6" /> AI Agent 设置
        </h1>
        <p className="text-sm text-muted-foreground mt-1">配置 AI 自动回复行为、学习模式与各平台启用状态</p>
      </div>

      {/* Auto Reply */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> 自动回复
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>启用自动回复</Label>
              <p className="text-xs text-muted-foreground mt-1">AI 自动回复客户消息</p>
            </div>
            <Switch
              checked={current.autoReplyEnabled}
              onCheckedChange={(v) => handleUpdate("autoReplyEnabled", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Facebook 留言仅捉单</Label>
              <p className="text-xs text-muted-foreground mt-1">FB 留言不触发 AI 回复，仅捉单</p>
            </div>
            <Switch
              checked={current.facebookCommentsOrderOnly}
              onCheckedChange={(v) => handleUpdate("facebookCommentsOrderOnly", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Learning Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" /> 学习模式
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>模式</Label>
            <Select
              value={current.learningMode}
              onValueChange={(v) => handleUpdate("learningMode", v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="suggestion">建议模式 - AI 学习人工回复并生成建议</SelectItem>
                <SelectItem value="draft">草稿模式 - AI 生成草稿等待审核</SelectItem>
                <SelectItem value="disabled">关闭学习</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>最低信心值阈值 (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={current.minConfidenceThreshold}
              onChange={(e) => handleUpdate("minConfidenceThreshold", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">低于此阈值的回复将转人工处理</p>
          </div>
        </CardContent>
      </Card>

      {/* Platform Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> 平台启用
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Messenger AI</Label>
              <p className="text-xs text-muted-foreground mt-1">Facebook Messenger 自动回复</p>
            </div>
            <Switch
              checked={current.messengerAiEnabled}
              onCheckedChange={(v) => handleUpdate("messengerAiEnabled", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>WhatsApp AI</Label>
              <p className="text-xs text-muted-foreground mt-1">WhatsApp 自动回复</p>
            </div>
            <Switch
              checked={current.whatsappAiEnabled}
              onCheckedChange={(v) => handleUpdate("whatsappAiEnabled", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Human Confirmation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> 人工确认
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>植物诊断强制人工</Label>
              <p className="text-xs text-muted-foreground mt-1">植物诊断结果必须人工确认后发送</p>
            </div>
            <Switch
              checked={current.plantDiagnosticForceHuman}
              onCheckedChange={(v) => handleUpdate("plantDiagnosticForceHuman", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>汇款确认需人工</Label>
              <p className="text-xs text-muted-foreground mt-1">客户发送汇款凭证后需人工确认</p>
            </div>
            <Switch
              checked={current.paymentRequiresHumanConfirm}
              onCheckedChange={(v) => handleUpdate("paymentRequiresHumanConfirm", v)}
            />
          </div>
          <div>
            <Label>包裹异常天数</Label>
            <Input
              type="number"
              value={current.parcelAnomalyDays}
              onChange={(e) => handleUpdate("parcelAnomalyDays", parseInt(e.target.value) || 5)}
            />
            <p className="text-xs text-muted-foreground mt-1">超过此天数未妥投的包裹标记为异常</p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setForm(null)}>重置</Button>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  );
}
