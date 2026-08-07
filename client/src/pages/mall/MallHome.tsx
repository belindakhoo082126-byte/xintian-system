import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, Phone, MessageCircle, MapPin, ChevronRight, Home as HomeIcon, Package, Boxes, Facebook, Navigation, X } from "lucide-react";
import { MallLangToggle } from "@/components/MallLangToggle";

export default function MallHome() {
  const [search, setSearch] = useState("");
  const [location] = useLocation();
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

  const cart = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("mall_cart") || "[]"); } catch { return []; }
  }, []);

  const cartCount = cart.reduce((sum: number, i: any) => sum + i.quantity, 0);
  const [addOnOrder, setAddOnOrder] = useState<any>(null);
  const [showAddOnBanner, setShowAddOnBanner] = useState(false);
  useEffect(() => {
    try {
      // V2.0.90: Use localStorage for persistent order session
      const saved = localStorage.getItem("xintian_mall_add_on_order");
      if (saved) {
        setAddOnOrder(JSON.parse(saved));
        setShowAddOnBanner(true);
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/mall" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.shopName} className="h-8 w-8 rounded" />
            ) : (
              <span className="text-2xl">🌿</span>
            )}
            <span className="font-bold text-lg text-[#2d6a4f]">{settings?.shopName || "心田 Xintian"}</span>
          </Link>
          <div className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索植物..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") window.location.href = `/mall?q=${encodeURIComponent(search)}`; }}
                className="pl-10"
              />
            </div>
          </div>
          <Link href="/mall/cart">
            <Button variant="ghost" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">{cartCount}</Badge>}
            </Button>
          </Link>
          {/* V2.0.90: Replace "订单查询" with "返回原订单" when add-on session exists */}
          {addOnOrder ? (
            <a href={`/order/${addOnOrder.orderNumber}/${addOnOrder.token}`}>
              <Button variant="ghost" size="sm" className="text-[#2d6a4f]">返回原订单</Button>
            </a>
          ) : null}
          <MallLangToggle />
        </div>
        {/* Category bar */}
        {categories && categories.length > 0 && (
          <div className="border-t bg-white">
            <div className="max-w-6xl mx-auto px-4 py-2 flex gap-3 overflow-x-auto">
              <Link href="/mall">
                <Button variant={categoryId ? "ghost" : "link"} size="sm" className="whitespace-nowrap">全部</Button>
              </Link>
              {categories.map((c: any) => (
                <Link key={c.id} href={`/mall?categoryId=${c.id}`}>
                  <Button variant={categoryId === c.id ? "link" : "ghost"} size="sm" className="whitespace-nowrap">{c.nameZh}</Button>
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Notices */}
      {notices && notices.length > 0 && (
        <div className="bg-[#fff3cd] border-b border-[#ffeaa7]">
          <div className="max-w-6xl mx-auto px-4 py-2 flex gap-4 overflow-x-auto text-sm text-[#856404]">
            {notices.map((n: any) => (
              <span key={n.id} className="whitespace-nowrap">📢 {n.announcement}</span>
            ))}
          </div>
        </div>
      )}

      {/* Banners */}
      {banners && banners.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="grid grid-cols-1 gap-3">
            {banners.slice(0, 1).map((b: any) => (
              <Link key={b.id} href={b.linkUrl || "#"} className="block">
                <img src={b.imageUrl} alt="banner" className="w-full rounded-xl object-cover aspect-[16/9]" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bundles Section */}
      {bundles && bundles.length > 0 && !searchQuery && !categoryId && (
        <main className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Boxes className="h-5 w-5 text-[#2d6a4f]" />
            <h2 className="text-xl font-semibold text-[#1b4332]">组合优惠</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {bundles.map((b: any) => (
              <Card key={b.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                <div className="aspect-square overflow-hidden bg-gray-100">
                  {b.coverImage ? (
                    <img src={b.coverImage} alt={b.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400"><Boxes className="h-12 w-12" /></div>
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-medium line-clamp-2 mb-1">{b.name}</p>
                  <div className="flex items-center gap-2">
                    {b.specialPrice && parseFloat(b.specialPrice) > 0 ? (
                      <>
                        <span className="text-lg font-bold text-orange-600">RM {b.specialPrice}</span>
                        <span className="text-xs text-muted-foreground line-through">RM {b.sellingPrice}</span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-[#2d6a4f]">RM {b.sellingPrice}</span>
                    )}
                    {b.originalTotalPrice && parseFloat(b.originalTotalPrice) > parseFloat(b.sellingPrice) && (
                      <span className="text-xs text-muted-foreground line-through">RM {b.originalTotalPrice}</span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1">
                    <Badge className="bg-purple-100 text-purple-700">组合包</Badge>
                    {b.bundleStock <= 5 && b.bundleStock > 0 && <Badge variant="secondary">仅剩{b.bundleStock}组</Badge>}
                    {b.bundleStock <= 0 && <Badge variant="destructive">售罄</Badge>}
                  </div>
                  {b.items && b.items.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      包含: {b.items.map((i: any) => i.productName).join('、')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      )}

      {/* Products Grid */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[#1b4332]">
            {searchQuery ? `搜索: "${searchQuery}"` : categoryId ? "分类商品" : "全部商品"}
          </h2>
          <span className="text-sm text-muted-foreground">{isProductsLoading ? "商品加载中…" : `${products?.length ?? 0} 件商品`}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {isProductsLoading && Array.from({ length: 4 }).map((_, index) => (
            <Card key={`product-skeleton-${index}`} className="overflow-hidden" aria-label="商品加载中">
              <div className="aspect-square animate-pulse bg-gray-100" />
              <CardContent className="space-y-2 p-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                <div className="h-5 w-1/2 animate-pulse rounded bg-gray-100" />
              </CardContent>
            </Card>
          ))}
          {!isProductsLoading && products?.map((p: any) => (
            <Link key={p.id} href={`/mall/product/${p.id}`}>
              <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                <div className="aspect-square overflow-hidden bg-gray-100">
                  {p.coverImageUrl ? (
                    <img src={p.coverImageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400"><Package className="h-12 w-12" /></div>
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-medium line-clamp-2 mb-1">{p.name}</p>
                  <div className="flex items-center gap-2">
                    {p.isSpecial && p.specialPrice && parseFloat(p.specialPrice) > 0 ? (
                      <>
                        <span className="text-lg font-bold text-orange-600">RM {p.specialPrice}</span>
                        <span className="text-xs text-muted-foreground line-through">RM {p.sellingPrice}</span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-[#2d6a4f]">RM {p.sellingPrice}</span>
                    )}
                    {p.compareAtPrice && parseFloat(p.compareAtPrice) > 0 && !p.isSpecial && (
                      <span className="text-xs text-muted-foreground line-through">RM {p.compareAtPrice}</span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {p.isFeatured && <Badge variant="secondary">推荐</Badge>}
                    {p.isSpecial && <Badge className="bg-orange-100 text-orange-700">特价</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {!isProductsLoading && products?.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p>暂无商品</p>
          </div>
        )}
      </main>

      {/* Add-on Order Banner */}
      {showAddOnBanner && addOnOrder && (
        <div className="sticky top-0 z-[60] bg-[#2d6a4f] text-white">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 shrink-0" />
              <span>正在为订单 <strong>{addOnOrder.orderNumber}</strong> 加单 — 选购完成后前往结算</span>
            </div>
            <div className="flex items-center gap-2">
              {cartCount > 0 && (
                <Link href="/mall/checkout">
                  <Button size="sm" variant="secondary" className="bg-white text-[#2d6a4f] hover:bg-gray-100">去结算 ({cartCount})</Button>
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
      <footer className="bg-white border-t mt-8">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p className="mb-2">{settings?.companyName || "ECOLAND NURSERY"}</p>
          <p className="mb-1">{settings?.address}</p>
          <p>© {new Date().getFullYear()} {settings?.shopName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
