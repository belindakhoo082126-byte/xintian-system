import { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Eye, GitMerge, AlertTriangle, Pencil, Plus, DollarSign, Ban, CheckCircle, Loader2, Mail, MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  // V2.1.02: XTC import order status labels
  const IMPORT_STATUS_LABELS = useMemo<Record<string, string>>(() => ({
    pending: translate("挂单", "Pending"),
    receipt_uploaded: translate("待审核付款凭证", "Pending Verification"),
    partial_payment: translate("部分汇款", "Partial Payment"),
    waiting_stock: translate("待备货", "Waiting Stock"),
    ready_to_ship: translate("待发货", "Ready to Ship"),
    scheduled_ship: translate("预约发货", "Scheduled Ship"),
    partial_shipped: translate("部分发货", "Partial Shipped"),
    shipped: translate("已发货", "Shipped"),
    completed: translate("已完成", "Completed"),
    cancelled: translate("取消", "Cancelled"),
  }), [translate]);

  const [search, setSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<any>({ name: "", phoneNumber: "", email: "", address: "" });
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditCustomer, setCreditCustomer] = useState<any>(null);
  const [creditForm, setCreditForm] = useState({ amount: "", reason: "", type: "add" });
  const [blacklistDialogOpen, setBlacklistDialogOpen] = useState(false);
  const [blacklistCustomer, setBlacklistCustomer] = useState<any>(null);
  const [blacklistForm, setBlacklistForm] = useState({ reason: "" });
  // V2.0.81: Merge dialog state
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<any>(null);
  const [mergeTarget, setMergeTarget] = useState<any>(null);
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  // V2.0.83: Checkbox-based merge selection
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<number>>(new Set());
  const [mergeSelectMode, setMergeSelectMode] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "timeline">("info");
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

  // V2.0.78: Credit Ledger query
  const { data: creditLedger } = trpc.customers.getCreditLedger.useQuery(
    { customerId: detailCustomer?.id ?? 0 },
    { enabled: !!detailCustomer }
  );

  // V2.0.81: Customer Timeline query
  const { data: timeline } = trpc.customers.getTimeline.useQuery(
    { customerId: detailCustomer?.id ?? 0 },
    { enabled: !!detailCustomer && detailTab === "timeline" }
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

  const adjustCreditMutation = trpc.customers.adjustCredit.useMutation({
    onSuccess: (data) => {
      utils.customers.invalidate();
      toast.success(translate("Credit 已调整，新余额: RM {balance}", "Credit adjusted, new balance: RM {balance}", { balance: data.newBalance }));
      setCreditDialogOpen(false);
      setCreditForm({ amount: "", reason: "", type: "add" });
    },
    onError: (e) => toast.error(translate("调整失败: {message}", "Adjust failed: {message}", { message: e.message })),
  });

  const setBlacklistMutation = trpc.customers.setBlacklist.useMutation({
    onSuccess: () => {
      utils.customers.invalidate();
      toast.success(translate("黑名单状态已更新", "Blacklist status updated"));
      setBlacklistDialogOpen(false);
      setBlacklistForm({ reason: "" });
    },
    onError: (e) => toast.error(translate("操作失败: {message}", "Operation failed: {message}", { message: e.message })),
  });

  function openDetail(customer: any) {
    setDuplicates([]);
    setDetailCustomer(customer);
    setDetailOpen(true);
  }

  function openEdit(customer: any) {
    setEditData({
      id: customer.id,
      // 基本资料
      name: customer.name || "",
      facebookName: customer.facebookName || "",
      facebookId: customer.facebookId || "",
      messengerId: customer.messengerId || "",
      phoneNumber: customer.phoneNumber || "",
      whatsappPhone: customer.whatsappPhone || "",
      email: customer.email || "",
      // 收件资料
      displayName: customer.displayName || "",
      address: customer.address || "",
      city: customer.city || "",
      state: customer.state || "",
      postalCode: customer.postalCode || "",
      country: customer.country || "",
      // 其他
      notes: customer.notes || "",
      membershipLevel: customer.membershipLevel || "regular",
      isBlacklisted: customer.isBlacklisted || false,
      blacklistReason: customer.blacklistReason || "",
      customerType: customer.customerType || "retail",
      accountEmail: customer.accountEmail || "",
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

  function openCreditDialog(customer: any) {
    setCreditCustomer(customer);
    setCreditForm({ amount: "", reason: "", type: "add" });
    setCreditDialogOpen(true);
  }

  function submitCredit() {
    const amt = parseFloat(creditForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error(translate("请输入有效金额", "Please enter a valid amount"));
      return;
    }
    const signedAmount = creditForm.type === "deduct" ? -Math.abs(amt) : Math.abs(amt);
    if (!creditForm.reason.trim()) {
      toast.error(translate("原因必填", "Reason is required"));
      return;
    }
    adjustCreditMutation.mutate({
      customerId: creditCustomer.id,
      amount: signedAmount.toFixed(2),
      reason: creditForm.reason,
    });
  }

  function openBlacklistDialog(customer: any) {
    setBlacklistCustomer(customer);
    setBlacklistForm({ reason: customer.blacklistReason || "" });
    setBlacklistDialogOpen(true);
  }

  function submitBlacklist() {
    setBlacklistMutation.mutate({
      customerId: blacklistCustomer.id,
      isBlacklisted: !blacklistCustomer.isBlacklisted,
      reason: blacklistForm.reason || undefined,
    });
  }

  // V2.0.81: Merge functions
  function openMergeDialog(sourceCustomer: any) {
    setMergeSource(sourceCustomer);
    setMergeTarget(detailCustomer);
    setMergeDialogOpen(true);
  }

  // V2.0.83: Checkbox-based merge selection functions
  function toggleCustomerSelection(id: number) {
    setSelectedCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function enterMergeMode() {
    setMergeSelectMode(true);
    setSelectedCustomerIds(new Set());
    setMergePrimaryId(null);
  }

  function exitMergeMode() {
    setMergeSelectMode(false);
    setSelectedCustomerIds(new Set());
    setMergePrimaryId(null);
  }

  function setPrimaryCustomer(id: number) {
    setMergePrimaryId(id);
    // Also select the primary if not already selected
    setSelectedCustomerIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function executeCheckboxMerge() {
    if (!mergePrimaryId || selectedCustomerIds.size < 2) return;
    const selectedList = customers?.filter(c => selectedCustomerIds.has(c.id) && !c.mergedIntoCustomerId) || [];
    const primary = selectedList.find(c => c.id === mergePrimaryId);
    if (!primary) return;
    const others = selectedList.filter(c => c.id !== mergePrimaryId);
    if (others.length === 0) return;
    // Set up merge dialog with first non-primary as source, primary as target
    setMergeSource(others[0]);
    setMergeTarget(primary);
    setMergeDialogOpen(true);
  }

  function confirmMerge() {
    mergeMutation.mutate({
      sourceId: mergeSource.id,
      targetId: mergeTarget.id,
    });
    setMergeConfirmOpen(false);
    setMergeDialogOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("客户管理", "Customer Management")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {translate("统一客户档案，支持多维度身份识别与合并", "Unified customer profiles, supporting multi-dimensional identification and merging")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={mergeSelectMode ? "default" : "outline"}
            onClick={() => mergeSelectMode ? exitMergeMode() : enterMergeMode()}
          >
            <GitMerge className="h-4 w-4 mr-2" />
            {mergeSelectMode ? translate("退出合并", "Exit Merge") : translate("合并客户", "Merge Customers")}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {translate("新增客户", "Add Customer")}
          </Button>
        </div>
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

      {/* V2.0.83: Merge mode toolbar */}
      {mergeSelectMode && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <GitMerge className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">
                  {translate("已选择 {count} 位客户", "Selected {count} customers", { count: selectedCustomerIds.size })}
                </p>
                {selectedCustomerIds.size >= 2 && (
                  <p className="text-xs text-muted-foreground">
                    {mergePrimaryId
                      ? translate("主客户已设定，点击执行合并", "Primary customer set, click Execute Merge")
                      : translate("请点击星号设定主客户", "Click star icon to set primary customer")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {selectedCustomerIds.size >= 2 && mergePrimaryId && (
                <Button size="sm" onClick={executeCheckboxMerge}>
                  <GitMerge className="h-4 w-4 mr-1" />
                  {translate("执行合并", "Execute Merge")}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={exitMergeMode}>
                {translate("退出合并模式", "Exit Merge Mode")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {mergeSelectMode && (
                  <TableHead className="w-10">
                    {translate("选择", "Select")}
                  </TableHead>
                )}
                {mergeSelectMode && (
                  <TableHead className="w-10">
                    {translate("主客户", "Primary")}
                  </TableHead>
                )}
                <TableHead>{translate("客户姓名", "Customer Name")}</TableHead>
                <TableHead>{translate("Facebook 名称", "Facebook Name")}</TableHead>
                <TableHead>{translate("电话号码", "Phone Number")}</TableHead>
                <TableHead>{translate("订单数", "Orders")}</TableHead>
                <TableHead>{translate("消费总额", "Total Spent")}</TableHead>
                <TableHead>{translate("Credit", "Credit")}</TableHead>
                <TableHead>{translate("会员等级", "Membership")}</TableHead>
                <TableHead>{translate("状态", "Status")}</TableHead>
                <TableHead className="text-right">{translate("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={mergeSelectMode ? 12 : 10} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
              ) : customers?.length === 0 ? (
                <TableRow><TableCell colSpan={mergeSelectMode ? 12 : 10} className="text-center text-muted-foreground">{translate("暂无客户", "No Customers")}</TableCell></TableRow>
              ) : customers?.filter(c => !c.mergedIntoCustomerId).map(c => (
                <TableRow key={c.id} className={mergeSelectMode && selectedCustomerIds.has(c.id) ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}>
                  {mergeSelectMode && (
                    <TableCell>
                      <Checkbox
                        checked={selectedCustomerIds.has(c.id)}
                        onCheckedChange={() => toggleCustomerSelection(c.id)}
                      />
                    </TableCell>
                  )}
                  {mergeSelectMode && (
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setPrimaryCustomer(c.id)}
                        className={`text-lg ${mergePrimaryId === c.id ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-400"}`}
                        title={translate("设为主客户", "Set as primary customer")}
                      >
                        {mergePrimaryId === c.id ? "★" : "☆"}
                      </button>
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{c.name || "-"}</TableCell>
                  <TableCell>{c.facebookName || "-"}</TableCell>
                  <TableCell className="text-sm">{c.phoneNumber || "-"}</TableCell>
                  <TableCell>{c.totalOrders}</TableCell>
                  <TableCell>RM {c.totalSpent}</TableCell>
                  <TableCell className="font-medium">RM {parseFloat(c.creditBalance || "0").toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {MEMBERSHIP_LABELS[c.membershipLevel ?? ""] || c.membershipLevel || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.isBlacklisted ? (
                      <Badge variant="destructive" className="gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                        {translate("🔴 黑名单", "🔴 Blacklisted")}
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1 bg-green-600">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-300" />
                        {translate("🟢 正常", "🟢 Normal")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(c)} title={translate("查看", "View")}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title={translate("编辑", "Edit")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openCreditDialog(c)} title={translate("Credit 管理", "Credit Management")}>
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openBlacklistDialog(c)} title={c.isBlacklisted ? translate("取消黑名单", "Un-blacklist") : translate("设置黑名单", "Blacklist")}>
                        {c.isBlacklisted ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-red-600" />}
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
            <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as "info" | "timeline")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">{translate("客户资料", "Info")}</TabsTrigger>
                <TabsTrigger value="timeline">{translate("Timeline", "Timeline")}</TabsTrigger>
              </TabsList>

              {/* Info Tab */}
              <TabsContent value="info" className="space-y-4 mt-4">
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
                    <p className="text-muted-foreground">{translate("Credit 余额", "Credit Balance")}</p>
                    <p className="font-bold text-blue-600">RM {parseFloat(detailCustomer.creditBalance || "0").toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{translate("积分余额", "Points Balance")}</p>
                    <p className="font-medium">{detailCustomer.pointsBalance}</p>
                  </div>
                  {detailCustomer.isBlacklisted && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">{translate("黑名单原因", "Blacklist Reason")}</p>
                      <p className="text-sm text-red-600">{detailCustomer.blacklistReason || "-"}</p>
                    </div>
                  )}
                </div>

                {/* Customer notes */}
                {detailCustomer.notes && (
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <p className="text-sm font-medium mb-1">{translate("客户备注", "Customer Notes")}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailCustomer.notes}</p>
                  </div>
                )}

                {/* Order history - V2.1.02: Separate local and XTC orders */}
                <div>
                  <p className="text-sm font-medium mb-2">{translate("历史订单", "Order History")}</p>
                  {customerOrders && customerOrders.length > 0 ? (() => {
                    const localOrders = customerOrders.filter((o: any) => o.orderCategory !== 'import');
                    const xtcOrders = customerOrders.filter((o: any) => o.orderCategory === 'import');
                    return (
                      <div className="space-y-4">
                        {localOrders.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">{translate("本地订单", "Local Orders")} ({localOrders.length})</p>
                            <div className="space-y-2">
                              {localOrders.map((o: any) => (
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
                          </div>
                        )}
                        {xtcOrders.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">{translate("中国代购订单", "China Import Orders")} ({xtcOrders.length})</p>
                            <div className="space-y-2">
                              {xtcOrders.map((o: any) => (
                                <div key={o.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                                  <div>
                                    <p className="font-medium">{o.orderNumber}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(o.createdAt).toLocaleDateString()} · {IMPORT_STATUS_LABELS[o.importStatus] || o.importStatus || o.physicalStatus}
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
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <p className="text-sm text-muted-foreground">{translate("暂无订单记录", "No order records")}</p>
                  )}
                </div>

                {/* V2.0.78: Credit Ledger */}
                <div>
                  <p className="text-sm font-medium mb-2">{translate("Credit 记录", "Credit Ledger")}</p>
                  {creditLedger && creditLedger.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {creditLedger.map((l: any) => {
                        const isAdd = l.type === "admin_add";
                        const isOrder = l.type === "order_use" || l.type === "order_refund";
                        return (
                          <div key={l.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                            <div className="flex-1">
                              <p className="font-medium">
                                <span className={isAdd ? "text-green-600" : "text-red-600"}>
                                  {isAdd ? "+" : "-"}RM {parseFloat(l.amount).toFixed(2)}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {l.reason}
                                {l.orderNumber && ` (订单 ${l.orderNumber})`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">
                                {new Date(l.createdAt).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {isOrder ? translate("系统自动", "System") : l.performedBy || translate("Admin", "Admin")}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{translate("暂无 Credit 记录", "No credit records")}</p>
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
                            onClick={() => openMergeDialog(d)}
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
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline" className="space-y-2 mt-4">
                {timeline && timeline.length > 0 ? (
                  <div className="relative space-y-3">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                    {timeline.map((event: any, idx: number) => {
                      const isOrder = event.type === "order";
                      const isCredit = event.type === "credit";
                      const isBlacklist = event.type === "blacklist";
                      const isCreated = event.type === "customer_created";
                      const dotColor = isOrder ? "bg-blue-500" : isCredit ? "bg-green-500" : isBlacklist ? "bg-red-500" : isCreated ? "bg-purple-500" : "bg-gray-400";
                      const iconBg = isOrder ? "bg-blue-50 dark:bg-blue-950" : isCredit ? "bg-green-50 dark:bg-green-950" : isBlacklist ? "bg-red-50 dark:bg-red-950" : isCreated ? "bg-purple-50 dark:bg-purple-950" : "bg-gray-50 dark:bg-gray-900";
                      return (
                        <div key={idx} className="relative flex gap-3 pl-0">
                          <div className={`z-10 shrink-0 w-8 h-8 rounded-full ${dotColor} flex items-center justify-center text-white text-xs font-bold`}>
                            {isOrder ? "📦" : isCredit ? "💰" : isBlacklist ? "🚫" : isCreated ? "👤" : "📝"}
                          </div>
                          <div className={`flex-1 p-3 border rounded-lg ${iconBg}`}>
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{event.title}</p>
                              <p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
                            </div>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                            )}
                            {event.amount && (
                              <p className="text-sm font-bold mt-1">
                                {isCredit && event.amount.startsWith("-") ? "" : isCredit ? "+" : ""}RM {parseFloat(event.amount).toFixed(2)}
                              </p>
                            )}
                            {event.orderNumber && (
                              <p className="text-xs text-muted-foreground mt-1">订单: {event.orderNumber}</p>
                            )}
                            {event.operatorName && (
                              <p className="text-xs text-muted-foreground mt-1">{translate("操作人", "Operator")}: {event.operatorName}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">{translate("暂无 Timeline 记录", "No timeline records")}</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate("编辑客户", "Edit Customer")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 基本资料 */}
            <div>
              <p className="text-sm font-medium mb-2 border-b pb-1">{translate("基本资料", "Basic Information")}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{translate("客户姓名", "Customer Name")}</Label>
                  <Input value={editData.name || ""} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                </div>
                <div>
                  <Label>{translate("Facebook 名称", "Facebook Name")}</Label>
                  <Input value={editData.facebookName || ""} onChange={e => setEditData({ ...editData, facebookName: e.target.value })} />
                </div>
                <div>
                  <Label>{translate("Facebook ID", "Facebook ID")}</Label>
                  <Input value={editData.facebookId || ""} onChange={e => setEditData({ ...editData, facebookId: e.target.value })} />
                </div>
                <div>
                  <Label>{translate("Messenger ID", "Messenger ID")}</Label>
                  <Input value={editData.messengerId || ""} onChange={e => setEditData({ ...editData, messengerId: e.target.value })} />
                </div>
                <div>
                  <Label>{translate("电话号码", "Phone Number")}</Label>
                  <Input value={editData.phoneNumber || ""} onChange={e => setEditData({ ...editData, phoneNumber: e.target.value })} />
                </div>
                <div>
                  <Label>{translate("WhatsApp", "WhatsApp")}</Label>
                  <Input value={editData.whatsappPhone || ""} onChange={e => setEditData({ ...editData, whatsappPhone: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>{translate("Email", "Email")}</Label>
                  <Input value={editData.email || ""} onChange={e => setEditData({ ...editData, email: e.target.value })} />
                </div>
              </div>
            </div>

            {/* 收件资料 */}
            <div>
              <p className="text-sm font-medium mb-2 border-b pb-1">{translate("收件资料", "Shipping Information")}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{translate("收件人", "Recipient Name")}</Label>
                  <Input value={editData.displayName || ""} onChange={e => setEditData({ ...editData, displayName: e.target.value })} />
                </div>
                <div>
                  <Label>{translate("收件电话", "Recipient Phone")}</Label>
                  <Input value={editData.phoneNumber || ""} onChange={e => setEditData({ ...editData, phoneNumber: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>{translate("地址", "Address")}</Label>
                  <Input value={editData.address || ""} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                </div>
                <div>
                  <Label>{translate("邮编", "Postal Code")}</Label>
                  <Input value={editData.postalCode || ""} onChange={e => setEditData({ ...editData, postalCode: e.target.value })} />
                </div>
                <div>
                  <Label>{translate("城市", "City")}</Label>
                  <Input value={editData.city || ""} onChange={e => setEditData({ ...editData, city: e.target.value })} />
                </div>
                <div>
                  <Label>{translate("州属", "State")}</Label>
                  <Input value={editData.state || ""} onChange={e => setEditData({ ...editData, state: e.target.value })} />
                </div>
                <div>
                  <Label>{translate("国家", "Country")}</Label>
                  <Input value={editData.country || ""} onChange={e => setEditData({ ...editData, country: e.target.value })} />
                </div>
              </div>
            </div>

            {/* 客户状态 */}
            <div>
              <p className="text-sm font-medium mb-2 border-b pb-1">{translate("客户状态", "Customer Status")}</p>
              <div className="grid grid-cols-2 gap-4">
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
                <div className="col-span-2 flex items-center gap-3 p-3 border rounded-lg">
                  <span className="text-sm font-medium">{translate("黑名单", "Blacklist")}</span>
                  <button
                    type="button"
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editData.isBlacklisted ? "bg-red-600" : "bg-green-500"}`}
                    onClick={() => setEditData({ ...editData, isBlacklisted: !editData.isBlacklisted })}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editData.isBlacklisted ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <span className={`text-sm ${editData.isBlacklisted ? "text-red-600" : "text-green-600"}`}>
                    {editData.isBlacklisted ? translate("🔴 黑名单", "🔴 Blacklisted") : translate("🟢 正常", "🟢 Normal")}
                  </span>
                </div>
                {editData.isBlacklisted && (
                  <div className="col-span-2">
                    <Label>{translate("黑名单原因", "Blacklist Reason")}</Label>
                    <Textarea
                      rows={2}
                      value={editData.blacklistReason || ""}
                      onChange={e => setEditData({ ...editData, blacklistReason: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 备注 */}
            <div>
              <p className="text-sm font-medium mb-2 border-b pb-1">{translate("备注", "Notes")}</p>
              <Textarea
                rows={3}
                placeholder={translate("内部备注，仅后台可见...", "Internal notes, visible only in backend...")}
                value={editData.notes || ""}
                onChange={e => setEditData({ ...editData, notes: e.target.value })}
              />
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

      {/* Credit adjustment dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{translate("Credit 管理", "Credit Management")}</DialogTitle>
          </DialogHeader>
          {creditCustomer && (
            <div className="space-y-4">
              <div className="p-3 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">{translate("客户", "Customer")}</p>
                <p className="font-medium">{creditCustomer.name || creditCustomer.facebookName || "-"}</p>
                <p className="text-sm text-muted-foreground mt-2">{translate("当前 Credit 余额", "Current Credit Balance")}</p>
                <p className="font-bold text-blue-600 text-lg">RM {parseFloat(creditCustomer.creditBalance || "0").toFixed(2)}</p>
              </div>
              <div>
                <Label>{translate("操作类型", "Action Type")}</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant={creditForm.type === "add" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCreditForm(prev => ({ ...prev, type: "add" }))}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {translate("加 Credit (+)", "Add Credit (+)")}
                  </Button>
                  <Button
                    variant={creditForm.type === "deduct" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCreditForm(prev => ({ ...prev, type: "deduct" }))}
                    className="flex-1"
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    {translate("扣 Credit (-)", "Deduct Credit (-)")}
                  </Button>
                </div>
              </div>
              <div>
                <Label>{translate("金额 (RM)", "Amount (RM)")} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={creditForm.amount}
                  onChange={e => setCreditForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div>
                <Label>{translate("原因（必填）", "Reason (required)")} <span className="text-red-500">*</span></Label>
                <Textarea
                  rows={2}
                  placeholder={translate("例如：退款补偿 / 补扣运费 / 手动调整", "e.g. Refund compensation / Shipping fee deduction / Manual adjustment")}
                  value={creditForm.reason}
                  onChange={e => setCreditForm(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button onClick={submitCredit} disabled={adjustCreditMutation.isPending}>
              {adjustCreditMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {translate("确认", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blacklist dialog */}
      <Dialog open={blacklistDialogOpen} onOpenChange={setBlacklistDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {blacklistCustomer?.isBlacklisted
                ? translate("取消黑名单", "Remove from Blacklist")
                : translate("设置黑名单", "Set Blacklist")}
            </DialogTitle>
          </DialogHeader>
          {blacklistCustomer && (
            <div className="space-y-4">
              <div className="p-3 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">{translate("客户", "Customer")}</p>
                <p className="font-medium">{blacklistCustomer.name || blacklistCustomer.facebookName || "-"}</p>
                <p className="text-sm text-muted-foreground mt-1">{translate("电话", "Phone")}: {blacklistCustomer.phoneNumber || "-"}</p>
              </div>
              {!blacklistCustomer.isBlacklisted && (
                <div>
                  <Label>{translate("黑名单原因（选填）", "Blacklist Reason (optional)")}</Label>
                  <Textarea
                    rows={2}
                    placeholder={translate("例如：恶意退款 / 屡次不付款 / 虚假订单", "e.g. Malicious refund / Repeated non-payment / Fake orders")}
                    value={blacklistForm.reason}
                    onChange={e => setBlacklistForm({ reason: e.target.value })}
                  />
                </div>
              )}
              {blacklistCustomer.isBlacklisted && (
                <p className="text-sm text-muted-foreground">
                  {translate("确认取消此客户的黑名单状态？取消后客户将恢复正常下单功能。", "Confirm removing this customer from blacklist? The customer will regain normal ordering access.")}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlacklistDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button
              onClick={submitBlacklist}
              disabled={setBlacklistMutation.isPending}
              variant={blacklistCustomer?.isBlacklisted ? "default" : "destructive"}
            >
              {setBlacklistMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {blacklistCustomer?.isBlacklisted
                ? translate("确认取消黑名单", "Confirm Un-blacklist")
                : translate("确认设置黑名单", "Confirm Blacklist")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* V2.0.81: Merge preview dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate("合并客户", "Merge Customers")}</DialogTitle>
          </DialogHeader>
          {mergeSource && mergeTarget && (
            <div className="space-y-4">
              <div className="p-3 border border-orange-200 rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                    {translate("合并后不可复原，请确认以下信息", "This operation is irreversible, please confirm")}
                  </p>
                </div>
              </div>

              {/* Merge preview table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{translate("项目", "Item")}</TableHead>
                      <TableHead>{translate("来源客户", "Source")}</TableHead>
                      <TableHead>{translate("目标客户", "Target")}</TableHead>
                      <TableHead>{translate("合并后", "Merged")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">{translate("姓名", "Name")}</TableCell>
                      <TableCell>{mergeSource.name || mergeSource.facebookName || "-"}</TableCell>
                      <TableCell>{mergeTarget.name || mergeTarget.facebookName || "-"}</TableCell>
                      <TableCell className="font-medium">{mergeTarget.name || mergeTarget.facebookName || "-"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{translate("电话", "Phone")}</TableCell>
                      <TableCell>{mergeSource.phoneNumber || "-"}</TableCell>
                      <TableCell>{mergeTarget.phoneNumber || "-"}</TableCell>
                      <TableCell>{mergeTarget.phoneNumber || mergeSource.phoneNumber || "-"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{translate("订单数", "Orders")}</TableCell>
                      <TableCell>{mergeSource.totalOrders || 0}</TableCell>
                      <TableCell>{mergeTarget.totalOrders || 0}</TableCell>
                      <TableCell className="font-bold">{(mergeSource.totalOrders || 0) + (mergeTarget.totalOrders || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{translate("消费总额", "Total Spent")}</TableCell>
                      <TableCell>RM {mergeSource.totalSpent || "0"}</TableCell>
                      <TableCell>RM {mergeTarget.totalSpent || "0"}</TableCell>
                      <TableCell className="font-bold">RM {(parseFloat(mergeSource.totalSpent || "0") + parseFloat(mergeTarget.totalSpent || "0")).toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{translate("Credit", "Credit")}</TableCell>
                      <TableCell>RM {parseFloat(mergeSource.creditBalance || "0").toFixed(2)}</TableCell>
                      <TableCell>RM {parseFloat(mergeTarget.creditBalance || "0").toFixed(2)}</TableCell>
                      <TableCell className="font-bold text-blue-600">RM {(parseFloat(mergeSource.creditBalance || "0") + parseFloat(mergeTarget.creditBalance || "0")).toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="p-3 border rounded-lg bg-muted/30 text-sm">
                <p className="font-medium mb-1">{translate("合并说明", "Merge Notes")}</p>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                  <li>{translate("来源客户的所有订单将转移到目标客户", "All orders from source customer will be transferred to target customer")}</li>
                  <li>{translate("Credit 余额将合并到目标客户", "Credit balance will be merged to target customer")}</li>
                  <li>{translate("缺失的资料将从来源客户填充到目标客户", "Missing fields will be filled from source customer")}</li>
                  <li>{translate("来源客户将被标记为已合并，不再显示", "Source customer will be marked as merged and hidden")}</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => setMergeConfirmOpen(true)}
            >
              <GitMerge className="h-4 w-4 mr-2" />
              {translate("确认合并", "Confirm Merge")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* V2.0.81: Merge confirmation dialog */}
      <Dialog open={mergeConfirmOpen} onOpenChange={setMergeConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{translate("最终确认", "Final Confirmation")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">{translate("此操作不可复原", "This operation is irreversible")}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {translate("确定要将 ", "Are you sure you want to merge ")}
              <span className="font-medium">{mergeSource?.name || mergeSource?.facebookName || ""}</span>
              {translate(" 合并到 ", " into ")}
              <span className="font-medium">{mergeTarget?.name || mergeTarget?.facebookName || ""}</span>
              {translate("？", "?")}
            </p>
            <p className="text-xs text-muted-foreground">
              {translate("合并后所有订单、Credit 和消费记录将整合到目标客户，来源客户将被隐藏。", "All orders, credit and spending records will be consolidated into the target customer. The source customer will be hidden.")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeConfirmOpen(false)}>{translate("取消", "Cancel")}</Button>
            <Button
              variant="destructive"
              onClick={confirmMerge}
              disabled={mergeMutation.isPending}
            >
              {mergeMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {translate("确定合并", "Confirm")}
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
