import { useState } from "react";
import { Copy, ExternalLink, FileText, Loader2, Printer, RefreshCw, Send, ShieldBan } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getCompanyLogoUrl } from "@shared/brandAssets";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CarePackDocument from "@/components/CarePackDocument";

export default function OrderCarePackAdminPanel({ orderId, compact = false }: { orderId: number; compact?: boolean }) {
  const utils = trpc.useUtils();
  const [printOpen, setPrintOpen] = useState(false);
  const { data: carePack, isLoading } = trpc.carePacks.getForOrder.useQuery({ orderId });
  const { data: companySettings } = trpc.settings.get.useQuery(undefined, { staleTime: 60_000 });
  const logoUrl = getCompanyLogoUrl(companySettings);
  const refresh = () => utils.carePacks.getForOrder.invalidate({ orderId });

  const record = trpc.carePacks.recordStaffAction.useMutation();
  const ensure = trpc.carePacks.ensureForOrder.useMutation({
    onSuccess: () => { toast.success("已建立订单知识包链接"); refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const rebuild = trpc.carePacks.rebuildForOrder.useMutation({
    onSuccess: () => { toast.success("已重建客户知识包链接；旧链接已失效"); refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const revoke = trpc.carePacks.revokeForOrder.useMutation({
    onSuccess: () => { toast.success("知识包链接已废止"); refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const resend = trpc.orders.resendCheckout.useMutation({
    onSuccess: async () => {
      await record.mutateAsync({ orderId, action: "manual_resent" }).catch(() => undefined);
      toast.success("已通过原有Checkout通知重发，并附上知识包链接");
    },
    onError: (error) => toast.error(`重发失败：${error.message}`),
  });

  async function copyLink() {
    if (!carePack?.path) return;
    await navigator.clipboard.writeText(`${window.location.origin}${carePack.path}`);
    await record.mutateAsync({ orderId, action: "link_copied" }).catch(() => undefined);
    toast.success("客户知识包链接已复制");
  }

  async function printEmployee() {
    await record.mutateAsync({ orderId, action: "employee_print" }).catch(() => undefined);
    window.print();
  }

  if (isLoading) {
    return compact ? null : <Card><CardContent className="py-5 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载订单知识包…</CardContent></Card>;
  }
  if (!carePack) {
    return (
      <Card className={compact ? "border-dashed" : "border-emerald-200 bg-emerald-50/30"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div><p className="font-medium">客户图文养护包</p><p className="mt-1 text-xs text-muted-foreground">尚未建立。建立后，客户链接会显示当前订单商品的真实照片及员工填写的养护／使用资料。</p></div>
          <Button size="sm" onClick={() => ensure.mutate({ orderId })} disabled={ensure.isPending}>{ensure.isPending ? "建立中…" : "建立客户图文包"}</Button>
        </CardContent>
      </Card>
    );
  }

  const isRevoked = carePack.pack.status === "revoked";
  const busy = rebuild.isPending || revoke.isPending || resend.isPending;
  const missingText = (carePack.missing || []).map((item: any) => `${item.productName}${item.variationName ? `（${item.variationName}）` : ""}：${item.label}`).join("；");

  return (
    <Card className={compact ? "border-emerald-200" : "border-emerald-200 bg-emerald-50/20"}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">客户图文养护包</CardTitle>
          <Badge variant={isRevoked ? "destructive" : carePack.pack.status === "finalized" ? "default" : "secondary"}>{isRevoked ? "已废止" : carePack.pack.status === "finalized" ? "最终快照已冻结" : "动态同步中"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {missingText ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">缺资料提示：{missingText}</div> : null}
        {isRevoked ? <p className="text-sm text-muted-foreground">此订单的客户链接已失效，客户无法读取任何知识包内容。</p> : null}
        <div className="flex flex-wrap gap-2">
          {!isRevoked && carePack.path ? (
            <>
              <Button size="sm" variant="outline" onClick={() => { record.mutate({ orderId, action: "employee_view" }); window.open(carePack.path!, "_blank", "noopener,noreferrer"); }}><ExternalLink className="mr-1.5 h-4 w-4" />查看客户图文版</Button>
              <Button size="sm" variant="outline" onClick={copyLink}><Copy className="mr-1.5 h-4 w-4" />复制客户图文链接</Button>
              <Button size="sm" variant="outline" onClick={() => resend.mutate({ orderId })} disabled={busy}><Send className="mr-1.5 h-4 w-4" />重发Checkout＋图文包</Button>
              <Button size="sm" variant="outline" onClick={() => { record.mutate({ orderId, action: "employee_view" }); setPrintOpen(true); }}><Printer className="mr-1.5 h-4 w-4" />员工无图A5打印</Button>
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-50" disabled={busy} onClick={() => { if (window.confirm("重建后旧客户知识包链接会立即失效，是否继续？")) { rebuild.mutate({ orderId }); } }}><RefreshCw className="mr-1.5 h-4 w-4" />重建链接</Button>
              <Button size="sm" variant="outline" className="border-red-300 text-red-800 hover:bg-red-50" disabled={busy} onClick={() => { if (window.confirm("废止后客户将无法打开此知识包，是否继续？")) { revoke.mutate({ orderId, reason: "员工手动废止知识包链接" }); } }}><ShieldBan className="mr-1.5 h-4 w-4" />废止</Button>
            </>
          ) : <Button size="sm" onClick={() => rebuild.mutate({ orderId })} disabled={busy}><RefreshCw className="mr-1.5 h-4 w-4" />重建客户链接</Button>}
        </div>
      </CardContent>
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-h-[95vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>员工无图A5包货说明</DialogTitle></DialogHeader>
          <div className="care-pack-actions flex justify-end"><Button onClick={printEmployee}><Printer className="mr-2 h-4 w-4" />打印无图A5版</Button></div>
          {carePack.document ? <CarePackDocument document={carePack.document} logoUrl={logoUrl} employeeMode /> : <div className="py-8 text-center text-muted-foreground"><FileText className="mx-auto mb-2 h-6 w-6" />没有可打印的知识包内容</div>}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
