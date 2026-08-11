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
  { key: "nature_green", label: { zh: "🍃 自然绿", en: "🍃 Nature Green" }, colors: { primary: "#0f5b45", secondary: "#86a77b", button: "#1d6c54", background: "#f8faf3", font: "#21483a" }, visual: { mascot: { glyph: "🌿", name: { zh: "温温", en: "Verdant" } }, motifs: ["⌁", "❋", "◌"], pattern: "radial-gradient(ellipse at 8% 8%, rgba(134,167,123,.21) 0 16%, transparent 42%), radial-gradient(ellipse at 92% 76%, rgba(15,91,69,.11) 0 16%, transparent 44%), linear-gradient(155deg, rgba(255,255,250,.98), rgba(232,242,225,.68) 49%, rgba(248,250,243,.98))", edge: "linear-gradient(90deg, #0f5b45 0%, #5f9468 35%, #b6c967 55%, #86a77b 74%, #0f5b45 100%)", description: { zh: "暖白温室、拱窗光影、垂吊藤蔓与完整绿植庭园的连续水彩", en: "A continuous sunlit conservatory with arched glass, trailing vines and verdant plants" } } },
  { key: "warm_brown", label: { zh: "☕ 暖棕", en: "☕ Warm Brown" }, colors: { primary: "#6b432d", secondary: "#c8a77b", button: "#b95f36", background: "#fbf5eb", font: "#513729" }, visual: { mascot: { glyph: "🧸", name: { zh: "陶陶", en: "Terra" } }, motifs: ["⌁", "◌", "❋"], pattern: "radial-gradient(ellipse at 10% 8%, rgba(200,167,123,.23) 0 16%, transparent 42%), radial-gradient(ellipse at 91% 76%, rgba(185,95,54,.13) 0 16%, transparent 44%), linear-gradient(155deg, rgba(255,252,246,.98), rgba(241,226,204,.70) 49%, rgba(251,245,235,.98))", edge: "linear-gradient(90deg, #6b432d 0%, #b95f36 34%, #c8a77b 55%, #788150 75%, #6b432d 100%)", description: { zh: "暖米白纸感、陶盆、木质工作台、编织物与干燥花草的连续温室水彩", en: "A continuous warm conservatory in ivory, terracotta, wood, woven textures and dried botanicals" } } },
  { key: "christmas", label: { zh: "🎄 圣诞节", en: "🎄 Christmas Day" }, colors: { primary: "#164a3a", secondary: "#b99a5a", button: "#b13a3f", background: "#fdf9ef", font: "#2f473d" }, visual: { mascot: { glyph: "🎄", name: { zh: "松灯", en: "Pine Light" } }, motifs: ["✦", "❋", "◌"], pattern: "radial-gradient(ellipse at 10% 8%, rgba(22,74,58,.18) 0 16%, transparent 42%), radial-gradient(ellipse at 91% 76%, rgba(177,58,63,.12) 0 16%, transparent 44%), linear-gradient(155deg, rgba(255,253,247,.98), rgba(239,236,219,.72) 49%, rgba(253,249,239,.98))", edge: "linear-gradient(90deg, #164a3a 0%, #b13a3f 34%, #b99a5a 55%, #164a3a 100%)", description: { zh: "暖白纸感、松枝、红浆果、松果、灯火与圣诞树的完整连续节日庭园水彩", en: "A continuous festive garden in warm ivory, pine, red berries, pinecones, candlelight and a Christmas tree" } } },
  { key: "cny", label: { zh: "🧧 农历新年", en: "🧧 Chinese New Year" }, colors: { primary: "#a62322", secondary: "#c79b42", button: "#c84c31", background: "#fff8e7", font: "#5c2c26" }, visual: { mascot: { glyph: "🦁", name: { zh: "旺旺狮", en: "Prosper" } }, motifs: ["✦", "❀", "◎"], pattern: "radial-gradient(ellipse at 10% 8%, rgba(166,35,34,.16) 0 16%, transparent 42%), radial-gradient(ellipse at 91% 76%, rgba(199,155,66,.18) 0 16%, transparent 44%), linear-gradient(155deg, rgba(255,253,246,.98), rgba(249,235,208,.70) 49%, rgba(255,248,231,.98))", edge: "linear-gradient(90deg, #a62322 0%, #c84c31 34%, #c79b42 55%, #77563a 76%, #a62322 100%)", description: { zh: "暖白纸感、中国红、沉静赭棕与古典金，融入桃花、红灯笼、舞狮、柑橘、福礼与远景暖光的完整连续福瑞庭园水彩", en: "A continuous prosperity garden in warm ivory, Chinese red, terracotta brown and antique gold, with blossoms, lanterns, lion dance and mandarin oranges" } } },
  { key: "hari_raya", label: { zh: "🌙 开斋节", en: "🌙 Hari Raya" }, colors: { primary: "#0d5c49", secondary: "#6a9d7a", button: "#c69a48", background: "#fdf7e9", font: "#174c3e" }, visual: { mascot: { glyph: "🌙", name: { zh: "新月", en: "Crescent" } }, motifs: ["☾", "✧", "◇"], pattern: "radial-gradient(ellipse at 10% 8%, rgba(106,157,122,.20) 0 16%, transparent 42%), radial-gradient(ellipse at 91% 76%, rgba(198,154,72,.13) 0 16%, transparent 44%), linear-gradient(155deg, rgba(255,253,246,.98), rgba(225,239,223,.66) 49%, rgba(253,247,233,.98))", edge: "linear-gradient(90deg, #0d5c49 0%, #3d8370 34%, #c69a48 56%, #6a9d7a 76%, #0d5c49 100%)", description: { zh: "暖白纸感、翡翠月光、马来粽、金色灯笼、热带白花与祝福礼盒的完整连续节日庭园水彩", en: "A continuous festive garden in warm ivory, emerald moonlight, ketupat, gold lanterns, tropical blooms and celebration gifts" } } },
  { key: "merdeka", label: { zh: "🇲🇾 独立日", en: "🇲🇾 Hari Merdeka" }, colors: { primary: "#193d6e", secondary: "#d5a948", button: "#c63e3e", background: "#fffaf2", font: "#18355d" }, visual: { mascot: { glyph: "🌺", name: { zh: "木槿", en: "Hibiscus Glow" } }, motifs: ["✿", "☾", "✦"], pattern: "radial-gradient(ellipse at 10% 8%, rgba(198,62,62,.16) 0 16%, transparent 42%), radial-gradient(ellipse at 91% 76%, rgba(25,61,110,.12) 0 16%, transparent 44%), linear-gradient(155deg, rgba(255,253,247,.98), rgba(243,233,215,.68) 49%, rgba(255,250,242,.98))", edge: "linear-gradient(90deg, #193d6e 0%, #c63e3e 34%, #d5a948 54%, #e8e3d4 72%, #193d6e 100%)", description: { zh: "暖白纸感、木槿花、国旗色彩、城市天际线、传统风筝、月牙星与热带叶片的完整连续国庆庭园水彩", en: "A continuous Malaysia Day garden in warm ivory, hibiscus, flag colours, skyline, wau kite, crescent star and tropical leaves" } } },
  { key: "mid_autumn", label: { zh: "🥮 中秋节", en: "🥮 Mid-Autumn" }, colors: { primary: "#1a2744", secondary: "#4a6741", button: "#d4a843", background: "#fffaf0", font: "#1a2744" }, visual: { mascot: { glyph: "🐇", name: { zh: "桂月兔", en: "Osmanthus Moon Rabbit" } }, motifs: ["☾", "✦", "❀"], pattern: "radial-gradient(ellipse at 10% 8%, rgba(74,103,65,.18) 0 16%, transparent 42%), radial-gradient(ellipse at 90% 13%, rgba(212,168,67,.18) 0 17%, transparent 43%), linear-gradient(155deg, rgba(255,253,247,.98), rgba(237,232,211,.68) 49%, rgba(255,250,240,.98))", edge: "linear-gradient(90deg, #1a2744 0%, #4a6741 35%, #d4a843 55%, #4a6741 75%, #1a2744 100%)", description: { zh: "暖白纸感、月夜深蓝、桂花绿与月光金，融入满月、桂花枝、玉兔、茶席、月饼、灯笼与远景微光的完整连续桂香月夜庭园水彩", en: "A continuous osmanthus moonlit garden in warm ivory, midnight blue, osmanthus green and moonlit gold, with a full moon, rabbit, tea table, mooncakes and lantern glow" } } },
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
