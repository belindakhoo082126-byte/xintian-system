# V2.1.30补充2 - Column Name Investigation

## Problem
All report SQL uses snake_case column names (e.g. `physical_subtotal`, `created_at`, `product_id`)
but TiDB columns are camelCase (e.g. `physicalSubtotal`, `createdAt`, `productId`).

## Actual DB Column Names (TiDB - camelCase)

### orders table (93 columns)
- orderNumber, customerId, facebookName, facebookId, messengerId
- orderType, physicalSubtotal, membershipSubtotal, shippingFee, totalAmount
- paidAmount, overpaidAmount, refundedAmount, physicalStatus, membershipStatus
- shippingAddress, shippingMethod, courierCompany, trackingNumber
- createdAt (NOT created_at)

### order_items table
- id, orderId, productId, productName, productType, quantity, unitPrice, subtotal
- variationId, variantId, variationName, createdAt, productSku, facebookKeyword
- discount, unitWeight, itemSource, salesMode, priceType, unitCost, originalUnitPrice

### customers table
- id, facebookId, facebookName, messengerId, name, phoneNumber, email
- address, city, state, postalCode, country, shopLinkIdentifier
- totalOrders, totalSpent, membershipLevel, pointsBalance, isBlacklisted

### inventory_adjustments table
- id, productId, adjustmentType, quantityChange, unitCost, totalCost
- orderExceptionId, adjustedBy, reason, remark, createdAt

### inventory_ledger table (STILL snake_case!)
- id, product_id, variant_id, lot_id, transaction_type, reference_type, reference_id
- quantity_change, balance_after, unit_cost, created_by, created_at

### inventory_lots table (STILL snake_case!)
- id, lot_no, purchase_order_id, supplier_id, product_id, variant_id
- original_quantity, remaining_quantity, unit_cost, purchase_date, status, created_at

### customer_refunds table
- id, customerId, orderId, amount, refundMethod, reason
- operatorId, operatorName, refundDate, createdAt

### shipments table
- id, orderId, providerKey, courier, providerOrderId, trackingNumber
- consignmentNoteUrl, actualWeight, shippingCost, status, rawResponse
- createdAt, checkedOutAt, shippedAt, deliveredAt, updatedAt

### order_exceptions table
- id, orderId, orderItemId, exceptionType, resolutionType, status, scrapCost
- refundAmount, description, createdBy, resolvedBy, createdAt, updatedAt, resolvedAt
- quantity, customerAction, replacementProductId, replacementProductName
- replacementQuantity, replacementUnitPrice, refundMethod

### products table
- id, name, type, description, coverImageUrl, images, cost, regularPrice
- memberPrice, originalPrice, specialPrice, weightKg, stockQuantity
- categoryId, status, sellingPrice, createdAt, updatedAt

### categories table
- id, nameZh, nameEn, descZh, descEn, status, showInStore, sortOrder
- imageUrl, iconUrl, createdAt, updatedAt

### purchase_orders table
- id, poNumber, supplierId, totalAmount, status, notes, orderedAt, receivedAt
- createdAt, updatedAt, purchase_order_no, supplier_document_no, purchase_date
- total_quantity, remark, confirmed_at, confirmed_by, created_by

## Summary of snake_case → camelCase fixes needed in report SQL:

### Tables that use camelCase (need fixing in SQL):
- orders: created_at→createdAt, physical_subtotal→physicalSubtotal, shipping_fee→shippingFee
  physical_status→physicalStatus, order_type→orderType, total_amount→totalAmount
  paid_amount→paidAmount, customer_id→customerId, facebook_name→facebookName
- order_items: product_id→productId, order_id→orderId, variation_id→variationId
- customer_refunds: refund_date→refundDate, created_at→createdAt
  customer_id→customerId, order_id→orderId, facebook_name→facebookName
- inventory_adjustments: product_id→productId, adjustment_type→adjustmentType
  quantity_change→quantityChange, total_cost→totalCost, unit_cost→unitCost
  order_exception_id→orderExceptionId, created_at→createdAt
- shipments: shipping_cost→shippingCost, created_at→createdAt
- order_exceptions: scrap_cost→scrapCost, created_at→createdAt, status (ok)
- products: stock_quantity→stockQuantity, category_id→categoryId
- categories: name_zh→nameZh

### Tables that STILL use snake_case (OK as-is):
- inventory_ledger: product_id, quantity_change, unit_cost, transaction_type, created_at
- inventory_lots: product_id, remaining_quantity, unit_cost, purchase_order_id

## Files to fix:
1. server/db.ts - all report SQL functions (getSalesReport, getProductSalesReport, getCustomerReport, getProfitAnalysisReport, getLossAnalysisReport, etc.)
2. server/db.ts - getInventoryAdjustments (uses Drizzle ORM, should be OK)
3. client/src/pages/InventoryLog.tsx - check if data display is correct

## Issue 1: Inventory log empty
- inventory_adjustments table has 0 rows (no data)
- This is because resolveOrderException may not be creating inventory_adjustments records
- Need to check if createInventoryAdjustment is called during exception resolution

## Issue 2: All reports show 0
- All report SQL uses snake_case column names but TiDB uses camelCase
- Need to fix ALL snake_case column references to camelCase in report SQL
