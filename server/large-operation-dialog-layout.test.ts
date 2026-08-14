import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readClient = (path: string) =>
  readFileSync(new URL(`../client/src/${path}`, import.meta.url), "utf8");

describe("large operation dialog layout", () => {
  const component = readClient("components/LargeOperationDialog.tsx");
  const products = readClient("pages/ProductsV2.tsx");
  const refunds = readClient("pages/RefundManagement.tsx");
  const bundles = readClient("pages/ProductBundles.tsx");
  const packing = readClient("pages/PackingDetail.tsx");

  it("uses a dedicated desktop-sized outer container without a fixed minimum width", () => {
    expect(component).toContain('h-[90vh]');
    expect(component).toContain('max-h-[90vh]');
    expect(component).toContain('w-[90vw]');
    expect(component).toContain('max-w-[1400px]');
    expect(component).toContain('min-w-0');
    expect(component).toContain('overflow-hidden');
    expect(component).not.toContain('overflow-x-auto');
  });

  it("keeps the header and footer fixed while the body only scrolls vertically", () => {
    expect(component).toContain('grid-rows-[auto_minmax(0,1fr)_auto]');
    expect(component).toContain('shrink-0 border-b');
    expect(component).toContain('overflow-y-auto overflow-x-hidden');
    expect(component).toContain('shrink-0 border-t');
  });

  it("becomes a full-screen, non-horizontal operation view on mobile", () => {
    expect(component).toContain('max-sm:h-[100dvh]');
    expect(component).toContain('max-sm:w-screen');
    expect(component).toContain('max-sm:max-w-none');
    expect(component).toContain('max-sm:rounded-none');
  });

  it("applies the shared large dialog to all requested high-information workflows", () => {
    for (const source of [products, refunds, bundles, packing]) {
      expect(source).toContain('LargeOperationDialogContent');
      expect(source).toContain('LargeOperationDialogBody');
      expect(source).toContain('LargeOperationDialogFooter');
    }
  });

  it("keeps product and refund field content responsive instead of forcing a horizontal wide layout", () => {
    expect(products).toContain('grid-cols-1 gap-5 md:grid-cols-2');
    expect(products).toContain('grid-cols-1 gap-5 md:grid-cols-3');
    expect(refunds).toContain('grid gap-4');
    expect(refunds).toContain('lg:grid-cols-[minmax(0,1.7fr)_minmax(150px,.8fr)_140px_minmax(210px,1fr)]');
    expect(refunds).toContain('min-w-0');
  });
});
