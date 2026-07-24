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
import { Crown, Check, X, Send, Copy, Phone, Ban, Search, Eye } from "lucide-react";

const MEMBERSHIP_STATUS = {
  pending: { label: translate("待付款", "Pending Payment"), variant: "outline" },
  receipt_uploaded: { label: translate("已上传单据", "Receipt Uploaded"), variant: "secondary" },
  pending_review: { label: translate("待审核", "Pending Review"), variant: "secondary" },
  fee_confirmed: { label: translate("已确认会员费", "Fee Confirmed"), variant: "default" },
  flow_sent: { label: translate("已发送入群Flow", "Flow Sent"), variant: "default" },
  flow_failed: { label: translate("Flow发送失败", "Flow Failed"), variant: "destructive" },
  manual_follow_up: { label: translate("待人工跟进", "Manual Follow Up"), variant: "destructive" },
  completed: { label: translate("已完成", "Completed"), variant: "default" },
  cancelled: { label: translate("已取消", "Cancelled"), variant: "destructive" },
} as const;

const REVIEW_STATUS = {
  pending: { label: translate("待审核", "Pending Review"), variant: "outline" },
  approved: { label: translate("已通过", "Approved"), variant: "default" },
  rejected: { label: translate("已拒绝", "Rejected"), variant: "destructive" },
} as const;

const FLOW_STATUS = {
  pending: { label: translate("未发送", "Not Sent"), variant: "outline" },
  sent: { label: translate("已发送", "Sent"), variant: "default" },
  failed: { label: translate("发送失败", "Failed"), variant: "destructive" },
} as const;

export default function Membership() {
  const { translate, lang } = useI18n();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailReview, setDetailReview] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const utils = trpc.useUtils();

  const { data: reviews, isLoading } = trpc.membership.listReviews.useQuery({
    status: statusTab !== "all" ? statusTab : undefined,
  });

  const { data: orders } = trpc.orders.list.useQuery({
    orderType: "membership",
  });

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
      toast.success(translate("单据已拒绝，订单已退回待付款状态", "Receipt rejected, order returned to pending payment status"));
      setDetailOpen(false);
      setReviewNotes("");
    },
    onError: (e) => toast.error(translate("操作失败: {message}", "Operation failed: {message}", { message: e.message })),
  });

  const resendMutation = trpc.membership.resendFlow.useMutation({
    onSuccess: () => {
      utils.membership.invalidate();
      toast.success(translate("Flow 已重新发送", "Flow re-sent"));
    },
    onError: (e) => toast.error(translate("重发失败: {message}", "Resend failed: {message}", { message: e.message })),
  });

  const followUpMutation = trpc.membership.markNeedsFollowUp.useMutation({
    onSuccess: () => {
      utils.membership.invalidate();
      utils.orders.invalidate();
      toast.success(translate("已标记为待人工跟进", "Marked for manual follow-up"));
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

  function copyTelegramLink(review: any) {
    // Get the flow template's button link if available
    const link = detailReview?.flowTemplateId
      ? `https://t.me/xintian_bot?start=review_${review.id}`
      : `https://t.me/xintian_bot?start=review_${review.id}`;
    navigator.clipboard.writeText(link);
    toast.success(translate("Telegram 链接已复制", "Telegram link copied"));
  }

  function contactCustomer(review: any) {
    const order = getOrderForReview(review);
    if (order?.facebookName) {
      toast.info(translate("请通过 Facebook Messenger 联系客户: {facebookName}", "Please contact customer via Facebook Messenger: {facebookName}", { facebookName: order.facebookName }));
    } else {
      toast.info(translate("请通过订单详情获取客户联系方式", "Please get customer contact information from order details"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{translate("会员订单管理", "Membership Order Management")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {translate("审核会员费汇款单据，确认后自动发送 Messenger 入群 Flow", "Review membership fee remittance documents, and automatically send Messenger group invitation Flow after confirmation")}
        </p>
      </div>

      <Tabs value={statusTab} onValueChange={setStatusTab}>
        <TabsList>
          <TabsTrigger value="all">{translate("全部", "All")}</TabsTrigger>
          <TabsTrigger value="pending">{translate("待审核", "Pending Review")}</TabsTrigger>
          <TabsTrigger value="approved">{translate("已通过", "Approved")}</TabsTrigger>
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
                <TableHead>{translate("电话", "Phone")}</TableHead>
                <TableHead>{translate("会员费", "Membership Fee")}</TableHead>
                <TableHead>{translate("单据", "Receipt")}</TableHead>
                <TableHead>{translate("审核状态", "Review Status")}</TableHead>
                <TableHead>{translate("Flow状态", "Flow Status")}</TableHead>
                <TableHead>{translate("发送时间", "Sent At")}</TableHead>
                <TableHead>{translate("点击链接", "Link Clicked")}</TableHead>
                <TableHead>{translate("人工跟进", "Manual Follow Up")}</TableHead>
                <TableHead className="text-right">{translate("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">{translate("加载中...", "Loading...")}</TableCell></TableRow>
              ) : reviews?.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">{translate("暂无会员审核记录", "No membership review records yet")}</TableCell></TableRow>
              ) : reviews?.map(r => {
                const order = getOrderForReview(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">#{r.orderId}</TableCell>
                    <TableCell>{order?.facebookName || "-"}</TableCell>
                    <TableCell className="text-sm">{order?.facebookName ? translate("查看详情", "View Details") : "-"}</TableCell>
                    <TableCell className="font-semibold">RM {order?.membershipSubtotal || "0"}</TableCell>
                    <TableCell>
                      {r.receiptFileUrl ? (
                        <a href={r.receiptFileUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        </a>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={REVIEW_STATUS[r.reviewStatus as keyof typeof REVIEW_STATUS]?.variant}>
                        {REVIEW_STATUS[r.reviewStatus as keyof typeof REVIEW_STATUS]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={FLOW_STATUS[r.flowStatus as keyof typeof FLOW_STATUS]?.variant}>
                        {FLOW_STATUS[r.flowStatus as keyof typeof FLOW_STATUS]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.flowSentAt ? new Date(r.flowSentAt).toLocaleString("zh-CN") : "-"}
                    </TableCell>
                    <TableCell>
                      {r.telegramLinkClicked ? (
                        <Badge variant="default">{translate("已点击", "Clicked")}</Badge>
                      ) : (
                        <Badge variant="outline">{translate("未点击", "Not Clicked")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.needsManualFollowUp ? (
                        <Badge variant="destructive">{translate("需跟进", "Needs Follow Up")}</Badge>
                      ) : "-"}
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
          {detailReview && (
            <div className="space-y-4">
              {/* Order info */}
              {(() => {
                const order = getOrderForReview(detailReview);
                if (!order) return null;
                return (
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
                      <p className="text-muted-foreground">{translate("付款方式", "Payment Method")}</p>
                      <p className="font-medium">{order.paymentMethodName || "-"}</p>
                    </div>
                  </div>
                );
              })()}

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
                  <Badge variant={FLOW_STATUS[detailReview.flowStatus as keyof typeof FLOW_STATUS]?.variant}>
                    {FLOW_STATUS[detailReview.flowStatus as keyof typeof FLOW_STATUS]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">{translate("链接点击状态", "Link Click Status")}</p>
                  <Badge variant={detailReview.telegramLinkClicked ? "default" : "outline"}>
                    {detailReview.telegramLinkClicked ? translate("已点击", "Clicked") : translate("未点击", "Not Clicked")}
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
                {/* Confirm fee - only when pending */}
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

                {/* Resend Flow - when sent or failed */}
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

                {/* Copy Telegram link */}
                <Button
                  variant="outline"
                  onClick={() => copyTelegramLink(detailReview)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {translate("复制 Telegram 链接", "Copy Telegram Link")}
                </Button>

                {/* Contact customer */}
                <Button variant="outline" onClick={() => contactCustomer(detailReview)}>
                  <Phone className="h-4 w-4 mr-2" />
                  {translate("联系客户", "Contact Customer")}
                </Button>

                {/* Mark for follow-up */}
                {detailReview.reviewStatus === "approved" && !detailReview.needsManualFollowUp && (
                  <Button
                    variant="outline"
                    onClick={() => followUpMutation.mutate({ reviewId: detailReview.id })}
                  >
                    {translate("标记待跟进", "Mark for Follow Up")}
                  </Button>
                )}

                {/* Cancel */}
                {detailReview.reviewStatus !== "cancelled" && (
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
          )}
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
