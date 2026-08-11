export type MallThemeColors = {
  primary: string;
  secondary: string;
  button: string;
  background: string;
  font: string;
};

export type MallTheme = {
  key: string;
  label: { zh: string; en: string };
  colors: MallThemeColors;
  visual: {
    mascot: { glyph: string; name: { zh: string; en: string } };
    motifs: string[];
    pattern: string;
    edge: string;
    description: { zh: string; en: string };
  };
};

export type ResolvedMallTheme = MallTheme & MallThemeColors;

const DEFAULT_VISUAL: MallTheme["visual"] = {
  mascot: { glyph: "✨", name: { zh: "星芽", en: "Star Sprout" } },
  motifs: ["✦", "●", "✧"],
  pattern: "radial-gradient(circle at 14% 18%, rgba(45,106,79,.13) 0 2px, transparent 2.5px), radial-gradient(circle at 80% 76%, rgba(149,213,178,.26) 0 4px, transparent 4.5px)",
  edge: "linear-gradient(90deg, #2d6a4f, #95d5b2, #2d6a4f)",
  description: { zh: "让您的专属色彩成为温柔的购物舞台", en: "A gentle shopping stage in your own colours" },
};

export const MALL_THEMES: MallTheme[] = [
  { key: "xintian_nature", label: { zh: "🌿 心田自然", en: "🌿 Xintian Nature" }, colors: { primary: "#31593e", secondary: "#b8c3ad", button: "#c9703d", background: "#f8f3e9", font: "#20382a" }, visual: { mascot: { glyph: "🌱", name: { zh: "芽芽", en: "Sprout" } }, motifs: ["❋", "◌", "⌁"], pattern: "radial-gradient(ellipse at 10% 4%, rgba(184,195,173,.24) 0 16%, transparent 42%), radial-gradient(ellipse at 94% 15%, rgba(132,156,117,.18) 0 14%, transparent 39%), linear-gradient(155deg, rgba(255,253,246,.98), rgba(232,238,221,.72) 48%, rgba(248,243,233,.98))", edge: "linear-gradient(90deg, #31593e 0%, #94a681 38%, #d18a52 56%, #31593e 100%)", description: { zh: "暖米白纸感、水彩枝叶与幼苗的田园植物画册", en: "A botanical journal in warm ivory, watercolour foliage and sprouting life" } } },
  { key: "lavender_purple", label: { zh: "💜 薰衣草紫", en: "💜 Lavender Purple" }, colors: { primary: "#5a4689", secondary: "#c8b7de", button: "#b86f99", background: "#fcf9fd", font: "#46335f" }, visual: { mascot: { glyph: "🪻", name: { zh: "紫云", en: "Lavie" } }, motifs: ["✦", "✾", "☾"], pattern: "radial-gradient(ellipse at 10% 6%, rgba(200,183,222,.30) 0 18%, transparent 45%), radial-gradient(ellipse at 88% 12%, rgba(184,111,153,.10) 0 16%, transparent 42%), linear-gradient(155deg, rgba(252,249,253,.98), rgba(239,232,248,.76) 48%, rgba(252,249,253,.98))", edge: "linear-gradient(90deg, #5a4689 0%, #c8b7de 40%, #d8b24b 58%, #b86f99 76%, #5a4689 100%)", description: { zh: "暖白纸感、月光金与薰衣草花田的月夜画册", en: "A moonlit lavender meadow in warm ivory, soft violet and moonlit gold" } } },
  { key: "sakura_pink", label: { zh: "🌸 樱花粉", en: "🌸 Sakura Pink" }, colors: { primary: "#c97887", secondary: "#a7b591", button: "#e58b76", background: "#fffaf4", font: "#625552" }, visual: { mascot: { glyph: "🌸", name: { zh: "春樱", en: "Spring Sakura" } }, motifs: ["✿", "❀", "⌇"], pattern: "radial-gradient(ellipse at 12% 12%, rgba(201,120,135,.19) 0 16%, transparent 43%), radial-gradient(ellipse at 88% 74%, rgba(167,181,145,.16) 0 15%, transparent 42%), linear-gradient(155deg, rgba(255,252,246,.98), rgba(255,226,220,.62) 48%, rgba(255,250,244,.98))", edge: "linear-gradient(90deg, #c97887 0%, #f1c0bd 30%, #e58b76 56%, #a7b591 76%, #c97887 100%)", description: { zh: "暖白纸感、柔和樱花、晨光、远山与水面庭园的连续春日水彩", en: "A continuous spring garden in warm ivory, soft sakura, dawn light, distant hills and water" } } },
  { key: "nature_green", label: { zh: "🍃 自然绿", en: "🍃 Nature Green" }, colors: { primary: "#588157", secondary: "#a3b18a", button: "#3a5a40", background: "#fefce8", font: "#344e41" }, visual: { mascot: { glyph: "🐿️", name: { zh: "森森", en: "Mossy" } }, motifs: ["◒", "❋", "⌇"], pattern: "repeating-linear-gradient(115deg, rgba(163,177,138,.17) 0 2px, transparent 2px 24px), radial-gradient(circle at 82% 22%, rgba(88,129,87,.14) 0 34px, transparent 35px)", edge: "linear-gradient(90deg, #3a5a40, #a3b18a, #588157)", description: { zh: "苔藓林地与松果小精灵的自然呼吸", en: "A mossy grove with a little woodland friend" } } },
  { key: "warm_brown", label: { zh: "☕ 暖棕", en: "☕ Warm Brown" }, colors: { primary: "#8b5e34", secondary: "#d4a373", button: "#a47148", background: "#faf6f2", font: "#5c4033" }, visual: { mascot: { glyph: "🧸", name: { zh: "陶陶", en: "Terra" } }, motifs: ["◌", "✦", "⌁"], pattern: "linear-gradient(90deg, rgba(212,163,115,.16) 1px, transparent 1px) 0 0/18px 18px, linear-gradient(rgba(212,163,115,.12) 1px, transparent 1px) 0 0/18px 18px", edge: "linear-gradient(90deg, #8b5e34, #d4a373, #a47148)", description: { zh: "陶土格纹与小熊店长的温暖日常", en: "Warm terracotta tiles with a little bear host" } } },
  { key: "christmas", label: { zh: "🎄 圣诞节", en: "🎄 Christmas Day" }, colors: { primary: "#d62828", secondary: "#f1faee", button: "#003049", background: "#fefae0", font: "#1d3557" }, visual: { mascot: { glyph: "🐧", name: { zh: "松松", en: "Pine" } }, motifs: ["✦", "❄", "●"], pattern: "radial-gradient(circle at 18% 30%, rgba(255,255,255,.9) 0 2px, transparent 2.5px), radial-gradient(circle at 74% 70%, rgba(214,40,40,.12) 0 4px, transparent 4.5px), linear-gradient(135deg, rgba(241,250,238,.72), rgba(214,40,40,.05))", edge: "linear-gradient(90deg, #003049, #d62828, #003049)", description: { zh: "暖灯、飘雪与松果企鹅的节日小镇", en: "Warm lights, snow and a pinecone penguin" } } },
  { key: "cny", label: { zh: "🧧 农历新年", en: "🧧 Chinese New Year" }, colors: { primary: "#d62828", secondary: "#fcbf49", button: "#e63946", background: "#fff8e1", font: "#9d0208" }, visual: { mascot: { glyph: "🦁", name: { zh: "旺旺狮", en: "Prosper" } }, motifs: ["✧", "◎", "✦"], pattern: "radial-gradient(circle at 16% 18%, rgba(252,191,73,.35) 0 4px, transparent 4.5px), radial-gradient(circle at 82% 78%, rgba(214,40,40,.12) 0 26px, transparent 26.5px), repeating-linear-gradient(45deg, rgba(252,191,73,.08) 0 2px, transparent 2px 16px)", edge: "linear-gradient(90deg, #d62828, #fcbf49, #d62828)", description: { zh: "金纹、福光与旺旺狮的丰盛年味", en: "Golden festive patterns with a lucky lion cub" } } },
  { key: "hari_raya", label: { zh: "🌙 开斋节", en: "🌙 Hari Raya" }, colors: { primary: "#064635", secondary: "#d4af37", button: "#0a6b4a", background: "#f5f0e1", font: "#064635" }, visual: { mascot: { glyph: "🦌", name: { zh: "月月", en: "Luna" } }, motifs: ["☾", "✧", "⌁"], pattern: "radial-gradient(circle at 76% 22%, rgba(212,175,55,.22) 0 22px, transparent 22.5px), repeating-radial-gradient(circle at 14% 78%, rgba(6,70,53,.08) 0 2px, transparent 2px 14px)", edge: "linear-gradient(90deg, #064635, #d4af37, #064635)", description: { zh: "月牙、几何灯影与温柔的小鹿向导", en: "Moonlight geometry with a gentle deer guide" } } },
  { key: "merdeka", label: { zh: "🇲🇾 独立日", en: "🇲🇾 Hari Merdeka" }, colors: { primary: "#cc0000", secondary: "#ffff00", button: "#0000cc", background: "#fefefe", font: "#1a1a2e" }, visual: { mascot: { glyph: "🕊️", name: { zh: "云云", en: "Merdeka" } }, motifs: ["✦", "◈", "≈"], pattern: "repeating-linear-gradient(0deg, rgba(204,0,0,.08) 0 9px, transparent 9px 18px), radial-gradient(circle at 80% 24%, rgba(0,0,204,.12) 0 34px, transparent 34.5px)", edge: "linear-gradient(90deg, #cc0000, #ffff00, #0000cc)", description: { zh: "旗帜线条与自由小鸽的明亮庆典", en: "Bright flag lines with a little freedom dove" } } },
  { key: "mid_autumn", label: { zh: "🥮 中秋节", en: "🥮 Mid-Autumn" }, colors: { primary: "#e76f51", secondary: "#f4a261", button: "#264653", background: "#fefae0", font: "#2a2a2a" }, visual: { mascot: { glyph: "🐇", name: { zh: "月兔", en: "Moon Bun" } }, motifs: ["☾", "✦", "◌"], pattern: "radial-gradient(circle at 78% 20%, rgba(244,162,97,.32) 0 28px, transparent 28.5px), radial-gradient(circle at 18% 76%, rgba(38,70,83,.09) 0 3px, transparent 3.5px), linear-gradient(155deg, rgba(255,255,255,.48), rgba(244,162,97,.12))", edge: "linear-gradient(90deg, #264653, #f4a261, #e76f51)", description: { zh: "圆月、桂香与抱月饼的小月兔", en: "A moonlit garden with a mooncake-hugging rabbit" } } },
  { key: "valentine", label: { zh: "❤️ 情人节", en: "❤️ Valentine's Day" }, colors: { primary: "#e63946", secondary: "#f1faee", button: "#d62828", background: "#fff0f3", font: "#6a040f" }, visual: { mascot: { glyph: "🧸", name: { zh: "心心", en: "Heartie" } }, motifs: ["♥", "✦", "❀"], pattern: "radial-gradient(circle at 16% 22%, rgba(230,57,70,.16) 0 4px, transparent 4.5px), radial-gradient(circle at 78% 74%, rgba(214,40,40,.12) 0 7px, transparent 7.5px), linear-gradient(135deg, rgba(255,255,255,.65), rgba(230,57,70,.08))", edge: "linear-gradient(90deg, #e63946, #f1faee, #d62828)", description: { zh: "爱心花雨与抱花小熊的甜蜜告白", en: "A sweet heart shower with a flower-hugging bear" } } },
  { key: "custom", label: { zh: "🎨 自定义主题", en: "🎨 Custom Theme" }, colors: { primary: "#2d6a4f", secondary: "#95d5b2", button: "#40916c", background: "#f8f9fa", font: "#1b4332" }, visual: DEFAULT_VISUAL },
];

function isThemePalette(value: unknown): value is MallThemeColors {
  if (!value || typeof value !== "object") return false;
  const palette = value as Record<string, unknown>;
  return ["primary", "secondary", "button", "background", "font"].every((key) => typeof palette[key] === "string" && palette[key]);
}

export function getMallTheme(activeTheme?: string | null, customThemeColors?: unknown): ResolvedMallTheme {
  const selectedTheme = MALL_THEMES.find((theme) => theme.key === activeTheme) || MALL_THEMES[0];
  const colors = selectedTheme.key === "custom" && isThemePalette(customThemeColors) ? customThemeColors : selectedTheme.colors;
  return { ...selectedTheme, ...colors, colors };
}

export function getMallThemeByKey(themeKey: string): MallTheme {
  return MALL_THEMES.find((theme) => theme.key === themeKey) || MALL_THEMES[0];
}
