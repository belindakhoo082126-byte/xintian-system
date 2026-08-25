import { describe, expect, it } from "vitest";
import {
  IMPORT_ORDER_PREFIX,
  LEGACY_IMPORT_ORDER_PREFIX,
  LOCAL_ORDER_PREFIX,
  isImportOrderNumber,
} from "../shared/orderNumberPrefixes";

describe("import order number prefixes", () => {
  it("uses XTD for newly created import orders", () => {
    expect(IMPORT_ORDER_PREFIX).toBe("XTD");
    expect(LOCAL_ORDER_PREFIX).toBe("XT");
  });

  it("continues recognizing historical XTC and current XTD import order numbers", () => {
    expect(LEGACY_IMPORT_ORDER_PREFIX).toBe("XTC");
    expect(isImportOrderNumber("XTC00008")).toBe(true);
    expect(isImportOrderNumber("xtd00009")).toBe(true);
    expect(isImportOrderNumber("XT00009")).toBe(false);
    expect(isImportOrderNumber("ORD-00009")).toBe(false);
  });
});
