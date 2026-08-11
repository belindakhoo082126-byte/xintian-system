# Column Name Mapping for db.ts Report Fixes

## camelCase tables (must use camelCase in SQL):
- orders: physicalSubtotal, paidAmount, totalAmount, physicalStatus, shippingFee, createdAt, orderType, customerId
- order_items: productId, productName, variationName, variationId, productType, orderId, quantity, subtotal
- customers: id (no customer_id column)
- customer_refunds: customerId, orderId, refundMethod, refundDate, createdAt, amount, reason
- inventory_adjustments: productId, adjustmentType, quantityChange, unitCost, totalCost, orderExceptionId, adjustedBy, reason, remark, createdAt
- products: name, type, cost, regularPrice, sellingPrice

## snake_case tables (keep snake_case in SQL):
- inventory_lots: lot_no, purchase_order_id, supplier_id, product_id, variant_id, original_quantity, remaining_quantity, unit_cost, purchase_date, status, created_at
- inventory_ledger: product_id, variant_id, lot_id, transaction_type, reference_type, reference_id, quantity_change, balance_after, unit_cost, created_by, created_at

## Functions to fix (line numbers approximate):
1. getSalesReport (~3756-3798)
2. getTopProductsByQuantity (~3852-3867)
3. getTopProductsBySales (~3884-3896)
4. getProductProfitability (~3918-3936)
5. getCustomerRanking (~3960-3971)
6. getSalesDetailReport (~3999-4026)
7. getProductStockReport (~4040-4067)
8. getCustomerDetailReport (~4086-4100)
9. getInventoryValuation (~4131-4160)
10. getCustomerRefundReport (~4198-4225)
11. getStockMovementReport/getProfitLossReport (~7831-7973)
12. getSalesDetailList (~8700-8765)
13. getBusinessOverview (~8760-8900)
