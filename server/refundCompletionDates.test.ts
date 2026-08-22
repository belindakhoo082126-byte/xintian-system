import { describe, expect, it } from "vitest";
import { getRefundCompletionDates } from "../shared/refundCompletionDates";

describe("退款完成日期", () => {
  it("完成现金退款时以同一实际完成时刻写入退款发生日、处理时间和库存完成时间", () => {
    const completedAt = new Date("2026-08-22T10:00:00.000Z");
    expect(getRefundCompletionDates(false, completedAt)).toEqual({
      processedAt: completedAt,
      refundDate: completedAt,
      inventoryFinalizedAt: completedAt,
    });
  });

  it("等待客户退货不延后实际退款发生日，只延后库存最终处理时间", () => {
    const completedAt = new Date("2026-08-22T10:00:00.000Z");
    expect(getRefundCompletionDates(true, completedAt)).toEqual({
      processedAt: completedAt,
      refundDate: completedAt,
      inventoryFinalizedAt: null,
    });
  });
});
