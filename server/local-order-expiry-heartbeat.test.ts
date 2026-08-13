import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("本地订单七天付款期限Heartbeat", () => {
  const serverEntrySource = readFileSync(join(process.cwd(), "server/_core/index.ts"), "utf8");
  const schemaSource = readFileSync(join(process.cwd(), "drizzle/schema.ts"), "utf8");
  const dbSource = readFileSync(join(process.cwd(), "server/db.ts"), "utf8");

  it("只暴露平台规定的受认证scheduled回调路径", () => {
    expect(serverEntrySource).toContain('app.post("/api/scheduled/local-payment-expiry"');
    expect(serverEntrySource).toContain("!user.isCron || !user.taskUid");
  });

  it("只允许已保存的项目级任务标识执行订单取消", () => {
    expect(schemaSource).toContain('localOrderExpiryTaskUid: varchar("localOrderExpiryTaskUid", { length: 65 })');
    expect(serverEntrySource).toContain("settings.localOrderExpiryTaskUid !== user.taskUid");
    expect(serverEntrySource).toContain('skipped: "unregistered-task"');
  });

  it("由既有幂等业务服务执行本地订单取消", () => {
    expect(serverEntrySource).toContain("await db.processExpiredLocalOrders()");
    expect(serverEntrySource).toContain("本地订单付款期限巡检失败");
  });

  it("仅处理符合付款期限条件的本地订单，并保护待审核或已确认付款", () => {
    expect(dbSource).toContain("export async function processExpiredLocalOrders()");
    expect(dbSource).toContain("o.createdAt < DATE_SUB(NOW(), INTERVAL 7 DAY)");
    expect(dbSource).toContain("o.physicalStatus IN ('pending', 'hold_order')");
    expect(dbSource).toContain("COALESCE(o.cancelProtection, 0) = 0");
    expect(dbSource).toContain("COALESCE(o.paidAmount, 0) <= 0");
    expect(dbSource).toContain("(o.receiptUrl IS NULL OR TRIM(o.receiptUrl) = '')");
    expect(dbSource).toContain("pending_proof.reviewStatus = 'pending'");
    expect(dbSource).toContain("approved_payment.reviewStatus = 'approved'");
  });

  it("建立开放包货异常时写入订单取消保护，必须由管理员另行处理", () => {
    expect(dbSource).toContain("await db.update(orders).set({ cancelProtection: true }).where(eq(orders.id, data.orderId))");
  });

  it("建立未处理退款时同样启用订单取消保护，避免破坏退款与库存账本", () => {
    expect(dbSource).toContain("await tx.update(orders).set({ cancelProtection: true }).where(eq(orders.id, data.orderId))");
  });

  it("经统一取消服务完成状态取消、库存释放与审计，不另行重复扣减库存", () => {
    expect(dbSource).toContain("await cancelOrderWithReason(order.id, '本地订单下单满7天仍未有有效付款凭证，系统自动取消', '系统自动')");
    expect(dbSource).toContain('physicalStatus: "cancelled"');
    expect(dbSource).toContain("stockQuantity: sql`${productVariations.stockQuantity} + ${item.quantity}`");
    expect(dbSource).toContain("stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`");
    expect(dbSource).toContain('await logOrderOperation(id, "cancel"');
    expect(dbSource).toContain('broadcastChanges(["orders", "dashboard", "inventory"])');
  });
});
