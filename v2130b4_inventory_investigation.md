# V2.1.30补充4 - 库存逻辑重构调查发现

## 当前问题总结

### 1. createOrderWithSplit (line 838)
- **有**库存检查（V2.1.30补充3添加）：检查 stockQuantity <= 0
- **没有**扣减库存：创建订单后不扣减stockQuantity
- 需要添加：下单即扣减库存

### 2. createOrderFromLiveCapture (line 6622)
- **有**库存检查（V2.1.30补充3添加）：检查 stockQuantity <= 0
- **没有**扣减库存：创建订单后不扣减stockQuantity
- 需要添加：下单即扣减库存（新订单和合并订单都要）

### 3. addMallItemsToOrder (line 5196)
- **有**库存检查（V2.1.30补充3添加）：检查 stockQuantity <= 0
- **有**扣减库存：`stockQuantity: sql`${products.stockQuantity} - ${item.quantity}``
- 已正确实现

### 4. updateOrderItems (line 1220)
- **有**库存同步：
  - 删除商品时恢复库存：`stockQuantity + item.quantity`
  - 修改数量时同步差异：`stockQuantity - qtyDiff`
  - 新增商品时扣减库存：`stockQuantity - ni.quantity`
- 已正确实现

### 5. cancelOrderWithReason (line 2122)
- **只对liveRoomId订单**恢复库存
- **不对非直播订单**恢复库存 ← 这是BUG
- 需要修复：所有取消订单都应恢复库存

### 6. resolveOrderException (line 7541)
- refund: 扣减原商品库存（createInventoryAdjustment记录）
- replace_product: 扣减原商品库存 + 扣减替换商品库存
- wait_restock: 扣减原商品库存
- 注意：这些操作记录在inventory_adjustments表，但**没有更新products.stockQuantity**

### 7. getProductsEnhanced (line 2927)
- orderedCount: 查询pending/hold_order/partial_payment状态的订单商品数量
- completedCount: 查询shipped/completed状态的订单商品数量
- availableQuantity: stockQuantity - orderedCount
- 问题：orderedCount应包含更多状态（receipt_uploaded, partial_payment等）

### 8. OrderCreatePage (client)
- 商品搜索结果显示SKU，需要改为显示库存
- 已选商品列表显示SKU，需要改为显示库存
- 需要添加库存数量限制输入框

### 9. allowOversold字段
- **不存在**于schema和数据库中
- 需要添加到products表

### 10. 单据menu字体
- DashboardLayout有语言切换按钮，已添加no-print class
- 需要检查打印模板中是否有menu相关字体显示

## 需要修改的函数列表

### 后端 (server/db.ts)
1. **createOrderWithSplit** - 添加库存扣减
2. **createOrderFromLiveCapture** - 添加库存扣减（新订单和合并订单都要）
3. **cancelOrderWithReason** - 移除liveRoomId条件，所有取消都恢复库存
4. **getProductsEnhanced** - 更新orderedCount状态列表
5. **resolveOrderException** - 确保库存调整也更新products.stockQuantity

### 数据库
6. **products表** - 添加allowOversold字段

### 前端
7. **OrderCreatePage.tsx** - 商品卡显示库存，隐藏SKU
8. **ProductsV2.tsx** - 确认存库/已下单/已完成显示
9. **打印模板** - 移除menu字体

### 库存校验统一函数
10. 创建 `checkAndDeductStock` 统一函数
11. 创建 `restoreStock` 统一函数
