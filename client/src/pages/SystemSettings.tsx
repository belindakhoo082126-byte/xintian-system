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
import { Building2, Hash, Bell, Shield, Save } from "lucide-react";

export default function SystemSettings() {
  const { data: settings, isLoading, refetch } = trpc.settings.get.useQuery();
  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => { toast.success("设置已保存"); refetch(); },
    onError: (e) => toast.error("保存失败: " + e.message),
  });

  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const update = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">系统设置</h1>
          <p className="text-sm text-muted-foreground mt-1">公司资料、编号规则、通知与安全设置</p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? "保存中..." : "保存"}
        </Button>
      </div>

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
              <div className="space-y-2">
                <Label>公司 Logo URL</Label>
                <Input value={form.companyLogoUrl || ""} onChange={(e) => update("companyLogoUrl", e.target.value)} />
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
            <CardHeader><CardTitle className="text-base">通知设置</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>新订单通知</Label>
                  <p className="text-xs text-muted-foreground">收到新订单时发送通知</p>
                </div>
                <Switch checked={form.notifyOnNewOrder ?? true} onCheckedChange={(v) => update("notifyOnNewOrder", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>付款通知</Label>
                  <p className="text-xs text-muted-foreground">客户上传付款凭证时通知</p>
                </div>
                <Switch checked={form.notifyOnPayment ?? true} onCheckedChange={(v) => update("notifyOnPayment", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>发货通知</Label>
                  <p className="text-xs text-muted-foreground">订单发货时通知客户</p>
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
                <p className="text-xs text-muted-foreground">
                  在直播详情页点击「复制关键词」时，自动附加在文案末尾的固定文字
                </p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
