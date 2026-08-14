import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"),
  "utf8",
);
const dashboardSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8",
);
const productsSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/ProductsV2.tsx"),
  "utf8",
);
const indexCssSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/index.css"),
  "utf8",
);

describe("侧边栏品牌区与导航分类配色", () => {
  it("uses the approved Xin Tian logo and keeps the sidebar header exclusively for navigation", () => {
    expect(layoutSource).toContain('src="/manus-storage/xintian-logo_701b1761.png"');
    expect(layoutSource).toContain('alt="心田 Xin Tian"');
    expect(layoutSource).toContain("心田 Xin Tian");
    expect(layoutSource).toContain('aria-label="Toggle navigation"');
    expect(layoutSource).toContain('className="flex h-11 w-11 shrink-0 items-center justify-center');

    const sidebarHeader = layoutSource.slice(
      layoutSource.indexOf("<SidebarHeader"),
      layoutSource.indexOf("</SidebarHeader>")
    );
    expect(sidebarHeader).not.toContain("setLang(");
    expect(sidebarHeader).not.toContain("Languages");
  });

  it("renders an independent 44px language menu in the page top bar for desktop and mobile", () => {
    const sidebarInset = layoutSource.slice(
      layoutSource.indexOf("<SidebarInset"),
      layoutSource.indexOf("<main className")
    );

    expect(sidebarInset).toContain('className="sticky top-0 z-40 flex h-16');
    expect(sidebarInset).toContain('<SidebarTrigger className="h-11 w-11 shrink-0 rounded-lg bg-background" />');
    expect(sidebarInset).toContain('className="flex h-11 min-w-11 shrink-0 items-center justify-center');
    expect(sidebarInset).toContain('aria-label={lang === "zh" ? "选择语言，目前为中文" : "Select language, currently English"}');
    expect(sidebarInset).toContain('sideOffset={10}');
    expect(sidebarInset).toContain('onSelect={() => setLang("zh")}');
    expect(sidebarInset).toContain('onSelect={() => setLang("en")}');
  });

  it("keeps the current menu title in the top bar, alongside the language selector", () => {
    const sidebarInset = layoutSource.slice(
      layoutSource.indexOf("<SidebarInset"),
      layoutSource.indexOf("<main className")
    );

    expect(layoutSource).toContain('const menuLeaves = visibleMenu.flatMap((item) => {');
    expect(layoutSource).toContain('const activeMenuItem = menuLeaves.find((item) => isMenuPathActive(location, item.path));');
    expect(layoutSource).toContain('const topBarTitle = activeMenuItem ? resolveLabel(activeMenuItem.label) : null;');
    expect(sidebarInset).toContain("{topBarTitle && (");
    expect(sidebarInset).toContain('<h1 className="truncate text-2xl font-bold tracking-tight">{topBarTitle}</h1>');
    expect(dashboardSource).not.toContain('<h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>');
    expect(productsSource).not.toContain('<h1 className="text-2xl font-semibold tracking-tight">{translate("商品管理", "Product Management")}</h1>');
  });

  it("uses the top bar as the single title source for every menu page", () => {
    expect(layoutSource).toContain('const menuLeaves = visibleMenu.flatMap((item) => {');
    expect(layoutSource).toContain('const activeMenuItem = menuLeaves.find((item) => isMenuPathActive(location, item.path));');
    expect(layoutSource).toContain('data-admin-menu-content');
    expect(layoutSource).toContain('duplicateHeading.dataset.menuTitleDuplicate = "true";');
    expect(indexCssSource).toContain('[data-admin-menu-content] [data-menu-title-duplicate="true"]');
  });

  it("assigns distinct accents to primary menu categories while keeping submenu items neutral", () => {
    for (const color of ["rose", "amber", "blue", "orange", "emerald", "violet", "indigo", "pink", "purple", "cyan", "slate"]) {
      expect(layoutSource).toContain(`text-${color}-600`);
    }

    expect(layoutSource).toContain("accent={item.accent}");
    expect(layoutSource).toContain('className="h-9 text-sm"');
  });

  it("uses a chocolate Lorry icon for the packing workbench", () => {
    expect(layoutSource).toContain('packing: { iconClass: "text-[#7B3F00]"');
    expect(layoutSource).toContain('data-[active=true]:bg-[#FFF2E6]');
    expect(layoutSource).toContain('{ icon: Truck, label: "nav.packing", path: "/packing", accent: MENU_ACCENTS.packing }');
  });
});
