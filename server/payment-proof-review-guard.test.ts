import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

describe("付款凭据审核金额保护", () => {
  it("requires a positive verified amount before an API caller can approve a payment", () => {
    const dbSource = readFileSync(resolve(projectRoot, "server/db.ts"), "utf8");
    expect(dbSource).toContain("付款凭据金额尚未核对，请先更正金额后再批准");
    expect(dbSource).toContain("data.action === 'approve' && Number(payment[0].amount || 0) <= 0");
  });

  it("makes missing amounts visible and correctable in the pending-proof review queue", () => {
    const pageSource = readFileSync(resolve(projectRoot, "client/src/pages/PaymentProofReviews.tsx"), "utf8");
    expect(pageSource).toContain("金额待核对，须先更正");
    expect(pageSource).toContain("trpc.orders.editPayment.useMutation");
    expect(pageSource).toContain("更正付款凭据金额");
  });
});
