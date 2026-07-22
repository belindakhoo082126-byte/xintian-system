import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, AlertCircle, Crown, ShoppingCart } from "lucide-react";

export default function MemberLinkPreview({ token }: { token: string }) {
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: product, isLoading, error } = trpc.productsV2.memberGetByToken.useQuery({ token });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white dark:from-red-950/20 dark:to-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h1 className="text-xl font-semibold">链接无效</h1>
            <p className="text-sm text-muted-foreground">
              此会员购买链接已过期或已被停用。请联系客服获取新的链接。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const memberPrice = parseFloat(product.memberPrice as string) || 0;
  const sellingPrice = parseFloat(product.sellingPrice as string) || 0;
  const totalPrice = memberPrice * quantity;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 pt-4">
          <Crown className="h-6 w-6 text-purple-600" />
          <h1 className="text-xl font-semibold">心田会员专属</h1>
        </div>

        {/* Product Card */}
        <Card className="overflow-hidden">
          {product.coverImageUrl && (
            <div className="aspect-video w-full bg-muted">
              <img src={product.coverImageUrl} alt={product.name} className="w-full h-full object-cover" />
            </div>
          )}
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-xl">{product.name}</CardTitle>
                {product.shortDescZh && (
                  <p className="text-sm text-muted-foreground mt-1">{product.shortDescZh}</p>
                )}
              </div>
              <Badge className="bg-purple-100 text-purple-700">
                <Crown className="h-3 w-3 mr-1" />
                会员专享
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pricing */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-purple-600">RM {memberPrice.toFixed(2)}</span>
              {sellingPrice > memberPrice && (
                <span className="text-lg text-muted-foreground line-through">RM {sellingPrice.toFixed(2)}</span>
              )}
              {sellingPrice > memberPrice && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  省 RM {(sellingPrice - memberPrice).toFixed(2)}
                </Badge>
              )}
            </div>

            {/* Description */}
            {product.fullDescZh && (
              <div>
                <h3 className="font-medium text-sm mb-1">商品详情</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.fullDescZh}</p>
              </div>
            )}

            {/* Membership Intro */}
            {product.membershipIntro && (
              <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
                <h3 className="font-medium text-sm mb-1 flex items-center gap-1">
                  <Crown className="h-4 w-4 text-purple-600" />
                  会员权益
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.membershipIntro}</p>
              </div>
            )}

            {/* Care instructions */}
            {product.careZh && (
              <div>
                <h3 className="font-medium text-sm mb-1">养护说明</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.careZh}</p>
              </div>
            )}

            {/* Images gallery */}
            {product.images && product.images.length > 0 && (
              <div>
                <h3 className="font-medium text-sm mb-2">商品图片</h3>
                <div className="grid grid-cols-3 gap-2">
                  {product.images.map((img: any) => (
                    <img key={img.id} src={img.url} alt={img.altText || ""} className="aspect-square w-full rounded-lg object-cover border" />
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {product.videos && product.videos.length > 0 && (
              <div>
                <h3 className="font-medium text-sm mb-2">商品影片</h3>
                <div className="space-y-2">
                  {product.videos.map((video: any) => (
                    <video key={video.id} src={video.url} controls className="w-full rounded-lg border" />
                  ))}
                </div>
              </div>
            )}

            {/* Variants */}
            {product.variants && product.variants.length > 0 && (
              <div>
                <h3 className="font-medium text-sm mb-2">可选规格</h3>
                <div className="space-y-1">
                  {product.variants.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <span className="text-sm">{v.name}</span>
                      <span className="text-sm font-medium">RM {v.memberPrice ? parseFloat(v.memberPrice).toFixed(2) : memberPrice.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Form */}
        {!submitted ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                填写订单信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>购买数量</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</Button>
                  <Input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 text-center" />
                  <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}>+</Button>
                </div>
              </div>

              <div>
                <Label>姓名 *</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="您的姓名" />
              </div>

              <div>
                <Label>电话号码 *</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="012-3456789" />
              </div>

              <div>
                <Label>收货地址</Label>
                <Textarea value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} rows={2} placeholder="详细地址（如需邮寄）" />
              </div>

              {/* Total */}
              <div className="p-4 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border">
                <div className="flex items-center justify-between">
                  <span className="text-sm">会员价 x {quantity}</span>
                  <span className="text-2xl font-bold text-purple-600">RM {totalPrice.toFixed(2)}</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  if (!customerName.trim()) { toast.error("请输入姓名"); return; }
                  if (!customerPhone.trim()) { toast.error("请输入电话号码"); return; }
                  setSubmitted(true);
                  toast.success("订单已提交！我们会尽快与您联系确认。");
                }}
              >
                确认下单
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold">订单已提交</h2>
              <p className="text-sm text-muted-foreground">
                感谢您的购买！我们会通过 Messenger 与您联系确认订单详情和付款方式。
              </p>
              <div className="p-3 rounded-lg bg-muted text-left text-sm">
                <div className="flex justify-between mb-1"><span>商品</span><span>{product.name}</span></div>
                <div className="flex justify-between mb-1"><span>数量</span><span>{quantity}</span></div>
                <div className="flex justify-between font-medium"><span>总计</span><span>RM {totalPrice.toFixed(2)}</span></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-4">
          心田 Facebook 直播捉单与商城系统 · 会员专属购买链接
        </p>
      </div>
    </div>
  );
}
