import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("商城公开组合商品详情", () => {
  const root = path.resolve(__dirname, "..");
  const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
  const mallHome = fs.readFileSync(path.join(root, "client/src/pages/mall/MallHome.tsx"), "utf8");
  const detail = fs.readFileSync(path.join(root, "client/src/pages/mall/MallBundleDetail.tsx"), "utf8");
  const router = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");

  it("从商城组合卡进入公开组合详情页，不会落入后台 404 路由", () => {
    expect(mallHome).toContain('href={`/mall/bundle/${b.id}`}');
    expect(app).toContain('path={"/mall/bundle/:id"} component={MallBundleDetail}');
    expect(router).toContain("mallDetail: publicProcedure");
  });

  it("组合详情页沿用保存的 coverImage 字段显示上传的封面图片", () => {
    expect(mallHome).toContain("{b.coverImage ? (");
    expect(mallHome).toContain('<img src={b.coverImage} alt={b.name}');
    expect(detail).toContain("trpc.productBundles.mallDetail.useQuery");
    expect(detail).toContain("bundle.coverImage");
    expect(detail).toContain('<img src={bundle.coverImage}');
    expect(detail).toContain("组合内容");
  });
});
