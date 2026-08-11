# V2.1.30补充2 - 修复计划

## 问题1：存库日志无数据
- inventory_adjustments表有0条记录
- 需要检查resolveOrderException是否正确调用createInventoryAdjustment
- 需要确保发货、异常处理等操作都记录到inventory_adjustments

## 问题2：所有报告数据为0
- 根因：报告SQL使用snake_case列名，但TiDB列名是camelCase
- 需要修复的函数（行号approximate）：
  1. getSalesReport (3756-3798)
  2. getTopProductsByQuantity (3852-3867)
  3. getTopProductsBySales (3884-3896)
  4. getProductProfitability (3918-3936)
  5. getCustomerRanking (3960-3971)
  6. getSalesDetailReport (3999-4024)
  7. getProductStockReport (4050-4067)
  8. getCustomerDetailReport (4086-4100)
  9. getInventoryValuation (4131-4160)
  10. getCustomerRefundReport (4198-4225)
  11. getStockMovementReport/getProfitLossReport (7831-7973)
  12. getSalesDetailList (8700-8765)

## Table column name reference:
- orders: camelCase (physicalSubtotal, paidAmount, totalAmount, physicalStatus, shippingFee, createdAt, orderType, customerId)
- order_items: camelCase (productId, productName, variationName, variationId, productType, orderId, quantity, subtotal)
- customers: camelCase (id, facebookId, facebookName, etc. NO customerId column, use id)
- customer_refunds: camelCase (customerId, orderId, refundDate, createdAt, amount, refundMethod, reason)
- inventory_adjustments: camelCase (productId, adjustmentType, quantityChange, unitCost, totalCost, orderExceptionId, adjustedBy, reason, remark, createdAt)
- inventory_lots: snake_case (lot_no, purchase_order_id, supplier_id, product_id, variant_id, original_quantity, remaining_quantity, unit_cost, purchase_date, status, created_at)
- inventory_ledger: snake_case (product_id, variant_id, lot_id, transaction_type, reference_type, reference_id, quantity_change, balance_after, unit_cost, created_by, created_at)
- products: camelCase (name, type, cost, regularPrice, etc.)
