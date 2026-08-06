import { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
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
import { Search, Eye, GitMerge, AlertTriangle, Pencil, Plus, Wallet, History } from "lucide-react";
import { Separator } from "@/components/ui/separator";



export default function Customers() {
  const { translate, lang } = useI18n();

  const MEMBERSHIP_LABELS = useMemo<Record<string, string>>(() => ({
    regular: translate("普通", "Regular"),
    member: translate("会员", "Member"),
    vip: translate("VIP", "VIP"),
  }), [translate]);

  const PHYSICAL_STATUS_LABELS = useMemo<Record<string, string>>(() => ({
    pending: translate("未汇款订单", "Unpaid Order"),
    receipt_uploaded: translate("待审核付款凭证", "Pending Payment Verification"),
    hold_order: translate("保留订单", "Hold Order"),
    packing: translate("待包货", "Pending Packing"),
    shipped: translate("已发货", "Shipped"),
    partial_shipped: translate("部分发货", "Partial Shipped"),
    completed: translate("已完成", "Completed"),
    cancelled: translate("已取消", "Cancelled"),
    }), [translate]);

  const [search, setSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<any>({ name: "", phoneNumber: "", email: "", address: "" });
  const [duplicates, setDuplicates] = useState<any[]>([]);
  // V2.2: Credit management state
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditAction, setCreditAction] = useState<"add" | "deduct" | "adjust">("add");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditHistoryOpen, setCreditHistoryOpen] = useState(false);
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
      toast.success(translate("客户档案已合并", "Customer profiles merged"));
      setDetailOpen(false);
    },
    onError: (e) => toast.error(translate("合并失败: {message}", "Merge failed: {message}", { message: e.message })),
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      utils.customers.invalidate();
      toast.success(translate("客户资料已更新", "Customer information updated"));
      setEditOpen(false);
    },
    onError: (e) => toast.error(translate("更新失败: {message}", "Update failed: {message}", { message: e.message })),
  });

  const findOrCreateMutation = trpc.customers.findOrCreate.useMutation({
    onSuccess: () => {
      utils.customers.invalidate();
      toast.success(translate("客户已建立", "Customer created"));
      setCreateOpen(false);
      setNewCustomer({ name: "", phoneNumber: "", email: "", address: "" });
    },
    onError: (e) => toast.error(translate("建立失败: {message}", "Creation failed: {message}", { message: e.message })),
  });

  // V2.2: Credit management mutations
  const addCreditMutation = trpc.customers.addCredit.useMutation({
    onSuccess: (data) => {
      utils.customers.invalidate();
      toast.success(translate("Credit 已新增，余额: RM {balance}", "Credit added, balance: RM {balance}", { balance: data.newBalance }));
      setCreditDialogOpen(false);
      setCreditAmount("");
      setCreditReason("");
    },
    onError: (e) => toast.error(translate("新增 Credit 失败: {message}", "Add credit failed: {message}", { message: e.message })),
  });

  const deductCreditMutation = trpc.customers.deductCredit.useMutation({
    onSuccess: (data) => {
      utils.customers.invalidate();
      toast.success(translate("Credit 已扣除，余额: RM {balance}", "Credit deducted, balance: RM {balance}", { balance: data.newBalance }));
      setCreditDialogOpen(false);
      setCreditAmount("");
      setCreditReason("");
    },
    onError: (e) => toast.error(translate("扣除 Credit 失败: {message}", "Deduct credit failed: {message}", { message: e.message })),
  });

  const adjustCreditMutation = trpc.customers.adjustCredit.useMutation({
    onSuccess: (data) => {
      utils.customers.invalidate();
      toast.success(translate("Credit 已调整，余额: RM {balance}", "Credit adjusted, balance: RM {balance}", { balance: data.newBalance }));
      setCreditDialogOpen(false);
      setCreditAmount("");
      setCreditReason("");
    },
    onError: (e) => toast.error(translate("调整 Credit 失败: {message}", "Adjust credit failed: {message}", { message: e.message })),
  });

  const { data: creditHistory } = trpc.customers.creditHistory.useQuery(
    { customerId: detailCustomer?.id ?? 0, limit: 50 },
    { enabled: !!detailCustomer && creditHistoryOpen }
  );

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
      toast.error(translate("请输入客户姓名", "Please enter customer name"));
      return;
    }
    findOrCreateMutation.mutate(newCustomer);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{
            translate("客户管理", "Customer Management")
          }</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {
            translate(
              "统一客户档案，支持多维度身份识别与合并",
              "Unified customer profiles, supporting multi-dimensional identification and merging"
            )
          }
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {translate("新增客户", "Add Customer")}
        </Button>
      </div>

      {mergeSuggestions && mergeSuggestions.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{translate("发现 {count} 个疑似重复客户待确认", "Found {count} potential duplicate customers to confirm", { count: mergeSuggestions.length })}</p>
              <p className="text-xs text-muted-foreground">{translate("请检查并确认是否需要合并客户档案", "Please review and confirm if customer profiles need to be merged")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={translate("搜索客户名称、电话、Facebook...", "Search customer name, phone, Facebook...")}
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
                <TableHead>{translate("客户姓名", "Customer Name")}</TableHead>
                <TableHead>{translate("Facebook 名称", "Facebook Name")}</TableHead>
                <TableHead>{translate("电话号码", "Phone Number")}</TableHead>
                <TableHead>{translate("Email", "Email")}</TableHead>
                <TableHead>{translate("订单数", "Orders")}</TableHead>
                <TableHead>{translate("消费总额", "Total Spent")}</TableHead>
                <TableHead>{translate("会员等级", "Membership Level")}</TableHead>
                <TableHead>{translate("状态", "Status")}</TableHead>
                <TableHead className="text-right">{translate("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
              ) : customers?.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{translate("暂无客户", "No Customers")}</TableCell></TableRow>
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
                      <Badge variant="destructive">{translate("黑名单", "Blacklisted")}</Badge>
                    ) : (
                      <Badge variant="default">{translate("正常", "Normal")}</Badge>
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
            <DialogTitle>{translate("客户详情", "Customer Details")}</DialogTitle>
          </DialogHeader>
          {detailCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-lg">
                <div>
                  <p className="text-muted-foreground">{translate("姓名", "Name")}</p>
                  <p className="font-medium">{detailCustomer.name || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("Facebook 名称", "Facebook Name")}</p>
                  <p className="font-medium">{detailCustomer.facebookName || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("Facebook ID", "Facebook ID")}</p>
                  <p className="font-mono text-xs">{detailCustomer.facebookId || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("Messenger ID", "Messenger ID")}</p>
                  <p className="font-mono text-xs">{detailCustomer.messengerId || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("电话号码", "Phone Number")}</p>
                  <p className="font-medium">{detailCustomer.phoneNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("Email", "Email")}</p>
                  <p className="font-medium">{detailCustomer.email || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("地址", "Address")}</p>
                  <p className="font-medium">{detailCustomer.address || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("订单总数", "Total Orders")}</p>
                  <p className="font-medium">{detailCustomer.totalOrders}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("消费总额", "Total Spent")}</p>
                  <p className="font-bold">RM {detailCustomer.totalSpent}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("会员等级", "Membership Level")}</p>
                  <Badge variant="outline">
                    {MEMBERSHIP_LABELS[detailCustomer.membershipLevel ?? ""] || detailCustomer.membershipLevel || "-"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("积分余额", "Points Balance")}</p>
                  <p className="font-medium">{detailCustomer.pointsBalance}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("Credit 余额", "Credit Balance")}</p>
                  <p className="font-bold text-blue-600">RM {parseFloat(detailCustomer.creditBalance || "0").toFixed(2)}</p>
                </div>
              </div>

              {/* V2.2: Credit Management Section */}
              <div className="p-4 border rounded-lg bg-blue-50/30 dark:bg-blue-950/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-blue-600" />
                    <p className="font-medium text-sm">{translate("Credit 管理", "Credit Management")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setCreditAction("add"); setCreditDialogOpen(true); }}>
                      <Plus className="h-3 w-3 mr-1" />
                      {translate("新增", "Add")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setCreditAction("deduct"); setCreditDialogOpen(true); }}>
                      {translate("扣除", "Deduct")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setCreditAction("adjust"); setCreditDialogOpen(true); }}>
                      {translate("调整", "Adjust")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCreditHistoryOpen(true)}>
                      <History className="h-3 w-3 mr-1" />
                      {translate("记录", "History")}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {translate("Credit 只能在此处管理，订单会自动读取并扣除。", "Credit can only be managed here. Orders will auto-read and deduct.")}
                </p>
              </div>

              {/* Customer notes */}
              {detailCustomer.notes && (
                <div className="p-4 border rounded-lg bg-muted/30">
                  <p className="text-sm font-medium mb-1">{translate("客户备注", "Customer Notes")}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailCustomer.notes}</p>
                </div>
              )}

              {/* Order history */}
              <div>
                <p className="text-sm font-medium mb-2">{translate("历史订单", "Order History")}</p>
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
                  <p className="text-sm text-muted-foreground">{translate("暂无订单记录", "No order records")}</p>
                )}
              </div>

              {/* Duplicates section */}
              {duplicates.length > 0 && (
                <div className="p-4 border border-orange-200 rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <p className="font-medium text-sm">{translate("发现疑似相同客户，是否合并？", "Found potential duplicate customers, merge?")}</p>
                  </div>
                  <div className="space-y-2">
                    {duplicates.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-lg border">
                        <div className="text-sm">
                          <p className="font-medium">{d.name || d.facebookName || translate("客户 #{id}", "Customer #{id}", { id: d.id })}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.phoneNumber && `${translate("电话", "Phone")}: ${d.phoneNumber} | `}
                            {d.facebookId && `${translate("FB ID", "FB ID")}: ${d.facebookId} | `}
                            {d.messengerId && `${translate("Messenger", "Messenger")}: ${d.messengerId}`}
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
                          {translate("合并到此客户", "Merge to this customer")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { setDetailOpen(false); openEdit(detailCustomer); }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {translate("编辑客户", "Edit Customer")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* V2.2: Credit Action Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {creditAction === "add" && translate("新增 Credit", "Add Credit")}
              {creditAction === "deduct" && translate("扣除 Credit", "Deduct Credit")}
              {creditAction === "adjust" && translate("调整 Credit", "Adjust Credit")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/30 rounded-lg text-sm">
              <p className="text-muted-foreground">{translate("客户", "Customer")}</p>
              <p className="font-medium">{detailCustomer?.name || detailCustomer?.facebookName || "-"}</p>
              <p className="text-muted-foreground mt-1">{translate("当前 Credit 余额", "Current Credit Balance")}</p>
              <p className="font-bold text-blue-600">RM {parseFloat(detailCustomer?.creditBalance || "0").toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-xs">
                {creditAction === "adjust" ? translate("金额 (正数增加, 负数减少)", "Amount (positive to add, negative to reduce)") : translate("金额", "Amount")}
              </Label>
              <Input type="number" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs">{translate("原因", "Reason")}</Label>
              <Input value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder={translate("例如：客户退款", "e.g. Customer refund")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button
              disabled={!creditAmount || !creditReason || (creditAction !== "adjust" && parseFloat(creditAmount) <= 0)}
              onClick={() => {
                const amt = parseFloat(creditAmount);
                if (isNaN(amt)) return;
                if (creditAction === "add") addCreditMutation.mutate({ customerId: detailCustomer.id, amount: amt, reason: creditReason });
                else if (creditAction === "deduct") deductCreditMutation.mutate({ customerId: detailCustomer.id, amount: amt, reason: creditReason });
                else adjustCreditMutation.mutate({ customerId: detailCustomer.id, amount: amt, reason: creditReason });
              }}
            >
              {translate("确认", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* V2.2: Credit History Dialog */}
      <Dialog open={creditHistoryOpen} onOpenChange={setCreditHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate("Credit 变动记录", "Credit Transaction History")}</DialogTitle>
          </DialogHeader>
          {creditHistory && creditHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translate("日期", "Date")}</TableHead>
                  <TableHead>{translate("类型", "Type")}</TableHead>
                  <TableHead className="text-right">{translate("金额", "Amount")}</TableHead>
                  <TableHead className="text-right">{translate("余额", "Balance")}</TableHead>
                  <TableHead>{translate("原因", "Reason")}</TableHead>
                  <TableHead>{translate("操作人", "Operator")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditHistory.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{new Date(t.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={t.type === "add" || t.type === "order_refund" ? "default" : t.type === "deduct" || t.type === "order_use" ? "destructive" : "secondary"}>
                        {t.type === "add" && translate("新增", "Add")}
                        {t.type === "deduct" && translate("扣除", "Deduct")}
                        {t.type === "adjust" && translate("调整", "Adjust")}
                        {t.type === "order_use" && translate("订单使用", "Order Use")}
                        {t.type === "order_refund" && translate("订单退款", "Order Refund")}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${parseFloat(t.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {parseFloat(t.amount) >= 0 ? "+" : ""}RM {parseFloat(t.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">RM {parseFloat(t.balanceAfter).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">{t.reason || "-"}</TableCell>
                    <TableCell className="text-xs">{t.operatorName || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{translate("暂无 Credit 变动记录", "No credit transactions")}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate("编辑客户", "Edit Customer")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{translate("姓名", "Name")}</Label>
                <Input value={editData.name || ""} onChange={e => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div>
                <Label>{translate("电话号码", "Phone Number")}</Label>
                <Input value={editData.phoneNumber || ""} onChange={e => setEditData({ ...editData, phoneNumber: e.target.value })} />
              </div>
              <div>
                <Label>{translate("Email", "Email")}</Label>
                <Input value={editData.email || ""} onChange={e => setEditData({ ...editData, email: e.target.value })} />
              </div>
              <div>
                <Label>{translate("城市", "City")}</Label>
                <Input value={editData.city || ""} onChange={e => setEditData({ ...editData, city: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>{translate("地址", "Address")}</Label>
                <Input value={editData.address || ""} onChange={e => setEditData({ ...editData, address: e.target.value })} />
              </div>
              <div>
                <Label>{translate("州属", "State")}</Label>
                <Input value={editData.state || ""} onChange={e => setEditData({ ...editData, state: e.target.value })} />
              </div>
              <div>
                <Label>{translate("邮编", "Postal Code")}</Label>
                <Input value={editData.postalCode || ""} onChange={e => setEditData({ ...editData, postalCode: e.target.value })} />
              </div>
              <div>
                <Label>{translate("会员等级", "Membership Level")}</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={editData.membershipLevel || "regular"}
                  onChange={e => setEditData({ ...editData, membershipLevel: e.target.value })}
                >
                  <option value="regular">{translate("普通", "Regular")}</option>
                  <option value="member">{translate("会员", "Member")}</option>
                  <option value="vip">{translate("VIP", "VIP")}</option>
                </select>
              </div>
              {/* V4: Customer Type (客户身份) */}
              <div>
                <Label>{translate("客户身份", "Customer Type")}</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={editData.customerType || "retail"}
                  onChange={e => setEditData({ ...editData, customerType: e.target.value })}
                >
                  <option value="retail">{translate("普通客户", "Retail Customer")}</option>
                  <option value="wholesale">{translate("批发客户", "Wholesale Customer")}</option>
                  <option value="agent">{translate("代理商", "Agent")}</option>
                </select>
              </div>
              {/* V4: Wholesale/Agent account email */}
              {(editData.customerType === "wholesale" || editData.customerType === "agent") && (
                <div className="col-span-2">
                  <Label>{translate("批发/代理账户 Email", "Wholesale/Agent Account Email")}</Label>
                  <Input
                    type="email"
                    placeholder={translate("用于批发/代理登录", "For wholesale/agent login")}
                    value={editData.accountEmail || ""}
                    onChange={e => setEditData({ ...editData, accountEmail: e.target.value })}
                  />
                </div>
              )}
              <div>
                <Label>{translate("黑名单", "Blacklisted")}</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={editData.isBlacklisted ? "yes" : "no"}
                  onChange={e => setEditData({ ...editData, isBlacklisted: e.target.value === "yes" })}
                >
                  <option value="no">{translate("否", "No")}</option>
                  <option value="yes">{translate("是", "Yes")}</option>
                </select>
              </div>
              {editData.isBlacklisted && (
                <div className="col-span-2">
                  <Label>{translate("黑名单原因", "Blacklist Reason")}</Label>
                  <Input value={editData.blacklistReason || ""} onChange={e => setEditData({ ...editData, blacklistReason: e.target.value })} />
                </div>
              )}
              <div className="col-span-2">
                <Label>{translate("客户备注", "Customer Notes")}</Label>
                <Textarea
                  rows={3}
                  placeholder={translate("内部备注，仅后台可见...", "Internal notes, visible only in backend...")}
                  value={editData.notes || ""}
                  onChange={e => setEditData({ ...editData, notes: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={submitEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? translate("保存中...", "Saving...") : translate("保存", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("新增客户", "Add Customer")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translate("姓名", "Name")} *</Label>
              <Input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} />
            </div>
            <div>
              <Label>{translate("电话号码", "Phone Number")}</Label>
              <Input value={newCustomer.phoneNumber} onChange={e => setNewCustomer({ ...newCustomer, phoneNumber: e.target.value })} />
            </div>
            <div>
              <Label>{translate("Email", "Email")}</Label>
              <Input value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
            </div>
            <div>
              <Label>{translate("地址", "Address")}</Label>
              <Input value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={submitCreate} disabled={findOrCreateMutation.isPending}>
              {findOrCreateMutation.isPending ? translate("建立中...", "Creating...") : translate("建立客户", "Create Customer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
