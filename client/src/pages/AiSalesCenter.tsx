import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bot, CheckCircle2, ClipboardCheck, Clock3, Lightbulb, PauseCircle, PlayCircle, ShieldCheck, ShoppingBag, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type SalesForm = {
  isEnabled: boolean;
  proactiveRecommendationsEnabled: boolean;
  maxRecommendationsPerConversation: number;
  stopAfterCustomerDecline: boolean;
  recommendationCooldownHours: number;
  askEnvironmentFirst: boolean;
  askBudgetFirst: boolean;
  prioritizeEasyCare: boolean;
  minimumGrossMarginPercent: string;
};

type FollowUpForm = {
  name: string;
  delayHours: number;
  cronExpression: string;
  messageTemplate: string;
};

const DEFAULT_FORM: SalesForm = {
  isEnabled: true,
  proactiveRecommendationsEnabled: true,
  maxRecommendationsPerConversation: 2,
  stopAfterCustomerDecline: true,
  recommendationCooldownHours: 24,
  askEnvironmentFirst: true,
  askBudgetFirst: false,
  prioritizeEasyCare: true,
  minimumGrossMarginPercent: "0",
};

const DEFAULT_FOLLOW_UP_FORM: FollowUpForm = {
  name: "未付款订单温和提醒",
  delayHours: 24,
  cronExpression: "0 */2 * * *",
  messageTemplate: "您好，感谢您的支持。我们想温和提醒您，订单 {orderNumber} 目前尚未完成付款。如您需要协助、想调整商品或暂时不需要，请直接回复我们，我们会为您处理。",
};

const recommendationLabels: Record<string, string> = {
  product: "商品推荐",
  cross_sell: "关联加购",
  upsell: "升级建议",
  free_shipping_gap: "凑免邮建议",
  promotion: "促销说明",
  replenishment: "补货建议",
};

const outcomeLabels: Record<string, string> = {
  recommended: "已建议",
  pending_confirmation: "待客户确认",
  added: "已加入订单草稿",
  ordered: "已成立订单",
  handover: "已转人工",
  lost: "未成交",
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-MY", { dateStyle: "short", timeStyle: "short" });
}

function outcomeVariant(outcome: string) {
  if (["ordered", "added"].includes(outcome)) return "default" as const;
  if (outcome === "handover") return "secondary" as const;
  return "outline" as const;
}

export default function AiSalesCenter() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading: settingsLoading } = trpc.aiSales.getSettings.useQuery();
  const { data: records, isLoading: recordsLoading } = trpc.aiSales.listRecords.useQuery({ limit: 100 });
  const { data: followUpPolicies, isLoading: followUpsLoading } = trpc.aiFollowUp.listPolicies.useQuery();
  const { data: followUpDeliveries } = trpc.aiFollowUp.listDeliveries.useQuery({ limit: 16 });
  const [form, setForm] = useState<SalesForm>(DEFAULT_FORM);
  const [followUpForm, setFollowUpForm] = useState<FollowUpForm>(DEFAULT_FOLLOW_UP_FORM);

  useEffect(() => {
    if (!settings) return;
    setForm({
      isEnabled: settings.isEnabled,
      proactiveRecommendationsEnabled: settings.proactiveRecommendationsEnabled,
      maxRecommendationsPerConversation: settings.maxRecommendationsPerConversation,
      stopAfterCustomerDecline: settings.stopAfterCustomerDecline,
      recommendationCooldownHours: settings.recommendationCooldownHours,
      askEnvironmentFirst: settings.askEnvironmentFirst,
      askBudgetFirst: settings.askBudgetFirst,
      prioritizeEasyCare: settings.prioritizeEasyCare,
      minimumGrossMarginPercent: settings.minimumGrossMarginPercent ?? "0",
    });
  }, [settings]);

  const saveSettings = trpc.aiSales.updateSettings.useMutation({
    onSuccess: async () => {
      await utils.aiSales.getSettings.invalidate();
      toast.success("AI 销售策略已保存");
    },
    onError: (error) => toast.error(error.message || "无法保存 AI 销售策略"),
  });

  const createFollowUpPolicy = trpc.aiFollowUp.createPolicy.useMutation({
    onSuccess: async () => {
      await utils.aiFollowUp.listPolicies.invalidate();
      toast.success("自动跟进策略已保存为暂停状态，请审核后再明确启用");
    },
    onError: (error) => toast.error(error.message || "无法保存自动跟进策略"),
  });

  const setFollowUpPolicyEnabled = trpc.aiFollowUp.setEnabled.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.aiFollowUp.listPolicies.invalidate(),
        utils.aiFollowUp.listDeliveries.invalidate(),
      ]);
      toast.success("自动跟进策略状态已更新");
    },
    onError: (error) => toast.error(error.message || "无法更新自动跟进策略"),
  });

  const summary = useMemo(() => {
    const all = records ?? [];
    return {
      total: all.length,
      waiting: all.filter((record) => record.outcome === "pending_confirmation").length,
      converted: all.filter((record) => ["added", "ordered"].includes(record.outcome)).length,
      handover: all.filter((record) => record.wasHandover).length,
    };
  }, [records]);

  const updateForm = <K extends keyof SalesForm>(key: K, value: SalesForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    saveSettings.mutate({
      ...form,
      maxRecommendationsPerConversation: Math.max(1, Math.min(10, Number(form.maxRecommendationsPerConversation) || 1)),
      recommendationCooldownHours: Math.max(0, Math.min(720, Number(form.recommendationCooldownHours) || 0)),
      minimumGrossMarginPercent: form.minimumGrossMarginPercent || "0",
    });
  };

  const handleCreateFollowUp = () => {
    if (!followUpForm.name.trim() || !followUpForm.messageTemplate.trim()) {
      toast.error("请填写策略名称和提醒内容");
      return;
    }
    createFollowUpPolicy.mutate({
      name: followUpForm.name.trim(),
      channel: "messenger",
      triggerType: "unpaid_order",
      delayHours: Math.max(1, Math.min(720, Number(followUpForm.delayHours) || 24)),
      cronExpression: followUpForm.cronExpression.trim() || undefined,
      messageTemplate: followUpForm.messageTemplate.trim(),
      respectHandover: true,
      stopOnCustomerReply: true,
      stopOnPurchase: true,
      stopOnPayment: true,
    });
  };

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">AI 销售中心</h1>
              <Badge variant={form.isEnabled ? "default" : "secondary"}>{form.isEnabled ? "已启用" : "已暂停"}</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              统一管理 AI 的商品推荐、加购与凑免邮建议。AI 只能提出建议；价格、库存、运费与订单变更仍由既有业务服务计算，并须经客户或人工确认后执行。
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={settingsLoading || saveSettings.isPending}>
          <ClipboardCheck className="mr-2 h-4 w-4" />
          {saveSettings.isPending ? "保存中…" : "保存策略"}
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "最近建议", value: summary.total, icon: Lightbulb, tone: "text-indigo-700 bg-indigo-50 dark:bg-indigo-950/35 dark:text-indigo-300" },
          { label: "待确认", value: summary.waiting, icon: UserRoundCheck, tone: "text-amber-700 bg-amber-50 dark:bg-amber-950/35 dark:text-amber-300" },
          { label: "已转化", value: summary.converted, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/35 dark:text-emerald-300" },
          { label: "已转人工", value: summary.handover, icon: ShieldCheck, tone: "text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-200" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Bot className="h-5 w-5 text-indigo-600" />销售建议策略</CardTitle>
            <CardDescription>所有策略均通过统一回复编排器生效。人工接管、客户明确拒绝和确认购买后会停止主动追售。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SettingRow label="启用 AI 销售" description="允许 AI 在合适的客服对话中给出销售建议">
              <Switch checked={form.isEnabled} onCheckedChange={(value) => updateForm("isEnabled", value)} />
            </SettingRow>
            <SettingRow label="允许主动推荐" description="只在客户需求明确、未被人工接管时建议商品">
              <Switch checked={form.proactiveRecommendationsEnabled} onCheckedChange={(value) => updateForm("proactiveRecommendationsEnabled", value)} disabled={!form.isEnabled} />
            </SettingRow>
            <SettingRow label="客户拒绝后停止" description="客户说不需要、不要或稍后再看时停止本轮销售建议">
              <Switch checked={form.stopAfterCustomerDecline} onCheckedChange={(value) => updateForm("stopAfterCustomerDecline", value)} disabled={!form.isEnabled} />
            </SettingRow>
            <SettingRow label="先问种植环境" description="针对植物需求，先确认光照、空间与照顾条件">
              <Switch checked={form.askEnvironmentFirst} onCheckedChange={(value) => updateForm("askEnvironmentFirst", value)} disabled={!form.isEnabled} />
            </SettingRow>
            <SettingRow label="先问预算" description="在客户表示需要选择建议时优先了解可接受预算">
              <Switch checked={form.askBudgetFirst} onCheckedChange={(value) => updateForm("askBudgetFirst", value)} disabled={!form.isEnabled} />
            </SettingRow>
            <SettingRow label="优先易养商品" description="顾客未指定时，优先推荐更容易照顾的适合商品">
              <Switch checked={form.prioritizeEasyCare} onCheckedChange={(value) => updateForm("prioritizeEasyCare", value)} disabled={!form.isEnabled} />
            </SettingRow>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="每段对话最多建议" suffix="次">
                <Input type="number" min={1} max={10} value={form.maxRecommendationsPerConversation} onChange={(event) => updateForm("maxRecommendationsPerConversation", Number(event.target.value))} disabled={!form.isEnabled} />
              </Field>
              <Field label="建议冷却时间" suffix="小时">
                <Input type="number" min={0} max={720} value={form.recommendationCooldownHours} onChange={(event) => updateForm("recommendationCooldownHours", Number(event.target.value))} disabled={!form.isEnabled} />
              </Field>
              <Field label="最低毛利保护" suffix="%">
                <Input inputMode="decimal" value={form.minimumGrossMarginPercent} onChange={(event) => updateForm("minimumGrossMarginPercent", event.target.value)} disabled={!form.isEnabled} />
              </Field>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-sm text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/25 dark:text-indigo-100">
              <p className="font-medium">受控执行说明</p>
              <p className="mt-1 text-indigo-900/80 dark:text-indigo-100/80">AI 不会自行更改价格、扣减库存、建单或安排配送。任何加购和订单动作会被记录为待确认事项，待客户或工作人员确认后才交由现有订单服务执行。</p>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5 text-indigo-600" />销售建议审计</CardTitle>
            <CardDescription>显示最新 100 条销售建议及其结果。页面只展示客户可见建议和执行状态，不显示采购成本或利润金额。</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>渠道 / 类型</TableHead>
                    <TableHead className="min-w-[180px]">客户需求与建议</TableHead>
                    <TableHead>客户回应</TableHead>
                    <TableHead>结果</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordsLoading ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">加载销售审计中…</TableCell></TableRow>
                  ) : !records?.length ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">尚无销售建议记录。启用后，AI 的建议和确认结果会在这里留下审计轨迹。</TableCell></TableRow>
                  ) : records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(record.createdAt)}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{recommendationLabels[record.recommendationType] ?? record.recommendationType}</div>
                        <div className="mt-0.5 text-xs capitalize text-muted-foreground">{record.channel}</div>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-sm truncate text-sm" title={record.customerRequest ?? undefined}>{record.customerRequest || "未记录客户文字"}</p>
                        <p className="mt-0.5 max-w-sm truncate text-xs text-muted-foreground" title={record.recommendationReason ?? undefined}>{record.recommendationReason || "—"}</p>
                      </TableCell>
                      <TableCell className="text-sm">{record.customerResponse === "no_response" ? "尚未回应" : record.customerResponse === "accepted" ? "接受" : record.customerResponse === "declined" ? "拒绝" : "待回应"}</TableCell>
                      <TableCell><Badge variant={outcomeVariant(record.outcome)}>{outcomeLabels[record.outcome] ?? record.outcome}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Clock3 className="h-5 w-5 text-indigo-600" />受控自动跟进</CardTitle>
          <CardDescription>新策略一律先以“暂停”保存。只有管理员明确启用后，系统才会按计划检查未付款订单；人工接管、客户拒绝、完成购买或付款后均会停止发送。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <div>
                <Label htmlFor="follow-up-name">策略名称</Label>
                <Input id="follow-up-name" className="mt-2" value={followUpForm.name} onChange={(event) => setFollowUpForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="follow-up-delay">下单后延迟</Label>
                  <div className="mt-2 flex items-center gap-2"><Input id="follow-up-delay" type="number" min={1} max={720} value={followUpForm.delayHours} onChange={(event) => setFollowUpForm((current) => ({ ...current, delayHours: Number(event.target.value) }))} /><span className="text-sm text-muted-foreground">小时</span></div>
                </div>
                <div>
                  <Label htmlFor="follow-up-cron">检查频率</Label>
                  <Input id="follow-up-cron" className="mt-2 font-mono text-xs" value={followUpForm.cronExpression} onChange={(event) => setFollowUpForm((current) => ({ ...current, cronExpression: event.target.value }))} />
                </div>
              </div>
              <div>
                <Label htmlFor="follow-up-template">提醒内容</Label>
                <Textarea id="follow-up-template" className="mt-2 min-h-28" value={followUpForm.messageTemplate} onChange={(event) => setFollowUpForm((current) => ({ ...current, messageTemplate: event.target.value }))} />
                <p className="mt-1 text-xs text-muted-foreground">可用变量：<code>{"{orderNumber}"}</code>。发送前会再次检查客户是否已付款、被人工接管或明确拒绝。</p>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={handleCreateFollowUp} disabled={createFollowUpPolicy.isPending}>
                <PauseCircle className="mr-2 h-4 w-4" />{createFollowUpPolicy.isPending ? "保存中…" : "保存为暂停策略"}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-medium">已保存策略</h3><Badge variant="outline">仅 Messenger 已接入</Badge></div>
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>策略</TableHead><TableHead>条件</TableHead><TableHead>状态</TableHead><TableHead className="text-right">控制</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {followUpsLoading ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">加载策略中…</TableCell></TableRow> : !followUpPolicies?.length ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">尚未建立自动跟进策略。</TableCell></TableRow> : followUpPolicies.map((policy) => (
                      <TableRow key={policy.id}>
                        <TableCell><div className="font-medium">{policy.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{policy.cronExpression || "仅延迟执行"}</div></TableCell>
                        <TableCell className="text-sm">未付款后 {policy.delayHours} 小时</TableCell>
                        <TableCell><Badge variant={policy.isEnabled ? "default" : "secondary"}>{policy.isEnabled ? "已启用" : "已暂停"}</Badge></TableCell>
                        <TableCell className="text-right"><Button size="sm" variant={policy.isEnabled ? "outline" : "default"} onClick={() => setFollowUpPolicyEnabled.mutate({ id: policy.id, isEnabled: !policy.isEnabled })} disabled={setFollowUpPolicyEnabled.isPending}>{policy.isEnabled ? <><PauseCircle className="mr-1.5 h-3.5 w-3.5" />暂停</> : <><PlayCircle className="mr-1.5 h-3.5 w-3.5" />启用</>}</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="rounded-xl border">
            <div className="border-b px-4 py-3"><h3 className="font-medium">最近发送与跳过审计</h3><p className="mt-0.5 text-xs text-muted-foreground">每次发送、重复跳过或因安全停止条件而跳过的结果都会保留。</p></div>
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>时间</TableHead><TableHead>订单</TableHead><TableHead>结果</TableHead><TableHead>原因</TableHead></TableRow></TableHeader><TableBody>{!followUpDeliveries?.length ? <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">尚无自动跟进审计记录。</TableCell></TableRow> : followUpDeliveries.map((delivery) => { const deliveryReason = delivery.skipReason || delivery.errorMessage || delivery.message || "—"; return <TableRow key={delivery.id}><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(delivery.createdAt)}</TableCell><TableCell className="font-medium">{delivery.orderId ? `订单 #${delivery.orderId}` : "未关联订单"}</TableCell><TableCell><Badge variant={delivery.status === "sent" ? "default" : "secondary"}>{delivery.status === "sent" ? "已发送" : delivery.status === "failed" ? "发送失败" : delivery.status === "stopped" ? "已停止" : "已跳过"}</Badge></TableCell><TableCell className="max-w-md truncate text-sm text-muted-foreground" title={deliveryReason}>{deliveryReason}</TableCell></TableRow>})}</TableBody></Table></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-4 last:border-b-0 last:pb-0">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, suffix, children }: { label: string; suffix: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}<span className="ml-1 text-muted-foreground">({suffix})</span></Label>
      {children}
    </div>
  );
}
