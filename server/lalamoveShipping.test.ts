import { describe, expect, it } from "vitest";
import {
  calculateLalamoveActualCustomerBalance,
  calculateLalamoveCheckoutCustomerShipping,
  LALAMOVE_COMPANY_BEARING,
} from "../shared/shippingV22";

describe("Lalamove RM15公司承担规则", () => {
  it("结账时不向客户预收Lalamove运费", () => {
    expect(calculateLalamoveCheckoutCustomerShipping()).toBe(0);
    expect(LALAMOVE_COMPANY_BEARING).toBe(15);
  });

  it("实际费用不超过RM15时不产生退款或补差价", () => {
    expect(calculateLalamoveActualCustomerBalance(12)).toEqual({
      actualShippingFee: 12,
      customerBalance: 0,
      needsSpecialOrder: false,
    });
    expect(calculateLalamoveActualCustomerBalance(15)).toMatchObject({
      customerBalance: 0,
      needsSpecialOrder: false,
    });
  });

  it("实际费用超过RM15时仅向客户补收超额", () => {
    expect(calculateLalamoveActualCustomerBalance(23.5)).toEqual({
      actualShippingFee: 23.5,
      customerBalance: 8.5,
      needsSpecialOrder: true,
    });
  });

  it("管理员调整公司承担额后，仍只收实际超额且不对低于承担额的配送退款", () => {
    expect(calculateLalamoveCheckoutCustomerShipping(20)).toBe(0);
    expect(calculateLalamoveActualCustomerBalance(18, 20)).toMatchObject({ customerBalance: 0, needsSpecialOrder: false });
    expect(calculateLalamoveActualCustomerBalance(27.5, 20)).toMatchObject({ customerBalance: 7.5, needsSpecialOrder: true });
  });
});
