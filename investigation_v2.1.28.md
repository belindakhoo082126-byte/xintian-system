# V2.1.28 Investigation Notes

## Issue 5+6+7+8: Shipping API Changes

### Current State:
- `processEastMalaysiaPosLajuWeight` already uses ParcelDaily API (from previous edit)
- Origin: "11700" (Gelugor, Penang) ✅
- Gets `poslajuPrice` from ParcelDaily quote response ✅
- Adds RM5 handling fee ✅

### West Malaysia (processActualWeight):
- Currently uses `calculateNormalShippingFee` (manual formula, NOT API)
- Need to add ParcelDaily Line Clear API call for west_malaysia
- ParcelDaily response has `lineclearPrice` field (accessed via `(s as any).lineclearPrice`)

### What needs to be done:
1. **Issue 5**: East Malaysia Poslaju - already using ParcelDaily, but need to verify it works
2. **Issue 6**: Stop using ParcelKing entirely - check if ParcelKing is still called anywhere
3. **Issue 7**: West Malaysia should use ParcelDaily Line Clear
4. **Issue 8**: East Malaysia should use ParcelDaily Poslaju (already done)

### For West Malaysia Line Clear:
- Need to create a new function or modify `processActualWeight` to call ParcelDaily API
- Use `lineclearPrice` from ParcelDaily response
- Origin: "11700" (Penang), Destination: customer postcode

### routers.ts updateActualWeight procedure (line 4470-4481):
- East Malaysia: calls `processEastMalaysiaPosLajuWeight` ✅
- West Malaysia: calls `processActualWeight` (manual formula) - needs to be changed to use ParcelDaily Line Clear

### resolveOrderException (Issues 3+4):
- Already has logic for replace_product and refund
- Need to verify orderId is passed correctly
- routers.ts resolve procedure passes orderId ✅ (fixed in previous edit)

### Issue 1 (A5 duplicate remarks):
- Already fixed - removed old remarks section, kept only customerRemark/adminRemarks

### Issue 2 (replacement product price 0):
- Already fixed - using sellingPrice instead of price field
