import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"),
  "utf8",
);

describe("DashboardLayout page title shell", () => {
  it("does not render a second shared page title or use DOM title hiding", () => {
    expect(layoutSource).not.toContain("topBarTitle");
    expect(layoutSource).not.toContain("data-menu-title-duplicate");
    expect(layoutSource).not.toContain("querySelectorAll<HTMLElement>(\"h1\")");
  });

  it("keeps language and mobile menu controls outside a bordered title bar", () => {
    expect(layoutSource).toContain('className="fixed right-3 top-3 z-40 flex items-center gap-2 no-print sm:right-4"');
    expect(layoutSource).toContain('<SidebarInset className="relative w-full min-w-0 max-w-full overflow-x-hidden">');
    expect(layoutSource).not.toContain('sticky top-0 z-40 flex h-16');
    expect(layoutSource).not.toContain('border-b bg-background/95');
  });

  it("reserves touch-safe control room on mobile without restoring a desktop header row", () => {
    expect(layoutSource).toContain('p-3 pt-16 pr-24 sm:p-4 sm:pt-4 sm:pr-24');
    expect(layoutSource).toContain('<SidebarTrigger className="h-11 w-11 shrink-0 rounded-lg border border-border/80 bg-background shadow-sm" />');
  });
});
