import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Eye, GitMerge, AlertTriangle, Pencil, Plus } from "lucide-react";

const MEMBERSHIP_LABELS: Record<string, string> = { regular: "普通", member: "会员", vip: "VIP" };
const PHYSICAL_STATUS_LABELS: Record<string, string> = {
  pending: "挂单", receipt_uploaded: "已上传收据", partial_payment: "部分付款",
  hold_order: "保留订单", packing: "待包货", shipped: "已发货",
  partial_shipped: "部分发货", completed: "已完成", cancelled: "已取消",
};

export default function Customers() {
  const [search, setSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<any>({ name: "", phoneNumber: "", email: "", address: "" });
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const utils = trpc.useUtils();

  const { data: customers, isLoading } = trpc.customers.list.useQuery({
    search: search || undefined,
  });

  const { data: mergeSuggestions } = trpc.customers.getMergeSuggestions.useQuery({ status: "pending" });

  const { data: duplicatesData } = trpc.customers.findDuplicates.useQuery(
    { customerId: detailCustomer?.id ?? 0 },
    { enabled: !!detailCustomer }
  );

  const { data: customerOrders } = trpc.customers.getOrders.useQuery(
    { customerId: detailCustomer?.id ?? 0 },
    { enabled: !!detailCustomer }
  );

  useEffect(() => {
    setDuplicates(duplicatesData ?? []);
  }, [duplicatesData]);

  const mergeMutation = trpc.customers.merge.useMutation({
    onSuccess: () => {
      utils.customers.invalidate();
      toast.success("客户档案已合并");
      setDetailOpen(false);
    },
    onError: (e) => toast.error(`合并失败: ${e.message}`),
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      utils.customers.invalidate();
      toast.success("客户资料已更新");
      setEditOpen(false);
    },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const findOrCreateMutation = trpc.customers.findOrCreate.useMutation({
    onSuccess: () => {
      utils.customers.invalidate();
      toast.success("客户已建立");
      setCreateOpen(false);
      setNewCustomer({ name: "", phoneNumber: "", email: "", address: "" });
    },
    onError: (e) => toast.error(`建立失败: ${e.message}`),
  });

  function openDetail(customer: any) {
    setDuplicates([]);
    setDetailCustomer(customer);
    setDetailOpen(true);
  }

  function openEdit(customer: any) {
    setEditData({
      id: customer.id,
      name: customer.name || "",
      phoneNumber: customer.phoneNumber || "",
      email: customer.email || "",
      address: customer.address || "",
      city: customer.city || "",
      state: customer.state || "",
      postalCode: customer.postalCode || "",
      notes: customer.notes || "",
      membershipLevel: customer.membershipLevel || "regular",
      isBlacklisted: customer.isBlacklisted || false,
      blacklistReason: customer.blacklistReason || "",
    });
    setEditOpen(true);
  }

  function submitEdit() {
    updateMutation.mutate(editData);
  }

  function submitCreate() {
    if (!newCustomer.name?.trim()) {
      toast.error("请输入客户姓名");
      return;
    }
    findOrCreateMutation.mutate(newCustomer);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">客户管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            统一客户档案，支持多维度身份识别与合并
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增客户
        </Button>
      </div>

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

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索客户名称、电话、Facebook..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>客户姓名</TableHead>
                <TableHead>Facebook 名称</TableHead>
                <TableHead>电话号码</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>订单数</TableHead>
                <TableHead>消费总额</TableHead>
                <TableHead>会员等级</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : customers?.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">暂无客户</TableCell></TableRow>
              ) : customers?.filter(c => !c.mergedIntoCustomerId).map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name || "-"}</TableCell>
                  <TableCell>{c.facebookName || "-"}</TableCell>
                  <TableCell className="text-sm">{c.phoneNumber || "-"}</TableCell>
                  <TableCell className="text-sm">{c.email || "-"}</TableCell>
                  <TableCell>{c.totalOrders}</TableCell>
                  <TableCell>RM {c.totalSpent}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {MEMBERSHIP_LABELS[c.membershipLevel ?? ""] || c.membershipLevel || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.isBlacklisted ? (
                      <Badge variant="destructive">黑名单</Badge>
                    ) : (
                      <Badge variant="default">正常</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(c)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Customer detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>客户详情</DialogTitle>
          </DialogHeader>
          {detailCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-lg">
                <div>
                  <p className="text-muted-foreground">姓名</p>
                  <p className="font-medium">{detailCustomer.name || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Facebook 名称</p>
                  <p className="font-medium">{detailCustomer.facebookName || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Facebook ID</p>
                  <p className="font-mono text-xs">{detailCustomer.facebookId || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Messenger ID</p>
                  <p className="font-mono text-xs">{detailCustomer.messengerId || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">电话号码</p>
                  <p className="font-medium">{detailCustomer.phoneNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{detailCustomer.email || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">地址</p>
                  <p className="font-medium">{detailCustomer.address || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">订单总数</p>
                  <p className="font-medium">{detailCustomer.totalOrders}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">消费总额</p>
                  <p className="font-bold">RM {detailCustomer.totalSpent}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">会员等级</p>
                  <Badge variant="outline">
                    {MEMBERSHIP_LABELS[detailCustomer.membershipLevel ?? ""] || detailCustomer.membershipLevel || "-"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">积分余额</p>
                  <p className="font-medium">{detailCustomer.pointsBalance}</p>
                </div>
              </div>

              {/* Customer notes */}
              {detailCustomer.notes && (
                <div className="p-4 border rounded-lg bg-muted/30">
                  <p className="text-sm font-medium mb-1">客户备注</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailCustomer.notes}</p>
                </div>
              )}

              {/* Order history */}
              <div>
                <p className="text-sm font-medium mb-2">历史订单</p>
                {customerOrders && customerOrders.length > 0 ? (
                  <div className="space-y-2">
                    {customerOrders.map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                        <div>
                          <p className="font-medium">{o.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(o.createdAt).toLocaleDateString()} · {PHYSICAL_STATUS_LABELS[o.physicalStatus] || o.physicalStatus}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">RM {o.totalAmount}</p>
                          {o.trackingNumber && (
                            <p className="text-xs text-muted-foreground">Tracking: {o.trackingNumber}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无订单记录</p>
                )}
              </div>

              {/* Duplicates section */}
              {duplicates.length > 0 && (
                <div className="p-4 border border-orange-200 rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <p className="font-medium text-sm">发现疑似相同客户，是否合并？</p>
                  </div>
                  <div className="space-y-2">
                    {duplicates.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-lg border">
                        <div className="text-sm">
                          <p className="font-medium">{d.name || d.facebookName || `客户 #${d.id}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.phoneNumber && `电话: ${d.phoneNumber} | `}
                            {d.facebookId && `FB ID: ${d.facebookId} | `}
                            {d.messengerId && `Messenger: ${d.messengerId}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => mergeMutation.mutate({
                            sourceId: d.id,
                            targetId: detailCustomer.id,
                          })}
                        >
                          <GitMerge className="h-4 w-4 mr-2" />
                          合并到此客户
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { setDetailOpen(false); openEdit(detailCustomer); }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  编辑客户
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑客户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>姓名</Label>
                <Input value={editData.name || ""} onChange={e => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div>
                <Label>电话号码</Label>
                <Input value={editData.phoneNumber || ""} onChange={e => setEditData({ ...editData, phoneNumber: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={editData.email || ""} onChange={e => setEditData({ ...editData, email: e.target.value })} />
              </div>
              <div>
                <Label>城市</Label>
                <Input value={editData.city || ""} onChange={e => setEditData({ ...editData, city: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>地址</Label>
                <Input value={editData.address || ""} onChange={e => setEditData({ ...editData, address: e.target.value })} />
              </div>
              <div>
                <Label>州属</Label>
                <Input value={editData.state || ""} onChange={e => setEditData({ ...editData, state: e.target.value })} />
              </div>
              <div>
                <Label>邮编</Label>
                <Input value={editData.postalCode || ""} onChange={e => setEditData({ ...editData, postalCode: e.target.value })} />
              </div>
              <div>
                <Label>会员等级</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={editData.membershipLevel || "regular"}
                  onChange={e => setEditData({ ...editData, membershipLevel: e.target.value })}
                >
                  <option value="regular">普通</option>
                  <option value="member">会员</option>
                  <option value="vip">VIP</option>
                </select>
              </div>
              <div>
                <Label>黑名单</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={editData.isBlacklisted ? "yes" : "no"}
                  onChange={e => setEditData({ ...editData, isBlacklisted: e.target.value === "yes" })}
                >
                  <option value="no">否</option>
                  <option value="yes">是</option>
                </select>
              </div>
              {editData.isBlacklisted && (
                <div className="col-span-2">
                  <Label>黑名单原因</Label>
                  <Input value={editData.blacklistReason || ""} onChange={e => setEditData({ ...editData, blacklistReason: e.target.value })} />
                </div>
              )}
              <div className="col-span-2">
                <Label>客户备注</Label>
                <Textarea
                  rows={3}
                  placeholder="内部备注，仅后台可见..."
                  value={editData.notes || ""}
                  onChange={e => setEditData({ ...editData, notes: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={submitEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增客户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>姓名 *</Label>
              <Input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} />
            </div>
            <div>
              <Label>电话号码</Label>
              <Input value={newCustomer.phoneNumber} onChange={e => setNewCustomer({ ...newCustomer, phoneNumber: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
            </div>
            <div>
              <Label>地址</Label>
              <Input value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={submitCreate} disabled={findOrCreateMutation.isPending}>
              {findOrCreateMutation.isPending ? "建立中..." : "建立客户"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
