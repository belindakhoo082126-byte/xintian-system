import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("tRPC client transport", () => {
  it("uses independent HTTP requests so one slow dashboard query cannot fail an entire batch", () => {
    const source = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

    expect(source).toContain('import { httpLink, TRPCClientError } from "@trpc/client";');
    expect(source).toContain("httpLink({");
    expect(source).not.toContain("httpBatchLink({");
  });
});
