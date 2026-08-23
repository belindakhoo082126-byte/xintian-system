import { describe, expect, it } from "vitest";
import { ORDER_DOCUMENT_OUTPUT_OPTIONS } from "@shared/orderDocumentOutputRules";

describe("正式单据输出统一规则", () => {
  it("Preview、下载与打印都使用客户单据版式并显示商品图片", () => {
    expect(ORDER_DOCUMENT_OUTPUT_OPTIONS).toEqual({
      variant: "customer",
      showProductImage: true,
    });
  });
});
