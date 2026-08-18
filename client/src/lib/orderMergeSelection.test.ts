import { describe, expect, it } from "vitest";
import { canOpenOrderMergeFromPath } from "./orderMergeAccess";
import {
  getSelectableOrderIds,
  isCancelledOrder,
  isOrderMergeEligible,
} from "./orderMergeSelection";

describe("订单列表选择与合并资格", () => {
  const orders = [
    { id: 1, orderCategory: "local", physicalStatus: "pending" },
    { id: 2, orderCategory: "local", physicalStatus: "hold_order" },
    { id: 3, orderCategory: "local", physicalStatus: "cancelled" },
    { id: 4, orderCategory: "local", physicalStatus: "packing" },
    { id: 5, orderCategory: "import", importStatus: "pending" },
  ] as const;

  it("已取消订单不可勾选，也不会被全选加入", () => {
    expect(isCancelledOrder(orders[2])).toBe(true);
    expect(getSelectableOrderIds([...orders])).toEqual([1, 2, 4, 5]);
  });

  it("合并仅允许待付款与保留的本地订单", () => {
    expect(isOrderMergeEligible(orders[0])).toBe(true);
    expect(isOrderMergeEligible(orders[1])).toBe(true);
    expect(isOrderMergeEligible(orders[2])).toBe(false);
    expect(isOrderMergeEligible(orders[3])).toBe(false);
    expect(isOrderMergeEligible(orders[4])).toBe(false);
  });

  it("订单合并入口不允许出现在包货路径", () => {
    expect(canOpenOrderMergeFromPath("/orders/local")).toBe(true);
    expect(canOpenOrderMergeFromPath("/packing")).toBe(false);
    expect(canOpenOrderMergeFromPath("/packing/42")).toBe(false);
  });
});
