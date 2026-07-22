# 心田电商后台管理系统 - TODO

## 数据库层

- [x] 设计并创建 products 表（支持四种商品类型 + 会员商品专属字段）
- [x] 设计并创建 customers 表（多维度身份识别 + 合并支持）
- [x] 设计并创建 orders 表（混合订单 + 双状态字段）
- [x] 设计并创建 order_items 表（关联商品与订单）
- [x] 设计并创建 membership_fee_reviews 表（审核记录 + Flow 追踪）
- [x] 设计并创建 messenger_flow_templates 表（Flow 模板配置）
- [x] 设计并创建 flow_steps 表（Flow 多步骤配置）
- [x] 设计并创建 flow_send_logs 表（Flow 发送日志）
- [x] 设计并创建 customer_merge_suggestions 表（疑似重复客户提示）
- [x] 生成迁移 SQL 并执行

## 后端 tRPC 路由

- [x] 商品管理 CRUD（含类型筛选、会员商品专属字段）
- [x] 订单创建与自动拆分逻辑（实体 vs 会员）
- [x] 实体订单状态流转（挂单→已完成）
- [x] 会员订单状态流转（待付款→已完成）
- [x] 会员费审核：确认会员费 / 拒绝单据
- [x] Messenger Flow 发送逻辑（模拟发送 + 状态记录）
- [x] Flow 重新发送
- [x] Flow 模板 CRUD（多步骤配置）
- [x] 客户档案 CRUD + 身份合并
- [x] 疑似重复客户检测与提示
- [x] 仪表板统计查询

## 前端后台界面

- [x] DashboardLayout 导航配置（6 个菜单项）
- [x] 仪表板页面（6 项统计卡片 + 系统说明）
- [x] 商品管理页面（列表 + 新增/编辑表单 + 类型切换 + 会员专属字段）
- [x] 订单管理页面（实体订单列表 + 状态筛选 + 详情 + 发货录入）
- [x] 会员订单管理页面（列表 + 审核操作 + Flow 状态 + 全部操作按钮）
- [x] 客户管理页面（列表 + 详情 + 合并操作 + 疑似重复提示）
- [x] Flow 编辑器页面（模板 CRUD + 多步骤配置 + 提醒/跟进设置）
- [x] 全局样式与主题配置（绿色自然风格 OKLCH）

## 测试

- [x] 订单拆分逻辑测试
- [x] 会员费审核流程测试（通过+Flow发送、拒绝、重发、取消）
- [x] 客户身份合并测试
- [x] Flow 发送状态记录测试
- [x] 商品/Flow/Dashboard 路由测试
- [x] 全部 19 个测试通过

## 待后续接入

- [x] Facebook Messenger API 实际发送集成（messenger.ts: sendTextMessage/sendButtonMessage/sendMediaMessage/sendTemplateMessage/sendMembershipFlow + facebook.ts: Webhook 接收端点 + FacebookSettings 页面）
- [x] Facebook Live 直播捉单功能（facebook.ts: Webhook 处理 live video comments + sales_sessions + facebook_comments + 关键词捉单 + FacebookLive 控制中心）
- [ ] 客户端商城前端（商品浏览、购物车、结账）
- [ ] 汇款单据上传 API（S3 存储集成）
- [ ] 7 天自动完成定时任务
- [ ] Flow 提醒定时任务（延迟发送未点击提醒）

## 第二轮需求 - Bug修复与新功能

- [x] 修复商品创建权限bug（错误码10002: You do not have required permission）
- [x] 调整商品分类：实体商品（花类/叶类/果树/肥料等子分类）+ 会员 + 赠品
- [x] 商品子分类管理：后台可添加/修改/删除子分类
- [x] 赠品逻辑调整：有总量、计算运费、商品价格为0
- [x] 会员商品：无总量、无运费、无配货
- [x] 新增进货管理：供应商表（不同厂家不同价格）
- [x] 新增进货单：选择供应商、商品、数量、成本价
- [x] 新增后台手动建单功能
- [x] 新增每月利润报表（按进货成本计算精准利润）
- [x] Facebook Page ID 获取指引

## Phase 1: 商品核心模块

### Sprint 1: 数据库与基础 API
- [x] 重构 categories 表（中英文、排序、显示控制）
- [x] 新增 units 表（销售单位）
- [x] 重构 products 表（Simple/Variant、关键词、SKU、三种价格、尺寸、影片、缺货状态、推荐、属性预留）
- [x] 新增 product_images 表
- [x] 新增 product_videos 表（商品影片）
- [x] 新增 variants 表（规格管理、价格继承/覆盖）
- [x] 新增 member_links 表（安全会员链接）
- [x] 新增 product_attributes 表（商品属性预留）
- [x] 生成迁移 SQL 并执行
- [x] 插入默认数据（Uncategorized 分类、预设单位）
- [x] 实现 Admin API（商品 CRUD、分类 CRUD、关键词检查）
- [x] 实现 Public API（价格隔离）
- [x] 实现 Member Link API（Token 验证 + 会员价）
- [x] 成本区分：estimatedCost + currentCost（FIFO 预留）
- [x] 商品状态增加 out_of_stock
- [x] 商品增加 isFeatured + featuredSortOrder
- [x] 商品增加 dimensions JSON 字段
- [x] Public API 价格隔离修复（不暴露 fileKey，关键词查询加 visibility='public' 检查）
- [x] categories.reorder 路由与 db helper
- [x] variants.update 规格关键词冲突检测

### Sprint 2: 后台商品管理页面
- [x] 商品列表页（搜索、筛选、分页、操作菜单）
- [x] 步骤式新增/编辑商品页（6步流程）
- [x] 分类管理页
- [ ] 图片上传（S3）— 后续版本
- [ ] 影片上传 — 后续版本
- [x] 规格管理（关键词冲突检测）
- [x] 价格模拟器
- [x] 预计利润显示

### Sprint 3: 会员链接与预览
- [x] 会员链接生成/重新生成/停用
- [x] 普通商品预览 (/product/:id)
- [x] 会员商品预览 (/m/:token)
- [x] 商品复制功能
- [ ] 中英文切换 — 后续版本

### Sprint 4: 测试与验收
- [x] Vitest 单元测试（34 个 Phase 1 测试 + 19 个旧测试 = 53 个全部通过）
- [x] TypeScript 编译零错误
- [x] 保存检查点

### 多设备同步
- [x] React Query cache invalidation 机制（refetchOnWindowFocus + refetchOnReconnect + staleTime 30s）
- [x] tRPC 实时刷新确保多设备数据一致（useAuth 也启用 refetchOnWindowFocus）

## XLCS V1.0: 订单管理模块

### Sprint 1: 数据库重构
- [x] 新增 couriers 表（快递公司管理）+ 默认数据
- [x] 新增 order_payments 表（多笔付款纪录）
- [x] 新增 order_notifications 表（通知历史）
- [x] 新增 order_audit_logs 表（审计日志）
- [x] orders 表新增字段（orderSource, estimatedShippingFee, actualShippingFee, shipmentDate, reservedAt, cancelledAt, courierId）
- [x] order_items 表新增 variantId 字段（关联 Phase 1 variants.id）

### Sprint 2: 后端 API
- [x] 快递公司 CRUD API（couriers router）
- [x] 订单增强 API（ordersV2 router: list/getById/ship/cancel/complete）
- [x] 自动合并逻辑（findMergeableOrder + mergeOrderItems db helpers）
- [x] 付款纪录 API（orderPayments router: list/add，多笔不可覆盖）
- [x] 通知历史 API（orderNotifications router: list/markManual）
- [x] 审计日志 API（auditLogs router: list，自动记录在 ship/cancel/complete）
- [x] 工作队列统计 API（ordersV2.workQueue: 挂单/确认汇款/Shopee/欠运费/保留）
- [x] 发货操作 API（ordersV2.ship: 选择快递 + Tracking + 日期 + 审计日志）
- [ ] 库存规则（Reserved +/-, Physical -）— 后续版本

### Sprint 3: 前端订单管理页面升级
- [x] 工作队列顶部固定栏（挂单/确认汇款/Shopee/欠运费/保留 + 数量 + 点击筛选）
- [x] 订单详情页重构（付款纪录列表 + 通知历史 + 审计日志 Tab）
- [x] 发货操作对话框（选择快递公司 + Tracking + 日期）
- [x] 订单来源筛选
- [x] 配送方式筛选
- [x] 保留天数显示
- [x] 分页列表（limit/offset + 翻页控件）

### Sprint 4: 快递管理页面 + 发货通知
- [x] 快递公司管理页面（CRUD + 排序 + 启用/停用）
- [x] 发货通知模板（含 Tracking Number + Tracking.my 链接）
- [x] 复制 Tracking / 复制 Tracking.my / 复制发货信息 按钮
- [x] 通知失败中心（Messenger + WhatsApp 双状态 + 标记已人工通知）

### Sprint 5: 测试与验收
- [x] Vitest 单元测试（23 个 XLCS 测试 + 34 Phase 1 + 18 旧测试 + 1 auth = 76 个全部通过）
- [x] TypeScript 编译零错误
- [x] 保存检查点

## XLCS V1.0: 客户管理模块（Module 3）

### Sprint 1: 数据库重构
- [x] customers 表新增字段（customerId, displayName, whatsappPhone, avatarUrl, overrideAvatarUrl, customerSource, lastInteractionAt, blacklistAt, blacklistBy, unblacklistAt, unblacklistBy）
- [x] 新增 customer_addresses 表（多地址管理 + 默认地址）
- [x] 新增 customer_credit_ledger 表（Credit 纪录：日期、金额、类型、原因、操作人）
- [x] 新增 customer_refunds 表（退款纪录）
- [x] 新增 customer_timeline 表（客户时间轴）
- [x] 新增 customer_audit_logs 表（客户审计日志）
- [x] 生成 Customer ID（C000001 格式）+ 回填 displayName + customerSource

### Sprint 2: 后端 API
- [x] 客户 CRUD 增强（Display Name、头像、WhatsApp、来源 + 审计日志）
- [x] 全局客户搜索（模糊搜索多字段：Customer ID、Display Name、Facebook Name、FB ID、Messenger ID、WhatsApp、电话、Email、收件人）
- [x] 客户地址 CRUD（多地址 + 默认地址设定）
- [x] Customer Credit Ledger API（列表 + 添加 + 余额计算，禁止直接修改余额）
- [x] 退款纪录 API
- [x] 黑名单增强（加入/解除 + 记录原因/日期/操作人 + 审计日志 + 时间轴）
- [x] 客户统计自动计算（累计消费、下单次数、完成/取消数、取消率、累计商品数、平均订单、最近购买）
- [x] 客户时间轴 API（聚合订单事件、付款、发货、通知、黑名单等）
- [x] 客户审计日志 API
- [x] 重复客户检测增强（电话/Messenger/WhatsApp/相似 Facebook Name）

### Sprint 3: 前端客户管理页面升级
- [x] 客户列表增强（头像、Customer ID、Display Name、来源、黑名单状态、累计消费）
- [x] 全局客户搜索组件（模糊搜索多字段 + 搜索结果列表 + 新增客户入口）
- [x] 客户详情页重构（基本资料 + 头像 + 统计卡片 + 时间轴 + 地址/Credit/退款/审计/重复 Tab）
- [x] 地址管理（多地址 CRUD + 默认地址 + 删除）
- [x] Credit Ledger 查看 + 添加（余额显示 + 类型选择 + 原因输入）
- [x] 黑名单管理（加入/解除 + 原因必填校验 + 审计日志 + 时间轴）
- [x] 快速操作（编辑资料、黑名单、新增地址、Credit 操作）
- [x] 客户时间轴展示（按时间倒序，图标 + 事件描述 + 时间 + 操作人）
- [x] 审计日志 Tab
- [x] 增强重复客户检测 Tab（电话/Messenger/WhatsApp/相似 FB Name）

### Sprint 4: 测试与验收
- [x] Vitest 单元测试（23 个 Module 3 测试 + 76 个旧测试 = 99 个全部通过）
- [x] TypeScript 编译零错误
- [x] 保存检查点

## XLCS V1.0: Dashboard 工作中心、订单备注与 Facebook 直播／贴文管理

### Sprint 1: 数据库
- [x] sales_sessions 表（直播/贴文/Reel 销售场次）
- [x] facebook_comments 表（留言同步 + 关键词捉单记录）
- [x] order_notes 表（3 种备注：客户可见/内部/Checkout）
- [x] action_items 表（需要处理事项）
- [x] session_products 表（场次商品 + 预售管理）
- [x] 生成迁移 SQL 并执行

### Sprint 2: 后端 API
- [x] Dashboard 统计 API（workCenter router: stats/recentActions/allActions/completeAction）
- [x] Order Notes CRUD API（orderNotes router: list/add/delete + needsAction 自动创建 ActionItem）
- [x] Action Items CRUD API（actionItems router: list/create/complete + 完成人记录）
- [x] Sales Sessions CRUD API（salesSessions router: list/getById/create/updateStatus/stats）
- [x] Session Products API（sessionProducts router: list/add/update + 预售管理 + 停售/继续）
- [x] Comment 处理 API（facebookComments router: list + normalizeCommentMessage + findSessionProductByKeyword + checkProductAvailability + 重复检测幂等）

### Sprint 3: Dashboard 工作中心前端
- [x] 5 大卡片（需要处理/待付款/已付款/今日订单/今日直播）
- [x] 需要处理预览（最近 5 项 + 完成 + 进入订单）
- [x] 快速完成（状态更新 + Dashboard 数量即时扣减）
- [x] 需要处理清单页（完整列表 + 筛选器 + 来源标签）

### Sprint 4: 订单备注系统前端
- [x] OrdersV2 详情页整合 3 种备注（客户可见/内部/Checkout）
- [x] 备注添加对话框（类型选择 + 需要后续处理勾选）
- [x] Action Items Tab（未完成/已完成 + 完成操作）
- [ ] 包货员视图过滤 — 后续版本

### Sprint 5: Facebook Sales Management 前端
- [x] Facebook 场次列表页（当前直播 + 最近贴文 + 监听状态 + 分页）
- [x] 直播控制中心三栏布局（商品区/留言区/客户订单操作）
- [x] 商品卡（关键词/库存/预售/停售按钮）
- [x] 留言区（FB ID/匹配状态/关键词/数量/失败原因）
- [ ] 客户快速订单卡（一键操作）— V1.1 版本
- [x] 直播统计栏（下单客户/商品件数/金额/付款状态/需要处理/留言统计）
- [ ] 手动链接备用入口 — V1.1 版本

### Sprint 6: 测试与验收
- [x] Vitest 单元测试（26 个新测试 + 99 个旧测试 = 125 个全部通过）
- [x] TypeScript 编译零错误
- [x] 保存检查点

## XLCS V1.0: AI Agent & Live Selling Center

### Sprint 1: 数据库
- [x] ai_settings 表（AI 行为配置 + 默认数据插入）
- [x] ai_reply_logs 表（AI 回复记录）
- [x] ai_review_items 表（AI 学习建议）
- [x] faq_entries 表（FAQ 管理）
- [x] knowledge_entries 表（Knowledge 管理）
- [x] plant_diagnostic_tickets 表（植物诊断工单）
- [x] ai_chat_sessions 表（AI 对话会话）
- [x] session_product_variants 表（场次 Variant 绑定）
- [x] 生成迁移 SQL 并执行

### Sprint 2: 后端 API
- [x] AI Settings CRUD API（get/update，admin 权限）
- [x] FAQ CRUD API（list/getById/create/update/delete + 搜索）
- [x] Knowledge CRUD API（list/getById/create/update/delete + 搜索）
- [x] AI Reply Log API（list/getById/add/updateHumanReply）
- [x] AI Review Center API（list/create/updateStatus）
- [x] Plant Diagnostic API（list/getById/create/update + 转人工）
- [x] AI Chat Session API（list/getById/create/update）
- [x] Session Product Variants API（list/add/update/delete + 关键词查找）
- [x] Live Selling Center API（getSellableProducts + getDashboardStats）

### Sprint 3: Live Selling Center 前端增强
- [x] Variant 自动过滤显示（库存>0 或预售才显示，缺货半透明）
- [x] Variant 独立关键词显示（独立区域 + 关键词 Badge）
- [x] 普通商品关键词显示（已有 + 缺货半透明效果）
- [x] 库存即时同步（通过 liveDashboard 查询自动刷新）
- [x] Live Dashboard（6 卡片统计 + 缺货提醒 + 预售提醒）

### Sprint 4: AI Settings + FAQ/Knowledge 管理前端
- [x] AI Settings 页面（自动回复/学习模式/信心值/各平台开关/人工确认）
- [x] FAQ 管理页面（CRUD + 分类分组 + 关键词 + 搜索 + 附件 URL）
- [x] Knowledge 管理页面（CRUD + 标签 + 搜索 + 附件 URL）
- [x] 侧栏菜单添加 AI 管理入口（AI 设置/FAQ/Knowledge）

### Sprint 5: AI Review Center + AI Reply Log 前端
- [x] AI Review Center 页面（建议列表/批准/修改/拒绝/忽略 + 缓存 invalidation）
- [x] AI Reply Log 页面（完整对话记录/平台筛选/模组筛选/详情对话框）
- [ ] Plant Diagnostic 工单页面 — 后续版本

### Sprint 6: 测试与验收
- [x] Vitest 单元测试（29 个 AI Agent 测试 + 125 个旧测试 = 154 个全部通过）
- [x] TypeScript 编译零错误
- [x] 保存检查点

## XLCS V1.0: 采购模块（供应商管理 + 进货管理 + FIFO）

### Sprint 1: 数据库
- [x] suppliers 表增强（supplierCode/bankName/bankAccountName/bankAccountNumber/remark/status/createdBy/updatedBy）
- [x] purchase_orders 表增强（purchaseOrderNo/supplierDocumentNo/purchaseDate/totalQuantity/remark/confirmedAt/confirmedBy/createdBy）
- [x] purchase_order_items 表增强（variantId）
- [x] inventory_lots 表（FIFO Lot: lotNo/purchaseOrderId/supplierId/productId/variantId/originalQuantity/remainingQuantity/unitCost/purchaseDate/status）
- [x] inventory_ledger 表（库存流水: productId/variantId/lotId/transactionType/referenceType/referenceId/quantityChange/balanceAfter/unitCost/createdBy）
- [x] 生成迁移 SQL 并执行

### Sprint 2: 后端 API
- [x] 供应商 CRUD API（suppliersV2: list/search/getById/create/update/deactivate/generateCode）
- [x] 供应商详情 API（含历史进货列表）
- [x] 进货 CRUD API（purchaseOrdersV2: list/search/getById/create/updateDraft/confirm/cancel）
- [x] 确认进货 API（confirmPurchaseOrder: 建立 FIFO Lot + 增加库存 + Stock Ledger + 锁定）
- [x] FIFO 扣减 API（consumeFifoLots: 按先进先出扣 Lot + Stock Ledger）
- [x] 库存查询 API（inventory: getLots/getLedger/getCurrentStock）

### Sprint 3: 供应商管理前端
- [x] 供应商列表页（搜索/新增/编辑/停用/查看详情）
- [x] 新增/编辑供应商对话框（基本资料 + 银行资料）
- [x] 供应商详情页（基本资料 + 银行资料 + 历史进货列表）

### Sprint 4: 进货管理前端
- [x] 进货列表页（搜索/状态筛选/新增进货）
- [x] 新增进货页面（供应商选择 + 日期 + 供应商单号 + 备注）
- [x] 添加商品搜索（商品名称搜索 + Variant Badge 选择）
- [x] Variant 选择（有 Variant 选规格/无 Variant 直接添加）
- [ ] 新增 Variant 对话框 — 后续版本
- [x] 商品行（商品/Variant/数量/单位成本/小计/删除）
- [x] 底部汇总（商品种类/总数量/总金额）
- [x] 保存草稿 + 确认进货 + 取消操作

### Sprint 5: 菜单 + 测试 + 检查点
- [x] 侧栏菜单更新（供应商管理 + 进货管理 已在之前 Sprint 中配置）
- [x] Vitest 单元测试（16 个采购模块测试 + 154 个旧测试 = 170 个全部通过）
- [x] TypeScript 编译零错误
- [x] 保存检查点
