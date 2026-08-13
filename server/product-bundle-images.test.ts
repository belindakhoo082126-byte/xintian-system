import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("组合包图片显示与预览", () => {
  const root = path.resolve(__dirname, "..");
  const page = fs.readFileSync(path.join(root, "client/src/pages/ProductBundles.tsx"), "utf8");
  const db = fs.readFileSync(path.join(root, "server/db.ts"), "utf8");

  it("后台列表显示已上传封面，并使用统一的可缩放预览入口", () => {
    expect(page).toContain('<TableHead className="w-20">封面</TableHead>');
    expect(page).toContain('src={bundle.coverImage}');
    expect(page).toContain('label="放大查看组合包封面"');
    expect(page).toContain('className="h-12 w-12"');
  });

  it("创建组合时将商品主图带入组成项目，并在创建和详情表格中可放大查看", () => {
    expect(page).toContain('imageUrl: product.coverImageUrl || product.coverImage || undefined');
    expect(page).toContain('<TableHead className="w-16">图片</TableHead>');
    expect(page).toContain('src={item.imageUrl}');
    expect(page).toContain('label="放大查看组成商品图片"');
  });

  it("创建和编辑的组合包封面预览都复用统一可缩放预览组件", () => {
    expect(page).toContain('alt="组合包封面预览"');
    expect((page.match(/label="放大查看组合包封面"/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it("组成商品图片仅从既有商品主图读取，不修改组合库存、售价或下单处理", () => {
    expect(db).toContain("async function attachBundleItemImages");
    expect(db).toContain("imageUrl: products.coverImageUrl");
    expect(db).toContain("return { ...bundle, items: await attachBundleItemImages(db, items) }");
    expect(db).toContain("result.push({ ...bundle, items: await attachBundleItemImages(db, items) })");
  });
});
