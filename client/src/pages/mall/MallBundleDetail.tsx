import { Link, useLocation } from "wouter";
import { ChevronLeft, Package, Sparkles, Tag } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/contexts/I18nContext";
import { getMallTheme } from "@/lib/mallTheme";
import { MallThemeDecorations } from "@/components/MallThemeArtwork";

export default function MallBundleDetail() {
  const [location] = useLocation();
  const bundleId = Number(location.split("/").pop() || 0);
  const { lang, translate } = useI18n();
  const { data: settings } = trpc.mall.settings.useQuery();
  const { data: bundle, isLoading } = trpc.productBundles.mallDetail.useQuery({ id: bundleId }, { enabled: Number.isInteger(bundleId) && bundleId > 0 });
  const theme = getMallTheme(settings?.activeTheme, settings?.customThemeColors);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (!bundle) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white text-slate-900">
        <Package className="h-16 w-16 text-slate-400" />
        <p>{translate("组合商品不存在或暂未上架", "This bundle is unavailable")}</p>
        <Link href="/mall"><Button>{translate("返回商城", "Back to mall")}</Button></Link>
      </div>
    );
  }

  const displayName = lang === "en" && bundle.nameEn ? bundle.nameEn : bundle.name;
  const salePrice = bundle.specialPrice && Number(bundle.specialPrice) > 0 ? bundle.specialPrice : bundle.sellingPrice;
  const isSoldOut = Number(bundle.bundleStock) <= 0;

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ backgroundColor: theme.background, backgroundImage: theme.visual.pattern, color: theme.font }}>
      <MallThemeDecorations theme={theme} />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b bg-white/92 shadow-sm backdrop-blur" style={{ borderColor: `${theme.secondary}99` }}>
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <Link href="/mall"><Button variant="ghost" size="icon" aria-label={translate("返回商城", "Back to mall")}><ChevronLeft className="h-5 w-5" /></Button></Link>
            <span className="font-bold" style={{ color: theme.primary }}>{settings?.shopName || translate("心田商城", "Xintian Mall")}</span>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-6">
          <Card className="overflow-hidden border-white/90 bg-white/95 p-4 text-slate-900 shadow-xl backdrop-blur-sm md:p-6" style={{ borderColor: `${theme.secondary}b8`, boxShadow: `0 16px 38px ${theme.primary}1d` }}>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-50">
                {bundle.coverImage ? <img src={bundle.coverImage} alt={displayName} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><Package className="h-24 w-24" /></div>}
                <Badge className="absolute left-3 top-3 gap-1 text-white" style={{ backgroundColor: theme.primary }}><Sparkles className="h-3.5 w-3.5" />{translate("组合优惠", "Bundle offer")}</Badge>
                {isSoldOut && <div className="absolute inset-0 flex items-center justify-center bg-black/45"><Badge variant="destructive" className="px-4 py-1 text-base">{translate("售罄", "Sold out")}</Badge></div>}
              </div>
              <section className="flex flex-col justify-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold">{displayName}</h1>
                  {bundle.keyword && <p className="mt-1 text-sm text-slate-500">{translate("组合关键词", "Bundle keyword")}：{bundle.keyword}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold" style={{ color: theme.primary }}>RM {salePrice}</span>
                  {bundle.originalTotalPrice && Number(bundle.originalTotalPrice) > Number(salePrice) && <span className="text-lg text-slate-400 line-through">RM {bundle.originalTotalPrice}</span>}
                </div>
                {bundle.description && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{bundle.description}</p>}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"><Tag className="mr-2 inline h-4 w-4" />{translate("此商品为组合优惠；请通过商城首页继续选购其他商品。", "This is a bundle offer. Continue browsing from the mall home.")}</div>
                <Link href="/mall"><Button className="w-full text-white" style={{ backgroundColor: theme.primary }}>{translate("返回商城选购", "Continue shopping")}</Button></Link>
              </section>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
