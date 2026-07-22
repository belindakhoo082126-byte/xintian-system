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
