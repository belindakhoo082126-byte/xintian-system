# XTC Status 系统统一排查结果 (V2.0.99 验证)

## 已确认正确的位置

1. **schema.ts importStatus enum** ✅ - 10个状态值正确
2. **Orders.tsx IMPORT_STATUS** ✅ - 10个状态+颜色正确
3. **OrderCreatePage.tsx IMPORT_ORDER_STATUSES** ✅ - 10个状态正确
4. **OrderDetail.tsx IMPORT_STATUS_CONFIG_RAW** ✅ - 10个状态正确
5. **OrderEditPage.tsx importStatus dropdown** ✅ - 10个状态正确
6. **db.ts createOrderWithSplit** ✅ - import订单默认 importStatus="pending"
7. **db.ts addOrderPayment** ✅ - importStatus自动转换(waiting_stock/partial_payment/receipt_uploaded)
8. **db.ts updateOrderStatus** ✅ - importStatus mapping正确
9. **db.ts autoMatchXtcOrders** ✅ - 齐货→ready_to_ship, 缺货→waiting_stock (但缺少scheduled_ship处理)
10. **db.ts allocateStockByPriority** ✅ - 同上 (但缺少scheduled_ship处理)

## 发现的问题

### 问题1: OrderBrowsePage.tsx 不支持import订单的importStatus
- 只使用 `STATUS_CONFIG[o.physicalStatus]` 显示状态
- import订单应使用 `IMPORT_STATUS_CONFIG[o.importStatus]` 显示XTC状态
- **需要修复**: 添加IMPORT_STATUS_CONFIG，import订单使用importStatus

### 问题2: OrderDocument.tsx 不支持import订单的importStatus
- 只使用 `STATUS_LABELS[o.physicalStatus]` 显示状态
- import订单应使用import status labels
- **需要修复**: 添加import status labels，import订单使用importStatus

### 问题3: OrderDetail.tsx 状态转换对话框不区分import订单
- 手动变更状态时只使用 `STATUS_CONFIG_RAW`（本地状态）
- import订单应使用 `IMPORT_STATUS_CONFIG_RAW`
- **需要修复**: 根据isImportOrder选择正确的status config

### 问题4: transitionOrderStatus() 不处理import订单
- 只更新 `physicalStatus`，不更新 `importStatus`
- **需要修复**: 检查orderCategory，import订单同时更新importStatus

### 问题5: getCustomerOrderTracking() 不返回import订单信息
- 不返回 `importStatus` 和 `orderCategory`
- 客户追踪页面无法区分import订单
- **需要修复**: 返回importStatus和orderCategory，添加import status映射

### 问题6: 订单编号前缀使用"CXT"而非"XTC"
- db.ts: `const prefix = data.orderCategory === "import" ? "CXT" : "XT"`
- SystemSettings默认值是"XTC"，但代码硬编码"CXT"
- OrderCreatePage.tsx也显示"CXT"
- **需要修复**: 改为"XTC"

### 问题7: autoMatchXtcOrders/allocateStockByPriority 不处理scheduled_ship
- 齐货后直接设为ready_to_ship
- 如果订单有预约发货日期，应设为scheduled_ship
- **需要修复**: 检查scheduledShippingDate，有日期则设为scheduled_ship

### 问题8: CustomerOrderPage/CustomerOrderTracking 不支持import订单
- 只使用physicalStatus映射到本地状态标签
- **需要修复**: 添加import status支持
