import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('./db', () => ({
  getAiSettings: vi.fn(),
  updateAiSettings: vi.fn(),
  getFaqEntries: vi.fn(),
  getFaqEntryById: vi.fn(),
  createFaqEntry: vi.fn(),
  updateFaqEntry: vi.fn(),
  deleteFaqEntry: vi.fn(),
  getKnowledgeEntries: vi.fn(),
  getKnowledgeEntryById: vi.fn(),
  createKnowledgeEntry: vi.fn(),
  updateKnowledgeEntry: vi.fn(),
  deleteKnowledgeEntry: vi.fn(),
  getAiReplyLogs: vi.fn(),
  getAiReplyLogById: vi.fn(),
  createAiReplyLog: vi.fn(),
  updateAiReplyLogHumanReply: vi.fn(),
  getAiReviewItems: vi.fn(),
  createAiReviewItem: vi.fn(),
  updateAiReviewItemStatus: vi.fn(),
  getPlantDiagnosticTickets: vi.fn(),
  getPlantDiagnosticTicketById: vi.fn(),
  createPlantDiagnosticTicket: vi.fn(),
  updatePlantDiagnosticTicket: vi.fn(),
  getAiChatSessions: vi.fn(),
  getAiChatSessionById: vi.fn(),
  createAiChatSession: vi.fn(),
  updateAiChatSession: vi.fn(),
  getSessionProductVariants: vi.fn(),
  addSessionProductVariant: vi.fn(),
  updateSessionProductVariant: vi.fn(),
  deleteSessionProductVariant: vi.fn(),
  findSessionProductVariantByKeyword: vi.fn(),
  getSellableProducts: vi.fn(),
  getLiveDashboardStats: vi.fn(),
}));

import * as db from './db';

describe('AI Settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getAiSettings returns settings', async () => {
    const mockSettings = { id: 1, autoReplyEnabled: true, learningMode: 'suggestion', minConfidenceThreshold: '70.00' };
    vi.mocked(db.getAiSettings).mockResolvedValue(mockSettings as any);
    const result = await db.getAiSettings();
    expect(result).toEqual(mockSettings);
    expect(db.getAiSettings).toHaveBeenCalled();
  });

  it('updateAiSettings updates settings', async () => {
    vi.mocked(db.updateAiSettings).mockResolvedValue({ id: 1 } as any);
    const result = await db.updateAiSettings({ autoReplyEnabled: false });
    expect(result).toEqual({ id: 1 });
    expect(db.updateAiSettings).toHaveBeenCalledWith({ autoReplyEnabled: false });
  });
});

describe('FAQ Entries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getFaqEntries returns list with search', async () => {
    const mockList = [{ id: 1, category: '配送', question: '运费多少？', answer: 'RM10' }];
    vi.mocked(db.getFaqEntries).mockResolvedValue(mockList as any);
    const result = await db.getFaqEntries({ search: '运费' });
    expect(result).toEqual(mockList);
    expect(db.getFaqEntries).toHaveBeenCalledWith({ search: '运费' });
  });

  it('createFaqEntry creates and returns id', async () => {
    vi.mocked(db.createFaqEntry).mockResolvedValue({ id: 1 } as any);
    const result = await db.createFaqEntry({ category: '配送', question: '运费多少？', answer: 'RM10', sortOrder: 0, isActive: true });
    expect(result).toEqual({ id: 1 });
  });

  it('updateFaqEntry updates entry', async () => {
    vi.mocked(db.updateFaqEntry).mockResolvedValue({ id: 1 } as any);
    const result = await db.updateFaqEntry(1, { answer: 'RM15' });
    expect(result).toEqual({ id: 1 });
  });

  it('deleteFaqEntry deletes entry', async () => {
    vi.mocked(db.deleteFaqEntry).mockResolvedValue({ id: 1 } as any);
    const result = await db.deleteFaqEntry(1);
    expect(result).toEqual({ id: 1 });
  });
});

describe('Knowledge Entries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getKnowledgeEntries returns list', async () => {
    const mockList = [{ id: 1, topic: '龟背竹养护', content: '需要明亮散射光' }];
    vi.mocked(db.getKnowledgeEntries).mockResolvedValue(mockList as any);
    const result = await db.getKnowledgeEntries({ search: '龟背竹' });
    expect(result).toEqual(mockList);
  });

  it('createKnowledgeEntry creates and returns id', async () => {
    vi.mocked(db.createKnowledgeEntry).mockResolvedValue({ id: 1 } as any);
    const result = await db.createKnowledgeEntry({ topic: '龟背竹养护', content: '需要明亮散射光', sortOrder: 0, isActive: true });
    expect(result).toEqual({ id: 1 });
  });

  it('deleteKnowledgeEntry deletes entry', async () => {
    vi.mocked(db.deleteKnowledgeEntry).mockResolvedValue({ id: 1 } as any);
    const result = await db.deleteKnowledgeEntry(1);
    expect(result).toEqual({ id: 1 });
  });
});

describe('AI Reply Logs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getAiReplyLogs returns list with filters', async () => {
    const mockList = [{ id: 1, platform: 'messenger', aiModule: 'faq', customerQuestion: '运费？', aiReply: 'RM10', replyStatus: 'sent' }];
    vi.mocked(db.getAiReplyLogs).mockResolvedValue(mockList as any);
    const result = await db.getAiReplyLogs({ platform: 'messenger', limit: 10 });
    expect(result).toEqual(mockList);
    expect(db.getAiReplyLogs).toHaveBeenCalledWith({ platform: 'messenger', limit: 10 });
  });

  it('createAiReplyLog creates log', async () => {
    vi.mocked(db.createAiReplyLog).mockResolvedValue({ id: 1 } as any);
    const result = await db.createAiReplyLog({ platform: 'messenger', aiModule: 'faq', customerQuestion: '运费？', aiReply: 'RM10', replyStatus: 'sent' } as any);
    expect(result).toEqual({ id: 1 });
  });

  it('updateAiReplyLogHumanReply updates human reply', async () => {
    vi.mocked(db.updateAiReplyLogHumanReply).mockResolvedValue({ id: 1 } as any);
    const result = await db.updateAiReplyLogHumanReply(1, '人工回复内容');
    expect(result).toEqual({ id: 1 });
  });
});

describe('AI Review Items', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getAiReviewItems returns list with status filter', async () => {
    const mockList = [{ id: 1, status: 'pending', customerQuestion: '问题', aiSuggestion: '建议' }];
    vi.mocked(db.getAiReviewItems).mockResolvedValue(mockList as any);
    const result = await db.getAiReviewItems({ status: 'pending' });
    expect(result).toEqual(mockList);
  });

  it('createAiReviewItem creates item', async () => {
    vi.mocked(db.createAiReviewItem).mockResolvedValue({ id: 1 } as any);
    const result = await db.createAiReviewItem({ customerQuestion: '问题', aiSuggestion: '建议', suggestionType: 'faq' } as any);
    expect(result).toEqual({ id: 1 });
  });

  it('updateAiReviewItemStatus updates status with modifiedReply', async () => {
    vi.mocked(db.updateAiReviewItemStatus).mockResolvedValue({ id: 1 } as any);
    const result = await db.updateAiReviewItemStatus(1, 'modified', 'Admin', undefined, '修改后的回复');
    expect(result).toEqual({ id: 1 });
    expect(db.updateAiReviewItemStatus).toHaveBeenCalledWith(1, 'modified', 'Admin', undefined, '修改后的回复');
  });

  it('updateAiReviewItemStatus updates status to approved', async () => {
    vi.mocked(db.updateAiReviewItemStatus).mockResolvedValue({ id: 1 } as any);
    const result = await db.updateAiReviewItemStatus(1, 'approved', 'Admin');
    expect(result).toEqual({ id: 1 });
  });

  it('updateAiReviewItemStatus updates status to rejected', async () => {
    vi.mocked(db.updateAiReviewItemStatus).mockResolvedValue({ id: 1 } as any);
    const result = await db.updateAiReviewItemStatus(1, 'rejected', 'Admin');
    expect(result).toEqual({ id: 1 });
  });

  it('updateAiReviewItemStatus updates status to ignored', async () => {
    vi.mocked(db.updateAiReviewItemStatus).mockResolvedValue({ id: 1 } as any);
    const result = await db.updateAiReviewItemStatus(1, 'ignored', 'Admin');
    expect(result).toEqual({ id: 1 });
  });
});

describe('Plant Diagnostic Tickets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getPlantDiagnosticTickets returns list', async () => {
    const mockList = [{ id: 1, status: 'open', customerQuestion: '叶子发黄' }];
    vi.mocked(db.getPlantDiagnosticTickets).mockResolvedValue(mockList as any);
    const result = await db.getPlantDiagnosticTickets({ status: 'open' });
    expect(result).toEqual(mockList);
  });

  it('createPlantDiagnosticTicket creates ticket', async () => {
    vi.mocked(db.createPlantDiagnosticTicket).mockResolvedValue({ id: 1 } as any);
    const result = await db.createPlantDiagnosticTicket({ customerQuestion: '叶子发黄' } as any);
    expect(result).toEqual({ id: 1 });
  });

  it('updatePlantDiagnosticTicket updates status', async () => {
    vi.mocked(db.updatePlantDiagnosticTicket).mockResolvedValue({ id: 1 } as any);
    const result = await db.updatePlantDiagnosticTicket(1, { status: 'resolved' });
    expect(result).toEqual({ id: 1 });
  });
});

describe('AI Chat Sessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getAiChatSessions returns list', async () => {
    const mockList = [{ id: 1, platform: 'messenger', status: 'active' }];
    vi.mocked(db.getAiChatSessions).mockResolvedValue(mockList as any);
    const result = await db.getAiChatSessions({ limit: 10 });
    expect(result).toEqual(mockList);
  });

  it('createAiChatSession creates session', async () => {
    vi.mocked(db.createAiChatSession).mockResolvedValue({ id: 1 } as any);
    const result = await db.createAiChatSession({ platform: 'messenger' } as any);
    expect(result).toEqual({ id: 1 });
  });
});

describe('Session Product Variants', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getSessionProductVariants returns list', async () => {
    const mockList = [{ id: 1, sessionId: 1, keyword: 'MP1+1', sellingStatus: 'available' }];
    vi.mocked(db.getSessionProductVariants).mockResolvedValue(mockList as any);
    const result = await db.getSessionProductVariants(1);
    expect(result).toEqual(mockList);
  });

  it('addSessionProductVariant creates variant', async () => {
    vi.mocked(db.addSessionProductVariant).mockResolvedValue({ id: 1 } as any);
    const result = await db.addSessionProductVariant({ sessionId: 1, sessionProductId: 1, variantId: 1, keyword: 'MP1+1' } as any);
    expect(result).toEqual({ id: 1 });
  });

  it('findSessionProductVariantByKeyword finds variant', async () => {
    const mockVariant = { id: 1, keyword: 'MP1+1', sellingStatus: 'available' };
    vi.mocked(db.findSessionProductVariantByKeyword).mockResolvedValue(mockVariant as any);
    const result = await db.findSessionProductVariantByKeyword(1, 'MP1+1');
    expect(result).toEqual(mockVariant);
  });

  it('deleteSessionProductVariant deletes variant', async () => {
    vi.mocked(db.deleteSessionProductVariant).mockResolvedValue({ id: 1 } as any);
    const result = await db.deleteSessionProductVariant(1);
    expect(result).toEqual({ id: 1 });
  });
});

describe('Live Selling Center', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getSellableProducts returns filtered products', async () => {
    const mockProducts = {
      products: [{ id: 1, keyword: 'MP1', remaining: 5, sellingStatus: 'available' }],
      variants: [{ id: 1, keyword: 'MP1+1', remaining: 3, sellingStatus: 'available' }],
    };
    vi.mocked(db.getSellableProducts).mockResolvedValue(mockProducts as any);
    const result = await db.getSellableProducts(1);
    expect(result).toEqual(mockProducts);
  });

  it('getLiveDashboardStats returns stats with alerts', async () => {
    const mockStats = {
      orderStats: { orderCount: 5, customerCount: 3, itemCount: 10, totalAmount: 200, pending: 2, paid: 3 },
      outOfStockAlerts: { products: [], variants: [] },
      preorderAlerts: [],
      pendingActionCount: 1,
    };
    vi.mocked(db.getLiveDashboardStats).mockResolvedValue(mockStats as any);
    const result = await db.getLiveDashboardStats(1);
    expect(result).toEqual(mockStats);
    expect(result?.outOfStockAlerts.products).toEqual([]);
  });
});
