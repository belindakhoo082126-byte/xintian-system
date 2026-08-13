import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
const dbSource = readProjectFile("server/db.ts");
const routerSource = readProjectFile("server/routers.ts");
const schemaSource = readProjectFile("drizzle/schema.ts");
const migrationSource = readProjectFile("drizzle/0023_ai_notification_actions.sql");
const dedupMigrationSource = readProjectFile("drizzle/0024_ai_notification_action_dedup.sql");
const aiBrainSource = readProjectFile("client/src/pages/AiBrain.tsx");
const centerSource = readProjectFile("client/src/pages/AiNotificationCenter.tsx");
const dashboardSource = readProjectFile("client/src/pages/Dashboard.tsx");
const specialOrderDisplaySource = readProjectFile("shared/specialOrderDisplay.ts");

describe("AI 自动通知中心", () => {
  it("以通知日志为唯一来源展示六类事件、失败队列与可用模板变量", () => {
    expect(dbSource).toContain("export async function getAiNotificationCenter");
    expect(dbSource).toContain("AI_NOTIFICATION_TYPE_LABELS");
    expect(dbSource).toContain('status === "failed" && !latestActionByLog.has(log.id)');
    expect(dbSource).toContain('"{customer_name}"');
    expect(dbSource).toContain('"{order_number}"');
    expect(dbSource).toContain('"{amount}"');
    expect(dbSource).toContain('"{checkout_link}"');
  });

  it("将人工处理保存为只增审计，并阻止同一失败记录重复操作", () => {
    expect(schemaSource).toContain("aiNotificationActions");
    expect(migrationSource).toContain("ai_notification_actions");
    expect(dedupMigrationSource).toContain("UNIQUE (`notificationLogId`)");
    expect(schemaSource).toContain('uniqueIndex("uq_ai_notification_actions_log")');
    expect(dbSource).toContain("export async function handleAiNotificationFailure");
    expect(dbSource).toContain("此通知已由管理员处理，系统不会重复发送");
    expect(dbSource).toContain("await db.insert(aiNotificationActions).values(input)");
    expect(dbSource).toContain("ER_DUP_ENTRY");
    expect(routerSource).toContain("handleAiFailure: adminProcedure");
  });

  it("提供独立子菜单入口与失败记录的查看、手动发送和处理操作", () => {
    expect(aiBrainSource).not.toContain('"notifications"');
    expect(aiBrainSource).not.toContain("AiNotificationCenter");
    for (const marker of ["自动通知中心", "待人工处理通知", "复制并人工发送", "无需重发", "模板变量说明"]) {
      expect(centerSource).toContain(marker);
    }
  });

  it("从特别订单统计、筛选与Dashboard网格拆离，并提供直达自动通知菜单的独立卡", () => {
    expect(dbSource).toContain("oss.type != 'notification_failed'");
    expect(dbSource).toContain("COALESCE(o.specialOrderType, '') != 'notification_failed'");
    expect(specialOrderDisplaySource).not.toContain('value: "notification_failed"');
    expect(dashboardSource).toContain("trpc.notifications.aiCenter.useQuery()");
    expect(dashboardSource).toContain('href="/auto-notifications"');
    expect(dashboardSource).toContain("AI 自动通知失败");
  });
});
