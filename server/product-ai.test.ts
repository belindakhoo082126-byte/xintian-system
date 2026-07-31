import { describe, it, expect } from "vitest";
import { parseAiTags } from "./productAi";

describe("Product AI Intelligence", () => {
  describe("parseAiTags", () => {
    it("should parse office-related tags from Chinese message", () => {
      const tags = parseAiTags("推荐适合办公室的小植物");
      expect(tags).toContain("办公室");
      expect(tags).toContain("小型植物");
    });

    it("should parse gift tag from Chinese message", () => {
      const tags = parseAiTags("有没有适合送礼的植物？");
      expect(tags).toContain("送礼");
    });

    it("should parse beginner tag from Chinese message", () => {
      const tags = parseAiTags("我第一次养植物");
      expect(tags).toContain("新手");
    });

    it("should parse low-light tag from Chinese message", () => {
      const tags = parseAiTags("家里没什么阳光");
      expect(tags).toContain("耐阴");
    });

    it("should parse pet-safe tag from Chinese message", () => {
      const tags = parseAiTags("我家有猫");
      expect(tags).toContain("宠物安全");
    });

    it("should parse drought-tolerant tag from Chinese message", () => {
      const tags = parseAiTags("我很少浇水");
      expect(tags).toContain("耐旱");
    });

    it("should parse office tag from English message", () => {
      const tags = parseAiTags("I need a small plant for my office desk");
      expect(tags).toContain("办公室");
      expect(tags).toContain("小型植物");
    });

    it("should parse beginner tag from English message", () => {
      const tags = parseAiTags("This is my first time growing plants");
      expect(tags).toContain("新手");
    });

    it("should parse low-light tag from English message", () => {
      const tags = parseAiTags("My room has low light, no sunlight");
      expect(tags).toContain("耐阴");
    });

    it("should parse pet-safe tag from English message", () => {
      const tags = parseAiTags("I have a cat, need pet friendly plants");
      expect(tags).toContain("宠物安全");
    });

    it("should parse multiple tags from combined message", () => {
      const tags = parseAiTags("推荐适合办公室的小植物，新手容易照顾的");
      expect(tags).toContain("办公室");
      expect(tags).toContain("小型植物");
      expect(tags).toContain("新手");
      expect(tags).toContain("容易照顾");
    });

    it("should return empty array for unrelated message", () => {
      const tags = parseAiTags("请问你们的营业时间是什么？");
      expect(tags).toEqual([]);
    });

    it("should parse gift and beginner tags together", () => {
      const tags = parseAiTags("想送朋友一盆植物，他是新手");
      expect(tags).toContain("送礼");
      expect(tags).toContain("新手");
    });

    it("should parse living room tag", () => {
      const tags = parseAiTags("放客厅的植物推荐");
      expect(tags).toContain("客厅");
    });

    it("should parse balcony tag", () => {
      const tags = parseAiTags("阳台适合种什么植物");
      expect(tags).toContain("阳台");
    });

    it("should parse air purifying tag", () => {
      const tags = parseAiTags("想要能净化空气的植物");
      expect(tags).toContain("空气净化");
    });

    it("should parse feng shui tag", () => {
      const tags = parseAiTags("想要招财的植物");
      expect(tags).toContain("招财");
    });

    it("should parse large plant tag", () => {
      const tags = parseAiTags("想要大型落地植物");
      expect(tags).toContain("大型植物");
    });

    it("should handle case-insensitive English", () => {
      const tags = parseAiTags("EASY CARE PLANT FOR BEGINNER");
      expect(tags).toContain("新手");
      expect(tags).toContain("容易照顾");
    });
  });

  describe("Product AI pipeline integration", () => {
    it("should be importable and have correct exports", async () => {
      const mod = await import("./productAi");
      expect(mod.parseAiTags).toBeDefined();
      expect(mod.searchProductsByAiTags).toBeDefined();
      expect(mod.runProductAiRecommendation).toBeDefined();
    });

    it("should have TAG_KEYWORD_MAP with sufficient coverage", () => {
      // Verify at least 15 tag categories are defined
      // (indirectly tested via parseAiTags coverage above)
      const tags1 = parseAiTags("办公室 客厅 卧室 阳台 桌面 送礼 开幕 乔迁 生日 新手 容易照顾 低维护 耐阴 耐旱 空气净化 宠物安全 儿童安全 招财 观叶 开花 大型植物 中型植物 小型植物");
      expect(tags1.length).toBeGreaterThanOrEqual(15);
    });
  });
});
