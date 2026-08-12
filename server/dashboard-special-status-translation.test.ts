import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SPECIAL_ORDER_REASON_LABELS } from "@shared/specialOrderDisplay";

const dashboardSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8",
);

describe("Dashboard 特别状态订单英文翻译", () => {
  it("defines English labels for each dashboard special-status code", () => {
    const requiredTypes = [
      "pending_shipping",
      "pending_refund",
      "logistics_error",
      "incomplete_info",
      "stock_exception",
      "partial_payment",
      "over_payment",
      "amount_changed",
      "other",
    ];

    for (const type of requiredTypes) {
      expect(SPECIAL_ORDER_REASON_LABELS[type]?.en).toBeTruthy();
    }
    expect(dashboardSource).toContain("SPECIAL_STATUS_LABELS[item.specialType]?.[lang]");
    expect(dashboardSource).not.toContain("specialFilter === \"overdue\"");
  });

  it("renders order category badges from the active language rather than fixed Chinese text", () => {
    expect(dashboardSource).toContain('lang === "zh" ? "中国代购" : "Import Pre-order"');
    expect(dashboardSource).toContain('lang === "zh" ? "本地" : "Local"');
  });

  it("shows pending refunds only through the Refund Management work-status card, avoiding duplicate dashboard tasks", () => {
    expect(dashboardSource).toContain('title: lang === "zh" ? "待处理退款" : "Pending Refunds"');
    expect(dashboardSource).not.toContain('href="/orders?special=1&type=pending_refund"');
    expect(dashboardSource).toContain('item.specialType !== "pending_refund"');
  });

  it("explains that the Other special-status category is an explicit catch-all rather than an unclassified system error", () => {
    expect(dashboardSource).toContain('“其他”仅用于已被人工明确标记为其他');
    expect(dashboardSource).toContain('not covered by a defined shipping, refund, logistics');
  });
});
