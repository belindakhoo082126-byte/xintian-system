import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Meta 发布所需公开政策页面", () => {
  const root = path.resolve(__dirname, "..");
  const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
  const mallHome = fs.readFileSync(path.join(root, "client/src/pages/mall/MallHome.tsx"), "utf8");
  const policy = fs.readFileSync(path.join(root, "client/src/pages/PublicPolicy.tsx"), "utf8");

  it("将隐私、服务条款与用户资料删除页面作为无需登录的公开路由", () => {
    expect(app).toContain('path={"/privacy-policy"} component={() => <PublicPolicy kind="privacy" />}');
    expect(app).toContain('path={"/terms-of-service"} component={() => <PublicPolicy kind="terms" />}');
    expect(app).toContain('path={"/data-deletion"} component={() => <PublicPolicy kind="dataDeletion" />}');
    expect(app.indexOf('path={"/privacy-policy"}')).toBeLessThan(app.indexOf("<DashboardLayout>"));
  });

  it("在三个页面明确提供 Facebook 与 Messenger 所需的资料使用、服务条款及删除请求说明", () => {
    expect(policy).toContain("Facebook 专页及 Messenger 服务");
    expect(policy).toContain("我们不会出售您的个人资料");
    expect(policy).toContain("用户资料删除说明");
    expect(policy).toContain("删除我的资料");
    expect(policy).toContain("身份核对");
    expect(policy).toContain("ECOLAND NURSERY");
  });

  it("从商城页脚提供公开政策入口，客户无需登录即可找到政策与删除步骤", () => {
    expect(mallHome).toContain('href="/privacy-policy"');
    expect(mallHome).toContain('href="/terms-of-service"');
    expect(mallHome).toContain('href="/data-deletion"');
  });
});
