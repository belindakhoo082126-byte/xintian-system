import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, Image as ImageIcon, Palette, Bell, Phone, FileText, Settings, Calendar } from "lucide-react";

const THEMES = [
  { key: "xintian_nature", label: { zh: "🌿 心田自然", en: "🌿 Xintian Nature" }, colors: { primary: "#2d6a4f", secondary: "#95d5b2", button: "#40916c", background: "#f8f9fa", font: "#1b4332" } },
  { key: "lavender_purple", label: { zh: "💜 薰衣草紫", en: "💜 Lavender Purple" }, colors: { primary: "#7b2cbf", secondary: "#e0aaff", button: "#9d4edd", background: "#faf8ff", font: "#3c096c" } },
  { key: "sakura_pink", label: { zh: "🌸 樱花粉", en: "🌸 Sakura Pink" }, colors: { primary: "#e5989b", secondary: "#ffd5c2", button: "#ffb4a2", background: "#fff5f7", font: "#6d6875" } },
  { key: "nature_green", label: { zh: "🍃 自然绿", en: "🍃 Nature Green" }, colors: { primary: "#588157", secondary: "#a3b18a", button: "#3a5a40", background: "#fefce8", font: "#344e41" } },
  { key: "warm_brown", label: { zh: "☕ 暖棕", en: "☕ Warm Brown" }, colors: { primary: "#8b5e34", secondary: "#d4a373", button: "#a47148", background: "#faf6f2", font: "#5c4033" } },
  { key: "christmas", label: { zh: "🎄 圣诞节", en: "🎄 Christmas Day" }, colors: { primary: "#d62828", secondary: "#f1faee", button: "#003049", background: "#fefae0", font: "#1d3557" } },
  { key: "cny", label: { zh: "🧧 农历新年", en: "🧧 Chinese New Year" }, colors: { primary: "#d62828", secondary: "#fcbf49", button: "#e63946", background: "#fff8e1", font: "#9d0208" } },
  { key: "hari_raya", label: { zh: "🌙 开斋节", en: "🌙 Hari Raya" }, colors: { primary: "#064635", secondary: "#d4af37", button: "#0a6b4a", background: "#f5f0e1", font: "#064635" } },
  { key: "merdeka", label: { zh: "🇲🇾 独立日", en: "🇲🇾 Hari Merdeka" }, colors: { primary: "#cc0000", secondary: "#ffff00", button: "#0000cc", background: "#fefefe", font: "#1a1a2e" } },
  { key: "mid_autumn", label: { zh: "🥮 中秋节", en: "🥮 Mid-Autumn" }, colors: { primary: "#e76f51", secondary: "#f4a261", button: "#264653", background: "#fefae0", font: "#2a2a2a" } },
  { key: "valentine", label: { zh: "❤️ 情人节", en: "❤️ Valentine's Day" }, colors: { primary: "#e63946", secondary: "#f1faee", button: "#d62828", background: "#fff0f3", font: "#6a040f" } },
  { key: "custom", label: { zh: "🎨 自定义主题", en: "🎨 Custom Theme" }, colors: null },
];

export default function MallSettings() {
  const { translate, lang } = useI18n();
  const [activeTab, setActiveTab] = useState("basic");
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [bannerForm, setBannerForm] = useState<any>({ type: "home_16x9", imageUrl: "", linkUrl: "", displayOrder: 0, isEnabled: true });
  const utils = trpc.useUtils();

  const { data: settings } = trpc.mallAdmin.getSettings.useQuery();
  const { data: banners } = trpc.mallAdmin.listBanners.useQuery({});
  const { data: quickContacts } = trpc.mallAdmin.listQuickContacts.useQuery();
  const { data: notices } = trpc.mallAdmin.listNotices.useQuery();
  const { data: themeSchedules } = trpc.mallAdmin.listThemeSchedules.useQuery();

  const updateSettingsMutation = trpc.mallAdmin.updateSettings.useMutation({
    onSuccess: () => { utils.mallAdmin.invalidate(); toast.success(translate("设置已保存", "Settings saved")); },
    onError: (e) => toast.error(translate("保存失败", "Failed to save settings", { message: e.message })),
  });

  const createBannerMutation = trpc.mallAdmin.createBanner.useMutation({
    onSuccess: () => { utils.mallAdmin.invalidate(); toast.success(translate("横幅已创建", "Banner created")); setBannerDialogOpen(false); },
    onError: (e) => toast.error(translate("创建失败", "Failed to create", { message: e.message })),
  });

  const updateBannerMutation = trpc.mallAdmin.updateBanner.useMutation({
    onSuccess: () => { utils.mallAdmin.invalidate(); toast.success(translate("横幅已更新", "Banner updated")); setBannerDialogOpen(false); },
    onError: (e) => toast.error(translate("更新失败", "Failed to update", { message: e.message })),
  });

  const deleteBannerMutation = trpc.mallAdmin.deleteBanner.useMutation({
    onSuccess: () => { utils.mallAdmin.invalidate(); toast.success(translate("横幅已删除", "Banner deleted")); },
    onError: (e) => toast.error(translate("删除失败", "Failed to delete", { message: e.message })),
  });

  const createNoticeMutation = trpc.mallAdmin.createNotice.useMutation({
    onSuccess: () => { utils.mallAdmin.invalidate(); toast.success(translate("公告已创建", "Notice created")); },
    onError: (e) => toast.error(translate("创建失败", "Failed to create", { message: e.message })),
  });

  const updateNoticeMutation = trpc.mallAdmin.updateNotice.useMutation({
    onSuccess: () => { utils.mallAdmin.invalidate(); toast.success(translate("公告已更新", "Notice updated")); },
    onError: (e) => toast.error(translate("更新失败", "Failed to update", { message: e.message })),
  });

  const deleteNoticeMutation = trpc.mallAdmin.deleteNotice.useMutation({
    onSuccess: () => { utils.mallAdmin.invalidate(); toast.success(translate("公告已删除", "Notice deleted")); },
    onError: (e) => toast.error(translate("删除失败", "Failed to delete", { message: e.message })),
  });

  const createThemeScheduleMutation = trpc.mallAdmin.createThemeSchedule.useMutation({
    onSuccess: () => { utils.mallAdmin.invalidate(); toast.success(translate("主题排程已创建", "Theme schedule created")); },
    onError: (e) => toast.error(translate("创建失败", "Failed to create", { message: e.message })),
  });

  const deleteThemeScheduleMutation = trpc.mallAdmin.deleteThemeSchedule.useMutation({
    onSuccess: () => { utils.mallAdmin.invalidate(); toast.success(translate("排程已删除", "Schedule deleted")); },
    onError: (e) => toast.error(translate("删除失败", "Failed to delete", { message: e.message })),
  });

  const [settingsForm, setSettingsForm] = useState<any>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  if (settings && !settingsLoaded) {
    setSettingsForm(settings);
    setSettingsLoaded(true);
  }

  const [newNotice, setNewNotice] = useState("");
  const [newSchedule, setNewSchedule] = useState<any>({ themeKey: "christmas", startDate: "", endDate: "" });

  function handleSaveSettings() {
    if (!settings) return;
    updateSettingsMutation.mutate({ id: settings.id, ...settingsForm });
  }

  function openCreateBanner() {
    setEditingBanner(null);
    setBannerForm({ type: "home_16x9", imageUrl: "", linkUrl: "", displayOrder: 0, isEnabled: true });
    setBannerDialogOpen(true);
  }

  function openEditBanner(banner: any) {
    setEditingBanner(banner);
    setBannerForm({
      type: banner.type,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl || "",
      displayOrder: banner.displayOrder,
      isEnabled: banner.isEnabled,
      startDate: banner.startDate ? new Date(banner.startDate).toISOString().split("T")[0] : "",
      endDate: banner.endDate ? new Date(banner.endDate).toISOString().split("T")[0] : "",
    });
    setBannerDialogOpen(true);
  }

  function handleSaveBanner() {
    if (!bannerForm.imageUrl) { toast.error(translate("请输入图片 URL", "Please enter image URL")); return; }
    if (editingBanner) {
      updateBannerMutation.mutate({
        id: editingBanner.id,
        imageUrl: bannerForm.imageUrl,
        linkUrl: bannerForm.linkUrl || null,
        displayOrder: bannerForm.displayOrder,
        isEnabled: bannerForm.isEnabled,
        startDate: bannerForm.startDate ? new Date(bannerForm.startDate).getTime() : null,
        endDate: bannerForm.endDate ? new Date(bannerForm.endDate).getTime() : null,
      });
    } else {
      createBannerMutation.mutate({
        type: bannerForm.type,
        imageUrl: bannerForm.imageUrl,
        linkUrl: bannerForm.linkUrl || undefined,
        displayOrder: bannerForm.displayOrder,
        isEnabled: bannerForm.isEnabled,
        startDate: bannerForm.startDate ? new Date(bannerForm.startDate).getTime() : undefined,
        endDate: bannerForm.endDate ? new Date(bannerForm.endDate).getTime() : undefined,
      });
    }
  }

  function handleAddNotice() {
    if (!newNotice.trim()) return;
    createNoticeMutation.mutate({ announcement: newNotice, displayOrder: (notices?.length || 0) + 1 });
    setNewNotice("");
  }

  function handleAddSchedule() {
    if (!newSchedule.startDate || !newSchedule.endDate) { toast.error(translate("请选择日期", "Please select dates")); return; }
    createThemeScheduleMutation.mutate({
      themeKey: newSchedule.themeKey,
      startDate: new Date(newSchedule.startDate).getTime(),
      endDate: new Date(newSchedule.endDate).getTime(),
    });
    setNewSchedule({ themeKey: "christmas", startDate: "", endDate: "" });
  }

  function handleThemeSelect(themeKey: string) {
    setSettingsForm((p: any) => ({ ...p, activeTheme: themeKey }));
    if (settings) {
      updateSettingsMutation.mutate({ id: settings.id, activeTheme: themeKey });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{translate("商城设置", "Mall Settings")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{translate("管理商城前台展示、主题、横幅、公告等", "Manage storefront display, themes, banners, announcements, etc.")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="basic"><Settings className="h-4 w-4 mr-1" />{translate("基本", "Basic")}</TabsTrigger>
          <TabsTrigger value="banners"><ImageIcon className="h-4 w-4 mr-1" />{translate("横幅", "Banners")}</TabsTrigger>
          <TabsTrigger value="notices"><Bell className="h-4 w-4 mr-1" />{translate("公告", "Notices")}</TabsTrigger>
          <TabsTrigger value="policies"><FileText className="h-4 w-4 mr-1" />{translate("条款", "Policies")}</TabsTrigger>
          <TabsTrigger value="contact"><Phone className="h-4 w-4 mr-1" />{translate("联系", "Contact")}</TabsTrigger>
          <TabsTrigger value="themes"><Palette className="h-4 w-4 mr-1" />{translate("主题", "Themes")}</TabsTrigger>
        </TabsList>

        {/* Basic Info */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{translate("基本信息", "Basic Information")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{translate("商店名称", "Shop Name")}</Label><Input value={settingsForm.shopName || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, shopName: e.target.value }))} /></div>
                <div><Label>{translate("域名", "Domain")}</Label><Input value={settingsForm.domain || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, domain: e.target.value }))} placeholder="xintian.com.my" /></div>
                <div><Label>{translate("Logo URL", "Logo URL")}</Label><Input value={settingsForm.logoUrl || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, logoUrl: e.target.value }))} /></div>
                <div><Label>{translate("Favicon URL", "Favicon URL")}</Label><Input value={settingsForm.faviconUrl || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, faviconUrl: e.target.value }))} /></div>
                <div><Label>{translate("标语", "Slogan")}</Label><Input value={settingsForm.slogan || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, slogan: e.target.value }))} /></div>
                <div><Label>{translate("SEO Title", "SEO Title")}</Label><Input value={settingsForm.seoTitle || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, seoTitle: e.target.value }))} /></div>
              </div>
              <div><Label>{translate("SEO Description", "SEO Description")}</Label><Textarea value={settingsForm.seoDescription || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, seoDescription: e.target.value }))} rows={2} /></div>
              <Button onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending}>{translate("保存", "Save")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Banners */}
        <TabsContent value="banners" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{translate("横幅管理", "Banner Management")}</h2>
            <Button onClick={openCreateBanner}><Plus className="h-4 w-4 mr-2" />{translate("新增横幅", "Add New Banner")}</Button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>{translate("类型", "Type")}</TableHead><TableHead>{translate("预览", "Preview")}</TableHead><TableHead>{translate("排序", "Order")}</TableHead><TableHead>{translate("状态", "Status")}</TableHead><TableHead className="text-right">{translate("操作", "Actions")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {banners?.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell><Badge variant="outline">{b.type}</Badge></TableCell>
                  <TableCell><img src={b.imageUrl} alt="banner" className="h-12 w-20 rounded border object-cover" /></TableCell>
                  <TableCell>{b.displayOrder}</TableCell>
                  <TableCell><Badge variant={b.isEnabled ? "default" : "outline"}>{b.isEnabled ? translate("启用", "Enabled") : translate("停用", "Disabled")}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditBanner(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteBannerMutation.mutate({ id: b.id })}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Notices */}
        <TabsContent value="notices" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{translate("首页公告", "Homepage Announcements")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={newNotice} onChange={(e) => setNewNotice(e.target.value)} placeholder={translate("输入公告内容...", "Enter announcement content...")} onKeyDown={(e) => e.key === "Enter" && handleAddNotice()} />
                <Button onClick={handleAddNotice}><Plus className="h-4 w-4" />{translate("添加", "Add")}</Button>
              </div>
              {notices?.map((n: any) => (
                <div key={n.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Switch checked={n.isEnabled} onCheckedChange={(v) => updateNoticeMutation.mutate({ id: n.id, isEnabled: v })} />
                  <span className="flex-1">{n.announcement}</span>
                  <Badge variant="outline">{translate("#{order}", "#{order}", { order: n.displayOrder })}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => deleteNoticeMutation.mutate({ id: n.id })} title={translate("删除公告", "Delete Notice")}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policies */}
        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{translate("条款与政策", "Terms and Policies")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>{translate("配送说明", "Shipping Policy")}</Label><Textarea value={settingsForm.shippingPolicy || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, shippingPolicy: e.target.value }))} rows={4} /></div>
              <div><Label>{translate("退款条例", "Refund Policy")}</Label><Textarea value={settingsForm.refundPolicy || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, refundPolicy: e.target.value }))} rows={4} /></div>
              <div><Label>{translate("服务条款", "Terms of Service")}</Label><Textarea value={settingsForm.serviceTerms || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, serviceTerms: e.target.value }))} rows={4} /></div>
              <Button onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending}>{translate("保存", "Save")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{translate("联系信息", "Contact Information")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{translate("公司名称", "Company Name")}</Label><Input value={settingsForm.companyName || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, companyName: e.target.value }))} /></div>
                <div><Label>{translate("电话", "Phone")}</Label><Input value={settingsForm.phone || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, phone: e.target.value }))} /></div>
                <div><Label>{translate("WhatsApp", "WhatsApp")}</Label><Input value={settingsForm.whatsapp || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, whatsapp: e.target.value }))} /></div>
                <div><Label>{translate("Email", "Email")}</Label><Input value={settingsForm.email || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, email: e.target.value }))} /></div>
                <div><Label>{translate("Facebook", "Facebook")}</Label><Input value={settingsForm.facebook || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, facebook: e.target.value }))} /></div>
                <div><Label>{translate("Waze 链接", "Waze Link")}</Label><Input value={settingsForm.wazeLink || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, wazeLink: e.target.value }))} /></div>
              </div>
              <div><Label>{translate("地址", "Address")}</Label><Textarea value={settingsForm.address || ""} onChange={(e) => setSettingsForm((p: any) => ({ ...p, address: e.target.value }))} rows={2} /></div>
              <Button onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending}>{translate("保存", "Save")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Themes */}
        <TabsContent value="themes" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{translate("主题中心", "Theme Center")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {THEMES.map((t) => (
                  <Card
                    key={t.key}
                    className={`cursor-pointer transition-all ${settingsForm.activeTheme === t.key ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
                    onClick={() => handleThemeSelect(t.key)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{t.label[lang] || t.label.zh}</span>
                        {settingsForm.activeTheme === t.key && <Badge>{translate("当前", "Current")}</Badge>}
                      </div>
                      {t.colors && (
                        <div className="flex gap-1">
                          {Object.values(t.colors).slice(0, 4).map((c, i) => (
                            <div key={i} className="w-6 h-6 rounded border" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Theme Scheduler */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />{translate("主题排程", "Theme Schedule")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label>{translate("主题", "Theme")}</Label>
                  <Select value={newSchedule.themeKey} onValueChange={(v) => setNewSchedule((p: any) => ({ ...p, themeKey: v }))}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {THEMES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label[lang] || t.label.zh}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{translate("开始日期", "Start Date")}</Label><Input type="date" value={newSchedule.startDate} onChange={(e) => setNewSchedule((p: any) => ({ ...p, startDate: e.target.value }))} /></div>
                <div><Label>{translate("结束日期", "End Date")}</Label><Input type="date" value={newSchedule.endDate} onChange={(e) => setNewSchedule((p: any) => ({ ...p, endDate: e.target.value }))} /></div>
                <Button onClick={handleAddSchedule}><Plus className="h-4 w-4 mr-2" />{translate("添加排程", "Add Schedule")}</Button>
              </div>
              {themeSchedules?.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Badge>{THEMES.find((t) => t.key === s.themeKey)?.label[lang] || THEMES.find((t) => t.key === s.themeKey)?.label.zh || s.themeKey}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(s.startDate).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")} → {new Date(s.endDate).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}
                  </span>
                  <Button variant="ghost" size="icon" className="ml-auto" onClick={() => deleteThemeScheduleMutation.mutate({ id: s.id })} title={translate("删除排程", "Delete Schedule")}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Banner Dialog */}
      <Dialog open={bannerDialogOpen} onOpenChange={setBannerDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingBanner ? translate("编辑横幅", "Edit Banner") : translate("新增横幅", "Add New Banner")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("横幅类型", "Banner Type")}</Label>
              <Select value={bannerForm.type} onValueChange={(v) => setBannerForm((p: any) => ({ ...p, type: v }))} disabled={!!editingBanner}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home_16x9">{translate("首页 16:9 (Desktop)", "Homepage 16:9 (Desktop)")}</SelectItem>
                  <SelectItem value="home_9x16">{translate("首页 9:16 (Mobile)", "Homepage 9:16 (Mobile)")}</SelectItem>
                  <SelectItem value="home_1x1">{translate("首页 1:1 (Promotion)", "Homepage 1:1 (Promotion)")}</SelectItem>
                  <SelectItem value="marketing_16x9">{translate("营销 16:9", "Marketing 16:9")}</SelectItem>
                  <SelectItem value="marketing_1x1">{translate("营销 1:1", "Marketing 1:1")}</SelectItem>
                  <SelectItem value="marketing_9x16">{translate("营销 9:16", "Marketing 9:16")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{translate("图片", "Image")}</Label>
              <div className="flex items-center gap-3">
                <Input value={bannerForm.imageUrl} onChange={(e) => setBannerForm((p: any) => ({ ...p, imageUrl: e.target.value }))} placeholder={translate("https://... 或点击上传", "https://... or click to upload")} />
                <label className="cursor-pointer">
                  <Button variant="outline" asChild>
                    <span><Upload className="h-4 w-4 mr-1" />{translate("上传", "Upload")}</span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                      const base64 = ev.target?.result as string;
                      try {
                        const res = await fetch("/api/upload", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ file: base64, filename: file.name }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setBannerForm((p: any) => ({ ...p, imageUrl: data.url }));
                          toast.success(translate("图片已上传", "Image uploaded"));
                        }
                      } catch { toast.error(translate("上传失败", "Upload failed")); }
                    };
                    reader.readAsDataURL(file);
                  }} />
                </label>
              </div>
            </div>
            {bannerForm.imageUrl && <img src={bannerForm.imageUrl} alt="preview" className="w-full rounded border" />}
            <div><Label>{translate("链接 URL (可选)", "Link URL (Optional)")}</Label><Input value={bannerForm.linkUrl} onChange={(e) => setBannerForm((p: any) => ({ ...p, linkUrl: e.target.value }))} /></div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={bannerForm.isEnabled} onCheckedChange={(v) => setBannerForm((p: any) => ({ ...p, isEnabled: v }))} /><Label>{translate("启用", "Enable")}</Label></div>
              <div><Label>{translate("排序", "Order")}</Label><Input type="number" className="w-20" value={bannerForm.displayOrder} onChange={(e) => setBannerForm((p: any) => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBannerDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={handleSaveBanner} disabled={createBannerMutation.isPending || updateBannerMutation.isPending}>{translate("保存", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
