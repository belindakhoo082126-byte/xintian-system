import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

describe("自动通知独立后台子菜单", () => {
  const sidebar = read("client/src/components/DashboardLayout.tsx");
  const app = read("client/src/App.tsx");
  const dashboard = read("client/src/pages/Dashboard.tsx");
  const aiBrain = read("client/src/pages/AiBrain.tsx");

  it("在 AI 客服分组中提供自动通知独立子菜单", () => {
    expect(sidebar).toContain('label: { zh: "自动通知", en: "Auto Notifications" }, path: "/auto-notifications"');
    expect(sidebar).toContain("BellRing");
  });

  it("注册独立页面路由，并复用原有自动通知中心功能", () => {
    expect(app).toContain('import AiNotificationCenter from "@/pages/AiNotificationCenter"');
    expect(app).toContain('<Route path={"/auto-notifications"} component={AiNotificationCenter} />');
  });

  it("Dashboard 的通知失败入口导向独立菜单，而不是 AI 大脑标签", () => {
    expect(dashboard).toContain('<Link href="/auto-notifications">');
    expect(dashboard).not.toContain('href="/ai-brain?tab=notifications"');
  });

  it("AI 大脑不再包含自动通知标签或嵌入式通知中心", () => {
    expect(aiBrain).not.toContain('value="notifications"');
    expect(aiBrain).not.toContain('AiNotificationCenter');
    expect(aiBrain).not.toContain('"notifications"');
  });
});
