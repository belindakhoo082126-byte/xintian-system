import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, Eye, GitMerge, AlertTriangle, Plus, MapPin, CreditCard,
  Ban, CheckCircle, Clock, Package, DollarSign, Bell, FileText,
  User, Phone, Mail, Facebook, MessageSquare, ShoppingCart, TrendingUp
} from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  facebook_live: "FB Live",
  facebook_messenger: "Messenger",
  whatsapp: "WhatsApp",
  store: "商城",
  admin: "后台",
};

const TIMELINE_ICONS: Record<string, any> = {
  order_created: ShoppingCart,
  order_shipped: Package,
  order_completed: CheckCircle,
  order_cancelled: Ban,
  payment_received: DollarSign,
  refund_issued: CreditCard,
  credit_topup: TrendingUp,
  credit_deduction: TrendingUp,
  blacklist_added: Ban,
  blacklist_removed: CheckCircle,
  address_added: MapPin,
  address_updated: MapPin,
  profile_updated: User,
  notification_sent: Bell,
  notification_failed: AlertTriangle,
  live_comment: MessageSquare,
  other: Clock,
};

export default function CustomersV2() {
  const [search, setSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCustomerId, setDetailCustomerId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [addressForm, setAddressForm] = useState<any>({});
  const [creditForm, setCreditForm] = useState<any>({ amount: "", type: "topup", reason: "" });
  const [blacklistReason, setBlacklistReason] = useState("");
  const utils = trpc.useUtils();

  // Use enhanced search when search term is provided
  const { data: searchResults } = trpc.customersV2.search.useQuery(
    { term: search },
    { enabled: search.length > 0 }
  );

  // Fallback to regular list when no search
  const { data: allCustomers, isLoading } = trpc.customers.list.useQuery(
    { search: search || undefined },
    { enabled: search.length === 0 }
  );

  const displayCustomers = search.length > 0 ? searchResults : allCustomers;

  // Customer detail
  const { data: detail } = trpc.customersV2.getDetail.useQuery(
    { id: detailCustomerId! },
    { enabled: detailCustomerId !== null }
  );

  // Enhanced duplicates
  const { data: enhancedDuplicates } = trpc.customersV2.findEnhancedDuplicates.useQuery(
    { customerId: detailCustomerId! },
    { enabled: detailCustomerId !== null }
  );

  const { data: mergeSuggestions } = trpc.customers.getMergeSuggestions.useQuery({ status: "pending" });

  // Mutations
  const updateMutation = trpc.customersV2.updateWithAudit.useMutation({
    onSuccess: () => {
      utils.customersV2.invalidate();
      utils.customers.invalidate();
      toast.success("客户资料已更新");
      setEditOpen(false);
    },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const blacklistMutation = trpc.customersV2.setBlacklist.useMutation({
    onSuccess: () => {
      utils.customersV2.invalidate();
      utils.customers.invalidate();
      toast.success("黑名单状态已更新");
      setBlacklistOpen(false);
      setBlacklistReason("");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const addressMutation = trpc.customerAddresses.create.useMutation({
    onSuccess: () => {
      utils.customerAddresses.invalidate();
      utils.customersV2.invalidate();
      toast.success("地址已添加");
      setAddressOpen(false);
      setAddressForm({});
    },
    onError: (e) => toast.error(`添加失败: ${e.message}`),
  });

  const deleteAddressMutation = trpc.customerAddresses.delete.useMutation({
    onSuccess: () => {
      utils.customerAddresses.invalidate();
      utils.customersV2.invalidate();
      toast.success("地址已删除");
    },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
  });

  const setDefaultAddressMutation = trpc.customerAddresses.update.useMutation({
    onSuccess: () => {
      utils.customerAddresses.invalidate();
      utils.customersV2.invalidate();
      toast.success("默认地址已更新");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const creditMutation = trpc.customerCredit.add.useMutation({
    onSuccess: () => {
      utils.customerCredit.invalidate();
      utils.customersV2.invalidate();
      toast.success("Credit 已更新");
      setCreditOpen(false);
      setCreditForm({ amount: "", type: "topup", reason: "" });
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const mergeMutation = trpc.customers.merge.useMutation({
    onSuccess: () => {
      utils.customers.invalidate();
      utils.customersV2.invalidate();
      toast.success("客户档案已合并");
    },
    onError: (e) => toast.error(`合并失败: ${e.message}`),
  });

  function openDetail(id: number) {
    setDetailCustomerId(id);
    setDetailOpen(true);
  }

  function openEdit() {
    if (!detail) return;
    setEditForm({
      displayName: detail.displayName || "",
      phoneNumber: detail.phoneNumber || "",
      whatsappPhone: detail.whatsappPhone || "",
      email: detail.email || "",
      facebookName: detail.facebookName || "",
      name: detail.name || "",
      membershipLevel: detail.membershipLevel || "regular",
    });
    setEditOpen(true);
  }

  function getAvatarUrl(c: any): string | null {
    return c.overrideAvatarUrl || c.avatarUrl || null;
  }

  function getDisplayName(c: any): string {
    return c.displayName || c.facebookName || c.name || `客户 ${c.customerId || c.id}`;
  }

  function initials(name: string): string {
    return name?.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase() || "?";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">客户管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          统一客户档案 · 全局搜索 · 时间轴 · Credit · 地址管理
        </p>
      </div>

      {/* Merge suggestions alert */}
      {mergeSuggestions && mergeSuggestions.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">发现 {mergeSuggestions.length} 个疑似重复客户待确认</p>
              <p className="text-xs text-muted-foreground">请检查并确认是否需要合并客户档案</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Global search */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索 Customer ID、名称、电话、FB ID、Messenger、WhatsApp、Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Customer list */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Customer ID</TableHead>
                <TableHead>显示名称</TableHead>
                <TableHead>Facebook 名称</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>电话</TableHead>
                <TableHead>订单数</TableHead>
                <TableHead>累计消费</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : !displayCustomers || displayCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    {search.length > 0 ? (
                      <div className="space-y-2">
                        <p>未找到匹配客户</p>
                        <Button size="sm" variant="outline">
                          <Plus className="h-4 w-4 mr-2" />新增客户
                        </Button>
                      </div>
                    ) : "暂无客户"}
                  </TableCell>
                </TableRow>
              ) : displayCustomers.filter((c: any) => !c.mergedIntoCustomerId).map((c: any) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(c.id)}>
                  <TableCell>
                    {getAvatarUrl(c) ? (
                      <img src={getAvatarUrl(c) || ""} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-xs">{initials(getDisplayName(c))}</AvatarFallback>
                      </Avatar>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{c.customerId || `#${c.id}`}</TableCell>
                  <TableCell className="font-medium">{getDisplayName(c)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.facebookName || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {SOURCE_LABELS[c.customerSource] || c.customerSource || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{c.phoneNumber || c.whatsappPhone || "-"}</TableCell>
                  <TableCell>{c.totalOrders || 0}</TableCell>
                  <TableCell className="font-medium">RM {Number(c.totalSpent || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    {c.isBlacklisted ? (
                      <Badge variant="destructive" className="gap-1">
                        <Ban className="h-3 w-3" />黑名单
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="h-3 w-3" />正常
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDetail(c.id); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Customer detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {detail && getAvatarUrl(detail) && (
                <img src={getAvatarUrl(detail) || ""} alt="" className="h-12 w-12 rounded-full object-cover" />
              )}
              {detail && getDisplayName(detail)}
              {detail?.customerId && (
                <Badge variant="outline" className="font-mono">{detail.customerId}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              {/* Quick Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={openEdit}>
                  <User className="h-4 w-4 mr-1" />编辑资料
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBlacklistOpen(true)}>
                  <Ban className="h-4 w-4 mr-1" />{detail.isBlacklisted ? "解除黑名单" : "加入黑名单"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAddressOpen(true)}>
                  <MapPin className="h-4 w-4 mr-1" />新增地址
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCreditOpen(true)}>
                  <CreditCard className="h-4 w-4 mr-1" />Credit 操作
                </Button>
              </div>

              {/* Stats Cards */}
              {detail.stats && (
                <div className="grid grid-cols-4 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">累计消费</p>
                    <p className="text-lg font-bold">RM {Number(detail.stats.totalSpent).toFixed(2)}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">下单次数</p>
                    <p className="text-lg font-bold">{detail.stats.totalOrders}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">完成/取消</p>
                    <p className="text-lg font-bold">{detail.stats.completedOrders}/{detail.stats.cancelledOrders}</p>
                    <p className="text-xs text-muted-foreground">取消率 {detail.stats.cancelRate}%</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">平均订单</p>
                    <p className="text-lg font-bold">RM {detail.stats.avgOrderAmount}</p>
                    <p className="text-xs text-muted-foreground">{detail.stats.totalItems} 件商品</p>
                  </Card>
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-3 gap-3 text-sm p-4 border rounded-lg">
                <div>
                  <p className="text-muted-foreground flex items-center gap-1"><Facebook className="h-3 w-3" />Facebook Name</p>
                  <p className="font-medium">{detail.facebookName || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" />Messenger ID</p>
                  <p className="font-mono text-xs">{detail.messengerId || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />电话</p>
                  <p className="font-medium">{detail.phoneNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" />WhatsApp</p>
                  <p className="font-medium">{detail.whatsappPhone || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />Email</p>
                  <p className="font-medium">{detail.email || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">来源</p>
                  <Badge variant="outline">{SOURCE_LABELS[detail.customerSource] || detail.customerSource}</Badge>
                </div>
              </div>

              {/* Blacklist info */}
              {detail.isBlacklisted && (
                <div className="p-3 border border-red-200 rounded-lg bg-red-50/50 dark:bg-red-950/20">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">黑名单状态</p>
                  <p className="text-sm text-muted-foreground">原因: {detail.blacklistReason || "未提供"}</p>
                  {detail.blacklistAt && (
                    <p className="text-xs text-muted-foreground">加入时间: {new Date(detail.blacklistAt).toLocaleString()}</p>
                  )}
                </div>
              )}

              {/* Tabs: Timeline, Orders, Addresses, Credit, Refunds, Audit */}
              <Tabs defaultValue="timeline">
                <TabsList className="grid grid-cols-6">
                  <TabsTrigger value="timeline">时间轴</TabsTrigger>
                  <TabsTrigger value="addresses">地址</TabsTrigger>
                  <TabsTrigger value="credit">Credit</TabsTrigger>
                  <TabsTrigger value="refunds">退款</TabsTrigger>
                  <TabsTrigger value="audit">审计</TabsTrigger>
                  <TabsTrigger value="duplicates">重复</TabsTrigger>
                </TabsList>

                {/* Timeline Tab */}
                <TabsContent value="timeline" className="space-y-2 max-h-[300px] overflow-y-auto">
                  {detail.timeline?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">暂无时间轴事件</p>
                  ) : detail.timeline?.map((event: any) => {
                    const Icon = TIMELINE_ICONS[event.eventType] || Clock;
                    return (
                      <div key={event.id} className="flex gap-3 p-3 border rounded-lg">
                        <div className="shrink-0 mt-0.5">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{event.title}</p>
                          {event.description && <p className="text-xs text-muted-foreground">{event.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(event.eventDate).toLocaleString()}
                            {event.operatorName && ` · ${event.operatorName}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>

                {/* Addresses Tab */}
                <TabsContent value="addresses" className="space-y-2 max-h-[300px] overflow-y-auto">
                  {detail.addresses?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">暂无收件地址</p>
                  ) : detail.addresses?.map((addr: any) => (
                    <div key={addr.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{addr.label}</span>
                          {addr.isDefault && <Badge variant="default" className="text-xs">默认</Badge>}
                        </div>
                        <div className="flex gap-1">
                          {!addr.isDefault && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => setDefaultAddressMutation.mutate({ id: addr.id, isDefault: true })}>
                              设为默认
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600"
                            onClick={() => deleteAddressMutation.mutate({ id: addr.id })}>
                            删除
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm mt-1">{addr.recipientName} · {addr.recipientPhone}</p>
                      <p className="text-sm text-muted-foreground">{addr.address}</p>
                      <p className="text-xs text-muted-foreground">
                        {[addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  ))}
                </TabsContent>

                {/* Credit Tab */}
                <TabsContent value="credit" className="space-y-2 max-h-[300px] overflow-y-auto">
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <span className="text-sm font-medium">目前余额</span>
                    <span className="text-lg font-bold">RM {Number(detail.creditBalance || 0).toFixed(2)}</span>
                  </div>
                  {detail.creditLedger?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">暂无 Credit 纪录</p>
                  ) : detail.creditLedger?.map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">
                          {Number(entry.amount) >= 0 ? "+" : ""}RM {Number(entry.amount).toFixed(2)}
                          <span className="ml-2 text-xs text-muted-foreground">{entry.type}</span>
                        </p>
                        {entry.reason && <p className="text-xs text-muted-foreground">{entry.reason}</p>}
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                          {entry.operatorName && ` · ${entry.operatorName}`}
                        </p>
                      </div>
                      <span className="text-sm font-medium">余额: RM {Number(entry.balanceAfter).toFixed(2)}</span>
                    </div>
                  ))}
                </TabsContent>

                {/* Refunds Tab */}
                <TabsContent value="refunds" className="space-y-2 max-h-[300px] overflow-y-auto">
                  {detail.refunds?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">暂无退款纪录</p>
                  ) : detail.refunds?.map((refund: any) => (
                    <div key={refund.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">RM {Number(refund.amount).toFixed(2)}</span>
                        <Badge variant="outline" className="text-xs">{refund.refundMethod}</Badge>
                      </div>
                      {refund.reason && <p className="text-xs text-muted-foreground mt-1">{refund.reason}</p>}
                      <p className="text-xs text-muted-foreground">
                        {new Date(refund.refundDate).toLocaleString()}
                        {refund.operatorName && ` · ${refund.operatorName}`}
                      </p>
                    </div>
                  ))}
                </TabsContent>

                {/* Audit Tab */}
                <TabsContent value="audit" className="space-y-2 max-h-[300px] overflow-y-auto">
                  {detail.auditLogs?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">暂无审计日志</p>
                  ) : detail.auditLogs?.map((log: any) => (
                    <div key={log.id} className="p-3 border rounded-lg text-sm">
                      <p className="font-medium">{log.action}</p>
                      {log.fieldName && (
                        <p className="text-xs text-muted-foreground">
                          字段: {log.fieldName} · 旧值: {log.oldValue} → 新值: {log.newValue}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                        {log.operatorName && ` · ${log.operatorName}`}
                      </p>
                    </div>
                  ))}
                </TabsContent>

                {/* Duplicates Tab */}
                <TabsContent value="duplicates" className="space-y-2 max-h-[300px] overflow-y-auto">
                  {(!enhancedDuplicates || enhancedDuplicates.length === 0) ? (
                    <p className="text-center text-muted-foreground py-4">未发现疑似重复客户</p>
                  ) : enhancedDuplicates.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between p-3 border border-orange-200 rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                      <div className="text-sm">
                        <p className="font-medium">{d.displayName || d.facebookName || d.name || `#${d.id}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.customerId && `${d.customerId} | `}
                          {d.phoneNumber && `电话: ${d.phoneNumber} | `}
                          {d.whatsappPhone && `WhatsApp: ${d.whatsappPhone} | `}
                          {d.messengerId && `Messenger: ${d.messengerId}`}
                        </p>
                      </div>
                      <Button size="sm" variant="outline"
                        onClick={() => mergeMutation.mutate({ sourceId: d.id, targetId: detail.id })}>
                        <GitMerge className="h-4 w-4 mr-2" />合并
                      </Button>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>编辑客户资料</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Display Name（显示名称）</Label>
              <Input value={editForm.displayName || ""} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} />
            </div>
            <div>
              <Label>Facebook Name</Label>
              <Input value={editForm.facebookName || ""} onChange={(e) => setEditForm({ ...editForm, facebookName: e.target.value })} />
            </div>
            <div>
              <Label>电话号码</Label>
              <Input value={editForm.phoneNumber || ""} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={editForm.whatsappPhone || ""} onChange={(e) => setEditForm({ ...editForm, whatsappPhone: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <Label>会员等级</Label>
              <Select value={editForm.membershipLevel || "regular"} onValueChange={(v) => setEditForm({ ...editForm, membershipLevel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">普通</SelectItem>
                  <SelectItem value="member">会员</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={() => updateMutation.mutate({ id: detailCustomerId!, ...editForm })} disabled={updateMutation.isPending}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blacklist Dialog */}
      <Dialog open={blacklistOpen} onOpenChange={setBlacklistOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{detail?.isBlacklisted ? "解除黑名单" : "加入黑名单"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!detail?.isBlacklisted && (
              <div>
                <Label>黑名单原因</Label>
                <Textarea value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)}
                  placeholder="请输入加入黑名单的原因..." rows={3} />
              </div>
            )}
            {detail?.isBlacklisted && (
              <p className="text-sm text-muted-foreground">确认解除此客户的黑名单状态？</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlacklistOpen(false)}>取消</Button>
            <Button
              variant={detail?.isBlacklisted ? "default" : "destructive"}
              disabled={!detail?.isBlacklisted && !blacklistReason.trim()}
              onClick={() => blacklistMutation.mutate({
                id: detailCustomerId!,
                blacklisted: !detail?.isBlacklisted,
                reason: blacklistReason,
              })}
            >
              {detail?.isBlacklisted ? "解除黑名单" : "加入黑名单"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Address Dialog */}
      <Dialog open={addressOpen} onOpenChange={setAddressOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增收件地址</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>标签（如：家里、公司）</Label>
              <Input value={addressForm.label || ""} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} />
            </div>
            <div>
              <Label>收件人姓名</Label>
              <Input value={addressForm.recipientName || ""} onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })} />
            </div>
            <div>
              <Label>收件人电话</Label>
              <Input value={addressForm.recipientPhone || ""} onChange={(e) => setAddressForm({ ...addressForm, recipientPhone: e.target.value })} />
            </div>
            <div>
              <Label>地址</Label>
              <Textarea value={addressForm.address || ""} onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>城市</Label>
                <Input value={addressForm.city || ""} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} />
              </div>
              <div>
                <Label>州属</Label>
                <Input value={addressForm.state || ""} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>邮编</Label>
                <Input value={addressForm.postalCode || ""} onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })} />
              </div>
              <div>
                <Label>国家</Label>
                <Input value={addressForm.country || "Malaysia"} onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isDefault" checked={addressForm.isDefault || false}
                onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })} />
              <Label htmlFor="isDefault" className="cursor-pointer">设为默认地址</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressOpen(false)}>取消</Button>
            <Button onClick={() => addressMutation.mutate({ customerId: detailCustomerId!, ...addressForm })}
              disabled={addressMutation.isPending || !addressForm.label || !addressForm.recipientName || !addressForm.recipientPhone || !addressForm.address}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Dialog */}
      <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Credit 操作</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>当前余额</Label>
              <p className="text-lg font-bold">RM {Number(detail?.creditBalance || 0).toFixed(2)}</p>
            </div>
            <div>
              <Label>金额（正数=充值，负数=扣除）</Label>
              <Input type="number" value={creditForm.amount} onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
                placeholder="例如: 50 或 -20" />
            </div>
            <div>
              <Label>类型</Label>
              <Select value={creditForm.type} onValueChange={(v) => setCreditForm({ ...creditForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="topup">充值</SelectItem>
                  <SelectItem value="refund">退款入 Credit</SelectItem>
                  <SelectItem value="adjustment">调整</SelectItem>
                  <SelectItem value="order_deduction">订单扣除</SelectItem>
                  <SelectItem value="manual">手动</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>原因</Label>
              <Textarea value={creditForm.reason} onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })}
                placeholder="请输入原因..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditOpen(false)}>取消</Button>
            <Button onClick={() => creditMutation.mutate({
              customerId: detailCustomerId!,
              amount: parseFloat(creditForm.amount),
              type: creditForm.type,
              reason: creditForm.reason,
            })} disabled={creditMutation.isPending || !creditForm.amount}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
