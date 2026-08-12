import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const readPage = (name: string) => fs.readFileSync(path.join(root, "client", "src", "pages", name), "utf8");

describe("包货工作台 A5 单据备注一致性", () => {
  it("订单详情 A5 单据仅使用统一备注列表，不再同时渲染客户与后台备注", () => {
    const detail = readPage("PackingDetail.tsx");

    expect(detail).toContain("data.remarks && data.remarks.length > 0");
    expect(detail).toContain("Keep the A5 detail printout identical to the Packing page printout");
    expect(detail).not.toContain("data.customerRemark &&");
    expect(detail).not.toContain("data.adminRemarks &&");
  });

  it("页面打印与 A5 打印均按相同的换盆、希望收货日期与其他备注分类输出", () => {
    const packing = readPage("Packing.tsx");
    const detail = readPage("PackingDetail.tsx");

    for (const category of ["repotting", "desired_delivery_date", "other"]) {
      expect(packing).toContain(`remarkCategory === "${category}"`);
      expect(detail).toContain(`remarkCategory === "${category}"`);
    }
  });
});
