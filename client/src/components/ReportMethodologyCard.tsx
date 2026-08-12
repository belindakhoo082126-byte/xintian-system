import { Info } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { Card, CardContent } from "@/components/ui/card";

type ReportKind =
  | "businessOverview"
  | "salesPayment"
  | "productSales"
  | "customerSpending"
  | "purchaseInventory"
  | "profitAnalysis"
  | "lossAnalysis";

const methodology: Record<ReportKind, Record<"zh" | "en", { title: string; description: string }>> = {
  businessOverview: {
    zh: { title: "统计口径｜经营总览", description: "以所选期间建立、未取消的订单为主；订单与已付金额按订单建立日汇总，退款按退款日期扣减，成本按 FIFO 批次与库存记录计算。" },
    en: { title: "Methodology | Business overview", description: "Uses non-cancelled orders created in the selected period. Order and paid amounts follow order-created date; refunds follow refund date; costs use FIFO lots and inventory records." },
  },
  salesPayment: {
    zh: { title: "统计口径｜销售与收款", description: "统计所选期间建立的非会员订单：商品销售额为商品小计，已收款为订单当前累计 paidAmount，未收款为订单总额减已付金额；并非按实际付款发生日。" },
    en: { title: "Methodology | Sales & payments", description: "Uses non-member orders created in the selected period. Sales are item subtotals, paid is current cumulative paidAmount, and outstanding is order total less paid amount—not payment-date cash receipts." },
  },
  productSales: {
    zh: { title: "统计口径｜商品销售", description: "统计所选期间建立且未取消的实体商品订单项；销量为数量合计，销售额为订单项小计。包含尚未付款但未取消的订单。" },
    en: { title: "Methodology | Product sales", description: "Uses physical-product order items from non-cancelled orders created in the selected period. Quantity and sales total item quantities and subtotals, including unpaid orders." },
  },
  customerSpending: {
    zh: { title: "统计口径｜客户消费", description: "按所选期间建立、未取消的非会员订单汇总客户；消费额为订单总额，已付为当前累计 paidAmount，欠款为订单总额减已付金额。" },
    en: { title: "Methodology | Customer spending", description: "Groups non-member, non-cancelled orders created in the selected period by customer. Spending is order total, paid is current cumulative paidAmount, and outstanding is total less paid." },
  },
  purchaseInventory: {
    zh: { title: "统计口径｜进货与库存", description: "进货按采购单 purchaseDate 汇总；库存为当前有效进货批次快照，库存价值为剩余数量乘单位成本。这不是销售或实收款报表。" },
    en: { title: "Methodology | Purchases & inventory", description: "Purchases follow purchaseDate. Inventory is a current active-lot snapshot, valued as remaining quantity × unit cost; this is not a sales or cash-receipts report." },
  },
  profitAnalysis: {
    zh: { title: "统计口径｜利润分析", description: "销售按订单建立日；实际毛利 = 商品销售额 − FIFO 商品成本 + 运费收入 − 实际运费成本 − 报废损失 − 退款，退款按退款业务日期。" },
    en: { title: "Methodology | Profit analysis", description: "Sales follow order-created date. Gross profit = item sales − FIFO item cost + shipping income − actual shipping cost − wastage − refunds; refunds follow refund business date." },
  },
  lossAnalysis: {
    zh: { title: "统计口径｜损耗分析", description: "统计所选期间建立的库存调整记录；损耗数量为库存减少绝对值合计，损耗成本为记录成本合计，损耗率以当前实体库存为分母。" },
    en: { title: "Methodology | Loss analysis", description: "Uses inventory adjustments created in the selected period. Loss quantity is the absolute stock decrease, loss cost totals recorded cost, and loss rate uses current physical inventory as denominator." },
  },
};

export function ReportMethodologyCard({ kind }: { kind: ReportKind }) {
  const { lang } = useI18n();
  const copy = methodology[kind][lang];

  return (
    <Card className="sticky top-3 z-20 border-sky-200 bg-sky-50/95 shadow-sm backdrop-blur dark:border-sky-900 dark:bg-sky-950/95">
      <CardContent className="flex gap-3 py-3 text-sm text-sky-950 dark:text-sky-100">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <div>
          <p className="font-semibold">{copy.title}</p>
          <p className="mt-0.5 leading-5 text-sky-800 dark:text-sky-200">{copy.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
