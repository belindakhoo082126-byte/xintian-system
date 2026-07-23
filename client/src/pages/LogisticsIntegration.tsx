import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Truck, TestTube, RefreshCw, Wallet, CheckCircle, XCircle, Package } from "lucide-react";

function formatRM(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return `RM ${Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function LogisticsIntegration() {
  const { data: providers, isLoading, refetch } = trpc.shippingProviders.list.useQuery();
  const updateMutation = trpc.shippingProviders.update.useMutation({
    onSuccess: () => { toast.success("供应商设置已更新"); refetch(); },
    onError: (e) => toast.error("更新失败: " + e.message),
  });
  const testConnectionMutation = trpc.shippingProviders.testConnection.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(`连接成功！余额: ${formatRM(data.balance)}`);
        refetch();
      } else {
        toast.error("连接失败: " + data.error);
      }
    },
    onError: (e) => toast.error("测试失败: " + e.message),
  });

  const accountInfoQuery = trpc.parceldaily.accountInfo.useQuery(undefined, { enabled: false });

  const handleTestConnection = (providerKey: string) => {
    testConnectionMutation.mutate({ providerKey });
  };

  const handleRefreshAccount = async () => {
    await accountInfoQuery.refetch();
    refetch();
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const parceldaily = providers?.find((p: any) => p.providerKey === "parceldaily");
  const parcelKing = providers?.find((p: any) => p.providerKey === "parcel_king");
  const manual = providers?.find((p: any) => p.providerKey === "manual");

  const parseCouriers = (s: string | null | undefined): string[] => {
    if (!s) return [];
    try { return JSON.parse(s); } catch { return []; }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">物流整合</h1>
        <p className="text-sm text-muted-foreground mt-1">管理物流供应商配置与 API 整合</p>
      </div>

      <Tabs defaultValue="parceldaily">
        <TabsList>
          <TabsTrigger value="parceldaily">ParcelDaily</TabsTrigger>
          <TabsTrigger value="parcel_king">Parcel King</TabsTrigger>
          <TabsTrigger value="manual">Manual Shipping</TabsTrigger>
        </TabsList>

        {/* ParcelDaily */}
        <TabsContent value="parceldaily" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-5 w-5" /> ParcelDaily
                  {parceldaily?.isEnabled && <Badge variant="default">已启用</Badge>}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection("parceldaily")}
                    disabled={testConnectionMutation.isPending}
                  >
                    <TestTube className="h-4 w-4 mr-1" />
                    {testConnectionMutation.isPending ? "测试中..." : "测试连接"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshAccount}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />刷新余额
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">环境</p>
                  <Badge variant={parceldaily?.environment === "production" ? "default" : "secondary"}>
                    {parceldaily?.environment === "production" ? "Production" : "Sandbox"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">账户余额</p>
                  <p className="text-lg font-bold">{formatRM(parceldaily?.accountBalance)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">最后同步</p>
                  <p className="text-sm">{parceldaily?.lastSyncAt ? new Date(parceldaily.lastSyncAt).toLocaleString() : "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">状态</p>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={parceldaily?.isEnabled ?? false}
                      onCheckedChange={(v) => updateMutation.mutate({ providerKey: "parceldaily", isEnabled: v })}
                    />
                    <span className="text-sm">{parceldaily?.isEnabled ? "启用" : "停用"}</span>
                  </div>
                </div>
              </div>

              {/* Credentials Info (masked) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Merchant ID</Label>
                  <Input value="••••••••••" readOnly className="bg-muted" />
                  <p className="text-xs text-muted-foreground">已配置（服务器端存储）</p>
                </div>
                <div className="space-y-2">
                  <Label>Token Key</Label>
                  <Input value="••••••••••••••••" readOnly className="bg-muted" />
                  <p className="text-xs text-muted-foreground">已配置（服务器端存储）</p>
                </div>
              </div>

              {/* Supported Couriers */}
              <div className="space-y-2">
                <Label>支持的快递</Label>
                <div className="flex flex-wrap gap-2">
                  {parseCouriers(parceldaily?.supportedCouriers).map((c: string) => (
                    <Badge key={c} variant="outline" className="capitalize">
                      <Package className="h-3 w-3 mr-1" />
                      {c.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Webhook URLs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tracking Webhook URL</Label>
                  <Input
                    value={`${window.location.origin}/api/webhooks/parceldaily/tracking`}
                    readOnly
                    className="bg-muted text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Checkout Webhook URL</Label>
                  <Input
                    value={`${window.location.origin}/api/webhooks/parceldaily/checkout`}
                    readOnly
                    className="bg-muted text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

                {/* Parcel King */}
        <TabsContent value="parcel_king" className="space-y-4">
          <ParcelKingTab parcelKing={parcelKing} updateMutation={updateMutation} />
        </TabsContent>

        {/* Manual Shipping */}
        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-5 w-5" /> Manual Shipping
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>启用手动发货</Label>
                  <p className="text-xs text-muted-foreground">手动输入快递单号，无 API 整合</p>
                </div>
                <Switch
                  checked={manual?.isEnabled ?? false}
                  onCheckedChange={(v) => updateMutation.mutate({ providerKey: "manual", isEnabled: v })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Parcel King Tab Component
// ============================================================
function ParcelKingTab({
  parcelKing,
  updateMutation,
}: {
  parcelKing: any;
  updateMutation: any;
}) {
  const isConfiguredQuery = trpc.parcelking.isConfigured.useQuery();
  const balanceQuery = trpc.parcelking.getBalance.useQuery(undefined, {
    enabled: isConfiguredQuery.data?.configured,
  });
  const servicesQuery = trpc.parcelking.getServices.useQuery(undefined, {
    enabled: isConfiguredQuery.data?.configured,
  });
  const handleRefreshBalance = async () => {
    await balanceQuery.refetch();
    await servicesQuery.refetch();
    toast.success("已刷新余额和服务列表");
  };

  const testMode = isConfiguredQuery.data?.testMode;
  const configured = isConfiguredQuery.data?.configured;

  return (
    <>
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-5 w-5" /> Parcel King
              {parcelKing?.isEnabled && <Badge variant="default">已启用</Badge>}
              {configured && (
                <Badge variant={testMode ? "secondary" : "default"}>
                  {testMode ? "Test 模式" : "Live 模式"}
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshBalance}
                disabled={!configured}
              >
                <RefreshCw className="h-4 w-4 mr-1" />刷新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Configuration Status */}
          {!configured ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              <XCircle className="h-5 w-5" />
              <p className="text-sm">API Key 尚未配置。请在环境变量中设置 PARCELKING_API_KEY 和 PARCELKING_ENV。</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <p className="text-sm">API 已连接{testMode ? "（Test 模式 — 不会产生真实运单）" : "（Live 模式 — 运单为真实订单）"}</p>
            </div>
          )}

          {/* Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">环境</p>
              <Badge variant={testMode ? "secondary" : "default"}>
                {testMode ? "Test" : "Live"}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">账户余额</p>
              {balanceQuery.isLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : balanceQuery.data?.success ? (
                <p className="text-lg font-bold">
                  {formatRM(balanceQuery.data.balance)}
                  {balanceQuery.data.currency && (
                    <span className="text-xs text-muted-foreground ml-1">{balanceQuery.data.currency}</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">-</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">最后同步</p>
              <p className="text-sm">{parcelKing?.lastSyncAt ? new Date(parcelKing.lastSyncAt).toLocaleString() : "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">状态</p>
              <div className="flex items-center gap-2">
                <Switch
                  checked={parcelKing?.isEnabled ?? false}
                  onCheckedChange={(v) => updateMutation.mutate({ providerKey: "parcel_king", isEnabled: v })}
                />
                <span className="text-sm">{parcelKing?.isEnabled ? "启用" : "停用"}</span>
              </div>
            </div>
          </div>

          {/* Credentials Info (masked) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input value="••••••••••••••••" readOnly className="bg-muted" />
              <p className="text-xs text-muted-foreground">已配置（服务器端存储）</p>
            </div>
            <div className="space-y-2">
              <Label>API 环境</Label>
              <Input value={testMode ? "test" : "live"} readOnly className="bg-muted" />
              <p className="text-xs text-muted-foreground">{testMode ? "测试环境，不产生真实运单" : "生产环境，运单为真实订单"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services List Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-5 w-5" /> 可用服务列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {servicesQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : servicesQuery.data?.success && servicesQuery.data.services?.length > 0 ? (
            <div className="space-y-2">
              {servicesQuery.data.services.map((svc: any) => (
                <div key={svc.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">ID: {svc.id}</Badge>
                    <div>
                      <p className="font-medium text-sm">{svc.name || svc.courier_name || `Service #${svc.id}`}</p>
                      {svc.courier_name && svc.name && (
                        <p className="text-xs text-muted-foreground">{svc.courier_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {svc.estimated_delivery_days && (
                      <Badge variant="secondary" className="text-xs">
                        ~{svc.estimated_delivery_days} 天
                      </Badge>
                    )}
                    {svc.support_pickup && (
                      <Badge variant="outline" className="text-xs">支持 Pickup</Badge>
                    )}
                    {svc.support_dropoff && (
                      <Badge variant="outline" className="text-xs">支持 Dropoff</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {servicesQuery.data?.error ? `加载失败: ${servicesQuery.data.error}` : "暂无可用服务"}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
