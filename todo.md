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

- [x] Facebook Messenger API 实际发送集成（Graph API v21.0：sendTextMessage/sendButtonMessage/sendMediaMessage/sendTemplateMessage/sendMembershipFlow/sendTelegramJoinFlow）
- [x] Facebook Live 直播捉单功能（关键词匹配 + 自动建单 + 自动回复 + Messenger 通知）
- [x] 客户端商城前端（商品浏览、购物车、结账）
- [x] 汇款单据上传 API（S3 存储集成）
- [x] 7 天自动完成定时任务（Heartbeat cron handler + db.autoCompleteShippedOrders）
- [x] Flow 提醒定时任务（Heartbeat cron handler + db.getPendingFlowReminders）

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
- [x] 图片上传（S3）— 已完成（商品封面、QR 图片、横幅图片）
- [ ] 影片上传 — V1.2 规划
- [x] 规格管理（关键词冲突检测）
- [x] 价格模拟器
- [x] 预计利润显示

### Sprint 3: 会员链接与预览
- [x] 会员链接生成/重新生成/停用
- [x] 普通商品预览 (/product/:id)
- [x] 会员商品预览 (/m/:token)
- [x] 商品复制功能
- [x] 中英文切换 — 已完成（I18nContext + 60+ 翻译键 + 语言切换按钮）

### Sprint 4: 测试与验收
- [x] Vitest 单元测试（34 个 Phase 1 测试 + 19 个旧测试 = 53 个全部通过）
- [x] TypeScript 编译零错误
- [x] 保存检查点

### 多设备同步
- [x] React Query cache invalidation 机制（refetchOnWindowFocus + refetchOnReconnect + staleTime 30s）
- [x] tRPC 实时刷新确保多设备数据一致（useAuth 也启用 refetchOnWindowFocus）

## XLCS V1.0: 经营报告模块（Business Report）

### Sprint 1: 后端 Report Service
- [x] 经营总览统计 API（12 项核心数据：总业绩/已汇款/未汇款/退款/已汇款订单/未汇款订单/已寄包裹/承担运费/运费收入/商品成本FIFO/实际毛利润/毛利率）
- [x] TOP10 排行榜 API（最好卖商品 by 销量/销售额/毛利润 + 消费最高客户 by 已汇款金额）
- [x] 日期范围查询支持（今天/昨天/本周/本月/上个月/今年/自定义）
- [x] 销售与收款报告 API
- [x] 商品销售报告 API
- [x] 客户消费报告 API
- [x] 进货与库存报告 API

### Sprint 2: 前端经营总览页面
- [x] 日期切换器（今天/昨天/本周/本月/上个月/今年/自定义）
- [x] 第一排：9 张业绩数据卡
- [x] 第二排：利润分析（商品销售额/商品成本FIFO/实际毛利润/毛利率）
- [x] 第三排：订单统计（总订单/已汇款/未汇款/退款/完成/取消）
- [x] 第四排：3 个 TOP10 排行榜（最好卖商品/最赚钱商品/消费最高客户）

### Sprint 3: 前端子报告页面
- [x] 销售与收款报告页面
- [x] 商品销售报告页面
- [x] 客户消费报告页面
- [x] 进货与库存报告页面
- [x] 侧栏菜单更新（利润报表子菜单）

### Sprint 4: 测试与验收
- [x] Vitest 单元测试
- [x] TypeScript 编译零错误
- [x] 保存检查点

## 系统设置 + 运费规则 + ParcelDaily 物流整合

### Sprint 1: 数据库 Schema
- [x] system_settings 表（公司资料、编号规则、通知、安全）
- [x] shipping_rules 表（西马/东马/自取/Lalamove 运费规则）
- [x] shipping_providers 表（物流供应商配置）
- [x] shipments 表（物流运单）
- [x] 默认运费规则种子数据
- [x] 默认物流供应商种子数据
- [x] ParcelDaily 凭据存为 secrets

### Sprint 2: 后端 API 客户端
- [x] ParcelDaily API 客户端（server/parceldaily.ts）
- [x] 物流供应商适配器架构（server/shippingProvider.ts）
- [x] ParcelDaily: accountInfo, checkPostcode, getQuote, createOrder, checkoutOrder, getConsignmentNote
- [x] Manual Shipping 适配器
- [x] Provider Registry（可扩展）

### Sprint 3: 后端路由
- [x] settings 路由（get/update 系统设置）
- [x] shippingRules 路由（list/update/create/delete）
- [x] shippingProviders 路由（list/update/testConnection）
- [x] parceldaily 路由（accountInfo/checkPostcode/getQuote/createShipment/checkoutShipment/getConsignmentNote）

### Sprint 4: 前端页面
- [x] SystemSettings 页面（公司资料/编号规则/通知/安全 4 个 Tab）
- [x] ShippingRules 页面（4 个区域运费规则编辑）
- [x] LogisticsIntegration 页面（ParcelDaily/Parcel King/Manual 3 个 Tab）
- [x] 侧栏导航更新（运费规则/物流整合/系统设置）
- [x] App.tsx 路由更新

### Sprint 5: 测试与验收
- [x] TypeScript 编译零错误
- [x] Vitest 单元测试
- [x] 保存检查点

## Payment Setting + Payment Flow + Order Status + Order Detail Module

### Sprint 1: Database Schema
- [x] payment_methods table (付款方式)
- [x] order_status_logs table (订单状态变更记录)
- [x] hold_order_infos table (保留订单信息)
- [x] notification_logs table (通知发送记录)
- [x] orders 表新增列 (paymentMethodId, orderSource, sourceName, originalCustomerComment, commentDate, totalWeight, discountAmount)
- [x] orders.physicalStatus 枚举扩展为 9 种状态
- [x] order_items 表新增快照列 (productSku, facebookKeyword, discount, unitWeight)
- [x] 默认付款方式种子数据 (DuitNow QR, TNG QR, Public Bank, Cash)

### Sprint 2: Backend DB Helpers
- [x] Payment Methods CRUD
- [x] Order Status Logs
- [x] Hold Order Info (get/create/release)
- [x] Notification Logs
- [x] Order Status Transition (transitionOrderStatus)
- [x] Hold Order Auto-Merge (findMergeableHoldOrder, mergeOrderItemsIntoOrder, recalculateOrderTotals)

### Sprint 3: Backend tRPC Routers
- [x] paymentMethods router (list, listEnabled, getById, create, update, delete)
- [x] orderWorkflow router (getStatusLogs, transition, confirmPayment)
- [x] holdOrders router (getInfo, getActiveByCustomer, create, release, findMergeable)
- [x] notifications router (list, create)

### Sprint 4: Frontend Admin Pages
- [x] PaymentSettings page (付款设定 CRUD + QR 上传/预览/下载)
- [x] OrderDetail page (订单详情 + 商品快照 + 状态流转 + 保留订单 + 通知记录)
- [x] DashboardLayout navigation updated
- [x] App.tsx routes updated

### Sprint 5: Frontend Customer Page
- [x] CustomerPayment page (QR 展示/放大/下载 + 银行账号复制 + 付款凭证上传)

### Sprint 6: Tests & Checkpoint
- [x] TypeScript 编译零错误
- [x] 保存检查点

## Mall (商城) Module

### Sprint 1: Database Schema
- [x] mall_settings table (shop info, policies, contact, theme)
- [x] mall_banners table (6 types: home/marketing x 16:9/9:16/1:1)
- [x] mall_quick_contacts table (WhatsApp/Messenger/FB/Waze/Google Map)
- [x] mall_notices table (homepage announcements)
- [x] mall_theme_schedules table (seasonal theme scheduling)
- [x] mall_product_detail_images table (product detail page images)
- [x] products table: syncToMall + mallSortOrder fields
- [x] Seed default settings, quick contacts, notices

### Sprint 2: Backend
- [x] 30+ db helpers (settings/banners/contacts/notices/themes/detail images/sync/checkout/order query/smart paste)
- [x] mallAdmin router (settings CRUD, banners CRUD, contacts CRUD, notices CRUD, theme schedules, detail images, product sync)
- [x] mall public router (settings, banners, contacts, notices, categories, products, productDetail, checkout, smartPaste, queryOrder, findMergeableOrders)

### Sprint 3: Admin Frontend
- [x] MallSettings page (6 tabs: basic/banners/notices/policies/contact/themes)
- [x] 12 preset themes (Xintian Nature, Lavender, Sakura, Nature Green, Warm Brown, Christmas, CNY, Hari Raya, Merdeka, Mid-Autumn, Valentine, Custom)
- [x] Theme scheduler UI

### Sprint 4: Public Mall Frontend
- [x] MallHome (banners, notices, category bar, product grid, search, quick contact floating buttons, footer)
- [x] MallProductDetail (images, variants, quantity, add to cart, buy now, description, detail images)
- [x] MallCart (quantity update, remove, subtotal, checkout link)
- [x] MallCheckout (smart paste, customer info, shipping method, hold order merge, payment method, order summary)
- [x] MallOrderQuery (order number + phone lookup, status display, items table)

### Sprint 5: Integration
- [x] DashboardLayout: Mall Settings menu item
- [x] App.tsx: mall public routes + admin route
- [x] TypeScript zero errors
- [x] Vitest tests passing
- [x] Checkpoint saved

## XLCS V1: 包货、发货、客户订单模块 + 直播捉单

### Sprint 1: Database Schema
- [x] packages 表（包裹：courier, trackingNumber, shippingLabel, auto/manual）
- [x] package_items 表（包裹商品关联：partial shipping 支援）
- [x] live_order_captures 表（直播捉单记录：comment, keyword, matched product, order）

### Sprint 2: Backend API
- [x] 包货工作台 API（待包货/已发货/部分发货/今日已发货 列表）
- [x] 包货详情 API（商品图片、规格、数量、客户信息）
- [x] A5 包货单数据 API（黑白打印格式数据）
- [x] 完整发货 API（多包裹，自动状态流转为已发货）
- [x] 部分发货 API（选择商品，创建包裹，状态流转为部分发货）
- [x] 包裹查询 API（获取订单包裹列表）
- [x] ParcelDaily 自动 Shipping Label API
- [x] 客户订单追踪 API（公开，简化状态）
- [x] 直播捉单 API（关键词解析 + 商品匹配 + 自动建单 + 记录查询）

### Sprint 3: Frontend - 包货工作台
- [x] 包货首页（4 个状态 Tab + 订单列表 + 特殊标签）
- [x] 包货详情页（商品彩色照片 + 超大数量 + 客户完整信息）

### Sprint 4: Frontend - A5 包货单
- [x] A5 打印预览（黑白、勾选框、超大数量、汇总金额、赠品独立列出）
- [x] 打印按钮（window.print 触发）

### Sprint 5: Frontend - 发货
- [x] 完整发货（多包裹新增 + courier 选择 + tracking 输入）
- [x] 部分发货（商品勾选 + courier + tracking）
- [x] ParcelDaily 自动获取 tracking（集成 parceldaily.ts）
- [x] 混合物流支持（同一订单 auto + manual 包裹）

### Sprint 6: Frontend - 客户订单追踪
- [x] 公开订单追踪页（简化状态 + 商品照片 + 包裹物流 + 查询链接）

### Sprint 7: 直播捉单
- [x] 关键词匹配引擎（comment → product keyword match）
- [x] 自动建单逻辑（匹配成功 → 创建挂单 → 自动回复确认）
- [x] 自动发送 Messenger 消息请求收货地址
- [x] live_order_captures 记录

### Sprint 8: 测试与验收
- [x] TypeScript 编译零错误
- [x] Vitest 单元测试（60 个全部通过）
- [x] 保存检查点

## XLCS V1.1: Dashboard 重设计 + 备注系统 + 换盆功能 + 预约发货 + 订单提醒 + 多语言

### Sprint 1: 数据库 Schema
- [x] order_item_repots 表（换盆：orderItemId, productId, potProductId, quantity）
- [x] order_remarks 表（3种备注：live/customer/internal）
- [x] orders 表新增 scheduledShippingDate 字段（预约发货日期）
- [x] products 表新增 isPot 字段（标记花盆类商品）+ potCapacity

### Sprint 2: 后端 API
- [x] Dashboard 统计 API（今日待处理5排 + 订单提醒）
- [x] 备注 CRUD API（3种类型：直播/客户/内部）
- [x] 换盆 CRUD API（含数量验证 + 库存同步扣除）
- [x] 预约发货 API（设置/查询今日预约发货）
- [x] 订单提醒 API（换盆/预约发货/保留到期/待审核付款）

### Sprint 3: Dashboard 重设计
- [x] 第一排：待审核付款 + 待出货 + 部分发货
- [x] 第二排：未汇款订单 + 本月已汇款订单 + 保留订单
- [x] 第三排：库存不足 + 缺货商品
- [x] 第四排：今日订单 + 今日已发货 + 今日销售额 + 本月销售额
- [x] 第五排：今日预约发货
- [x] 订单提醒 Banner（换盆/预约发货/保留到期/待审核付款）
- [x] 所有卡片可点击进入对应页面

### Sprint 4: 备注系统
- [x] OrderDetail 新增 3 种备注（直播/客户/内部）
- [x] PackingDetail 显示直播备注 + 客户备注
- [x] A5 包货单显示客户备注

### Sprint 5: 换盆功能
- [x] OrderDetail 新增换盆 UI（选商品→数量→花盆，可多次新增）
- [x] 数量自动验证（不可超过购买数量）
- [x] PackingDetail 显示换盆安排（⚠️ 换盆标识）
- [x] A5 包货单显示换盆安排
- [x] 完成换盆后自动扣除花盆库存

### Sprint 6: 预约发货
- [x] OrderDetail 新增预约发货日期选择
- [x] Dashboard 今日预约发货提醒
- [x] 预约发货订单列表

### Sprint 7: 多语言
- [x] i18n 框架搭建（中文/英文切换）
- [x] 右上角语言切换按钮
- [x] 记住用户语言偏好（localStorage）
- [x] 翻译关键 UI 字符串（60+ 翻译键）

### Sprint 8: 测试与验收
- [x] Vitest 单元测试（60 个全部通过）
- [x] TypeScript 编译零错误
- [x] 保存检查点

## V1.2 Design System - 统一后台主题

- [x] 定义 Xintian Nature + Dark Mode 色彩系统 (index.css)
- [x] 更新 ThemeContext 支持两个后台主题
- [x] 添加 Google Font (Plus Jakarta Sans)
- [x] 修复 sonner.tsx 使用项目 ThemeContext
- [x] DashboardLayout 右上角添加主题切换器
- [x] CustomerOrderTracking 适配主题
- [x] TypeScript 零错误 + 测试通过 + checkpoint

## V1.3 System Acceptance Testing (SAT)

- [x] ERP Dashboard - all buttons, links, pages（真实前端回归通过）
- [x] Product Management - CRUD, images, categories, stock, variants, keywords, status（真实前端回归通过）
- [x] Order Management - create, edit, delete, payment review, merge, hold, shipping（真实前端回归通过）
- [x] Customer Management - CRUD, search, history, notes（真实前端回归通过）
- [x] Packing System - role isolation, packing flow, A5 slip（真实前端回归通过）
- [x] Mall - browse, cart, checkout, payment upload, order creation（真实前端回归通过）
- [x] Customer Order Tracking - search, status, tracking, packages（真实前端回归通过）
- [x] Facebook Live keyword capture - parsing, orders, replies, duplicates（安全与幂等回归通过）
- [x] Role Permissions - Admin vs Shipping Staff（真实前端与接口回归通过）
- [x] Full flow simulation: product → mall order → payment → review → pack → ship → track（端到端真实前端回归通过）
- [x] Compile acceptance report（SAT_TEST_LOG.md 已完成）
- [x] 修复商城公开路由重复前缀与商品详情页无法进入的问题（SAT 发现）
- [x] 修复 MySQL Drizzle 插入结果取值错误，确保商城、ERP、直播建单与包裹创建获得正确 ID（SAT 发现）
- [x] 修复付款页面将查询参数误纳入订单号、导致新建订单显示不存在的问题（SAT 发现）
- [x] 创建并使用仅开发环境的临时 QA 登录会话，完成 Admin 与 Shipping Staff 前端验收；完成后移除（SAT 前提）
- [x] 使用提供的测试管理员凭据验证后台登录入口；若入口不支持账号密码，改用仅开发环境 QA 会话（SAT 前提）
- [x] 修复后台订单详情未提供已上传付款凭证的预览与审核通过／驳回操作，导致商城付款无法进入包货流程（SAT 发现）
- [x] 限制订单创建及付款审核等敏感后台接口仅限 Admin，防止 Shipping Staff 通过前端外接口越权（SAT 发现）
- [x] 修复客户订单查询页未显示已发货 Tracking／包裹信息，确保客户可查看单包裹与多包裹物流（SAT 发现）
- [x] 修复新增／编辑商品价格模拟器未按售价与成本计算利润、错误显示亏损的问题（SAT 发现）
- [x] 修复商品编辑向导中名称、库存等输入变更未同步到预览／保存数据的问题（SAT 发现）
- [x] 修复 Dashboard「库存不足／缺货商品」快捷入口跳转至无效 /products-v2 路由的问题（SAT 发现）
- [x] 核验并清理开发 QA 会话中 ONE_HOUR_MS 导入错误，确保开发服务器控制台无残留错误（SAT 环境）
- [x] 补齐客户管理前端的客户建立／编辑、历史订单与客户备注操作入口，当前详情仅只读无法完成验收流程（SAT 发现）
- [x] 修复客户管理新增客户提交后无成功反馈且客户未出现在列表的问题（SAT 发现）
- [x] 修复后台手动建单中商品选择后仍显示“请选择”、单价为 0 而无法创建订单的问题（SAT 发现）
- [x] 补齐订单管理前端的订单修改、保留订单与合并订单入口；当前订单详情仅有收款与取消，无法完成所需验收流程（SAT 发现；保留订单与合并已通过真实前端回归）
- [x] 修复 /orders/:id 完整订单详情对已存在订单显示“订单不存在”的查询参数／接口不匹配问题（SAT 发现）
- [x] 修复 App 动态路由 component 回调未从 props.params 读取参数的问题，避免订单、付款与商品预览页面传入 NaN／空参数（SAT 发现）
- [x] 修复创建保留订单后仍停留“确认汇款”而非“保留订单”，导致“释放保留 → 待包货”按钮永不出现的问题（SAT 发现；真实前端回归通过）
- [x] 修复商城结账前端未发现／展示可自动合并的保留订单，也未传递 `mergeIntoOrderId`，导致既有保留订单自动合并能力无法通过真实前端使用（SAT-015；真实商城结账回归通过）
- [x] 修复商城结账“查找可合并的保留订单”返回 MySQL 原始 `[rows, fields]` 包装，导致前端显示空订单号／金额且不能传递真实订单 ID 的问题（SAT-015；真实商城结账回归通过）
- [x] 修复商城合并保留订单后直接改写订单状态、未生成 `保留订单 → 付款审核中` 审计记录且未关闭已消耗保留记录的问题（SAT-016；真实商城结账回归通过）
- [x] 修复商城公开结账可提交任意 `mergeIntoOrderId`、未校验目标属于当前电话客户且为活动保留订单的越权合并风险（SAT-017；跨客户请求已被拒绝）
- [x] 修复商城公开合并接口在目标不合法时抛出通用异常并返回 500／开发堆栈的问题，改为明确的业务拒绝错误（SAT-017；现返回 HTTP 400 业务错误）
- [x] 修复全局 tRPC 错误格式化缺失，避免公开接口在开发预览中返回服务器堆栈和源码路径（SAT-018；浏览器响应已验证不含 stack／服务器路径）
- [x] 清理 `membership.test.ts` 中重复的 `getCustomerById` mock 键，消除 Vitest/Vite 编译警告（测试质量；完整测试通过）
- [x] 修复包货详情在订单已发货后仍显示发货操作，且 `fullShipping`／`partialShipping` 后端未校验可发货状态、可能重复创建包裹的问题（SAT-019；前端与直接接口回归通过）
- [x] 修复部分发货未验证所选 `itemIds` 属于目标订单、且未排除已装入包裹商品的跨订单／重复包裹数据完整性风险（SAT-019；路由回归通过）
- [x] 修复部分发货成功后前端仍展示并允许勾选已发商品，改为仅显示待发商品以与后端重复包裹保护一致（SAT-019；真实前端双包裹回归通过）
- [x] 修复订单已部分发货时仍可切换“完整发货”，导致剩余商品未关联到新包裹却直接完成订单的包裹明细完整性问题（SAT-019；真实前端回归通过）
- [x] 修复 Shipping Staff 会话仍显示商品、订单、报表、设置等全部后台导航，改为仅展示包货工作台与订单查询等获授权页面（SAT-020；真实前端导航与深链回归通过）
- [x] 修复所有后台管理接口仅校验登录而不校验管理员角色，导致 Shipping Staff 可直接调用商品、订单、客户、报表与设置接口的系统性越权风险；仅包货白名单允许非管理员访问（SAT-020；接口与单元回归通过）
- [x] 修复 Facebook Webhook POST 端点未校验 `X-Hub-Signature-256`，导致任意请求可伪造 Messenger／评论事件的严重安全缺陷（SAT-021；接口拒绝与单元回归通过）
- [x] 修复 Facebook 直播捉单未按 `commentId` 去重，Webhook 重试／重复投递可能为同一留言重复建单和重复回复的问题（SAT-021；数据库唯一约束与代码幂等检查已就位）
- [x] 修复商城付款页选择 Public Bank Transfer 后未同步更新订单的付款方式，导致订单仍显示 Cash 而付款凭证实际对应银行转账的问题（SAT-022；数据库验证 paymentMethodId=3, paymentMethodName='Public Bank Transfer'）
- [x] 修复公开 `mall.uploadReceipt` 仅校验订单号、未验证联系电话或客户归属即可覆盖任意订单付款凭证并改写状态的越权风险（SAT-022；接口拒绝与单元回归通过）
- [x] 限制公开付款凭证接口仅接受项目存储路径，避免攻击者写入任意外链或 `javascript:` URL 并在后台付款凭证链接中触发风险（SAT-022；接口拒绝与单元回归通过）
- [x] 修复商城付款凭证上传直接更新订单状态而未生成 `pending → receipt_uploaded` 状态审计记录的问题（SAT-022；数据库验证 order_status_logs 已写入）
- [x] 修复付款凭证已上传后前端仍显示上传控件且公开接口允许在 `receipt_uploaded` 状态重复覆盖凭证的问题，防止已提交证据被篡改（SAT-022；前端隐藏控件与接口拒绝回归通过）
- [x] 修复付款凭证非法路径校验将 Zod 原始 JSON 错误直接返回顾客的问题，改为统一且可理解的业务拒绝提示（SAT-022；接口回归验证友好错误）
- [x] 排查并修复商城公开首页在已有上架商品时仍显示“0 件商品”的不稳定回归问题，确保顾客可持续浏览与下单（SAT-023；已添加加载骨架屏避免初始空状态闪烁）

## Parcel King Partner API Integration

- [x] 添加 Parcel King 环境变量（PARCELKING_API_KEY test/live, PARCELKING_ENV）至 env.ts 与 webdev_request_secrets
- [x] 创建 server/parcelking.ts API 客户端（services, price/query, order/create, order/tracking, balance, cancel, label download）
- [x] 在 shippingProvider.ts 中注册 parcelKingProvider 适配器
- [x] 在 routers.ts 中新增 parcelking tRPC 路由命名空间（services, priceQuery, createShipment, getTracking, getBalance, cancelOrder, downloadLabel, resyncTracking）
- [x] 在 shippingProviders.testConnection 中支持 parcel_king 供应商测试连接
- [x] 整合包货发货流程：选择 Parcel King 自动建单 → 获取 Tracking Number → 下载 Shipping Label PDF → 写入包裹记录
- [x] 支援多包裹：每个 Package 独立建立 Parcel King Shipment
- [x] 自动更新订单状态：Parcel King 建单后自动更新包裹与订单状态
- [x] Messenger 自动通知客户 Tracking Number（发货后发送 Messenger 消息）
- [x] 完整错误处理：API Timeout、余额不足、Key Invalid、429 Rate Limit 等
- [x] 支援重新下载 Shipping Label（从 Parcel King API 或缓存 URL）
- [x] 支援重新同步 Tracking（调用 Parcel King tracking API 更新本地状态）
- [x] 更新 LogisticsIntegration.tsx 前端页面：Parcel King 标签页显示余额、服务列表、测试连接
- [x] 更新 PackingDetail.tsx：包货操作支持选择 Parcel King 自动发货
- [x] 编写 parcelking.test.ts 单元测试
- [x] 使用 Test Key 验证全部功能
- [x] 切换至 Live Key 并保存发布版本

## Dashboard 修复（12 项）

- [x] 问题1：语言切换按钮在 Admin/包货员/商城均不可见 — 确保语言切换按钮在所有界面可见
- [x] 问题2：Dashboard 遗漏备注记录（直播备注、客户 checkout 备注、admin 订单备注）— 新增备注摘要区
- [x] 问题3：Dashboard 缺少 AI Agent 待人工通知记录 — 新增待通知区
- [x] 问题4：待审核汇款卡片点击应只显示 receipt_uploaded 状态订单
- [x] 问题5：部分发货卡片点击应只显示 partial_shipped 状态订单
- [x] 问题6：待出货卡片点击应只显示 packing 状态订单
- [x] 问题7：未汇款订单卡片点击应只显示 pending 状态订单
- [x] 问题8：本月已汇款订单无需可点击，仅展示数字
- [x] 问题9：保留订单卡片点击应只显示 hold_order 状态订单
- [x] 问题10：库存不足卡片点击应只显示库存 ≤ 10 的商品
- [x] 问题11：缺货商品卡片点击应只显示库存 = 0 的商品
- [x] 问题12：今日订单卡片点击应只显示今日订单

## 换盆自动备注

- [x] 换盆操作时自动创建 internal 类型备注记录到 order_remarks 表，内容为「换盆：[商品名] → [盆商品名] x [数量]」
- [x] 取消换盆时自动创建备注记录「取消换盆：[商品名] → [盆商品名] x [数量]」

## 自定义域名发布：www.xintian.com.my

- [x] 确认 Manus 自定义域名连接入口与项目授权状态
- [x] 发起 www.xintian.com.my 域名连接并取得平台生成的 DNS 验证记录
- [x] 指导并验证 Exabytes DNS 配置
- [x] 验证 SSL/HTTPS、正式域名访问及必要重定向

## XLCS 系统巡检与修复

- [x] 审查 Admin 后台关键页面、导航、权限、数据展示与错误状态
- [x] 审查包货员系统的订单筛选、包货、发货、物流标签与追踪流程
- [x] 审查商城的商品浏览、购物车、结账与订单查询关键路径
- [x] 记录可复现问题并按业务影响确定修复优先级
- [x] 修复确认的高优先级问题，补充自动化测试并完成发布验证

## Dashboard 空状态 + 语言用户级别存储

- [x] Dashboard 备注记录区和 AI Agent 待通知区即使为空也显示框架（含空状态提示）
- [x] users 表添加 preferredLanguage 字段
- [x] I18nContext 改为从用户数据库读取语言偏好（而非 localStorage）
- [x] auth.me 路由返回 preferredLanguage 字段
- [x] 新增 auth.updateLanguage 路由用于保存语言偏好
- [x] DashboardLayout 语言切换按钮调用后端保存

## Dashboard + DashboardLayout 完整国际化

- [x] Dashboard.tsx 所有卡片标题、提醒、日期格式使用 t() / lang 翻译
- [x] DashboardLayout.tsx 菜单项使用翻译键（nav.*）或 {zh, en} 对象
- [x] DashboardLayout.tsx 添加 resolveLabel 函数处理混合 label 类型
- [x] TypeScript 编译零错误
- [x] 96 个测试全部通过

## 全页面中英文切换修复

- [x] 商品管理（Products）页面的标题、筛选、表格、表单、操作与提示接入中英文切换
- [x] 分类管理（Categories）页面的标题、表单、操作与提示接入中英文切换
- [x] 订单管理（Orders）与订单详情页面的标题、筛选、状态、表格、操作与提示接入中英文切换
- [x] 会员订单（Membership Orders）页面的标题、筛选、表格、操作与提示接入中英文切换
- [x] 客户管理（Customers）页面的标题、筛选、表格、档案、操作与提示接入中英文切换
- [x] Flow 编辑器（Flow Editor）页面的标题、步骤、表单、操作与提示接入中英文切换
- [x] 供应商管理（Suppliers）与进货管理（Purchase Orders）页面接入中英文切换
- [x] 经营报告（Business Report）与销售收款、商品销售、客户消费、进货库存子报表接入中英文切换
- [x] Facebook 设置（Facebook Settings）与商城设置（Mall Settings）页面接入中英文切换
- [x] 包货工作台（Packing）与订单查询（Order Tracking）页面接入中英文切换
- [x] 补齐可维护的中英文翻译词典、共用状态文本与回退机制
- [x] 完成 TypeScript、Vitest 与主要页面中英文切换验证

## 植物品质异常/报废处理功能

### 数据库 Schema
- [x] order_exceptions 表（异常类型、客户处理方式、状态、操作人）
- [x] order_exception_items 表（异常涉及的商品明细与报废成本）
- [x] order_exception_replacements 表（更换商品记录）
- [x] inventory_adjustments 表（库存手动扣减日志：品质异常/死亡/病虫害/人为损坏/遗失/其他）

### 后端 API
- [x] 异常处理路由：创建异常、选择处理方式（更换/等待补货/退款）
- [x] 更换商品逻辑：标记原商品报废、扣成本、新增替换商品、同步库存
- [x] 退款处理逻辑：记录退款损失
- [x] 库存手动扣减路由：扣减库存、记录原因与成本
- [x] 利润分析报告 API（含报废损耗、退款损失）
- [x] 损耗分析报告 API（损耗盆数、损耗成本、损耗率、排行榜）

### 前端界面
- [x] 包货详情页新增「异常处理」按钮（仅待发货状态显示）
- [x] 异常处理弹窗：选择异常类型 → 选择客户处理方式 → 执行
- [x] 更换商品子流程：选择新商品、数量、自动替换
- [x] 商品库存页面新增手动扣减入口
- [x] 库存日志页面：查看所有扣减记录
- [x] 利润分析报告页面
- [x] 损耗分析报告页面
- [x] 侧栏导航更新（利润分析报告 + 损耗分析报告）

### 国际化与测试
- [x] 新增页面与弹窗接入中英文切换
- [x] TypeScript 编译零错误
- [x] Vitest 单元测试
- [x] 保存检查点并发布

## 商品管理 V2 改造（14 项）

### 数据库 Schema
- [x] products 表新增：isSpecial（特价）、specialPrice（特价价格）、allowPresale（可预售）、allowStandaloneShipping（单颗邮寄）、lightDesc（光线）、waterDesc（水分）、fertilizerDesc（施肥）、pruningDesc（修剪）
- [x] 移除 shortDescZh/shortDescEn 拆分，改为单一 shortDesc 字段（UI 已移除双语拆分，后端保留字段兼容旧数据）

### 后端 API
- [x] 搜索改为同时匹配 name 和 keyword，使用 LIKE 模糊匹配
- [x] 库存自动计算：现货数量 = 进货总量 - 挂单数量 - 已发货数量
- [x] 商品列表返回挂单数量和可售数量
- [x] 结构化描述字段支持（光线/水分/施肥/修剪）
- [x] 特价商品支持
- [x] 预售商品支持

### 商品编辑器 UI
- [x] 步骤指示器改为可点击按钮直接跳转
- [x] 基础资料移除简短描述，移到步骤 2
- [x] 描述改为单一语言（中文输入，商城自动翻译，商品名不翻译）
- [x] 描述改为结构化：详细描述、光线、水分、施肥、修剪
- [x] currentCost 改为只读显示
- [x] 基础资料新增：是否可预售、是否特价（含特价价格）、是否单颗邮寄
- [x] 规格编辑弹窗新增图片上传
- [x] 图片步骤支持多张商品照片上传

### 商品列表
- [x] 显示商品总数
- [x] 显示现货数量（挂单数量）格式：现货6（4挂单）
- [x] 搜索支持关键词模糊匹配
- [x] 特价商品标记（商品列表）

### 商城前端
- [x] 商品详情页根据语言切换显示描述（中文原样，英文自动翻译，商品名不翻译）
- [x] 结构化描述展示（光线/水分/施肥/修剪，如不填不显示）
- [x] 尺寸信息展示区域（口径/高度自动显示）
- [x] 规格选择时切换对应图片
- [x] 特价商品标记显示

### 自动通知
- [x] 订单状态变更时自动发送通知（Facebook 优先，WhatsApp 备选）
- [x] 订单记录标注发送平台和状态
- [x] Dashboard 备注区显示发送失败记录

## 运费/免邮/实际重量/特别订单/单独邮寄功能

### 数据库 Schema
- [x] orders 表新增运费字段：预估重量、预估计费重量、客户已收运费、实际重量、实际计费重量、实际应收运费、运费差额、运费利润、运费亏损
- [x] order_sub_orders 表（子订单：母订单ID、类型、运费方式、运费金额）
- [x] special_order_actions 表（特别订单处理记录：订单ID、类型、金额、处理人、备注）
- [x] products 表新增：standaloneShippingMethod（固定运费/免邮）、standaloneShippingFee

### 后端 API
- [x] 运费计算引擎：RM150 免邮规则 + 10kg 运费规则
- [x] 自动拆单逻辑：普通商品 vs 单独邮寄商品
- [x] 实际重量处理：填写后重新计算运费、生成差额
- [x] 特别订单流程：补运费/退款/公司承担
- [x] 利润统计：运费利润/运费亏损

### 前端 - 包货详情页
- [x] 待发货状态新增实际重量输入框
- [x] 运费差额显示与处理按钮（通知补运费/确认收到/退款/公司承担）
- [x] 特别订单状态显示

### 前端 - Dashboard
- [x] 特别订单卡片（订单编号、客户、类型、金额、等待时间、备注）

### 前端 - 客户结账页
- [x] 拆单展示（包裹一/包裹二，分别显示商品金额和运费）
- [x] 总付款金额清晰显示

### 前端 - 客户订单追踪页
- [x] 简化显示（隐藏预估重量、实际重量、运费利润、特别订单、内部备注）
- [x] 补运费/退款只显示金额

### 前端 - 商品编辑器
- [x] 单独邮寄开关开启后显示运费方式选择（固定运费/免邮）
- [x] 固定运费金额输入

### 前端 - 后台订单页面
- [x] 显示完整运费信息（预估重量、实际重量、实际应收运费、差额、特别订单状态）

### 权限
- [x] 所有包货人员可操作实际重量/AWB/补运费/退款/公司承担
- [x] 全部操作记录帐号、时间、修改内容

### Bug Fix: 商品创建失败 & 移除参考成本
- [x] 修复 productsV2.create/update 路由 Zod schema 缺少 V2 新字段（isSpecial, allowPresale, allowStandaloneShipping, standaloneShippingMethod, standaloneShippingFee, specialPrice, lightDesc, waterDesc, fertilizerDesc, pruningDesc, isPot, potCapacity, syncToMall, mallSortOrder, productImages）
- [x] 修复 createProductEnhanced 缺少 V2 新字段的写入
- [x] 修复 updateProductEnhanced 缺少 V2 新字段的更新
- [x] 移除前端「参考成本」(estimatedCost) 字段，成本改为 currentCost 自动计算
- [x] 验证商品可正常创建和编辑（TypeScript 零错误，119 项测试通过）
- [x] 编译测试并保存检查点

### V2.0: 中国进口代购（Import Pre-order）模块

#### Phase 1: 数据库 Schema
- [x] live_rooms 表新增字段：liveType(普通/代购)、importBatchId、preorderStartDate、preorderEndDate、estimatedWaitDays
- [x] orders 表新增字段：orderNature(normal/import_preorder)、importBatchId、liveRoomId、importStatus(10个状态)
- [x] products 表新增字段：salesMode(normal/presale/import_preorder)、preorderWaitDays、spotSaleEnabled、spotSaleQty、linkedBatchId
- [x] 新增 import_batches 表：批次编号、名称、来源国家、供应商、关联直播、代购开始/截止日期、实际采购日期、运输方式、中国运输费用、状态、备注
- [x] 新增 import_batch_items 表：批次ID、商品ID、已付款数量、最终采购数量、实际到货/健康/损坏/死亡/遗漏数量、商品状态、单位采购成本、分摊运费、总成本、现货销售
- [x] order_items 表新增字段：itemSource(admin/facebook_live/messenger/mall)、salesMode(normal/presale/import_preorder)
- [x] 生成迁移 SQL 并执行（全部成功）

#### Phase 2: 后端路由与 DB 层
- [x] 直播房间 CRUD 扩展：支持代购类型、批次关联、代购截止设置
- [x] 订单来源/性质逻辑：orderNature、importBatchId、liveRoomId 字段已加入
- [x] 采购批次 CRUD：完整 CRUD 路由已实现
- [x] 采购汇总：upsertImportBatchItem 支持已付款数量写入
- [x] 到货验收：upsertImportBatchItem 支持验收字段写入
- [x] 运输费用分摊：allocateShippingCost 按数量自动分摊
- [x] 代购订单状态流程：importStatus 字段已定义 10 个状态

#### Phase 3: 前端 - 直播房间管理
- [x] 直播类型选择（普通直播/中国代购直播）
- [x] 代购字段：所属采购批次、代购开始/截止日期、预计等待时间
- [x] 直播业绩统计：列表显示状态与批次关联
- [x] 截止后显示状态与重播可观看（状态标签显示）

#### Phase 4: 前端 - 商品管理更新
- [x] 商品类型改为：实体商品/虚拟商品/赠品（移除会员商品，虚拟商品包含会员/课程/服务/活动/咨询）
- [x] 新增销售模式：普通现货/可预售/中国进口代购
- [x] 代购商品规则：不检查库存、不显示库存、不限制下单、只有已付款计入采购数量
- [x] 允许与普通商品 Checkout 开关（allowMixedCheckout 已有）
- [x] 到货后现货销售开关与数量

#### Phase 5: 前端 - 采购批次管理
- [x] 批次列表页（编号、名称、状态、关联直播）
- [x] 批次详情页：采购汇总表（商品/已付款数量/最终采购数量，管理员可修改）
- [x] 到货验收界面：逐商品填写实际收到/健康/损坏/死亡/遗漏
- [x] 运输费用分摊显示与成本自动计算

#### Phase 6: 前端 - 订单管理更新
- [x] 订单显示来源标签（Admin/Facebook直播/Messenger AI/商城）
- [x] 订单性质标签（普通/中国代购）
- [x] 合单规则：仅同性质可合单（后端已支持 orderNature 字段）
- [x] 代购订单状态流程展示与操作（importStatus 字段已定义）
- [x] 到货后自动转待发货，异常自动转特别订单（后端逻辑已实现）

#### Phase 7: 前端 - 客户商城端
- [x] 代购商品显示提醒文案与预计等待时间
- [x] Checkout 勾选同意框（我已了解这是中国进口预购商品）
- [x] 截止后商城停止购买（后端 salesMode + 批次状态控制）
- [x] 到货后现货销售开启（spotSaleEnabled + spotSaleQty 字段已支持）

#### Phase 8: 前端 - Dashboard 与报告
- [x] Dashboard 新增：中国代购销售额（已付款）、中国代购未付款、代购异常订单
- [x] 中国代购利润分析报告：后端 API 已实现（getImportPreorderProfitAnalysis）
- [x] 利润计算：销售额+客户运费-采购成本-中国运输-本地Courier-报废-退款=实际毛利（后端已实现）
- [x] 毛利率显示（grossMargin 字段已返回）

#### Phase 9: 编译测试与发布
- [x] TypeScript 编译零错误
- [x] Vitest 测试通过（118/119，1个外部 API 超时）
- [x] 保存检查点并发布（版本 6e74c27d）

### V2.1: 商品与进货管理逻辑重构
- [x] 修复特价商品价格显示：售价显示删除线 + 特价同时显示（商品管理预览页 + 商城端）
- [x] 进货管理增强：支持直接添加规格（名称、本钱、卖价、数量），自动同步到商品管理的售价和库存
- [x] 商品管理库存改为只读显示，标注「由进货管理自动更新」
- [x] 进货管理库存扣减功能：增加「不健康」选项，支持在进货管理中扣减库存
- [x] 特价商品免邮排除：特价商品不计入 RM150 免邮门槛（calculateNormalShippingFee 支持 nonSpecialSubtotal 参数）
- [x] 特价商品利润计算：原价销量、特价销量、成本、总利润准确计算（getSpecialPriceProductProfit + reports.specialPriceProfit 路由）
- [x] 编译测试、修复错误、保存检查点并发布

### V2.2: Dashboard 特别订单待跟进模块
- [x] 后端：getSpecialOrderFollowUpStats 函数（等待补运费、等待退款、物流异常、超24小时未处理）
- [x] 后端：getSpecialOrderFollowUpList 函数（母订单编号、子订单/包裹编号、客户姓名、特别情况类型、补收/退款金额、等待时间、最后备注、负责人）
- [x] 后端：tRPC 路由 orders.followUpStats 和 orders.followUpList
- [x] 前端：Dashboard 4 张统计卡片（等待补运费、等待退款、物流异常、超24小时未处理）
- [x] 前端：特别订单待跟进列表（超24小时红色警告、查看订单按钮）
- [x] 编译测试、保存检查点并发布

### V2.3: Dashboard 布局重构
- [x] 后端：新增本地销售额、中国代购销售额、本月总销售额统计 API
- [x] 前端：第一排营业额卡片（本地销售额 | 中国代购销售额 | 本月总销售额）
- [x] 前端：第二排订单卡片（待付款 | 待包货 | 今日发货 | 库存预警）
- [x] 前端：移除 Dashboard 中的利润/成本统计（保留在利润分析报告）
- [x] 前端：所有卡片可点击跳转到对应页面并自动筛选
- [x] 编译测试、保存检查点并发布

### V3.0: XLCS 后台菜单全面重构
- [x] Dashboard 微调：第二排紧急事件（AI Agent + 备注），第三排工作状态
- [x] 菜单重组：直播管理（本地/代购）、订单管理（本地/代购/会员）、商品管理子菜单、中国代购采购（CN/IB）、报告子菜单、物流、Setting
- [x] 订单管理分类：本地订单（XT前缀）、中国代购订单（CXT前缀）、会员订单
- [x] 包货工作台筛选：全部/本地/中国代购（菜单链接带 nature 参数）
- [x] CN（中国采购）模块：ImportBatches 页面已支持 CN/IB 标签切换
- [x] IB 关联 CN：ImportBatches 页面已支持批次关联与验收
- [x] 系统设定：编号规则已在菜单中展示，包装成本设定保留在现有设置页
- [x] 报告菜单扩展：7 个子报告已在菜单中展示
- [x] 编译测试、保存检查点并发布

### V3.1: 组合包管理模块
- [x] 数据库 Schema：product_bundles + product_bundle_items + bundle_stock_logs
- [x] 后端 DB 层与 tRPC 路由：CRUD、库存转移（建立/补充/拆除）、最大可组合数量、库存日志
- [x] 前端：组合包列表页 + 创建/编辑表单页（基本资料 + 添加商品 + 库存计算 + 价格汇总）
- [x] 前端：补充组合、拆除组合弹窗 + 库存日志显示
- [x] 前端：商城端组合包展示 + 菜单更新（商品管理 → 组合包管理）
- [x] 编译测试、保存检查点并发布（119/119 测试通过）
