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
    expect(customTheme.visual.mascot.name.zh).toBe("画园");
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

  it("暖棕使用暖米白纸感、陶土棕、木质棕与橄榄绿，并有专属连续陶土木质温室背景", () => {
    const warmBrownTheme = getMallTheme("warm_brown");
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(warmBrownTheme.visual.description.zh).toContain("木质工作台");
    expect(warmBrownTheme.visual.description.zh).toContain("干燥花草");
    expect(warmBrownTheme.colors).toMatchObject({ primary: "#6b432d", secondary: "#c8a77b", button: "#b95f36", background: "#fbf5eb" });
    expect(warmBrownTheme.visual.motifs).toContain("⌁");
    expect(artwork).toContain("WARM_BROWN_CONTINUOUS_BACKGROUND_URL");
    expect(artwork).toContain("xintian-warm-brown-continuous-terracotta-conservatory_fc8df457.png");
    expect(artwork).toContain('theme.key === "warm_brown"');
    expect(artwork).toContain("fixed inset-0 z-0");
    expect(artwork).toContain("bg-cover bg-center bg-no-repeat");
  });

  it("圣诞节使用暖白纸感、松针深绿、蔓越莓红与香槟金，并有专属连续松枝灯火庭园背景", () => {
    const christmasTheme = getMallTheme("christmas");
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(christmasTheme.visual.description.zh).toContain("松枝");
    expect(christmasTheme.visual.description.zh).toContain("圣诞树");
    expect(christmasTheme.colors).toMatchObject({ primary: "#164a3a", secondary: "#b99a5a", button: "#b13a3f", background: "#fdf9ef" });
    expect(christmasTheme.visual.motifs).toContain("✦");
    expect(artwork).toContain("CHRISTMAS_CONTINUOUS_BACKGROUND_URL");
    expect(artwork).toContain("xintian-christmas-continuous-pine-light-garden_95b7a972.png");
    expect(artwork).toContain('theme.key === "christmas"');
    expect(artwork).toContain("fixed inset-0 z-0");
    expect(artwork).toContain("bg-cover bg-center bg-no-repeat");
  });

  it("农历新年使用暖白纸感、中国红、沉静赭棕与古典金，并有专属连续福瑞庭园背景", () => {
    const cnyTheme = getMallTheme("cny");
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(cnyTheme.visual.description.zh).toContain("完整连续福瑞庭园水彩");
    expect(cnyTheme.visual.description.zh).toContain("舞狮");
    expect(cnyTheme.colors).toMatchObject({ primary: "#a62322", secondary: "#c79b42", button: "#c84c31", background: "#fff8e7" });
    expect(cnyTheme.visual.motifs).toContain("✦");
    expect(artwork).toContain("CNY_CONTINUOUS_BACKGROUND_URL");
    expect(artwork).toContain("xintian-cny-continuous-prosperity-garden_7668df94.png");
    expect(artwork).toContain('theme.key === "cny"');
    expect(artwork).toContain("fixed inset-0 z-0");
    expect(artwork).toContain("bg-cover bg-center bg-no-repeat");
  });

  it("开斋节使用暖白纸感、翡翠深绿、柔和青绿与香槟金，并有专属连续翡翠月光庭园背景", () => {
    const hariRayaTheme = getMallTheme("hari_raya");
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(hariRayaTheme.visual.description.zh).toContain("马来粽");
    expect(hariRayaTheme.visual.description.zh).toContain("金色灯笼");
    expect(hariRayaTheme.colors).toMatchObject({ primary: "#0d5c49", secondary: "#6a9d7a", button: "#c69a48", background: "#fdf7e9" });
    expect(hariRayaTheme.visual.motifs).toContain("☾");
    expect(artwork).toContain("HARI_RAYA_CONTINUOUS_BACKGROUND_URL");
    expect(artwork).toContain("xintian-hari-raya-continuous-emerald-moonlight-garden_da1892d4.png");
    expect(artwork).toContain('theme.key === "hari_raya"');
    expect(artwork).toContain("fixed inset-0 z-0");
    expect(artwork).toContain("bg-cover bg-center bg-no-repeat");
  });

  it("MY独立日使用暖白纸感、国旗海军蓝、国庆红与金色，并有专属连续国庆热带庭园背景", () => {
    const merdekaTheme = getMallTheme("merdeka");
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(merdekaTheme.visual.description.zh).toContain("木槿花");
    expect(merdekaTheme.visual.description.zh).toContain("城市天际线");
    expect(merdekaTheme.colors).toMatchObject({ primary: "#193d6e", secondary: "#d5a948", button: "#c63e3e", background: "#fffaf2" });
    expect(merdekaTheme.visual.motifs).toContain("☾");
    expect(artwork).toContain("MERDEKA_CONTINUOUS_BACKGROUND_URL");
    expect(artwork).toContain("xintian-malaysia-day-continuous-tropical-garden_c5b9f763.png");
    expect(artwork).toContain('theme.key === "merdeka"');
    expect(artwork).toContain("fixed inset-0 z-0");
    expect(artwork).toContain("bg-cover bg-center bg-no-repeat");
  });

  it("中秋节使用暖白纸感、月夜深蓝、桂花绿与月光金，并有专属连续桂香月夜庭园背景", () => {
    const midAutumnTheme = getMallTheme("mid_autumn");
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(midAutumnTheme.visual.description.zh).toContain("桂香月夜庭园水彩");
    expect(midAutumnTheme.visual.description.zh).toContain("桂花枝");
    expect(midAutumnTheme.colors).toMatchObject({ primary: "#1a2744", secondary: "#4a6741", button: "#d4a843", background: "#fffaf0" });
    expect(midAutumnTheme.visual.motifs).toContain("☾");
    expect(artwork).toContain("MID_AUTUMN_CONTINUOUS_BACKGROUND_URL");
    expect(artwork).toContain("xintian-midautumn-continuous-osmanthus-moonlight-garden_52e83413.png");
    expect(artwork).toContain('theme.key === "mid_autumn"');
    expect(artwork).toContain("fixed inset-0 z-0");
    expect(artwork).toContain("bg-cover bg-center bg-no-repeat");
  });

  it("情人节使用参考图启发的暖白纸感、玫瑰酒红、雾粉、鼠尾草绿与香槟金，并有专属连续花意温室庭园背景", () => {
    const valentineTheme = getMallTheme("valentine");
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(valentineTheme.visual.description.zh).toContain("连续花意温室庭园水彩");
    expect(valentineTheme.visual.description.zh).toContain("藤蔓拱门");
    expect(valentineTheme.colors).toMatchObject({ primary: "#87343f", secondary: "#9faa90", button: "#bf6a75", background: "#fff8f1" });
    expect(valentineTheme.visual.motifs).toContain("🌹");
    expect(artwork).toContain("VALENTINE_CONTINUOUS_BACKGROUND_URL");
    expect(artwork).toContain("xintian-valentine-reference-continuous-conservatory-garden_c4d227fd.png");
    expect(artwork).toContain('theme.key === "valentine"');
    expect(artwork).toContain("fixed inset-0 z-0");
    expect(artwork).toContain("bg-cover bg-center bg-no-repeat");
  });

  it("自定义主题使用植物画室庭园默认视觉，并保留自定义颜色覆盖机制", () => {
    const customTheme = getMallTheme("custom");
    const customPalette = { primary: "#123456", secondary: "#234567", button: "#345678", background: "#456789", font: "#56789a" };
    const resolvedCustomTheme = getMallTheme("custom", customPalette);
    const root = path.resolve(__dirname, "..");
    const artwork = fs.readFileSync(path.join(root, "client/src/components/MallThemeArtwork.tsx"), "utf8");
    expect(customTheme.visual.description.zh).toContain("连续植物画室庭园水彩");
    expect(customTheme.visual.description.zh).toContain("植物绘图桌");
    expect(customTheme.colors).toMatchObject({ primary: "#285943", secondary: "#9aaf8b", button: "#c47845", background: "#faf8ef" });
    expect(resolvedCustomTheme.colors).toEqual(customPalette);
    expect(resolvedCustomTheme.primary).toBe(customPalette.primary);
    expect(artwork).toContain("CUSTOM_CONTINUOUS_BACKGROUND_URL");
    expect(artwork).toContain("xintian-custom-continuous-botanical-studio-garden_86b009f9.png");
    expect(artwork).toContain('theme.key === "custom"');
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
