import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const dbSource = fs.readFileSync(path.resolve(root, "server/db.ts"), "utf8");
const routerSource = fs.readFileSync(path.resolve(root, "server/routers.ts"), "utf8");
const paymentRecordSource = fs.readFileSync(path.resolve(root, "client/src/pages/PaymentRecord.tsx"), "utf8");
const methodologySource = fs.readFileSync(path.resolve(root, "client/src/components/ReportMethodologyCard.tsx"), "utf8");

describe("Payment Record 财务流水回归", () => {
  it("仅查询已审核通过付款，并按实际付款或退款日期筛选", () => {
    const recordSource = dbSource.slice(dbSource.indexOf("export async function getPaymentRecords"));
    expect(recordSource).toContain('eq(orderPayments.reviewStatus, "approved")');
    expect(recordSource).toContain("COALESCE(${orderPayments.paymentDate}, ${orderPayments.createdAt})");
    expect(recordSource).toContain("COALESCE(${orderRefunds.refundDate}, ${orderRefunds.createdAt})");
    expect(recordSource).toContain('type: "payment" as const');
    expect(recordSource).toContain('type: "refund" as const');
  });

  it("报告路由与页面支持全部、收款、退款筛选及订单追溯", () => {
    expect(routerSource).toContain("paymentRecords: adminProcedure");
    expect(routerSource).toContain('z.enum(["all", "payment", "refund"])');
    expect(paymentRecordSource).toContain("trpc.reports.paymentRecords.useQuery");
    expect(paymentRecordSource).toContain('href={`/orders/${item.orderId}`}');
    expect(paymentRecordSource).toContain("value=\"payment\"");
    expect(paymentRecordSource).toContain("value=\"refund\"");
  });

  it("固定提供付款、退款与净实收口径说明", () => {
    expect(paymentRecordSource).toContain("净实收 = 已确认收款 − 已完成退款");
    for (const kind of [
      "businessOverview",
      "salesPayment",
      "productSales",
      "customerSpending",
      "purchaseInventory",
      "profitAnalysis",
      "lossAnalysis",
    ]) {
      expect(methodologySource).toContain(kind);
    }
  });
});
