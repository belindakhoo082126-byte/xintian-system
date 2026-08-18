import { describe, expect, it } from "vitest";
import {
  availableGiftQuantity,
  cancelGiftReservation,
  lockGiftInventory,
  receiveGiftInventory,
  returnGiftInventory,
  shipGiftInventory,
} from "../shared/giftInventoryLifecycle";

describe("赠品库存真实业务路径", () => {
  it("完成下单锁定、部分出货、退货归还、取消余量和进货补充的完整闭环", () => {
    const initial = { stockQuantity: 10, reservedQuantity: 0 };

    const locked = lockGiftInventory(initial, 3);
    expect(locked).toEqual({ stockQuantity: 10, reservedQuantity: 3 });
    expect(availableGiftQuantity(locked)).toBe(7);

    const partiallyShipped = shipGiftInventory(locked, 2);
    expect(partiallyShipped).toEqual({ stockQuantity: 8, reservedQuantity: 1 });

    const returned = returnGiftInventory(partiallyShipped, 1);
    expect(returned).toEqual({ stockQuantity: 9, reservedQuantity: 1 });

    const cancelledRemainder = cancelGiftReservation(returned, 1);
    expect(cancelledRemainder).toEqual({ stockQuantity: 9, reservedQuantity: 0 });

    expect(receiveGiftInventory(cancelledRemainder, 4)).toEqual({ stockQuantity: 13, reservedQuantity: 0 });
  });

  it("在锁定阶段阻止超过可售数量的赠品订单", () => {
    expect(() => lockGiftInventory({ stockQuantity: 2, reservedQuantity: 1 }, 2)).toThrow("GIFT_STOCK_INSUFFICIENT");
  });
});
