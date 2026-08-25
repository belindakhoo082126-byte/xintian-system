import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("订单查看、Edit与Preview金额详情一致性", () => {
  const browse = readFileSync(new URL("./OrderBrowsePage.tsx", import.meta.url), "utf8");
  const edit = readFileSync(new URL("./OrderEditPage.tsx", import.meta.url), "utf8");
  const preview = readFileSync(new URL("../components/OrderDocument.tsx", import.meta.url), "utf8");

  it("三处均使用同一共享运费分项展示模型", () => {
    expect(browse).toContain('import { getOrderShippingDisplay } from "@shared/orderDocumentShippingRules"');
    expect(edit).toContain('import { getOrderShippingDisplay } from "@shared/orderDocumentShippingRules"');
    expect(preview).toContain('import { getOrderShippingDisplay } from "@shared/orderDocumentShippingRules"');
    expect(browse).toContain("shippingDisplay.rows.map((row)");
    expect(edit).toContain("shippingDisplay.rows.map((row)");
    expect(preview).toContain("rows: shippingRows");
  });

  it("查看页和Edit页使用与Preview相同的总金额、已确认付款、尚欠款标签", () => {
    for (const source of [browse, edit, preview]) {
      expect(source).toContain("已确认付款");
      expect(source).toContain("尚欠款");
      expect(source).toContain("最终应收金额");
    }
  });

  it("三处均使用同一普通商品与特价商品分项来源", () => {
    for (const source of [browse, edit, preview]) {
      expect(source).toContain("getOrderDocumentMerchandiseBreakdown");
      expect(source).toContain("原价商品");
      expect(source).toContain("特价商品");
    }
  });
});
