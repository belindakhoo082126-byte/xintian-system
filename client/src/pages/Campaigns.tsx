import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
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
  Play, Pause, Archive, ArrowUp, ArrowDown,
} from "lucide-react";

const CAMPAIGN_TYPES = [
  { value: "post", label: "Facebook Post" },
  { value: "reel", label: "Facebook Reel" },
  { value: "video", label: "Facebook Video" },
];

const FLOW_TYPES = [
  { value: "text", label: "文字", icon: FileText },
  { value: "image", label: "图片", icon: Image },
  { value: "video", label: "视频", icon: Video },
  { value: "product_intro", label: "商品介绍", icon: Package },
  { value: "button", label: "商品按钮", icon: MousePointerClick },
];

export default function Campaigns() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("campaigns");

  const { data: campaigns, isLoading, refetch } = trpc.campaigns.list.useQuery({});
  const utils = trpc.useUtils();

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    if (!searchQuery) return campaigns;
    const q = searchQuery.toLowerCase();
    return campaigns.filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.type?.toLowerCase().includes(q) ||
      c.facebookLink?.toLowerCase().includes(q)
    );
  }, [campaigns, searchQuery]);

  const handleCreate = () => {
    setEditingCampaign(null);
    setShowEditDialog(true);
  };

  const handleEdit = (campaign: any) => {
    setEditingCampaign(campaign);
    setShowEditDialog(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除此 Campaign 吗？相关的 Flow 和 Button 也会被删除。")) return;
    try {
      await utils.client.campaigns.delete.mutate({ id });
      toast.success("Campaign 已删除");
      refetch();
    } catch (err: any) {
      toast.error("删除失败: " + err.message);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await utils.client.campaigns.duplicate.mutate({ id });
      toast.success("Campaign 已复制");
      refetch();
    } catch (err: any) {
      toast.error("复制失败: " + err.message);
    }
  };

  const handleStatusChange = async (campaign: any, newStatus: "draft" | "active" | "ended" | "archived") => {
    try {
      await utils.client.campaigns.update.mutate({ id: campaign.id, status: newStatus });
      toast.success(`状态已更新为: ${newStatus}`);
      refetch();
    } catch (err: any) {
      toast.error("更新失败: " + err.message);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Facebook Campaign</h1>
          <Badge variant="secondary">V2.0.21</Badge>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新建 Campaign
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索 Campaign 名称、类型、链接..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Campaign List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>暂无 Campaign，点击「新建 Campaign」创建第一个</p>
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
  const statusColors: Record<string, string> = {
    draft: "bg-gray-500",
    active: "bg-green-500",
    ended: "bg-orange-500",
    archived: "bg-gray-400",
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
                {campaign.status}
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
                {campaign.contentIdCount || 0} 个内容绑定
              </span>
              <span>建单: {campaign.stats?.autoOrderCount || 0}</span>
              <span>合并: {campaign.stats?.mergedOrderCount || 0}</span>
              <span>销量: {campaign.stats?.totalQuantity || 0}</span>
              <span>营业额: RM{campaign.stats?.totalRevenue || "0"}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {campaign.status === "draft" && (
              <Button size="sm" variant="outline" onClick={() => onStatusChange("active")}>
                <Play className="h-3 w-3 mr-1" /> 启动
              </Button>
            )}
            {campaign.status === "active" && (
              <Button size="sm" variant="outline" onClick={() => onStatusChange("ended")}>
                <Pause className="h-3 w-3 mr-1" /> 结束
              </Button>
            )}
            {campaign.status !== "archived" && (
              <Button size="sm" variant="ghost" onClick={() => onStatusChange("archived")}>
                <Archive className="h-3 w-3" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDuplicate}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Campaign Edit Dialog (with Tabs: Settings + Flows + Buttons) ---
function CampaignEditDialog({ campaign, onClose, onSaved }: {
  campaign: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(campaign?.name || "");
  const [facebookLink, setFacebookLink] = useState(campaign?.facebookLink || "");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(campaign?.autoReplyEnabled ?? true);
  const [autoReplyText, setAutoReplyText] = useState(campaign?.autoReplyText || "");
  const [messengerFlowEnabled, setMessengerFlowEnabled] = useState(campaign?.messengerFlowEnabled ?? true);
  const [activeTab, setActiveTab] = useState("settings");

  // Auto-parse preview from Facebook Link
  const parsedPreview = useMemo(() => {
    if (!facebookLink) return null;
    try {
      const url = new URL(facebookLink);
      const pathParts = url.pathname.split("/").filter(Boolean);
      let contentType: string = "post";
      let postId: string | null = null;
      let videoId: string | null = null;
      let pageId: string | null = pathParts[0] || null;
      const postsIdx = pathParts.indexOf("posts");
      if (postsIdx >= 0 && pathParts[postsIdx + 1]) { postId = pathParts[postsIdx + 1]; contentType = "post"; }
      const videosIdx = pathParts.indexOf("videos");
      if (videosIdx >= 0 && pathParts[videosIdx + 1]) { videoId = pathParts[videosIdx + 1]; contentType = "video"; }
      const reelIdx = pathParts.indexOf("reel");
      if (reelIdx >= 0 && pathParts[reelIdx + 1]) { videoId = pathParts[reelIdx + 1]; contentType = "reel"; }
      const shareIdx = pathParts.indexOf("share");
      if (shareIdx >= 0 && pathParts[shareIdx + 1] === "v" && pathParts[shareIdx + 2]) { videoId = pathParts[shareIdx + 2]; contentType = "reel"; }
      if (url.hostname === "fb.watch") { videoId = pathParts[0] || null; contentType = "video"; }
      const storyFbid = url.searchParams.get("story_fbid");
      if (storyFbid) { postId = storyFbid; contentType = "post"; }
      const pageIdParam = url.searchParams.get("id");
      if (pageIdParam) pageId = pageIdParam;
      return { contentType, postId, videoId, pageId };
    } catch { return null; }
  }, [facebookLink]);

  const utils = trpc.useUtils();
  const createMutation = trpc.campaigns.create.useMutation();
  const updateMutation = trpc.campaigns.update.useMutation();

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("请输入 Campaign 名称");
      return;
    }
    try {
      if (campaign) {
        await updateMutation.mutateAsync({
          id: campaign.id,
          name,
          facebookLink,
          autoReplyEnabled,
          autoReplyText,
          messengerFlowEnabled,
        });
        toast.success("Campaign 已更新");
      } else {
        await createMutation.mutateAsync({
          name,
          facebookLink,
          autoReplyEnabled,
          autoReplyText,
          messengerFlowEnabled,
        });
        toast.success("Campaign 已创建");
      }
      onSaved();
    } catch (err: any) {
      toast.error("保存失败: " + err.message);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{campaign ? "编辑 Campaign" : "新建 Campaign"}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings">基本设置</TabsTrigger>
            <TabsTrigger value="contentIds" disabled={!campaign}>内容绑定</TabsTrigger>
            <TabsTrigger value="flows" disabled={!campaign}>Messenger Flow</TabsTrigger>
            <TabsTrigger value="buttons" disabled={!campaign}>Product Button</TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 overflow-y-auto">
            <div className="space-y-4 p-2">
              <div>
                <Label>Campaign 名称</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 8月新品发布" />
              </div>
              <div>
                <Label>Facebook 链接</Label>
                <Input value={facebookLink} onChange={(e) => setFacebookLink(e.target.value)} placeholder="贴上 Facebook Post / Reel / Video 链接，系统自动识别" />
                {parsedPreview && (
                  <div className="mt-2 p-3 bg-muted/50 rounded-md space-y-1 text-sm">
                    <p className="font-medium text-muted-foreground">系统自动解析结果：</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">类型: {parsedPreview.contentType}</Badge>
                      {parsedPreview.postId && <Badge variant="outline">Post ID: {parsedPreview.postId.substring(0, 20)}{parsedPreview.postId.length > 20 ? "..." : ""}</Badge>}
                      {parsedPreview.videoId && <Badge variant="outline">Video ID: {parsedPreview.videoId.substring(0, 20)}{parsedPreview.videoId.length > 20 ? "..." : ""}</Badge>}
                      {parsedPreview.pageId && <Badge variant="outline">Page: {parsedPreview.pageId}</Badge>}
                    </div>
                  </div>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>自动回复留言</Label>
                  <p className="text-xs text-muted-foreground">当客户留言无匹配关键词时自动回复</p>
                </div>
                <Switch checked={autoReplyEnabled} onCheckedChange={setAutoReplyEnabled} />
              </div>
              {autoReplyEnabled && (
                <div>
                  <Label>自动回复内容</Label>
                  <Textarea value={autoReplyText} onChange={(e) => setAutoReplyText(e.target.value)}
                    placeholder="例: 感谢您的留言！请输入商品关键词+数量下单，如 MON+1。如有疑问请联系客服。" rows={3} />
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Messenger Flow</Label>
                  <p className="text-xs text-muted-foreground">无关键词匹配时发送 Messenger Flow</p>
                </div>
                <Switch checked={messengerFlowEnabled} onCheckedChange={setMessengerFlowEnabled} />
              </div>
            </div>
          </TabsContent>

          {/* Content IDs Tab */}
          {campaign && (
            <TabsContent value="contentIds" className="flex-1 overflow-y-auto">
              <ContentIdManager campaignId={campaign.id} />
            </TabsContent>
          )}

          {/* Flows Tab */}
          {campaign && (
            <TabsContent value="flows" className="flex-1 overflow-hidden">
              <FlowBuilder campaignId={campaign.id} />
            </TabsContent>
          )}

          {/* Buttons Tab */}
          {campaign && (
            <TabsContent value="buttons" className="flex-1 overflow-hidden">
              <ButtonManager campaignId={campaign.id} />
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Flow Builder ---
// --- Content ID Manager ---
function ContentIdManager({ campaignId }: { campaignId: number }) {
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
    if (!newLink.trim()) { toast.error("请输入 Facebook 链接"); return; }
    try {
      await addMutation.mutateAsync({ campaignId, facebookLink: newLink });
      toast.success("内容已绑定");
    } catch (err: any) {
      toast.error("绑定失败: " + err.message);
    }
  };

  return (
    <div className="space-y-4 p-2">
      <div>
        <Label>添加 Facebook 内容链接</Label>
        <p className="text-xs text-muted-foreground mb-2">贴上 Facebook Post / Reel / Video 链接，系统自动识别类型和 ID。一个 Campaign 可绑定多个内容。</p>
        <div className="flex gap-2">
          <Input
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder="https://www.facebook.com/..."
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending}>
            {addMutation.isPending ? "添加中..." : "添加"}
          </Button>
        </div>
      </div>
      <Separator />
      <div>
        <Label>已绑定的 Facebook 内容</Label>
        {loading ? (
          <p className="text-sm text-muted-foreground p-4">加载中...</p>
        ) : contentIds.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">尚未绑定任何 Facebook 内容。请在上方添加链接。</p>
        ) : (
          <div className="space-y-2">
            {contentIds.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{item.contentType}</Badge>
                  <span className="text-sm font-mono">{item.contentId}</span>
                  {item.facebookLink && (
                    <a href={item.facebookLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">打开链接</a>
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

function FlowBuilder({ campaignId }: { campaignId: number }) {
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
      toast.success("Flow 步骤已添加");
      refetch();
      setShowAddFlow(false);
    } catch (err: any) {
      toast.error("添加失败: " + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此 Flow 步骤？")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("已删除");
      refetch();
    } catch (err: any) {
      toast.error("删除失败: " + err.message);
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
      toast.error("排序失败: " + err.message);
    }
  };

  return (
    <div className="space-y-3 p-2 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Messenger Flow 步骤</h3>
        <Button size="sm" onClick={() => setShowAddFlow(!showAddFlow)}>
          <Plus className="h-3 w-3 mr-1" /> 添加步骤
        </Button>
      </div>

      {showAddFlow && (
        <AddFlowForm onAdd={handleAdd} onCancel={() => setShowAddFlow(false)} />
      )}

      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {(!flows || flows.length === 0) ? (
            <p className="text-center text-muted-foreground py-8">暂无 Flow 步骤，点击「添加步骤」创建</p>
          ) : (
            flows.map((flow: any, idx: number) => {
              const FlowIcon = FLOW_TYPES.find(t => t.value === flow.type)?.icon || FileText;
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
                        <Badge variant="outline" className="text-xs">{flow.type}</Badge>
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
  const [type, setType] = useState("text");
  const [text, setText] = useState("");

  return (
    <Card className="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>类型</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FLOW_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {(type === "text" || type === "product_intro" || type === "button") && (
        <div>
          <Label>内容</Label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
            placeholder={type === "product_intro" ? "商品介绍文字..." : type === "button" ? "按钮上方文字..." : "输入文字内容..."} />
        </div>
      )}
      {(type === "image" || type === "video" || type === "audio" || type === "file") && (
        <div>
          <Label>媒体 URL</Label>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="https://..." />
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}>取消</Button>
        <Button size="sm" onClick={() => onAdd(type, text)}>添加</Button>
      </div>
    </Card>
  );
}

// --- Button Manager ---
function ButtonManager({ campaignId }: { campaignId: number }) {
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
      toast.success("按钮已添加");
      refetch();
      setShowAddButton(false);
    } catch (err: any) {
      toast.error("添加失败: " + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此按钮？")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("已删除");
      refetch();
    } catch (err: any) {
      toast.error("删除失败: " + err.message);
    }
  };

  const handleToggle = async (btn: any) => {
    try {
      await updateMutation.mutateAsync({ id: btn.id, isActive: !btn.isActive });
      refetch();
    } catch (err: any) {
      toast.error("更新失败: " + err.message);
    }
  };

  return (
    <div className="space-y-3 p-2 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Product Button</h3>
        <Button size="sm" onClick={() => setShowAddButton(!showAddButton)}>
          <Plus className="h-3 w-3 mr-1" /> 添加按钮
        </Button>
      </div>

      {showAddButton && (
        <AddButtonForm products={products} onAdd={handleAdd} onCancel={() => setShowAddButton(false)} />
      )}

      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {(!buttons || buttons.length === 0) ? (
            <p className="text-center text-muted-foreground py-8">暂无按钮，点击「添加按钮」创建</p>
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
                          {product?.name || `Product #${btn.productId}`} · 数量: {btn.quantity}
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
  const [name, setName] = useState("");
  const [productId, setProductId] = useState<number>(0);
  const [quantity, setQuantity] = useState(1);

  return (
    <Card className="p-3 space-y-3">
      <div>
        <Label>按钮名称</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 立即购买 MON" />
      </div>
      <div>
        <Label>绑定商品</Label>
        <Select value={String(productId)} onValueChange={(v) => setProductId(Number(v))}>
          <SelectTrigger><SelectValue placeholder="选择商品" /></SelectTrigger>
          <SelectContent>
            {products.map((p: any) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.sku || p.keyword || "无SKU"})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>数量</Label>
        <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}>取消</Button>
        <Button size="sm" onClick={() => onAdd({ name, productId, quantity })} disabled={!name || !productId}>
          添加
        </Button>
      </div>
    </Card>
  );
}
