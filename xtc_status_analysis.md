# XTC Status System Analysis - V2.0.99

## Database Status (Already Correct)
- `importStatus` enum: pending, receipt_uploaded, partial_payment, waiting_stock, ready_to_ship, scheduled_ship, partial_shipped, shipped, completed, cancelled
- `physicalStatus` enum: pending, receipt_uploaded, partial_payment, hold_order, packing, shipped, partial_shipped, completed, cancelled, scheduled, special
- No import orders exist in DB yet (all 21 orders are local)
- No data migration needed

## Problem Summary
The system uses `physicalStatus` for ALL orders. For import (XTC) orders, it should use `importStatus` instead. The `importStatus` field exists in DB but is never read or written by the application code.

## Required Changes

### Backend (server/db.ts)
1. `getOrders()` - When orderCategory=import, filter by importStatus instead of physicalStatus
2. `getOrderById()` - Return importStatus for import orders
3. `createOrderWithSplit()` - Set importStatus='pending' for import orders (currently only sets physicalStatus)
4. `updateOrderStatus()` - Update importStatus for import orders
5. `updateOrderDetails()` - Update importStatus for import orders
6. `addOrderPayment()` - Set importStatus based on payment for import orders
7. `autoMatchXtcOrders()` - Already uses importStatus (V2.0.97/98)

### Backend (server/routers.ts)
1. `orders.list` - Pass importStatus filter for import orders
2. `orders.updateStatus` - Update importStatus for import orders
3. `orders.updateDetails` - Update importStatus for import orders

### Frontend
1. **Orders.tsx** - Add IMPORT_STATUS definition, use importStatus when orderCategory=import
2. **OrderCreatePage.tsx** - Fix IMPORT_ORDER_STATUSES to use correct import values (挂单/待审核/部分汇款/待备货/待发货/预约发货/部分发货/已发货/已完成/取消)
3. **OrderDetail.tsx** - Show import-specific statuses for import orders
4. **OrderEditPage.tsx** - Show import-specific status dropdown for import orders
5. **OrderBrowsePage.tsx** - Show importStatus for import orders
6. **Dashboard.tsx** - Use importStatus for import order stats

## XTC Status Mapping (importStatus)
| Value | Chinese Label | English Label |
|-------|--------------|---------------|
| pending | 挂单 | Pending |
| receipt_uploaded | 待审核付款凭证 | Pending Verification |
| partial_payment | 部分汇款 | Partial Payment |
| waiting_stock | 待备货 | Waiting Stock |
| ready_to_ship | 待发货 | Ready to Ship |
| scheduled_ship | 预约发货 | Scheduled Shipping |
| partial_shipped | 部分发货 | Partial Shipped |
| shipped | 已发货 | Shipped |
| completed | 已完成 | Completed |
| cancelled | 取消 | Cancelled |

## XTC Status Auto-Transition Rules
1. New XTC order → pending (挂单)
2. Upload receipt → receipt_uploaded (待审核付款凭证)
3. Partial payment confirmed → partial_payment (部分汇款)
4. Full payment confirmed → waiting_stock (待备货) + set fullPaymentConfirmedAt
5. IB stock complete → ready_to_ship (待发货) or scheduled_ship (预约发货)
6. Partial ship → partial_shipped (部分发货)
7. Full ship → shipped (已发货)
8. 7 days after ship → completed (已完成)
9. Cancel → cancelled (取消)
