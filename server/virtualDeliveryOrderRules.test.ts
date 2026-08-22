import { describe, expect, it } from "vitest";
import {
  buildManualDeliveryCopy,
  classifyVirtualDeliveryOrder,
  needsStockReservation,
  shouldCreateManualDeliveryTask,
} from "../shared/virtualDeliveryOrderRules";

describe("虚拟交付混合订单规则", () => {
  it("按实体、虚拟和混合商品正确归类订单", () => {
    expect(classifyVirtualDeliveryOrder(["physical"])).toBe("physical");
    expect(classifyVirtualDeliveryOrder(["membership"])).toBe("membership");
    expect(classifyVirtualDeliveryOrder(["gift", "membership"])).toBe("mixed");
  });

  it("只为实体商品和赠品锁定库存", () => {
    expect(needsStockReservation("physical")).toBe(true);
    expect(needsStockReservation("gift")).toBe(true);
    expect(needsStockReservation("membership")).toBe(false);
  });

  it("仅在首次确认付款进入待包货时建立手动交付任务", () => {
    expect(shouldCreateManualDeliveryTask({ previousPhysicalStatus: "pending", nextPhysicalStatus: "packing", hasVirtualItems: true })).toBe(true);
    expect(shouldCreateManualDeliveryTask({ previousPhysicalStatus: "packing", nextPhysicalStatus: "packing", hasVirtualItems: true })).toBe(false);
    expect(shouldCreateManualDeliveryTask({ previousPhysicalStatus: "pending", nextPhysicalStatus: "packing", hasVirtualItems: false })).toBe(false);
  });

  it("复制内容只组合当次订单快照的通知内容与链接", () => {
    expect(buildManualDeliveryCopy("您好，以下是课程链接", "https://example.com/course")).toBe("您好，以下是课程链接\nhttps://example.com/course");
    expect(buildManualDeliveryCopy(null, "https://example.com/course")).toBe("https://example.com/course");
  });
});
