import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dashboardSource = fs.readFileSync(path.join(projectRoot, "client/src/pages/Dashboard.tsx"), "utf8");
const ordersSource = fs.readFileSync(path.join(projectRoot, "client/src/pages/Orders.tsx"), "utf8");

describe("Dashboard 跨渠道合单明细入口", () => {
  it("将合单卡片链接到当天合单订单筛选，并为辅助技术提供可识别名称", () => {
    expect(dashboardSource).toContain('href="/orders/local?crossChannelMergeToday=1"');
    expect(dashboardSource).toContain('aria-label={lang === "zh" ? "查看今日跨渠道合单订单"');
  });

  it("订单页读取筛选参数并呈现真实合单审计明细，而非仅显示汇总数字", () => {
    expect(ordersSource).toContain('get("crossChannelMergeToday")');
    expect(ordersSource).toContain('crossChannelMergeToday: crossChannelMergeToday || undefined');
    expect(ordersSource).toContain('data-cross-channel-merge-list');
    expect(ordersSource).toContain('order.crossChannelMergeDetails');
    expect(ordersSource).toContain('新增来源');
    expect(ordersSource).toContain('RM {Number(detail.addedAmount || 0).toFixed(2)}');
  });
});
