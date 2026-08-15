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
const membershipSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/Membership.tsx"),
  "utf8",
);
const ordersSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/Orders.tsx"),
  "utf8",
);
const indexCssSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/index.css"),
  "utf8",
);
const adminPageHeaderSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/components/AdminPageHeader.tsx"),
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

  it("keeps the sole language selector above the Dashboard navigation for desktop and mobile", () => {
    expect(layoutSource).not.toContain("<AdminHeaderLanguageBridge />");
    expect(layoutSource).toContain("<Languages className=\"h-4 w-4\"");
    expect(layoutSource).toContain('data-language-selector');
    expect(layoutSource).toContain('tooltip={lang === "zh" ? "语言：中文" : "Language: English"}');
    expect(layoutSource).toContain('onSelect={() => setLang("zh")}');
    expect(layoutSource).toContain('onSelect={() => setLang("en")}');
    expect(layoutSource.indexOf('data-language-selector')).toBeLessThan(layoutSource.indexOf('{visibleMenu.map'));
    expect(layoutSource).not.toContain("sticky top-0 z-40 flex h-16");
    expect(adminPageHeaderSource).toContain("data-admin-page-header-actions");
  });

  it("keeps the menu title in the content Header while language selection remains sidebar-only", () => {
    expect(layoutSource).not.toContain("const topBarTitle");
    expect(layoutSource).not.toContain("data-menu-title-duplicate");
    expect(dashboardSource).toContain("<AdminPageHeader");
    expect(productsSource).toContain("<AdminPageHeader");
    expect(ordersSource).toContain("<AdminPageHeader");
    expect(adminPageHeaderSource).toContain("header-actions");
    expect(adminPageHeaderSource).not.toContain("data-language-selector");
  });

  it("uses the content Header as the single title source for every menu page", () => {
    expect(layoutSource).toContain('data-admin-menu-content');
    expect(layoutSource).toContain('data-language-selector');
    expect(indexCssSource).toContain(".header-with-actions");
    expect(indexCssSource).toContain(".header-actions");
    expect(membershipSource).not.toContain('translate("会员订单管理", "Membership Order Management")');
    expect(membershipSource).toContain('审核会员费汇款单据，确认后自动发送 Messenger 入群 Flow');
    expect(ordersSource).toContain("<AdminPageHeader");
    expect(ordersSource).toContain('中国代购订单管理与处理');
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
