import { describe, expect, it } from "vitest";
import { getMallCartItemCount, getMallShareLinks, readAndRepairMallCart, readMallCartItems, readMallFavoriteIds, toggleMallFavoriteId } from "../client/src/lib/mallInteractions";

describe("商城商品互动工具", () => {
  it("会安全读取并切换浏览器本机收藏商品", () => {
    expect(readMallFavoriteIds("[3, 3, 7, -1, \"8\"]")).toEqual([3, 7]);
    expect(readMallFavoriteIds("invalid-json")).toEqual([]);
    expect(toggleMallFavoriteId([3, 7], 7)).toEqual([3]);
    expect(toggleMallFavoriteId([3], 7)).toEqual([3, 7]);
  });

  it("不会把收藏或无效旧数据统计为购物车商品", () => {
    expect(readMallCartItems("[3, {\"productId\": 8, \"productName\": \"ECO21\", \"quantity\": 2}, {\"productId\": 9, \"quantity\": 1}]")).toEqual([
      { productId: 8, productName: "ECO21", quantity: 2 },
    ]);
    expect(getMallCartItemCount(readMallCartItems("[{\"productId\": 8, \"productName\": \"ECO21\", \"quantity\": 2}]"))).toBe(2);
  });

  it("会清理无效旧购物车记录，使角标数量与可渲染商品一致", () => {
    const values = new Map<string, string>([["mall_cart", "[3,{\"productId\":8,\"productName\":\"ECO21\",\"quantity\":2}]"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    const cart = readAndRepairMallCart(storage);
    expect(cart).toEqual([{ productId: 8, productName: "ECO21", quantity: 2 }]);
    expect(getMallCartItemCount(cart)).toBe(2);
    expect(values.get("mall_cart")).toBe("[{\"productId\":8,\"productName\":\"ECO21\",\"quantity\":2}]");
  });

  it("会生成 WhatsApp 与 Facebook 的可分享链接", () => {
    const links = getMallShareLinks({ url: "https://www.xintian.com.my/mall/product/8", text: "Monstera" });
    expect(links.whatsapp).toContain("wa.me/?text=");
    expect(links.whatsapp).toContain(encodeURIComponent("Monstera\nhttps://www.xintian.com.my/mall/product/8"));
    expect(links.facebook).toBe("https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fwww.xintian.com.my%2Fmall%2Fproduct%2F8");
  });
});
