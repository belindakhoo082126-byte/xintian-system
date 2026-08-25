import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const browse = readFileSync(resolve(process.cwd(), "client/src/pages/OrderBrowsePage.tsx"), "utf8");
const detail = readFileSync(resolve(process.cwd(), "client/src/pages/OrderDetail.tsx"), "utf8");
const list = readFileSync(resolve(process.cwd(), "client/src/pages/Orders.tsx"), "utf8");

describe("order split and merge action placement", () => {
  it("keeps split and merge entry points in the order management list", () => {
    expect(list).toContain("data-page-merge-entry")
    expect(list).toContain("data-page-split-entry")
  })

  it("does not render split or merge buttons inside order detail pages", () => {
    const browseHeader = browse.slice(browse.indexOf("{/* Header */}"), browse.indexOf("{o.checkoutLink && ("))
    const detailActions = detail.slice(detail.indexOf("{/* Action Buttons */}"), detail.indexOf('<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">'))

    expect(browseHeader).not.toContain("拆分订单")
    expect(browseHeader).not.toContain("合并订单")
    expect(detailActions).not.toContain("拆分订单")
    expect(detailActions).not.toContain("合并订单")
  })
})
