import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Dashboard库存提醒说明", () => {
  const source = readFileSync(join(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

  it("区分低库存预警和需要人工核对的库存异常", () => {
    expect(source).toContain('"库存警告"');
    expect(source).toContain("商品的可售库存低于所设阈值");
    expect(source).toContain('"库存异常"');
    expect(source).toContain("库存资料出现需要人工核对的不一致");
  });
});
