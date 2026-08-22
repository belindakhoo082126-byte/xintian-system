import { describe, expect, it } from "vitest";
import { calculateShipmentSummary } from "./db";

describe("多包裹实际物流费用汇总", () => {
  it("将同一订单两个物理包裹的重量和实际费用合计一次", () => {
    expect(calculateShipmentSummary([
      { courier: "测试快递", trackingNumber: "FIN-TEST-A", weight: "1.20", shippingCost: "8.00", shippedAt: new Date("2026-08-22T01:00:00.000Z") },
      { courier: "测试快递", trackingNumber: "FIN-TEST-B", weight: "0.80", shippingCost: "9.00", shippedAt: new Date("2026-08-22T02:00:00.000Z") },
    ])).toMatchObject({
      actualWeight: 2,
      actualShippingFee: 17,
      trackingNumber: "FIN-TEST-B",
    });
  });

  it("后续空箱可计入其物流费用，但不重新关联订单商品", () => {
    expect(calculateShipmentSummary([
      { weight: "1", shippingCost: "8" },
      { weight: "0.5", shippingCost: "4" },
    ])).toMatchObject({ actualWeight: 1.5, actualShippingFee: 12 });
  });
});
