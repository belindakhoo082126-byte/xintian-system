import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const readClientSource = (relativePath: string) =>
  fs.readFileSync(path.join(root, "client/src", relativePath), "utf8");

const zoomDialog = readClientSource("components/ImageZoomDialog.tsx");
const imagePreview = readClientSource("components/ProductImagePreview.tsx");
const ordersPage = readClientSource("pages/Orders.tsx");
const productsPage = readClientSource("pages/ProductsV2.tsx");
const liveRoomPage = readClientSource("pages/LiveRoomDetail.tsx");
const packingDetailPage = readClientSource("pages/PackingDetail.tsx");

describe("统一图片缩放预览", () => {
  it("限制缩放范围，并在每次打开或关闭时重置缩放与拖动位置", () => {
    expect(zoomDialog).toContain("const MIN_ZOOM = 1");
    expect(zoomDialog).toContain("const MAX_ZOOM = 4");
    expect(zoomDialog).toContain("if (open) resetView()");
    expect(zoomDialog).toContain("if (!nextOpen) resetView()");
    expect(zoomDialog).toContain("setOffset({ x: 0, y: 0 })");
  });

  it("以滚轮、按钮及指针拖动提供可访问的缩放查看，不依赖额外图片库", () => {
    expect(zoomDialog).toContain("onWheel={handleWheel}");
    expect(zoomDialog).toContain("setPointerCapture(event.pointerId)");
    expect(zoomDialog).toContain("onPointerMove={handlePointerMove}");
    expect(zoomDialog).toContain("transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`");
    expect(zoomDialog).toContain("aria-label=\"放大图片\"");
    expect(zoomDialog).toContain("aria-label=\"重置图片缩放与位置\"");
  });

  it("订单、实际商品管理、直播间商品与包货工作台均经过统一缩放入口", () => {
    expect(imagePreview).toContain('import { ImageZoomDialog } from "@/components/ImageZoomDialog"');
    expect(ordersPage).toContain('label={translate("预览并缩放付款凭证", "Preview and zoom payment receipt")}');
    expect(productsPage).toContain('label={translate("预览并缩放封面图片", "Preview and zoom cover image")}');
    expect(productsPage).toContain('label={translate("预览并缩放规格图片", "Preview and zoom variant image")}');
    expect(liveRoomPage).toContain('import { ImageZoomDialog } from "@/components/ImageZoomDialog"');
    expect(liveRoomPage).toContain("预览并缩放规格图片");
    expect(packingDetailPage).toContain('import { ProductImagePreview } from "@/components/ProductImagePreview"');
    expect(packingDetailPage).toContain("<ProductImagePreview");
  });
});
