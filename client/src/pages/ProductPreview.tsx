import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

export default function ProductPreview({ productId }: { productId: number }) {
  const { data: product, isLoading, error } = trpc.productsV2.publicGetById.useQuery({ id: productId });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">商品不存在</h1>
            <p className="text-sm text-muted-foreground">此商品可能已下架或不存在。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const p = product as any;
  const sellingPrice = parseFloat(p.sellingPrice) || 0;
  const compareAtPrice = parseFloat(p.compareAtPrice) || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Product Header */}
        <Card className="overflow-hidden">
          {p.coverImageUrl && (
            <div className="aspect-video w-full bg-muted">
              <img src={p.coverImageUrl} alt={p.name} className="w-full h-full object-cover" />
            </div>
          )}
          <CardHeader>
            <CardTitle className="text-2xl">{p.name}</CardTitle>
            {p.shortDescZh && (
              <p className="text-sm text-muted-foreground mt-1">{p.shortDescZh}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pricing */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold">RM {sellingPrice.toFixed(2)}</span>
              {compareAtPrice > sellingPrice && (
                <span className="text-lg text-muted-foreground line-through">RM {compareAtPrice.toFixed(2)}</span>
              )}
            </div>

            {/* Description */}
            {p.fullDescZh && (
              <div>
                <h3 className="font-medium text-sm mb-1">商品详情</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.fullDescZh}</p>
              </div>
            )}

            {/* Care instructions */}
            {p.careZh && (
              <div>
                <h3 className="font-medium text-sm mb-1">养护说明</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.careZh}</p>
              </div>
            )}

            {/* Dimensions */}
            {p.dimensions && (() => {
              const dims = p.dimensions as any;
              return (
                <div>
                  <h3 className="font-medium text-sm mb-1">尺寸</h3>
                  <div className="flex gap-3 text-sm text-muted-foreground">
                    {dims.diameter && <span>口径: {dims.diameter}cm</span>}
                    {dims.height && <span>高度: {dims.height}cm</span>}
                    {dims.length && <span>长度: {dims.length}cm</span>}
                    {dims.width && <span>宽度: {dims.width}cm</span>}
                  </div>
                </div>
              );
            })()}

            {/* Images */}
            {p.images && (p.images as any[]).length > 0 && (
              <div>
                <h3 className="font-medium text-sm mb-2">商品图片</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(p.images as any[]).map((img: any) => (
                    <img key={img.id} src={img.url} alt={img.altText || ""} className="aspect-square w-full rounded-lg object-cover border" />
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {p.videos && (p.videos as any[]).length > 0 && (
              <div>
                <h3 className="font-medium text-sm mb-2">商品影片</h3>
                <div className="space-y-2">
                  {(p.videos as any[]).map((video: any) => (
                    <video key={video.id} src={video.url} controls className="w-full rounded-lg border" />
                  ))}
                </div>
              </div>
            )}

            {/* Variants */}
            {p.variants && (p.variants as any[]).length > 0 && (
              <div>
                <h3 className="font-medium text-sm mb-2">可选规格</h3>
                <div className="space-y-1">
                  {(p.variants as any[]).map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <span className="text-sm">{v.name}</span>
                      <span className="text-sm font-medium">RM {v.sellingPrice ? parseFloat(v.sellingPrice).toFixed(2) : sellingPrice.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-4">
          心田商城 · 商品预览
        </p>
      </div>
    </div>
  );
}
