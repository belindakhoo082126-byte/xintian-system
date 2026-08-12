import { describe, expect, it } from "vitest";
import { summarizeDashboardCashReceipts } from "./db";

describe("Dashboard 本月已收款统计", () => {
  it("按本地与代购分类汇总已确认付款，并计算总实收", () => {
    expect(summarizeDashboardCashReceipts([
      { orderCategory: "local", total: "105.50" },
      { orderCategory: "local", total: 94.5 },
      { orderCategory: "import", total: "240.00" },
      { orderCategory: null, total: "999.00" },
    ])).toEqual({
      localReceivedMonth: "200.00",
      importReceivedMonth: "240.00",
      totalReceivedMonth: "440.00",
    });
  });

  it("没有已确认付款时安全返回零值", () => {
    expect(summarizeDashboardCashReceipts([])).toEqual({
      localReceivedMonth: "0.00",
      importReceivedMonth: "0.00",
      totalReceivedMonth: "0.00",
    });
  });
});
