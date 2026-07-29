import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Send, Sparkles, Eye } from "lucide-react";
import { toast } from "sonner";

export default function AiBrainPersona() {
  const { data: persona, isLoading } = trpc.aiBrain.getPersona.useQuery();
  const updateMutation = trpc.aiBrain.updatePersona.useMutation({
    onSuccess: () => toast.success("AI 人设已保存"),
    onError: () => toast.error("保存失败"),
  });
  const previewMutation = trpc.aiBrain.previewReply.useMutation();

  const [form, setForm] = useState({
    aiName: "小田",
    brandName: "心田 Xintian",
    aiSelfReference: "小田",
    customerAddress: "亲爱的",
    replyTone: "warm",
    defaultLanguage: "zh",
    supportedLanguages: '["zh","en","ms"]',
    emojiLevel: "low",
    replyLength: "medium",
    proactiveRecommend: true,
    proactiveInquire: true,
    enableCTA: true,
    ctaTemplate: "还有什么小田可以帮到你的吗？",
    customPrompt: "",
  });

  const [previewInput, setPreviewInput] = useState("");
  const [previewResult, setPreviewResult] = useState("");

  useEffect(() => {
    if (persona) {
      setForm({
        aiName: persona.aiName || "小田",
        brandName: persona.brandName || "心田 Xintian",
        aiSelfReference: persona.aiSelfReference || "小田",
        customerAddress: persona.customerAddress || "亲爱的",
        replyTone: persona.replyTone || "warm",
        defaultLanguage: persona.defaultLanguage || "zh",
        supportedLanguages: persona.supportedLanguages || '["zh","en","ms"]',
        emojiLevel: persona.emojiLevel || "low",
        replyLength: persona.replyLength || "medium",
        proactiveRecommend: persona.proactiveRecommend ?? true,
        proactiveInquire: persona.proactiveInquire ?? true,
        enableCTA: persona.enableCTA ?? true,
        ctaTemplate: persona.ctaTemplate || "还有什么小田可以帮到你的吗？",
        customPrompt: persona.customPrompt || "",
      });
    }
  }, [persona]);

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const handlePreview = () => {
    if (!previewInput.trim()) return;
    setPreviewResult("生成中...");
    previewMutation.mutate(
      { userMessage: previewInput },
      {
        onSuccess: (data: any) => {
          setPreviewResult(data.reply || "（无回复）");
        },
        onError: (err: any) => {
          setPreviewResult(`预览失败：${err.message || "未知错误"}`);
        },
      }
    );
  };

  const update = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">加载 AI 人设中...</div>;
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* 左侧：编辑表单 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="w-5 h-5" />
            AI 人设设置
          </h2>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "保存中..." : "保存设置"}
          </Button>
        </div>

        <Card>
          <CardContent className="py-4 space-y-4">
            {/* 基本设置 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>AI 名称</Label>
                <Input value={form.aiName} onChange={e => update("aiName", e.target.value)} placeholder="小田" />
              </div>
              <div>
                <Label>品牌名称</Label>
                <Input value={form.brandName} onChange={e => update("brandName", e.target.value)} placeholder="心田 Xintian" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>AI 自称</Label>
                <Input value={form.aiSelfReference} onChange={e => update("aiSelfReference", e.target.value)} placeholder="小田" />
              </div>
              <div>
                <Label>客户称呼</Label>
                <Input value={form.customerAddress} onChange={e => update("customerAddress", e.target.value)} placeholder="亲爱的" />
              </div>
            </div>

            {/* 语气与语言 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>回复语气</Label>
                <Select value={form.replyTone} onValueChange={v => update("replyTone", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm">温暖亲切</SelectItem>
                    <SelectItem value="friendly">友善轻松</SelectItem>
                    <SelectItem value="professional">专业正式</SelectItem>
                    <SelectItem value="casual">随性自然</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>默认语言</Label>
                <Select value={form.defaultLanguage} onValueChange={v => update("defaultLanguage", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ms">Bahasa Melayu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>支持语言（JSON 数组）</Label>
                <Input value={form.supportedLanguages} onChange={e => update("supportedLanguages", e.target.value)} placeholder='["zh","en","ms"]' />
              </div>
              <div>
                <Label>Emoji 使用程度</Label>
                <Select value={form.emojiLevel} onValueChange={v => update("emojiLevel", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不使用</SelectItem>
                    <SelectItem value="low">少量</SelectItem>
                    <SelectItem value="medium">适度</SelectItem>
                    <SelectItem value="high">多使用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>回复长度</Label>
              <Select value={form.replyLength} onValueChange={v => update("replyLength", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">简短（1-2 句）</SelectItem>
                  <SelectItem value="medium">适中（3-5 句）</SelectItem>
                  <SelectItem value="long">详细（5 句以上）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 行为开关 */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label>主动推荐商品</Label>
                <Switch checked={form.proactiveRecommend} onCheckedChange={v => update("proactiveRecommend", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>主动询问客户需求</Label>
                <Switch checked={form.proactiveInquire} onCheckedChange={v => update("proactiveInquire", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>回复结尾加入 CTA</Label>
                <Switch checked={form.enableCTA} onCheckedChange={v => update("enableCTA", v)} />
              </div>
              {form.enableCTA && (
                <div>
                  <Label>CTA 文案</Label>
                  <Input value={form.ctaTemplate} onChange={e => update("ctaTemplate", e.target.value)} placeholder="还有什么小田可以帮到你的吗？" />
                </div>
              )}
            </div>

            {/* 自定义提示词 */}
            <div className="pt-2 border-t">
              <Label>自定义提示词（高级，可选）</Label>
              <Textarea
                value={form.customPrompt}
                onChange={e => update("customPrompt", e.target.value)}
                rows={3}
                placeholder="额外的 AI 行为指令，例如：优先推荐当季花卉，避免推荐缺货商品..."
              />
              <p className="text-xs text-muted-foreground mt-1">此内容会追加到 AI 系统提示词末尾，用于高级定制。</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 右侧：即时预览 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="w-5 h-5" />
          即时预览
        </h2>
        <Card>
          <CardContent className="py-4 space-y-4">
            <div>
              <Label>输入测试问题</Label>
              <div className="flex gap-2">
                <Input
                  value={previewInput}
                  onChange={e => setPreviewInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePreview(); } }}
                  placeholder="例如：你们有什么花推荐？"
                />
                <Button onClick={handlePreview} disabled={!previewInput.trim() || previewMutation.isPending} size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">预览基于当前人设设置生成，不会真实发送给客户。</p>
            </div>

            {/* 预览结果 — 模拟聊天气泡 */}
            <div className="rounded-lg border bg-muted/30 p-4 min-h-[200px]">
              {previewInput && (
                <div className="flex justify-end mb-3">
                  <div className="bg-blue-100 text-blue-900 rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%] text-sm">
                    {previewInput}
                  </div>
                </div>
              )}
              {previewResult && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-2 max-w-[85%]">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-tl-sm px-4 py-2 text-sm whitespace-pre-wrap">
                      {previewResult}
                    </div>
                  </div>
                </div>
              )}
              {!previewResult && !previewInput && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  输入问题后点击发送，查看 AI 模拟回复
                </div>
              )}
            </div>

            {/* 快捷测试问题 */}
            <div className="flex flex-wrap gap-2">
              {["你们有什么花推荐？", "运费怎么算？", "怎么付款？", "会员有什么好处？"].map(q => (
                <Button key={q} variant="outline" size="sm" onClick={() => { setPreviewInput(q); }}>
                  {q}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
