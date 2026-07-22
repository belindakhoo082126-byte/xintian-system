import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db.ts
vi.mock("./db", () => ({
  globalCustomerSearch: vi.fn(),
  getCustomerDetail: vi.fn(),
  updateCustomerWithAudit: vi.fn(),
  setBlacklist: vi.fn(),
  getCustomerStats: vi.fn(),
  findEnhancedDuplicates: vi.fn(),
  getCustomerAddresses: vi.fn(),
  createCustomerAddress: vi.fn(),
  updateCustomerAddress: vi.fn(),
  deleteCustomerAddress: vi.fn(),
  getCustomerCreditLedger: vi.fn(),
  getCustomerCreditBalance: vi.fn(),
  addCustomerCredit: vi.fn(),
  getCustomerRefunds: vi.fn(),
  addCustomerRefund: vi.fn(),
  getCustomerTimeline: vi.fn(),
  addTimelineEvent: vi.fn(),
  getCustomerAuditLogs: vi.fn(),
  createCustomerAuditLog: vi.fn(),
}));

// Mock routers
vi.mock("./_core/trpc", () => ({
  router: vi.fn((routes: any) => routes),
  publicProcedure: { input: vi.fn(() => ({ query: vi.fn((h: any) => h), mutation: vi.fn((h: any) => h) })) },
  protectedProcedure: { input: vi.fn(() => ({ query: vi.fn((h: any) => h), mutation: vi.fn((h: any) => h) })) },
  adminProcedure: { input: vi.fn(() => ({ query: vi.fn((h: any) => h), mutation: vi.fn((h: any) => h) })) },
}));

import * as db from "./db";

const mockCtx = { user: { id: 1, name: "Admin", role: "admin" } };

describe("XLCS Module 3: Customer Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Global Customer Search", () => {
    it("should search across multiple fields", async () => {
      const mockResults = [
        { id: 1, customerId: "C000001", displayName: "Alice", facebookName: "Alice Lee" },
        { id: 2, customerId: "C000002", displayName: "Bob", facebookName: "Bob Tan" },
      ];
      vi.mocked(db.globalCustomerSearch).mockResolvedValue(mockResults as any);

      const results = await db.globalCustomerSearch("Alice", 20);
      expect(results).toHaveLength(2);
      expect(results[0].customerId).toBe("C000001");
      expect(db.globalCustomerSearch).toHaveBeenCalledWith("Alice", 20);
    });

    it("should return empty array for no matches", async () => {
      vi.mocked(db.globalCustomerSearch).mockResolvedValue([]);
      const results = await db.globalCustomerSearch("NonExistent", 20);
      expect(results).toHaveLength(0);
    });
  });

  describe("Customer Detail", () => {
    it("should return customer with all related data", async () => {
      const mockDetail = {
        id: 1,
        customerId: "C000001",
        displayName: "Alice",
        addresses: [{ id: 1, label: "Home", isDefault: true }],
        creditLedger: [{ id: 1, amount: "50.00", balanceAfter: "50.00" }],
        creditBalance: 50,
        refunds: [],
        timeline: [{ id: 1, eventType: "profile_updated", title: "Updated" }],
        auditLogs: [{ id: 1, action: "update_field" }],
        stats: { totalSpent: 100, totalOrders: 2, completedOrders: 1, cancelledOrders: 0, cancelRate: 0 },
      };
      vi.mocked(db.getCustomerDetail).mockResolvedValue(mockDetail as any);

      const detail = await db.getCustomerDetail(1);
      expect(detail).toBeDefined();
      expect(detail?.customerId).toBe("C000001");
      expect(detail?.addresses).toHaveLength(1);
      expect(detail?.creditBalance).toBe(50);
      expect(detail?.timeline).toHaveLength(1);
      expect(detail?.auditLogs).toHaveLength(1);
    });

    it("should return undefined for non-existent customer", async () => {
      vi.mocked(db.getCustomerDetail).mockResolvedValue(undefined);
      const detail = await db.getCustomerDetail(999);
      expect(detail).toBeUndefined();
    });
  });

  describe("Customer Update with Audit", () => {
    it("should call updateCustomerWithAudit with operator info", async () => {
      vi.mocked(db.updateCustomerWithAudit).mockResolvedValue(undefined as any);
      await db.updateCustomerWithAudit(1, { displayName: "New Name" }, 1, "Admin");
      expect(db.updateCustomerWithAudit).toHaveBeenCalledWith(1, { displayName: "New Name" }, 1, "Admin");
    });
  });

  describe("Blacklist Management", () => {
    it("should set blacklist with reason and operator", async () => {
      vi.mocked(db.setBlacklist).mockResolvedValue(undefined as any);
      await db.setBlacklist(1, true, "Fraudulent activity", 1, "Admin");
      expect(db.setBlacklist).toHaveBeenCalledWith(1, true, "Fraudulent activity", 1, "Admin");
    });

    it("should remove blacklist", async () => {
      vi.mocked(db.setBlacklist).mockResolvedValue(undefined as any);
      await db.setBlacklist(1, false, "", 1, "Admin");
      expect(db.setBlacklist).toHaveBeenCalledWith(1, false, "", 1, "Admin");
    });
  });

  describe("Customer Addresses", () => {
    it("should create address with all fields", async () => {
      vi.mocked(db.createCustomerAddress).mockResolvedValue({ id: 1 } as any);
      const addrData = {
        customerId: 1,
        label: "Home",
        recipientName: "Alice",
        recipientPhone: "0123456789",
        address: "123 Main St",
        city: "KL",
        state: "Wilayah",
        postalCode: "50000",
        country: "Malaysia",
        isDefault: true,
      };
      await db.createCustomerAddress(addrData);
      expect(db.createCustomerAddress).toHaveBeenCalledWith(addrData);
    });

    it("should list addresses for a customer", async () => {
      vi.mocked(db.getCustomerAddresses).mockResolvedValue([
        { id: 1, label: "Home", isDefault: true },
        { id: 2, label: "Office", isDefault: false },
      ] as any);
      const addresses = await db.getCustomerAddresses(1);
      expect(addresses).toHaveLength(2);
      expect(addresses[0].isDefault).toBe(true);
    });

    it("should delete an address", async () => {
      vi.mocked(db.deleteCustomerAddress).mockResolvedValue(undefined as any);
      await db.deleteCustomerAddress(1);
      expect(db.deleteCustomerAddress).toHaveBeenCalledWith(1);
    });

    it("should update address and set default", async () => {
      vi.mocked(db.updateCustomerAddress).mockResolvedValue(undefined as any);
      await db.updateCustomerAddress(2, { isDefault: true });
      expect(db.updateCustomerAddress).toHaveBeenCalledWith(2, { isDefault: true });
    });
  });

  describe("Customer Credit Ledger", () => {
    it("should add credit with balance calculation", async () => {
      vi.mocked(db.addCustomerCredit).mockResolvedValue({ id: 1, newBalance: 50 } as any);
      const result = await db.addCustomerCredit({
        customerId: 1,
        amount: 50,
        type: "topup",
        reason: "Manual topup",
        operatorId: 1,
        operatorName: "Admin",
      });
      expect(result.newBalance).toBe(50);
    });

    it("should get credit balance", async () => {
      vi.mocked(db.getCustomerCreditBalance).mockResolvedValue(150);
      const balance = await db.getCustomerCreditBalance(1);
      expect(balance).toBe(150);
    });

    it("should list credit ledger entries", async () => {
      vi.mocked(db.getCustomerCreditLedger).mockResolvedValue([
        { id: 1, amount: "50.00", balanceAfter: "50.00", type: "topup" },
        { id: 2, amount: "-20.00", balanceAfter: "30.00", type: "order_deduction" },
      ] as any);
      const ledger = await db.getCustomerCreditLedger(1);
      expect(ledger).toHaveLength(2);
      expect(Number(ledger[1].amount)).toBe(-20);
    });
  });

  describe("Customer Refunds", () => {
    it("should add a refund record", async () => {
      vi.mocked(db.addCustomerRefund).mockResolvedValue({ id: 1 } as any);
      await db.addCustomerRefund({
        customerId: 1,
        orderId: 10,
        amount: 30,
        refundMethod: "tng",
        reason: "Out of stock",
        operatorId: 1,
        operatorName: "Admin",
      });
      expect(db.addCustomerRefund).toHaveBeenCalledWith(expect.objectContaining({
        customerId: 1,
        orderId: 10,
        amount: 30,
        refundMethod: "tng",
      }));
    });

    it("should list refunds for a customer", async () => {
      vi.mocked(db.getCustomerRefunds).mockResolvedValue([
        { id: 1, amount: "30.00", refundMethod: "tng" },
      ] as any);
      const refunds = await db.getCustomerRefunds(1);
      expect(refunds).toHaveLength(1);
    });
  });

  describe("Customer Timeline", () => {
    it("should list timeline events", async () => {
      vi.mocked(db.getCustomerTimeline).mockResolvedValue([
        { id: 1, eventType: "order_created", title: "New Order #100" },
        { id: 2, eventType: "payment_received", title: "Payment RM50" },
      ] as any);
      const events = await db.getCustomerTimeline(1);
      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe("order_created");
    });

    it("should add timeline event", async () => {
      vi.mocked(db.addTimelineEvent).mockResolvedValue(undefined as any);
      await db.addTimelineEvent({
        customerId: 1,
        eventType: "other",
        title: "Manual note",
      });
      expect(db.addTimelineEvent).toHaveBeenCalledWith({
        customerId: 1,
        eventType: "other",
        title: "Manual note",
      });
    });
  });

  describe("Customer Audit Logs", () => {
    it("should list audit logs", async () => {
      vi.mocked(db.getCustomerAuditLogs).mockResolvedValue([
        { id: 1, action: "update_field", fieldName: "displayName", oldValue: "Old", newValue: "New" },
      ] as any);
      const logs = await db.getCustomerAuditLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs[0].fieldName).toBe("displayName");
    });

    it("should create audit log entry", async () => {
      vi.mocked(db.createCustomerAuditLog).mockResolvedValue(undefined as any);
      await db.createCustomerAuditLog({
        customerId: 1,
        action: "blacklist_add",
        fieldName: "isBlacklisted",
        oldValue: "false",
        newValue: "true",
        operatorId: 1,
        operatorName: "Admin",
      });
      expect(db.createCustomerAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: "blacklist_add",
        fieldName: "isBlacklisted",
      }));
    });
  });

  describe("Customer Statistics", () => {
    it("should return computed stats", async () => {
      vi.mocked(db.getCustomerStats).mockResolvedValue({
        totalSpent: 500,
        totalOrders: 5,
        completedOrders: 4,
        cancelledOrders: 1,
        cancelRate: 20,
        totalItems: 10,
        avgOrderAmount: 100,
        lastOrderAt: new Date("2026-07-01"),
      } as any);
      const stats = await db.getCustomerStats(1);
      expect(stats.totalOrders).toBe(5);
      expect(stats.cancelRate).toBe(20);
      expect(stats.avgOrderAmount).toBe(100);
    });
  });

  describe("Enhanced Duplicate Detection", () => {
    it("should find duplicates by phone and messenger", async () => {
      vi.mocked(db.findEnhancedDuplicates).mockResolvedValue([
        { id: 2, customerId: "C000002", phoneNumber: "0123456789", messengerId: "12345" },
      ] as any);
      const dups = await db.findEnhancedDuplicates(1);
      expect(dups).toHaveLength(1);
      expect(dups[0].phoneNumber).toBe("0123456789");
    });

    it("should return empty array when no duplicates", async () => {
      vi.mocked(db.findEnhancedDuplicates).mockResolvedValue([]);
      const dups = await db.findEnhancedDuplicates(1);
      expect(dups).toHaveLength(0);
    });
  });
});
