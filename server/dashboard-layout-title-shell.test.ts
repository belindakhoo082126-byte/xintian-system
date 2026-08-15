import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"),
  "utf8",
);
const pageHeaderSource = readFileSync(
  resolve(process.cwd(), "client/src/components/AdminPageHeader.tsx"),
  "utf8",
);
const languageBridgeSource = readFileSync(
  resolve(process.cwd(), "client/src/components/AdminHeaderLanguageBridge.tsx"),
  "utf8",
);
const globalStyles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
const migratedPageSources = [
  "Dashboard.tsx",
  "ProductsV2.tsx",
  "Orders.tsx",
  "Customers.tsx",
  "LiveRooms.tsx",
].map((file) => readFileSync(resolve(process.cwd(), "client/src/pages", file), "utf8"));

describe("DashboardLayout page title shell", () => {
  it("does not render a second shared page title or use DOM title hiding", () => {
    expect(layoutSource).not.toContain("topBarTitle");
    expect(layoutSource).not.toContain("data-menu-title-duplicate");
    expect(layoutSource).not.toContain("querySelectorAll<HTMLElement>(\"h1\")");
  });

  it("does not mount a dynamic bridge that mutates traditional page headers", () => {
    expect(layoutSource).not.toContain("<AdminHeaderLanguageBridge />");
    expect(layoutSource).not.toContain('from "./AdminHeaderLanguageBridge"');
    expect(layoutSource).toContain('<SidebarInset className="relative w-full min-w-0 max-w-full overflow-x-hidden">');
    expect(layoutSource).not.toContain("fixed right-3 top-3");
    expect(layoutSource).not.toContain("sticky top-0 z-40 flex h-16");
  });

  it("keeps the language selector in the same semantic action group as page controls", () => {
    expect(pageHeaderSource).toContain("data-admin-page-header-actions");
    expect(pageHeaderSource).toContain("header-actions flex shrink-0 flex-wrap items-center justify-end gap-3");
    expect(pageHeaderSource).toContain("data-language-selector");
    expect(languageBridgeSource).toContain("createPortal");
    expect(languageBridgeSource).toContain("[data-admin-page-header-actions], [data-page-header-actions], .header-actions");
    expect(languageBridgeSource).not.toContain("position: absolute");
    expect(languageBridgeSource).not.toContain("negative margin");
  });

  it("keeps the experimental bridge isolated from the shared dashboard layout", () => {
    expect(languageBridgeSource).toContain("data-admin-language-bridge-selector");
    expect(layoutSource).not.toContain("AdminHeaderLanguageBridge");
  });

  it("migrates core admin pages to the shared Header action container", () => {
    for (const pageSource of migratedPageSources) {
      expect(pageSource).toContain('import { AdminPageHeader } from "@/components/AdminPageHeader"');
      expect(pageSource).toContain("<AdminPageHeader");
    }
  });

  it("normalizes action height, alignment, spacing, and small-screen wrapping", () => {
    expect(globalStyles).toContain("align-items: center;");
    expect(globalStyles).toContain("justify-content: flex-end;");
    expect(globalStyles).toContain("gap: 12px;");
    expect(globalStyles).toContain("height: 40px;");
    expect(globalStyles).toContain("flex-wrap: wrap;");
    expect(layoutSource).toContain('className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg');
    expect(layoutSource).toContain('aria-label="Toggle navigation"');
  });
});
