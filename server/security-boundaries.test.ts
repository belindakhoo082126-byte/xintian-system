import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("后台安全边界", () => {
  const trpcSource = readFileSync(join(process.cwd(), "server/_core/trpc.ts"), "utf8");
  const cookieSource = readFileSync(join(process.cwd(), "server/_core/cookies.ts"), "utf8");
  const routerSource = readFileSync(join(process.cwd(), "server/routers.ts"), "utf8");

  it("拒绝未登录用户访问受保护的过程", () => {
    expect(trpcSource).toContain('new TRPCError({ code: "UNAUTHORIZED"');
    expect(trpcSource).toContain("export const protectedProcedure = t.procedure.use(requireUser)");
  });

  it("拒绝非管理员访问管理员过程", () => {
    expect(trpcSource).toContain("ctx.user.role !== 'admin'");
    expect(trpcSource).toContain('new TRPCError({ code: "FORBIDDEN"');
    expect(routerSource).toContain("split: adminProcedure");
  });

  it("会话Cookie保持HttpOnly、SameSite及HTTPS安全属性", () => {
    expect(cookieSource).toContain("httpOnly: true");
    expect(cookieSource).toContain('sameSite: "none"');
    expect(cookieSource).toContain("secure: isSecureRequest(req)");
  });
});
