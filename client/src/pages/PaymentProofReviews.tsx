import { useState } from "react";
import { Link } from "wouter";
import { Check, Eye, Pencil, ReceiptText, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ImageZoomDialog } from "@/components/ImageZoomDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABELS: Record<string, string> = { pending: "待审核", approved: "已批准", rejected: "已拒绝" };
type PaymentProof = {
  id: number; orderId: number; orderNumber: string; customerName: string | null; amount: string | number | null;
  paymentMethod: string | null; receiptUrl: string | null; notes: string | null; paymentSource: string | null;
  createdAt: Date | string | null; reviewStatus: string;
};

export default function PaymentProofReviews() {
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editing, setEditing] = useState<{ id: number; amount: string; orderNumber: string } | null>(null);
  const { data: proofs, isLoading, refetch } = trpc.paymentProofReviews.list.useQuery({ status: "pending", limit: 50 });
  const review = trpc.orders.reviewPayment.useMutation({
    onSuccess: () => { toast.success("付款凭据已完成审核，订单余额已同步更新"); setRejecting(null); setRejectReason(""); refetch(); },
    onError: (error: { message: string }) => toast.error(`审核失败：${error.message}`),
  });
  const editPayment = trpc.orders.editPayment.useMutation({
    onSuccess: () => { toast.success("凭据金额已更正，请继续核对图片后再批准"); setEditing(null); refetch(); },
    onError: (error: { message: string }) => toast.error(`更正失败：${error.message}`),
  });

  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">付款凭据审核</h1>
          <p className="mt-1 text-sm text-muted-foreground">客户商城或 Messenger 提交的凭据均会在此待审核；批准前不会计入已付款。</p>
        </div>
        <Link href="/order-change-requests"><Button variant="outline">订单变更审核</Button></Link>
      </div>

      {isLoading ? <div className="py-12 text-center text-muted-foreground">加载中...</div> : !proofs?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><ReceiptText className="mx-auto mb-3 h-12 w-12 opacity-30" /><p>暂无待审核付款凭据</p></CardContent></Card>
      ) : <div className="space-y-3">{(proofs as PaymentProof[]).map((proof) => (
        <Card key={proof.id}><CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-medium">{proof.orderNumber}</span><Badge className="bg-amber-100 text-amber-800">{STATUS_LABELS[proof.reviewStatus] || proof.reviewStatus}</Badge><Badge variant="outline">{proof.paymentSource === "customer_upload" ? "客户上传" : proof.paymentSource || "客户凭据"}</Badge></div>
            <div className="text-sm text-muted-foreground">客户：{proof.customerName || "未知"}　|　申报金额：RM {Number(proof.amount || 0).toFixed(2)}　|　方式：{proof.paymentMethod || "Online Transfer"}{Number(proof.amount || 0) <= 0 ? <span className="ml-2 font-medium text-amber-700">金额待核对，须先更正</span> : null}</div>
            <div className="text-xs text-muted-foreground">提交时间：{proof.createdAt ? new Date(proof.createdAt).toLocaleString() : "—"}{proof.notes ? `　|　备注：${proof.notes}` : ""}</div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {proof.receiptUrl && <Button variant="outline" size="sm" onClick={() => setPreview({ url: proof.receiptUrl!, label: `${proof.orderNumber} 汇款凭据` })}><Eye className="mr-1 h-4 w-4" />查看凭据</Button>}
            <Button variant="outline" size="sm" onClick={() => setEditing({ id: proof.id, amount: String(proof.amount || ""), orderNumber: proof.orderNumber })}><Pencil className="mr-1 h-4 w-4" />更正金额</Button>
            <Button size="sm" onClick={() => review.mutate({ paymentId: proof.id, action: "approve" })} disabled={review.isPending || Number(proof.amount || 0) <= 0}><Check className="mr-1 h-4 w-4" />批准</Button>
            <Button variant="destructive" size="sm" onClick={() => setRejecting(proof.id)} disabled={review.isPending}><X className="mr-1 h-4 w-4" />拒绝</Button>
          </div>
        </CardContent></Card>
      ))}</div>}

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent><DialogHeader><DialogTitle>拒绝付款凭据</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">拒绝后该笔款项不会计入订单已付款金额。请填写原因，方便客服后续核对。</p><Textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="例如：金额不符、图片不清晰、未能核对转账记录" rows={3} /><DialogFooter><Button variant="outline" onClick={() => setRejecting(null)}>取消</Button><Button variant="destructive" disabled={review.isPending || rejecting === null} onClick={() => rejecting !== null && review.mutate({ paymentId: rejecting, action: "reject", rejectReason })}>确认拒绝</Button></DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent><DialogHeader><DialogTitle>更正付款凭据金额</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">请以汇款凭据图片和银行记录为准。更正金额不会自动批准付款。</p><Input inputMode="decimal" value={editing?.amount || ""} onChange={(event) => setEditing((current) => current ? { ...current, amount: event.target.value } : current)} placeholder="例如 150.00" /><DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>取消</Button><Button disabled={editPayment.isPending || !editing || !(Number(editing.amount) > 0)} onClick={() => editing && editPayment.mutate({ paymentId: editing.id, amount: Number(editing.amount).toFixed(2) })}>保存金额</Button></DialogFooter></DialogContent>
      </Dialog>
      <ImageZoomDialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)} src={preview?.url} alt={preview?.label || "付款凭据"} title={preview?.label || "付款凭据预览"} />
    </div>
  );
}
