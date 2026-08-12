import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";

function requestFor(options: {
  hostname: string;
  protocol?: "http" | "https";
  forwardedProto?: string;
}) {
  return {
    hostname: options.hostname,
    protocol: options.protocol ?? "http",
    headers: options.forwardedProto ? { "x-forwarded-proto": options.forwardedProto } : {},
  } as Request;
}

describe("认证会话 Cookie", () => {
  it("在HTTPS反向代理后的公开预览与自定义域名始终写入Secure Cookie", () => {
    const options = getSessionCookieOptions(requestFor({
      hostname: "www.xintian.com.my",
      protocol: "http",
    }));

    expect(options).toMatchObject({
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it("识别反向代理提供的HTTPS协议标志", () => {
    const options = getSessionCookieOptions(requestFor({
      hostname: "127.0.0.1",
      forwardedProto: "https",
    }));

    expect(options.secure).toBe(true);
  });

  it("保留本机HTTP开发环境的非Secure Cookie行为", () => {
    const options = getSessionCookieOptions(requestFor({ hostname: "localhost" }));

    expect(options.secure).toBe(false);
  });
});
