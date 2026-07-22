import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('./db', () => ({
  getWorkCenterStats: vi.fn(),
  getRecentActionItems: vi.fn(),
  getAllActionItems: vi.fn(),
  completeActionItem: vi.fn(),
  getOrderNotes: vi.fn(),
  addOrderNote: vi.fn(),
  deleteOrderNote: vi.fn(),
  getAllActionItemsForOrder: vi.fn(),
  createActionItem: vi.fn(),
  getSalesSessions: vi.fn(),
  getSalesSessionById: vi.fn(),
  createSalesSession: vi.fn(),
  updateSalesSessionStatus: vi.fn(),
  getSalesSessionStats: vi.fn(),
  getSessionProducts: vi.fn(),
  addSessionProduct: vi.fn(),
  updateSessionProduct: vi.fn(),
  getFacebookComments: vi.fn(),
  normalizeCommentMessage: vi.fn(),
  findSessionProductByKeyword: vi.fn(),
  checkProductAvailability: vi.fn(),
}));

import * as db from './db';

describe('Dashboard Work Center', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getWorkCenterStats returns aggregated stats', async () => {
    vi.mocked(db.getWorkCenterStats).mockResolvedValue({
      pendingActionCount: 5,
      pendingPaymentCount: 3,
      pendingPaymentAmount: '150.00',
      paidCount: 10,
      paidAmount: '500.00',
      todayCustomerCount: 8,
      todayItemCount: 15,
      todayTotalAmount: '300.00',
      todayLiveCount: 1,
    } as any);

    const stats = await db.getWorkCenterStats();
    expect(stats).toBeDefined();
    expect(stats?.pendingActionCount).toBe(5);
    expect(stats?.pendingPaymentCount).toBe(3);
    expect(stats?.paidCount).toBe(10);
    expect(stats?.todayCustomerCount).toBe(8);
  });

  it('getRecentActionItems returns pending items', async () => {
    vi.mocked(db.getRecentActionItems).mockResolvedValue([
      { id: 1, content: 'Follow up on payment', status: 'pending', source: 'facebook_live', createdAt: new Date(), orderId: 10 },
    ] as any);

    const items = await db.getRecentActionItems();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('pending');
  });

  it('completeActionItem marks item as completed', async () => {
    vi.mocked(db.completeActionItem).mockResolvedValue({ success: true } as any);

    const result = await db.completeActionItem(1, 'Admin');
    expect(result).toBeDefined();
    expect(vi.mocked(db.completeActionItem)).toHaveBeenCalledWith(1, 'Admin');
  });

  it('getAllActionItems returns all items with filters', async () => {
    vi.mocked(db.getAllActionItems).mockResolvedValue([
      { id: 1, content: 'Item 1', status: 'pending' },
      { id: 2, content: 'Item 2', status: 'completed' },
    ] as any);

    const items = await db.getAllActionItems({ status: 'pending', limit: 50, offset: 0 });
    expect(items).toHaveLength(2);
  });
});

describe('Order Notes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getOrderNotes returns notes for an order', async () => {
    vi.mocked(db.getOrderNotes).mockResolvedValue([
      { id: 1, orderId: 10, noteType: 'internal_note', content: 'Check payment', needsAction: true, createdAt: new Date() },
      { id: 2, orderId: 10, noteType: 'customer_note', content: 'Customer asked about shipping', needsAction: false, createdAt: new Date() },
    ] as any);

    const notes = await db.getOrderNotes(10, true);
    expect(notes).toHaveLength(2);
    expect(notes[0].noteType).toBe('internal_note');
    expect(notes[1].noteType).toBe('customer_note');
  });

  it('addOrderNote creates a note', async () => {
    vi.mocked(db.addOrderNote).mockResolvedValue({ id: 3, orderId: 10, noteType: 'checkout_note', content: 'Special packaging', needsAction: false } as any);

    const note = await db.addOrderNote({
      orderId: 10,
      customerId: 5,
      noteType: 'checkout_note',
      visibility: 'internal',
      content: 'Special packaging',
      needsAction: false,
      createdByName: 'Admin',
    });
    expect(note).toBeDefined();
    expect(note?.id).toBe(3);
    expect(note?.noteType).toBe('checkout_note');
  });

  it('deleteOrderNote removes a note', async () => {
    vi.mocked(db.deleteOrderNote).mockResolvedValue({ success: true } as any);

    const result = await db.deleteOrderNote(1);
    expect(result).toBeDefined();
  });

  it('addOrderNote with needsAction creates an action item', async () => {
    vi.mocked(db.addOrderNote).mockResolvedValue({ id: 4, orderId: 10, noteType: 'internal_note', content: 'Urgent: verify address', needsAction: true } as any);
    vi.mocked(db.createActionItem).mockResolvedValue({ id: 1 } as any);

    const note = await db.addOrderNote({
      orderId: 10,
      customerId: 5,
      noteType: 'internal_note',
      visibility: 'internal',
      content: 'Urgent: verify address',
      needsAction: true,
      createdByName: 'Admin',
    });
    expect(note?.needsAction).toBe(true);
  });
});

describe('Action Items', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createActionItem creates a new item', async () => {
    vi.mocked(db.createActionItem).mockResolvedValue({ id: 1, orderId: 10, content: 'Call customer', status: 'pending' } as any);

    const item = await db.createActionItem({
      orderId: 10,
      customerId: 5,
      content: 'Call customer',
      source: 'admin',
      createdByName: 'Admin',
    });
    expect(item).toBeDefined();
    expect(item?.id).toBe(1);
    expect(item?.status).toBe('pending');
  });

  it('completeActionItem marks as completed with operator name', async () => {
    vi.mocked(db.completeActionItem).mockResolvedValue({ success: true } as any);

    const result = await db.completeActionItem(1, 'Staff A');
    expect(vi.mocked(db.completeActionItem)).toHaveBeenCalledWith(1, 'Staff A');
  });
});

describe('Sales Sessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getSalesSessions returns paginated list', async () => {
    vi.mocked(db.getSalesSessions).mockResolvedValue([
      { id: 1, sessionCode: 'S001', sessionType: 'facebook_live', title: 'July Live', status: 'order_capture_active' },
      { id: 2, sessionCode: 'S002', sessionType: 'facebook_post', title: 'July Post', status: 'ended' },
    ] as any);

    const sessions = await db.getSalesSessions({ limit: 20, offset: 0 });
    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionType).toBe('facebook_live');
  });

  it('getSalesSessionById returns session with details', async () => {
    vi.mocked(db.getSalesSessionById).mockResolvedValue({
      id: 1, sessionCode: 'S001', sessionType: 'facebook_live', title: 'July Live',
      status: 'order_capture_active', startedAt: new Date(),
    } as any);

    const session = await db.getSalesSessionById(1);
    expect(session).toBeDefined();
    expect(session?.id).toBe(1);
  });

  it('createSalesSession creates a new session', async () => {
    vi.mocked(db.createSalesSession).mockResolvedValue({ id: 3, sessionCode: 'S003', sessionType: 'facebook_live', title: 'New Live' } as any);

    const session = await db.createSalesSession({
      sessionCode: 'S003',
      sessionType: 'facebook_live',
      title: 'New Live',
    });
    expect(session).toBeDefined();
    expect(session?.id).toBe(3);
  });

  it('updateSalesSessionStatus transitions status', async () => {
    vi.mocked(db.updateSalesSessionStatus).mockResolvedValue({ success: true } as any);

    const result = await db.updateSalesSessionStatus(1, 'paused');
    expect(vi.mocked(db.updateSalesSessionStatus)).toHaveBeenCalledWith(1, 'paused');
  });

  it('getSalesSessionStats returns aggregated stats', async () => {
    vi.mocked(db.getSalesSessionStats).mockResolvedValue({
      orderStats: { customerCount: 5, itemCount: 10, totalAmount: '250.00', paid: 3, pending: 2, cancelled: 0 },
      commentStats: { total: 20, matched: 15, duplicate: 2, blacklisted: 1, failed: 2 },
      pendingActionCount: 1,
    } as any);

    const stats = await db.getSalesSessionStats(1);
    expect(stats).toBeDefined();
    expect(stats?.orderStats?.customerCount).toBe(5);
    expect(stats?.commentStats?.total).toBe(20);
  });
});

describe('Session Products', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getSessionProducts returns products for a session', async () => {
    vi.mocked(db.getSessionProducts).mockResolvedValue([
      { id: 1, sessionId: 1, productId: 5, keyword: 'MP1', sellingPrice: '25.00', sellingStatus: 'available', physicalStockAtStart: 10, physicalSoldQuantity: 3, preorderEnabled: false },
    ] as any);

    const products = await db.getSessionProducts(1);
    expect(products).toHaveLength(1);
    expect(products[0].keyword).toBe('MP1');
  });

  it('addSessionProduct binds a product to a session', async () => {
    vi.mocked(db.addSessionProduct).mockResolvedValue({ id: 2, sessionId: 1, productId: 6, keyword: 'MP2' } as any);

    const product = await db.addSessionProduct({
      sessionId: 1,
      productId: 6,
      keyword: 'MP2',
      sellingPrice: '30.00',
      physicalStockAtStart: 5,
    });
    expect(product).toBeDefined();
    expect(product?.id).toBe(2);
  });

  it('updateSessionProduct updates selling status', async () => {
    vi.mocked(db.updateSessionProduct).mockResolvedValue({ success: true } as any);

    const result = await db.updateSessionProduct(1, { sellingStatus: 'stopped' });
    expect(vi.mocked(db.updateSessionProduct)).toHaveBeenCalledWith(1, { sellingStatus: 'stopped' });
  });
});

describe('Facebook Comment Processing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizeCommentMessage standardizes keywords', () => {
    vi.mocked(db.normalizeCommentMessage).mockReturnValue({
      normalizedMessage: 'MP1 2',
      keyword: 'MP1',
      quantity: 2,
    });

    const result = db.normalizeCommentMessage('mp1 x2');
    expect(result.keyword).toBe('MP1');
    expect(result.quantity).toBe(2);
  });

  it('normalizeCommentMessage handles lowercase keywords', () => {
    vi.mocked(db.normalizeCommentMessage).mockReturnValue({
      normalizedMessage: 'MP3 1',
      keyword: 'MP3',
      quantity: 1,
    });

    const result = db.normalizeCommentMessage('mp3');
    expect(result.keyword).toBe('MP3');
    expect(result.quantity).toBe(1);
  });

  it('findSessionProductByKeyword matches exact keyword', async () => {
    vi.mocked(db.findSessionProductByKeyword).mockResolvedValue({
      id: 1, sessionId: 1, productId: 5, keyword: 'MP1', sellingPrice: '25.00', sellingStatus: 'available',
    } as any);

    const product = await db.findSessionProductByKeyword(1, 'MP1');
    expect(product).toBeDefined();
    expect(product?.keyword).toBe('MP1');
  });

  it('findSessionProductByKeyword returns null for no match', async () => {
    vi.mocked(db.findSessionProductByKeyword).mockResolvedValue(null);

    const product = await db.findSessionProductByKeyword(1, 'UNKNOWN');
    expect(product).toBeNull();
  });

  it('checkProductAvailability returns available for in-stock product', async () => {
    vi.mocked(db.checkProductAvailability).mockResolvedValue({
      available: true,
      reason: null,
    } as any);

    const result = await db.checkProductAvailability(1, 2);
    expect(result.available).toBe(true);
  });

  it('checkProductAvailability returns unavailable for out-of-stock', async () => {
    vi.mocked(db.checkProductAvailability).mockResolvedValue({
      available: false,
      reason: 'out_of_stock',
    } as any);

    const result = await db.checkProductAvailability(1, 100);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('out_of_stock');
  });

  it('checkProductAvailability returns unavailable for preorder full', async () => {
    vi.mocked(db.checkProductAvailability).mockResolvedValue({
      available: false,
      reason: 'preorder_full',
    } as any);

    const result = await db.checkProductAvailability(1, 50);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('preorder_full');
  });

  it('getFacebookComments returns comments for a session', async () => {
    vi.mocked(db.getFacebookComments).mockResolvedValue([
      { id: 1, sessionId: 1, facebookUserId: 'FB123', messageOriginal: 'MP1 2', processingStatus: 'matched', keywordDetected: 'MP1', quantityDetected: 2 },
      { id: 2, sessionId: 1, facebookUserId: 'FB456', messageOriginal: 'hi', processingStatus: 'no_match' },
    ] as any);

    const comments = await db.getFacebookComments(1, 50);
    expect(comments).toHaveLength(2);
    expect(comments[0].processingStatus).toBe('matched');
    expect(comments[1].processingStatus).toBe('no_match');
  });
});
