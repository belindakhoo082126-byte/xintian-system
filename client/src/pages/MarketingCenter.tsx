import { useMemo, useState } from "react";
import { BookOpen, Gift, Megaphone, MessageSquareText, Plus, Send, Sparkles, Target, Ticket, Users, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const money = (value: number | string | null | undefined) => `RM ${Number(value ?? 0).toFixed(2)}`;
const formatDate = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("zh-MY", { dateStyle: "medium", timeStyle: "short" }) : "未设定";

const statusStyle: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800", scheduled: "bg-blue-100 text-blue-800", draft: "bg-slate-100 text-slate-700", paused: "bg-amber-100 text-amber-800", ended: "bg-rose-100 text-rose-800",
  sent: "bg-emerald-100 text-emerald-800", pending: "bg-amber-100 text-amber-800", failed: "bg-rose-100 text-rose-800",
};

function StatusBadge({ status }: { status: string }) {
  const names: Record<string, string> = { active: "进行中", scheduled: "已排程", draft: "草稿", paused: "已暂停", ended: "已结束", sent: "已发送", pending: "待发送", failed: "发送失败" };
  return <Badge className={statusStyle[status] ?? "bg-slate-100 text-slate-700"}>{names[status] ?? status}</Badge>;
}

export default function MarketingCenter() {
  const utils = trpc.useUtils();
  const { data: campaigns = [], isLoading: campaignsLoading } = trpc.marketing.listCampaigns.useQuery();
  const { data: templates = [] } = trpc.marketing.listMessageTemplates.useQuery();
  const { data: segments = [] } = trpc.marketing.listSegments.useQuery();
  const { data: automations = [] } = trpc.marketing.listAutomationRules.useQuery();
  const { data: deliveries = [] } = trpc.marketing.listMessageDeliveries.useQuery({ limit: 100 });
  const { data: effectSummary } = trpc.marketing.effectSummary.useQuery();
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [keywordTestInput, setKeywordTestInput] = useState("");
  const [submittedKeywordTest, setSubmittedKeywordTest] = useState("");
  const [preflightResult, setPreflightResult] = useState<any>(null);
  const keywordSimulation = trpc.marketing.simulateKeywordMatch.useQuery(
    { comment: submittedKeywordTest || "未输入模拟留言" },
    { enabled: Boolean(submittedKeywordTest), retry: false },
  );
  const currentCampaignId = selectedCampaignId ?? campaigns[0]?.id ?? null;
  const { data: lotteryEntries = [] } = trpc.marketing.listLotteryEntries.useQuery({ campaignId: currentCampaignId ?? 1, limit: 50 }, { enabled: !!currentCampaignId });
  const { data: lotteryPrizes = [] } = trpc.marketing.listAvailableLotteryPrizes.useQuery({ campaignId: currentCampaignId ?? 1 }, { enabled: !!currentCampaignId });

  const refresh = async () => {
    await Promise.all([
      utils.marketing.listCampaigns.invalidate(), utils.marketing.listMessageTemplates.invalidate(), utils.marketing.listSegments.invalidate(),
      utils.marketing.listAutomationRules.invalidate(), utils.marketing.listMessageDeliveries.invalidate(), utils.marketing.effectSummary.invalidate(), utils.marketing.listLotteryEntries.invalidate(), utils.marketing.listAvailableLotteryPrizes.invalidate(),
    ]);
  };
  const createCampaign = trpc.marketing.createCampaign.useMutation({ onSuccess: async () => { await refresh(); toast.success("营销活动已建立"); } });
  const createRule = trpc.marketing.createRule.useMutation({ onSuccess: async () => { await refresh(); toast.success("营销规则已加入活动"); } });
  const createPrize = trpc.marketing.createLotteryPrize.useMutation({ onSuccess: async () => { await refresh(); toast.success("抽奖奖品已建立"); } });
  const drawPrize = trpc.marketing.drawLotteryPrize.useMutation({ onSuccess: async (result) => { await refresh(); toast.success(result ? "已完成开奖" : "没有可开奖的资格"); } });
  const createTemplate = trpc.marketing.createMessageTemplate.useMutation({ onSuccess: async () => { await refresh(); toast.success("消息模板已储存"); } });
  const createSegment = trpc.marketing.createSegment.useMutation({ onSuccess: async () => { await refresh(); toast.success("客户分群已建立"); } });
  const createAutomation = trpc.marketing.createAutomationRule.useMutation({ onSuccess: async () => { await refresh(); toast.success("自动营销规则已建立，预设为暂停"); } });
  const pauseAutomation = trpc.marketing.pauseAutomationRule.useMutation({ onSuccess: async () => { await refresh(); toast.success("自动营销已暂停"); } });
  const runAutomation = trpc.marketing.runAutomationNow.useMutation({ onSuccess: async (result) => { await refresh(); toast.success(`已执行：${result.sent} 条发送，${result.manualCopy} 条待人工处理`); } });
  const previewAutomation = trpc.marketing.previewAutomationRun.useMutation({ onSuccess: (result) => toast.info(`预演完成：${result.queued + result.manualCopy} 位客户符合条件，不会发送任何消息`) });
  const preflightAutomation = trpc.marketing.preflightAutomationRule.useMutation({ onSuccess: (result) => { setPreflightResult(result); toast.success(result.canEnable ? "启用前检查完成" : "预检发现必须修正的问题"); } });
  const scheduleAutomation = trpc.marketing.scheduleAutomationRule.useMutation({ onSuccess: async () => { await refresh(); toast.success("自动排程已启用；系统会按设定时间在后台执行"); } });

  const analytics = useMemo(() => {
    const sent = deliveries.filter((d: any) => d.status === "sent").length;
    const failed = deliveries.filter((d: any) => d.status === "failed").length;
    const active = campaigns.filter((c: any) => c.status === "active").length;
    const activeRules = campaigns.reduce((sum: number, c: any) => sum + (c.rules?.filter((r: any) => r.status === "active").length ?? 0), 0);
    return { sent, failed, active, activeRules };
  }, [campaigns, deliveries]);

  return (
    <main className="space-y-6 p-4 md:p-6">
      <section className="relative overflow-hidden rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-amber-50 to-white p-6 shadow-sm md:p-8">
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-rose-200/45 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-rose-700"><WandSparkles className="h-5 w-5" /><span className="text-sm font-semibold">Marketing Center</span></div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">营销中心</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">统一管理活动、优惠、抽奖、客户召回与营销消息。所有实体赠品、加价购和奖品会在加入原订单时才通过既有库存服务占用库存。</p>
          </div>
          <div className="flex flex-wrap gap-2"><MarketingGuideDialog /><CampaignDialog onSubmit={(input) => createCampaign.mutate(input)} loading={createCampaign.isPending} /></div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Megaphone} label="进行中活动" value={analytics.active} hint={`${campaigns.length} 个活动记录`} tone="rose" />
        <MetricCard icon={Target} label="启用规则" value={analytics.activeRules} hint="优惠与资格规则" tone="amber" />
        <MetricCard icon={Send} label="成功投递" value={analytics.sent} hint={analytics.failed ? `${analytics.failed} 条失败待检查` : "没有失败投递"} tone="emerald" />
        <MetricCard icon={Users} label="客户分群" value={segments.filter((s: any) => s.isActive).length} hint={`${automations.filter((r: any) => r.status === "active").length} 条自动规则启用`} tone="violet" />
      </section>

      <Tabs defaultValue="campaigns" className="space-y-5">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl bg-slate-100 p-1">
          <TabsTrigger value="campaigns">营销活动</TabsTrigger><TabsTrigger value="lottery">幸运抽奖</TabsTrigger><TabsTrigger value="automation">自动营销</TabsTrigger><TabsTrigger value="analysis">效果分析</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">活动与优惠规则</h2><p className="text-sm text-muted-foreground">先建立活动，再加入可叠加或互斥的优惠规则。</p></div><RuleDialog campaigns={campaigns} onSubmit={(input) => createRule.mutate(input)} loading={createRule.isPending} /></div>
          {campaignsLoading ? <EmptyCard text="正在读取营销活动…" /> : campaigns.length === 0 ? <EmptyCard text="尚未建立活动。可先从右上角新增营销活动开始。" /> : <div className="grid gap-4 xl:grid-cols-2">
            {campaigns.map((campaign: any) => <Card key={campaign.id} className="border-slate-200 shadow-sm"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><CardTitle className="text-lg">{campaign.name}</CardTitle><StatusBadge status={campaign.status} /></div><CardDescription className="mt-1">#{campaign.campaignCode} · {campaign.description || "未填写活动说明"}</CardDescription></div><Badge variant="outline">{campaign.showInMall ? "商城展示" : "后台活动"}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>开始：{formatDate(campaign.startAt)}</span><span>结束：{formatDate(campaign.endAt)}</span><span>每客限制：{campaign.perCustomerLimit ?? "不限"}</span><span>总使用上限：{campaign.usageLimit ?? "不限"}</span></div><div className="flex flex-wrap gap-2">{campaign.rules?.length ? campaign.rules.map((rule: any) => <Badge key={rule.id} variant="secondary" className="font-normal">{rule.name} · {rule.ruleType}</Badge>) : <span className="text-sm text-muted-foreground">尚未加入优惠规则</span>}</div></CardContent></Card>)}
          </div>}
        </TabsContent>

        <TabsContent value="lottery" className="space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold">幸运轮盘与直播抽奖</h2><p className="text-sm text-muted-foreground">实体奖品仅于领取并合并到原订单时占用库存；抽奖本身不会先扣库存。</p></div><div className="flex gap-2"><Select value={currentCampaignId?.toString() ?? ""} onValueChange={(value) => setSelectedCampaignId(Number(value))}><SelectTrigger className="w-[220px]"><SelectValue placeholder="选择活动" /></SelectTrigger><SelectContent>{campaigns.map((campaign: any) => <SelectItem key={campaign.id} value={campaign.id.toString()}>{campaign.name}</SelectItem>)}</SelectContent></Select><PrizeDialog campaignId={currentCampaignId} onSubmit={(input) => createPrize.mutate(input)} loading={createPrize.isPending} /></div></div>
          {!currentCampaignId ? <EmptyCard text="请先建立营销活动，才可配置抽奖奖品与资格。" /> : <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-rose-600" />可用奖品</CardTitle><CardDescription>概率与数量上限由后台配置，开奖后保留完整审计。</CardDescription></CardHeader><CardContent className="space-y-3">{lotteryPrizes.length ? lotteryPrizes.map((prize: any) => <div className="flex items-center justify-between rounded-xl border p-3" key={prize.id}><div><p className="font-medium">{prize.name}</p><p className="text-xs text-muted-foreground">{prize.prizeType} · 权重 {prize.probabilityWeight} · 剩余 {prize.quantityLimit ?? "不限"}</p></div><Badge variant="secondary">{prize.productQuantity ?? 1} 件</Badge></div>) : <p className="text-sm text-muted-foreground">尚未配置奖品。</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5 text-amber-600" />抽奖资格</CardTitle><CardDescription>符合活动门槛后建立资格；管理员针对某一资格执行开奖。</CardDescription></CardHeader><CardContent className="space-y-3">{lotteryEntries.length ? lotteryEntries.map((entry: any) => <div key={entry.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-medium">资格 #{entry.id} <span className="text-xs font-normal text-muted-foreground">客户 #{entry.customerId}</span></p><p className="text-xs text-muted-foreground">{entry.entrySource} · {entry.status} · {formatDate(entry.createdAt)}</p></div><Button size="sm" disabled={entry.status !== "eligible" || drawPrize.isPending} onClick={() => drawPrize.mutate({ entryId: entry.id })}>开奖</Button></div>) : <p className="text-sm text-muted-foreground">该活动目前没有符合条件的抽奖资格。</p>}</CardContent></Card></div>}
        </TabsContent>

        <TabsContent value="automation" className="space-y-5">
          <KeywordSimulationPanel
            value={keywordTestInput}
            onChange={setKeywordTestInput}
            onTest={() => {
              if (!keywordTestInput.trim()) return toast.error("请输入要模拟的留言内容");
              setSubmittedKeywordTest(keywordTestInput.trim());
            }}
            loading={keywordSimulation.isFetching}
            result={keywordSimulation.data}
          />
          <div className="grid gap-5 xl:grid-cols-3"><ComposerCard title="客户分群" description="以客户类别、回购条件和互动状态建立可复用受众。" button="新增分群"><SegmentDialog onSubmit={(input) => createSegment.mutate(input)} loading={createSegment.isPending} /></ComposerCard><ComposerCard title="营销消息" description="建立 Messenger 或人工复制用的合规文案模板。" button="新增模板"><TemplateDialog onSubmit={(input) => createTemplate.mutate(input)} loading={createTemplate.isPending} /></ComposerCard><ComposerCard title="自动营销" description="新规则预设为暂停；发送前可预演名单与合规窗口。" button="新增规则"><AutomationDialog campaigns={campaigns} templates={templates} segments={segments} onSubmit={(input) => createAutomation.mutate(input)} loading={createAutomation.isPending} /></ComposerCard></div>
          <Card><CardHeader><CardTitle>自动营销控制台</CardTitle><CardDescription>新规则先暂停。请先运行启用前检查，再开启自动排程；近期没有 Messenger 合规互动窗口的客户不会自动私聊，会生成可审计的人工发送文案。</CardDescription></CardHeader><CardContent className="space-y-3">{automations.length ? automations.map((rule: any) => <div key={rule.id} className="rounded-xl border p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold">{rule.name}</p><StatusBadge status={rule.status} /></div><p className="mt-1 text-xs text-muted-foreground">{rule.triggerType} · {rule.scheduleType === "cron" ? "自动排程" : rule.scheduleType === "once" ? "单次排程" : "事件触发"} · 模板 #{rule.templateId}{rule.scheduleCronTaskUid ? " · 已绑定后台任务" : ""}</p><p className="mt-1 text-xs text-muted-foreground">上次执行：{formatDate(rule.lastRunAt)}{rule.scheduledAt ? ` · 设定时间：${formatDate(rule.scheduledAt)}` : ""}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => preflightAutomation.mutate({ ruleId: rule.id, limit: 100 })} disabled={preflightAutomation.isPending}>启用前检查</Button><AutomationScheduleDialog rule={rule} onSubmit={(input) => scheduleAutomation.mutate(input)} loading={scheduleAutomation.isPending} /><Button variant="outline" size="sm" onClick={() => previewAutomation.mutate({ ruleId: rule.id, limit: 100 })} disabled={rule.status !== "active" || previewAutomation.isPending}>预演名单</Button><Button variant="outline" size="sm" onClick={() => runAutomation.mutate({ ruleId: rule.id, limit: 100 })} disabled={rule.status !== "active" || runAutomation.isPending}>立即执行</Button><Button variant="secondary" size="sm" onClick={() => pauseAutomation.mutate({ ruleId: rule.id })} disabled={rule.status === "paused" || pauseAutomation.isPending}>暂停</Button></div></div>{preflightResult?.ruleId === rule.id ? <PreflightSummary result={preflightResult} /> : null}</div>) : <p className="text-sm text-muted-foreground">尚未建立自动营销规则。</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle>最近执行记录</CardTitle><CardDescription>按每一笔实际投递审计显示自动发送、失败和人工回退结果；一次执行涉及多位客户时会保留多笔客户级记录，方便追查。</CardDescription></CardHeader><CardContent className="space-y-2">{deliveries.slice(0, 20).map((delivery: any) => <div key={delivery.id} className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"><span>规则 #{delivery.automationRuleId} · 客户 #{delivery.customerId} · {delivery.channel === "manual_copy" ? "人工发送文案" : "Messenger 自动发送"}</span><span className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{formatDate(delivery.createdAt)}</span><StatusBadge status={delivery.status} /></span>{delivery.errorMessage ? <span className="text-xs text-amber-800 sm:basis-full">说明：{delivery.errorMessage}</span> : null}</div>)}{!deliveries.length && <p className="text-sm text-muted-foreground">尚未产生营销投递记录。启用规则后，系统会在这里保留每位客户的实际投递结果。</p>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-5">
          <Card>
            <CardHeader><CardTitle>营销效果分析</CardTitle><CardDescription>所有金额、订单与投递数据均读取实际活动归因和投递审计记录；未使用任何模拟指标。</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Insight label="归因订单" value={`${effectSummary?.totals.attributedOrders ?? 0}`} detail="状态为已应用的活动归因记录" />
              <Insight label="归因营收" value={money(effectSummary?.totals.revenue)} detail="来自活动关联订单的实际金额" />
              <Insight label="营销优惠" value={money(effectSummary?.totals.discount)} detail="不包含客户 Credit" />
              <Insight label="成功投递" value={`${effectSummary?.totals.messagesSent ?? 0}`} detail={`${effectSummary?.totals.clicks ?? 0} 次点击 · ${effectSummary?.totals.conversions ?? 0} 次转化`} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>活动效果明细</CardTitle><CardDescription>按营销活动汇总实际归因订单、营收、优惠、运费补贴和投递互动。</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {effectSummary?.campaigns.length ? effectSummary.campaigns.map((campaign: any) => <div key={campaign.campaignId} className="grid gap-2 rounded-xl border p-4 text-sm md:grid-cols-6"><div className="md:col-span-2"><p className="font-semibold">{campaign.campaignName}</p><StatusBadge status={campaign.status} /></div><p>订单：<b>{campaign.attributedOrders}</b></p><p>营收：<b>{money(campaign.revenue)}</b></p><p>优惠：<b>{money(campaign.discount)}</b></p><p>投递：<b>{campaign.messagesSent}</b><span className="text-muted-foreground"> / 点击 {campaign.clicks} / 转化 {campaign.conversions}</span></p></div>) : <p className="py-6 text-center text-sm text-muted-foreground">尚未产生可归因的营销订单或投递记录。</p>}
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>归因边界</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2"><p className="rounded-xl bg-emerald-50 p-4 text-emerald-900">实体赠品、加价购与中奖商品只在写入原订单项目时占用库存；开奖或营销提示不会预扣商品。</p><p className="rounded-xl bg-amber-50 p-4 text-amber-900">系统将营销优惠、运费补贴与客户 Credit 分开记录。Credit 不是活动折扣，利润与报表计算不会重复扣除。</p></CardContent></Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function MetricCard({ icon: Icon, label, value, hint, tone }: { icon: any; label: string; value: number; hint: string; tone: "rose" | "amber" | "emerald" | "violet" }) {
  const tones = { rose: "bg-rose-100 text-rose-700", amber: "bg-amber-100 text-amber-700", emerald: "bg-emerald-100 text-emerald-700", violet: "bg-violet-100 text-violet-700" };
  return <Card className="shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className={`rounded-2xl p-3 ${tones[tone]}`}><Icon className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{hint}</p></div></CardContent></Card>;
}
function Insight({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border bg-slate-50 p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div>; }
function EmptyCard({ text }: { text: string }) { return <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">{text}</CardContent></Card>; }
function ComposerCard({ title, description, children }: { title: string; description: string; button: string; children: React.ReactNode }) { return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>; }

function MarketingGuideDialog() {
  return <Dialog><DialogTrigger asChild><Button variant="outline" className="border-rose-200 bg-white/80 text-rose-700 hover:bg-rose-50"><BookOpen className="mr-2 h-4 w-4" />操作说明</Button></DialogTrigger><DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-rose-600" />营销中心管理员操作说明</DialogTitle><DialogDescription>此入口汇总当前营销中心的实际操作边界；不会替代 Campaign Flow 的独立流程配置说明。</DialogDescription></DialogHeader><div className="space-y-4 text-sm leading-6 text-slate-700"><GuideSection title="一、营销活动与优惠规则" content="先建立活动，再新增优惠规则。优惠只在客户实际下单并符合规则时计算；实体赠品、加价购与抽奖实物只会在写入原订单时占用库存，不会因建立活动或开奖预先扣库存。" /><GuideSection title="二、幸运抽奖" content="选择已建立的活动，建立奖品后再从符合资格的客户记录执行开奖。开奖结果会保留审计；实体奖品仍须领取并加入原订单后才会影响库存。" /><GuideSection title="三、客户分群与营销消息" content="分群只负责筛选受众，不会修改客户资料。消息模板用于 Messenger 或人工复制；自动 Messenger 发送须同时满足客户具备 Messenger 身份及最近 24 小时互动窗口。" /><GuideSection title="四、关键词模拟测试" content="输入模拟留言后，系统使用与直播捉单相同的关键词解析与商品匹配规则，显示已匹配与未匹配词。模拟永远不会公开回复、私聊客户、建立订单、预留库存或改动任何真实记录。" /><GuideSection title="五、自动营销" content="新增规则默认暂停。先使用「启用前检查」核对目标客户数、模板完整性与 Messenger 互动窗口，再设定自动排程或手动执行。窗口外客户不会被自动私聊，系统会保留可审计的人工发送文案。" /><GuideSection title="六、投递审计与效果分析" content="每次成功、失败、待发送或改为人工处理的投递都会保存审计，便于避免与订单通知或 AI 客服重复发送。效果分析只计算真实活动归因订单与投递记录，不使用模拟数据。" /><p className="rounded-xl bg-amber-50 p-3 text-amber-900">操作提示：若测试结果没有匹配商品，请核对直播／帖子商品的关键词是否已建立、留言格式是否正确，以及商品是否仍可销售。关键词匹配本身不代表一定建单，实际捉单仍会经过库存、资格、订单合并和渠道规则检查。</p></div><DialogFooter><Button variant="outline" onClick={() => window.print()}>打印此说明</Button></DialogFooter></DialogContent></Dialog>;
}

function GuideSection({ title, content }: { title: string; content: string }) { return <section className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1">{content}</p></section>; }

function KeywordSimulationPanel({ value, onChange, onTest, loading, result }: { value: string; onChange: (value: string) => void; onTest: () => void; loading: boolean; result: any }) {
  return <Card className="border-violet-200 bg-gradient-to-br from-violet-50 via-white to-rose-50"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-violet-700" />关键词模拟测试</CardTitle><CardDescription>使用真实的关键词解析与商品匹配规则预览触发效果；本工具只读，不会发送消息、建立订单或预留库存。</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-col gap-3 md:flex-row"><Textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder="例如：我要 A12 和肥料B2" className="bg-white" /><Button onClick={onTest} disabled={loading} className="min-w-32 self-start bg-violet-700 hover:bg-violet-800">{loading ? "模拟中…" : "开始模拟"}</Button></div>{result && <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-900">{result.triggered ? "已匹配关键词" : "没有匹配商品"}</p><p className="mt-1 text-xs text-emerald-800">解析词：{result.keywords?.length ? result.keywords.join("、") : "未识别"}</p><div className="mt-3 space-y-2">{result.matched?.length ? result.matched.map((item: any, index: number) => <div key={`${item.keyword ?? "match"}-${index}`} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">{item.keyword || item.product?.keyword || "匹配关键词"} · {item.product?.name || item.name || `商品 #${item.productId ?? "—"}`}</div>) : <p className="text-sm text-emerald-800">请检查商品关键词、留言格式或直播商品配置。</p>}</div>{result.unmatched?.length ? <p className="mt-3 text-xs text-amber-800">未匹配：{result.unmatched.join("、")}</p> : null}</div><div className="rounded-xl border border-violet-200 bg-white p-4 text-sm text-slate-700"><p className="font-semibold text-violet-900">预计触发边界</p><ul className="mt-2 space-y-2 text-xs leading-5"><li><b>公开回复：</b>{result.preview?.publicReply}</li><li><b>私聊：</b>{result.preview?.privateMessage}</li><li><b>订单：</b>{result.preview?.orderAction}</li></ul></div></div>}</CardContent></Card>;
}

function AutomationScheduleDialog({ rule, onSubmit, loading }: { rule: any; onSubmit: (input: { ruleId: number; cron: string; scheduledAt: Date; scheduleType: "once" | "cron" }) => void; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"once" | "daily" | "weekly">(rule.scheduleType === "once" ? "once" : "daily");
  const toLocalInput = (value?: Date | string | null) => { const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000); date.setSeconds(0, 0); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const [dateTime, setDateTime] = useState(() => toLocalInput(rule.scheduledAt));
  const submit = () => {
    const date = new Date(dateTime);
    if (!dateTime || Number.isNaN(date.getTime())) return toast.error("请选择有效的执行时间");
    if (mode === "once" && date.getTime() <= Date.now()) return toast.error("单次发送时间必须晚于现在");
    const seconds = 0;
    const minute = date.getUTCMinutes();
    const hour = date.getUTCHours();
    const cron = mode === "weekly" ? `${seconds} ${minute} ${hour} * * ${date.getUTCDay()}` : mode === "daily" ? `${seconds} ${minute} ${hour} * * *` : `${seconds} ${minute} ${hour} ${date.getUTCDate()} ${date.getUTCMonth() + 1} *`;
    onSubmit({ ruleId: rule.id, cron, scheduledAt: date, scheduleType: mode === "once" ? "once" : "cron" });
    setOpen(false);
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" size="sm">{rule.scheduleCronTaskUid ? "修改排程" : "设定排程"}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>自动排程发送</DialogTitle><DialogDescription>时间以管理员当前设备时区输入，系统会转换为后台 UTC 排程。提交前请先完成「启用前检查」。</DialogDescription></DialogHeader><div className="space-y-4"><Field label="发送频率"><Select value={mode} onValueChange={(value: "once" | "daily" | "weekly") => setMode(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="once">单次自动发送</SelectItem><SelectItem value="daily">每日自动发送</SelectItem><SelectItem value="weekly">每周同一天自动发送</SelectItem></SelectContent></Select></Field><Field label={mode === "once" ? "发送日期与时间" : "首个执行参考时间"}><Input type="datetime-local" value={dateTime} onChange={(event) => setDateTime(event.target.value)} /></Field><p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">系统会在执行时再次检查模板、客户状态和 Messenger 24 小时互动窗口。无合规窗口的客户不会自动私聊，而会写入人工发送文案审计。</p></div><DialogFooter><Button onClick={submit} disabled={loading}>{loading ? "储存中…" : "启用后台自动排程"}</Button></DialogFooter></DialogContent></Dialog>;
}

function PreflightSummary({ result }: { result: any }) { return <div className={`mt-4 rounded-xl border p-4 text-sm ${result.canEnable ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">启用前检查：{result.canEnable ? "可建立排程" : "须先修正"}</p><Badge className={result.canEnable ? "bg-emerald-600" : "bg-rose-600"}>{result.content?.complete ? "内容完整" : "模板有问题"}</Badge></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-3"><p>目标客户：<b>{result.targetCustomers}</b></p><p>可自动 Messenger：<b>{result.automaticMessenger}</b></p><p>须人工处理：<b>{result.manualFollowUp}</b></p></div><p className="mt-3 text-xs">合规窗口：{result.compliance?.hasAutomaticMessengerWindow ? "有客户处于可自动发送窗口" : "目前没有可自动发送窗口"}{result.compliance?.requiresManualFollowUp ? "；部分客户将转为人工发送文案。" : "。"}</p>{result.warnings?.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">{result.warnings.map((warning: string, index: number) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul> : <p className="mt-3 text-xs">未发现内容或合规阻挡项目；仍请在首次正式发送后查看执行记录。</p>}</div>; }

function CampaignDialog({ onSubmit, loading }: { onSubmit: (input: any) => void; loading: boolean }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [code, setCode] = useState(""); const [description, setDescription] = useState(""); const [status, setStatus] = useState<"draft" | "active">("draft");
  const submit = () => { if (!name.trim() || !code.trim()) return toast.error("请填写活动名称和活动代码"); onSubmit({ name, campaignCode: code, description: description || null, status, showInMall: true }); setOpen(false); };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="bg-rose-600 hover:bg-rose-700"><Plus className="mr-2 h-4 w-4" />新增营销活动</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>建立营销活动</DialogTitle><DialogDescription>活动仅定义营销条件；不会直接修改订单、库存或付款状态。</DialogDescription></DialogHeader><div className="space-y-4"><Field label="活动名称"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：周末花园补给优惠" /></Field><Field label="活动代码"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WEEKEND-2026" /></Field><Field label="活动说明"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="客户可见的活动说明" /></Field><Field label="初始状态"><Select value={status} onValueChange={(value: "draft" | "active") => setStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">草稿（不生效）</SelectItem><SelectItem value="active">启用</SelectItem></SelectContent></Select></Field></div><DialogFooter><Button onClick={submit} disabled={loading}>建立活动</Button></DialogFooter></DialogContent></Dialog>;
}
function RuleDialog({ campaigns, onSubmit, loading }: { campaigns: any[]; onSubmit: (input: any) => void; loading: boolean }) {
  const [open, setOpen] = useState(false); const [campaignId, setCampaignId] = useState(""); const [name, setName] = useState(""); const [ruleType, setRuleType] = useState("order_threshold"); const [config, setConfig] = useState('{"threshold":150,"discountAmount":10}');
  const submit = () => { try { if (!campaignId || !name.trim()) return toast.error("请选择活动并填写规则名称"); onSubmit({ campaignId: Number(campaignId), name, ruleType, config: JSON.parse(config), status: "active", stackable: false }); setOpen(false); } catch { toast.error("规则设置必须是正确的 JSON 格式"); } };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" />新增优惠规则</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>加入优惠规则</DialogTitle><DialogDescription>规则会由统一营销计算服务预览，实体项目加入订单时仍受库存限制。</DialogDescription></DialogHeader><div className="space-y-4"><Field label="营销活动"><Select value={campaignId} onValueChange={setCampaignId}><SelectTrigger><SelectValue placeholder="选择活动" /></SelectTrigger><SelectContent>{campaigns.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></Field><Field label="规则名称"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：满 RM150 减 RM10" /></Field><Field label="规则类型"><Select value={ruleType} onValueChange={setRuleType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="order_threshold">满额优惠</SelectItem><SelectItem value="quantity_gift">数量赠品</SelectItem><SelectItem value="nth_item_discount">第 N 件优惠</SelectItem><SelectItem value="product_discount">指定商品优惠</SelectItem><SelectItem value="category_discount">分类优惠</SelectItem><SelectItem value="clearance">清货活动</SelectItem><SelectItem value="add_on">加价购</SelectItem><SelectItem value="spin_eligibility">幸运轮盘资格</SelectItem><SelectItem value="live_lottery">直播抽奖</SelectItem></SelectContent></Select></Field><Field label="规则设置（JSON）"><Textarea className="font-mono text-xs" rows={5} value={config} onChange={(e) => setConfig(e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">例如：满额优惠使用 {`{"threshold":150,"discountAmount":10}`}；不同规则可在活动说明中留存条件。</p></Field></div><DialogFooter><Button onClick={submit} disabled={loading}>储存规则</Button></DialogFooter></DialogContent></Dialog>;
}
function PrizeDialog({ campaignId, onSubmit, loading }: { campaignId: number | null; onSubmit: (input: any) => void; loading: boolean }) { const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [type, setType] = useState("coupon"); const [weight, setWeight] = useState("1"); const submit = () => { if (!campaignId || !name.trim()) return toast.error("请先选择活动并填写奖品名称"); onSubmit({ campaignId, name, prizeType: type, probabilityWeight: Number(weight) || 1 }); setOpen(false); }; return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={!campaignId}><Plus className="mr-2 h-4 w-4" />新增奖品</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>建立抽奖奖品</DialogTitle></DialogHeader><div className="space-y-4"><Field label="奖品名称"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="奖品类型"><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="coupon">优惠券</SelectItem><SelectItem value="points">积分</SelectItem><SelectItem value="membership_days">会员天数</SelectItem><SelectItem value="free_shipping">免运费</SelectItem><SelectItem value="no_prize">谢谢参与</SelectItem></SelectContent></Select></Field><Field label="抽中权重"><Input type="number" min="1" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field></div><DialogFooter><Button onClick={submit} disabled={loading}>储存奖品</Button></DialogFooter></DialogContent></Dialog>; }
function SegmentDialog({ onSubmit, loading }: { onSubmit: (input: any) => void; loading: boolean }) { const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [filters, setFilters] = useState('{"type":"recent_customer"}'); const submit = () => { try { if (!name.trim()) return toast.error("请填写分群名称"); onSubmit({ name, filterConfig: JSON.parse(filters), isActive: true }); setOpen(false); } catch { toast.error("分群条件必须是正确的 JSON 格式"); } }; return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="w-full">新增分群</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>客户分群</DialogTitle><DialogDescription>仅用于筛选营销对象，不会修改客户资料。</DialogDescription></DialogHeader><div className="space-y-4"><Field label="分群名称"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="近 30 天有消费客户" /></Field><Field label="筛选条件（JSON）"><Textarea value={filters} onChange={(e) => setFilters(e.target.value)} className="font-mono text-xs" /></Field></div><DialogFooter><Button onClick={submit} disabled={loading}>储存分群</Button></DialogFooter></DialogContent></Dialog>; }
function TemplateDialog({ onSubmit, loading }: { onSubmit: (input: any) => void; loading: boolean }) { const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [content, setContent] = useState(""); const submit = () => { if (!name.trim() || !content.trim()) return toast.error("请填写模板名称和内容"); onSubmit({ name, content, channel: "messenger", isActive: true }); setOpen(false); }; return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="w-full">新增模板</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>营销消息模板</DialogTitle><DialogDescription>仅会在客户符合互动窗口及规则条件时自动 Messenger 发送。</DialogDescription></DialogHeader><div className="space-y-4"><Field label="模板名称"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="消息内容"><Textarea rows={7} value={content} onChange={(e) => setContent(e.target.value)} placeholder="您好，您有一项专属活动…" /></Field></div><DialogFooter><Button onClick={submit} disabled={loading}>储存模板</Button></DialogFooter></DialogContent></Dialog>; }
function AutomationDialog({ campaigns, templates, segments, onSubmit, loading }: { campaigns: any[]; templates: any[]; segments: any[]; onSubmit: (input: any) => void; loading: boolean }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [templateId, setTemplateId] = useState(""); const [segmentId, setSegmentId] = useState(""); const [campaignId, setCampaignId] = useState("");
  const [schedulePreference, setSchedulePreference] = useState<"event" | "once" | "cron">("event"); const [scheduledAt, setScheduledAt] = useState("");
  const submit = () => {
    if (!name.trim() || !templateId) return toast.error("请填写规则名称并选择消息模板");
    const scheduleDate = scheduledAt ? new Date(scheduledAt) : null;
    if (schedulePreference !== "event" && (!scheduledAt || Number.isNaN(scheduleDate?.getTime()))) return toast.error("请选择有效的首个执行时间");
    onSubmit({ name, templateId: Number(templateId), campaignId: campaignId ? Number(campaignId) : null, segmentId: segmentId ? Number(segmentId) : null, triggerType: "segment", scheduleType: schedulePreference, scheduledAt: schedulePreference === "event" ? null : scheduleDate }); setOpen(false);
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="w-full">新增规则</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>自动营销规则</DialogTitle><DialogDescription>新建后始终保持暂停。保存排程偏好后，仍须执行启用前检查并确认建立后台自动任务。</DialogDescription></DialogHeader><div className="space-y-4"><Field label="规则名称"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="消息模板"><Select value={templateId} onValueChange={setTemplateId}><SelectTrigger><SelectValue placeholder="选择模板" /></SelectTrigger><SelectContent>{templates.filter((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent></Select></Field><Field label="客户分群（可选）"><Select value={segmentId || "none"} onValueChange={(v) => setSegmentId(v === "none" ? "" : v)}><SelectTrigger><SelectValue placeholder="所有合规客户" /></SelectTrigger><SelectContent><SelectItem value="none">所有合规客户</SelectItem>{segments.filter((s: any) => s.isActive).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select></Field><Field label="关联活动（可选）"><Select value={campaignId || "none"} onValueChange={(v) => setCampaignId(v === "none" ? "" : v)}><SelectTrigger><SelectValue placeholder="不限定活动" /></SelectTrigger><SelectContent><SelectItem value="none">不限定活动</SelectItem>{campaigns.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></Field><Field label="排程偏好"><Select value={schedulePreference} onValueChange={(value: "event" | "once" | "cron") => setSchedulePreference(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="event">事件触发／暂不排程</SelectItem><SelectItem value="once">准备单次自动发送</SelectItem><SelectItem value="cron">准备周期自动发送</SelectItem></SelectContent></Select></Field>{schedulePreference !== "event" ? <Field label="首个执行参考时间"><Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></Field> : null}</div><DialogFooter><Button onClick={submit} disabled={loading}>建立暂停规则</Button></DialogFooter></DialogContent></Dialog>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
