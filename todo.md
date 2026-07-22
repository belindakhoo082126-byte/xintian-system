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

- [ ] Facebook Messenger API 实际发送集成（目前为模拟发送）
- [ ] Facebook Live 直播捉单功能
- [x] 客户端商城前端（商品浏览、购物车、结账）
- [x] 汇款单据上传 API（S3 存储集成）
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
- [x] 图片上传（S3）— 已完成（商品封面、QR 图片、横幅图片）
- [ ] 影片上传 — V1.1 规划
- [x] 规格管理（关键词冲突检测）
- [x] 价格模拟器
- [x] 预计利润显示

### Sprint 3: 会员链接与预览
- [x] 会员链接生成/重新生成/停用
- [x] 普通商品预览 (/product/:id)
- [x] 会员商品预览 (/m/:token)
- [x] 商品复制功能
- [ ] 中英文切换 — V1.1 规划

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
