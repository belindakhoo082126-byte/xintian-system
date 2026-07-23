import { describe, expect, it } from "vitest";
import { unwrapMySqlRows } from "./db";

describe("unwrapMySqlRows", () => {
  it("extracts row records from mysql2's [rows, fields] execute result", () => {
    const rows = [
      { id: 120001, orderId: 120001, orderNumber: "XT-HOLD-1", totalAmount: "60.00" },
      { id: 90001, orderId: 90001, orderNumber: "XT-HOLD-2", totalAmount: "45.00" },
    ];

    const result = unwrapMySqlRows<typeof rows[number]>([rows, [{ name: "orderNumber" }]]);

    expect(result).toEqual(rows);
    expect(result[0].orderId).toBe(120001);
    expect(result[1].orderNumber).toBe("XT-HOLD-2");
  });

  it("preserves an already-normalized row array", () => {
    const rows = [{ orderId: 42, orderNumber: "XT42" }];

    expect(unwrapMySqlRows<typeof rows[number]>(rows)).toEqual(rows);
  });

  it("returns an empty array for a non-array result", () => {
    expect(unwrapMySqlRows(null)).toEqual([]);
  });
});
