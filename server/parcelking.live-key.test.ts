/**
 * Parcel King Live Key Validation Test
 *
 * Verifies that the Live API key is configured and can authenticate
 * by calling the lightweight /balance endpoint.
 */

import { describe, it, expect } from "vitest";
import { isParcelKingConfigured, isTestMode, getBalance } from "./parcelking";

// Parcel King is intentionally not used in the current shipping configuration.
// Set PARCELKING_LIVE_VALIDATION=true only when validating that external account.
const describeLiveParcelKing = process.env.PARCELKING_LIVE_VALIDATION === "true" ? describe : describe.skip;

describeLiveParcelKing("Parcel King — Live Key Validation", () => {
  it("should be configured with a valid API key", () => {
    expect(isParcelKingConfigured()).toBe(true);
  });

  it("should NOT be in test mode (live key)", () => {
    expect(isTestMode()).toBe(false);
  });

  it("should successfully fetch balance from live API", async () => {
    // This test hits the live ParcelKing API, which may take >5s

    const balance = await getBalance();
    expect(balance.status).toBe("OK");
    expect(balance.result.balance).toBeDefined();
    expect(typeof balance.result.balance).toBe("number");
    expect(balance.result.currency).toBeDefined();
  }, 15000);
});
