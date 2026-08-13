import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const dbSource = fs.readFileSync(path.resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = fs.readFileSync(path.resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("订单加单履约保护", () => {
  it("允许尚未发货的待包货订单继续加单", () => {
    expect(dbSource).toContain('"packing"]');
    expect(routerSource).toContain('"packing"]');
  });

  it("不把部分发货、已发货、完成或取消订单加入加单白名单", () => {
    const dbWhitelist = dbSource.match(/const mergeableStatuses = \[([^\]]+)\];/);
    const routerWhitelist = routerSource.match(/const mergeableStatuses = \[([^\]]+)\];/);
    expect(dbWhitelist?.[1]).toBeDefined();
    expect(routerWhitelist?.[1]).toBeDefined();
    for (const status of ["partial_shipped", "shipped", "completed", "cancelled"]) {
      expect(dbWhitelist?.[1]).not.toContain(`"${status}"`);
      expect(routerWhitelist?.[1]).not.toContain(`"${status}"`);
    }
  });
});
