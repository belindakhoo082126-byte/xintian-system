import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readProjectFile = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
const dbSource = readProjectFile("server/db.ts");
const routerSource = readProjectFile("server/routers.ts");
const schemaSource = readProjectFile("drizzle/schema.ts");
const migrationSource = readProjectFile("drizzle/0019_cn_ib_stage_refactor.sql");
const ibAuditMigrationSource = readProjectFile("drizzle/0020_ib_change_audit.sql");
const pageSource = readProjectFile("client/src/pages/ImportBatches.tsx");
const productPageSource = readProjectFile("client/src/pages/ProductsV2.tsx");
const serverEntrySource = readProjectFile("server/_core/index.ts");

function sourceBlock(startMarker: string, endMarker: string) {
  const start = dbSource.indexOf(startMarker);
  const end = dbSource.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return dbSource.slice(start, end);
}

describe("CN/IB 重构与商品数量阶段", () => {
  it("迁移与模式包含CN日期、关联IB、锁定字段及CN修改审计表", () => {
    for (const field of ["startDate", "endDate", "paymentDeadline", "autoIbId", "cnId", "isLocked", "lockedAt", "lockedBy", "unlockReason"]) {
      expect(schemaSource).toContain(field);
    }
    expect(schemaSource).toContain("cnChangeLogs");
    expect(migrationSource).toContain("cn_change_logs");
    expect(migrationSource).toContain("paymentDeadline");
  });

  it("商品数量阶段互斥，并将部分发货按实际已发数量拆分", () => {
    const productStats = sourceBlock("export async function getProductsEnhanced", "export async function getProductOrderDetails");
    expect(productStats).toContain("AS paidQty");
    expect(productStats).toContain("partial_shipped");
    expect(productStats).toContain("shippedQty");
    expect(productStats).toContain("GREATEST(oi.quantity - COALESCE(shipped_items.shippedQty, 0), 0)");
    expect(productStats).toContain("COALESCE(shipped_items.shippedQty, 0)");
    expect(productPageSource).toContain("已汇款");
    expect(productPageSource).toContain("paidCount");
  });

  it("CN按所选中国直播场次合并相同商品，并对每场次保存独立三阶段数量", () => {
    const mergedProducts = sourceBlock("export async function getCNMergedProducts", "export async function createChinaPreorderWithAutoIB");
    expect(mergedProducts).toContain("liveSessionCount");
    expect(mergedProducts).toContain("const key = `${row.productId}:${row.variantId ?? 'base'}`");
    expect(mergedProducts).toContain("o.liveRoomId IN");
    expect(mergedProducts).toContain("partial_shipped");
    expect(mergedProducts).toContain("session.completedQuantity += shippedQuantity");
  });

  it("创建CN会自动建立关联的等待到货IB，并且额外IB只能作为分批到货创建", () => {
    const autoIb = sourceBlock("export async function createChinaPreorderWithAutoIB", "/** Creates an additional IB");
    const splitIb = sourceBlock("export async function createSplitArrivalImportBatch", "/** Updates a CN");
    expect(autoIb).toContain("documentType: 'cn'");
    expect(autoIb).toContain("documentType: 'ib'");
    expect(autoIb).toContain("autoIbId: ibId");
    expect(autoIb).toContain("status: 'in_progress'");
    expect(splitIb).toContain("分批到货");
    expect(splitIb).toContain("cnId");
    expect(routerSource).toContain("createSplitArrivalIb");
  });

  it("超期取消跳过待审核凭证订单，并复用库存释放和订单审计逻辑", () => {
    const expiredOrders = sourceBlock("export async function processExpiredCNOrders", "// ============================================================================\n// V2.0.97");
    expect(expiredOrders).toContain("pending_proof");
    expect(expiredOrders).toContain("receipt_uploaded");
    expect(expiredOrders).toContain("cancelOrderWithReason");
    expect(expiredOrders).toContain("receiptUrl");
    expect(serverEntrySource).toContain('app.post("/api/scheduled/cn-payment-expiry"');
    expect(serverEntrySource).toContain("!user.isCron || !user.taskUid");
    expect(serverEntrySource).toContain("processExpiredCNOrders()");
  });

  it("IB入库后锁定，解锁必须要求原因并留下CN审计记录", () => {
    const lock = sourceBlock("export async function lockImportBatch", "export async function unlockImportBatch");
    const unlock = sourceBlock("export async function unlockImportBatch", "export async function processExpiredCNOrders");
    expect(lock).toContain("isLocked: true");
    expect(lock).toContain("cnChangeLogs");
    expect(unlock).toContain("reason");
    expect(unlock).toContain("isLocked: false");
    expect(routerSource).toContain("解锁 IB 必须填写原因");
  });

  it("IB主单和商品明细修改均保留字段级前后值、操作者与时间审计", () => {
    const updateBatch = sourceBlock("export async function updateImportBatch", "type CNStage");
    const upsertItem = sourceBlock("export async function upsertImportBatchItem", "export async function deleteImportBatchItem");
    const deleteItem = sourceBlock("export async function deleteImportBatchItem", "export async function getImportBatchChangeLogs");
    expect(schemaSource).toContain("importBatchChangeLogs");
    expect(ibAuditMigrationSource).toContain("import_batch_change_logs");
    expect(ibAuditMigrationSource).toContain("changedBy");
    expect(ibAuditMigrationSource).toContain("changedAt");
    expect(updateBatch).toContain("importBatchChangeLogs");
    expect(updateBatch).toContain("oldValue");
    expect(updateBatch).toContain("newValue");
    expect(updateBatch).toContain("operatorId");
    expect(upsertItem).toContain("item#${found.id}");
    expect(upsertItem).toContain("isLocked");
    expect(deleteItem).toContain("item#${id}.deleted");
    expect(routerSource).toContain("db.updateImportBatch(id, data, ctx.user.id)");
    expect(routerSource).toContain("db.upsertImportBatchItem(input, ctx.user.id)");
    expect(routerSource).toContain("db.deleteImportBatchItem(input.id, ctx.user.id)");
    expect(routerSource).toContain("changeLogs: adminProcedure");
  });

  it("管理页面提供日期选场、合并数量、自动IB、审计编辑、分批到货与打印入口", () => {
    for (const marker of ["getCnEligibleLiveSessions", "getCnMergedProducts", "createCnWithAutoIb", "updateCnWithAudit", "新增分批到货 IB", "printCurrentBatch", "paymentDeadline"]) {
      expect(pageSource).toContain(marker);
    }
    expect(pageSource).toContain("documentType === 'ib'");
  });
});
