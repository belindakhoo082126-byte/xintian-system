import { describe, expect, it } from "vitest";
import { resolveShippedOrderItemIds } from "./db";

describe("包裹发货商品范围", () => {
  const fullOrderItemIds = [101, 102, 103];

  it("整单发货未提供 itemIds 时关联全单商品，包含赠品所在订单行", () => {
    expect(resolveShippedOrderItemIds(undefined, fullOrderItemIds)).toEqual(fullOrderItemIds);
  });

  it("多箱整单发货中的后续空箱不重复关联商品", () => {
    expect(resolveShippedOrderItemIds([], fullOrderItemIds)).toEqual([]);
  });

  it("部分发货只关联显式指定的订单商品行", () => {
    expect(resolveShippedOrderItemIds([102], fullOrderItemIds)).toEqual([102]);
  });
});
