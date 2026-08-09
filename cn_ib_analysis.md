# CN/IB System Analysis - Existing Code

## Existing Schema (drizzle/schema.ts)

### importBatches table (line 1711)
- batchNumber (CN-2026-08-01 format)
- batchName, sourceCountry, supplierName
- liveRoomId, preorderStartDate, preorderEndDate
- actualPurchaseDate, shippingMethod (air/sea)
- chinaShippingCost, status enum
- status: in_progress | closed | purchased | preparing | in_transit | partial_arrived | all_arrived | completed

### importBatchItems table (line 1757)
- batchId, productId, productName
- variantId, variantName
- paidQuantity (auto-calculated from paid orders)
- finalPurchaseQuantity (admin adjustable)
- actualReceivedQty, healthyQty, damagedQty, deadQty, missingQty
- itemStatus: pending | all_arrived | partial_arrived | shortage | damaged | dead | missing
- unitPurchaseCost, allocatedShippingCost, totalUnitCost
- spotSaleEnabled, spotSaleQty

### orders table - import fields (line 597)
- orderCategory: local | import
- importBatchId (linked to importBatches)
- importStatus enum: waiting_payment | paid_waiting_close | waiting_purchase | purchased | supplier_preparing | in_transit | arriving_inspection | ready_to_ship | shipped | completed
- liveRoomId

### purchaseOrders table (line 372) - Legacy
- poNumber, supplierId, totalAmount, status: draft | ordered | received | cancelled

## Existing DB Functions (server/db.ts)
- getImportBatches, getImportBatchById, createImportBatch, updateImportBatch, deleteImportBatch
- getImportBatchItems, upsertImportBatchItem, deleteImportBatchItem
- allocateShippingCost (allocates china shipping to items)
- getImportPreorderStats (dashboard stats)
- getImportPreorderProfitAnalysis (profit analysis)
- createPurchaseOrder, receivePurchaseOrder (legacy)

## Existing Frontend (client/src/pages/ImportBatches.tsx - 484 lines)
- Tab-based: CN tab (purchasing phase) + IB tab (arrival phase)
- CN statuses: in_progress, closed, purchased
- IB statuses: preparing, in_transit, partial_arrived, all_arrived, completed
- Has batch detail view with items

## Required Changes (per user spec)

### 1. XTC Status (replace importStatus enum)
New values: pending | receipt_uploaded | partial_payment | waiting_stock | ready_to_ship | scheduled_ship | partial_shipped | shipped | completed | cancelled
- Remove: waiting_payment, paid_waiting_close, waiting_purchase, purchased, supplier_preparing, in_transit, arriving_inspection

### 2. CN = China Purchase Order (rename/repurpose importBatches)
- CN numbering: CN00001, CN00002...
- Fields needed: supplierName, supplierOrderNumber, trackingNumber, chinaShippingCost, otherFees, totalCost
- Show customer demand quantity (from XTC orders)
- Status: draft | ordered (confirmed) → auto-generates IB

### 3. IB = Arrival Inspection (rename/repurpose importBatchItems or new table)
- IB numbering: IB00001 (matches CN number)
- Fields: actualReceivedQty, healthyQty, damagedQty, deadQty, missingQty, wrongItemQty
- Difference reason: supplier_short | over_supply | damaged | dead | wrong_item | not_arrived | other
- Only IB actual received qty updates On Hand stock
- Auto-match XTC orders after IB completion

### 4. Auto-match XTC
- After IB verification, check all XTC orders with matching products
- If all items fulfilled → ready_to_ship (or scheduled_ship if has appointment)
- If partial → stay waiting_stock, show progress

### 5. Cost & Profit
- CN: estimated cost (purchase + shipping + other fees)
- IB: actual cost (after verification)
- Calculate: per-unit cost, product profit, XTC order profit, CN batch profit, live session profit
