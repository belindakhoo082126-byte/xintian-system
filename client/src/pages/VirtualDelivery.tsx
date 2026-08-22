import { useMemo, useState } from "react";
import { PackageOpen, Plus, Send, Clipboard, CheckCircle2, Clock3, ExternalLink, Layers3, WalletCards, ImageIcon, Upload, Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getVirtualDeliveryCostLabel, resolveVirtualDeliveryPackageCosts, resolveVirtualDeliveryPackageNames } from "@shared/virtualDeliveryCostMode";

type PackageDraft = { name: string; sellingPrice: string; contentCost: string; deliveryLink: string; deliveryMessage: string; imageUrl: string };
const emptyPackage = (): PackageDraft => ({ name: "", sellingPrice: "0.00", contentCost: "0.00", deliveryLink: "", deliveryMessage: "", imageUrl: "" });

const typeLabel: Record<string, string> = { membership: "会员", course: "课程", resource: "资料包" };
const taskLabel: Record<string, string> = { pending_manual: "待人工发送", sent: "已发送", failed: "发送失败", cancelled: "已取消" };

export default function VirtualDelivery() {
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [deliveryType, setDeliveryType] = useState<"membership" | "course" | "resource">("course");
  const [description, setDescription] = useState("");
  const [defaultMessage, setDefaultMessage] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [allowMixedCheckout, setAllowMixedCheckout] = useState(true);
  const [syncToMall, setSyncToMall] = useState(false);
  const [productCost, setProductCost] = useState("0.00");
  const [packages, setPackages] = useState<PackageDraft[]>([emptyPackage()]);
  const { data: products = [], isLoading: productsLoading } = trpc.virtualDelivery.listProducts.useQuery();
  const { data: tasks = [], isLoading: tasksLoading } = trpc.virtualDelivery.listTasks.useQuery();
  const createProduct = trpc.virtualDelivery.createProduct.useMutation({
    onSuccess: async () => {
      await utils.virtualDelivery.listProducts.invalidate();
      setDialogOpen(false);
      setName(""); setDescription(""); setDefaultMessage(""); setCoverImageUrl(""); setProductCost("0.00"); setPackages([emptyPackage()]);
      toast.success("虚拟交付商品已建立");
    },
    onError: (error) => toast.error(error.message),
  });
  const markSent = trpc.virtualDelivery.markTaskSent.useMutation({
    onSuccess: async () => {
      await utils.virtualDelivery.listTasks.invalidate();
      toast.success("交付任务已标记为已发送");
    },
    onError: (error) => toast.error(error.message),
  });
  const totals = useMemo(() => tasks.reduce((acc, row) => {
    acc[row.task.status] = (acc[row.task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [tasks]);

  const updatePackage = (index: number, key: keyof PackageDraft, value: string) => {
    setPackages((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  };
  const submit = () => {
    const namedPackages = resolveVirtualDeliveryPackageNames(packages, name);
    createProduct.mutate({ name, deliveryType, description, defaultDeliveryMessage: defaultMessage, coverImageUrl, allowMixedCheckout, syncToMall, packages: resolveVirtualDeliveryPackageCosts(namedPackages, productCost) });
  };

  return <div className="mx-auto max-w-7xl space-y-5 pb-10">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium text-emerald-700">会员、课程与资料包</p>
        <h1 className="text-2xl font-bold tracking-tight">虚拟交付</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">虚拟商品不进入库存和包货流程。确认汇款后会建立交付任务；Meta 私聊授权完成前，由员工复制内容后手动发送。</p>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />新增虚拟商品</Button></DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>新增虚拟交付商品</DialogTitle><DialogDescription>单一内容填写商品成本；新增多个配套后，每个配套分别填写售价、成本、交付链接与客户通知内容。</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2"><Label>商品名称</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：新手植物课程" /></div>
            <div className="space-y-2"><Label>交付类型</Label><Select value={deliveryType} onValueChange={(value) => setDeliveryType(value as typeof deliveryType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="membership">会员</SelectItem><SelectItem value="course">课程</SelectItem><SelectItem value="resource">资料包</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 md:col-span-2"><Label>商品介绍</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="客户在商城可见的课程／资料包介绍" /></div>
            {packages.length > 1 && <div className="md:col-span-2"><ImageUrlUploader label="商品主图" value={coverImageUrl} onChange={setCoverImageUrl} hint="商城默认显示此主图；客户选择配套后会优先显示配套图片。" /></div>}
            <div className="space-y-2 md:col-span-2"><Label>默认发送内容</Label><Textarea value={defaultMessage} onChange={(event) => setDefaultMessage(event.target.value)} placeholder="例如：您好，您已成功购买。请点击以下链接开始使用：" /></div>
            <div className="flex items-center justify-between rounded-lg border p-3"><div><Label>允许混合结账</Label><p className="text-xs text-muted-foreground">可与实体商品在同一订单付款</p></div><Switch checked={allowMixedCheckout} onCheckedChange={setAllowMixedCheckout} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3"><div><Label>同步到商城</Label><p className="text-xs text-muted-foreground">启用后可在商城售卖</p></div><Switch checked={syncToMall} onCheckedChange={setSyncToMall} /></div>
            {packages.length === 1 && <Card className="border-emerald-200 bg-emerald-50/40 md:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-base">单一商品设置</CardTitle><CardDescription>没有不同配套时，请直接在这里填写售价、成本、图片与交付链接。</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>商品售价 (RM)</Label><Input inputMode="decimal" value={packages[0].sellingPrice} onChange={(event) => updatePackage(0, "sellingPrice", event.target.value)} placeholder="0.00" /></div><div className="space-y-2"><Label>商品成本 (RM)</Label><Input inputMode="decimal" value={productCost} onChange={(event) => setProductCost(event.target.value)} placeholder="0.00" /></div><div className="md:col-span-2"><ImageUrlUploader label="商品图片" value={coverImageUrl} onChange={setCoverImageUrl} hint="商城默认显示这张商品主图。" /></div><div className="space-y-2 md:col-span-2"><Label>交付链接</Label><Input value={packages[0].deliveryLink} onChange={(event) => updatePackage(0, "deliveryLink", event.target.value)} placeholder="https://..." /></div><p className="text-xs text-muted-foreground md:col-span-2">利润按实际成交价减优惠后再扣除商品成本；新增第二个配套后，才改为每个配套分别填写售价、成本、图片与链接。</p></CardContent></Card>}
          </div>
          <div className="space-y-3 border-t pt-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">{packages.length === 1 ? "交付内容" : "配套规格"}</h3><p className="text-xs text-muted-foreground">{packages.length === 1 ? "目前为单一内容商品；可直接填写售价、链接和发送内容。" : "不同配套分别统计售价、成本、利润和交付内容。"}</p></div><Button variant="outline" size="sm" onClick={() => setPackages((current) => [...resolveVirtualDeliveryPackageCosts(current, productCost), emptyPackage()])}><Plus className="mr-1 h-3.5 w-3.5" />增加配套</Button></div>
          {packages.map((pkg, index) => packages.length === 1 ? <Card key={index} className="bg-muted/20"><CardContent className="space-y-3 p-4"><p className="text-sm text-muted-foreground">单一商品会自动使用商品名称作为内部交付名称，无需另填配套名称。</p><div className="space-y-2"><Label>发送内容（留空则使用默认发送内容）</Label><Textarea value={pkg.deliveryMessage} onChange={(event) => updatePackage(index, "deliveryMessage", event.target.value)} /></div></CardContent></Card> : <Card key={index} className="bg-muted/20"><CardContent className="grid gap-3 p-4 md:grid-cols-2"><div className="space-y-2"><Label>配套名称</Label><Input value={pkg.name} onChange={(event) => updatePackage(index, "name", event.target.value)} placeholder="例如：基础配套" /></div><div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label>售价 (RM)</Label><Input inputMode="decimal" value={pkg.sellingPrice} onChange={(event) => updatePackage(index, "sellingPrice", event.target.value)} /></div><div className="space-y-2"><Label>{getVirtualDeliveryCostLabel(packages.length)} (RM)</Label><Input inputMode="decimal" value={pkg.contentCost} onChange={(event) => updatePackage(index, "contentCost", event.target.value)} /></div></div><div className="md:col-span-2"><ImageUrlUploader label="此配套图片" value={pkg.imageUrl} onChange={(value) => updatePackage(index, "imageUrl", value)} hint="客户在商城选择此配套后，会优先显示这张图片。" /></div><div className="space-y-2 md:col-span-2"><Label>交付链接</Label><Input value={pkg.deliveryLink} onChange={(event) => updatePackage(index, "deliveryLink", event.target.value)} placeholder="https://..." /></div><div className="space-y-2 md:col-span-2"><Label>此配套发送内容（留空则使用默认发送内容）</Label><Textarea value={pkg.deliveryMessage} onChange={(event) => updatePackage(index, "deliveryMessage", event.target.value)} /></div><Button variant="ghost" size="sm" className="justify-self-start text-destructive" onClick={() => setPackages((current) => { const next = current.filter((_, packageIndex) => packageIndex !== index); if (next.length === 1) setProductCost(next[0].contentCost); return next; })}>删除此配套</Button></CardContent></Card>)}</div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button><Button disabled={createProduct.isPending || !name.trim()} onClick={submit}>{createProduct.isPending ? "建立中…" : "建立虚拟商品"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric icon={Layers3} label="虚拟商品" value={products.length} />
      <Metric icon={Clock3} label="待人工发送" value={totals.pending_manual || 0} tone="amber" />
      <Metric icon={CheckCircle2} label="已发送" value={totals.sent || 0} tone="emerald" />
      <Metric icon={WalletCards} label="发送失败" value={totals.failed || 0} tone="rose" />
    </div>
    <Tabs defaultValue="catalog"><TabsList><TabsTrigger value="catalog">虚拟商品与配套</TabsTrigger><TabsTrigger value="tasks">交付任务</TabsTrigger></TabsList>
      <TabsContent value="catalog" className="mt-4"><div className="grid gap-4 lg:grid-cols-2">{productsLoading ? <p className="text-sm text-muted-foreground">正在加载虚拟商品…</p> : products.length === 0 ? <Empty icon={PackageOpen} text="尚未建立虚拟商品。可从会员、课程或资料包开始。" /> : products.map((item) => <Card key={item.id}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">{item.product.coverImageUrl ? <img src={item.product.coverImageUrl} alt="商品图片" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}</div><div><CardTitle className="text-lg">{item.product.name}</CardTitle><CardDescription>{typeLabel[item.deliveryType]} · {item.allowMixedCheckout ? "可混合结账" : "仅独立购买"} · {item.product.syncToMall ? "已同步商城" : "未同步商城"}</CardDescription></div></div><div className="flex items-center gap-2"><VirtualProductEditButton item={item} /><Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "启用" : "停用"}</Badge></div></div></CardHeader><CardContent className="space-y-3">{item.packages.map((pkg) => <div key={pkg.deliveryPackage.id} className="flex gap-3 rounded-lg border bg-muted/20 p-3"><div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-background">{pkg.variant.imageUrl ? <img src={pkg.variant.imageUrl} alt={`${pkg.deliveryPackage.name} 图片`} className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="font-medium">{pkg.deliveryPackage.name}</p><div className="flex items-center gap-2"><p className="font-semibold text-emerald-700">RM {pkg.variant.sellingPrice || "0.00"}</p><VirtualPackageEditButton deliveryPackage={pkg.deliveryPackage} variant={pkg.variant} /></div></div><p className="mt-1 text-xs text-muted-foreground">{item.packages.length === 1 ? "商品成本" : "配套成本"} RM {pkg.deliveryPackage.contentCost}</p><p className="mt-1 truncate text-xs text-muted-foreground">交付链接：{pkg.deliveryPackage.deliveryLink || "未设置"}</p></div></div>)}</CardContent></Card>)}</div></TabsContent>
      <TabsContent value="tasks" className="mt-4"><Card><CardHeader><CardTitle className="text-lg">待交付任务</CardTitle><CardDescription>付款确认后建立。Meta 私聊授权完成前，请复制内容后手动发送并标记完成。</CardDescription></CardHeader><CardContent className="space-y-3">{tasksLoading ? <p className="text-sm text-muted-foreground">正在加载任务…</p> : tasks.length === 0 ? <Empty icon={Send} text="目前没有待交付或历史交付任务。" /> : tasks.map((row) => <div key={row.task.id} className="rounded-xl border p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{row.task.productNameSnapshot}{row.task.packageNameSnapshot ? ` · ${row.task.packageNameSnapshot}` : ""}</p><Badge variant={row.task.status === "sent" ? "default" : "secondary"}>{taskLabel[row.task.status]}</Badge></div><p className="mt-1 text-sm text-muted-foreground">订单 {row.order.orderNumber} · 客户 {row.customer.name} · 利润 RM {row.task.profitAmount}</p><p className="mt-2 whitespace-pre-wrap text-sm">{row.task.deliveryMessageSnapshot || "尚未设置发送内容"}</p><p className="mt-2 break-all text-xs text-primary">{row.task.deliveryLinkSnapshot || "尚未设置交付链接"}</p></div><div className="flex shrink-0 gap-2">{row.task.deliveryLinkSnapshot && <Button size="sm" variant="outline" onClick={() => window.open(row.task.deliveryLinkSnapshot!, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-1 h-3.5 w-3.5" />打开链接</Button>}{row.task.status !== "sent" && <Button size="sm" onClick={async () => { await navigator.clipboard.writeText(`${row.task.deliveryMessageSnapshot || ""}\n${row.task.deliveryLinkSnapshot || ""}`.trim()); toast.success("发送内容已复制，请在私聊发送后标记完成"); }}><Clipboard className="mr-1 h-3.5 w-3.5" />复制内容</Button>} {row.task.status !== "sent" && <Button size="sm" variant="secondary" disabled={markSent.isPending} onClick={() => markSent.mutate({ id: row.task.id })}>标记已发送</Button>}</div></div></div>)}</CardContent></Card></TabsContent>
    </Tabs>
  </div>;
}

function Metric({ icon: Icon, label, value, tone = "slate" }: { icon: typeof PackageOpen; label: string; value: number; tone?: "slate" | "amber" | "emerald" | "rose" }) {
  const tones = { slate: "text-slate-600 bg-slate-100", amber: "text-amber-700 bg-amber-100", emerald: "text-emerald-700 bg-emerald-100", rose: "text-rose-700 bg-rose-100" };
  return <Card><CardContent className="flex items-center gap-3 p-4"><div className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div></CardContent></Card>;
}
function Empty({ icon: Icon, text }: { icon: typeof PackageOpen; text: string }) { return <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed text-center"><Icon className="mb-2 h-7 w-7 text-muted-foreground" /><p className="max-w-sm text-sm text-muted-foreground">{text}</p></div>; }

function VirtualProductEditButton({ item }: { item: any }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: item.product.name || "", description: item.product.description || item.product.shortDescZh || "", defaultDeliveryMessage: item.defaultDeliveryMessage || "", coverImageUrl: item.product.coverImageUrl || "", allowMixedCheckout: Boolean(item.allowMixedCheckout), syncToMall: Boolean(item.product.syncToMall), isActive: Boolean(item.isActive) });
  const mutation = trpc.virtualDelivery.updateProduct.useMutation({ onSuccess: async () => { await utils.virtualDelivery.listProducts.invalidate(); setOpen(false); toast.success("虚拟商品已更新"); }, onError: (error) => toast.error(error.message) });
  const reset = () => setForm({ name: item.product.name || "", description: item.product.description || item.product.shortDescZh || "", defaultDeliveryMessage: item.defaultDeliveryMessage || "", coverImageUrl: item.product.coverImageUrl || "", allowMixedCheckout: Boolean(item.allowMixedCheckout), syncToMall: Boolean(item.product.syncToMall), isActive: Boolean(item.isActive) });
  return <Dialog open={open} onOpenChange={(next) => { if (next) reset(); setOpen(next); }}><DialogTrigger asChild><Button size="sm" variant="outline"><Pencil className="mr-1 h-3.5 w-3.5" />编辑</Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>编辑虚拟商品</DialogTitle><DialogDescription>修改商品资料、商城设置与默认交付内容，不会改变已下单客户的交付快照。</DialogDescription></DialogHeader><div className="grid gap-4 py-2 md:grid-cols-2"><div className="space-y-2"><Label>商品名称</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div className="flex items-center justify-between rounded-lg border p-3"><div><Label>启用商品</Label><p className="text-xs text-muted-foreground">关闭后不可继续销售</p></div><Switch checked={form.isActive} onCheckedChange={(value) => setForm({ ...form, isActive: value })} /></div><div className="space-y-2 md:col-span-2"><Label>商品介绍</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div><div className="md:col-span-2"><ImageUrlUploader label="商品图片" value={form.coverImageUrl} onChange={(value) => setForm({ ...form, coverImageUrl: value })} hint="商城默认显示此商品主图。" /></div><div className="space-y-2 md:col-span-2"><Label>默认发送内容</Label><Textarea value={form.defaultDeliveryMessage} onChange={(event) => setForm({ ...form, defaultDeliveryMessage: event.target.value })} /></div><div className="flex items-center justify-between rounded-lg border p-3"><div><Label>允许混合结账</Label><p className="text-xs text-muted-foreground">可与实体商品同一订单付款</p></div><Switch checked={form.allowMixedCheckout} onCheckedChange={(value) => setForm({ ...form, allowMixedCheckout: value })} /></div><div className="flex items-center justify-between rounded-lg border p-3"><div><Label>同步到商城</Label><p className="text-xs text-muted-foreground">启用后在商城售卖</p></div><Switch checked={form.syncToMall} onCheckedChange={(value) => setForm({ ...form, syncToMall: value })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button disabled={mutation.isPending || !form.name.trim()} onClick={() => mutation.mutate({ id: item.id, ...form })}>{mutation.isPending ? "保存中…" : "保存修改"}</Button></DialogFooter></DialogContent></Dialog>;
}

function VirtualPackageEditButton({ deliveryPackage, variant }: { deliveryPackage: any; variant: any }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: deliveryPackage.name || "", sellingPrice: String(variant.sellingPrice || "0.00"), contentCost: String(deliveryPackage.contentCost || "0.00"), deliveryLink: deliveryPackage.deliveryLink || "", deliveryMessage: deliveryPackage.deliveryMessage || "", imageUrl: variant.imageUrl || "", isActive: Boolean(deliveryPackage.isActive) });
  const mutation = trpc.virtualDelivery.updatePackage.useMutation({ onSuccess: async () => { await utils.virtualDelivery.listProducts.invalidate(); setOpen(false); toast.success("配套已更新"); }, onError: (error) => toast.error(error.message) });
  const reset = () => setForm({ name: deliveryPackage.name || "", sellingPrice: String(variant.sellingPrice || "0.00"), contentCost: String(deliveryPackage.contentCost || "0.00"), deliveryLink: deliveryPackage.deliveryLink || "", deliveryMessage: deliveryPackage.deliveryMessage || "", imageUrl: variant.imageUrl || "", isActive: Boolean(deliveryPackage.isActive) });
  return <Dialog open={open} onOpenChange={(next) => { if (next) reset(); setOpen(next); }}><DialogTrigger asChild><Button size="icon" variant="ghost" title="编辑配套"><Pencil className="h-3.5 w-3.5" /></Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>编辑配套</DialogTitle><DialogDescription>修改此配套的售价、成本、图片、链接与发送内容。</DialogDescription></DialogHeader><div className="grid gap-4 py-2 md:grid-cols-2"><div className="space-y-2"><Label>配套名称</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div className="flex items-center justify-between rounded-lg border p-3"><div><Label>启用配套</Label><p className="text-xs text-muted-foreground">关闭后不可选择</p></div><Switch checked={form.isActive} onCheckedChange={(value) => setForm({ ...form, isActive: value })} /></div><div className="space-y-2"><Label>售价 (RM)</Label><Input inputMode="decimal" value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })} /></div><div className="space-y-2"><Label>配套成本 (RM)</Label><Input inputMode="decimal" value={form.contentCost} onChange={(event) => setForm({ ...form, contentCost: event.target.value })} /></div><div className="md:col-span-2"><ImageUrlUploader label="配套图片" value={form.imageUrl} onChange={(value) => setForm({ ...form, imageUrl: value })} hint="客户在商城选择此配套后，会优先显示这张图片。" /></div><div className="space-y-2 md:col-span-2"><Label>交付链接</Label><Input value={form.deliveryLink} onChange={(event) => setForm({ ...form, deliveryLink: event.target.value })} placeholder="https://..." /></div><div className="space-y-2 md:col-span-2"><Label>此配套发送内容</Label><Textarea value={form.deliveryMessage} onChange={(event) => setForm({ ...form, deliveryMessage: event.target.value })} placeholder="留空则使用商品默认发送内容" /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button disabled={mutation.isPending || !form.name.trim()} onClick={() => mutation.mutate({ id: deliveryPackage.id, ...form })}>{mutation.isPending ? "保存中…" : "保存修改"}</Button></DialogFooter></DialogContent></Dialog>;
}

function ImageUrlUploader({ label, value, onChange, hint }: { label: string; value: string; onChange: (value: string) => void; hint: string }) {
  const [uploading, setUploading] = useState(false);
  return <div className="space-y-2"><Label>{label}</Label><div className="flex flex-wrap items-center gap-2"><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://... 或点击上传" className="min-w-52 flex-1" /><label className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-2 text-sm ${uploading ? "pointer-events-none opacity-60" : "hover:bg-accent"}`}><Upload className="h-4 w-4" />{uploading ? "上传中…" : "上传图片"}<input className="hidden" type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(file); }); const response = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: base64, filename: file.name }) }); const result = await response.json(); if (!response.ok || !result.url) throw new Error(result.error || "图片上传失败"); onChange(result.url); toast.success("图片已上传"); } catch (error: any) { toast.error(error.message || "图片上传失败"); } finally { setUploading(false); event.target.value = ""; } }} /></label></div>{value && <img src={value} alt={`${label}预览`} className="h-24 w-24 rounded-lg border object-cover" />}<p className="text-xs text-muted-foreground">{hint}</p></div>;
}
