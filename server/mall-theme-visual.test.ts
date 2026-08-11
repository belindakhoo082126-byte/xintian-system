import { describe, expect, it } from "vitest";
import { MALL_THEMES, getMallTheme } from "../client/src/lib/mallTheme";
import fs from "node:fs";
import path from "node:path";

describe("商城主题完整视觉系统", () => {
  it("为每个主题定义了背景图案、边缘装饰与符合节日或田园风格的图标元素", () => {
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

  it("心田自然使用暖米白、田园绿与陶土橙的植物画册配色，并有专属水彩边缘插图", () => {
    const natureTheme = getMallTheme("xintian_nature");
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(natureTheme.background).toBe("#f8f3e9");
    expect(natureTheme.primary).toBe("#31593e");
    expect(natureTheme.button).toBe("#c9703d");
    expect(natureTheme.visual.description.zh).toContain("田园植物画册");
    expect(artwork).toContain("NATURAL_BOTANICAL_FRAME_URL");
    expect(artwork).toContain("xintian-natural-watercolor-botanical-frame_45f83b37.png");
    expect(artwork).toContain('theme.key === "xintian_nature"');
  });

  it("商城设置及客户商城主流程均使用统一的主题视觉配置，且不在页首展示主题公仔", () => {
    const root = path.resolve(__dirname, "..");
    const settingsPage = fs.readFileSync(path.join(root, "client/src/pages/MallSettings.tsx"), "utf8");
    const mallHome = fs.readFileSync(path.join(root, "client/src/pages/mall/MallHome.tsx"), "utf8");
    const productDetail = fs.readFileSync(path.join(root, "client/src/pages/mall/MallProductDetail.tsx"), "utf8");
    const checkout = fs.readFileSync(path.join(root, "client/src/pages/mall/MallCheckout.tsx"), "utf8");
    expect(settingsPage).toContain("MallThemePreview");
    expect(settingsPage).toContain("MALL_THEMES");
    expect(mallHome).toContain("MallThemeDecorations");
    expect(mallHome).toContain("getMallTheme");
    expect(mallHome).not.toContain("MallThemeMascot");
    expect(mallHome).not.toContain("主题小花园");
    expect(mallHome).toContain("商城公告");
    expect(mallHome).toContain("购物条款与政策");
    expect(mallHome).toContain("serviceTerms");
    expect(mallHome).not.toContain("仅剩{b.bundleStock}组");
    expect(productDetail).toContain("MallThemeDecorations");
    expect(productDetail).not.toContain("MallThemeMascot");
    expect(checkout).toContain("MallThemeDecorations");
    expect(checkout).not.toContain("MallThemeMascot");
  });
});
