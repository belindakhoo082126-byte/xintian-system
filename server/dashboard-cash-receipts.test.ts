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
      localRefundedMonth: "0.00",
      importRefundedMonth: "0.00",
      totalRefundedMonth: "0.00",
      localNetReceivedMonth: "200.00",
      importNetReceivedMonth: "240.00",
      totalNetReceivedMonth: "440.00",
    });
  });

  it("没有已确认付款时安全返回零值", () => {
    expect(summarizeDashboardCashReceipts([])).toEqual({
      localReceivedMonth: "0.00",
      importReceivedMonth: "0.00",
      totalReceivedMonth: "0.00",
      localRefundedMonth: "0.00",
      importRefundedMonth: "0.00",
      totalRefundedMonth: "0.00",
      localNetReceivedMonth: "0.00",
      importNetReceivedMonth: "0.00",
      totalNetReceivedMonth: "0.00",
    });
  });

  it("按实际退款日期扣减本地与代购的净实收，不影响已确认收款总额", () => {
    expect(summarizeDashboardCashReceipts(
      [
        { orderCategory: "local", total: "150.00" },
        { orderCategory: "import", total: "80.00" },
      ],
      [
        { orderCategory: "local", total: "20.00" },
        { orderCategory: "import", total: "5.50" },
      ],
    )).toMatchObject({
      totalReceivedMonth: "230.00",
      totalRefundedMonth: "25.50",
      localNetReceivedMonth: "130.00",
      importNetReceivedMonth: "74.50",
      totalNetReceivedMonth: "204.50",
    });
  });
});
