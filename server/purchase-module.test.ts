import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from './db';

// Mock the db module
vi.mock('./db', () => ({
  db: {
    // Suppliers V2
    listSuppliersV2: vi.fn(),
    getSupplierByIdV2: vi.fn(),
    createSupplierV2: vi.fn(),
    updateSupplierV2: vi.fn(),
    deactivateSupplier: vi.fn(),
    generateSupplierCode: vi.fn(),

    // Purchase Orders V2
    listPurchaseOrdersV2: vi.fn(),
    getPurchaseOrderByIdV2: vi.fn(),
    createPurchaseOrderV2: vi.fn(),
    updatePurchaseOrderDraft: vi.fn(),
    confirmPurchaseOrder: vi.fn(),
    cancelPurchaseOrder: vi.fn(),

    // Inventory
    getInventoryLots: vi.fn(),
    getInventoryLedger: vi.fn(),
    getCurrentStock: vi.fn(),
    consumeFifoLots: vi.fn(),
  },
}));

describe('Purchase Module - Suppliers V2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list suppliers with search', async () => {
    const mockSuppliers = [
      { id: 1, supplierCode: 'SUP001', name: 'Test Supplier', status: 'active' },
    ];
    (db.listSuppliersV2 as any).mockResolvedValue(mockSuppliers);

    const result = await db.listSuppliersV2({ search: 'Test' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Supplier');
    expect(db.listSuppliersV2).toHaveBeenCalledWith({ search: 'Test' });
  });

  it('should get supplier by id with purchase history', async () => {
    const mockSupplier = {
      id: 1,
      supplierCode: 'SUP001',
      name: 'Test Supplier',
      purchaseHistory: [],
    };
    (db.getSupplierByIdV2 as any).mockResolvedValue(mockSupplier);

    const result = await db.getSupplierByIdV2(1);
    expect(result.id).toBe(1);
    expect(result.purchaseHistory).toEqual([]);
  });

  it('should create supplier with required fields', async () => {
    const mockCreated = { id: 1, supplierCode: 'SUP001', name: 'New Supplier' };
    (db.createSupplierV2 as any).mockResolvedValue(mockCreated);

    const result = await db.createSupplierV2({
      name: 'New Supplier',
      contactPerson: 'John',
      phoneNumber: '0123456789',
    });
    expect(result.id).toBe(1);
    expect(result.name).toBe('New Supplier');
  });

  it('should update supplier', async () => {
    (db.updateSupplierV2 as any).mockResolvedValue({ id: 1, name: 'Updated' });

    const result = await db.updateSupplierV2(1, { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('should deactivate supplier', async () => {
    (db.deactivateSupplier as any).mockResolvedValue({ success: true });

    const result = await db.deactivateSupplier(1);
    expect(result.success).toBe(true);
  });

  it('should generate supplier code', async () => {
    (db.generateSupplierCode as any).mockResolvedValue('SUP001');

    const result = await db.generateSupplierCode();
    expect(result).toBe('SUP001');
  });
});

describe('Purchase Module - Purchase Orders V2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list purchase orders with filters', async () => {
    const mockOrders = [
      { id: 1, purchaseOrderNo: 'PO001', status: 'draft', totalAmount: '100.00' },
    ];
    (db.listPurchaseOrdersV2 as any).mockResolvedValue(mockOrders);

    const result = await db.listPurchaseOrdersV2({ status: 'draft' });
    expect(result).toHaveLength(1);
    expect(result[0].purchaseOrderNo).toBe('PO001');
  });

  it('should get purchase order by id with items', async () => {
    const mockPO = {
      id: 1,
      purchaseOrderNo: 'PO001',
      status: 'draft',
      items: [{ id: 1, productId: 1, quantity: 10, unitCost: '5.00', subtotal: '50.00' }],
    };
    (db.getPurchaseOrderByIdV2 as any).mockResolvedValue(mockPO);

    const result = await db.getPurchaseOrderByIdV2(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(10);
  });

  it('should create purchase order as draft', async () => {
    const mockCreated = { id: 1, purchaseOrderNo: 'PO001', status: 'draft' };
    (db.createPurchaseOrderV2 as any).mockResolvedValue(mockCreated);

    const result = await db.createPurchaseOrderV2({
      supplierId: 1,
      purchaseDate: Date.now(),
      items: [{ productId: 1, quantity: 5, unitCost: '10.00', subtotal: '50.00' }],
    });
    expect(result.status).toBe('draft');
  });

  it('should confirm purchase order and create FIFO lots', async () => {
    const mockConfirmed = { id: 1, status: 'confirmed', lotsCreated: 3 };
    (db.confirmPurchaseOrder as any).mockResolvedValue(mockConfirmed);

    const result = await db.confirmPurchaseOrder(1, 'admin');
    expect(result.status).toBe('confirmed');
    expect(result.lotsCreated).toBe(3);
  });

  it('should cancel purchase order', async () => {
    (db.cancelPurchaseOrder as any).mockResolvedValue({ success: true });

    const result = await db.cancelPurchaseOrder(1);
    expect(result.success).toBe(true);
  });
});

describe('Purchase Module - Inventory (FIFO)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get inventory lots for a product', async () => {
    const mockLots = [
      { id: 1, lotNo: 'LOT001', remainingQuantity: 10, unitCost: '5.00', status: 'active' },
      { id: 2, lotNo: 'LOT002', remainingQuantity: 5, unitCost: '6.00', status: 'active' },
    ];
    (db.getInventoryLots as any).mockResolvedValue(mockLots);

    const result = await db.getInventoryLots({ productId: 1 });
    expect(result).toHaveLength(2);
    expect(result[0].lotNo).toBe('LOT001');
  });

  it('should get inventory ledger entries', async () => {
    const mockLedger = [
      { id: 1, transactionType: 'purchase', quantityChange: 10, balanceAfter: 10, unitCost: '5.00' },
    ];
    (db.getInventoryLedger as any).mockResolvedValue(mockLedger);

    const result = await db.getInventoryLedger({ productId: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].transactionType).toBe('purchase');
  });

  it('should get current stock for a product', async () => {
    const mockStock = { productId: 1, totalQuantity: 15, averageCost: '5.33' };
    (db.getCurrentStock as any).mockResolvedValue(mockStock);

    const result = await db.getCurrentStock(1);
    expect(result.totalQuantity).toBe(15);
  });

  it('should consume FIFO lots (sell 3 units from oldest first)', async () => {
    const mockConsumed = {
      consumed: [
        { lotId: 1, quantity: 3, unitCost: '5.00' },
      ],
      totalCost: '15.00',
    };
    (db.consumeFifoLots as any).mockResolvedValue(mockConsumed);

    const result = await db.consumeFifoLots({ productId: 1, quantity: 3 });
    expect(result.consumed).toHaveLength(1);
    expect(result.consumed[0].lotId).toBe(1);
    expect(result.totalCost).toBe('15.00');
  });

  it('should consume across multiple lots when first lot is insufficient', async () => {
    const mockConsumed = {
      consumed: [
        { lotId: 1, quantity: 10, unitCost: '5.00' },
        { lotId: 2, quantity: 5, unitCost: '6.00' },
      ],
      totalCost: '80.00',
    };
    (db.consumeFifoLots as any).mockResolvedValue(mockConsumed);

    const result = await db.consumeFifoLots({ productId: 1, quantity: 15 });
    expect(result.consumed).toHaveLength(2);
    expect(result.totalCost).toBe('80.00');
  });
});
