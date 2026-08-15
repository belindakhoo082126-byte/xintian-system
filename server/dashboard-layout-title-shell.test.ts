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

  it("keeps the sole language control in the sidebar without a fixed toolbar", () => {
    expect(layoutSource).not.toContain("<AdminHeaderLanguageBridge />");
    expect(layoutSource).not.toContain('from "./AdminHeaderLanguageBridge"');
    expect(layoutSource).toContain('data-language-selector');
    expect(layoutSource).toContain('tooltip={lang === "zh" ? "语言：中文" : "Language: English"}');
    expect(layoutSource.indexOf('data-language-selector')).toBeLessThan(layoutSource.indexOf('{visibleMenu.map'));
    expect(layoutSource).toContain('<SidebarInset className="relative flex h-svh min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden">');
    expect(layoutSource).toContain('const { state, toggleSidebar, isMobile } = useSidebar();');
    expect(layoutSource).toContain('{isMobile && (');
    expect(layoutSource).toContain('data-mobile-menu-bar className="flex h-14 shrink-0 items-center px-3"');
    expect(layoutSource).not.toContain('data-mobile-menu-bar className="flex h-14 shrink-0 items-center px-3 md:hidden"');
    expect(layoutSource).toContain('data-admin-menu-content className="min-h-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto');
    expect(layoutSource).not.toContain("fixed right-3 top-3");
    expect(layoutSource).not.toContain("sticky top-0 z-40 flex h-16");
  });

  it("keeps page actions separate from the sidebar-only language selector", () => {
    expect(pageHeaderSource).toContain("data-admin-page-header-actions");
    expect(pageHeaderSource).toContain("header-actions flex shrink-0 flex-wrap items-center justify-end gap-3");
    expect(pageHeaderSource).not.toContain("data-language-selector");
    expect(pageHeaderSource).not.toContain("DropdownMenu");
    expect(layoutSource).toContain('onSelect={() => setLang("zh")}');
    expect(layoutSource).toContain('onSelect={() => setLang("en")}');
  });

  it("migrates core admin pages to the shared Header action container", () => {
    for (const pageSource of migratedPageSources) {
      expect(pageSource).toContain('import { AdminPageHeader } from "@/components/AdminPageHeader"');
      expect(pageSource).toContain("<AdminPageHeader");
    }
  });

  it("provides complete English labels for every AI customer service menu entry", () => {
    expect(layoutSource).toContain('label: { zh: "AI 客服", en: "AI Customer Service" }');
    expect(layoutSource).toContain('label: { zh: "Chat 客服", en: "Chat Support" }');
    expect(layoutSource).toContain('label: { zh: "AI 转人工通知", en: "AI Handover Notifications" }');
    expect(layoutSource).toContain('label: { zh: "AI 大脑", en: "AI Brain" }');
    expect(layoutSource).toContain('label: { zh: "自动通知", en: "Automated Notifications" }');
    expect(layoutSource).toContain('label: { zh: "Flow 管理", en: "Flow Management" }');
    expect(layoutSource).toContain('label: { zh: "直播AI", en: "Live AI" }');
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
