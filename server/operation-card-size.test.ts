import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const readClientPage = (fileName: string) =>
  fs.readFileSync(path.join(projectRoot, "client", "src", "pages", fileName), "utf8");

describe("添加商品操作框尺寸", () => {
  it("放大退款管理的订单选择与退款商品操作区，同时保留既有库存处理选择", () => {
    const source = readClientPage("RefundManagement.tsx");

    expect(source).toContain('DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto"');
    expect(source).toContain('className="h-12 pl-11 text-base"');
    expect(source).toContain('rounded-xl border bg-card p-5 shadow-sm');
    expect(source).toContain('SelectTrigger className="h-11 text-base"');
    expect(source).toContain('value={line?.inventoryTreatment || (item.productId ? "return_to_sale" : "none")}');
  });

  it("放大商品管理新增商品向导，并只在该向导内调整输入与选择控件", () => {
    const source = readClientPage("ProductsV2.tsx");

    expect(source).toContain('DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto"');
    expect(source).toContain('min-h-[360px] [&_input]:h-11 [&_input]:text-base');
    expect(source).toContain('grid grid-cols-1 gap-5 md:grid-cols-2');
    expect(source).toContain('grid grid-cols-1 gap-5 md:grid-cols-3');
    expect(source).toContain('flex min-h-24 items-center justify-between rounded-xl border p-4');
  });
});
