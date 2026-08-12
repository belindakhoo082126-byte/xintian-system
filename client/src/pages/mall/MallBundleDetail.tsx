import { Link, useLocation } from "wouter";
import { ChevronLeft, Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { getMallTheme } from "@/lib/mallTheme";
import { MallThemeDecorations } from "@/components/MallThemeArtwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function MallBundleDetail() {
  const [location] = useLocation();
  const bundleId = Number(location.split("/").filter(Boolean).pop());
  const { lang, translate } = useI18n();
  const t = (zh: string, en: string) => translate(zh, en);
  const { data: settings } = trpc.mall.settings.useQuery();
  const { data: bundle, isLoading } = trpc.productBundles.mallDetail.useQuery(
    { id: bundleId },
    { enabled: Number.isInteger(bundleId) && bundleId > 0 },
  );
  const theme = getMallTheme(settings?.activeTheme, settings?.customThemeColors);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (!bundle) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white px-4 text-center">
        <Package className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">{t("组合商品不存在或暂时无法购买", "This bundle is unavailable")}</p>
        <Link href="/mall"><Button>{t("返回商城", "Back to Mall")}</Button></Link>
      </div>
    );
  }

  const salePrice = Number(bundle.specialPrice) > 0 ? bundle.specialPrice : bundle.sellingPrice;
  const hasOriginalPrice = Number(bundle.originalTotalPrice) > Number(salePrice);
  const displayName = lang === "en" && bundle.nameEn ? bundle.nameEn : bundle.name;

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ backgroundColor: theme.background, backgroundImage: theme.visual.pattern, color: theme.font }}>
      <MallThemeDecorations theme={theme} />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b shadow-sm" style={{ backgroundColor: `${theme.background}f2`, borderColor: `${theme.secondary}8c`, backdropFilter: "blur(12px)" }}>
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/mall"><Button variant="ghost" size="icon" aria-label={t("返回商城", "Back to Mall")}><ChevronLeft className="h-5 w-5" /></Button></Link>
            <Link href="/mall" className="font-bold text-lg" style={{ color: theme.primary }}>{settings?.shopName || t("心田", "Xintian")}</Link>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="overflow-hidden border-white/90 bg-white/94" style={{ borderColor: `${theme.secondary}a8`, boxShadow: `0 10px 28px ${theme.primary}14` }}>
              <div className="aspect-square bg-stone-100">
                {bundle.coverImage ? (
                  <img src={bundle.coverImage} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-20 w-20" /></div>
                )}
              </div>
            </Card>

            <Card className="border-white/90 bg-white/94" style={{ borderColor: `${theme.secondary}a8`, boxShadow: `0 10px 28px ${theme.primary}14` }}>
              <CardContent className="space-y-5 p-5">
                <div>
                  <Badge style={{ backgroundColor: theme.primary, color: "#fff" }}>{t("组合优惠", "Bundle offer")}</Badge>
                  <h1 className="mt-3 text-2xl font-bold">{displayName}</h1>
                  {bundle.keyword && <p className="mt-1 text-sm text-muted-foreground">{t("下单关键词", "Order keyword")}: {bundle.keyword}</p>}
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold" style={{ color: theme.primary }}>RM {Number(salePrice).toFixed(2)}</span>
                  {hasOriginalPrice && <span className="text-base text-muted-foreground line-through">RM {Number(bundle.originalTotalPrice).toFixed(2)}</span>}
                </div>

                {bundle.description && <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{bundle.description}</p>}

                <section className="rounded-xl border border-stone-200 bg-stone-50/90 p-4">
                  <h2 className="font-semibold">{t("组合内容", "What's included")}</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {(bundle.items || []).map((item: any) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 border-b border-stone-200/80 pb-2 last:border-0 last:pb-0">
                        <span>{item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</span>
                        <span className="shrink-0 font-medium">× {item.qtyPerBundle}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <Link href="/mall"><Button className="w-full" style={{ backgroundColor: theme.primary }}>{t("返回继续选购", "Continue shopping")}</Button></Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
