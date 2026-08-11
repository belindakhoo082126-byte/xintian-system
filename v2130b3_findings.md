# V2.1.30补充3 - 6项Bug调查发现

## 问题1：追踪号码/快递公司未同步到订单管理区域8
- **根因**: `fullShipping`和`partialShipping`函数在db.ts中只创建packages表记录，不更新orders表的`courierCompany`和`trackingNumber`字段
- **OrderBrowsePage**区域8直接读取`order.courierCompany`和`order.trackingNumber`（来自orders表）
- **修复方案**: 在`fullShipping`和`partialShipping`中，发货成功后同时更新orders表的`courierCompany`和`trackingNumber`字段
- **位置**: 
  - `fullShipping`: db.ts ~line 6157, 在`db.update(orders).set({physicalStatus: "shipped"...})`中添加courierCompany和trackingNumber
  - `partialShipping`: db.ts ~line 6244, 同样添加

## 问题2：A5打印单据缺少下单人名字
- **当前状态**: A5PackingSlip组件（PackingDetail.tsx ~line 1227）已显示`data.facebookName`（FB名字）
- **Packing.tsx列表打印**: customerInfoHtml也已有`data.facebookName`显示
- **但**: 如果订单不是来自Facebook（手动创建），则没有facebookName，需要显示手动填写的名字
- **修复方案**: 在A5打印中，如果没有facebookName，显示customerName作为下单人名字
- **位置**: 
  - PackingDetail.tsx A5PackingSlip ~line 1246: 添加下单人显示
  - Packing.tsx printSlipData ~line 147: 添加下单人显示

## 问题3：单据里不要显示语言切换图标
- **根因**: DashboardLayout.tsx ~line 514 有一个fixed定位的语言切换按钮，在打印时也会显示
- **修复方案**: 给语言切换按钮添加`no-print` class
- **位置**: DashboardLayout.tsx ~line 514, 添加`no-print` class到语言切换按钮的div

## 问题4：ParcelDaily API连接状态及AWB自动生成
- **当前状态**: 
  - ParcelDaily已配置（有token和merchantId）
  - `createParcelDaily` procedure只调用`parceldaily.createOrder`，没有调用`checkoutOrder`
  - `checkoutOrder`才会返回tracking number（connote）
  - `getConsignmentNote`可以获取AWB label URL
  - **createParcelDaily** procedure没有完整的收件人地址信息（city, postcode, state都是空的）
- **修复方案**: 
  1. 在createParcelDaily中，createOrder后自动调用checkoutOrder获取tracking number
  2. 使用order的recipientName/recipientPhone/addressLine1/postcode/recipientCity/recipientState填充地址
  3. checkoutOrder成功后，调用getConsignmentNote获取AWB label URL
  4. 将tracking number和label URL保存到packages表和orders表
- **位置**: routers.ts ~line 3921 createParcelDaily procedure

## 问题5：库存为0时禁止下单
- **当前状态**: `createOrderWithSplit`函数没有检查stockQuantity，直接创建订单
- **修复方案**: 在createOrderWithSplit中，创建订单前检查每个physical商品的stockQuantity
  - 如果stockQuantity <= 0，抛出错误
  - 同样在`createOrderFromLiveCapture`、`addToSecureOrder`、`addMallItemsToOrder`中添加检查
- **位置**: 
  - createOrderWithSplit: db.ts ~line 960 (在插入orderItems之前添加stock检查)
  - createOrderFromLiveCapture: db.ts ~line 6568
  - addMallItemsToOrder: db.ts ~line 5162

## 问题6：商品显示存库/已下单/已完成数量
- **当前状态**: 
  - getProducts返回stockQuantity但没有已下单/已完成数量
  - getProductsEnhanced有pendingQuantity（来自pending/checkout/confirmed状态的订单）
  - ProductsV2.tsx显示availableQuantity和stockQuantity
- **用户需求**: 
  - 存库 = stockQuantity（当前库存）
  - 已下单 = 订单状态在 保留订单(pending)、挂单(hold_order)、待结账(checkout) 的商品数量
  - 已完成 = 订单状态已发货(shipped)的商品数量
- **修复方案**: 
  1. 修改getProducts函数，添加已下单和已完成数量查询
  2. 修改ProductsV2.tsx显示三个数量
- **位置**: 
  - getProducts: db.ts ~line 163
  - ProductsV2.tsx: 产品列表显示区域

## 列名映射确认
- orders表: camelCase (physicalStatus, createdAt等)
- order_items表: camelCase (orderId, productId等)
- products表: camelCase (stockQuantity等)
- packages表: camelCase (trackingNumber, courier等)
