import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "server/db.ts"), "utf8");
const reportSource = source.slice(
  source.indexOf("// XLCS V1.0: Business Report Service"),
  source.indexOf("// ============================================================================\n// System Settings helpers"),
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
    expect(reportSource).toContain("purchase_date >= ${toReportTimestamp(start)}");
    expect(reportSource).toContain("cr.refundDate >= ${toReportTimestamp(start)}");
  });
});
