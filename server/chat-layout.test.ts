import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const chatSource = readFileSync(resolve(process.cwd(), "client/src/pages/Chat.tsx"), "utf8");

describe("Chat 客服可视区域布局", () => {
  it("inherits the actual available admin content height instead of creating a second viewport height", () => {
    expect(chatSource).toContain('flex h-full min-h-0 max-h-full overflow-hidden');
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

  it("inherits a bounded admin content height so all three chat columns scroll inside the viewport", () => {
    const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

    expect(layoutSource).toContain('relative flex h-svh min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden');
    expect(layoutSource).toContain('data-admin-menu-content className="min-h-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4"');
    expect(layoutSource).toContain('{isMobile && (');
  });
});
