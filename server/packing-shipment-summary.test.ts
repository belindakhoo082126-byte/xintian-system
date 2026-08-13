import { describe, expect, it } from "vitest";
import { calculateShipmentSummary } from "./db";

describe("packing shipment summary", () => {
  it("uses the latest parcel tracking details while summing all parcel weights and actual fees", () => {
    const firstShippedAt = new Date("2026-08-01T01:00:00.000Z");
    const secondShippedAt = new Date("2026-08-02T03:00:00.000Z");

    expect(calculateShipmentSummary([
      { courier: "Parcel Daily", trackingNumber: "PD-100", weight: "1.25", shippingCost: "8.4", shippedAt: firstShippedAt },
      { courier: "Pos Laju", trackingNumber: "PL-200", weight: "2.75", shippingCost: "12.6", shippedAt: secondShippedAt },
    ])).toEqual({
      courierCompany: "Pos Laju",
      trackingNumber: "PL-200",
      actualWeight: 4,
      actualShippingFee: 21,
      firstShippedAt,
    });
  });

  it("does not overwrite order logistics fields with invalid blank parcel values", () => {
    expect(calculateShipmentSummary([
      { courier: "", trackingNumber: "", weight: "invalid", shippingCost: undefined, shippedAt: null },
    ])).toEqual({
      courierCompany: undefined,
      trackingNumber: undefined,
      actualWeight: undefined,
      actualShippingFee: undefined,
      firstShippedAt: undefined,
    });
  });
});
