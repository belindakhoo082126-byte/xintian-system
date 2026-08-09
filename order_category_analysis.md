# Order Category Analysis - V2.1.04

## Current State (as of 2026-08-09)

### Products Schema
- `products.orderCategory` field added to schema.ts and database (ALTER TABLE already executed)
- Values: "local" | "import" (default "local")
- Frontend product management page NOT yet updated to show orderCategory selector

### resolveOrderCategory Function (db.ts line 722)
- Already implemented with priority: product.orderCategory > existingOrder.orderCategory > liveType
- Returns "local" or "import"

### Order Entry Points Status

#### 1. createOrderWithSplit (db.ts line ~756) - Admin manual order creation
- Already accepts `orderCategory` parameter
- Uses `data.orderCategory === "import" ? "XTC" : "XT"` for prefix
- Sets `importStatus: data.orderCategory === "import" ? "pending" : null`
- **NOT YET using resolveOrderCategory** - relies on caller to pass orderCategory
- **Needs**: Use resolveOrderCategory when orderCategory not explicitly provided

#### 2. createOrderFromLiveCapture (db.ts line ~5648) - Live/Facebook comment auto-order
- Currently uses `data.liveType === 'import_preorder'` to determine orderCategory
- **NOT YET using resolveOrderCategory**
- **Needs**: Use resolveOrderCategory with productIds from matchedProducts + liveType

#### 3. mallCheckout (db.ts line ~4170) - Mall checkout
- Currently hardcodes `generateOrderNumber("XT")` - always creates local orders
- Does NOT set orderCategory at all
- Does NOT set importStatus
- **Needs**: Use resolveOrderCategory with productIds from items

#### 4. executeAutoOrderCapture (db.ts line ~11816) - Messenger private chat auto-order
- Calls createOrderFromLiveCapture, so inherits its orderCategory logic
- **Needs**: Pass productIds to resolveOrderCategory

### Cross-type Prevention
- **NOT YET implemented** - need to add validation in:
  - createOrderWithSplit: check if items' product orderCategory matches data.orderCategory
  - mallCheckout merge: check if items' product orderCategory matches existing order's orderCategory
  - OrderEditPage: check when adding items

### XTC Status Verification (10 statuses)
All confirmed in schema.ts importStatus enum:
1. pending (挂单)
2. receipt_uploaded (待审核付款凭证)
3. partial_payment (部分汇款)
4. waiting_stock (待备货)
5. ready_to_ship (待发货)
6. scheduled_ship (预约发货)
7. partial_shipped (部分发货)
8. shipped (已发货)
9. completed (已完成)
10. cancelled (取消)

### Files Modified So Far
- drizzle/schema.ts: Added products.orderCategory field
- server/db.ts: Added resolveOrderCategory function (line 722)
- Database: ALTER TABLE products ADD COLUMN orderCategory

### Still TODO
1. Modify createOrderFromLiveCapture to use resolveOrderCategory
2. Modify mallCheckout to use resolveOrderCategory
3. Modify createOrderWithSplit to use resolveOrderCategory when not explicitly set
4. Add cross-type prevention validation
5. Add orderCategory selector to product management page
6. Verify XTC Status in all pages (Orders.tsx, OrderDetail.tsx, OrderEditPage.tsx, OrderCreatePage.tsx)
