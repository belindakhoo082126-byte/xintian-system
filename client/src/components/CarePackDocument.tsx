import { forwardRef } from "react";
import { AlertTriangle, Download, Leaf, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type CarePackDocumentProps = {
  document: any;
  logoUrl: string;
  employeeMode?: boolean;
  onPrint?: () => void;
  onSavePdf?: () => void;
};

const textOrPending = (value?: string | null, employeeMode = false) => value?.trim() || (employeeMode ? "资料待补充" : "-");

const CarePackDocument = forwardRef<HTMLElement, CarePackDocumentProps>(function CarePackDocument({ document, logoUrl, employeeMode = false, onPrint, onSavePdf }, ref) {
  const title = employeeMode ? "包裹内商品养护／使用说明" : document?.title || "商品养护／使用知识包";
  const products = Array.isArray(document?.products) ? document.products : [];
  const printModeClass = employeeMode ? "care-pack-document--employee" : "care-pack-document--customer";

  return (
    <main ref={ref} data-care-pack-export-root className={`care-pack-document ${printModeClass} mx-auto w-full max-w-5xl ${employeeMode ? "bg-white" : "bg-stone-50"}`}>
      <style>{`
        @media print {
          @page { size: ${employeeMode ? "A5 portrait" : "A4 portrait"}; margin: ${employeeMode ? "8mm" : "12mm"}; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .care-pack-document, .care-pack-document * { visibility: visible !important; }
          .care-pack-document {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            background: #fff !important;
          }
          .care-pack-actions { display: none !important; }
          .care-pack-item { break-inside: avoid; page-break-inside: avoid; }
          .care-pack-document--customer .care-pack-item > div {
            display: flex !important;
            flex-direction: row !important;
            gap: 1rem !important;
            padding: 1.25rem !important;
          }
          .care-pack-document--customer .care-pack-product-image {
            display: block !important;
            width: 9rem !important;
            height: 8rem !important;
            flex: 0 0 9rem !important;
          }
          .care-pack-document--customer .care-pack-product-image img {
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
          }
          .care-pack-document--customer dl {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            column-gap: 1.5rem !important;
          }
          .care-pack-document--employee .care-pack-product-image,
          .care-pack-document--employee .care-pack-image-placeholder { display: none !important; }
        }
      `}</style>
      <header className="border-b border-emerald-900/15 bg-white px-5 py-6 sm:px-8">
        <div className="flex items-center gap-4">
          <img src={logoUrl} alt="心田 Logo" className="h-12 w-12 rounded-full border border-emerald-900/10 object-contain" />
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.18em] text-emerald-800">XINTIAN · 心田</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
            {!employeeMode && document?.intro ? <p className="mt-2 text-sm leading-6 text-stone-600">{document.intro}</p> : null}
          </div>
        </div>
        {!employeeMode && onPrint ? (
          <div className="care-pack-actions mt-5 flex flex-wrap gap-2">
            <Button onClick={onPrint} className="bg-emerald-800 hover:bg-emerald-900">
              <Printer className="mr-2 h-4 w-4" />打印
            </Button>
            {onSavePdf ? <Button variant="outline" onClick={onSavePdf}><Download className="mr-2 h-4 w-4" />保存PDF</Button> : null}
          </div>
        ) : null}
      </header>

      <section className="space-y-5 px-5 py-6 sm:px-8">
        {products.length === 0 ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            此订单目前没有需要显示养护／使用说明的有效商品。
          </div>
        ) : products.map((product: any, index: number) => {
          const isPlant = product.content?.profileType === "plant";
          const missing = product.missing || [];
          return (
            <article key={`${product.productName}-${product.variationName || index}`} className="care-pack-item overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:p-6">
                {!employeeMode ? (
                  <div className="care-pack-product-image h-32 w-full shrink-0 overflow-hidden rounded-xl bg-stone-100 sm:w-36">
                    {product.images?.[0] ? <img src={product.images[0]} alt={product.productName} className="h-full w-full object-cover" /> : <div className="care-pack-image-placeholder flex h-full items-center justify-center text-stone-400"><Leaf className="h-8 w-8" /></div>}
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-lg font-semibold text-stone-900">{product.productName}</h2>
                    {product.variationName ? <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-medium text-emerald-900">{product.variationName}</span> : null}
                  </div>
                  {employeeMode && missing.length > 0 ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-950">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>此商品的以下资料尚待员工补充：{missing.map((item: any) => item.label).join("、")}。</span>
                    </div>
                  ) : null}
                  {isPlant ? (
                    <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                      <CareField label="光线" value={product.content?.plant?.light} employeeMode={employeeMode} />
                      <CareField label="水分／浇水" value={product.content?.plant?.water} employeeMode={employeeMode} />
                      <CareField label="施肥" value={product.content?.plant?.fertilizer} employeeMode={employeeMode} />
                      <CareField label="修剪" value={product.content?.plant?.pruning} employeeMode={employeeMode} />
                      <CareField label="注意事项" value={product.content?.plant?.notes} employeeMode={employeeMode} wide />
                    </dl>
                  ) : (
                    <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                      <CareField label="用途" value={product.content?.use?.purpose} employeeMode={employeeMode} />
                      <CareField label="使用方法" value={product.content?.use?.usageMethod} employeeMode={employeeMode} />
                      <CareField label="剂量" value={product.content?.use?.dosage} employeeMode={employeeMode} />
                      <CareField label="频率" value={product.content?.use?.frequency} employeeMode={employeeMode} />
                      <CareField label="适用对象" value={product.content?.use?.suitableFor} employeeMode={employeeMode} />
                      <CareField label="安全注意事项" value={product.content?.use?.safetyNotes} employeeMode={employeeMode} />
                      {product.content?.use?.additionalNotes ? <CareField label="补充说明" value={product.content?.use?.additionalNotes} employeeMode={employeeMode} wide /> : null}
                    </dl>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
});

export default CarePackDocument;

function CareField({ label, value, employeeMode = false, wide = false }: { label: string; value?: string | null; employeeMode?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="font-medium text-emerald-900">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap leading-6 text-stone-700">{textOrPending(value, employeeMode)}</dd>
    </div>
  );
}
