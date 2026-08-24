import { describe, expect, it } from "vitest";
import { generateCustomerCarePackPdf } from "./carePackPdf";

describe("server care-pack PDF", () => {
  it("generates a customer-safe PDF from the allow-listed care document", async () => {
    const pdf = await generateCustomerCarePackPdf({
      title: "商品养护／使用知识包",
      intro: null,
      generatedAt: "2026-08-24T00:00:00.000Z",
      products: [{
        productName: "PDF测试植物",
        variationName: null,
        images: [],
        content: {
          profileType: "plant",
          plant: { light: "半日晒", water: "干透浇透", fertilizer: null, pruning: null, notes: null },
        },
        missing: [],
      }],
    });

    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1_000);
    expect(pdf.toString("latin1")).not.toContain("customerPhone");
    expect(pdf.toString("latin1")).not.toContain("shippingAddress");
  });
});
