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
