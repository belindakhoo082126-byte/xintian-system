import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, ExternalLink, Filter, ReceiptText, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PaymentRecord() {
  const { lang } = useI18n();
  const [type, setType] = useState<"all" | "payment" | "refund">("all");
  const [keyword, setKeyword] = useState("");
  const [month] = useState(() => new Date());
  const from = useMemo(() => new Date(month.getFullYear(), month.getMonth(), 1), [month]);
  const to = useMemo(() => new Date(month.getFullYear(), month.getMonth() + 1, 1), [month]);
  const { data = [], isLoading } = trpc.reports.paymentRecords.useQuery({ from, to, type });
  const records = data.filter((item: any) => `${item.orderNumber || ""} ${item.customerName || ""}`.toLowerCase().includes(keyword.toLowerCase()));
  const payments = records.filter((item: any) => item.type === "payment").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const refunds = records.filter((item: any) => item.type === "refund").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Payment Record</h1><p className="text-sm text-muted-foreground">{lang === "zh" ? "逐笔已确认付款与退款流水（按付款／退款日期）" : "Approved payment and refund transactions by transaction date"}</p></div>
      <Link href="/profit-report"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />{lang === "zh" ? "经营总览" : "Business Overview"}</Button></Link>
    </div>
    <Card className="border-emerald-200 bg-emerald-50/50"><CardContent className="py-3 text-sm text-emerald-900">{lang === "zh" ? "统计口径：只显示已审核通过的付款记录，并列出该月份发生的退款；净实收 = 已确认收款 − 已完成退款。" : "Methodology: approved payments less refunds recorded during this month."}</CardContent></Card>
    <div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{lang === "zh" ? "已确认收款" : "Approved payments"}</p><p className="mt-1 text-2xl font-bold text-emerald-600">RM {payments.toFixed(2)}</p></CardContent></Card><Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{lang === "zh" ? "退款" : "Refunds"}</p><p className="mt-1 text-2xl font-bold text-red-600">RM {refunds.toFixed(2)}</p></CardContent></Card><Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{lang === "zh" ? "净实收" : "Net receipts"}</p><p className="mt-1 text-2xl font-bold">RM {(payments - refunds).toFixed(2)}</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5" />{lang === "zh" ? "本月付款流水" : "Monthly transactions"}</CardTitle></CardHeader><CardContent><div className="mb-4 flex flex-wrap gap-2"><div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={lang === "zh" ? "搜索订单号或客户" : "Search order or customer"}/></div><Select value={type} onValueChange={(value: any) => setType(value)}><SelectTrigger className="w-40"><Filter className="mr-2 h-4 w-4"/><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{lang === "zh" ? "全部流水" : "All"}</SelectItem><SelectItem value="payment">{lang === "zh" ? "收款" : "Payments"}</SelectItem><SelectItem value="refund">{lang === "zh" ? "退款" : "Refunds"}</SelectItem></SelectContent></Select></div><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">{lang === "zh" ? "日期" : "Date"}</th><th className="p-3">{lang === "zh" ? "类型" : "Type"}</th><th className="p-3">{lang === "zh" ? "订单" : "Order"}</th><th className="p-3">{lang === "zh" ? "客户" : "Customer"}</th><th className="p-3 text-right">{lang === "zh" ? "金额" : "Amount"}</th><th className="p-3">{lang === "zh" ? "方式／来源" : "Method / Source"}</th><th className="p-3">{lang === "zh" ? "操作人" : "Operator"}</th><th className="p-3">{lang === "zh" ? "备注" : "Notes"}</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Loading...</td></tr> : records.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{lang === "zh" ? "本月没有符合条件的流水" : "No matching records"}</td></tr> : records.map((item: any) => <tr key={`${item.type}-${item.id}`} className="border-b hover:bg-muted/40"><td className="p-3">{item.occurredAt ? new Date(item.occurredAt).toLocaleDateString(lang === "zh" ? "zh-MY" : "en-MY") : "-"}</td><td className="p-3"><Badge variant={item.type === "refund" ? "destructive" : "secondary"} className="gap-1">{item.type === "refund" ? <ArrowDownCircle className="h-3 w-3"/> : <ArrowUpCircle className="h-3 w-3"/>}{item.type === "refund" ? (lang === "zh" ? "退款" : "Refund") : (lang === "zh" ? "收款" : "Payment")}</Badge></td><td className="p-3"><Link href={`/orders/${item.orderId}`} className="font-medium text-primary hover:underline">{item.orderNumber || `#${item.orderId}`}</Link><span className="ml-1 text-xs text-muted-foreground">{item.orderCategory === "import" ? "XTC" : "XT"}</span></td><td className="p-3">{item.customerName || "-"}</td><td className={`p-3 text-right font-semibold ${item.type === "refund" ? "text-red-600" : "text-emerald-600"}`}>{item.type === "refund" ? "−" : "+"} RM {Number(item.amount || 0).toFixed(2)}</td><td className="p-3">{item.method || "-"}{item.source ? <span className="block text-xs text-muted-foreground">{item.source}</span> : null}</td><td className="p-3">{item.operatorName || "-"}</td><td className="p-3 max-w-56 truncate">{item.notes || "-"}{item.receiptUrl ? <a className="ml-2 inline-flex text-primary" href={item.receiptUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5"/></a> : null}</td></tr>)}</tbody></table></div></CardContent></Card>
  </div>;
}
