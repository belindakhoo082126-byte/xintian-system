import { useState } from "react";
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
  pending: { label: "待付款", variant: "outline" },
  receipt_uploaded: { label: "已上传单据", variant: "secondary" },
  pending_review: { label: "待审核", variant: "secondary" },
  fee_confirmed: { label: "已确认会员费", variant: "default" },
  flow_sent: { label: "已发送入群Flow", variant: "default" },
  flow_failed: { label: "Flow发送失败", variant: "destructive" },
  manual_follow_up: { label: "待人工跟进", variant: "destructive" },
  completed: { label: "已完成", variant: "default" },
  cancelled: { label: "已取消", variant: "destructive" },
} as const;

const REVIEW_STATUS = {
  pending: { label: "待审核", variant: "outline" },
  approved: { label: "已通过", variant: "default" },
  rejected: { label: "已拒绝", variant: "destructive" },
} as const;

const FLOW_STATUS = {
  pending: { label: "未发送", variant: "outline" },
  sent: { label: "已发送", variant: "default" },
  failed: { label: "发送失败", variant: "destructive" },
} as const;

export default function Membership() {
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
        toast.success("会员费已确认，Messenger Flow 已自动发送");
      } else {
        toast.warning(`会员费已确认，但 Flow 发送失败: ${data.message}`);
      }
      setDetailOpen(false);
      setReviewNotes("");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const rejectMutation = trpc.membership.rejectFee.useMutation({
    onSuccess: () => {
      utils.membership.invalidate();
      utils.orders.invalidate();
      toast.success("单据已拒绝，订单已退回待付款状态");
      setDetailOpen(false);
      setReviewNotes("");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const resendMutation = trpc.membership.resendFlow.useMutation({
    onSuccess: () => {
      utils.membership.invalidate();
      toast.success("Flow 已重新发送");
    },
    onError: (e) => toast.error(`重发失败: ${e.message}`),
  });

  const followUpMutation = trpc.membership.markNeedsFollowUp.useMutation({
    onSuccess: () => {
      utils.membership.invalidate();
      utils.orders.invalidate();
      toast.success("已标记为待人工跟进");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const cancelMutation = trpc.membership.cancelMembershipOrder.useMutation({
    onSuccess: () => {
      utils.membership.invalidate();
      utils.orders.invalidate();
      toast.success("会员订单已取消");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
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
    toast.success("Telegram 链接已复制");
  }

  function contactCustomer(review: any) {
    const order = getOrderForReview(review);
    if (order?.facebookName) {
      toast.info(`请通过 Facebook Messenger 联系客户: ${order.facebookName}`);
    } else {
      toast.info("请通过订单详情获取客户联系方式");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">会员订单管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          审核会员费汇款单据，确认后自动发送 Messenger 入群 Flow
        </p>
      </div>

      <Tabs value={statusTab} onValueChange={setStatusTab}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="pending">待审核</TabsTrigger>
          <TabsTrigger value="approved">已通过</TabsTrigger>
          <TabsTrigger value="rejected">已拒绝</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单ID</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>电话</TableHead>
                <TableHead>会员费</TableHead>
                <TableHead>单据</TableHead>
                <TableHead>审核状态</TableHead>
                <TableHead>Flow状态</TableHead>
                <TableHead>发送时间</TableHead>
                <TableHead>点击链接</TableHead>
                <TableHead>人工跟进</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : reviews?.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">暂无会员审核记录</TableCell></TableRow>
              ) : reviews?.map(r => {
                const order = getOrderForReview(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">#{r.orderId}</TableCell>
                    <TableCell>{order?.facebookName || "-"}</TableCell>
                    <TableCell className="text-sm">{order?.facebookName ? "查看详情" : "-"}</TableCell>
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
                        <Badge variant="default">已点击</Badge>
                      ) : (
                        <Badge variant="outline">未点击</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.needsManualFollowUp ? (
                        <Badge variant="destructive">需跟进</Badge>
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
            <DialogTitle>会员订单审核 - #{detailReview?.orderId}</DialogTitle>
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
                      <p className="text-muted-foreground">Facebook 名称</p>
                      <p className="font-medium">{order.facebookName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">订单号</p>
                      <p className="font-mono text-sm">{order.orderNumber}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">会员费用</p>
                      <p className="font-bold text-lg text-primary">RM {order.membershipSubtotal}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">付款方式</p>
                      <p className="font-medium">{order.paymentMethodName || "-"}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Receipt preview */}
              {detailReview.receiptFileUrl && (
                <div>
                  <Label>汇款单据</Label>
                  <div className="mt-2 p-4 border rounded-lg">
                    <a href={detailReview.receiptFileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        查看单据
                      </Button>
                    </a>
                  </div>
                </div>
              )}

              {/* Flow status */}
              <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-lg">
                <div>
                  <p className="text-muted-foreground">Flow 发送状态</p>
                  <Badge variant={FLOW_STATUS[detailReview.flowStatus as keyof typeof FLOW_STATUS]?.variant}>
                    {FLOW_STATUS[detailReview.flowStatus as keyof typeof FLOW_STATUS]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">链接点击状态</p>
                  <Badge variant={detailReview.telegramLinkClicked ? "default" : "outline"}>
                    {detailReview.telegramLinkClicked ? "已点击" : "未点击"}
                  </Badge>
                </div>
                {detailReview.flowSentAt && (
                  <div>
                    <p className="text-muted-foreground">Flow 发送时间</p>
                    <p className="text-sm">{new Date(detailReview.flowSentAt).toLocaleString("zh-CN")}</p>
                  </div>
                )}
                {detailReview.flowErrorMessage && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">错误信息</p>
                    <p className="text-sm text-destructive">{detailReview.flowErrorMessage}</p>
                  </div>
                )}
              </div>

              {/* Review notes */}
              <div>
                <Label>审核备注</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="输入审核备注（可选）..."
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
                      确认会员费
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => rejectMutation.mutate({ reviewId: detailReview.id, notes: reviewNotes || undefined })}
                      disabled={rejectMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-2" />
                      拒绝单据
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
                    重新发送 Flow
                  </Button>
                )}

                {/* Copy Telegram link */}
                <Button
                  variant="outline"
                  onClick={() => copyTelegramLink(detailReview)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  复制 Telegram 链接
                </Button>

                {/* Contact customer */}
                <Button variant="outline" onClick={() => contactCustomer(detailReview)}>
                  <Phone className="h-4 w-4 mr-2" />
                  联系客户
                </Button>

                {/* Mark for follow-up */}
                {detailReview.reviewStatus === "approved" && !detailReview.needsManualFollowUp && (
                  <Button
                    variant="outline"
                    onClick={() => followUpMutation.mutate({ reviewId: detailReview.id })}
                  >
                    标记待跟进
                  </Button>
                )}

                {/* Cancel */}
                {detailReview.reviewStatus !== "cancelled" && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm("确定取消此会员订单？")) {
                        cancelMutation.mutate({ reviewId: detailReview.id });
                        setDetailOpen(false);
                      }
                    }}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    取消会员订单
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
