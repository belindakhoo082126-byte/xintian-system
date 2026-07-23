import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, Phone, MessageCircle, MapPin, ChevronRight, Home as HomeIcon, Package } from "lucide-react";
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

  const cart = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("mall_cart") || "[]"); } catch { return []; }
  }, []);

  const cartCount = cart.reduce((sum: number, i: any) => sum + i.quantity, 0);

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
          <Link href="/mall/order-query">
            <Button variant="ghost" size="sm">订单查询</Button>
          </Link>
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
                    <span className="text-lg font-bold text-[#2d6a4f]">RM {p.sellingPrice}</span>
                    {p.compareAtPrice && parseFloat(p.compareAtPrice) > 0 && (
                      <span className="text-xs text-muted-foreground line-through">RM {p.compareAtPrice}</span>
                    )}
                  </div>
                  {p.isFeatured && <Badge className="mt-1" variant="secondary">推荐</Badge>}
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

      {/* Quick Contact Floating Buttons */}
      {quickContacts && quickContacts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {quickContacts.map((c: any) => (
            <a
              key={c.id}
              href={c.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white shadow-lg rounded-full p-3 hover:scale-110 transition-transform border"
              title={c.name}
            >
              {c.type === "whatsapp" && <MessageCircle className="h-6 w-6 text-green-600" />}
              {c.type === "messenger" && <MessageCircle className="h-6 w-6 text-blue-600" />}
              {c.type === "facebook_page" && <MessageCircle className="h-6 w-6 text-blue-500" />}
              {c.type === "waze" && <MapPin className="h-6 w-6 text-blue-700" />}
              {c.type === "google_map" && <MapPin className="h-6 w-6 text-red-500" />}
            </a>
          ))}
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
