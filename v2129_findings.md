# V2.1.29 Investigation Findings

## Problem 1: AI Smart Removal - DONE
- Removed AI Smart state, handleSmartPaste function, UI section, and unused imports from OrderCreatePage.tsx
- Manual address fields already exist (addressLine1, addressLine2, city, state, postcode)

## Problem 2: Customer Address Auto-Sync - DONE
- createOrderWithSplit: Added addressLine1/addressLine2/postcode to orders insert, changed address sync to ALWAYS update customer profile (not just when empty)
- mallCheckout: Added addressLine1/addressLine2/postcode to orders insert, added address sync to customer profile
- createOrderFromLiveCapture: Added customer's existing address fields (addressLine1, addressLine2, city, state, postcode) to order insert

## Problem 3: Dashboard Over-Payment Count - IN PROGRESS
- order_special_statuses table: 1 pending over_payment (orderId 870001, but this order has specialOrderType='pending_shipping' in orders table - stale data)
- orders table: 2 pending over_payment (XT00018 id=480001, XT00021 id=570001)
- Current code only counts 1 from order_special_statuses, skips legacy count because typeCounts already has 'over_payment'
- User says correct count is 2
- Fix: Use orders table as primary source, only add from order_special_statuses for orders that don't have isSpecialOrder=1 with specialOrderType set

## Problem 4: Stock Alert 404 - DONE
- Dashboard link was /products-v2?stock=low but route is /products (not /products-v2)
- Fixed to /products?stock=low
- ProductsV2.tsx already handles ?stock=low query param via useSearch

## Problem 5: Inventory Log Error - NOT YET FIXED
- Screenshot shows React error: "A <Select.Item /> must have a value prop that is not an empty string"
- InventoryLog.tsx line 161: `<SelectItem value="">{translate("全部", "All")}</SelectItem>` - empty string value causes crash
- Fix: Change empty string to a non-empty value like "all" and handle it in the filter logic
