import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("本地订单七天付款期限Heartbeat", () => {
  const serverEntrySource = readFileSync(join(process.cwd(), "server/_core/index.ts"), "utf8");
  const schemaSource = readFileSync(join(process.cwd(), "drizzle/schema.ts"), "utf8");

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
});
