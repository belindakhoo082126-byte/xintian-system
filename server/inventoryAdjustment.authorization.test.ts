import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createEmployeeContext(): TrpcContext {
  return {
    user: {
      id: 17,
      openId: "ordinary-employee",
      name: "普通员工",
      email: "employee@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("inventoryAdjustment.create 权限", () => {
  it("拒绝普通员工提交敏感库存调整", async () => {
    const caller = appRouter.createCaller(createEmployeeContext());

    await expect(caller.inventoryAdjustment.create({
      productId: 1,
      supplierId: 1,
      adjustmentType: "unhealthy",
      quantityChange: -1,
      reason: "权限回归测试",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
