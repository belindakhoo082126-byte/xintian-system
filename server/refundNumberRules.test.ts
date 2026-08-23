import { describe, expect, it } from "vitest";
import { formatRefundNumber } from "./db";

describe("refund number format", () => {
  it("starts at RF-0001 and preserves zero-padding for later refunds", () => {
    expect(formatRefundNumber(1)).toBe("RF-0001");
    expect(formatRefundNumber(12)).toBe("RF-0012");
    expect(formatRefundNumber(10000)).toBe("RF-10000");
  });
});
