import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const readSource = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

describe("直播得标通知模板", () => {
  it("系统设置与更新接口公开可编辑模板字段", () => {
    expect(readSource("drizzle/schema.ts")).toContain('liveWinNoticeTemplate: text("liveWinNoticeTemplate")');
    expect(readSource("server/routers.ts")).toContain("liveWinNoticeTemplate: z.string().nullable().optional()");
  });

  it("得标通知以设置模板替换客户、订单、商品与分列金额变量", () => {
    const source = readSource("server/db.ts");
    const captureSlice = source.slice(source.indexOf("export async function executeAutoOrderCapture"), source.indexOf("// =============================================================================\n// Campaign CRUD helpers"));
    expect(captureSlice).toContain("liveWinNoticeTemplate");
    expect(captureSlice).toContain(".replace(/\\{customer_name\\}/g");
    expect(captureSlice).toContain(".replace(/\\{order_number\\}/g");
    expect(captureSlice).toContain(".replace(/\\{item_list\\}/g");
    expect(captureSlice).toContain(".replace(/\\{total_amount\\}/g");
    expect(captureSlice).toContain("calculateMerchandiseNotificationBreakdown");
    expect(captureSlice).toContain("{amount_breakdown}");
    expect(captureSlice).toContain("普通商品小计");
    expect(captureSlice).toContain("特价商品小计");
    expect(captureSlice).toContain("运费：待填写配送资料后计算");
    expect(captureSlice).toContain("查询订单及结账");
  });

  it("后台明确说明专属结单按钮由系统自动附加", () => {
    const source = readSource("client/src/pages/SystemSettings.tsx");
    expect(source).toContain("直播得标通知模板");
    expect(source).toContain("liveWinNoticeTemplate");
    expect(source).toContain("{amount_breakdown}");
    expect(source).toContain("{free_shipping_eligible_subtotal}");
    expect(source).toContain("专属的「查询订单及结账」按钮");
  });
});
