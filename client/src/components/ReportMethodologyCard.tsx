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
  | "lossAnalysis"
  | "legacyMonthlyProfit";

const methodology: Record<ReportKind, Record<"zh" | "en", { title: string; description: string }>> = {
  businessOverview: {
    zh: { title: "统计口径｜经营总览", description: "以所选期间建立、未取消的订单为主；订单与已付金额按订单建立日汇总，退款按退款日期扣减，成本按 FIFO 批次与库存记录计算。" },
    en: { title: "Methodology | Business overview", description: "Uses non-cancelled orders created in the selected period. Order and paid amounts follow order-created date; refunds follow refund date; costs use FIFO lots and inventory records." },
  },
  salesPayment: {
    zh: { title: "统计口径｜订单业绩与现金流", description: "订单业绩、订单月当前已收与待收款按下单月份统计；本月实际已收与净实收按已审核付款及已完成退款的实际发生日期统计。两套数字用途不同，不应直接相减比较。" },
    en: { title: "Methodology | Orders & cash flow", description: "Order performance, current collection and outstanding follow order-created date. Actual and net cash receipts follow approved payment and completed-refund dates. The two bases serve different purposes and are not directly comparable." },
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
    zh: { title: "统计口径｜利润分析", description: "销售与FIFO成本仅按已确认收款订单的确认日期统计；实际毛利 = 商品销售额 − FIFO 商品成本 + 客户已收运费 − 实际运费成本 − 报废及库存扣减损耗 − 退款。" },
    en: { title: "Methodology | Profit analysis", description: "Sales and FIFO cost follow fully paid order confirmation date. Gross profit = product sales − FIFO cost + collected customer shipping − actual shipping cost − wastage and inventory deduction losses − refunds." },
  },
  legacyMonthlyProfit: {
    zh: { title: "统计口径｜月度利润（旧版）", description: "按所选月份建立且实体订单或会员订单状态为已完成的订单计算；收入为商品、会员和订单运费合计，商品成本暂按当前商品成本估算。此页不扣退款、实际运费与损耗，不应与经营报告的实际利润直接比较。" },
    en: { title: "Methodology | Monthly profit (legacy)", description: "Uses orders created in the selected month whose physical or membership status is completed. Revenue totals product, membership and order shipping fees; product cost uses the current product cost estimate. Refunds, actual shipping costs and losses are excluded, so it is not directly comparable with Business Report actual profit." },
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
