/**
 * Product AI Intelligence — AI Product Recommendation Engine
 *
 * Flow:
 * 1. Parse customer message → extract AI tag keywords
 * 2. Query products by AI Tags match
 * 3. Filter by light/water/fertilizer attributes
 * 4. Check inventory (available = stock - reserved)
 * 5. LLM polishes the reply (only formats, never invents products)
 *
 * LLM NEVER decides which products to recommend.
 * LLM ONLY formats the database-matched results into natural language.
 */

import { eq, sql, and } from "drizzle-orm";
import { products } from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import type { AiProcessingContext } from "./aiLogContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductRecommendation {
  productId: number;
  name: string;
  keyword: string;
  sellingPrice: string | null;
  shortDescZh: string | null;
  aiTags: string[];
  aiSellingPoints: string | null;
  lightDesc: string | null;
  waterDesc: string | null;
  fertilizerDesc: string | null;
  stockAvailable: number;
  isPreOrder: boolean;
}

export interface ProductRecommendationResult {
  matched: boolean;
  recommendations: ProductRecommendation[];
  matchedTags: string[];
  reply: string | null;
  source: "product_ai";
  llmUsed: boolean;
  llmModel?: string;
  llmProcessingTimeMs?: number;
}

// ---------------------------------------------------------------------------
// AI Tag keyword mapping — maps natural language to AI Tags
// ---------------------------------------------------------------------------

const TAG_KEYWORD_MAP: Record<string, string[]> = {
  // 场景
  "办公室": ["办公室", "办公桌", "办公", "冷气房", "写字楼"],
  "客厅": ["客厅", "放客厅"],
  "卧室": ["卧室", "房间", "放房间"],
  "阳台": ["阳台", "放阳台"],
  "桌面": ["桌面", "桌", "小桌"],
  // 用途
  "送礼": ["送礼", "送人", "礼物", "送朋友", "送长辈"],
  "开幕": ["开幕", "开业", "新店"],
  "乔迁": ["乔迁", "搬家", "新家", "入伙"],
  "生日": ["生日", "生日礼物"],
  // 难度
  "新手": ["新手", "第一次养", "没养过", "不会养", "初学者", "入门"],
  "容易照顾": ["容易照顾", "容易养", "好养", "简单", "不用管", "懒人"],
  "低维护": ["低维护", "不用管", "少打理"],
  // 环境
  "耐阴": ["耐阴", "没什么阳光", "没阳光", "阴", "暗", "光线不足", "北面", "北边"],
  "耐旱": ["耐旱", "很少浇水", "不浇水", "少浇水", "忘记浇水", "不用常浇"],
  "空气净化": ["空气净化", "净化空气", "吸甲醛", "甲醛", "空气好"],
  // 安全
  "宠物安全": ["宠物安全", "有猫", "有狗", "猫", "狗", "宠物", "对猫安全", "对狗安全"],
  "儿童安全": ["儿童安全", "有小孩", "小孩", "孩子", "对儿童安全"],
  // 风水
  "招财": ["招财", "风水", "财运", "发财"],
  // 类型
  "观叶": ["观叶", "叶子", "叶"],
  "开花": ["开花", "花", "花朵"],
  "大型植物": ["大型", "大盆", "高大", "落地"],
  "中型植物": ["中型", "中等"],
  "小型植物": ["小型", "小盆", "迷你", "小植物", "小小的"],
};

// English keyword mappings
const TAG_KEYWORD_MAP_EN: Record<string, string[]> = {
  "办公室": ["office", "desk", "workplace", "aircon room"],
  "客厅": ["living room", "lounge"],
  "卧室": ["bedroom", "room"],
  "阳台": ["balcony"],
  "桌面": ["desktop", "table", "small table"],
  "送礼": ["gift", "present", "give", "gift idea"],
  "新手": ["beginner", "first time", "new to", "no experience", "starter"],
  "容易照顾": ["easy care", "easy to care", "low effort", "simple"],
  "低维护": ["low maintenance", "minimal care"],
  "耐阴": ["low light", "shade", "no sunlight", "dark", "dim"],
  "耐旱": ["drought", "rarely water", "forget to water", "low water"],
  "空气净化": ["air purifying", "air purifier", "clean air", "formaldehyde"],
  "宠物安全": ["pet safe", "cat", "dog", "pet friendly", "pet"],
  "儿童安全": ["kid safe", "child safe", "children"],
  "招财": ["feng shui", "luck", "fortune", "wealth"],
  "观叶": ["foliage", "leaf", "leaves"],
  "开花": ["flowering", "flower", "bloom", "blossom"],
  "大型植物": ["large plant", "big plant", "floor plant", "tall"],
  "中型植物": ["medium plant", "medium size"],
  "小型植物": ["small plant", "mini", "tiny", "compact", "little plant"],
};

// Water attribute mapping
const WATER_MAP: Record<string, string[]> = {
  "耐旱": ["很少浇水", "不浇水", "少浇水", "忘记浇水", "不用常浇", "耐旱", "rarely water", "drought", "low water"],
};

// Light attribute mapping
const LIGHT_MAP: Record<string, string[]> = {
  "耐阴": ["没什么阳光", "没阳光", "阴", "暗", "光线不足", "low light", "shade", "no sunlight", "dark", "dim"],
};

// ---------------------------------------------------------------------------
// Parse customer message → extract AI tags
// ---------------------------------------------------------------------------

export function parseAiTags(message: string): string[] {
  const textLower = message.toLowerCase();
  const matchedTags = new Set<string>();

  // Check Chinese keyword map
  for (const [tag, keywords] of Object.entries(TAG_KEYWORD_MAP)) {
    for (const kw of keywords) {
      if (textLower.includes(kw.toLowerCase())) {
        matchedTags.add(tag);
        break;
      }
    }
  }

  // Check English keyword map
  for (const [tag, keywords] of Object.entries(TAG_KEYWORD_MAP_EN)) {
    for (const kw of keywords) {
      if (textLower.includes(kw.toLowerCase())) {
        matchedTags.add(tag);
        break;
      }
    }
  }

  // Check water attribute
  for (const [attr, keywords] of Object.entries(WATER_MAP)) {
    for (const kw of keywords) {
      if (textLower.includes(kw.toLowerCase())) {
        matchedTags.add(attr);
        break;
      }
    }
  }

  // Check light attribute
  for (const [attr, keywords] of Object.entries(LIGHT_MAP)) {
    for (const kw of keywords) {
      if (textLower.includes(kw.toLowerCase())) {
        matchedTags.add(attr);
        break;
      }
    }
  }

  return Array.from(matchedTags);
}

// ---------------------------------------------------------------------------
// Search products by AI Tags
// ---------------------------------------------------------------------------

export async function searchProductsByAiTags(
  tags: string[],
  logContext?: AiProcessingContext
): Promise<ProductRecommendation[]> {
  if (tags.length === 0) return [];

  const database = await getDb();
  if (!database) return [];

  const t0 = Date.now();

  // Get all active physical products with AI tags
  const allProducts = await database
    .select({
      id: products.id,
      name: products.name,
      keyword: products.keyword,
      sellingPrice: products.sellingPrice,
      shortDescZh: products.shortDescZh,
      aiTags: products.aiTags,
      aiSellingPoints: products.aiSellingPoints,
      lightDesc: products.lightDesc,
      waterDesc: products.waterDesc,
      fertilizerDesc: products.fertilizerDesc,
      stockQuantity: products.stockQuantity,
      reservedQuantity: products.reservedQuantity,
      isPreOrder: products.isPreOrder,
      status: products.status,
    })
    .from(products)
    .where(eq(products.status, "active"));

  if (logContext) {
    logContext.addStep(
      "product_ai_search",
      "AI Tags 商品搜索",
      `数据库返回 ${allProducts.length} 个活跃商品，匹配 Tags: ${tags.join(", ")}`,
      allProducts.length > 0 ? "searching" : "no_products",
      { durationMs: Date.now() - t0 }
    );
  }

  // Score each product by how many tags match
  const scored: Array<{ product: typeof allProducts[0]; score: number; matchedTags: string[] }> = [];

  for (const product of allProducts) {
    let productTags: string[] = [];
    try {
      productTags = product.aiTags ? JSON.parse(product.aiTags) : [];
    } catch {
      productTags = [];
    }

    if (productTags.length === 0) continue;

    // Find matching tags
    const matched = tags.filter(t => productTags.includes(t));

    // Also check light/water attributes
    const lightMatch = product.lightDesc && tags.some(t => {
      const lightKeywords = LIGHT_MAP[t] || [];
      return lightKeywords.some(kw => product.lightDesc!.toLowerCase().includes(kw.toLowerCase()));
    });

    const waterMatch = product.waterDesc && tags.some(t => {
      const waterKeywords = WATER_MAP[t] || [];
      return waterKeywords.some(kw => product.waterDesc!.toLowerCase().includes(kw.toLowerCase()));
    });

    const totalScore = matched.length + (lightMatch ? 0.5 : 0) + (waterMatch ? 0.5 : 0);

    if (totalScore > 0) {
      scored.push({ product, score: totalScore, matchedTags: matched });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top 5
  const topResults = scored.slice(0, 5);

  if (logContext) {
    logContext.addStep(
      "product_ai_match",
      "AI Tags 匹配",
      `匹配到 ${topResults.length} 个商品: ${topResults.map(s => s.product.name).join(", ") || "无"}`,
      topResults.length > 0 ? "hit" : "missed",
      { durationMs: Date.now() - t0 }
    );
  }

  return topResults.map(s => ({
    productId: s.product.id,
    name: s.product.name,
    keyword: s.product.keyword,
    sellingPrice: s.product.sellingPrice,
    shortDescZh: s.product.shortDescZh,
    aiTags: (() => { try { return JSON.parse(s.product.aiTags || "[]"); } catch { return []; } })(),
    aiSellingPoints: s.product.aiSellingPoints,
    lightDesc: s.product.lightDesc,
    waterDesc: s.product.waterDesc,
    fertilizerDesc: s.product.fertilizerDesc,
    stockAvailable: (s.product.stockQuantity || 0) - (s.product.reservedQuantity || 0),
    isPreOrder: s.product.isPreOrder || false,
  }));
}

// ---------------------------------------------------------------------------
// LLM Polish — format matched products into natural reply
// ---------------------------------------------------------------------------

async function polishProductReply(
  customerMessage: string,
  recommendations: ProductRecommendation[],
  matchedTags: string[],
  personaName?: string,
  personaTone?: string,
  personaPrinciples?: string,
): Promise<{ reply: string; model: string; processingTimeMs: number }> {
  const t0 = Date.now();

  // Build product info for LLM
  const productInfo = recommendations.map(r => {
    const parts: string[] = [`${r.name} (RM${r.sellingPrice || "N/A"})`];
    if (r.aiSellingPoints) parts.push(`卖点: ${r.aiSellingPoints}`);
    if (r.lightDesc) parts.push(`光线: ${r.lightDesc}`);
    if (r.waterDesc) parts.push(`水分: ${r.waterDesc}`);
    if (r.stockAvailable > 0) parts.push(`库存: 有货 (${r.stockAvailable}盆)`);
    else if (r.isPreOrder) parts.push(`库存: 预售`);
    else parts.push(`库存: 缺货`);
    return parts.join(" | ");
  }).join("\n");

  const systemPrompt = [
    personaName ? `你是${personaName}。` : "你是一个友善的植物客服助手。",
    personaTone ? `语气：${personaTone}` : "",
    personaPrinciples || "",
    "你正在为客户推荐植物商品。",
    "重要规则：只能推荐以下数据库匹配到的商品，不允许推荐列表以外的商品。",
    "请用自然、友善的语言整理回复，引用每个商品的卖点。",
    "如果商品有库存，告知客户可以下单。如果缺货，告知暂时缺货。",
  ].filter(Boolean).join("\n");

  const userMessage = `客户问题: ${customerMessage}\n\n匹配到的AI标签: ${matchedTags.join(", ")}\n\n数据库匹配到的商品:\n${productInfo}\n\n请整理成自然回复，推荐这些商品给客户。`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const rawContent = response?.choices?.[0]?.message?.content;
    const reply = typeof rawContent === "string" ? rawContent : "抱歉，我暂时无法生成推荐回复。";
    const processingTimeMs = Date.now() - t0;

    return { reply, model: "default", processingTimeMs };
  } catch (err: any) {
    // Fallback: generate a simple template reply without LLM
    const fallbackReply = `根据您的需求，我为您推荐以下商品：\n\n${
      recommendations.map(r => `🌿 ${r.name} (RM${r.sellingPrice || "N/A"})\n${r.aiSellingPoints || r.shortDescZh || ""}\n${r.stockAvailable > 0 ? "✅ 有货" : "❌ 暂时缺货"}\n`).join("\n")
    }\n如需下单或了解更多详情，请随时告诉我们！`;

    return { reply: fallbackReply, model: "fallback", processingTimeMs: Date.now() - t0 };
  }
}

// ---------------------------------------------------------------------------
// Main: Run Product AI Recommendation
// ---------------------------------------------------------------------------

export async function runProductAiRecommendation(
  customerMessage: string,
  options: {
    enableLLM?: boolean;
    personaSnapshot?: { aiName?: string; replyTone?: string; replyPrinciples?: string } | null;
    logContext?: AiProcessingContext;
  } = {}
): Promise<ProductRecommendationResult> {
  const { enableLLM = true, personaSnapshot = null, logContext } = options;

  // Step 1: Parse customer message → extract AI tags
  const t0 = Date.now();
  const matchedTags = parseAiTags(customerMessage);

  if (logContext) {
    logContext.addStep(
      "product_ai_parse",
      "AI Tags 解析",
      `从客户消息解析到 Tags: ${matchedTags.length > 0 ? matchedTags.join(", ") : "无匹配"}`,
      matchedTags.length > 0 ? "parsed" : "no_tags",
      { durationMs: Date.now() - t0 }
    );
  }

  if (matchedTags.length === 0) {
    return {
      matched: false,
      recommendations: [],
      matchedTags: [],
      reply: null,
      source: "product_ai",
      llmUsed: false,
    };
  }

  // Step 2: Search products by AI Tags + attributes
  const recommendations = await searchProductsByAiTags(matchedTags, logContext);

  if (recommendations.length === 0) {
    if (logContext) {
      logContext.addStep(
        "product_ai_no_match",
        "AI Tags 商品匹配",
        `Tags: ${matchedTags.join(", ")}，但没有匹配到商品`,
        "missed"
      );
    }
    return {
      matched: false,
      recommendations: [],
      matchedTags,
      reply: null,
      source: "product_ai",
      llmUsed: false,
    };
  }

  // Step 3: LLM polish (if enabled)
  let llmUsed = false;
  let llmModel: string | undefined;
  let llmProcessingTimeMs: number | undefined;
  let reply: string | null = null;

  if (enableLLM) {
    const llmResult = await polishProductReply(
      customerMessage,
      recommendations,
      matchedTags,
      personaSnapshot?.aiName,
      personaSnapshot?.replyTone,
      personaSnapshot?.replyPrinciples,
    );
    llmUsed = true;
    llmModel = llmResult.model;
    llmProcessingTimeMs = llmResult.processingTimeMs;
    reply = llmResult.reply;

    if (logContext) {
      logContext.addStep(
        "product_ai_llm",
        "LLM 商品推荐润色",
        `模型: ${llmModel}, 耗时: ${llmProcessingTimeMs}ms`,
        "hit",
        { durationMs: llmProcessingTimeMs }
      );
    }
  } else {
    // Fallback: template reply without LLM
    reply = `根据您的需求，我为您推荐以下商品：\n\n${
      recommendations.map(r => `🌿 ${r.name} (RM${r.sellingPrice || "N/A"})\n${r.aiSellingPoints || r.shortDescZh || ""}\n${r.stockAvailable > 0 ? "✅ 有货" : "❌ 暂时缺货"}\n`).join("\n")
    }\n如需下单或了解更多详情，请随时告诉我们！`;

    if (logContext) {
      logContext.addStep(
        "product_ai_template",
        "模板回复",
        "LLM 未启用，使用模板回复",
        "skipped"
      );
    }
  }

  return {
    matched: true,
    recommendations,
    matchedTags,
    reply,
    source: "product_ai",
    llmUsed,
    llmModel,
    llmProcessingTimeMs,
  };
}
