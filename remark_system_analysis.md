# 备注系统现状分析

## 数据库 (drizzle/schema.ts)
- `orderRemarks` 表有 `remarkCategory` 字段，现有值：`repotting`, `desired_delivery_date`, `other`, `general`
- **缺少 `select_tree`（选树身）类别**

## 后端 (server/db.ts)
- `getOrdersWithRemarks()` (line 5426) - 返回所有备注，排除 shipped/completed，按 orderId 去重
- `getTodayScheduledShippingCount()` (line 5491) - 统计 `desired_delivery_date` = today 的数量
- `getTodayScheduledShipping()` (line 5611) - 只查 `orders.scheduledShippingDate = today`，**不查 remarks 的 desiredDeliveryDate**
- `createOrderRemark()` (line 5379) - 创建备注
- `updateOrderRemark()` (line 5406) - 更新备注
- `deleteOrderRemark()` (line 5503) - 删除备注
- Dashboard stats (line 5226) - `scheduledToday` 同时统计 remarks 和 orders

## 后端路由 (server/routers.ts)
- `orderRemarks.list` - 查询订单备注
- `orderRemarks.create` - 创建备注
- `orderRemarks.update` - 更新备注
- `orderRemarks.delete` - 删除备注
- `orderRemarks.ordersWithRemarks` - Dashboard 用
- `orderRemarks.allWithOrder` - 全部备注
- `scheduledShipping.today` - 今日预约发货（只查 orders 表）
- `scheduledShipping.setDate` - 设置预约发货日期
- `scheduledShipping.list` - 预约发货列表

## 前端各页面现状

### Dashboard.tsx
- `REMARK_CATEGORY_LABELS` (line 17-22): 有 repotting, customer_other, desired_delivery_date, internal_repotting, internal_other
- **缺少 select_tree**
- 今日预约发货卡片 (line 84): 显示数字，链接到 `/packing?tab=scheduled`
- 订单备注区域 (line 272-307): 显示最近 10 条备注，点击跳转订单

### Orders.tsx (订单管理)
- 备注筛选 (line 85): all/with/without
- 备注类别选择 (line 1207-1211): repotting, desired_delivery_date, other
- **缺少 select_tree**
- 备注列表 (line 1375-1420): 显示类别标签和内容

### OrderBrowsePage.tsx (订单浏览)
- 备注显示 (line 625-678): 显示 repotting, desired_delivery_date, other
- **缺少 select_tree**

### CustomerOrderTracking.tsx (客户订单)
- 备注显示 (line 174-207): 显示 repotting, desired_delivery_date, other
- **缺少 select_tree**

### OrderCreatePage.tsx (建立订单)
- 备注类别 (line 1131-1136): general, desired_delivery_date, repotting, other
- **缺少 select_tree**

### OrderEditPage.tsx (编辑订单)
- **完全没有备注区域！** 只有基本信息、客户、收货、商品、金额、付款记录
- **需要新增备注查看和编辑功能**

## 需要修改的内容

1. 后端：新增 `getTodayScheduledShippingOrders()` 返回今日 desired_delivery_date 的订单列表
2. 后端：新增 tRPC 路由 `scheduledShipping.todayOrders`
3. Dashboard：新增 select_tree 标签 + 今日预约发货可点击查看列表弹窗
4. Orders.tsx：新增 select_tree 类别
5. OrderBrowsePage：新增 select_tree 显示
6. CustomerOrderTracking：新增 select_tree 显示
7. OrderCreatePage：新增 select_tree 类别
8. OrderEditPage：新增备注区域（查看+添加+编辑+删除）
