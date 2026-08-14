import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"),
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

  it("leaves page titles to the page content instead of duplicating the active navigation label in the top bar", () => {
    const sidebarInset = layoutSource.slice(
      layoutSource.indexOf("<SidebarInset"),
      layoutSource.indexOf("<main className")
    );

    expect(layoutSource).not.toContain("let activeLabel");
    expect(sidebarInset).not.toContain("{activeLabel}");
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
