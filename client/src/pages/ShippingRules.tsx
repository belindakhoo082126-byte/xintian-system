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
import { WEST_MALAYSIA_V22_SHIPPING, getWestMalaysiaV22Specification } from "../../../shared/shippingV22";

function formatRM(n: string | number | null | undefined): string {
  if (n === null || n === undefined || n === "") return "-";
  return `RM ${Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ShippingRules() {
  const { data: rules, isLoading, refetch } = trpc.shippingRules.list.useQuery();
  const updateMutation = trpc.shippingRules.update.useMutation({
    onSuccess: () => { toast.success("运费规则已更新"); refetch(); },
    onError: (e) => toast.error("更新失败: " + e.message),
  });
  const deleteMutation = trpc.shippingRules.delete.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e) => toast.error("删除失败: " + e.message),
  });

  const [editing, setEditing] = useState<Record<number, any>>({});

  useEffect(() => {
    if (rules) {
      const map: Record<number, any> = {};
      rules.forEach((r: any) => { map[r.id] = { ...r }; });
      setEditing(map);
    }
  }, [rules]);

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

      <div className="grid grid-cols-1 gap-4">
        {rules?.map((rule: any) => {
          const edit = editing[rule.id] || rule;
          const isWestMalaysia = rule.zone === "west_malaysia";
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
                  <Button size="sm" onClick={() => handleSave(rule.id)} disabled={updateMutation.isPending}>
                    <Save className="h-4 w-4 mr-1" />保存
                  </Button>
                </div>
              </CardHeader>
              {isWestMalaysia && (
                <div className="mx-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                  <p className="font-semibold">正式运费规则 V2.2（系统计算口径）</p>
                  <p className="mt-1 leading-6">{getWestMalaysiaV22Specification()}</p>
                </div>
              )}
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>显示名称</Label>
                  <Input value={edit.displayName || ""} onChange={(e) => update(rule.id, "displayName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>免邮门槛 (RM)</Label>
                  <Input
                    type="number"
                    value={edit.freeShippingThreshold ?? ""}
                    onChange={(e) => update(rule.id, "freeShippingThreshold", e.target.value)}
                    placeholder="如: 150"
                    disabled={isWestMalaysia}
                  />
                </div>
                <div className="space-y-2">
                  <Label>免邮最大重量 (kg)</Label>
                  <Input
                    type="number"
                    value={edit.freeShippingMaxWeight ?? ""}
                    onChange={(e) => update(rule.id, "freeShippingMaxWeight", e.target.value)}
                    placeholder="如: 10"
                    disabled={isWestMalaysia}
                  />
                </div>
                <div className="space-y-2">
                  <Label>超重加价 (RM/kg)</Label>
                  <Input
                    type="number"
                    value={edit.additionalKgPrice ?? ""}
                    onChange={(e) => update(rule.id, "additionalKgPrice", e.target.value)}
                    placeholder="如: 3"
                    disabled={isWestMalaysia}
                  />
                </div>
                <div className="space-y-2">
                  <Label>默认快递</Label>
                  <Input
                    value={edit.defaultCourier ?? ""}
                    onChange={(e) => update(rule.id, "defaultCourier", e.target.value)}
                    placeholder="如: PosLaju"
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
                    value={isWestMalaysia ? getWestMalaysiaV22Specification() : edit.specialInstruction ?? ""}
                    onChange={(e) => update(rule.id, "specialInstruction", e.target.value)}
                    placeholder="如: 其余运费请到 Shopee 下单支付运费。"
                    disabled={isWestMalaysia}
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
