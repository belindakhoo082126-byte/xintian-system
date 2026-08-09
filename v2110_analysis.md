# V2.1.10 Analysis - Remarks Display + Activity Log Structuring

## Root Cause 1: Remarks not showing in Preview/Export/Print

### Finding
- OrderBrowsePage fetches remarks via `trpc.orderRemarks.list.useQuery({ orderId })` (line 304)
- Remarks are passed to OrderDocument in handleExportImage (line 160), handlePrint (line 264), and Preview dialog (line 887)
- OrderDocument filters remarks: `visibleRemarks = isAdmin ? (remarks || []) : (remarks || []).filter((r) => r.type !== "internal" && r.type !== "live")` (line 92)
- **Problem**: OrderEditPage creates remarks with default `type: "internal"` (line 88), so they are filtered out in customer variant
- OrderDetail creates remarks with `type: remarkType` where remarkType defaults to "live" (also filtered out)

### Fix Plan
1. Change OrderEditPage default remark type from "internal" to "customer"
2. Change OrderDocument customer variant to only filter "internal" (not "live")
3. Ensure OrderCreatePage also uses "customer" type for remarks

## Root Cause 2: Activity Log only has generic descriptions

### Finding
- `logOrderOperation` in db.ts only saves: orderId, actorName, action, timestamp
- `action` field is a simple string like "Order updated by Admin"
- No structured fields for actionType, fieldName, oldValue, newValue

### Fix Plan
1. Add structured fields to orderOperationLogs schema: actionType, fieldName, oldValue, newValue, itemId, reason, metadata
2. Modify logOrderOperation to accept these fields
3. Update all callers to pass specific action details:
   - updateOrderDetails: compare old vs new values, log each changed field
   - updateOrderItems: log added/removed/modified items
   - transitionOrderStatus: log old and new status
   - addOrderPayment: log payment amount and method

## Key Files
- server/db.ts: getOrderRemarks (6138), logOrderOperation (~5198), updateOrderDetails (~1040), updateOrderItems, transitionOrderStatus (~3829)
- server/routers.ts: orderRemarks router (3841), orders.getDetail (1343), orders.updateDetails (~1194)
- client/src/components/OrderDocument.tsx: visibleRemarks filter (line 92), remarks rendering (418-470)
- client/src/pages/OrderBrowsePage.tsx: remarks fetch (304), handleExportImage (111), handlePrint (264), preview dialog (887)
- client/src/pages/OrderEditPage.tsx: remarkForm default type "internal" (line 88)
- client/src/pages/OrderDetail.tsx: remarkType default, createRemarkMutation (638)
- drizzle/schema.ts: orderRemarks table, orderOperationLogs table
