import crypto from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyXHubSignature } from "./facebook";

const APP_SECRET = "sat-facebook-webhook-secret";
const payload = Buffer.from('{"object":"page","entry":[]}');

function sign(body: Buffer | string): string {
  return `sha256=${crypto.createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
}

describe("Facebook webhook signature verification", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a correctly signed raw webhook payload", () => {
    vi.stubEnv("FB_APP_SECRET", APP_SECRET);

    expect(verifyXHubSignature(payload, sign(payload))).toBe(true);
  });

  it("rejects a missing, malformed, or tampered signature", () => {
    vi.stubEnv("FB_APP_SECRET", APP_SECRET);

    expect(verifyXHubSignature(payload, undefined)).toBe(false);
    expect(verifyXHubSignature(payload, "sha256=invalid")).toBe(false);
    expect(verifyXHubSignature(Buffer.from('{"object":"instagram"}'), sign(payload))).toBe(false);
  });

  it("fails closed when the application secret is unavailable", () => {
    vi.stubEnv("FB_APP_SECRET", "");

    expect(verifyXHubSignature(payload, sign(payload))).toBe(false);
  });
});
