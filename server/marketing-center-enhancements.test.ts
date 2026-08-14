import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const marketingCenterSource = readFileSync(resolve(projectRoot, "client/src/pages/MarketingCenter.tsx"), "utf8");
const routerSource = readFileSync(resolve(projectRoot, "server/routers.ts"), "utf8");

describe("营销中心三项增强界面与路由契约", () => {
  it("保留可随时打开的操作说明入口和完整指南弹窗", () => {
    expect(marketingCenterSource).toContain("MarketingGuideDialog");
    expect(marketingCenterSource).toContain("操作说明");
    expect(marketingCenterSource).toContain("营销中心管理员操作说明");
  });

  it("关键词模拟工具明确使用只读匹配接口并说明不发送、不建单", () => {
    expect(marketingCenterSource).toContain("KeywordSimulationPanel");
    expect(marketingCenterSource).toContain("simulateKeywordMatch");
    expect(marketingCenterSource).toContain("不会发送消息、建立订单或预留库存");
    expect(routerSource).toContain("simulateKeywordMatch");
  });

  it("自动营销提供预检、排程、暂停和客户级执行审计展示", () => {
    expect(marketingCenterSource).toContain("preflightAutomationRule");
    expect(marketingCenterSource).toContain("AutomationScheduleDialog");
    expect(marketingCenterSource).toContain("最近执行记录");
    expect(routerSource).toContain("preflightAutomationRule");
    expect(routerSource).toContain("scheduleAutomationRule");
    expect(routerSource).toContain("pauseAutomationRule");
  });

  it("排程接口保存计划时间，并在启用前阻挡不可用的消息模板", () => {
    expect(routerSource).toContain("scheduledAt: z.date().nullable().optional()");
    expect(routerSource).toContain("启用前检查未通过");
    expect(routerSource).toContain("allowPausedDryRun: true");
  });
});
