# V2.1.30 Investigation Findings & Status

## Problem 1: Dashboard over_payment count shows 3 instead of 2
- **Status**: FIXED in db.ts
- **Fix**: Added JOIN to orders table and filter `o.physicalStatus NOT IN ('shipped', 'completed', 'cancelled')` in the ssRows query of getSpecialOrderFollowUpStats

## Problem 2: Exception save shows garbled text + duplicate records
- **Status**: FIXED in db.ts
- **Fix**: Changed createOrderException from `$returningId()` to `(inserted as any).insertId` with fallback query
- **Root cause**: Drizzle MySQL `$returningId()` returns NaN for the id, causing subsequent select to fail

## Problem 3: Replacement product quantity not synced (Mon should be 4 after replacing 1)
- **Status**: Should be fixed by Problem 2 fix (NaN was preventing resolve from running)
- **Logic in resolveOrderException**: Lines 7566-7619 - reduces original item qty, adds replacement item, deducts stock
- **Need to verify**: The save handler at line 728-758 calls createException then resolveException with `created.id`
- **If created.id was NaN**, resolve would fail silently, so the replacement never happened
- **After fix**: createOrderException now returns proper id, so resolve should work

## Problem 4-6: Courier display logic in PackingDetail.tsx
- **Status**: NOT YET FIXED
- **Current code**: 
  - COURIERS array (line 18-28): has Parcel Daily, Parcel King, PosLaju, JNT, Ninja Van, DHL, Lalamove, Shopee Xpress, Other
  - Shipping type (line 1131-1143): manual, auto, parcelking
  - No auto-selection based on order's shippingMethod
- **Required changes**:
  - Issue 4: Only show Poslaju and Line Clear as courier options (remove others)
  - Issue 5: If order shippingMethod is lalamove, auto-set courier to "Lalamove" and hide courier selector
  - Issue 6: If order shippingMethod is east_malaysia_shopee, auto-set courier to "Shopee Xpress" and hide courier selector
  - Remove Parcel King from shipping type options (keep only manual and auto)
  - Remove Parcel King services query and mutation
  - Auto-set courier based on shippingMethod:
    - west_malaysia → "Line Clear" (Parcel Daily)
    - east_malaysia_poslaju → "Poslaju" (Parcel Daily)
    - lalamove → "Lalamove" (fixed, no choice)
    - east_malaysia_shopee → "Shopee Xpress" (fixed, no choice)
- **Key files**: PackingDetail.tsx lines 18-28 (COURIERS), 61-67 (packages state), 92-110 (ParcelKing mutations), 1108-1201 (shipping form UI)

## Changes Applied (in git diff)
- server/db.ts: createOrderException fix (insertId) + getSpecialOrderFollowUpStats fix (JOIN filter)
- todo.md: V2.1.30 items added

## Changes Still Needed
- PackingDetail.tsx: Issues 4-6 (courier display logic)
- Verify Problem 3 is fixed by Problem 2 fix
