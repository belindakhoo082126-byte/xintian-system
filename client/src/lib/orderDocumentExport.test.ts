import { describe, expect, it } from "vitest";
import { ORDER_DOCUMENT_EXPORT_HOST_STYLE } from "./orderDocumentExport";

describe("订单单据导出模板宿主", () => {
  it("应在页面可视区域外独立渲染，避免叠加后台图标", () => {
    expect(ORDER_DOCUMENT_EXPORT_HOST_STYLE.left).toMatch(/^-\d+px$/);
    expect(ORDER_DOCUMENT_EXPORT_HOST_STYLE.zIndex).toBe("2147483647");
    expect(ORDER_DOCUMENT_EXPORT_HOST_STYLE.opacity).toBe("1");
    expect(ORDER_DOCUMENT_EXPORT_HOST_STYLE.isolation).toBe("isolate");
  });
});
