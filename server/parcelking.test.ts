/**
 * Parcel King API Client — Unit Tests
 *
 * Tests cover:
 * - isParcelKingConfigured / isTestMode
 * - normalizePhone
 * - ParcelKingError class
 * - API error handling (mocked fetch)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ParcelKingError,
  isTestMode,
  isParcelKingConfigured,
  normalizePhone,
} from "./parcelking";

// Mock ENV to control configuration state
vi.mock("./_core/env", () => ({
  ENV: {
    parcelkingApiKey: "pk_test_4bb99de1b7b069b891d65b9eb13a173d",
    parcelkingEnv: "test",
  },
}));

describe("Parcel King — isParcelKingConfigured", () => {
  it("should return true when API key starts with pk_", () => {
    expect(isParcelKingConfigured()).toBe(true);
  });

  it("should return false when API key is empty", async () => {
    const envModule = await import("./_core/env");
    const original = envModule.ENV.parcelkingApiKey;
    (envModule.ENV as any).parcelkingApiKey = "";
    expect(isParcelKingConfigured()).toBe(false);
    (envModule.ENV as any).parcelkingApiKey = original;
  });

  it("should return false when API key does not start with pk_", async () => {
    const envModule = await import("./_core/env");
    const original = envModule.ENV.parcelkingApiKey;
    (envModule.ENV as any).parcelkingApiKey = "some_random_key";
    expect(isParcelKingConfigured()).toBe(false);
    (envModule.ENV as any).parcelkingApiKey = original;
  });
});

describe("Parcel King — isTestMode", () => {
  it("should return true when env is 'test'", () => {
    expect(isTestMode()).toBe(true);
  });

  it("should return true when key starts with pk_test_", async () => {
    const envModule = await import("./_core/env");
    (envModule.ENV as any).parcelkingEnv = "live";
    expect(isTestMode()).toBe(true); // key still starts with pk_test_
    (envModule.ENV as any).parcelkingEnv = "test";
  });

  it("should return false when env is 'live' and key starts with pk_live_", async () => {
    const envModule = await import("./_core/env");
    const originalKey = envModule.ENV.parcelkingApiKey;
    const originalEnv = envModule.ENV.parcelkingEnv;
    (envModule.ENV as any).parcelkingApiKey = "pk_live_abc123";
    (envModule.ENV as any).parcelkingEnv = "live";
    expect(isTestMode()).toBe(false);
    (envModule.ENV as any).parcelkingApiKey = originalKey;
    (envModule.ENV as any).parcelkingEnv = originalEnv;
  });
});

describe("Parcel King — normalizePhone", () => {
  it("should strip leading 0 from Malaysian number", () => {
    const result = normalizePhone("0123456789");
    expect(result.dial_code).toBe("+60");
    expect(result.mobile).toBe("123456789");
  });

  it("should strip leading 60 from Malaysian number", () => {
    const result = normalizePhone("60123456789");
    expect(result.dial_code).toBe("+60");
    expect(result.mobile).toBe("123456789");
  });

  it("should handle number with +60 prefix", () => {
    const result = normalizePhone("+60123456789");
    expect(result.dial_code).toBe("+60");
    expect(result.mobile).toBe("123456789");
  });

  it("should handle number with spaces and dashes", () => {
    const result = normalizePhone("012-345 6789");
    expect(result.dial_code).toBe("+60");
    expect(result.mobile).toBe("123456789");
  });

  it("should handle empty string", () => {
    const result = normalizePhone("");
    expect(result.dial_code).toBe("+60");
    expect(result.mobile).toBe("");
  });

  it("should handle number without leading 0 or 60", () => {
    const result = normalizePhone("123456789");
    expect(result.dial_code).toBe("+60");
    expect(result.mobile).toBe("123456789");
  });
});

describe("Parcel King — ParcelKingError", () => {
  it("should create error with all properties", () => {
    const error = new ParcelKingError("Test error", 400, false, { foo: "bar" });
    expect(error.message).toBe("Test error");
    expect(error.statusCode).toBe(400);
    expect(error.isRetryable).toBe(false);
    expect(error.rawResponse).toEqual({ foo: "bar" });
    expect(error.name).toBe("ParcelKingError");
    expect(error instanceof Error).toBe(true);
  });

  it("should create retryable error for 500 status", () => {
    const error = new ParcelKingError("Server error", 500, true);
    expect(error.isRetryable).toBe(true);
    expect(error.statusCode).toBe(500);
  });

  it("should create error without rawResponse", () => {
    const error = new ParcelKingError("Simple error", 404, false);
    expect(error.rawResponse).toBeUndefined();
  });
});

describe("Parcel King — API error handling (mocked fetch)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should throw ParcelKingError on 401 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Invalid API key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    // Dynamically import to get the mocked version
    const { getBalance } = await import("./parcelking");
    await expect(getBalance()).rejects.toMatchObject({
      statusCode: 401,
      name: "ParcelKingError",
    });
  });

  it("should throw ParcelKingError on 500 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Internal Server Error", {
        status: 500,
      }),
    );

    const { getBalance } = await import("./parcelking");
    await expect(getBalance()).rejects.toThrow(ParcelKingError);
  });

  it("should throw ParcelKingError on network failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const { getBalance } = await import("./parcelking");
    await expect(getBalance()).rejects.toThrow(ParcelKingError);
  });
});
