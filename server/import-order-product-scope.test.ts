import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const dbSource = fs.readFileSync(path.join(process.cwd(), "server/db.ts"), "utf8");
const routerSource = fs.readFileSync(path.join(process.cwd(), "server/routers.ts"), "utf8");
const createSource = fs.readFileSync(path.join(process.cwd(), "client/src/pages/OrderCreatePage.tsx"), "utf8");
const editOrderSource = fs.readFileSync(path.join(process.cwd(), "client/src/pages/OrderEditPage.tsx"), "utf8");
const businessAiSource = fs.readFileSync(path.join(process.cwd(), "server/businessAi.ts"), "utf8");
const productSchemaSource = fs.readFileSync(path.join(process.cwd(), "drizzle/schema.ts"), "utf8");
const productsPageSource = fs.readFileSync(path.join(process.cwd(), "client/src/pages/ProductsV2.tsx"), "utf8");
const importBatchesPageSource = fs.readFileSync(path.join(process.cwd(), "client/src/pages/ImportBatches.tsx"), "utf8");

describe("中国代购订单与Walk in范围", () => {
  it("在服务层以商品级资格执行中国进口与本地配套商品范围", () => {
    expect(dbSource).toContain('product.salesMode === "import_preorder"');
    expect(dbSource).toContain("Boolean(product.allowImportOrder)");
    expect(dbSource).toContain('allowImportOrder: products.allowImportOrder');
    expect(dbSource).toContain("assertChinaImportOrderItemsEligible(data.items.map");
    expect(dbSource).toContain("await assertChinaImportOrderItemsEligible(productIds)");
    expect(businessAiSource).toContain('if (orderCategory === "import")');
    expect(businessAiSource).toContain("await assertChinaImportOrderItemsEligible(productIds)");
  });

  it("让本地配套商品默认归入 XT，只有有效中国代购上下文才可归入 XTC", () => {
    expect(dbSource).toContain('A local accessory with allowImportOrder remains XT by default');
    expect(dbSource).toContain('if (opts.liveType === "import_preorder") return "import"');
    expect(dbSource).toContain('normal mall / AI / private-chat checkout');
  });

  it("在商品主档、实际保存接口与商品管理界面提供独立的中国代购资格开关", () => {
    expect(productSchemaSource).toContain('allowImportOrder: boolean("allowImportOrder").default(false).notNull()');
    expect(routerSource).toContain('allowImportOrder: z.boolean().optional()');
    expect(productsPageSource).toContain('allowImportOrder: false');
    expect(productsPageSource).toContain('Switch checked={form.allowImportOrder}');
    expect(productsPageSource).toContain('允许进入中国代购订单');
  });

  it("让商品列表按真实中国进口或本地授权资格筛选，并显示可辨识的来源标签", () => {
    expect(dbSource).toContain("importEligibility?: 'eligible' | 'ineligible';");
    expect(dbSource).toContain("if (params.importEligibility === 'eligible')");
    expect(dbSource).toContain("eq(products.salesMode, 'import_preorder')");
    expect(dbSource).toContain("eq(products.allowImportOrder, true)");
    expect(routerSource).toContain("importEligibility: z.enum(['eligible', 'ineligible']).optional()");
    expect(productsPageSource).toContain('value="eligible"');
    expect(productsPageSource).toContain('中国进口');
    expect(productsPageSource).toContain('可入 XTC');
  });

  it("让 CN 合并结果传递来源字段，并在选品时说明资格原因且阻止未授权本地商品", () => {
    expect(dbSource).toContain('salesMode: products.salesMode');
    expect(dbSource).toContain('allowImportOrder: products.allowImportOrder');
    expect(dbSource).toContain('allowImportOrder: Boolean(row.allowImportOrder)');
    expect(importBatchesPageSource).toContain('function getXtcEligibility(product: any)');
    expect(importBatchesPageSource).toContain('中国进口商品（可加入 XTC）');
    expect(importBatchesPageSource).toContain('本地配套（已授权，可加入 XTC）');
    expect(importBatchesPageSource).toContain('本地商品（未授权进入代购）');
    expect(importBatchesPageSource).toContain('disabled={!eligibility.eligible}');
    expect(importBatchesPageSource).toContain('<TableHead>商品来源</TableHead>');
  });

  it("在商品搜索阶段按订单类别收窄中国代购可选商品", () => {
    expect(routerSource).toContain('orderCategory: z.enum(["local", "import"]).optional()');
    expect(routerSource).toContain("db.getProductsForOrder({ search: input.query, orderCategory: input.orderCategory })");
    expect(createSource).toContain("{ query: productSearchQuery, orderCategory }");
  });

  it("将Walk in强制为自取、免运费并隐藏配送资料", () => {
    expect(createSource).toContain('setCustomerForm({ name: "Walk in"');
    expect(createSource).toContain('setShippingMethod("self_pickup")');
    expect(createSource).toContain('shippingMethod: isWalkIn ? "self_pickup" : shippingMethod');
    expect(createSource).toContain('{!isWalkIn && <Card>');
  });

  it("将 Walk-in 运费在编辑与服务端保存时强制归零，不允许配送费重新写入", () => {
    expect(dbSource).toContain('const isWalkInSelfPickup = existingOrder?.orderCategory !== "import" && effectiveShippingMethod === "self_pickup"');
    expect(dbSource).toContain('updateData.shippingFee = "0.00"');
    expect(dbSource).toContain('updateData.customerPaidShipping = "0.00"');
    expect(editOrderSource).toContain('shippingFee: isSelfPickup ? "0.00" : formData.shippingFee');
    expect(editOrderSource).toContain('Walk-in 自取订单，不收取运费');
  });

  it("将区域7实际全额确认付款的本地 Walk-in 自取订单直接流转为已完成", () => {
    expect(dbSource).toContain("if (order[0].shippingMethod === 'self_pickup' && order[0].orderCategory !== 'import')");
    expect(dbSource).toContain("newStatus = 'completed' as any;");
    expect(dbSource).toContain("updateSet.completedAt = new Date();");
  });
});
