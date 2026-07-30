import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getAiPersona: vi.fn(),
}));

vi.mock("./messenger", () => ({
  sendTextMessage: vi.fn(),
  sendButtonMessage: vi.fn(),
  sendMediaMessage: vi.fn(),
  sendTemplateMessage: vi.fn(),
  sendMembershipFlow: vi.fn(),
  sendTelegramJoinFlow: vi.fn(),
  getUserProfile: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { appRouter } from "./routers";
import * as dbMock from "./db";
import * as llmMock from "./_core/llm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "ai-brain-test-admin",
    email: "ai-brain-test@example.com",
    name: "AI Brain Test Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as any,
    res: {} as any,
  };
}

const savedPersona = {
  id: 1,
  aiName: "小田",
  brandName: "心田 Xintian",
  aiSelfReference: "小田",
  customerAddress: "亲爱的",
  replyTone: "warm",
  defaultLanguage: "zh",
  supportedLanguages: '["zh","en","ms"]',
  emojiLevel: "low",
  replyLength: "medium",
  proactiveRecommend: true,
  proactiveInquire: true,
  enableCTA: true,
  ctaTemplate: "还有什么小田可以帮到你的吗？",
  customPrompt: null,
  replyPrinciples: null,
};

describe("aiBrain.previewReply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMock.getAiPersona).mockResolvedValue(savedPersona as any);
  });

  it("uses unsaved persona fields and reply principles in the simulation prompt", async () => {
    vi.mocked(llmMock.invokeLLM).mockResolvedValue({
      choices: [{ message: { content: "花友，今天很适合看看现货植物。" } }],
    } as any);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.aiBrain.previewReply({
      userMessage: "今天有什么花推荐？",
      personaOverride: {
        customerAddress: "花友",
        replyPrinciples: "一律称呼客户为「花友」\n优先推荐现货",
      },
    })).resolves.toEqual({ reply: "花友，今天很适合看看现货植物。" });

    const request = vi.mocked(llmMock.invokeLLM).mock.calls[0][0] as any;
    expect(request.model).toBe("claude-haiku-4-5");
    expect(request.messages[0].content).toContain("称呼客户：花友");
    expect(request.messages[0].content).toContain("不可违反的 AI回复原则（最高优先级");
    expect(request.messages[0].content).toContain("一律称呼客户为「花友」");
    expect(request.messages[0].content).toContain("优先推荐现货");
  });

  it("normalizes text blocks returned by the preview model", async () => {
    vi.mocked(llmMock.invokeLLM).mockResolvedValue({
      choices: [{
        message: {
          content: [
            { type: "text", text: "花友，" },
            { type: "tool_use", id: "preview-ignore" },
            { type: "text", text: "欢迎浏览心田现货。" },
          ],
        },
      }],
    } as any);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.aiBrain.previewReply({
      userMessage: "有什么推荐？",
    })).resolves.toEqual({ reply: "花友，\n欢迎浏览心田现货。" });
  });

  it("returns a readable simulation error when the model returns no visible text", async () => {
    vi.mocked(llmMock.invokeLLM).mockResolvedValue({
      choices: [{ message: { content: [] } }],
    } as any);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.aiBrain.previewReply({
      userMessage: "测试问题",
    })).resolves.toEqual({
      reply: "预览生成失败：预览模型未生成可用文本，请稍后重试。",
    });
  });
});
