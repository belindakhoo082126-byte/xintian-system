import { describe, expect, it } from "vitest";
import { getPurchaseOrderReceiptDecision } from "../shared/purchaseOrderReceiptRules";

describe("进货收货幂等规则", () => {
  it("仅允许已下单进货单首次收货", () => {
    expect(getPurchaseOrderReceiptDecision("ordered")).toBe("receive");
    expect(getPurchaseOrderReceiptDecision("draft")).toBe("reject");
    expect(getPurchaseOrderReceiptDecision("cancelled")).toBe("reject");
  });

  it("已收货进货单不再重复增加库存", () => {
    expect(getPurchaseOrderReceiptDecision("received")).toBe("already_received");
  });
});
