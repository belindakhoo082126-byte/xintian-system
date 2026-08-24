import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getCompanyLogoUrl } from "@shared/brandAssets";
import CarePackDocument from "@/components/CarePackDocument";
import { toast } from "sonner";

export default function CustomerCarePackPage({ token }: { token: string }) {
  const viewedRef = useRef(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const { data: document, isLoading, error } = trpc.publicCarePack.getByToken.useQuery({ token }, { enabled: token.length >= 32, retry: false });
  const { data: companySettings } = trpc.publicCarePack.brand.useQuery(undefined, { staleTime: 60_000 });
  const recordAction = trpc.publicCarePack.recordAction.useMutation();
  const pdfDownload = trpc.publicCarePack.downloadPdf.useQuery({ token }, { enabled: false, retry: false });
  const logoUrl = getCompanyLogoUrl(companySettings);

  useEffect(() => {
    if (document && !viewedRef.current) {
      viewedRef.current = true;
      recordAction.mutate({ token, action: "customer_view" });
    }
  }, [document, recordAction, token]);

  async function handlePrint() {
    await recordAction.mutateAsync({ token, action: "customer_print" }).catch(() => undefined);
    window.print();
  }

  async function handleSavePdf() {
    if (savingPdf) return;
    setSavingPdf(true);
    try {
      const result = await pdfDownload.refetch();
      if (!result.data) throw result.error || new Error("PDF下载资料不可用");
      const bytes = Uint8Array.from(atob(result.data.contentBase64), (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = result.data.fileName;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("知识包PDF已开始下载");
    } catch (error) {
      console.error("[Care Pack PDF]", error);
      toast.error("PDF生成失败，请稍后重试或使用打印功能保存PDF。");
    } finally {
      setSavingPdf(false);
    }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-stone-50 px-4 py-24 text-center text-stone-600"><Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin" />正在加载商品养护／使用知识包…</div>;
  }
  if (error || !document) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-5">
        <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-9 w-9 text-amber-700" />
          <h1 className="mt-4 text-xl font-semibold text-stone-900">知识包链接无效或已失效</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">此链接可能已被废止，或订单已取消。请联系心田工作人员协助处理。</p>
        </div>
      </div>
    );
  }
  return <div className="min-h-screen bg-stone-50 py-5 sm:py-8"><CarePackDocument document={document} logoUrl={logoUrl} onPrint={handlePrint} onSavePdf={handleSavePdf} /></div>;
}
