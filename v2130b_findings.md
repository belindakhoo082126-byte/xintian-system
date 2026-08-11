# V2.1.30补充2 - 调查发现

## 问题1：存库日志无数据
- `inventory_adjustments` 表有0条记录
- `inventory_lots` 表有0条记录
- 表使用camelCase列名：productId, adjustmentType, quantityChange, unitCost, totalCost, orderExceptionId, adjustedBy, reason, remark, createdAt
- `inventory_lots` 表使用snake_case列名：lot_no, purchase_order_id, supplier_id, product_id, variant_id, original_quantity, remaining_quantity, unit_cost, purchase_date, status, created_at
- 存库日志页面是InventoryLog.tsx，显示inventory_adjustments数据
- 没有数据是因为从未创建过inventory adjustment记录（resolveOrderException等函数可能没有正确调用createInventoryAdjustment）

## 问题2：所有报告数据为0
- orders表有37条记录，order_items有70条记录
- **根因：所有报告SQL查询使用snake_case列名，但TiDB实际列名是camelCase**
- 例如：`o.physical_subtotal` 应该是 `o.physicalSubtotal`
- `o.paid_amount` 应该是 `o.paidAmount`
- `o.total_amount` 应该是 `o.totalAmount`
- `o.physical_status` 应该是 `o.physicalStatus`
- `o.created_at` 应该是 `o.createdAt`
- `o.shipping_fee` 应该是 `o.shippingFee`
- `o.order_type` 应该是 `o.orderType`
- `oi.product_id` 应该是 `oi.productId`
- `oi.product_name` 应该是 `oi.productName`
- `oi.variation_name` 应该是 `oi.variationName`
- `oi.variation_id` 应该是 `oi.variationId`
- `oi.order_id` 应该是 `oi.orderId`
- `oi.product_type` 应该是 `oi.productType`
- `oi.subtotal` 保持不变（已经是小写）
- `oi.quantity` 保持不变
- `c.customer_id` 应该是 `c.customerId`（但customers表没有customerId字段，用id）
- `o.customer_id` 应该是 `o.customerId`
- `il.product_id` 应该是 `il.productId`（inventory_lots表用snake_case）
- `il.quantity_change` - inventory_lots没有此字段
- `il.unit_cost` - inventory_lots用snake_case
- `il.created_at` - inventory_lots用snake_case
- `ia.product_id` 应该是 `ia.productId`（inventory_adjustments用camelCase）
- `ia.adjustment_type` 应该是 `ia.adjustmentType`
- `ia.quantity_change` 应该是 `ia.quantityChange`
- `ia.created_at` 应该是 `ia.createdAt`
- `cr.order_id` - 需要检查customer_refunds表列名
- `cr.created_at` - 需要检查customer_refunds表列名
- `cr.customer_id` - 需要检查customer_refunds表列名

## 需要修复的函数（在db.ts中）：
1. getSalesReport (line ~3750) - revenue, refund, orderStats, fifo查询
2. getTopProductsByQuantity (line ~3847) - product sales by quantity
3. getTopProductsBySales (line ~3880) - product sales by revenue
4. getProductProfitability (line ~3915) - profit analysis with FIFO cost
5. getCustomerRanking (line ~3955) - customer ranking
6. getInventoryValuation (line ~4130) - inventory valuation
7. getStockMovementReport (line ~7900) - stock movement/loss report
8. getSalesDetailReport (line ~8700) - sales detail report
9. getCustomerRefundReport (line ~4190) - customer refund report

## inventory_lots表特殊说明：
- inventory_lots表使用snake_case列名（lot_no, purchase_order_id, product_id等）
- 这与其他表不同（orders, order_items, inventory_adjustments用camelCase）
- 所以查询inventory_lots时保持snake_case

## customer_refunds表需要检查列名
