import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Dashboard data fallback", () => {
  it("renders an explicit reload state rather than an empty page when stats are unavailable", () => {
    const source = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");

    expect(source).toContain("isLoading, isError, refetch");
    expect(source).toContain("if (isError || !stats)");
    expect(source).toContain("仪表板资料暂时无法读取");
    expect(source).toContain("重新读取资料");
    expect(source).not.toContain("if (!stats) return null;");
  });
});
