import { describe, expect, it } from "vitest";
import { buildInclusiveReportDateRange } from "./reportDateRange";

describe("利润报告日期范围", () => {
  it("覆盖到日期的完整一天，不排除当天较晚发生的交易", () => {
    expect(buildInclusiveReportDateRange("2026-08-01", "2026-08-22")).toEqual({
      dateFrom: "2026-08-01T00:00:00.000",
      dateTo: "2026-08-22T23:59:59.999",
    });
  });
});
