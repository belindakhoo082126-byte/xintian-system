import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("商城商品可读性保护", () => {
  it("列表商品卡与组合商品卡使用不透明白底，避免主题插画影响文字阅读", () => {
    const root = path.resolve(__dirname, "..");
    const source = fs.readFileSync(path.join(root, "client/src/pages/mall/MallHome.tsx"), "utf8");

    expect(source).toContain('mall-theme-card mall-theme-edge overflow-hidden mall-card-hover cursor-pointer group bg-white text-slate-900');
  });

  it("商品详情的购买信息与详情图片区使用白底阅读框", () => {
    const root = path.resolve(__dirname, "..");
    const source = fs.readFileSync(path.join(root, "client/src/pages/mall/MallProductDetail.tsx"), "utf8");

    expect(source).toContain('rounded-2xl border bg-white/95 p-4 text-slate-900 shadow-lg backdrop-blur-sm');
    expect(source).toContain('grid grid-cols-1 gap-2 border-t pt-4 sm:grid-cols-2');
  });
});
