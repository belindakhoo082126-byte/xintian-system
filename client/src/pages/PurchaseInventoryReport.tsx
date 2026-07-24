import { useState, useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Truck, Package, DollarSign, AlertTriangle, Boxes } from "lucide-react";
import { Link } from "wouter";

const PRESETS = [
  { value: "today", label: { zh: "今天", en: "Today" } },
  { value: "yesterday", label: { zh: "昨天", en: "Yesterday" } },
  { value: "this_week", label: { zh: "本周", en: "This Week" } },
  { value: "this_month", label: { zh: "本月", en: "This Month" } },
  { value: "last_month", label: { zh: "上个月", en: "Last Month" } },
  { value: "this_year", label: { zh: "今年", en: "This Year" } },
  { value: "custom", label: { zh: "自定义", en: "Custom" } },
];

function formatRM(n: number | undefined | null): string {
  if (n === undefined || n === null) return "RM 0.00";
  return `RM ${Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PurchaseInventoryReport() {
  const { lang, translate } = useI18n();
  const [preset, setPreset] = useState("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const queryParams = useMemo(
    () => (preset === "custom" ? { preset, customStart, customEnd } : { preset }),
    [preset, customStart, customEnd],
  );

  const enabled = preset !== "custom" || (customStart !== "" && customEnd !== "");
  const { data: report, isLoading } = trpc.reports.purchaseInventory.useQuery(queryParams, { enabled });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/profit-report">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{translate("进货与库存报告", "Purchase and Inventory Report")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{translate("采购统计与库存状态一览", "Purchase statistics and inventory status at a glance")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <Button key={p.value} size="sm" variant={preset === p.value ? "default" : "outline"} onClick={() => setPreset(p.value)}>
              {p.label[lang]}
            </Button>
          ))}
      </div>

      {preset === "custom" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-2">
                <Label>{translate("开始日期", "Start Date")}</Label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{translate("结束日期", "End Date")}</Label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : report ? (
        <>
          {/* Purchase Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <Truck className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{translate("采购订单数", "Purchase Orders")}</p>
                    <p className="text-lg font-bold text-blue-600">{report.purchase.totalOrders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{translate("采购总额", "Total Purchase Amount")}</p>
                    <p className="text-lg font-bold text-green-600">{formatRM(report.purchase.totalAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                    <Package className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{translate("已确认", "Confirmed")}</p>
                    <p className="text-lg font-bold text-emerald-600">{report.purchase.confirmedCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                    <Package className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{translate("草稿", "Draft")}</p>
                    <p className="text-lg font-bold text-amber-600">{report.purchase.draftCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Inventory Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                    <Boxes className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{translate("商品种类", "Product Categories")}</p>
                    <p className="text-lg font-bold text-purple-600">{report.inventory.productCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20">
                    <Package className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{translate("总库存", "Total Stock")}</p>
                    <p className="text-lg font-bold text-indigo-600">{report.inventory.totalStock}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{translate("库存价值", "Stock Value")}</p>
                    <p className="text-lg font-bold text-green-600">{formatRM(report.inventory.stockValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{translate("活跃批次", "Active Lots")}</p>
                    <p className="text-lg font-bold text-blue-600">{report.inventory.activeLots}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-950/20">
                    <Package className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{translate("已耗尽批次", "Exhausted Lots")}</p>
                    <p className="text-lg font-bold text-gray-600">{report.inventory.exhaustedLots}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Alert */}
          {report.lowStock && report.lowStock.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5 text-amber-500" /> {translate("低库存预警", "Low Stock Alert")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{translate("商品名称", "Product Name")}</TableHead>
                      <TableHead className="text-right">{translate("当前库存", "Current Stock")}</TableHead>
                      <TableHead className="text-right">{translate("库存价值", "Stock Value")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.lowStock.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={item.totalRemaining <= 0 ? "destructive" : "secondary"}>{item.totalRemaining}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatRM(item.stockValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <p className="text-center text-muted-foreground py-8">{translate("暂无数据", "No data available")}</p>
      )}
    </div>
  );
}
