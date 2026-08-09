# XTC Order Routing & Merge Analysis

## Key Findings (2026-08-09)

### 1. Live Room Schema (schema.ts line 1535)
- `liveType` enum: `["normal", "import_preorder"]` — exists in schema
- `importBatchId` field exists for linking to import batch
- Live rooms CAN be set as import_preorder type

### 2. Auto Order Creation from Live Comments (messenger.ts)
- When Facebook comment has keywords (e.g. "ABS+2"), system matches to live room products
- `createOrderFromLiveCapture()` is called (db.ts line 5610)
- **CRITICAL BUG**: This function does NOT receive `liveRoomId` or `liveType` from the caller
- The function always creates orders with:
  - `orderSource: "facebook_live"`
  - `orderCategory`: NOT SET (defaults to "local" via schema default)
  - `orderNumber`: Always uses "XT" prefix (line 5732: `generateOrderNumber("XT")`)
  - `importStatus`: NOT SET (should be "pending" for import orders)
- The merge logic (line 5665) does NOT filter by `orderCategory`:
  ```sql
  WHERE customerId = X AND orderSource = 'facebook_live' AND physicalStatus NOT IN ('closed', 'cancelled', 'completed')
  ```
  This means a local live order and an import live order from the same customer CAN be merged together!

### 3. createOrderWithSplit (db.ts line 718)
- This function DOES support `orderCategory` parameter
- When `orderCategory === "import"`: uses "XTC" prefix, sets `importStatus: "pending"`
- When `orderCategory === "local"` (default): uses "XT" prefix, `importStatus: null`
- **But this function is only used for Admin manual order creation, NOT for live auto-capture**

### 4. mallCheckout (db.ts line 4136)
- Does NOT pass `orderCategory` — always creates local orders
- Merge logic (`getMergeableHoldOrderById`) does NOT check `orderCategory`
- Mall orders are always local — this is correct behavior

### 5. Messenger Private Chat Auto Order (db.ts line 11780)
- Calls `createOrderFromLiveCapture` without `liveRoomId` or `liveType`
- Same issue as live comment capture

### 6. Customer Detail Page
- Need to check if customer detail page separates local vs import orders

## Issues to Fix

### Issue A: Live auto-capture does not pass liveType/orderCategory
- **File**: `server/messenger.ts` line ~960 — `createOrderFromLiveCapture` call
- **File**: `server/db.ts` line 5610 — `createOrderFromLiveCapture` function
- **Fix**: Pass `liveRoomId` and `liveType` from messenger.ts to createOrderFromLiveCapture
- **Fix**: In createOrderFromLiveCapture, set `orderCategory` based on `liveType`
- **Fix**: Use "XTC" prefix when `liveType === "import_preorder"`
- **Fix**: Set `importStatus: "pending"` when import order

### Issue B: Merge logic does not check orderCategory
- **File**: `server/db.ts` line 5665 — live order merge query
- **Fix**: Add `AND orderCategory = 'local'` or `AND orderCategory = 'import'` to merge query
- **Fix**: Only merge orders of the same category

### Issue C: createOrderFromLiveCapture always uses XT prefix
- **File**: `server/db.ts` line 5732
- **Fix**: Use "XTC" prefix when `liveType === "import_preorder"`

### Issue D: createOrderFromLiveCapture does not set importStatus
- **File**: `server/db.ts` line 5735
- **Fix**: Set `importStatus: "pending"` when import order

### Issue E: createOrderFromLiveCapture does not set liveRoomId
- **File**: `server/db.ts` line 5735
- **Fix**: Save `liveRoomId` to order record

### Issue F: Messenger private chat auto order also needs liveType
- **File**: `server/db.ts` line 11837
- **Fix**: Pass `liveRoomId` and `liveType` through
