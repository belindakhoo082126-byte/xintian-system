# Bug Analysis - 3 Issues

## Bug 1: Discount becomes 0 after save
**Root Cause**: Race condition in OrderEditPage.tsx handleSave()
- When `itemsModified` is true, `updateItemsMutation.mutateAsync()` runs first
- Its `onSuccess` calls `utils.orders.invalidate()` which triggers getDetail refetch
- getDetail returns old data from DB (with old discountAmount=0)
- useEffect at line 96 detects `order` change and resets `formData` with old values
- Then `updateDetailsMutation.mutate()` runs with the RESET formData (discountAmount=0)
- Fix: Remove `utils.orders.invalidate()` from updateItems onSuccess

## Bug 2: Operation log shows "改状态" when user only modified discount
**Root Cause**: formData always includes `physicalStatus` (line 103)
- `...formData` spreads it to updateDetails payload
- db.ts line 1054: `const desc = data.physicalStatus ? "Order details updated, status → ..." : "Order details updated by admin"`
- Since physicalStatus is always sent, it always logs as status change
- Fix: Only log status change if physicalStatus actually changed from current value
- Also: Remove duplicate logOrderOperation call (one in db.ts, one in routers.ts)

## Bug 3: Customer checkout page Online Transfer shows QR image instead of bank details
- Need to check CustomerPayment.tsx for Online Transfer display
- Should show: Bank name (Public Bank), Account number (3825375502), Account name (ECOLAND NURSERY)
- With copy buttons for account number and name
