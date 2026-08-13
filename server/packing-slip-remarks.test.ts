import { describe, expect, it } from "vitest";
import { getPackingSlipRemarkRows, renderPackingSlipRemarkHtml } from "../shared/packingSlipRemarks";

describe("packing slip remarks", () => {
  it("normalizes customer and admin remarks into one de-duplicated print format", () => {
    const rows = getPackingSlipRemarkRows([
      { remarkCategory: "customer", content: "请先联络" },
      { remarkCategory: "repotting", content: "植物A配白盆" },
      { remarkCategory: "repotting", content: "植物A配白盆" },
      { remarkCategory: "desired_delivery_date", desiredDeliveryDate: "2026-08-20T00:00:00.000Z", desiredDeliveryReason: "下午送达" },
    ], "zh");

    expect(rows).toHaveLength(3);
    expect(rows).toEqual(expect.arrayContaining([
      { label: "客户备注", content: "请先联络" },
      { label: "换盆", content: "植物A配白盆" },
    ]));
    expect(rows[2]).toMatchObject({ label: "发货日期" });
    expect(rows[2]?.content).toContain("下午送达");
  });

  it("escapes user-provided note content before it is inserted into the workbench print HTML", () => {
    const html = renderPackingSlipRemarkHtml([{ label: "其他", content: "<img src=x onerror=alert(1)>" }]);
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
  });
});
