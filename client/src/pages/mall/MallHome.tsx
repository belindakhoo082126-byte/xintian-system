import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, MessageCircle, MapPin, Package, Boxes, Facebook, Navigation, X, Star, TrendingDown, Sparkles, Megaphone } from "lucide-react";
import { MallLangToggle } from "@/components/MallLangToggle";
import { getMallTheme } from "@/lib/mallTheme";
import { MallThemeDecorations } from "@/components/MallThemeArtwork";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function MallHome() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const categoryId = searchParams.get("categoryId") ? parseInt(searchParams.get("categoryId")!) : undefined;
  const searchQuery = searchParams.get("q") || search;

  const { data: settings } = trpc.mall.settings.useQuery();
  const { data: banners } = trpc.mall.banners.useQuery({ type: "home_16x9" });
  const { data: notices } = trpc.mall.notices.useQuery();
  const { data: quickContacts } = trpc.mall.quickContacts.useQuery();
  const { data: categories } = trpc.mall.categories.useQuery();
  const { data: products, isLoading: isProductsLoading } = trpc.mall.products.useQuery({ categoryId, search: searchQuery || undefined });
  const { data: bundles } = trpc.productBundles.mallList.useQuery();

  // Theme colours and visual language from settings
  const theme = useMemo(() => {
    return getMallTheme(settings?.activeTheme, settings?.customThemeColors);
  }, [settings?.activeTheme, settings?.customThemeColors]);

  // V2.0.93: Use state + event listener so cart count updates in real time when items are added
  const [cart, setCart] = useState<any[]>([]);
  useEffect(() => {
    const loadCart = () => {
      try { setCart(JSON.parse(localStorage.getItem("mall_cart") || "[]")); } catch { setCart([]); }
    };
    loadCart();
    window.addEventListener("cart-updated", loadCart);
    return () => window.removeEventListener("cart-updated", loadCart);
  }, []);

  const cartCount = cart.reduce((sum: number, i: any) => sum + i.quantity, 0);
  const [addOnOrder, setAddOnOrder] = useState<any>(null);
  const [showAddOnBanner, setShowAddOnBanner] = useState(false);
  const [isPoliciesOpen, setIsPoliciesOpen] = useState(false);
  const policySections = [
    { title: "配送说明", content: settings?.shippingPolicy },
    { title: "退款条例", content: settings?.refundPolicy },
    { title: "服务条款", content: settings?.serviceTerms },
  ].filter((section) => Boolean(section.content?.trim()));
  useEffect(() => {
    try {
      const saved = localStorage.getItem("xintian_mall_add_on_order");
      if (saved) {
        setAddOnOrder(JSON.parse(saved));
        setShowAddOnBanner(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Category click handler - use setLocation for proper navigation
  function handleCategoryClick(id?: number) {
    if (id) {
      setLocation(`/mall?categoryId=${id}`);
    } else {
      setLocation(`/mall`);
    }
  }

  function handleSearch() {
    setLocation(`/mall?q=${encodeURIComponent(search)}`);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ backgroundColor: theme.background, backgroundImage: theme.visual.pattern, color: theme.font }}>
      <style>{`
        .mall-theme-primary { color: ${theme.primary}; }
        .mall-theme-bg-primary { background-color: ${theme.primary}; }
        .mall-theme-bg-button { background-color: ${theme.button}; }
        .mall-theme-border-primary { border-color: ${theme.primary}; }
        .mall-theme-text-font { color: ${theme.font}; }
        .mall-card-hover { transition: transform 260ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 260ms cubic-bezier(0.23, 1, 0.32, 1); will-change: transform; }
        .mall-card-hover:hover { box-shadow: 0 18px 36px rgba(36, 68, 44, 0.18); transform: translateY(-6px) scale(1.018); }
        .mall-card-hover:focus-within { box-shadow: 0 18px 36px rgba(36, 68, 44, 0.18); transform: translateY(-4px) scale(1.012); }
        .mall-img-zoom { transition: transform 420ms cubic-bezier(0.23, 1, 0.32, 1); }
        .mall-card-hover:hover .mall-img-zoom { transform: scale(1.075); }
        @media (prefers-reduced-motion: reduce) { .mall-card-hover, .mall-img-zoom { transition: none; } .mall-card-hover:hover, .mall-card-hover:focus-within { transform: none; } }
        .mall-theme-card { border: 1px solid ${theme.secondary}9c; box-shadow: 0 10px 28px ${theme.primary}14; }
        .mall-theme-edge { position: relative; }
        .mall-theme-edge::before { content: ""; position: absolute; z-index: 2; left: 0; right: 0; top: 0; height: 4px; background: ${theme.visual.edge}; }
      `}</style>
      <MallThemeDecorations theme={theme} />
      <div className="relative z-10">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b shadow-sm" style={{ backgroundColor: `${theme.background}f2`, borderColor: `${theme.secondary}8c`, backdropFilter: "blur(12px)" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/mall" className="flex items-center gap-2 shrink-0">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.shopName} className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              <img src={import.meta.env.VITE_APP_LOGO || ""} alt={settings?.shopName || "心田"} className="h-10 w-10 rounded-lg object-contain" />
            )}
            <span className="font-bold text-lg mall-theme-primary">{settings?.shopName || "心田 Xintian"}</span>
          </Link>
          <div className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索植物..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                className="pl-10 rounded-full"
                style={{ borderColor: theme.secondary }}
              />
            </div>
          </div>
          <Link href="/mall/checkout" className="shrink-0">
            <Button id="mall-cart-anchor" variant="ghost" className="relative" size="icon">
              <ShoppingCart className="h-5 w-5" style={{ color: theme.primary }} />
              {cartCount > 0 && <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs" style={{ backgroundColor: theme.button }}>{cartCount}</Badge>}
            </Button>
          </Link>
          {addOnOrder ? (
            <a href={`/order/${addOnOrder.orderNumber}/${addOnOrder.token}`} className="shrink-0">
              <Button variant="ghost" size="sm" className="mall-theme-primary">返回原订单</Button>
            </a>
          ) : null}
          <MallLangToggle />
        </div>
        {/* Category bar */}
        {categories && categories.length > 0 && (
          <div className="border-t" style={{ borderColor: theme.secondary + "40" }}>
            <div className="max-w-6xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
              <button
                onClick={() => handleCategoryClick(undefined)}
                className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all"
                style={categoryId ? { color: theme.font } : { backgroundColor: theme.primary, color: "#fff" }}
              >
                全部
              </button>
              {categories.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => handleCategoryClick(c.id)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all"
                  style={categoryId === c.id ? { backgroundColor: theme.primary, color: "#fff" } : { color: theme.font, backgroundColor: theme.secondary + "20" }}
                >
                  {c.nameZh}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Notices */}
      {notices && notices.length > 0 && (
        <section className="relative z-10 border-y" style={{ backgroundColor: `${theme.secondary}1c`, borderColor: `${theme.secondary}74` }} aria-label="商城公告">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-start gap-3 rounded-2xl border bg-white/80 px-3 py-3 shadow-sm backdrop-blur-sm sm:px-4" style={{ borderColor: `${theme.secondary}92`, boxShadow: `0 8px 22px ${theme.primary}0d` }}>
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: theme.visual.edge }}><Megaphone className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs font-bold tracking-[0.16em]" style={{ color: theme.primary }}>商城公告</p>
                <div className="flex flex-wrap gap-2">
                  {notices.map((n: any, index: number) => (
                    <span key={n.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm leading-5" style={{ backgroundColor: `${theme.background}cc`, borderColor: `${theme.secondary}8a`, color: theme.font }}>
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: theme.primary }}>{index + 1}</span>
                      <span className="break-words">{n.announcement}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Banners */}
      {banners && banners.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="grid grid-cols-1 gap-3">
            {banners.slice(0, 1).map((b: any) => (
              <Link key={b.id} href={b.linkUrl || "#"} className="block">
                <img src={b.imageUrl} alt="banner" className="w-full rounded-2xl object-cover aspect-[16/9] shadow-md" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bundles Section */}
      {bundles && bundles.length > 0 && !searchQuery && !categoryId && (
        <main className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-1.5 rounded-full" style={{ backgroundColor: theme.primary }} />
            <Sparkles className="h-5 w-5" style={{ color: theme.primary }} />
            <h2 className="text-xl font-bold" style={{ color: theme.font }}>组合优惠</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {bundles.map((b: any) => (
              <Link key={b.id} href={`/mall/bundle/${b.id}`}>
                <Card className="mall-theme-card mall-theme-edge overflow-hidden mall-card-hover cursor-pointer group bg-white/90" style={{ borderRadius: "16px" }}>
                  <div className="aspect-square overflow-hidden bg-gray-50 relative">
                    {b.coverImage ? (
                      <img src={b.coverImage} alt={b.name} className="w-full h-full object-cover mall-img-zoom" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><Boxes className="h-12 w-12" /></div>
                    )}
                    <div className="absolute top-2 left-2">
                      <Badge className="shadow-sm" style={{ backgroundColor: theme.primary, color: "#fff" }}>组合包</Badge>
                    </div>
                    {b.bundleStock <= 0 && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Badge variant="destructive" className="text-base px-4 py-1">售罄</Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium line-clamp-2 mb-1" style={{ color: theme.font }}>{b.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {b.specialPrice && parseFloat(b.specialPrice) > 0 ? (
                        <>
                          <span className="text-lg font-bold" style={{ color: theme.button }}>RM {b.specialPrice}</span>
                          <span className="text-xs text-muted-foreground line-through">RM {b.sellingPrice}</span>
                        </>
                      ) : (
                        <span className="text-lg font-bold" style={{ color: theme.primary }}>RM {b.sellingPrice}</span>
                      )}
                      {b.originalTotalPrice && parseFloat(b.originalTotalPrice) > parseFloat(b.sellingPrice) && (
                        <span className="text-xs text-muted-foreground line-through">RM {b.originalTotalPrice}</span>
                      )}
                    </div>
                    {b.items && b.items.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        包含: {b.items.map((i: any) => i.productName).join('、')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </main>
      )}

      {/* Products Grid */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-1.5 rounded-full" style={{ backgroundColor: theme.primary }} />
            <h2 className="text-xl font-bold" style={{ color: theme.font }}>
              {searchQuery ? `搜索: "${searchQuery}"` : categoryId ? "分类商品" : "全部商品"}
            </h2>
          </div>
          <span className="text-sm text-muted-foreground">{isProductsLoading ? "商品加载中…" : `${products?.length ?? 0} 件商品`}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {isProductsLoading && Array.from({ length: 4 }).map((_, index) => (
            <Card key={`product-skeleton-${index}`} className="mall-theme-card overflow-hidden bg-white/90" style={{ borderRadius: "16px" }}>
              <div className="aspect-square animate-pulse bg-gray-100" />
              <CardContent className="space-y-2 p-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                <div className="h-5 w-1/2 animate-pulse rounded bg-gray-100" />
              </CardContent>
            </Card>
          ))}
          {!isProductsLoading && products?.map((p: any) => (
            <Link key={p.id} href={`/mall/product/${p.id}`}>
              <Card className="mall-theme-card mall-theme-edge overflow-hidden mall-card-hover cursor-pointer group bg-white/90" style={{ borderRadius: "16px" }}>
                <div className="aspect-square overflow-hidden bg-gray-50 relative">
                  {p.coverImageUrl ? (
                    <img src={p.coverImageUrl} alt={p.name} className="w-full h-full object-cover mall-img-zoom" />
                  ) : p.images ? (
                    <img src={p.images} alt={p.name} className="w-full h-full object-cover mall-img-zoom" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><Package className="h-12 w-12" /></div>
                  )}
                  {p.isFeatured && (
                    <div className="absolute top-2 left-2">
                      <Badge className="shadow-sm flex items-center gap-0.5" style={{ backgroundColor: theme.primary, color: "#fff" }}>
                        <Star className="h-3 w-3" /> 推荐
                      </Badge>
                    </div>
                  )}
                  {p.isSpecial && (
                    <div className="absolute top-2 right-2">
                      <Badge className="shadow-sm flex items-center gap-0.5" style={{ backgroundColor: "#ea580c", color: "#fff" }}>
                        <TrendingDown className="h-3 w-3" /> 特价
                      </Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-medium line-clamp-2 mb-1" style={{ color: theme.font }}>{p.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.isSpecial && p.specialPrice && parseFloat(p.specialPrice) > 0 ? (
                      <>
                        <span className="text-lg font-bold" style={{ color: "#ea580c" }}>RM {p.specialPrice}</span>
                        <span className="text-xs text-muted-foreground line-through">RM {p.sellingPrice}</span>
                      </>
                    ) : (
                      <span className="text-lg font-bold" style={{ color: theme.primary }}>RM {p.sellingPrice}</span>
                    )}
                    {p.compareAtPrice && parseFloat(p.compareAtPrice) > 0 && !p.isSpecial && (
                      <span className="text-xs text-muted-foreground line-through">RM {p.compareAtPrice}</span>
                    )}
                  </div>
                  {p.shortDescZh && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.shortDescZh}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {!isProductsLoading && products?.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">暂无商品</p>
          </div>
        )}
      </main>

      {/* Add-on Order Banner */}
      {showAddOnBanner && addOnOrder && (
        <div className="sticky top-0 z-[60] text-white" style={{ backgroundColor: theme.primary }}>
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 shrink-0" />
              <span>正在为订单 <strong>{addOnOrder.orderNumber}</strong> 加单 — 选购完成后前往结算</span>
            </div>
            <div className="flex items-center gap-2">
              {cartCount > 0 && (
                <Link href="/mall/checkout">
                  <Button size="sm" variant="secondary" className="bg-white" style={{ color: theme.primary }}>去结算 ({cartCount})</Button>
                </Link>
              )}
              <button
                onClick={() => { setShowAddOnBanner(false); }}
                className="text-white/80 hover:text-white p-1"
                title="隐藏提示"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Contact Floating Buttons */}
      {quickContacts && quickContacts.length > 0 && (
        <div className="fixed bottom-5 right-4 z-50 flex flex-col gap-2.5">
          {quickContacts.map((c: any) => {
            const iconMap: Record<string, { Icon: any; bg: string; label: string }> = {
              whatsapp: { Icon: MessageCircle, bg: "bg-[#25D366] hover:bg-[#1da851]", label: "WhatsApp" },
              messenger: { Icon: MessageCircle, bg: "bg-[#0084FF] hover:bg-[#0066cc]", label: "FB 私聊" },
              facebook_page: { Icon: Facebook, bg: "bg-[#1877F2] hover:bg-[#0d5fb8]", label: "FB Page" },
              waze: { Icon: Navigation, bg: "bg-[#33CCFF] hover:bg-[#1ab5e6]", label: "Waze" },
              google_map: { Icon: MapPin, bg: "bg-[#EA4335] hover:bg-[#c53224]", label: "Location" },
            };
            const cfg = iconMap[c.type] || { Icon: MessageCircle, bg: "bg-gray-600 hover:bg-gray-700", label: c.name };
            const { Icon } = cfg;
            return (
              <a
                key={c.id}
                href={c.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center gap-2 ${cfg.bg} text-white shadow-lg rounded-full pl-3 pr-3 py-2.5 transition-all hover:scale-105 hover:shadow-xl`}
                title={c.name}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 opacity-0 group-hover:opacity-100">{cfg.label}</span>
              </a>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <footer className="border-t mt-8" style={{ backgroundColor: "rgba(255,255,255,0.8)", borderColor: theme.secondary + "30" }}>
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-3">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.shopName} className="h-8 w-8 rounded object-contain" />
            ) : (
              <img src={import.meta.env.VITE_APP_LOGO || ""} alt={settings?.shopName || "心田"} className="h-8 w-8 rounded object-contain" />
            )}
            <span className="font-bold mall-theme-primary">{settings?.shopName || "心田 Xintian"}</span>
          </div>
          <p className="mb-2">{settings?.companyName || "ECOLAND NURSERY"}</p>
          {settings?.address && <p className="mb-1">{settings.address}</p>}
          {settings?.phone && <p className="mb-1">📞 {settings.phone}</p>}
          {policySections.length > 0 && (
            <button type="button" onClick={() => setIsPoliciesOpen(true)} className="mt-3 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/80" style={{ borderColor: `${theme.secondary}b0`, color: theme.primary }}>
              购物条款与政策
            </button>
          )}
          <p>© {new Date().getFullYear()} {settings?.shopName || "心田 Xintian"}. All rights reserved.</p>
        </div>
      </footer>
      <Dialog open={isPoliciesOpen} onOpenChange={setIsPoliciesOpen}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto rounded-2xl border-white/80 bg-white/95" style={{ borderColor: `${theme.secondary}b8`, boxShadow: `0 18px 48px ${theme.primary}22` }}>
          <DialogHeader><DialogTitle style={{ color: theme.font }}>购物条款与政策</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {policySections.map((section) => (
              <section key={section.title} className="rounded-xl border p-4" style={{ backgroundColor: `${theme.background}b8`, borderColor: `${theme.secondary}85` }}>
                <h3 className="mb-2 text-sm font-bold" style={{ color: theme.primary }}>{section.title}</h3>
                <p className="whitespace-pre-wrap text-sm leading-6" style={{ color: theme.font }}>{section.content}</p>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
