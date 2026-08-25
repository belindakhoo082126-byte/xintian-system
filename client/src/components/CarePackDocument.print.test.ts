import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CarePackDocument print roles", () => {
  it("keeps product images in the customer print document and excludes them from employee A5 print", () => {
    const source = readFileSync(new URL("./CarePackDocument.tsx", import.meta.url), "utf8");

    expect(source).toContain('"care-pack-document--employee"');
    expect(source).toContain('"care-pack-document--customer"');
    expect(source).toContain(".care-pack-document--customer .care-pack-product-image {");
    expect(source).toContain("display: block !important;");
    expect(source).toContain(".care-pack-document--employee .care-pack-product-image,");
    expect(source).toContain("display: none !important;");
    expect(source).toContain(".care-pack-document--customer .care-pack-item > div {");
    expect(source).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
    expect(source).toContain('employeeMode ? "资料待补充" : "-"');
    expect(source).toContain("{employeeMode && missing.length > 0 ? (");
    expect(source).toContain('size: ${employeeMode ? "A5 portrait" : "A4 portrait"}');
    expect(source).toContain("保存PDF");
    expect(source).toContain("data-care-pack-export-root");
    expect(source).toContain("function CarePackProductImage");
    expect(source).toContain("ProductImagePreview");
    expect(source).toContain('label="点击放大商品图片"');
    expect(source).toContain("点击放大");
    expect(source).toContain(".care-pack-image-zoom-hint { display: none !important; }");
  });

  it("keeps customer browser printing separate from direct PDF download", () => {
    const source = readFileSync(new URL("../pages/CustomerCarePackPage.tsx", import.meta.url), "utf8");

    expect(source).toContain("function handlePrint()");
    expect(source).toContain("function handleSavePdf()");
    expect(source).toContain("trpc.publicCarePack.downloadPdf.useQuery");
    expect(source).toContain("contentBase64");
    expect(source).toContain('new Blob([bytes], { type: "application/pdf" })');
    expect(source).toContain("anchor.download = result.data.fileName");
    expect(source).not.toContain('import("jspdf")');
    expect(source).toContain("PDF生成失败");
  });
});
