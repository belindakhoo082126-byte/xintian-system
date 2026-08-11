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

  it("心田自然使用暖米白、田园绿与陶土橙的植物画册配色，并有专属连续水彩背景", () => {
    const natureTheme = getMallTheme("xintian_nature");
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(natureTheme.background).toBe("#f8f3e9");
    expect(natureTheme.primary).toBe("#31593e");
    expect(natureTheme.button).toBe("#c9703d");
    expect(natureTheme.visual.description.zh).toContain("田园植物画册");
    expect(artwork).toContain("NATURAL_CONTINUOUS_BACKGROUND_URL");
    expect(artwork).toContain("xintian-natural-continuous-watercolor-landscape_03bbc155.png");
    expect(artwork).toContain('theme.key === "xintian_nature"');
    expect(artwork).toContain("fixed inset-0 z-0");
    expect(artwork).toContain("bg-cover bg-center bg-no-repeat");
  });

  it("薰衣草紫使用暖白、柔和花田紫与月光色，并有专属连续月夜花田背景", () => {
    const lavenderTheme = getMallTheme("lavender_purple");
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(lavenderTheme.visual.description.zh).toContain("薰衣草");
    expect(lavenderTheme.visual.motifs).toContain("☾");
    expect(lavenderTheme.colors).toMatchObject({ primary: "#5a4689", secondary: "#c8b7de", button: "#b86f99" });
    expect(artwork).toContain("LAVENDER_CONTINUOUS_BACKGROUND_URL");
    expect(artwork).toContain("xintian-lavender-continuous-moonlit-meadow_65b21502.png");
    expect(artwork).toContain('theme.key === "lavender_purple"');
    expect(artwork).toContain("fixed inset-0 z-0");
  });

  it("樱花粉使用暖白纸感、樱花粉、日落珊瑚粉与苔藓绿，并有专属连续春日庭园背景", () => {
    const sakuraTheme = getMallTheme("sakura_pink");
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(sakuraTheme.visual.description.zh).toContain("春日水彩");
    expect(sakuraTheme.visual.description.zh).toContain("水面庭园");
    expect(sakuraTheme.colors).toMatchObject({ primary: "#c97887", secondary: "#a7b591", button: "#e58b76", background: "#fffaf4" });
    expect(sakuraTheme.visual.motifs).toContain("✿");
    expect(artwork).toContain("SAKURA_CONTINUOUS_BACKGROUND_URL");
    expect(artwork).toContain("xintian-sakura-continuous-spring-garden-v2_b643cc4b.png");
    expect(artwork).toContain('theme.key === "sakura_pink"');
    expect(artwork).toContain("fixed inset-0 z-0");
    expect(artwork).toContain("bg-cover bg-center bg-no-repeat");
  });

  it("自然绿使用暖白温室、森林绿、鼠尾草绿与嫩芽绿，并有专属连续温室绿植背景", () => {
    const natureGreenTheme = getMallTheme("nature_green");
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(natureGreenTheme.visual.description.zh).toContain("暖白温室");
    expect(natureGreenTheme.visual.description.zh).toContain("垂吊藤蔓");
    expect(natureGreenTheme.colors).toMatchObject({ primary: "#0f5b45", secondary: "#86a77b", button: "#1d6c54", background: "#f8faf3" });
    expect(natureGreenTheme.visual.motifs).toContain("⌁");
    expect(artwork).toContain("NATURE_GREEN_CONTINUOUS_BACKGROUND_URL");
    expect(artwork).toContain("xintian-natural-green-continuous-sunlit-conservatory_ce98dee3.png");
    expect(artwork).toContain('theme.key === "nature_green"');
    expect(artwork).toContain("fixed inset-0 z-0");
    expect(artwork).toContain("bg-cover bg-center bg-no-repeat");
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
