import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Truck, Save, Plus, Trash2 } from "lucide-react";
import {
  getLalamoveSettlementSpecification,
  getWestMalaysiaFreeShippingEligibilitySpecification,
  getWestMalaysiaV22Specification,
} from "../../../shared/shippingV22";
import type { ControlledShippingConfiguration } from "../../../shared/shippingConfiguration";

function formatRM(n: string | number | null | undefined): string {
  if (n === null || n === undefined || n === "") return "-";
  return `RM ${Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ShippingRules() {
  const { data: rules, isLoading, refetch } = trpc.shippingRules.list.useQuery();
  const { data: controlledShipping, refetch: refetchControlledShipping } = trpc.shippingRules.controlled.useQuery();
  const updateMutation = trpc.shippingRules.update.useMutation({
    onSuccess: () => { toast.success("运费规则已更新"); refetch(); },
    onError: (e) => toast.error("更新失败: " + e.message),
  });
  const deleteMutation = trpc.shippingRules.delete.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e) => toast.error("删除失败: " + e.message),
  });

  const [editing, setEditing] = useState<Record<number, any>>({});
  const [controlledEditing, setControlledEditing] = useState<ControlledShippingConfiguration | null>(null);

  const updateControlledMutation = trpc.shippingRules.updateControlled.useMutation({
    onSuccess: () => {
      toast.success("统一运费参数已保存，并将同步用于结账、订单、包货与单据");
      refetchControlledShipping();
    },
    onError: (error) => toast.error("保存统一运费参数失败: " + error.message),
  });

  useEffect(() => {
    if (rules) {
      const map: Record<number, any> = {};
      rules.forEach((r: any) => { map[r.id] = { ...r }; });
      setEditing(map);
    }
  }, [rules]);

  useEffect(() => {
    if (controlledShipping) setControlledEditing(controlledShipping);
  }, [controlledShipping]);

  const handleSave = (id: number) => {
    const data = editing[id];
    if (!data) return;
    // Convert string values to numbers for decimal fields
    const payload: any = { id };
    if (data.displayName !== undefined) payload.displayName = data.displayName;
    if (data.freeShippingThreshold !== undefined) payload.freeShippingThreshold = data.freeShippingThreshold === "" ? null : parseFloat(data.freeShippingThreshold);
    if (data.freeShippingMaxWeight !== undefined) payload.freeShippingMaxWeight = data.freeShippingMaxWeight === "" ? null : parseFloat(data.freeShippingMaxWeight);
    if (data.additionalKgPrice !== undefined) payload.additionalKgPrice = data.additionalKgPrice === "" ? null : parseFloat(data.additionalKgPrice);
    if (data.defaultCourier !== undefined) payload.defaultCourier = data.defaultCourier || null;
    if (data.maxCalculateWeight !== undefined) payload.maxCalculateWeight = data.maxCalculateWeight === "" ? null : parseFloat(data.maxCalculateWeight);
    if (data.specialInstruction !== undefined) payload.specialInstruction = data.specialInstruction || null;
    if (data.isEnabled !== undefined) payload.isEnabled = data.isEnabled;
    if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder;
    updateMutation.mutate(payload);
  };

  const update = (id: number, key: string, value: any) => {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const zoneLabels: Record<string, string> = {
    west_malaysia: "西马",
    east_malaysia: "东马",
    self_pickup: "自取",
    lalamove: "Lalamove",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">运费规则</h1>
        <p className="text-sm text-muted-foreground mt-1">管理各区域的运费计算规则</p>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardHeader>
          <CardTitle className="text-base">统一生效运费参数（自动同步至结账、订单、包货与单据）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {controlledEditing && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <section className="rounded-lg border border-emerald-200 bg-white/80 p-4 space-y-3">
                <p className="font-semibold text-emerald-950">西马</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>免邮门槛（RM）</Label><Input type="number" min="0" value={controlledEditing.westMalaysia.freeShippingThreshold} onChange={(e) => setControlledEditing((v) => v && ({ ...v, westMalaysia: { ...v.westMalaysia, freeShippingThreshold: Number(e.target.value) } }))} /></div>
                  <div className="space-y-1"><Label>首段重量（kg）</Label><Input type="number" min="0.1" step="0.1" value={controlledEditing.westMalaysia.includedWeightKg} onChange={(e) => setControlledEditing((v) => v && ({ ...v, westMalaysia: { ...v.westMalaysia, includedWeightKg: Number(e.target.value) } }))} /></div>
                  <div className="space-y-1"><Label>未达门槛基础运费（RM）</Label><Input type="number" min="0" step="0.01" value={controlledEditing.westMalaysia.baseFeeBelowThreshold} onChange={(e) => setControlledEditing((v) => v && ({ ...v, westMalaysia: { ...v.westMalaysia, baseFeeBelowThreshold: Number(e.target.value) } }))} /></div>
                  <div className="space-y-1"><Label>续重（RM/kg）</Label><Input type="number" min="0" step="0.01" value={controlledEditing.westMalaysia.additionalKgFee} onChange={(e) => setControlledEditing((v) => v && ({ ...v, westMalaysia: { ...v.westMalaysia, additionalKgFee: Number(e.target.value) } }))} /></div>
                </div>
              </section>
              <section className="rounded-lg border border-blue-200 bg-white/80 p-4 space-y-3">
                <p className="font-semibold text-blue-950">东马 Pos Laju</p>
                <div className="space-y-1"><Label>结账预收（RM）</Label><Input type="number" min="0" step="0.01" value={controlledEditing.eastMalaysiaPosLaju.checkoutPrepaidFee} onChange={(e) => setControlledEditing((v) => v && ({ ...v, eastMalaysiaPosLaju: { ...v.eastMalaysiaPosLaju, checkoutPrepaidFee: Number(e.target.value) } }))} /></div>
                <div className="space-y-1"><Label>客户说明</Label><Textarea value={controlledEditing.eastMalaysiaPosLaju.settlementNote} onChange={(e) => setControlledEditing((v) => v && ({ ...v, eastMalaysiaPosLaju: { ...v.eastMalaysiaPosLaju, settlementNote: e.target.value } }))} /></div>
              </section>
              <section className="rounded-lg border border-orange-200 bg-white/80 p-4 space-y-3">
                <p className="font-semibold text-orange-950">东马 Shopee</p>
                <div className="space-y-1"><Label>本系统结账预收（RM）</Label><Input type="number" min="0" step="0.01" value={controlledEditing.eastMalaysiaShopee.checkoutPrepaidFee} onChange={(e) => setControlledEditing((v) => v && ({ ...v, eastMalaysiaShopee: { ...v.eastMalaysiaShopee, checkoutPrepaidFee: Number(e.target.value) } }))} /></div>
                <div className="space-y-1"><Label>客户说明</Label><Textarea value={controlledEditing.eastMalaysiaShopee.settlementNote} onChange={(e) => setControlledEditing((v) => v && ({ ...v, eastMalaysiaShopee: { ...v.eastMalaysiaShopee, settlementNote: e.target.value } }))} /></div>
              </section>
              <section className="rounded-lg border border-sky-200 bg-white/80 p-4 space-y-3">
                <p className="font-semibold text-sky-950">Lalamove</p>
                <div className="space-y-1"><Label>公司承担金额（RM）</Label><Input type="number" min="0" step="0.01" value={controlledEditing.lalamove.companyBearingFee} onChange={(e) => setControlledEditing((v) => v && ({ ...v, lalamove: { ...v.lalamove, companyBearingFee: Number(e.target.value) } }))} /></div>
                <div className="space-y-1"><Label>客户说明</Label><Textarea value={controlledEditing.lalamove.settlementNote} onChange={(e) => setControlledEditing((v) => v && ({ ...v, lalamove: { ...v.lalamove, settlementNote: e.target.value } }))} /></div>
              </section>
            </div>
          )}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">受保护业务规则（不可关闭）</p>
            <p className="mt-1 leading-6">{getWestMalaysiaFreeShippingEligibilitySpecification(controlledEditing?.westMalaysia)}</p>
            <p className="mt-1 leading-6">东马 Pos Laju 仍按实际费用结算；东马 Shopee 的平台代收流程与 Lalamove 实际超额补收流程保持受保护。</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => controlledEditing && updateControlledMutation.mutate(controlledEditing)} disabled={!controlledEditing || updateControlledMutation.isPending}>
              <Save className="mr-1 h-4 w-4" />保存统一运费参数
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">旧配送分区资料（仅显示／供应商资讯）</h2>
        <p className="mt-1 text-sm text-muted-foreground">以下西马、东马与 Lalamove 历史字段不会参与运费计算；请只在上方「统一生效运费参数」修改实际收费与客户说明。</p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {rules?.map((rule: any) => {
          const edit = editing[rule.id] || rule;
          const isWestMalaysia = rule.zone === "west_malaysia";
          const isLalamove = rule.zone === "lalamove";
          const usesSystemManagedShippingCalculation = isWestMalaysia || rule.zone === "east_malaysia" || isLalamove;
          return (
            <Card key={rule.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-base">
                    <Truck className="h-5 w-5" />
                    {zoneLabels[rule.zone] || rule.zone}
                    <Badge variant={rule.isEnabled ? "default" : "secondary"}>
                      {rule.isEnabled ? "启用" : "停用"}
                    </Badge>
                  </CardTitle>
                  <Button size="sm" onClick={() => handleSave(rule.id)} disabled={usesSystemManagedShippingCalculation || updateMutation.isPending}>
                    <Save className="h-4 w-4 mr-1" />{usesSystemManagedShippingCalculation ? "统一参数在上方修改" : "保存"}
                  </Button>
                </div>
              </CardHeader>
              {isWestMalaysia && (
                <div className="mx-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                  <p className="font-semibold">正式运费规则 V2.2（系统计算口径）</p>
                  <p className="mt-1 leading-6">{getWestMalaysiaV22Specification(controlledEditing?.westMalaysia)}</p>
                  <p className="mt-2 leading-6">{getWestMalaysiaFreeShippingEligibilitySpecification(controlledEditing?.westMalaysia)}</p>
                </div>
              )}
              {isLalamove && (
                <div className="mx-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                  <p className="font-semibold">Lalamove 结算规则（系统计算口径）</p>
                  <p className="mt-1 leading-6">{getLalamoveSettlementSpecification(controlledEditing?.lalamove.companyBearingFee)}</p>
                </div>
              )}
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>显示名称</Label>
                  <Input value={edit.displayName || ""} onChange={(e) => update(rule.id, "displayName", e.target.value)} disabled={usesSystemManagedShippingCalculation} />
                </div>
                <div className="space-y-2">
                  <Label>免邮门槛 (RM)</Label>
                  <Input
                    type="number"
                    value={edit.freeShippingThreshold ?? ""}
                    onChange={(e) => update(rule.id, "freeShippingThreshold", e.target.value)}
                    placeholder="如: 150"
                    disabled={usesSystemManagedShippingCalculation}
                  />
                </div>
                <div className="space-y-2">
                  <Label>免邮最大重量 (kg)</Label>
                  <Input
                    type="number"
                    value={edit.freeShippingMaxWeight ?? ""}
                    onChange={(e) => update(rule.id, "freeShippingMaxWeight", e.target.value)}
                    placeholder="如: 10"
                    disabled={usesSystemManagedShippingCalculation}
                  />
                </div>
                <div className="space-y-2">
                  <Label>超重加价 (RM/kg)</Label>
                  <Input
                    type="number"
                    value={edit.additionalKgPrice ?? ""}
                    onChange={(e) => update(rule.id, "additionalKgPrice", e.target.value)}
                    placeholder="如: 3"
                    disabled={usesSystemManagedShippingCalculation}
                  />
                </div>
                <div className="space-y-2">
                  <Label>默认快递</Label>
                  <Input
                    value={edit.defaultCourier ?? ""}
                    onChange={(e) => update(rule.id, "defaultCourier", e.target.value)}
                    placeholder="如: PosLaju"
                    disabled={usesSystemManagedShippingCalculation}
                  />
                </div>
                <div className="space-y-2">
                  <Label>最大计算重量 (kg)</Label>
                  <Input
                    type="number"
                    value={edit.maxCalculateWeight ?? ""}
                    onChange={(e) => update(rule.id, "maxCalculateWeight", e.target.value)}
                    placeholder="如: 2 (东马)"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>特殊说明</Label>
                  <Textarea
                    value={isWestMalaysia
                      ? `${getWestMalaysiaV22Specification(controlledEditing?.westMalaysia)}\n${getWestMalaysiaFreeShippingEligibilitySpecification(controlledEditing?.westMalaysia)}`
                      : isLalamove
                        ? getLalamoveSettlementSpecification()
                        : edit.specialInstruction ?? ""}
                    onChange={(e) => update(rule.id, "specialInstruction", e.target.value)}
                    placeholder="如: 其余运费请到 Shopee 下单支付运费。"
                    disabled={usesSystemManagedShippingCalculation}
                  />
                </div>
                <div className="space-y-2">
                  <Label>排序</Label>
                  <Input
                    type="number"
                    value={edit.sortOrder ?? 0}
                    onChange={(e) => update(rule.id, "sortOrder", parseInt(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between md:col-span-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={edit.isEnabled ?? true}
                      onCheckedChange={(v) => update(rule.id, "isEnabled", v)}
                    />
                    <Label>启用此规则</Label>
                  </div>
                  {rule.zone !== "west_malaysia" && rule.zone !== "east_malaysia" && rule.zone !== "self_pickup" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate({ id: rule.id })}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />删除
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
