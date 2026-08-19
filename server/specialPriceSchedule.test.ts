import { describe, expect, it } from "vitest";
import { isSpecialPriceCurrentlyActive } from "../shared/specialPriceSchedule";

describe("特价有效期", () => {
  const now = new Date("2026-08-19T12:00:00.000Z");

  it("未设置开始或结束日期时，已启用的特价持续生效", () => {
    expect(isSpecialPriceCurrentlyActive({ isSpecial: true, specialPrice: "15" }, now)).toBe(true);
  });

  it("未来开始日期或已结束日期不显示为当前特价", () => {
    expect(isSpecialPriceCurrentlyActive({ isSpecial: true, specialPrice: "15", specialPriceStartDate: "2026-08-20" }, now)).toBe(false);
    expect(isSpecialPriceCurrentlyActive({ isSpecial: true, specialPrice: "15", specialPriceEndDate: "2026-08-18" }, now)).toBe(false);
  });
});

