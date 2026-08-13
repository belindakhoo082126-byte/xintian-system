import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import http from "node:http";
import { encodeOAuthState, COOKIE_NAME, OAUTH_STATE_COOKIE } from "../shared/const";
import * as db from "./db";
import { registerOAuthRoutes } from "./_core/oauth";
import { sdk } from "./_core/sdk";

type CallbackResponse = {
  status: number;
  location?: string;
  setCookie: string[];
  body: string;
};

async function requestCallback(state: string, nonce: string): Promise<CallbackResponse> {
  const app = express();
  registerOAuthRoutes(app);
  const server = await new Promise<http.Server>(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");

  try {
    return await new Promise<CallbackResponse>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: address.port,
          path: `/api/oauth/callback?code=test-code&state=${encodeURIComponent(state)}`,
          headers: {
            host: "www.xintian.com.my",
            cookie: `${OAUTH_STATE_COOKIE}=${nonce}`,
          },
        },
        res => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", chunk => {
            body += chunk;
          });
          res.on("end", () => {
            const rawSetCookie = res.headers["set-cookie"];
            resolve({
              status: res.statusCode ?? 0,
              location: res.headers.location,
              setCookie: Array.isArray(rawSetCookie) ? rawSetCookie : rawSetCookie ? [rawSetCookie] : [],
              body,
            });
          });
        }
      );
      req.on("error", reject);
      req.end();
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
}

describe("OAuth callback", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects a callback whose one-time browser nonce does not match", async () => {
    const state = encodeOAuthState({
      redirectUri: "https://www.xintian.com.my/api/oauth/callback",
      nonce: "expected-nonce",
    });
    const exchangeCode = vi.spyOn(sdk, "exchangeCodeForToken");

    const response = await requestCallback(state, "different-nonce");

    expect(response.status).toBe(403);
    expect(response.body).toContain("invalid oauth state");
    expect(exchangeCode).not.toHaveBeenCalled();
  });

  it("sets a secure cross-site session cookie and returns to the app on the public custom domain", async () => {
    vi.spyOn(sdk, "exchangeCodeForToken").mockResolvedValue({ accessToken: "test-token" } as never);
    vi.spyOn(sdk, "getUserInfo").mockResolvedValue({
      openId: "oauth-test-user",
      name: "OAuth Test User",
      email: "oauth-test@example.com",
      loginMethod: "google",
    } as never);
    vi.spyOn(sdk, "createSessionToken").mockResolvedValue("test-session-token");
    const upsertUser = vi.spyOn(db, "upsertUser").mockResolvedValue(undefined as never);
    const state = encodeOAuthState({
      redirectUri: "https://www.xintian.com.my/api/oauth/callback",
      nonce: "matching-nonce",
    });

    const response = await requestCallback(state, "matching-nonce");

    expect(response.status).toBe(302);
    expect(response.location).toBe("/");
    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ openId: "oauth-test-user", email: "oauth-test@example.com" })
    );
    expect(response.setCookie.join("\n")).toContain(`${OAUTH_STATE_COOKIE}=;`);
    expect(response.setCookie.join("\n")).toContain(`${COOKIE_NAME}=test-session-token;`);
    expect(response.setCookie.join("\n")).toContain("Path=/");
    expect(response.setCookie.join("\n")).toContain("HttpOnly");
    expect(response.setCookie.join("\n")).toContain("Secure");
    expect(response.setCookie.join("\n")).toContain("SameSite=None");
  });
});
