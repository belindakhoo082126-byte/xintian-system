import { describe, expect, it } from "vitest";
import { runShipmentTransaction } from "../shared/shipmentTransaction";

type ShipmentState = { packages: number; stockQuantity: number; reservedQuantity: number; physicalStatus: string };

function createTransactionalShipmentFixture(initial: ShipmentState) {
  let committed = { ...initial };
  const runner = {
    transaction: async <T>(work: (tx: { state: ShipmentState }) => Promise<T>) => {
      const draft = { ...committed };
      const result = await work({ state: draft });
      committed = draft;
      return result;
    },
  };
  return { runner, state: () => committed };
}

describe("包货事务边界", () => {
  const fulfillGift = async (tx: { state: ShipmentState }, failure?: "package" | "deduct" | "status") => {
    if (failure === "package") throw new Error("PACKAGE_WRITE_FAILED");
    tx.state.packages += 1;
    if (failure === "deduct") throw new Error("GIFT_DEDUCT_FAILED");
    tx.state.stockQuantity -= 2;
    tx.state.reservedQuantity -= 2;
    if (failure === "status") throw new Error("STATUS_SYNC_FAILED");
    tx.state.physicalStatus = "partial_shipped";
  };

  it("整单或部分发货步骤全部成功时一并提交包裹、赠品库存和订单状态", async () => {
    const fixture = createTransactionalShipmentFixture({ packages: 0, stockQuantity: 10, reservedQuantity: 2, physicalStatus: "packing" });
    await runShipmentTransaction(fixture.runner, async tx => fulfillGift(tx));
    expect(fixture.state()).toEqual({ packages: 1, stockQuantity: 8, reservedQuantity: 0, physicalStatus: "partial_shipped" });
  });

  it.each(["package", "deduct", "status"] as const)("任一 %s 步骤失败时不提交半完成库存变动", async failure => {
    const initial = { packages: 0, stockQuantity: 10, reservedQuantity: 2, physicalStatus: "packing" };
    const fixture = createTransactionalShipmentFixture(initial);
    await expect(runShipmentTransaction(fixture.runner, async tx => fulfillGift(tx, failure))).rejects.toThrow();
    expect(fixture.state()).toEqual(initial);
  });
});
