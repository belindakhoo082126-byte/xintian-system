import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("直播商品操作与特价订单分类", () => {
  const root = path.resolve(__dirname, "..");
  const liveRoomPage = fs.readFileSync(path.join(root, "client/src/pages/LiveRoomDetail.tsx"), "utf8");
  const productPage = fs.readFileSync(path.join(root, "client/src/pages/ProductsV2.tsx"), "utf8");
  const db = fs.readFileSync(path.join(root, "server/db.ts"), "utf8");

  it("直播商品区默认使用大卡视图，并放大商品图片与关键操作按钮", () => {
    expect(liveRoomPage).toContain("useState<'large' | 'compact'>('large')");
    expect(liveRoomPage).toContain("w-[152px] h-[152px]");
    expect(liveRoomPage).toContain('h-10 w-10 p-0 justify-center');
    expect(liveRoomPage).toContain('h-11 w-12 p-0 justify-center');
  });

  it("商品列表以不同颜色标示特价、赠品及虚拟商品", () => {
    expect(productPage).toContain('p.isSpecial && <Badge className="border border-orange-200 bg-orange-100 text-orange-800');
    expect(productPage).toContain('p.type === "gift" && <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-800');
    expect(productPage).toContain('p.type === "virtual" && <Badge className="border border-violet-200 bg-violet-100 text-violet-800');
  });

  it("直播捉单以商品资料库特价设定生成价格和分类快照", () => {
    expect(db).toContain("export async function createOrderFromLiveCapture");
    expect(db).toContain("isSpecial: products.isSpecial");
    expect(db).toContain("specialPrice: products.specialPrice");
    expect(db).toContain('item.priceType = "special"');
    expect(db).toContain("item.originalUnitPrice = product.sellingPrice ? String(product.sellingPrice) : null");
    expect((db.match(/priceType: p\.priceType \|\| "retail"/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((db.match(/originalUnitPrice: p\.originalUnitPrice \|\| null/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
