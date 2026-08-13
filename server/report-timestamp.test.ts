import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "server/db.ts"), "utf8");
const reportSource = source.slice(
  source.indexOf("// XLCS V1.0: Business Report Service"),
  source.indexOf("// ============================================================================\n// System Settings helpers"),
);
const legacyReportSource = source.slice(
  source.indexOf("// V1.2: Profit Analysis Report"),
  source.indexOf("// ============================================================================\n// V2.0: Import Preorder"),
);

describe("经营报告 timestamp 日期筛选", () => {
  it("converts JavaScript dates into TiDB timestamp boundaries", () => {
    expect(reportSource).toContain("function toReportTimestamp(value: Date): string");
    expect(reportSource).toContain('value.toISOString().slice(0, 19).replace("T", " ")');
  });

  it("does not compare timestamp report columns to JavaScript millisecond values", () => {
    expect(reportSource).not.toContain("start.getTime()");
    expect(reportSource).not.toContain("end.getTime()");
    expect(reportSource).toContain("o.createdAt >= ${toReportTimestamp(start)}");
    expect(reportSource).toContain("cr.refundDate >= ${toReportTimestamp(start)}");
    expect(legacyReportSource).toContain("const startAt = toReportTimestamp(dateRange.start)");
    expect(legacyReportSource).toContain("created_at >= ${startAt} AND created_at <= ${endAt}");
  });

  it("uses real purchase business dates and treats only stock deductions as loss", () => {
    expect(reportSource).toContain("COALESCE(receivedAt, orderedAt, createdAt)");
    expect(reportSource).toContain("status <> 'cancelled'");
    expect(legacyReportSource).toContain("const startAt = toReportTimestamp(dateRange.start)");
    expect(legacyReportSource).toContain("AND quantityChange < 0");
    expect(legacyReportSource).toContain("AND ia.quantityChange < 0");
  });

  it("keeps historical valid orders and untyped physical items in every business report", () => {
    expect(reportSource).not.toContain("o.physicalStatus != 'cancelled'");
    expect(reportSource).not.toContain("o.orderType != 'membership'");
    expect(reportSource).not.toContain("oi.productType = 'physical'");
    expect(reportSource).toContain("COALESCE(o.physicalStatus, '') <> 'cancelled'");
    expect(reportSource).toContain("COALESCE(o.orderType, '') <> 'membership'");
    expect(reportSource).toContain("COALESCE(oi.productType, 'physical') = 'physical'");
  });

  it("uses strict-safe grouping for product, customer, and FIFO report aggregates", () => {
    expect(reportSource).toContain("GROUP BY oi.productId, oi.productName, oi.variationId, oi.variationName");
    expect(reportSource).toContain("GROUP BY c.id, c.customerId, c.displayName, c.facebookName, c.avatarUrl");
    expect(reportSource).toContain("GROUP BY c.id, c.customerId, c.displayName, c.facebookName, c.phoneNumber, c.whatsappPhone");
    expect(reportSource).toContain("MAX(COALESCE(il_sum.fifo_cost, 0)) as fifo_cost");
    expect(reportSource).toContain("GROUP BY il.product_id, p.name");
  });
});
