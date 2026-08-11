import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"),
  "utf8",
);

describe("侧边栏品牌区与导航分类配色", () => {
  it("uses the approved Xin Tian logo and keeps the language switch in the brand area", () => {
    expect(layoutSource).toContain('src="/manus-storage/xintian-logo_701b1761.png"');
    expect(layoutSource).toContain('alt="心田 Xin Tian"');
    expect(layoutSource).toContain("心田 Xin Tian");
    expect(layoutSource).toContain('aria-label={lang === "zh" ? "Switch to English" : "切换为中文"}');
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
