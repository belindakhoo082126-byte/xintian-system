import { describe, expect, it } from "vitest";

const appId = process.env.FB_APP_ID;
const appSecret = process.env.FB_APP_SECRET;

describe("Facebook App Secret rotation smoke check", () => {
  it("authenticates the configured app without exposing its secret", async () => {
    expect(appId, "FB_APP_ID must be configured").toBeTruthy();
    expect(appSecret, "FB_APP_SECRET must be configured").toBeTruthy();

    const appAccessToken = `${appId}|${appSecret}`;
    const response = await fetch(
      `https://graph.facebook.com/app?fields=id&access_token=${encodeURIComponent(appAccessToken)}`,
    );
    const body = await response.json() as { id?: string; error?: { message?: string } };

    expect(response.ok, `Meta App Secret validation failed: ${body.error?.message ?? response.status}`).toBe(true);
    expect(body.id).toBe(appId);
  }, 15_000);
});
