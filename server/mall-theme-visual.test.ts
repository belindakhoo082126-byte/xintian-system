import { describe, expect, it } from "vitest";
import { MALL_THEMES, getMallTheme } from "../client/src/lib/mallTheme";
import fs from "node:fs";
import path from "node:path";

describe("商城主题完整视觉系统", () => {
  it("为每个主题定义了背景图案、边缘装饰、图标元素和代表性公仔", () => {
    expect(MALL_THEMES).toHaveLength(12);
    for (const theme of MALL_THEMES) {
      expect(theme.visual.pattern.length).toBeGreaterThan(20);
      expect(theme.visual.edge).toContain("gradient");
      expect(theme.visual.mascot.glyph).not.toHaveLength(0);
      expect(theme.visual.mascot.name.zh).not.toHaveLength(0);
      expect(theme.visual.motifs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("自定义主题保留完整视觉语言，同时采用管理员保存的配色", () => {
    const customTheme = getMallTheme("custom", { primary: "#111111", secondary: "#222222", button: "#333333", background: "#444444", font: "#555555" });
    expect(customTheme.primary).toBe("#111111");
    expect(customTheme.visual.mascot.name.zh).toBe("星芽");
  });

  it("商城设置及客户商城主流程均使用统一的主题视觉配置", () => {
    const root = path.resolve(__dirname, "..");
    const settingsPage = fs.readFileSync(path.join(root, "client/src/pages/MallSettings.tsx"), "utf8");
    const mallHome = fs.readFileSync(path.join(root, "client/src/pages/mall/MallHome.tsx"), "utf8");
    const productDetail = fs.readFileSync(path.join(root, "client/src/pages/mall/MallProductDetail.tsx"), "utf8");
    const checkout = fs.readFileSync(path.join(root, "client/src/pages/mall/MallCheckout.tsx"), "utf8");
    expect(settingsPage).toContain("MallThemePreview");
    expect(settingsPage).toContain("MALL_THEMES");
    expect(mallHome).toContain("MallThemeDecorations");
    expect(mallHome).toContain("getMallTheme");
    expect(productDetail).toContain("MallThemeDecorations");
    expect(checkout).toContain("MallThemeMascot");
  });
});
