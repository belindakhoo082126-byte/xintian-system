import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Crown, Check, X, Send, Phone, Ban, Search, Eye, Copy, CheckCircle } from "lucide-react";

// V2.1.25: Simplified membership status (6 statuses)
const MEMBERSHIP_STATUS_MAP = {
  pending: { zh: "待汇款", en: "Pending Payment", variant: "outline" as const },
  fee_confirmed: { zh: "已汇款", en: "Payment Confirmed", variant: "default" as const },
  manual_follow_up: { zh: "待人工发送", en: "Manual Follow Up", variant: "destructive" as const },
  completed: { zh: "已完成", en: "Completed", variant: "default" as const },
  rejected: { zh: "已拒绝", en: "Rejected", variant: "destructive" as const },
  cancelled: { zh: "已取消", en: "Cancelled", variant: "outline" as const },
} as const;

const REVIEW_STATUS_MAP = {
  pending: { zh: "待审核", en: "Pending Review", variant: "outline" as const },
  approved: { zh: "已通过", en: "Approved", variant: "default" as const },
  rejected: { zh: "已拒绝", en: "Rejected", variant: "destructive" as const },
} as const;

const FLOW_STATUS_MAP = {
  pending: { zh: "未发送", en: "Not Sent", variant: "outline" as const },
  sent: { zh: "已发送", en: "Sent", variant: "default" as const },
  failed: { zh: "发送失败", en: "Failed", variant: "destructive" as const },
} as const;

export default function Membership() {
  const { translate, lang } = useI18n();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailReview, setDetailReview] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const utils = trpc.useUtils();

  // V2.1.26: Filter by membershipStatus (order-level) instead of review status
  const { data: reviews, isLoading } = trpc.membership.listReviews.useQuery({
    membershipStatus: statusTab !== "all" ? statusTab : undefined,
  });

  const { data: orders } = trpc.orders.list.useQuery({
    orderType: "membership",
  });

  const { data: flowTemplates } = trpc.flows.list.useQuery({ activeOnly: true });

  const approveMutation = trpc.membership.approveFee.useMutation({
    onSuccess: (data) => {
      utils.membership.invalidate();
      utils.orders.invalidate();
      if (data.flowSent) {
        toast.success(translate("会员费已确认，Messenger Flow 已自动发送", "Membership fee confirmed, Messenger Flow sent automatically"));
      } else {
        toast.warning(translate("会员费已确认，但 Flow 发送失败: {message}", "Membership fee confirmed, but Flow failed to send: {message}", { message: data.message }));
      }
      setDetailOpen(false);
      setReviewNotes("");
    },
    onError: (e) => toast.error(translate("操作失败: {message}", "Operation failed: {message}", { message: e.message })),
  });

  const rejectMutation = trpc.membership.rejectFee.useMutation({
    onSuccess: () => {
      utils.membership.invalidate();
      utils.orders.invalidate();
      toast.success(translate("单据已拒绝，客户可重新上传凭证", "Receipt rejected, customer can re-upload"));
      setDetailOpen(false);
      setReviewNotes("");
    },
    onError: (e) => toast.error(translate("操作失败: {message}", "Operation failed: {message}", { message: e.message })),
  });

  const resendMutation = trpc.membership.resendFlow.useMutation({
    onSuccess: () => {
      utils.membership.invalidate();
      utils.orders.invalidate();
      toast.success(translate("Flow 已重新发送", "Flow re-sent"));
    },
    onError: (e) => toast.error(translate("重发失败: {message}", "Resend failed: {message}", { message: e.message })),
  });

  const markCompletedMutation = trpc.membership.markMembershipCompleted.useMutation({
    onSuccess: () => {
      utils.membership.invalidate();
      utils.orders.invalidate();
      toast.success(translate("会员订单已标记为已完成", "Membership order marked as completed"));
      setDetailOpen(false);
    },
    onError: (e) => toast.error(translate("操作失败: {message}", "Operation failed: {message}", { message: e.message })),
  });

  const cancelMutation = trpc.membership.cancelMembershipOrder.useMutation({
    onSuccess: () => {
      utils.membership.invalidate();
      utils.orders.invalidate();
      toast.success(translate("会员订单已取消", "Membership order cancelled"));
    },
    onError: (e) => toast.error(translate("操作失败: {message}", "Operation failed: {message}", { message: e.message })),
  });

  // Find the order associated with a review
  function getOrderForReview(review: any) {
    return orders?.find((o: any) => o.id === review.orderId);
  }

  function openDetail(review: any) {
    setDetailReview(review);
    setReviewNotes("");
    setDetailOpen(true);
  }

  function contactCustomer(review: any) {
    const order = getOrderForReview(review);
    if (order?.facebookName) {
      toast.info(translate("请通过 Facebook Messenger 联系客户: {facebookName}", "Please contact customer via Facebook Messenger: {facebookName}", { facebookName: order.facebookName }));
    } else {
      toast.info(translate("请通过订单详情获取客户联系方式", "Please get customer contact information from order details"));
    }
  }

  // Copy membership notification text from Flow template
  function copyMembershipNotification(review: any) {
    // Find the membership flow template
    const template = flowTemplates?.find((t: any) =>
      t.name.includes("会员") && (t.name.includes("付款成功") || t.name.includes("Flow"))
    );

    if (template?.messageContent) {
      navigator.clipboard.writeText(template.messageContent).then(() => {
        toast.success(translate("会员通知文案已复制", "Membership notification text copied"));
      }).catch(() => {
        toast.error(translate("复制失败，请手动复制", "Copy failed, please copy manually"));
      });
    } else {
      toast.warning(translate("会员付款成功Flow尚未设置，无法复制文案", "Membership Flow not configured, cannot copy text"));
    }
  }

  // Filter reviews by search
  const filteredReviews = reviews?.filter((r: any) => {
    if (!search) return true;
    const order = getOrderForReview(r);
    const searchText = `${r.orderId} ${order?.orderNumber || ""} ${order?.facebookName || ""} ${order?.customerName || ""}`.toLowerCase();
    return searchText.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {translate("审核会员费汇款单据，确认后自动发送 Messenger 入群 Flow", "Review membership fee remittance documents, and automatically send Messenger group invitation Flow after confirmation")}
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={translate("搜索订单号、客户名...", "Search order number, customer name...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* V2.1.26: Status tabs - based on membership order status (6 statuses) */}
      <Tabs value={statusTab} onValueChange={setStatusTab}>
        <TabsList>
          <TabsTrigger value="all">{translate("全部", "All")}</TabsTrigger>
          <TabsTrigger value="pending">{translate("待汇款", "Pending Payment")}</TabsTrigger>
          <TabsTrigger value="fee_confirmed">{translate("已汇款", "Payment Confirmed")}</TabsTrigger>
          <TabsTrigger value="manual_follow_up">{translate("待人工发送", "Manual Follow Up")}</TabsTrigger>
          <TabsTrigger value="completed">{translate("已完成", "Completed")}</TabsTrigger>
          <TabsTrigger value="rejected">{translate("已拒绝", "Rejected")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate("订单ID", "Order ID")}</TableHead>
                <TableHead>{translate("客户", "Customer")}</TableHead>
                <TableHead>{translate("会员费", "Membership Fee")}</TableHead>
                <TableHead>{translate("会员状态", "Membership Status")}</TableHead>
                <TableHead>{translate("单据", "Receipt")}</TableHead>
                <TableHead>{translate("审核状态", "Review Status")}</TableHead>
                <TableHead>{translate("Flow状态", "Flow Status")}</TableHead>
                <TableHead className="text-right">{translate("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
              ) : filteredReviews?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{translate("暂无会员审核记录", "No membership review records yet")}</TableCell></TableRow>
              ) : filteredReviews?.map(r => {
                const order = getOrderForReview(r);
                const membershipStatus = order?.membershipStatus || "pending";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">#{r.orderId}</TableCell>
                    <TableCell>{order?.facebookName || order?.customerName || "-"}</TableCell>
                    <TableCell className="font-semibold">RM {order?.membershipSubtotal || "0"}</TableCell>
                    <TableCell>
                      <Badge variant={MEMBERSHIP_STATUS_MAP[membershipStatus as keyof typeof MEMBERSHIP_STATUS_MAP]?.variant || "outline"}>
                        {translate(
                          MEMBERSHIP_STATUS_MAP[membershipStatus as keyof typeof MEMBERSHIP_STATUS_MAP]?.zh || membershipStatus,
                          MEMBERSHIP_STATUS_MAP[membershipStatus as keyof typeof MEMBERSHIP_STATUS_MAP]?.en || membershipStatus
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.receiptFileUrl ? (
                        <a href={r.receiptFileUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        </a>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={REVIEW_STATUS_MAP[r.reviewStatus as keyof typeof REVIEW_STATUS_MAP]?.variant}>
                        {translate(REVIEW_STATUS_MAP[r.reviewStatus as keyof typeof REVIEW_STATUS_MAP]?.zh, REVIEW_STATUS_MAP[r.reviewStatus as keyof typeof REVIEW_STATUS_MAP]?.en)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={FLOW_STATUS_MAP[r.flowStatus as keyof typeof FLOW_STATUS_MAP]?.variant}>
                        {translate(FLOW_STATUS_MAP[r.flowStatus as keyof typeof FLOW_STATUS_MAP]?.zh, FLOW_STATUS_MAP[r.flowStatus as keyof typeof FLOW_STATUS_MAP]?.en)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail / Review Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate("会员订单审核", "Membership Order Review")} - #{detailReview?.orderId}</DialogTitle>
          </DialogHeader>
          {detailReview && (() => {
            const order = getOrderForReview(detailReview);
            const membershipStatus = order?.membershipStatus || "pending";
            return (
              <div className="space-y-4">
                {/* Order info */}
                {order && (
                  <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-lg">
                    <div>
                      <p className="text-muted-foreground">{translate("Facebook 名称", "Facebook Name")}</p>
                      <p className="font-medium">{order.facebookName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{translate("订单号", "Order Number")}</p>
                      <p className="font-mono text-sm">{order.orderNumber}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{translate("会员费用", "Membership Fee")}</p>
                      <p className="font-bold text-lg text-primary">RM {order.membershipSubtotal}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{translate("会员状态", "Membership Status")}</p>
                      <Badge variant={MEMBERSHIP_STATUS_MAP[membershipStatus as keyof typeof MEMBERSHIP_STATUS_MAP]?.variant || "outline"}>
                        {translate(
                          MEMBERSHIP_STATUS_MAP[membershipStatus as keyof typeof MEMBERSHIP_STATUS_MAP]?.zh || membershipStatus,
                          MEMBERSHIP_STATUS_MAP[membershipStatus as keyof typeof MEMBERSHIP_STATUS_MAP]?.en || membershipStatus
                        )}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Receipt preview */}
                {detailReview.receiptFileUrl && (
                  <div>
                    <Label>{translate("汇款单据", "Remittance Receipt")}</Label>
                    <div className="mt-2 p-4 border rounded-lg">
                      <a href={detailReview.receiptFileUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          {translate("查看单据", "View Receipt")}
                        </Button>
                      </a>
                    </div>
                  </div>
                )}

                {/* Flow status */}
                <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-lg">
                  <div>
                    <p className="text-muted-foreground">{translate("Flow 发送状态", "Flow Send Status")}</p>
                    <Badge variant={FLOW_STATUS_MAP[detailReview.flowStatus as keyof typeof FLOW_STATUS_MAP]?.variant}>
                      {translate(FLOW_STATUS_MAP[detailReview.flowStatus as keyof typeof FLOW_STATUS_MAP]?.zh, FLOW_STATUS_MAP[detailReview.flowStatus as keyof typeof FLOW_STATUS_MAP]?.en)}
                    </Badge>
                  </div>
                  {detailReview.flowSentAt && (
                    <div>
                      <p className="text-muted-foreground">{translate("Flow 发送时间", "Flow Sent Time")}</p>
                      <p className="text-sm">{new Date(detailReview.flowSentAt).toLocaleString("zh-CN")}</p>
                    </div>
                  )}
                  {detailReview.flowErrorMessage && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">{translate("错误信息", "Error Message")}</p>
                      <p className="text-sm text-destructive">{detailReview.flowErrorMessage}</p>
                    </div>
                  )}
                </div>

                {/* Review notes */}
                <div>
                  <Label>{translate("审核备注", "Review Notes")}</Label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={translate("输入审核备注（可选）...", "Enter review notes (optional)...")}
                    rows={2}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {/* Confirm fee - only when review is pending */}
                  {detailReview.reviewStatus === "pending" && (
                    <>
                      <Button
                        onClick={() => approveMutation.mutate({ reviewId: detailReview.id, notes: reviewNotes || undefined })}
                        disabled={approveMutation.isPending}
                        className="bg-primary"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        {translate("确认会员费", "Confirm Membership Fee")}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => rejectMutation.mutate({ reviewId: detailReview.id, notes: reviewNotes || undefined })}
                        disabled={rejectMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-2" />
                        {translate("拒绝单据", "Reject Receipt")}
                      </Button>
                    </>
                  )}

                  {/* Resend Flow - when flow was sent or failed */}
                  {(detailReview.flowStatus === "sent" || detailReview.flowStatus === "failed") && (
                    <Button
                      variant="outline"
                      onClick={() => resendMutation.mutate({ reviewId: detailReview.id })}
                      disabled={resendMutation.isPending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {translate("重新发送 Flow", "Resend Flow")}
                    </Button>
                  )}

                  {/* Copy membership notification - when manual_follow_up */}
                  {membershipStatus === "manual_follow_up" && (
                    <Button
                      variant="outline"
                      onClick={() => copyMembershipNotification(detailReview)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      {translate("复制会员通知", "Copy Membership Notification")}
                    </Button>
                  )}

                  {/* Mark as completed - when manual_follow_up */}
                  {membershipStatus === "manual_follow_up" && (
                    <Button
                      variant="default"
                      onClick={() => markCompletedMutation.mutate({ reviewId: detailReview.id })}
                      disabled={markCompletedMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {translate("标记已完成", "Mark Completed")}
                    </Button>
                  )}

                  {/* Contact customer */}
                  <Button variant="outline" onClick={() => contactCustomer(detailReview)}>
                    <Phone className="h-4 w-4 mr-2" />
                    {translate("联系客户", "Contact Customer")}
                  </Button>

                  {/* Cancel - not for completed or already cancelled */}
                  {membershipStatus !== "completed" && membershipStatus !== "cancelled" && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (confirm(translate("确定取消此会员订单？", "Are you sure you want to cancel this membership order?"))) {
                          cancelMutation.mutate({ reviewId: detailReview.id });
                          setDetailOpen(false);
                        }
                      }}
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      {translate("取消会员订单", "Cancel Membership Order")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              {translate("关闭", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
