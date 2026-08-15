import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const chatSource = readFileSync(resolve(process.cwd(), "client/src/pages/Chat.tsx"), "utf8");

describe("Chat 客服可视区域布局", () => {
  it("uses the actual visual viewport instead of an oversized page height", () => {
    expect(chatSource).toContain('h-[calc(100dvh-2rem)] min-h-0 overflow-hidden');
    expect(chatSource).not.toContain('h-[calc(100vh-3.5rem)]');
  });

  it("keeps all three columns height-bounded so only their content areas scroll", () => {
    expect(chatSource).toContain('w-full min-h-0 shrink-0 border-r flex-col md:flex md:w-80');
    expect(chatSource).toContain('min-h-0 min-w-0 flex-1 flex-col md:flex');
    expect(chatSource).toContain('hidden w-72 min-h-0 shrink-0 border-l overflow-y-auto lg:block');
    expect(chatSource).toContain('<ScrollArea className="min-h-0 flex-1"');
  });

  it("shows one usable Chat column at a time on mobile instead of squeezing all three columns", () => {
    expect(chatSource).toContain('selectedConvId ? "hidden" : "flex"} w-full min-h-0 shrink-0 border-r flex-col md:flex md:w-80');
    expect(chatSource).toContain('selectedConvId ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col md:flex');
    expect(chatSource).toContain('hidden w-72 min-h-0 shrink-0 border-l overflow-y-auto lg:block');
    expect(chatSource).toContain('aria-label="返回对话列表"');
  });

  it("keeps the conversation header and message input as non-shrinking siblings of the scroll area", () => {
    expect(chatSource).toContain('className="shrink-0 p-3 border-b flex items-center gap-2"');
    expect(chatSource).toContain('className="shrink-0 p-3 border-t flex gap-2"');
  });
});
