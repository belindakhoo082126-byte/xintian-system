import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Megaphone, Plus, Edit, Copy, Trash2, Search, GripVertical, Link2,
  Image, Video, FileText, MessageSquare, Package, MousePointerClick,
  Play, Pause, Archive, ArrowUp, ArrowDown, RotateCcw,
} from "lucide-react";

const CAMPAIGN_TYPES = [
  { value: "post", label: "Facebook Post" },
  { value: "reel", label: "Facebook Reel" },
  { value: "video", label: "Facebook Video" },
];

const FLOW_TYPES = [
  { value: "text", labelKey: "campaigns.flowTypeText", icon: FileText },
  { value: "image", labelKey: "campaigns.flowTypeImage", icon: Image },
  { value: "video", labelKey: "campaigns.flowTypeVideo", icon: Video },
  { value: "product_intro", labelKey: "campaigns.flowTypeProductIntro", icon: Package },
  { value: "button", labelKey: "campaigns.flowTypeButton", icon: MousePointerClick },
];

export default function Campaigns() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: campaigns, isLoading, refetch } = trpc.campaigns.list.useQuery({ includeArchived: true });
  const utils = trpc.useUtils();

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    let result = campaigns as any[];
    // Filter by status tab
    if (statusFilter !== "all") {
      if (statusFilter === "active") {
        result = result.filter((c: any) => c.status === "draft" || c.status === "active");
      } else if (statusFilter === "ended") {
        result = result.filter((c: any) => c.status === "ended");
      } else if (statusFilter === "archived") {
        result = result.filter((c: any) => c.status === "archived");
      }
    }
    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.type?.toLowerCase().includes(q) ||
        c.facebookLink?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [campaigns, searchQuery, statusFilter]);

  const handleCreate = () => {
    setEditingCampaign(null);
    setShowEditDialog(true);
  };

  const handleEdit = (campaign: any) => {
    setEditingCampaign(campaign);
    setShowEditDialog(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("campaigns.confirmDelete"))) return;
    try {
      await utils.client.campaigns.delete.mutate({ id });
      toast.success(t("campaigns.deleted"));
      refetch();
    } catch (err: any) {
      toast.error(t("campaigns.deleteFailed") + ": " + err.message);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await utils.client.campaigns.duplicate.mutate({ id });
      toast.success(t("campaigns.duplicated"));
      refetch();
    } catch (err: any) {
      toast.error(t("campaigns.duplicateFailed") + ": " + err.message);
    }
  };

  const handleStatusChange = async (campaign: any, newStatus: "draft" | "active" | "ended" | "archived") => {
    if (newStatus === "archived" && !confirm(t("campaigns.confirmArchive"))) return;
    try {
      await utils.client.campaigns.update.mutate({ id: campaign.id, status: newStatus });
      const statusLabels: Record<string, string> = {
        draft: t("campaigns.statusDraft"),
        active: t("campaigns.statusActive"),
        ended: t("campaigns.statusEnded"),
        archived: t("campaigns.statusArchived"),
      };
      toast.success(t("campaigns.statusUpdated", { status: statusLabels[newStatus] || newStatus }));
      refetch();
    } catch (err: any) {
      toast.error(t("campaigns.updateFailed") + ": " + err.message);
    }
  };

  const statusFilterTabs = [
    { value: "all", label: t("campaigns.filterAll") },
    { value: "active", label: t("campaigns.filterActive") },
    { value: "ended", label: t("campaigns.filterEnded") },
    { value: "archived", label: t("campaigns.filterArchived") },
  ];

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t("campaigns.title")}</h1>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t("campaigns.create")}
        </Button>
      </div>

      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/70 dark:bg-blue-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-blue-900 dark:text-blue-100">
            <Megaphone className="h-4 w-4" />
            {lang === "zh" ? "Campaign 是什么？如何使用？" : "What is a Campaign and how do I use it?"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-blue-950/85 dark:text-blue-100/90 md:grid-cols-3">
          <div>
            <p className="font-medium">{lang === "zh" ? "1. 建立活动" : "1. Create a campaign"}</p>
            <p className="mt-1 text-xs leading-5">{lang === "zh" ? "一个 Campaign 用来集中管理同一推广主题的 Facebook 内容、自动回复、商品介绍与统计。" : "Use one Campaign to manage Facebook content, auto replies, product introductions, and performance for one promotion."}</p>
          </div>
          <div>
            <p className="font-medium">{lang === "zh" ? "2. 绑定 Facebook 内容" : "2. Attach Facebook content"}</p>
            <p className="mt-1 text-xs leading-5">{lang === "zh" ? "先储存活动，再于“内容 ID”分页加入同一活动的 Post、Reel 或 Video；这些内容会共用活动的设置与统计。" : "Save first, then add the related Post, Reel, or Video in the Content IDs tab. Attached content shares the campaign settings and statistics."}</p>
          </div>
          <div>
            <p className="font-medium">{lang === "zh" ? "3. 配置并启用" : "3. Configure and activate"}</p>
            <p className="mt-1 text-xs leading-5">{lang === "zh" ? "在“流程”和“按钮”设置自动回复内容与引导动作；确认后由草稿切换为启用。结束或封存后将停止新自动流程，但保留历史统计。" : "Configure automated replies and customer actions in Flows and Buttons, then change Draft to Active. Ending or archiving stops new automation while retaining history."}</p>
          </div>
        </CardContent>
      </Card>

      {/* Status Filter Tabs */}
      <div className="flex gap-2">
        {statusFilterTabs.map(tab => (
          <Button
            key={tab.value}
            variant={statusFilter === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("campaigns.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Campaign List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{t("campaigns.loading")}</div>
      ) : filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{t("campaigns.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredCampaigns.map((campaign: any) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onEdit={() => handleEdit(campaign)}
              onDelete={() => handleDelete(campaign.id)}
              onDuplicate={() => handleDuplicate(campaign.id)}
              onStatusChange={(s) => handleStatusChange(campaign, s)}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {showEditDialog && (
        <CampaignEditDialog
          campaign={editingCampaign}
          onClose={() => { setShowEditDialog(false); setEditingCampaign(null); }}
          onSaved={() => { setShowEditDialog(false); setEditingCampaign(null); refetch(); }}
        />
      )}
    </div>
  );
}

// --- Campaign Card ---
function CampaignCard({ campaign, onEdit, onDelete, onDuplicate, onStatusChange }: {
  campaign: any;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onStatusChange: (status: "draft" | "active" | "ended" | "archived") => void;
}) {
  const { t } = useI18n();
  const statusColors: Record<string, string> = {
    draft: "bg-gray-500",
    active: "bg-green-500",
    ended: "bg-orange-500",
    archived: "bg-gray-400",
  };
  const statusLabels: Record<string, string> = {
    draft: t("campaigns.statusDraft"),
    active: t("campaigns.statusActive"),
    ended: t("campaigns.statusEnded"),
    archived: t("campaigns.statusArchived"),
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{campaign.name}</h3>
              <Badge variant="outline" className="text-xs">{campaign.type}</Badge>
              <Badge className={`text-xs text-white ${statusColors[campaign.status] || "bg-gray-500"}`}>
                {statusLabels[campaign.status] || campaign.status}
              </Badge>
            </div>
            {campaign.facebookLink && (
              <a href={campaign.facebookLink} target="_blank" rel="noopener noreferrer"
                 className="text-sm text-blue-500 hover:underline truncate block">
                {campaign.facebookLink}
              </a>
            )}
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                {campaign.contentIdCount || 0} {t("campaigns.contentCount")}
              </span>
              <span>{t("campaigns.statOrders")}: {campaign.stats?.autoOrderCount || 0}</span>
              <span>{t("campaigns.statMerged")}: {campaign.stats?.mergedOrderCount || 0}</span>
              <span>{t("campaigns.statQuantity")}: {campaign.stats?.totalQuantity || 0}</span>
              <span>{t("campaigns.statRevenue")}: RM{campaign.stats?.totalRevenue || "0"}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {campaign.status === "draft" && (
              <Button size="sm" variant="outline" onClick={() => onStatusChange("active")}>
                <Play className="h-3 w-3 mr-1" /> {t("campaigns.start")}
              </Button>
            )}
            {campaign.status === "active" && (
              <Button size="sm" variant="outline" onClick={() => onStatusChange("ended")}>
                <Pause className="h-3 w-3 mr-1" /> {t("campaigns.end")}
              </Button>
            )}
            {campaign.status === "archived" && (
              <Button size="sm" variant="outline" onClick={() => onStatusChange("active")}>
                <RotateCcw className="h-3 w-3 mr-1" /> {t("campaigns.restore")}
              </Button>
            )}
            {campaign.status !== "archived" && (
              <Button size="sm" variant="ghost" onClick={() => onStatusChange("archived")} title={t("campaigns.archive")}>
                <Archive className="h-3 w-3" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDuplicate}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} title={t("campaigns.delete")}>
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Campaign Edit Dialog (with Tabs: Settings + Content IDs + Flows + Buttons) ---
function CampaignEditDialog({ campaign, onClose, onSaved }: {
  campaign: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(campaign?.name || "");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(campaign?.autoReplyEnabled ?? true);
  const [autoReplyText, setAutoReplyText] = useState(campaign?.autoReplyText || "");
  const [messengerFlowEnabled, setMessengerFlowEnabled] = useState(campaign?.messengerFlowEnabled ?? true);
  const [activeTab, setActiveTab] = useState("settings");
  const [savedCampaignId, setSavedCampaignId] = useState<number | null>(campaign?.id || null);

  const utils = trpc.useUtils();
  const createMutation = trpc.campaigns.create.useMutation();
  const updateMutation = trpc.campaigns.update.useMutation();

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("campaigns.nameRequired"));
      return;
    }
    try {
      if (campaign) {
        await updateMutation.mutateAsync({
          id: campaign.id,
          name,
          autoReplyEnabled,
          autoReplyText,
          messengerFlowEnabled,
        });
        toast.success(t("campaigns.updated"));
      } else {
        const created = await createMutation.mutateAsync({
          name,
          autoReplyEnabled,
          autoReplyText,
          messengerFlowEnabled,
        });
        if (created?.id) {
          setSavedCampaignId(created.id);
          toast.success(t("campaigns.created"));
        } else {
          toast.success(t("campaigns.updated"));
        }
      }
      if (campaign) {
        onSaved();
      }
    } catch (err: any) {
      toast.error(t("campaigns.saveFailed") + ": " + err.message);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{campaign ? t("campaigns.editTitle") : t("campaigns.createTitle")}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings">{t("campaigns.tabSettings")}</TabsTrigger>
            <TabsTrigger value="contentIds" disabled={!campaign && !savedCampaignId}>{t("campaigns.tabContentIds")}</TabsTrigger>
            <TabsTrigger value="flows" disabled={!campaign && !savedCampaignId}>{t("campaigns.tabFlows")}</TabsTrigger>
            <TabsTrigger value="buttons" disabled={!campaign && !savedCampaignId}>{t("campaigns.tabButtons")}</TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 overflow-y-auto">
            <div className="space-y-4 p-2">
              <div>
                <Label>{t("campaigns.nameLabel")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("campaigns.namePlaceholder")} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("campaigns.autoReplyLabel")}</Label>
                  <p className="text-xs text-muted-foreground">{t("campaigns.autoReplyDesc")}</p>
                </div>
                <Switch checked={autoReplyEnabled} onCheckedChange={setAutoReplyEnabled} />
              </div>
              {autoReplyEnabled && (
                <div>
                  <Label>{t("campaigns.autoReplyTextLabel")}</Label>
                  <Textarea value={autoReplyText} onChange={(e) => setAutoReplyText(e.target.value)}
                    placeholder={t("campaigns.autoReplyTextPlaceholder")} rows={3} />
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("campaigns.messengerFlowLabel")}</Label>
                  <p className="text-xs text-muted-foreground">{t("campaigns.messengerFlowDesc")}</p>
                </div>
                <Switch checked={messengerFlowEnabled} onCheckedChange={setMessengerFlowEnabled} />
              </div>
            </div>
          </TabsContent>

          {/* Content IDs Tab */}
          {(campaign || savedCampaignId) && (
            <TabsContent value="contentIds" className="flex-1 overflow-y-auto">
              <ContentIdManager campaignId={campaign?.id || savedCampaignId!} />
            </TabsContent>
          )}

          {/* Flows Tab */}
          {(campaign || savedCampaignId) && (
            <TabsContent value="flows" className="flex-1 overflow-hidden">
              <FlowBuilder campaignId={campaign?.id || savedCampaignId!} />
            </TabsContent>
          )}

          {/* Buttons Tab */}
          {(campaign || savedCampaignId) && (
            <TabsContent value="buttons" className="flex-1 overflow-hidden">
              <ButtonManager campaignId={campaign?.id || savedCampaignId!} />
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("campaigns.cancel")}</Button>
          <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? t("campaigns.saving") : t("campaigns.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Content ID Manager ---
function ContentIdManager({ campaignId }: { campaignId: number }) {
  const { t } = useI18n();
  const [contentIds, setContentIds] = useState<any[]>([]);
  const [newLink, setNewLink] = useState("");
  const [loading, setLoading] = useState(true);

  const utils = trpc.useUtils();
  const listQuery = trpc.campaigns.listContentIds.useQuery({ campaignId });
  const addMutation = trpc.campaigns.addContentId.useMutation({
    onSuccess: () => { utils.campaigns.listContentIds.invalidate(); setNewLink(""); },
  });
  const removeMutation = trpc.campaigns.removeContentId.useMutation({
    onSuccess: () => { utils.campaigns.listContentIds.invalidate(); },
  });

  useEffect(() => {
    if (listQuery.data) { setContentIds(listQuery.data as any[]); setLoading(false); }
  }, [listQuery.data]);

  const handleAdd = async () => {
    if (!newLink.trim()) { toast.error(t("campaigns.contentLinkRequired")); return; }
    try {
      await addMutation.mutateAsync({ campaignId, facebookLink: newLink });
      toast.success(t("campaigns.contentBound"));
    } catch (err: any) {
      toast.error(t("campaigns.contentBindFailed") + ": " + err.message);
    }
  };

  return (
    <div className="space-y-4 p-2">
      <div>
        <Label>{t("campaigns.contentAddLabel")}</Label>
        <p className="text-xs text-muted-foreground mb-2">{t("campaigns.contentAddDesc")}</p>
        <div className="flex gap-2">
          <Input
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder={t("campaigns.contentAddPlaceholder")}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending}>
            {addMutation.isPending ? t("campaigns.contentAdding") : t("campaigns.contentAddBtn")}
          </Button>
        </div>
      </div>
      <Separator />
      <div>
        <Label>{t("campaigns.contentBoundList")}</Label>
        {loading ? (
          <p className="text-sm text-muted-foreground p-4">{t("campaigns.loading")}</p>
        ) : contentIds.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">{t("campaigns.contentEmpty")}</p>
        ) : (
          <div className="space-y-2">
            {contentIds.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{item.contentType}</Badge>
                  <span className="text-sm font-mono">{item.contentId}</span>
                  {item.facebookLink && (
                    <a href={item.facebookLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">{t("campaigns.contentOpenLink")}</a>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeMutation.mutate({ id: item.id })}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Flow Builder ---
function FlowBuilder({ campaignId }: { campaignId: number }) {
  const { t } = useI18n();
  const { data: flows, refetch } = trpc.campaigns.listFlows.useQuery({ campaignId });
  const [showAddFlow, setShowAddFlow] = useState(false);
  const utils = trpc.useUtils();
  const createMutation = trpc.campaigns.createFlow.useMutation();
  const deleteMutation = trpc.campaigns.deleteFlow.useMutation();
  const updateMutation = trpc.campaigns.updateFlow.useMutation();

  const handleAdd = async (type: string, text: string) => {
    try {
      await createMutation.mutateAsync({
        campaignId,
        sortOrder: (flows?.length || 0) * 10,
        type: type as any,
        text,
      });
      toast.success(t("campaigns.flowAdded"));
      refetch();
      setShowAddFlow(false);
    } catch (err: any) {
      toast.error(t("campaigns.flowAddFailed") + ": " + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("campaigns.flowDeleteConfirm"))) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success(t("campaigns.flowDeleted"));
      refetch();
    } catch (err: any) {
      toast.error(t("campaigns.flowDeleteFailed") + ": " + err.message);
    }
  };

  const handleMove = async (flow: any, direction: "up" | "down") => {
    if (!flows) return;
    const idx = flows.findIndex((f: any) => f.id === flow.id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= flows.length) return;
    const other = flows[swapIdx];
    try {
      await updateMutation.mutateAsync({ id: flow.id, sortOrder: other.sortOrder });
      await updateMutation.mutateAsync({ id: other.id, sortOrder: flow.sortOrder });
      refetch();
    } catch (err: any) {
      toast.error(t("campaigns.flowReorderFailed") + ": " + err.message);
    }
  };

  return (
    <div className="space-y-3 p-2 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t("campaigns.flowTitle")}</h3>
        <Button size="sm" onClick={() => setShowAddFlow(!showAddFlow)}>
          <Plus className="h-3 w-3 mr-1" /> {t("campaigns.flowAddStep")}
        </Button>
      </div>

      {showAddFlow && (
        <AddFlowForm onAdd={handleAdd} onCancel={() => setShowAddFlow(false)} />
      )}

      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {(!flows || flows.length === 0) ? (
            <p className="text-center text-muted-foreground py-8">{t("campaigns.flowEmpty")}</p>
          ) : (
            flows.map((flow: any, idx: number) => {
              const FlowIcon = FLOW_TYPES.find(ft => ft.value === flow.type)?.icon || FileText;
              const flowTypeLabel = FLOW_TYPES.find(ft => ft.value === flow.type)?.labelKey;
              return (
                <Card key={flow.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                        onClick={() => handleMove(flow, "up")} disabled={idx === 0}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                        onClick={() => handleMove(flow, "down")} disabled={idx === flows.length - 1}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FlowIcon className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline" className="text-xs">{flowTypeLabel ? t(flowTypeLabel) : flow.type}</Badge>
                        <span className="text-xs text-muted-foreground">#{flow.sortOrder}</span>
                      </div>
                      {flow.text && <p className="text-sm whitespace-pre-wrap">{flow.text}</p>}
                      {flow.mediaUrl && <p className="text-xs text-blue-500 truncate">{flow.mediaUrl}</p>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(flow.id)}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// --- Add Flow Form ---
function AddFlowForm({ onAdd, onCancel }: { onAdd: (type: string, text: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [type, setType] = useState("text");
  const [text, setText] = useState("");

  return (
    <Card className="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("campaigns.flowTypeLabel")}</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FLOW_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{t(ft.labelKey)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {(type === "text" || type === "product_intro" || type === "button") && (
        <div>
          <Label>{t("campaigns.flowContentLabel")}</Label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
            placeholder={type === "product_intro" ? "..." : type === "button" ? "..." : "..."} />
        </div>
      )}
      {(type === "image" || type === "video" || type === "audio" || type === "file") && (
        <div>
          <Label>{t("campaigns.flowMediaUrlLabel")}</Label>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="https://..." />
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}>{t("campaigns.cancel")}</Button>
        <Button size="sm" onClick={() => onAdd(type, text)}>{t("campaigns.contentAddBtn")}</Button>
      </div>
    </Card>
  );
}

// --- Button Manager ---
function ButtonManager({ campaignId }: { campaignId: number }) {
  const { t } = useI18n();
  const { data: buttons, refetch } = trpc.campaigns.listButtons.useQuery({ campaignId });
  const { data: productsData } = trpc.productsV2.list.useQuery({});
  const products = productsData?.items || [];
  const [showAddButton, setShowAddButton] = useState(false);
  const utils = trpc.useUtils();
  const createMutation = trpc.campaigns.createButton.useMutation();
  const deleteMutation = trpc.campaigns.deleteButton.useMutation();
  const updateMutation = trpc.campaigns.updateButton.useMutation();

  const handleAdd = async (data: { name: string; productId: number; quantity: number }) => {
    try {
      await createMutation.mutateAsync({
        campaignId,
        name: data.name,
        productId: data.productId,
        quantity: data.quantity,
        sortOrder: (buttons?.length || 0) * 10,
      });
      toast.success(t("campaigns.buttonAdded"));
      refetch();
      setShowAddButton(false);
    } catch (err: any) {
      toast.error(t("campaigns.buttonAddFailed") + ": " + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("campaigns.buttonDeleteConfirm"))) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success(t("campaigns.buttonDeleted"));
      refetch();
    } catch (err: any) {
      toast.error(t("campaigns.buttonDeleteFailed") + ": " + err.message);
    }
  };

  const handleToggle = async (btn: any) => {
    try {
      await updateMutation.mutateAsync({ id: btn.id, isActive: !btn.isActive });
      refetch();
    } catch (err: any) {
      toast.error(t("campaigns.buttonUpdateFailed") + ": " + err.message);
    }
  };

  return (
    <div className="space-y-3 p-2 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t("campaigns.buttonTitle")}</h3>
        <Button size="sm" onClick={() => setShowAddButton(!showAddButton)}>
          <Plus className="h-3 w-3 mr-1" /> {t("campaigns.buttonAdd")}
        </Button>
      </div>

      {showAddButton && (
        <AddButtonForm products={products} onAdd={handleAdd} onCancel={() => setShowAddButton(false)} />
      )}

      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {(!buttons || buttons.length === 0) ? (
            <p className="text-center text-muted-foreground py-8">{t("campaigns.buttonEmpty")}</p>
          ) : (
            buttons.map((btn: any) => {
              const product = products.find((p: any) => p.id === btn.productId);
              return (
                <Card key={btn.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{btn.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product?.name || `Product #${btn.productId}`} · {t("campaigns.buttonQty")}: {btn.quantity}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={btn.isActive} onCheckedChange={() => handleToggle(btn)} />
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(btn.id)}>
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// --- Add Button Form ---
function AddButtonForm({ products, onAdd, onCancel }: {
  products: any[];
  onAdd: (data: { name: string; productId: number; quantity: number }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [productId, setProductId] = useState<number>(0);
  const [quantity, setQuantity] = useState(1);

  return (
    <Card className="p-3 space-y-3">
      <div>
        <Label>{t("campaigns.buttonNameLabel")}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("campaigns.buttonNamePlaceholder")} />
      </div>
      <div>
        <Label>{t("campaigns.buttonProductLabel")}</Label>
        <Select value={String(productId)} onValueChange={(v) => setProductId(Number(v))}>
          <SelectTrigger><SelectValue placeholder={t("campaigns.buttonProductPlaceholder")} /></SelectTrigger>
          <SelectContent>
            {products.map((p: any) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.sku || p.keyword || "—"})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>{t("campaigns.buttonQtyLabel")}</Label>
        <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}>{t("campaigns.cancel")}</Button>
        <Button size="sm" onClick={() => onAdd({ name, productId, quantity })} disabled={!name || !productId}>
          {t("campaigns.contentAddBtn")}
        </Button>
      </div>
    </Card>
  );
}
