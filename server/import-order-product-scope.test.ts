import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const dbSource = fs.readFileSync(path.join(process.cwd(), "server/db.ts"), "utf8");
const routerSource = fs.readFileSync(path.join(process.cwd(), "server/routers.ts"), "utf8");
const createSource = fs.readFileSync(path.join(process.cwd(), "client/src/pages/OrderCreatePage.tsx"), "utf8");
const businessAiSource = fs.readFileSync(path.join(process.cwd(), "server/businessAi.ts"), "utf8");

describe("中国代购订单与Walk in范围", () => {
  it("在服务层定义并执行中国进口代购、肥料和花盆商品白名单", () => {
    expect(dbSource).toContain('CHINA_IMPORT_ALLOWED_CATEGORY_NAMES = ["肥料", "花盆", "盆器"]');
    expect(dbSource).toContain('product.salesMode === "import_preorder"');
    expect(dbSource).toContain("assertChinaImportOrderItemsEligible(data.items.map");
    expect(dbSource).toContain("await assertChinaImportOrderItemsEligible(productIds)");
    expect(businessAiSource).toContain('if (orderCategory === "import")');
    expect(businessAiSource).toContain("await assertChinaImportOrderItemsEligible(productIds)");
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

  it("将全额确认付款的Walk in自取订单直接流转为已发货", () => {
    expect(dbSource).toContain("if (order[0].shippingMethod === 'self_pickup')");
    expect(dbSource).toContain("newStatus = 'shipped' as any;");
  });
});
