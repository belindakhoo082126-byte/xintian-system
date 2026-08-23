import { describe, expect, it } from "vitest";
import { getPackingCancellationSettlement, getPackingItemCancellationIneligibility, getRemainingFulfilmentQuantity } from "../shared/packingItemCancellationRules";

describe("包货取消商品结算规则", () => {
  it("已付款高于取消商品后新应收额时建立待退款", () => {
    expect(getPackingCancellationSettlement(606, 555)).toEqual({ type: "pending_refund", amount: 51 });
  });

  it("取消商品后因失去免邮资格而仍欠款时建立待汇款差价", () => {
    expect(getPackingCancellationSettlement(150, 160)).toEqual({ type: "pending_shipping", amount: 10 });
  });

  it("金额相同时不建立财务待办", () => {
    expect(getPackingCancellationSettlement(100, 100)).toEqual({ type: "settled", amount: 0 });
  });

  it("只允许待包货且未发货的订单取消有效数量", () => {
    expect(getPackingItemCancellationIneligibility({ physicalStatus: "packing", hasShippedPackage: false, quantity: 1, itemQuantity: 2 })).toBeNull();
    expect(getPackingItemCancellationIneligibility({ physicalStatus: "shipped", hasShippedPackage: false, quantity: 1, itemQuantity: 2 })).toContain("待包货");
    expect(getPackingItemCancellationIneligibility({ physicalStatus: "packing", hasShippedPackage: true, quantity: 1, itemQuantity: 2 })).toContain("已发货");
  });

  it("取消后待发数量以更新后的订单数量为准，不保留取消前缓存", () => {
    // 蓝莓原本3盆、取消1盆后，订单项目数量变为2盆，尚未发货时只可待发2盆。
    expect(getRemainingFulfilmentQuantity(2, 0)).toBe(2);
    expect(getRemainingFulfilmentQuantity(2, 1)).toBe(1);
  });
});
