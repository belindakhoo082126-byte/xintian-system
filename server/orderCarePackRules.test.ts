import { describe, expect, it } from "vitest";
import {
  createCarePackPublicDocument,
  groupEffectiveCarePackItems,
  mapRealCareContent,
  resolveCarePackDocument,
} from "../shared/orderCarePackRules";

describe("order care pack rules", () => {
  it("groups effective items by product plus specification and ignores removed rows", () => {
    expect(groupEffectiveCarePackItems([
      { orderItemId: 1, productId: 10, variationId: 2, productName: "黄豆肥", variationName: "1kg", quantity: 2 },
      { orderItemId: 2, productId: 10, variationId: 2, productName: "黄豆肥", variationName: "1kg", quantity: 1 },
      { orderItemId: 3, productId: 10, variationId: 3, productName: "黄豆肥", variationName: "3kg", quantity: 1 },
      { orderItemId: 4, productId: 99, productName: "已取消商品", quantity: 1, isCancelled: true },
      { orderItemId: 5, productId: 99, productName: "数量归零", quantity: 0 },
    ])).toEqual([
      { productId: 10, variationId: 2, productName: "黄豆肥", variationName: "1kg", quantity: 3, orderItemIds: [1, 2] },
      { productId: 10, variationId: 3, productName: "黄豆肥", variationName: "3kg", quantity: 1, orderItemIds: [3] },
    ]);
  });

  it("reports missing plant fields instead of creating care text", () => {
    const content = mapRealCareContent({ profileType: "plant" }, {
      lightDesc: "明亮散射光", waterDesc: "表土干再浇", fertilizerDesc: "薄肥勤施", pruningDesc: "剪除黄叶", careZh: "避免积水",
    });
    expect(content.missing).toEqual([]);
    expect(content.plant).toMatchObject({ light: "明亮散射光", notes: "避免积水" });

    expect(mapRealCareContent({ profileType: "plant" }, { lightDesc: "明亮散射光" }).missing.map((field) => field.label))
      .toEqual(["水分／浇水", "施肥", "修剪", "注意事项"]);
  });

  it("maps existing plant fields before a plant profile has been explicitly saved", () => {
    const content = mapRealCareContent(undefined, {
      lightDesc: "明亮散射光", waterDesc: "见干见湿", fertilizerDesc: "生长期薄肥", pruningDesc: "修剪枯叶", careZh: "保持通风",
    });
    expect(content.profileType).toBe("plant");
    expect(content.plant?.light).toBe("明亮散射光");
    expect(content.missing).toEqual([]);
  });

  it("requires all non-plant usage fields and keeps staff text unchanged", () => {
    const content = mapRealCareContent({
      profileType: "fertilizer", purpose: "促进根系", usageMethod: "兑水灌根", dosage: "1:1000",
      frequency: "每两周", suitableFor: "观叶植物", safetyNotes: "勿超量", additionalNotes: "开封后密封",
    }, {});
    expect(content.missing).toEqual([]);
    expect(content.use).toMatchObject({ dosage: "1:1000", safetyNotes: "勿超量" });
    expect(mapRealCareContent({ profileType: "fertilizer", purpose: "促进根系" }, {}).missing.map((field) => field.label))
      .toEqual(["使用方法", "剂量", "频率", "适用对象", "安全注意事项"]);
  });

  it("projects only the customer knowledge allow-list and excludes sensitive fields", () => {
    const document = createCarePackPublicDocument({
      title: "商品养护／使用知识包",
      intro: "请按说明使用",
      generatedAt: "2026-08-23T00:00:00.000Z",
      products: [{
        productName: "黄豆肥", variationName: "1kg", images: ["https://img.example/a.jpg", "https://img.example/a.jpg"],
        content: mapRealCareContent({ profileType: "fertilizer", purpose: "追肥", usageMethod: "兑水", dosage: "1:1000", frequency: "两周一次", suitableFor: "盆栽", safetyNotes: "勿过量" }, {}),
      }],
    });
    expect(document).toMatchObject({ products: [{ productName: "黄豆肥", images: ["https://img.example/a.jpg"] }] });
    expect(JSON.stringify(document)).not.toMatch(/address|payment|customer|total|orderId|phone/i);
  });

  it("keeps final snapshot immutable and invalidates revoked public pages", () => {
    const finalSnapshot = { title: "冻结内容", products: [] };
    expect(resolveCarePackDocument({ status: "finalized", finalSnapshot, liveDocument: { title: "新资料", products: [] } })).toBe(finalSnapshot);
    expect(resolveCarePackDocument({ status: "active", finalSnapshot, liveDocument: { title: "新资料", products: [] } })).toEqual({ title: "新资料", products: [] });
    expect(resolveCarePackDocument({ status: "revoked", finalSnapshot, liveDocument: { title: "新资料", products: [] } })).toBeNull();
  });

  it("keeps the original active link document current after add, remove and specification changes", () => {
    const before = groupEffectiveCarePackItems([
      { orderItemId: 1, productId: 9, variationId: 1, productName: "ECO21", variationName: "500ml", quantity: 1 },
    ]);
    const after = groupEffectiveCarePackItems([
      { orderItemId: 2, productId: 9, variationId: 2, productName: "ECO21", variationName: "1L", quantity: 2 },
      { orderItemId: 3, productId: 13, productName: "黄豆肥", quantity: 1 },
    ]);
    expect(before).toEqual([{ productId: 9, variationId: 1, productName: "ECO21", variationName: "500ml", quantity: 1, orderItemIds: [1] }]);
    expect(after).toEqual([
      { productId: 13, variationId: 0, productName: "黄豆肥", variationName: null, quantity: 1, orderItemIds: [3] },
      { productId: 9, variationId: 2, productName: "ECO21", variationName: "1L", quantity: 2, orderItemIds: [2] },
    ]);
    expect(resolveCarePackDocument({ status: "active", liveDocument: after, finalSnapshot: before })).toBe(after);
  });

  it("uses updated staff product text on an active original link but not after finalization", () => {
    const original = createCarePackPublicDocument({
      title: "知识包", generatedAt: "2026-08-23T00:00:00.000Z", products: [{ productName: "ASTER", content: mapRealCareContent({ profileType: "plant" }, { lightDesc: "散射光", waterDesc: "见干见湿", fertilizerDesc: "薄肥", pruningDesc: "去黄叶", careZh: "保持通风" }) }],
    });
    const updated = createCarePackPublicDocument({
      title: "知识包", generatedAt: "2026-08-24T00:00:00.000Z", products: [{ productName: "ASTER", content: mapRealCareContent({ profileType: "plant" }, { lightDesc: "明亮散射光", waterDesc: "见干见湿", fertilizerDesc: "薄肥", pruningDesc: "去黄叶", careZh: "保持通风" }) }],
    });
    expect(resolveCarePackDocument({ status: "active", finalSnapshot: original, liveDocument: updated })?.products[0].content.plant?.light).toBe("明亮散射光");
    expect(resolveCarePackDocument({ status: "finalized", finalSnapshot: original, liveDocument: updated })?.products[0].content.plant?.light).toBe("散射光");
  });

  it("returns the same safe document shape for customer view/save/print and employee print preparation", () => {
    const document = createCarePackPublicDocument({
      title: "知识包", generatedAt: "2026-08-23T00:00:00.000Z", products: [{ productName: "介质", images: ["https://img.example/medium.jpg"], content: mapRealCareContent({ profileType: "medium", purpose: "改善介质", usageMethod: "直接铺设", dosage: "适量", frequency: "换盆时", suitableFor: "盆栽", safetyNotes: "置于儿童接触不到处" }, {}) }],
    });
    const serialized = JSON.stringify(document);
    expect(document.products[0].images).toEqual(["https://img.example/medium.jpg"]);
    expect(serialized).not.toMatch(/button|address|payment|totalAmount|customerName|phone/i);
    expect(document.products[0].content.use?.safetyNotes).toBe("置于儿童接触不到处");
  });
});
