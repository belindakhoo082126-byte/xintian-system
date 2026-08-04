# XLCS CHANGELOG

本文件记录 **XLCS（心田直播捉单与商城系统）** 已完成并经验证的版本更新。每个阶段或版本完成后，必须在本文件新增对应条目；未完成、仅规划或仅讨论的功能不得记为已发布。

## 版本编号规则

| 级别 | 格式 | 使用原则 | 示例 |
|---|---|---|---|
| Major | `Vx.0` | 一个重大业务阶段完成并可验收 | `V1.0`：AI大脑 Phase 1 |
| Minor | `Vx.y` | 对已发布 Major 版本的功能优化 | `V1.1`：Dashboard 优化 |
| Patch | `Vx.y.z` | 缺陷修复、兼容性修复或小范围可靠性修复 | `V1.1.1`：Messenger 缺陷修复 |

> **维护规则：** 每次交付必须记录新增（Added）、修改（Changed）、修复（Fixed）、移除（Removed，如适用）、数据库（Database）和重要说明（Notes）。未实际执行的未来规划不列入版本内容。

---

## V1.0 — AI大脑 Phase 1

**发布日期：** 2026-07-30  
**开发阶段：** AI大脑 Phase 1 正式封版（Version 1.0）

### Added

- 新增 `/ai-brain` 作为心田 AI 系统的统一管理中心，提供总控制台、AI人设、AI知识库、固定回复，以及预留的 AI测试与 AI分析分页。
- 新增 AI总控制台，集中显示 Messenger、Database、Webhook、SSE 即时同步、Flow Engine、Reply Rule Engine、Knowledge Engine 与 Chat 的真实运行状态。
- 新增来自真实数据库的今日 AI 运营统计，包括客户对话、AI回复、人工回复、转人工、无法回答、Flow触发、固定回复触发、知识库触发、AI自动解决率及人工接手率。
- 新增真实 AI提醒，覆盖 AI无法回答、待处理转人工、Messenger Token、Webhook 状态与未发布知识条目。
- 新增 AI人设管理，包括 AI名称、品牌名称、AI自称、客户称呼、回复语气、默认语言、支持语言、Emoji 使用程度、回复长度、主动推荐、主动询问、结束语、AI回复原则与高级提示词。
- 新增不真实发送给客户的 AI人设即时预览；预览会根据当前表单内容生成模拟回复。
- 新增知识库与固定回复的真实使用次数和最后命中时间追踪。
- 新增 AI回复来源保存，以便统计固定回复、知识库、商品与其他 AI 回复的真实触发情况。

### Changed

- AI客服菜单统一为：Chat 客服、AI 转人工通知、AI 大脑、Flow 管理、直播AI。
- 「直播 AI客服」统一更名为「直播AI」。
- 固定回复规则与 AI知识库保留原有路由和数据表，但统一整合进 AI大脑分页，不再作为 AI客服侧边栏的长期独立主入口。
- AI运行状态卡片改为核心服务优先：第一排为 Messenger、Database、Webhook、SSE 即时同步；第二排为 Flow Engine、Reply Rule Engine、Knowledge Engine、Chat。
- AI知识库后台分类统一为中文：运费、会员、商品、植物养护、售后、发货、付款、常见问题、其他。
- AI人设的支持语言调整为中文、English、Bahasa Melayu 多选；「CTA文案」调整为「结束语（Closing Message）」。
- AI人设预览改为读取当前未保存的表单设置，管理员无需先保存即可测试人设与 AI回复原则。
- 知识库与固定回复即使尚未命中，也会明确显示「使用 0 次」及「最后命中：尚无记录」。

### Fixed

- 修复 AI人设即时预览在部分模型响应下出现空回复内容的问题，并提供稳定的空内容处理。
- 修复 AI回复原则在预览中的优先级不足问题，确保模拟回复会纳入当前人设与原则。
- 修复知识库与固定回复零命中时隐藏统计信息的问题。
- 保持人工接手期间 Flow Engine、Reply Rule Engine 与 Knowledge Engine 不自动发送回复的既有行为。

### Removed

- 移除 AI客服侧边栏中「固定回复规则」与「AI知识库」作为独立长期主菜单的入口；原路由继续保留，仅用于兼容既有链接。

### Database

- 新增 `ai_persona`，持久化 AI人设与品牌回复策略。
- 扩展 `ai_persona`，加入 `reply_principles` 用于维护 AI回复原则。
- 扩展 `ai_knowledge`，加入真实 `usage_count` 与 `last_matched_at` 命中指标。
- 扩展 `reply_rules`，加入真实 `usage_count` 与 `last_matched_at` 命中指标。
- 扩展 `chat_messages`，加入 `ai_response_source`，记录 AI回复来源以支持真实统计。
- 已将既有 AI知识库英文分类迁移为中文分类，不新建第二套 Knowledge 或 Reply Rules 数据。

### Notes

- AI知识库与固定回复仍使用既有 `ai_knowledge` 与 `reply_rules` 数据表和业务逻辑；AI大脑只负责统一入口与管理体验。
- AI测试、AI分析仅保留页面预留状态，AI日志、AI测试中心、AI学习建议、AI分析、回复模板与 AI规则未在 V1.0 开发，将在后续阶段统一规划。
- 本版本的运行指标、命中计数与提醒均从真实系统状态及数据库读取，不使用模拟统计数据。

---

## V1.1 — AI大脑 Phase 2 Task 1: AI日志（AI Log Center）

**发布日期：** 2026-07-30  
**开发阶段：** AI大脑 Phase 2 Task 1

### Added

- 新增 `ai_logs` 数据表，记录每条 AI处理的主日志（客户消息、回复来源、发送状态、转人工、处理时间、错误信息等）
- 新增 `ai_log_delivery_attempts` 子表，记录每次发送尝试（平台消息ID、发送状态、错误信息），与主日志 CASCADE DELETE
- 新增 `AiProcessingContext` 类（`server/aiLogContext.ts`），统一收集 AI处理轨迹，`finalize()` 产生结构化日志记录
- 新增 `db.ts` AI日志辅助函数：`createAiLog`、`updateAiLogAfterSend`、`addDeliveryAttempt`、`updateDeliveryAttempt`、`getAiLogs`（分页与来源、状态等筛选）、`getAiLogDetail`、`getAiLogStats`、`cleanupOldAiLogs`
- 新增 tRPC `aiLog` router：`list`、`getDetail`、`getStats`、`getCleanupPreview`、`retryDelivery`（均为 adminProcedure）
- 新增 SSE `SyncCategory` 中 `"aiLog"` 类型，支持日志实时推送
- 新增 `/api/scheduled/ai-log-cleanup` 定时清理端点，通过 `AI_LOG_RETENTION_DAYS` 环境变量控制保留期限（默认90天）
- 新增 `AiBrainLog.tsx` 前端页面：统计摘要、事件来源等筛选器、分页列表、展开处理轨迹、发送尝试记录、Flow 事件审计信息与 Chat 跳转
- 新增 AI大脑第5个 Tab「AI日志」，位于固定回复与 AI测试之间
- 新增 `AI_LOG_RETENTION_DAYS` 环境变量注册（`server/_core/env.ts`）
- 新增 `server/aiLogRetry.ts` 发送重试服务：对 failed 私聊日志新增发送尝试、递增 retryCount，成功后更新主日志与 chat_messages 状态
- 新增 AI日志详情页「重试发送」按钮，管理员可安全重试失败的 Messenger 私聊回复

### Changed

- `processChatAI` 新增可选 `logContext?: AiProcessingContext` 参数，各引擎步骤调用 `logCtx.addStep()` 记录处理轨迹，不改变原有返回结构
- `messenger.ts` 的私聊与 Facebook Flow 评论处理均集成完整 AI日志写入生命周期（pending → delivery attempt → sent/failed → update）
- `addChatMessage` 返回值改为 `{ success, messageId }`
- `storeIncomingMessengerMessage` 返回值改为 `{ conversationId, customerMessageId, customerId, customerName }`
- `AiBrain.tsx` TabsList 从 `grid-cols-6` 改为 `grid-cols-7`，新增 AI日志 Tab
- `AiBrainDashboard.tsx`「查看AI日志」按钮从 disabled 改为可点击，跳转到 AI日志 Tab
- Facebook Live、Post 与 Reel 的 Flow 命中会使用 `sourceType`、`sourceEventId`、`sourceBindingId` 与 `matchedFlowId` 记录真实事件，不创建伪 Chat 对话
- AI日志筛选器新增事件来源；Flow 日志详情显示来源事件 ID 与绑定 / Flow ID

### Fixed

- 修正发送尝试生命周期：先创建 `pending` 子记录，发送后更新同一条记录，并同步主日志的最终状态、平台消息 ID、错误结构与总处理耗时。
- 修正 `aiLog` SSE 客户端缓存刷新映射，并新增双客户端广播回归测试。
- 修正 Facebook 评论回复失败时的结构化错误写入；日志写入与更新失败不会阻断客户回复流程。
- 修正 AI日志详情中发送记录 `attemptedAt` 时间戳显示为 Invalid Date 的问题。
- 修正 `/ai-brain?tab=log` 深链接未正确打开 AI日志标签的问题。

### Removed

- 

### Database

- 新增 `ai_logs` 表（包含可空 `conversationId`、`sourceType`、`sourceEventId`、`sourceBindingId`、`matchedFlowId`、平台消息关联、处理轨迹 JSON、结构化错误、发送状态与处理时间）
- 新增 `ai_log_delivery_attempts` 表（id, aiLogId FK CASCADE, attemptNumber, platformMessageId, sendStatus, errorMessage, createdAt）
- 迁移文件：`drizzle/migrations/0007_ai_logs.sql`

### Notes

- AI日志仅 Admin 可查看，包货员不可进入
- 日志写入失败不可影响客户消息收发（try/catch 隔离）
- 同一客户消息只建立一条主日志，重试使用 `ai_log_delivery_attempts` 子表记录
- 所有统计使用主日志计算，不把重试误算为新处理次数
- 普通 Messenger／WhatsApp 私聊不会进入 Flow Engine；Facebook Live、Post、Reel 的 Flow 命中以独立来源事件日志记录，且不创建伪私聊对话。
- AI测试和 AI分析继续保持「即将开发」状态
- 本阶段不开发 AI日志以外的 Phase 2 功能

---

## V1.2 — AI大脑 Phase 2 Task 2：AI测试中心

**发布日期：** 2026-07-30  
**开发阶段：** AI大脑 Phase 2 Task 2 正式封版

### Added

- 新增 `ai_test_runs` 数据表，独立保存 AI测试记录（测试问题、配置、处理轨迹、命中来源、回复、转人工、LLM追踪、人设快照、测试人、备注），与 `ai_logs` 完全物理隔离
- 新增 `SideEffectPolicy` 统一副作用拦截层（`server/aiTestRunner.ts`），在 dry_run 模式下对发送、建对话、建消息、建转人工、递增使用次数、写 AI日志、建订单、发通知、触发 Flow 共 9 类操作抛出错误并记录 violation 日志
- 新增 `aiTestRunner.ts` 测试运行服务：复用正式 `processChatAI` 引擎（dryRun=true），收集完整处理轨迹，不产生任何正式副作用
- 新增 `db.ts` AI测试辅助函数：`getTestRuns`、`getTestRunDetail`、`deleteTestRun`、`batchDeleteTestRuns`、`cleanupOldTestRuns`（180天保留）、`checkDuplicateKnowledge`、`createKnowledgeDraft`
- 新增 tRPC `aiTest` router：`run`、`list`、`getDetail`、`delete`、`batchDelete`、`rerun`、`compare`、`convertToDraft`（均为 adminProcedure）
- 新增 `/api/scheduled/ai-test-cleanup` 定时清理端点（180天保留）
- 新增 `AiBrainTest.tsx` 前端页面：左侧配置面板（渠道/语言/AI/LLM/人工状态/模拟客户名）、右侧结果面板（来源Badge/回复/LLM追踪/处理轨迹/错误信息）、底部历史记录表格（展开轨迹/重新运行/转草稿/删除/比较）
- 新增 AI大脑第6个 Tab「AI测试」，替换原 ComingSoon 占位
- 新增「转为知识库草稿」功能：Admin 确认后创建 `status=draft`、`isEnabled=false` 的知识条目，自动查重，保存 `sourceAiTestRunId`，不参与正式引擎匹配
- 新增模拟测试标识固定顶部显示：「模拟测试 — 不会发送给客户 · 不会建立对话 · 不影响正式统计」

### Changed

- `processChatAI` 及各引擎函数新增可选 `dryRun` 参数，正式处理路径行为不变
- `ai_knowledge` 表新增 `status`（enum: published/draft，默认 published）、`sourceAiTestRunId`（int nullable）、`sourceNote`（varchar nullable）字段
- 知识库查询增加 `status='published'` 过滤条件，草稿不参与正式引擎匹配
- `AiBrain.tsx` 的 `AI_BRAIN_TABS` 新增 `test`，test Tab 从 disabled 改为 enabled

### Fixed

- 无

### Removed

- 无

### Database

- 新增 `ai_test_runs` 表（id, testRunId, testedBy, platform, language, aiEnabled, handoverStatus, enableLLM, simulatedCustomerName, isMember, hasOrder, testMessage, finalSource, matchedRuleId, matchedKnowledgeId, matchedProductId, aiReply, shouldHandover, handoverReason, processingTimeMs, processingSteps JSON, errorCode, errorStage, errorMessage, llmCalled, llmModel, llmProcessingTimeMs, llmSuccess, llmErrorStage, llmErrorCode, llmTimedOut, llmInputTokens, llmOutputTokens, personaSnapshot JSON, previousRunId, createdAt）
- 扩展 `ai_knowledge` 表：新增 `status`、`sourceAiTestRunId`、`sourceNote` 字段
- 迁移文件：`drizzle/migrations/0008_ai_test_runs.sql`

### Notes

- AI测试中心仅 Admin 可使用
- 测试运行不发送 Messenger/WhatsApp 消息、不建立 Chat 对话/消息、不创建转人工请求、不递增规则/知识库使用次数、不写入 `ai_logs`、不触发订单/通知/Flow
- 模拟会员/订单选项设为禁用状态，标注「尚未接入，未来开放」
- AI测试记录与正式 AI日志物理隔离，Dashboard/AI日志/AI分析统计默认排除测试记录
- 知识库草稿创建后需在知识库页面发布后才参与正式引擎匹配
- 历史比较使用已保存的快照（含人设快照），不重新运行旧测试；重新运行建立新记录并通过 `previousRunId` 关联

---

## V1.3 — AI 分析中心

**发布日期：** 2026-07-30  
**开发阶段：** AI大脑 Phase 2 Task 3

### Added

- AI 分析中心（`AiBrainAnalysis.tsx`）：7 个分析模块 + AI 改善建议引擎
  - **概览 Dashboard**：今日 AI 回复数、命中率、转人工率、回复失败率、平均处理时间、LLM 调用次数、来源分布条形图
  - **来源分析 Source Analysis**：各命中来源（固定回复/知识库/商品/LLM/无法匹配等）占比统计
  - **知识库分析 Knowledge Analysis**：使用排行、从未使用、已禁用、草稿列表
  - **固定回复分析 Reply Rule Analysis**：最高命中、最低命中、从未使用规则
  - **无法回答分析 No Match Analysis**：客户最常问但 AI 无法回答的问题频率排行
  - **转人工分析 Handover Analysis**：转人工原因分布、最近转人工请求列表
  - **LLM 分析 LLM Analysis**：调用次数、成功率、失败率、平均 Token、平均时间、模型分布
  - **AI 改善建议 AI Suggestions**：自动检测高频未回答问题、从未使用规则/知识、高转人工率、高失败率、待发布草稿、高频知识优化机会
- 后端 8 个统计查询函数（`db.ts`）：`getAiAnalysisDashboard`、`getSourceAnalysis`、`getKnowledgeAnalysis`、`getReplyRuleAnalysis`、`getNoMatchAnalysis`、`getHandoverAnalysis`、`getLlmAnalysis`、`getAiSuggestions`
- tRPC 路由 `aiAnalysis`：8 个 Admin-only 查询过程
- 单元测试 10 项（`ai-analysis.test.ts`）：覆盖所有统计函数与路由结构验证
- AI大脑 Tab 启用「AI 分析」（原为 disabled ComingSoon）

### Changed

- `AiBrain.tsx`：analytics Tab 从 disabled 改为 enabled，加载 `AiBrainAnalysis` 组件
- `aiBrainTabs.test.ts`：更新 analytics Tab 预期从 fallback 改为直接命中

### Database

- 无新增表，无迁移（基于现有 `ai_logs`、`reply_rules`、`ai_knowledge`、`ai_handover_requests` 表查询）

### Notes

- AI 分析中心仅 Admin 可使用
- 所有统计数据仅来自 `ai_logs`（正式 AI日志），不包含 `ai_test_runs`（测试记录）
- AI 改善建议引擎自动调用各分析模块并生成可操作建议
- 统计范围可选：今日 / 过去 7 天 / 过去 30 天 / 过去 90 天

---

## V1.4 — AI 日志回放（AI Replay）

**发布日期：** 2026-07-30  
**开发阶段：** AI大脑 Phase 2 Task 4

### Added

- AI 日志回放功能（Replay）：从 AI日志列表一键回放，使用正式引擎执行 Dry Run 并显示历史 vs 当前结果对比
  - **Replay 按钮**：每条 AI日志行添加「Replay」按钮，点击后自动载入客户消息、平台、AI状态、人工接手状态
  - **回放对话框**：左右分栏显示历史结果与当前结果，包含来源、规则ID、知识ID、商品ID、转人工、耗时、AI回复
  - **差异检测**：自动高亮来源变化（如 reply_rule → knowledge）、回复内容变化、转人工状态变化
  - **当前处理轨迹**：展示重新执行后的完整处理步骤
  - **安全提示**：对话框顶部持续显示「模拟回放 · 不会发送给客户 · 不会建立对话 · 不会影响正式统计」
- 后端 `replayFromAiLog` 函数（`aiTestRunner.ts`）：从 AI日志提取配置，调用 `runTest` 执行 Dry Run，计算差异
- 后端 `getAiLogForReplay` 函数（`db.ts`）：获取 AI日志完整数据用于回放
- tRPC 路由 `aiLog.replay`：Admin-only mutation，返回历史 + 当前 + 差异对比
- 单元测试 9 项（`ai-replay.test.ts`）：覆盖 db 查询、差异计算逻辑、路由结构验证

### Changed

- `AiBrainLog.tsx`：新增 Replay 按钮、回放对话框、状态管理
- `aiTestRunner.ts`：新增 `aiLogs` import 和 `replayFromAiLog` 函数

### Database

- 无新增表，无迁移（回放结果写入 `ai_test_runs` 表，复用现有测试记录表）

### Notes

- Replay 使用 `SideEffectPolicy` 全程 Dry Run，不发送消息、不建立对话、不写入 `ai_logs`
- 回放结果保存为 `ai_test_runs` 记录，与正式 AI日志物理隔离
- 回放时自动启用 LLM 以观察完整行为
- 模拟会员/订单选项保持禁用状态

---

## V1.5 — AI 回归测试（Regression Test）+ AI 版本管理（AI Version）

**发布日期：** 2026-07-31  
**开发阶段：** AI大脑 Phase 2 Task 5

### Added

- **回归测试（Regression Test）**：企业级 AI 回归测试系统，修改 Knowledge/Reply Rule/Persona/Prompt 后自动验证整个 AI 是否退步
  - **Regression Set 管理**：创建多个问题集（如 Shipping、Order、Member、Plant 等），每个问题可设置期望来源、期望关键词、优先级
  - **批量执行引擎**：逐题通过正式 `processChatAI` 执行 Dry Run，全程 SideEffectPolicy 零副作用
  - **Baseline 对比**：首次运行保存为 Baseline，后续运行自动与 Baseline 对比，检测来源变化、回复变化、No Match 增减、转人工增减、LLM 调用变化
  - **Regression Report**：Overall Score（通过/失败/准确率/平均耗时）、Difference Summary、Failed Questions 列表（含建议）
  - **执行历史**：保存每次回归测试记录，含运行时间、操作者、通过率、准确率
- **AI 版本管理（AI Version）**：AI 配置版本发布与回滚
  - **版本创建**：自动快照当前 Knowledge 和 Reply Rules（含完整数据用于回滚）
  - **版本发布**：发布新版本时自动归档旧版本
  - **版本回滚**：从快照恢复 Knowledge 和 Reply Rules 到指定版本状态
  - **回归关联**：版本可关联回归测试结果和准确率
- 前端页面 `AiBrainRegression.tsx`：回归测试与版本管理双 Tab 界面
- 后端 `runRegression` 函数（`aiTestRunner.ts`）：批量执行、Baseline 对比、差异检测
- 数据库表：`regression_sets`、`regression_questions`、`regression_runs`、`regression_run_details`、`ai_versions`
- tRPC 路由：`aiRegression`（Set CRUD + Run + Report）、`aiVersion`（Create + Publish + Rollback + List）
- 单元测试 17 项（`ai-regression.test.ts`）：覆盖 db 函数导出、差异计算逻辑、路由结构验证

### Changed

- `AiBrain.tsx`：新增「回归测试」Tab（第 8 个 Tab），使用 GitBranch 图标
- `db.ts`：新增 regression 和 aiVersion 相关 import 和 20+ 个数据库查询函数
- `routers.ts`：新增 `aiRegression` 和 `aiVersion` 两个 router

### Database

- 新增 5 张表：`regression_sets`、`regression_questions`、`regression_runs`、`regression_run_details`、`ai_versions`
- 迁移文件：`drizzle/migrations/0009_regression_and_versions.sql`

### Notes

- 回归测试使用正式 AI 引擎执行 Dry Run，不发送消息、不建立对话、不写入 `ai_logs`
- 回归结果保存在 `regression_runs` 和 `regression_run_details` 表，与正式数据物理隔离
- AI 版本快照包含完整 Knowledge 和 Reply Rules 数据，支持精确回滚
- Baseline 对比逻辑：首次运行为 Baseline，后续运行与 Baseline 对比（非与上一轮对比）

---

## 后续记录模板

```md
## Vx.y.z — 版本名称

**发布日期：** YYYY-MM-DD  
**开发阶段：** 阶段名称

### Added

- 

### Changed

- 

### Fixed

- 

### Removed

- 

### Database

- 

### Notes

- 
```

## V1.6 — Business AI Integration（业务 AI 编排层）

**发布日期：** 2026-07-31  
**开发阶段：** AI大脑 Phase 2 — Business AI Integration

### Added

- **AI Case Classification（意图分类引擎）**：AI 自动识别客户消息意图并路由到对应工作流
  - 支持 12 种意图分类：shipment_tracking、parcel_issue、complaint、refund、order_modification、order_status、new_order、membership、product_inquiry、human_assistance、cooperation、other
  - 支持中文、英文、马来文多语言关键词匹配
  - 强制转人工场景：包裹损坏、投诉、退款、合作 — 自动转人工且 AI 不回复
- **Draft Orders（草稿订单）**：AI 识别购买意图后自动创建草稿订单
  - 自动预留库存（reservedQuantity）
  - 等待 Admin 审批后转为正式订单
  - 拒绝时自动释放预留库存
  - 24 小时未审批自动过期
- **Order Change Requests（订单变更请求）**：AI 识别修改订单意图后创建变更请求
  - 支持添加商品、移除商品、修改数量、修改地址、修改电话、取消商品、其他
  - Admin 审批后自动执行变更并更新订单
  - 拒绝时自动释放预留库存
- **Inventory Reservation System（库存预留系统）**：三级库存管理
  - On Hand（库存总量）→ Reserved（预留）→ Available（可用）
  - 每次预留可追溯（reservation_records 表）
  - 支持草稿订单和变更请求两种预留来源
  - 预留可转换为正式扣减或释放
- **AI Handover Summary（转人工摘要）**：转人工时自动生成结构化摘要
  - 包含客户信息、转人工原因、AI 已执行操作、建议下一步
  - 优先级分类：high（包裹/投诉/退款）、medium（订单相关）、normal（一般咨询）
- **AI Logistics（物流查询）**：AI 自动查询订单物流状态
- **Dashboard AI Tasks Module**：Dashboard 新增 AI 任务队列模块
  - 显示待审批草稿订单数量和变更请求数量
  - 一键跳转到对应审批页面
  - 快捷入口 AI 分析中心
- 前端页面 `DraftOrders.tsx`：草稿订单列表、详情、审批/拒绝
- 前端页面 `OrderChangeRequests.tsx`：变更请求列表、详情、审批/拒绝
- 后端 `businessAi.ts`：核心业务 AI 编排层（意图分类、草稿订单、变更请求、库存预留、转人工摘要）
- 数据库表：`draft_orders`、`order_change_requests`、`reservation_records`
- tRPC 路由：`draftOrders`（List + Get + Approve + Reject）、`orderChangeRequests`（同上）、`reservations`（List）、`aiLogistics`（QueryOrder）
- 单元测试 23 项（`business-ai.test.ts`）：覆盖意图分类、转人工摘要、路由结构验证

### Changed

- `DashboardLayout.tsx`：订单管理菜单新增「草稿订单」和「订单变更请求」两个子菜单项
- `App.tsx`：新增 `/draft-orders` 和 `/order-change-requests` 路由
- `Dashboard.tsx`：新增 AI 任务队列模块（紫色主题卡片）
- `products` 表：新增 `reservedQuantity` 字段（int, default 0, not null）
- `ai_logs` 表：新增 `detectedIntent` 和 `handoverSummary` 字段
- `ai_handover_requests` 表：新增 `priority` 和 `suggestedNextAction` 字段

### Database

- 新增 3 张表：`draft_orders`、`order_change_requests`、`reservation_records`
- `products` 表新增 `reservedQuantity` 字段
- `ai_logs` 表新增 `detectedIntent`、`handoverSummary` 字段
- `ai_handover_requests` 表新增 `priority`、`suggestedNextAction` 字段
- 迁移文件：`drizzle/migrations/0010_business_ai.sql`

### Notes

- 所有 AI 业务操作（草稿订单、变更请求）均需 Admin 人工审批，AI 不直接创建正式订单或修改订单
- 库存预留系统确保不会超卖：Available = On Hand - Reserved
- 强制转人工场景（包裹损坏、投诉、退款、合作）AI 不回复客户，直接转人工
- 草稿订单和变更请求 24 小时未审批自动过期，预留库存自动释放

---

## V1.7 — classifyIntent 集成到 processChatAI 管道

**发布日期：** 2026-07-31  
**开发阶段：** AI大脑 — Business AI 管道集成

### Added

- **意图分类集成到正式 AI 管道**：`processChatAI` 在 AI 启用检查和人工接手检查之后、商品匹配之前，自动执行 `classifyIntent` 意图分类
  - 所有返回路径均携带 `detectedIntent` 字段，记录 AI 对客户消息的意图判断
  - 强制转人工场景（包裹损坏、投诉、退款、合作、人工客服请求）在意图分类阶段直接转人工，AI 不回复客户
  - 转人工时自动生成 `HandoverSummary`（含优先级、建议下一步操作），传递给 `createHandoverRequest` 和 `ai_logs`
  - `no_match` 场景也生成结构化 `HandoverSummary`，包含 AI 已执行的匹配步骤摘要
- **ai_logs 表新增字段**：`detectedIntent`（VARCHAR 100）和 `handoverSummary`（TEXT）
- **messenger.ts 转人工增强**：根据 `handoverSummary.priority` 动态设置转人工优先级（high/medium/normal），并将摘要写入 `aiHandoverRequests.aiSummary`
- 单元测试 14 项（`ai-intent-integration.test.ts`）：覆盖强制转人工、正常分类、no_match 摘要等场景

### Changed

- `aiEngines.ts`：`ChatAIResult` 接口新增 `detectedIntent`、`handoverSummary`、`draftOrderId`、`changeRequestId` 字段
- `aiEngines.ts`：`processChatAI` 新增 Step 2.5（意图分类）和 Step 2.6（强制转人工检查）
- `db.ts`：`createAiLog` 插入时写入 `detectedIntent` 和 `handoverSummary`
- `messenger.ts`：转人工时传递 `aiSummary` 和动态 `priority`
- `drizzle/schema.ts`：`aiLogs` 表新增 `detectedIntent` 和 `handoverSummary` 列

### Database

- `ai_logs` 表新增 `detectedIntent`（VARCHAR 100, nullable）和 `handoverSummary`（TEXT, nullable）字段

### Notes

- 意图分类在正式 AI 匹配管道之前执行，但仅对强制转人工场景（parcel_issue/complaint/refund/cooperation/human_assistance）拦截
- 其他意图（general_inquiry/membership/shipment_tracking/new_order/order_modification/product_inquiry）不拦截，继续进入正式匹配管道
- 所有 `processChatAI` 返回结果均携带 `detectedIntent`，方便日志分析和统计

---

## V1.8 — Product AI Intelligence（商品 AI 智能推荐升级）

**发布日期：** 2026-08-01
**开发阶段：** AI大脑 Phase 2 — Product AI Intelligence

### Added

- 新增 Product AI Tags（AI 标签）字段：商品管理页面新增 AI Tags 编辑器，支持自由输入、Enter 添加、快捷标签选择
- 22+ 预设标签分类：场景（办公室/客厅/卧室/阳台）、用途（送礼/开幕/乔迁）、难度（新手/容易照顾/低维护）、环境（耐阴/耐旱/空气净化）、安全（宠物安全/儿童安全）、风水（招财）、类型（观叶/开花/大型/中型/小型）
- 新增 AI Selling Points（AI 推荐卖点）字段：AI 回复时优先引用此内容，不会自行编造卖点
- 新增 AI 商品推荐引擎（`server/productAi.ts`）：完整推荐流程（客户提问 → AI Tags 解析 → 商品匹配 → 属性筛选 → 库存检查 → LLM 润色）
- LLM 仅负责整理语言和排版，不允许推荐数据库不存在的商品
- 支持中英马来三语关键词解析
- 集成到 `processChatAI` 管道（Step 2.8），位于 Flow 检查之后、商品关键词匹配之前
- AI 测试中心轨迹支持：`TestRunResult` 新增 `productAiTags` 和 `productAiRecommendations` 字段
- 21 项 Product AI 单元测试（`server/product-ai.test.ts`）

### Changed

- `productsV2` router 的 `create` 和 `update` 过程新增 `aiTags` 和 `aiSellingPoints` 可选输入
- `ProductsV2.tsx` 表单新增 AI Tags 标签编辑器和 AI Selling Points 文本输入区域
- `ChatAIResult` 接口新增 `productAiTags` 和 `productAiRecommendations` 字段

### Database

- `products` 表新增 `aiTags` (TEXT, nullable) 和 `aiSellingPoints` (TEXT, nullable) 两列

### Notes

- AI 标签参与商品推荐匹配，后续新增标签无需修改代码即可立即生效
- AI Selling Points 不参与筛选，仅在 LLM 回复时引用
- LLM 不负责决定推荐商品，仅负责润色回复
- 商品推荐引擎位于正式 AI 管道的 Step 2.8，在现有商品关键词匹配之前执行

---

## V1.9 — Live Room 商品管理优化（修正版）

**发布日期：** 2026-08-01  
**开发阶段：** Live Room 商品管理优化

### Added

- `searchProductsForLiveRoom` 新增 `alreadyAdded` 标志，搜索结果直接显示已加入商品禁用状态
- `searchProductsForLiveRoom` 返回更多正式商品数据：SKU、keywords、stockQuantity、sellingPrice、productStatus、isPreOrder、aiTags、aiSellingPoints
- `getLiveRoomProducts` 返回完整正式商品数据：SKU、keywords、sellingPrice、stockQuantity、status、isPreOrder、categoryId、aiTags、aiSellingPoints
- 前端新增独立的直播售价编辑对话框，明确标注「仅影响当前直播」
- 商品卡片显示正式商品数据：SKU、关键词、总库存、商品状态、预购状态
- 直播售价与原价不同时显示删除线原价

### Changed

- `batchAddProductsToLiveRoom` 简化为仅接收 `productId` + 可选 `livePrice`，商品数据（keyword、displayName、price、stock、imageUrl）全部从 `products` 表读取
- `generateKeywordCopyText` 从正式 `products` 表读取 `keyword` 和 `name`，不再使用直播房本地副本
- `updateProduct` 路由仅允许修改 `price`（直播售价）、`status` 和 `sortOrder`，移除 `keyword`、`displayName`、`stock` 编辑权限
- 前端加入商品窗口移除关键词前缀输入，改为直播售价自定义选项
- 搜索结果已加入商品显示灰色禁用状态 + 「已加入」标签
- `ProductGroupCard` 新增 `onPriceEdit` prop 和 DollarSign 按钮，点击打开售价编辑对话框

### Design Principle

- 直播房不建立第二套商品资料，仅引用商品管理的正式商品数据
- 直播房只允许修改售价（直播特价），仅影响当前直播，不修改正式商品售价
- 所有商品资料统一维护于 Product Management，直播房仅负责：加入商品、调整直播售价、删除商品、排序商品

---

## V2.0 — Live Studio 优化 + 订单安全链接 + 得标通知

**发布日期：** 2026-08-02  
**开发阶段：** Live Studio V2.0 + Order V1.0

### Added

- 直播房间新增 AI 自动回复 Toggle（`aiReplyEnabled`），可控制是否启用 AI 自动回复留言
- 直播房间新增 持续监控留言 Toggle（`continueMonitor`），直播结束后可继续捉单
- 留言区新增发送留言输入框，可直接发送留言到 Facebook 直播视频
- 留言详情对话框新增 Staff Note 区域，可添加/删除工作人员备注
- 留言详情对话框新增「加入黑名单」按钮
- 订单区标题改为「得标订单」，新增搜索框（可搜索订单号/客户名）和「复制」按钮（一键复制得标名单）
- 新增客户订单公开页面（`/order/:orderNumber/:token`），通过 secureToken 安全验证，无需登录即可查看订单
- 订单详情页新增「复制订单链接」按钮，复制客户订单公开链接
- 后端新增 `liveRooms.sendComment`、`liveRooms.toggleBlacklist`、`liveRooms.createNote`、`getCommentNotes`、`deleteNote` 路由
- 后端新增 `publicOrder.getByToken` 路由，通过安全 Token 获取客户订单信息
- `createOrderFromLiveCapture` 自动生成 `secureToken`，用于客户订单安全链接

### Database

- `live_rooms` 新增 `aiReplyEnabled`（BOOLEAN, 默认 true）
- `live_rooms` 新增 `continueMonitor`（BOOLEAN, 默认 true）
- `orders` 新增 `secureToken`（VARCHAR(64), UNIQUE）
- 新建 `live_comment_notes` 表（id, liveCommentId, liveRoomId, orderId, customerId, content, createdBy, createdAt）

### Notes

- 直播房不建立第二套商品资料，仅引用商品管理的正式商品数据
- 客户订单公开页面通过 secureToken 验证，无需登录，Token 在订单创建时自动生成
- Staff Note 独立于客户可见的订单备注，仅工作人员可见

## V2.0.14: Live Studio 图片显示验证 + 上传进度提示 (2026-08-03)

### Added
- 商品管理图片上传全面增加上传进度提示和本地预览功能
- 封面图片上传：选择文件后立即显示本地预览（URL.createObjectURL），上传中显示 Spinner + 半透明预览图，上传完成后切换为服务器 URL 图片
- 多图上传：上传中显示 Loader2 旋转动画，上传区域禁用重复点击
- 视频上传：上传中显示 Loader2 旋转动画 + 「上传中...」文字，按钮禁用
- 规格图片上传：与封面图片相同的本地预览 + Spinner 体验
- 所有上传按钮在上传中自动禁用（pointer-events-none + opacity-50），防止重复上传

### Changed
- 导入 Spinner 组件和 Loader2 图标
- 新增 5 个 state 变量：uploadingCover, uploadingImages, uploadingVideo, uploadingVariant, coverPreview

### Fixed
- 无

### Notes
- Live Studio 商品区图片显示已验证：后端 getLiveRoomProducts 正确返回 coverImageUrl，前端 ProductGroupCard 有 onError 回退到 Placeholder
- TypeScript 零错误，Vitest 31 文件 257 项测试全部通过

## V2.0.26: Campaign 商品独立 + Messenger 建单 + 订单来源 + 统计 (2026-08-03)
### Added
- 新增 `matchKeywordsToCampaignProducts` 函数：Campaign 专属商品匹配，仅匹配该 Campaign 通过 Product Button 绑定的商品，不再 fallback 到全局商品
- 新增 `getCampaignStats` 函数：单个 Campaign 统计聚合（自动建单数、合并订单数、商品销量、营业额）
- 新增 `getAllCampaignStats` 函数：批量查询所有 Campaign 统计数据
- 新增 tRPC 路由 `campaigns.getStats`：查询单个 Campaign 统计
- 前端 Campaign 卡片显示建单数、合并数、销量、营业额统计
### Changed
- `createOrderFromLiveCapture` 函数签名新增 `campaignId`、`campaignName`、`sourceType` 参数
- `createOrderFromLiveCapture` 函数体内 `db.insert(orders)` 写入 `campaignId`、`campaignName`、`sourceType` 字段
- `executeAutoOrderCapture` 函数签名新增 `campaignName` 参数，并将 `campaignId`、`campaignName`、`sourceType` 传递给 `createOrderFromLiveCapture`
- `processComment` 中 Campaign 留言改用 `matchKeywordsToCampaignProducts`（仅匹配 Campaign 绑定商品）
- `processComment` 中 `createOrderFromLiveCapture` 调用传入 `campaignId`、`campaignName`、`sourceType`
- `getCampaigns` 修复 archived 过滤逻辑（使用 `ne` 而非 `eq`）
- `campaigns.list` tRPC 路由附带每个 Campaign 的统计数据
### Database
- `orders` 表新增 `campaignId`（INT, NULL）、`campaignName`（VARCHAR(255), NULL）、`sourceType`（VARCHAR(50), NULL）字段
- `drizzle/schema.ts` 中 orders 表对应添加以上三个字段
### Notes
- Campaign 商品独立匹配：如果 Campaign 没有绑定任何商品，所有关键词将 unmatched，这是正确行为
- Messenger 私聊已有 Auto Order Engine 接入（V2.0.21 实现），关键词+数量直接建单跳过 AI 流程
- 无关键词时继续执行 AI 回复流程（Campaign Messenger Flow 通过 AI 引擎处理）
- TypeScript 零错误，Vitest 32 文件 266 项测试全部通过

## V2.0.41: Checkout Link 功能逐项完善 (2026-08-05)
### Added
- 订单详情通知状态区域新增「最后发送时间」(notificationSentAt) 显示
- 订单详情通知状态区域新增「失败原因」(notificationError) 独立行显示
- 订单列表表格新增「通知」列，显示通知状态 Badge（🟢已发送 / 🔴发送失败 / ⚪未发送）
- 订单列表筛选器新增「通知状态」下拉筛选（全部通知 / 未发送 / 已发送 / 发送失败）
- 后端 `getOrders` 函数新增 `notificationStatus` 过滤参数，支持 unsent（pending + null）/ sent / failed 筛选
- `orders.list` tRPC procedure input schema 新增 `notificationStatus` 参数
### Changed
- `batchSendCheckout` procedure 改为只查询 `physicalStatus="pending"` 的订单，过滤 `notificationStatus` 为 pending/failed/null 的订单
- `batchSendCheckout` 返回结果新增 `failedOrders` 数组，包含失败订单的编号和客户名
- 前端 `batchSendCheckoutMutation` onSuccess 显示完整统计（总数/成功/失败/跳过 + 失败名单，失败时用 toast.error 显示 10 秒）
- 订单列表表格 `colSpan` 从 8 改为 9（新增通知状态列）
### Notes
- 商品图片预览功能已在 V2.0.39/V2.0.40 完成（80px 图片、名称两行显示、SKU/Keyword、Modal 预览 600x600、多图切换架构、整个图片区域可点击）
- TypeScript 零错误

## V2.0.42: 自定义消息模板 (2026-08-05)
### Added
- `system_settings` 表新增 `checkoutMessageTemplate` 字段（TEXT），用于存储默认 Checkout 消息模板
- 系统设置页面新增「Checkout 消息模板」编辑卡片，支持 `{link}` 占位符
- 订单详情页 WhatsApp 分享和 Send to Messenger 按钮点击后弹出消息编辑对话框，允许用户在发送前修改消息内容
- Resend（重新发送）按钮也支持编辑对话框
- 后端 `sendCheckout`、`resendCheckout` procedure 新增 `customMessage` 可选参数，支持自定义消息内容
- `batchSendCheckout` 使用系统设置中的消息模板（支持 `{link}` 占位符自动替换）
- `settings.update` procedure 新增 `checkoutMessageTemplate` 参数
### Changed
- 消息模板使用 `{link}` 作为 Checkout 链接占位符，系统自动替换为完整 URL
- 默认模板：`Hello, here is your order. Please click the link below to fill in your details and complete payment. Thank you.\n\n{link}`
### Notes
- TypeScript 零错误

## V2.0.43: 本地订单5个问题修复 (2026-08-05)
### Fixed
1. 订单号格式改为XT+5位数字（XT00001, XT00002...），新增order_seq计数表，所有3处订单创建均使用generateOrderNumber函数
2. 订单浏览页面（OrderBrowsePage）商品明细新增图片列（64x64缩略图）、SKU列、关键词列
3. 区域三收件人详情自动同步：customerForm变化时通过useEffect自动更新recipientForm（当buyerIsRecipient=true时）
4. 区域五折扣原因和收费说明显示在订单浏览：schema新增discountReason列，OrderBrowsePage金额详情显示人工折扣及原因
5. 区域六备注保存到order_remarks并在订单浏览显示：创建订单时自动保存remark到order_remarks表
### Added
- `order_seq` 表用于生成顺序订单号
- `discountReason` 列到 orders 表
- `generateOrderNumber()` 函数生成XT00001格式的订单号
### Notes
- TypeScript 零错误

## V2.0.44: 订单浏览页面导出/打印功能 (2026-08-05)
### Added
- 订单浏览页面新增「导出图片」按钮，使用html2canvas将订单详情截图为PNG下载
- 订单浏览页面新增「打印」按钮，调用window.print()打印订单
- 添加打印CSS样式，打印时隐藏导航按钮和操作按钮（.no-print class）
- 安装html2canvas 1.4.1依赖
### Notes
- TypeScript 零错误
