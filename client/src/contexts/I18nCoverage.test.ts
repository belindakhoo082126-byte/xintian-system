import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const translatedPages = [
  "ProductsV2.tsx",
  "Categories.tsx",
  "Orders.tsx",
  "OrderDetail.tsx",
  "Membership.tsx",
  "Customers.tsx",
  "Flows.tsx",
  "Suppliers.tsx",
  "PurchaseOrders.tsx",
  "BusinessReport.tsx",
  "SalesPaymentReport.tsx",
  "ProductSalesReport.tsx",
  "CustomerSpendingReport.tsx",
  "PurchaseInventoryReport.tsx",
  "FacebookSettings.tsx",
  "MallSettings.tsx",
  "Packing.tsx",
  "PackingDetail.tsx",
  "CustomerOrderTracking.tsx",
  "CustomerPayment.tsx",
];

describe("admin page internationalisation coverage", () => {
  it.each(translatedPages)("wires %s to the shared language context", (page) => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages", page), "utf8");

    expect(source).toContain("useI18n");
    expect(source).toContain("translate(");
  });
});
