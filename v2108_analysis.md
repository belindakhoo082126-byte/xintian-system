# V2.1.08 订单单据统一修改分析

## 用户需求总结
5种资料完全分离：商品明细、备注、付款记录、汇款凭证、操作记录
Preview/Export/Print共用同一套OrderDocument组件
XT和XTC共用相同逻辑

## 当前代码调查结果

### 1. OrderDocument组件 (client/src/components/OrderDocument.tsx, 455行)
- 已有商品来源列（itemSource），使用ITEM_SOURCE_LABELS
- 已有客户资料、收件资料、商品明细、金额详情、付款记录、备注
- **问题1**: 付款记录中有"付款截图"列显示"[已上传]"，Preview/Export/Print应该隐藏
- **问题2**: Preview使用variant="admin"，Export/Print使用variant="customer"
  - 用户要求Preview/Export/Print都不显示汇款截图和Activity Log
  - 需要新增一个variant或在现有variant中控制
- 地址显示使用o.shippingAddress（单一字段），可能重复拼接

### 2. 商品来源 itemSource
- schema.ts line 672: `itemSource: mysqlEnum("itemSource", ["admin", "facebook_live", "messenger", "mall"]).default("admin")`
- ITEM_SOURCE_LABELS in shared/const.ts:
  - admin: "🟠 Admin 建单"
  - facebook_live: "🟢 直播下单"
  - mall: "🔵 商城加单"
  - messenger: "🤖 Messenger AI 下单"
- **缺失**: "私聊下单" 来源（用户需求中有，但enum没有）
- OrderDocument已正确显示每件商品的itemSource

### 3. 商城加单写入备注问题
- **db.ts line 4596-4601**: addMallItemsToOrder会写入orderRemarks:
  ```
  content: `客户商城加单：${items.map(...)}`
  remarkCategory: "other"
  createdBy: "客户结单页"
  ```
- **同时line 4604也写了logOrderOperation**（Activity Log）
- **修复**: 删除line 4596-4601的remark插入，保留line 4604的logOrderOperation

### 4. 其他系统行为写入备注
- Line 4464: customerRemark（客户备注）→ 正确保留
- Line 4477: repotPairs（换盆）→ 正确保留
- Line 6162: addOrderRemark通用函数 → 由调用者决定
- Line 6331: 换盆internal remark → 正确保留（internal类型）
- Line 6354: 取消换盆internal remark → 正确保留
- **结论**: 只有商城加单（line 4596）错误写入备注

### 5. 汇款凭证显示规则
- OrderDocument line 380-393: 付款记录表有"付款截图"列
  - variant="customer"时也显示（不区分Preview/Export/Print）
  - **修复**: 需要新增prop控制是否显示receipt列
  - Preview/Export/Print: 不显示
  - Admin后台/客户订单链接: 显示

### 6. 地址拼接问题
- createOrderWithSplit line 4268-4273:
  ```
  shippingAddress = [addressLine1, addressLine2, `${postcode} ${city}`, state, area].join(", ")
  ```
- 可能重复：如果addressLine1和addressLine2相同
- OrderDocument使用o.shippingAddress单一字段显示
- **修复**: 使用recipientCity/State/Postcode/Country分别显示，或确保shippingAddress不重复

### 7. 操作记录(Activity Log)
- OrderDocument目前不显示Activity Log（没有logs渲染）
- OrderBrowsePage Preview使用variant="admin"但OrderDocument不渲染logs
- **结论**: Activity Log已经不在OrderDocument中显示

### 8. getDetail返回数据
- routers.ts line 1343-1351: getDetail返回{...order, items, payments, logs}
- payments来自getOrderPayments，包含receiptUrl
- OrderBrowsePage line 258: 使用trpc.orders.getDetail获取数据
- Preview/Export/Print都使用同一个order数据（包含payments）

## 修复计划

### Fix 1: 商城加单停止写入备注
- db.ts line 4596-4601: 删除db.insert(orderRemarks)区块
- 保留line 4604的logOrderOperation

### Fix 2: OrderDocument隐藏汇款截图列
- 新增prop: `showReceiptColumn?: boolean`（默认true）
- Preview/Export/Print时传showReceiptColumn={false}
- OrderBrowsePage的Preview dialog: showReceiptColumn={false}
- OrderBrowsePage的handleExportImage: showReceiptColumn={false}
- OrderBrowsePage的handlePrint: showReceiptColumn={false}

### Fix 3: Preview使用variant="customer"而非"admin"
- OrderBrowsePage line 840: variant="admin" → variant="customer"
- 这样Preview不显示Facebook ID/Messenger ID等admin字段

### Fix 4: 地址拼接去重
- OrderDocument中收件资料地址显示改为使用结构化字段
- 使用recipientCity/State/Postcode/Country + shippingAddress组合
- 去除重复部分

### Fix 5: 历史商城加单备注清理
- SQL migration: 删除remarkCategory="other"且content LIKE "客户商城加单：%"的remarks
- 或标记为type="internal"使其不在客户单据显示

### Fix 6: ITEM_SOURCE_LABELS添加"私聊下单"
- shared/const.ts添加: private_chat: "💬 私聊下单"
- schema.ts itemSource enum添加"private_chat"
- 需要SQL ALTER TABLE
