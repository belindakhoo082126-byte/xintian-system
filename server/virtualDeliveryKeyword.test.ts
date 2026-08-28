import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/VirtualDelivery.tsx", import.meta.url), "utf8");

describe("虚拟交付关键词同步", () => {
  it("建立时优先保存管理员填写的商品和配套关键词，留空才回退默认VD编号", () => {
    expect(dbSource).toContain('const requestedProductKeyword = data.keyword?.toUpperCase().replace(/\\s+/g, "") || "";');
    expect(dbSource).toContain('const productKeyword = requestedProductKeyword || `VD${stamp}`;');
    expect(dbSource).toContain('const requestedVariantKeyword = item.keyword?.toUpperCase().replace(/\\s+/g, "") || "";');
    expect(dbSource).toContain('const variantKeyword = requestedVariantKeyword || `${productKeyword}${index + 1}`;');
  });

  it("编辑商品与配套时会保存关键词并阻止重复值", () => {
    expect(dbSource).toContain('productUpdate.keyword = normalizedKeyword;');
    expect(dbSource).toContain('variantUpdate.keyword = normalizedKeyword;');
    expect(dbSource).toContain('商品关键词「${normalizedKeyword}」已被「${conflict[0].name}」使用');
    expect(dbSource).toContain('配套关键词「${normalizedKeyword}」已被「${conflict[0].name}」使用');
  });

  it("路由和虚拟交付编辑画面均提供关键词字段", () => {
    expect(routerSource).toContain('keyword: z.string().trim().max(64, "关键词不能超过64个字").optional()');
    expect(pageSource).toContain('商品关键词（选填）');
    expect(pageSource).toContain('配套关键词（选填）');
    expect(pageSource).toContain('<Label>商品关键词</Label>');
    expect(pageSource).toContain('<Label>配套关键词</Label>');
  });
});
