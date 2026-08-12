import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SPECIAL_ORDER_FOLLOW_UP_TYPES,
  isExplicitOtherSpecialOrder,
  isSpecialOrderFollowUpType,
} from "@shared/specialOrderDisplay";

const dbSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/db.ts"),
  "utf8",
);

describe("特别状态“其他”归类一致性", () => {
  it("只认可明确登记的 follow-up 类型；空值与未知历史值不能自动归入其他", () => {
    expect(isSpecialOrderFollowUpType("other")).toBe(true);
    expect(isExplicitOtherSpecialOrder("other")).toBe(true);
    expect(isExplicitOtherSpecialOrder(null)).toBe(false);
    expect(isSpecialOrderFollowUpType(null)).toBe(false);
    expect(isSpecialOrderFollowUpType("")).toBe(false);
    expect(isSpecialOrderFollowUpType("legacy_unknown_type")).toBe(false);
    expect(SPECIAL_ORDER_FOLLOW_UP_TYPES).not.toContain("notification_failed");
  });

  it("让Dashboard统计与待跟进列表使用同一白名单，不再把空类型回退为其他", () => {
    expect(dbSource).toContain("oss.type IN (${specialFollowUpTypeSql})");
    expect(dbSource).toContain("o.specialOrderType IN (${specialFollowUpTypeSql})");
    expect(dbSource).not.toContain("r.specialOrderType || 'other'");
    expect(dbSource).toContain("if (!isSpecialOrderFollowUpType(key)) return;");
  });

  it("订单管理仍以明确 specialOrderType 精准筛选，other 只会筛出明确登记的其他订单", () => {
    expect(dbSource).toContain('eq((orders as any).specialOrderType, filters.specialOrderType as any)');
  });
});
