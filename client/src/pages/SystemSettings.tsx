import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { buildSystemLink, getCompanyLogoChange, getPersistedCompanyLogoUrl, isSupportedCompanyLogo } from "@/lib/settingsLinks";
import { Building2, Hash, Bell, Shield, Save, Upload, Copy, ExternalLink, Package } from "lucide-react";
import { AdminPageHeader } from "@/components/AdminPageHeader";

export default function SystemSettings() {
  const { data: settings, isLoading, refetch } = trpc.settings.get.useQuery();
  const [form, setForm] = useState<any>({});
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [savedLogoUrl, setSavedLogoUrl] = useState("");
  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: (saved) => {
      const confirmedLogoUrl = getPersistedCompanyLogoUrl(saved);
      setSavedLogoUrl(confirmedLogoUrl);
      setForm(saved ?? {});
      toast.success("设置已保存，Logo 已按服务器确认结果更新");
      void refetch();
    },
    onError: (e) => toast.error("保存失败: " + e.message),
  });
  const packingWorkspaceUrl = buildSystemLink(typeof window === "undefined" ? undefined : window.location.origin, "/packing");

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setSavedLogoUrl(getPersistedCompanyLogoUrl(settings));
    }
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const update = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const copyLink = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label}已复制`);
    } catch {
      toast.error("无法自动复制，请手动选择链接");
    }
  };

  const handleLogoUpload = async (file?: File) => {
    if (!file) return;
    if (!isSupportedCompanyLogo(file)) {
      toast.error("请上传图片格式的 Logo");
      return;
    }
    setIsLogoUploading(true);
    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("无法读取图片"));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: fileData, filename: file.name, contentType: file.type }),
      });
      if (!response.ok) throw new Error("上传失败");
      const result = await response.json();
      const logoChange = getCompanyLogoChange(savedLogoUrl, result.url);
      update("companyLogoUrl", result.url);
      toast.success(logoChange === "replace"
        ? "新 Logo 已上传，将替换目前 Logo；请点击页面右上角「保存」正式更新公司资料"
        : "Logo 已上传，请点击页面右上角「保存」正式更新公司资料");
    } catch (error: any) {
      toast.error(error?.message || "Logo 上传失败");
    } finally {
      setIsLogoUploading(false);
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="系统设置"
        description="公司资料、编号规则、通知与安全设置"
        actions={<Button className="h-10" onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? "保存中..." : "保存"}
        </Button>}
      />

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company"><Building2 className="h-4 w-4 mr-2" />公司资料</TabsTrigger>
          <TabsTrigger value="numbering"><Hash className="h-4 w-4 mr-2" />编号规则</TabsTrigger>
          <TabsTrigger value="notification"><Bell className="h-4 w-4 mr-2" />通知设置</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-4 w-4 mr-2" />安全设置</TabsTrigger>
        </TabsList>

        {/* Company Profile */}
        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">公司资料</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>公司名称</Label>
                <Input value={form.companyName || ""} onChange={(e) => update("companyName", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>公司 Logo</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {form.companyLogoUrl ? (
                      <img src={form.companyLogoUrl} alt="公司 Logo 预览" className="h-full w-full object-contain" />
                    ) : (
                      <Building2 className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input value={form.companyLogoUrl || ""} onChange={(e) => update("companyLogoUrl", e.target.value)} placeholder="上传图片或填写 Logo URL" />
                      <label className="shrink-0">
                        <Button type="button" variant="outline" disabled={isLogoUploading} asChild>
                          <span><Upload className="mr-2 h-4 w-4" />{isLogoUploading ? "上传中..." : "上传图片"}</span>
                        </Button>
                        <input type="file" accept="image/*" className="sr-only" onChange={(event) => {
                          void handleLogoUpload(event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }} />
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">上传后会先显示预览；请点击页面右上角「保存」后，才会写入公司资料并用于订单单据与前台展示。保存成功后页面会以服务器确认的Logo回填；如已有Logo，上传新图片会明确提示替换。</p>
                    {getCompanyLogoChange(savedLogoUrl, form.companyLogoUrl) === "replace" ? (
                      <p className="text-xs font-medium text-amber-700">尚未保存：新 Logo 将替换目前已保存的 Logo。</p>
                    ) : getCompanyLogoChange(savedLogoUrl, form.companyLogoUrl) === "new" ? (
                      <p className="text-xs font-medium text-emerald-700">尚未保存：请点击页面右上角「保存」以启用新 Logo。</p>
                    ) : form.companyLogoUrl && savedLogoUrl === form.companyLogoUrl ? (
                      <p className="text-xs font-medium text-emerald-700">当前 Logo 已保存，并会在重新进入此页面时回显。</p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>公司电话</Label>
                <Input value={form.companyPhone || ""} onChange={(e) => update("companyPhone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.companyEmail || ""} onChange={(e) => update("companyEmail", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input value={form.companyWebsite || ""} onChange={(e) => update("companyWebsite", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Business Registration No.</Label>
                <Input value={form.businessRegNo || ""} onChange={(e) => update("businessRegNo", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>公司地址</Label>
                <Textarea value={form.companyAddress || ""} onChange={(e) => update("companyAddress", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" />包货工作台系统链接</CardTitle>
              <CardDescription>此链接仅供已登录的后台员工使用；复制后可发送给有权限的包货同事，未登录者仍需先完成登录。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={packingWorkspaceUrl} readOnly aria-label="包货工作台系统链接" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void copyLink(packingWorkspaceUrl, "包货工作台链接")}><Copy className="mr-2 h-4 w-4" />复制链接</Button>
                <Button type="button" variant="outline" asChild><a href={packingWorkspaceUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />直接打开</a></Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">默认寄件地址</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>寄件人姓名</Label>
                <Input value={form.defaultShipFromName || ""} onChange={(e) => update("defaultShipFromName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>寄件电话</Label>
                <Input value={form.defaultShipFromPhone || ""} onChange={(e) => update("defaultShipFromPhone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>寄件邮编</Label>
                <Input value={form.defaultShipFromPostcode || ""} onChange={(e) => update("defaultShipFromPostcode", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>州属</Label>
                <Input value={form.defaultShipFromState || ""} onChange={(e) => update("defaultShipFromState", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>城市</Label>
                <Input value={form.defaultShipFromCity || ""} onChange={(e) => update("defaultShipFromCity", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>寄件地址</Label>
                <Textarea value={form.defaultShipFromAddress || ""} onChange={(e) => update("defaultShipFromAddress", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>货币</Label>
                <Input value={form.currency || "MYR"} onChange={(e) => update("currency", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>时区</Label>
                <Input value={form.timezone || "Asia/Kuala_Lumpur"} onChange={(e) => update("timezone", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Numbering Rules */}
        <TabsContent value="numbering" className="space-y-4">
          {/* 订单编号 */}
          <Card>
            <CardHeader><CardTitle className="text-base">订单编号</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>本地订单前缀</Label>
                <Input value={form.localOrderPrefix || "XT"} onChange={(e) => update("localOrderPrefix", e.target.value)} />
                <p className="text-xs text-muted-foreground">例: XT-00001</p>
              </div>
              <div className="space-y-2">
                <Label>代购订单前缀</Label>
                <Input value={form.importOrderPrefix || "XTC"} onChange={(e) => update("importOrderPrefix", e.target.value)} />
                <p className="text-xs text-muted-foreground">例: XTC-00001</p>
              </div>
              <div className="space-y-2">
                <Label>订单编号位数</Label>
                <Input type="number" value={form.orderNumberPadding || 5} onChange={(e) => update("orderNumberPadding", parseInt(e.target.value))} />
              </div>
            </CardContent>
          </Card>
          {/* 客户编号 */}
          <Card>
            <CardHeader><CardTitle className="text-base">客户编号</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>客户编号前缀</Label>
                <Input value={form.customerPrefix || "CUS"} onChange={(e) => update("customerPrefix", e.target.value)} />
                <p className="text-xs text-muted-foreground">例: CUS-00001</p>
              </div>
              <div className="space-y-2">
                <Label>客户编号位数</Label>
                <Input type="number" value={form.customerNumberPadding || 5} onChange={(e) => update("customerNumberPadding", parseInt(e.target.value))} />
              </div>
              <div></div>
            </CardContent>
          </Card>
          {/* 商品编号 */}
          <Card>
            <CardHeader><CardTitle className="text-base">商品编号</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>商品编号前缀</Label>
                <Input value={form.skuPrefix || "SKU"} onChange={(e) => update("skuPrefix", e.target.value)} />
                <p className="text-xs text-muted-foreground">例: SKU-00001</p>
              </div>
              <div className="space-y-2">
                <Label>商品编号位数</Label>
                <Input type="number" value={form.skuNumberPadding || 5} onChange={(e) => update("skuNumberPadding", parseInt(e.target.value))} />
              </div>
              <div></div>
            </CardContent>
          </Card>
          {/* 采购编号 */}
          <Card>
            <CardHeader><CardTitle className="text-base">采购编号</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>采购编号前缀</Label>
                <Input value={form.poPrefix || "PO"} onChange={(e) => update("poPrefix", e.target.value)} />
                <p className="text-xs text-muted-foreground">例: PO-00001</p>
              </div>
              <div className="space-y-2">
                <Label>采购编号位数</Label>
                <Input type="number" value={form.poNumberPadding || 5} onChange={(e) => update("poNumberPadding", parseInt(e.target.value))} />
              </div>
              <div></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notification" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">通知设置</CardTitle>
              <CardDescription>控制订单事件是否触发系统通知。开关只控制对应事件的发送资格；实际送达渠道和内容仍以已连接的通知服务及模板配置为准。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>新订单通知</Label>
                  <p className="text-xs text-muted-foreground">产生新订单时，向通知邮箱或已连接的通知渠道提示后台跟进。</p>
                </div>
                <Switch checked={form.notifyOnNewOrder ?? true} onCheckedChange={(v) => update("notifyOnNewOrder", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>付款通知</Label>
                  <p className="text-xs text-muted-foreground">客户上传付款凭证时，提示后台审核；不会自动核准付款。</p>
                </div>
                <Switch checked={form.notifyOnPayment ?? true} onCheckedChange={(v) => update("notifyOnPayment", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>发货通知</Label>
                  <p className="text-xs text-muted-foreground">订单完成发货流程时，按已配置的客户通知渠道发送发货提示。</p>
                </div>
                <Switch checked={form.notifyOnShipment ?? true} onCheckedChange={(v) => update("notifyOnShipment", v)} />
              </div>
              <div className="space-y-2">
                <Label>通知邮箱</Label>
                <Input type="email" value={form.notifyEmail || ""} onChange={(e) => update("notifyEmail", e.target.value)} placeholder="admin@example.com" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">安全设置</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>要求员工登录</Label>
                  <p className="text-xs text-muted-foreground">发货员必须登录才能操作系统</p>
                </div>
                <Switch checked={form.requireStaffLogin ?? true} onCheckedChange={(v) => update("requireStaffLogin", v)} />
              </div>
              <div className="space-y-2">
                <Label>自动完成天数</Label>
                <Input type="number" value={form.autoCompleteDays ?? 7} onChange={(e) => update("autoCompleteDays", parseInt(e.target.value))} />
                <p className="text-xs text-muted-foreground">发货后多少天自动完成订单</p>
              </div>
            </CardContent>
          </Card>

          {/* Live Comment Footer */}
          <Card>
            <CardHeader>
              <CardTitle>直播留言 Footer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>关键词复制文案 Footer</Label>
                <Textarea
                  value={form.liveCommentFooter || ""}
                  onChange={(e) => update("liveCommentFooter", e.target.value)}
                  rows={3}
                  placeholder="例如: 👇 留言关键词即可自动下单"
                />
                <p className="text-xs text-muted-foreground">仅在直播详情页管理员点击「复制关键词」时附加在复制文案末尾，不会自动发布到 Facebook 留言，也不会自动发送给客户。</p>
              </div>
            </CardContent>
          </Card>

          {/* Checkout Message Template */}
          <Card>
            <CardHeader>
              <CardTitle>Checkout 追单消息模板</CardTitle>
              <CardDescription>发送给未汇款订单客户的默认追单消息，支持自定义编辑</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>追单消息内容</Label>
                <Textarea
                  value={form.checkoutMessageTemplate || ""}
                  onChange={(e) => update("checkoutMessageTemplate", e.target.value)}
                  rows={8}
                  placeholder="您好，感恩您的支持 ❤️\n\n目前还没收到您的汇款及确认信息。\n\n请您点击以下链接查询您的订单（{orderNumber}）：\n\n{link}\n\n进入订单后，除了可以查询订单，也可以继续到商城加单 ❤️\n\n西马消费满 RM150（特价商品除外），10kg 内即可享受免邮优惠。"
                />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    可用占位符：
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <code className="px-2 py-1 text-xs bg-muted rounded">{"{link}"}</code>
                    <span className="text-xs text-muted-foreground">→ 结单链接</span>
                    <code className="px-2 py-1 text-xs bg-muted rounded ml-2">{"{orderNumber}"}</code>
                    <span className="text-xs text-muted-foreground">→ 订单号</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>直播得标通知模板</CardTitle>
              <CardDescription>直播留言成功捉单后发送给客户的通知内容；每位客户的专属结单按钮会自动附加。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>得标通知内容</Label>
                <Textarea
                  value={form.liveWinNoticeTemplate || ""}
                  onChange={(e) => update("liveWinNoticeTemplate", e.target.value)}
                  rows={10}
                  placeholder={"🎉 得标通知！\n\n{item_list}\n\n{amount_breakdown}\n\n请点击下方【查询订单及结账】按钮查看订单详情并完成付款。"}
                />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">可用占位符：</p>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
                    <code className="rounded bg-muted px-2 py-1">{"{customer_name}"}</code><span className="text-muted-foreground">客户名字</span>
                    <code className="ml-2 rounded bg-muted px-2 py-1">{"{order_number}"}</code><span className="text-muted-foreground">订单号</span>
                    <code className="ml-2 rounded bg-muted px-2 py-1">{"{item_list}"}</code><span className="text-muted-foreground">商品列表</span>
                    <code className="ml-2 rounded bg-muted px-2 py-1">{"{total_amount}"}</code><span className="text-muted-foreground">小计金额</span>
                    <code className="rounded bg-muted px-2 py-1">{"{amount_breakdown}"}</code><span className="text-muted-foreground">普通／特价小计、免邮基数及运费待确认说明</span>
                    <code className="ml-2 rounded bg-muted px-2 py-1">{"{normal_subtotal}"}</code><span className="text-muted-foreground">普通商品小计</span>
                    <code className="ml-2 rounded bg-muted px-2 py-1">{"{special_subtotal}"}</code><span className="text-muted-foreground">特价商品小计（不计入免邮）</span>
                    <code className="ml-2 rounded bg-muted px-2 py-1">{"{free_shipping_eligible_subtotal}"}</code><span className="text-muted-foreground">RM150 免邮计算基数</span>
                    <code className="ml-2 rounded bg-muted px-2 py-1">{"{shipping_status}"}</code><span className="text-muted-foreground">运费待填写配送资料后计算</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">无需填写结单链接；系统会在每一位客户的消息下方自动附加其专属的「查询订单及结账」按钮。</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
