import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getAiLogs: vi.fn(),
  getAiLogDetail: vi.fn(),
  getAiLogStats: vi.fn(),
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

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: "admin" | "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: role === "admin" ? 1 : 2,
    openId: `ai-log-test-${role}`,
    email: `ai-log-${role}@example.com`,
    name: `AI Log Test ${role}`,
    loginMethod: "manus",
    role,
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

describe("aiLog.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated AI main logs and forwards all requested filters", async () => {
    const response = {
      items: [{
        id: 55,
        customerName: "花友小明",
        customerMessage: "请问运费",
        finalSource: "reply_rule",
        sendStatus: "sent",
      }],
      total: 1,
      page: 2,
      pageSize: 20,
    };
    vi.mocked(dbMock.getAiLogs).mockResolvedValue(response as any);

    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.aiLog.list({
      page: 2,
      pageSize: 20,
      customerName: "小明",
      platform: "messenger",
      sourceType: "facebook_live",
      finalSource: "reply_rule",
      sendStatus: "sent",
      isHandover: false,
      keyword: "运费",
    })).resolves.toEqual(response);

    expect(dbMock.getAiLogs).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      customerName: "小明",
      platform: "messenger",
      sourceType: "facebook_live",
      finalSource: "reply_rule",
      sendStatus: "sent",
      isHandover: false,
      keyword: "运费",
    });
  });

  it("rejects non-admin callers before any log data can be queried", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.aiLog.list({ page: 1, pageSize: 20 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(dbMock.getAiLogs).not.toHaveBeenCalled();
  });
});
