# V2.1.05 Bug Analysis

## Bug 1: XTC Export Image
- OrderBrowsePage and OrderDocument are SHARED between XT and XTC (same route `/orders/browse/:id`)
- OrderDocument correctly handles `isImportOrder = o.orderCategory === "import"` and uses IMPORT_STATUS_LABELS
- Export function `handleExportImage` in OrderBrowsePage is the same for all orders
- Product images come from `products.coverImageUrl` (external Unsplash URLs for some products)
- html2canvas with `useCORS: true` and `allowTaint: true` should handle external images
- **Possible issue**: External Unsplash images may fail CORS in html2canvas, causing export to fail
- **Fix**: Add `crossOrigin: "anonymous"` to product image tags in OrderDocument, and increase wait time for image loading

## Bug 2: Discount Not Saved (ROOT CAUSE FOUND)
- `createOrderWithSplit` in `server/db.ts` line ~862-900: The `db.insert(orders).values({...})` is MISSING `discountAmount`!
- It has `discountReason: data.discountReason || null` but NOT `discountAmount`
- The `discountAmount` IS in the schema (line 545: `decimal("discountAmount", { precision: 10, scale: 2 }).default("0")`)
- The `updateOrderDetails` function DOES save `discountAmount` (line 1072)
- The `updateDetails` procedure in routers.ts DOES accept `discountAmount` (line 1212)
- **Fix**: Add `discountAmount: data.discountAmount || null` to the insert values in createOrderWithSplit

## Bug 3: Online Transfer Shows QR Code (ROOT CAUSE FOUND)
- `CustomerOrderPage.tsx` line 745: Shows unified payment image for ALL payment methods
- Does NOT differentiate `bank_transfer` type from `qr_code` type
- `CustomerPayment.tsx` (admin page) correctly handles this:
  - Shows unified image for ALL methods (line 216)
  - ADDITIONALLY shows bank account details (Public Bank, 3825375502, ECOLAND NURSERY) only for `bank_transfer` type (line 239-270)
- **Fix**: Add bank_transfer specific section in CustomerOrderPage.tsx, matching CustomerPayment.tsx

## Files to modify:
1. `server/db.ts` ~line 893: Add `discountAmount: data.discountAmount || null` to insert values
2. `client/src/pages/CustomerOrderPage.tsx` ~line 745: Add bank_transfer details section
3. `client/src/components/OrderDocument.tsx`: Add `crossOrigin: "anonymous"` to product images
