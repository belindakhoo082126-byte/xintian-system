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
