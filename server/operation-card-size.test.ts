import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const readClientPage = (fileName: string) =>
  fs.readFileSync(path.join(projectRoot, "client", "src", "pages", fileName), "utf8");

describe("添加商品操作框尺寸", () => {
  it("退款管理使用统一大弹窗，放大外层框架并保留既有库存处理选择", () => {
    const source = readClientPage("RefundManagement.tsx");
    const largeDialog = fs.readFileSync(
      path.join(projectRoot, "client", "src", "components", "LargeOperationDialog.tsx"),
      "utf8",
    );

    expect(source).toContain('LargeOperationDialogContent');
    expect(source).toContain('<LargeOperationDialogContent');
    expect(largeDialog).toContain('w-[90vw] max-w-[1400px]');
    expect(largeDialog).toContain('h-[90vh] max-h-[90vh]');
    expect(largeDialog).toContain('overflow-x-hidden');
    expect(source).toContain('min-h-[150px] rounded-xl border p-6');
    expect(source).not.toContain('min-w-[1120px]');
    expect(source).toContain('库存处理');
    expect(source).toContain('value={line?.inventoryTreatment || (item.productId ? "return_to_sale" : "none")}');
  });

  it("允许退款第二步骤返回订单搜索，并仅在实际更换订单时重置订单相关草稿", () => {
    const source = readClientPage("RefundManagement.tsx");

    expect(source).toContain('onClick={() => setStep(1)}>{text("返回重新查询订单", "Back to order search")}');
    expect(source).toContain('已填写的退款资料会保留');
    expect(source).toContain('const isChangingOrder = selectedOrder?.id !== order.id;');
    expect(source).toContain('if (isChangingOrder) {\n      setDraftLines({});\n      setRequestedAmount("");\n    }');
  });

  it("新增商品向导使用统一大弹窗，并只在该向导内调整输入与选择控件", () => {
    const source = readClientPage("ProductsV2.tsx");

    expect(source).toContain('LargeOperationDialogContent');
    expect(source).toContain('<LargeOperationDialogContent');
    expect(source).toContain('min-h-[360px] [&_input]:h-11 [&_input]:text-base');
    expect(source).toContain('grid grid-cols-1 gap-5 md:grid-cols-2');
    expect(source).toContain('grid grid-cols-1 gap-5 md:grid-cols-3');
    expect(source).toContain('flex min-h-24 items-center justify-between rounded-xl border p-4');
  });

  it("放大商品管理列表的图片、文字、行距与操作按钮而不改变现有操作入口", () => {
    const source = readClientPage("ProductsV2.tsx");

    expect(source).toContain('className="[&>td]:py-5 [&>td]:text-base"');
    expect(source).toContain('className="h-20 w-20"');
    expect(source).toContain('className="text-lg font-semibold leading-snug line-clamp-2"');
    expect(source).toContain('className="h-10 w-10" aria-label={translate(`操作「{name}」`');
    expect(source).toContain('translate("编辑商品", "Edit product")');
    expect(source).toContain('translate("复制商品", "Duplicate")');
  });
});
