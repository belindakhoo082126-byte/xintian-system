import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeOAuthState, OAUTH_STATE_COOKIE } from "@shared/const";
import { startLogin } from "./const";

describe("startLogin", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true });
    Object.defineProperty(globalThis, "document", { value: originalDocument, configurable: true });
  });

  it("writes the CSRF nonce cookie and redirects to the OAuth portal with the current origin callback", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://oauth.example.test");
    vi.stubEnv("VITE_APP_ID", "xintian-test-app");

    let writtenCookie = "";
    const location = { origin: "https://www.xintian.com.my", href: "" };
    Object.defineProperty(globalThis, "window", { value: { location }, configurable: true });
    Object.defineProperty(globalThis, "document", {
      value: {
        set cookie(value: string) {
          writtenCookie = value;
        },
      },
      configurable: true,
    });
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("nonce-for-login-test");

    startLogin();

    expect(writtenCookie).toBe(
      `${OAUTH_STATE_COOKIE}=nonce-for-login-test; Path=/; Max-Age=600; SameSite=Lax; Secure`
    );

    const destination = new URL(location.href);
    expect(destination.origin).toBe("https://oauth.example.test");
    expect(destination.pathname).toBe("/app-auth");
    expect(destination.searchParams.get("appId")).toBe("xintian-test-app");
    expect(destination.searchParams.get("redirectUri")).toBe(
      "https://www.xintian.com.my/api/oauth/callback"
    );
    expect(destination.searchParams.get("type")).toBe("signIn");
    expect(decodeOAuthState(destination.searchParams.get("state") ?? "")).toEqual({
      redirectUri: "https://www.xintian.com.my/api/oauth/callback",
      nonce: "nonce-for-login-test",
    });
  });
});
