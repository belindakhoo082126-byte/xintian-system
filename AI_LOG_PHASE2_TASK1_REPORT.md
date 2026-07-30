# AI大脑 Phase 2 Task 1：AI日志开发完成报告

**版本：** V1.1  
**检查点：** `8516cfd2`  
**发布日期：** 2026-07-30

---

## 一、三项技术确认落实情况

### 1. Flow 日志与 conversationId 兼容

采用推荐方式，将 `ai_logs.conversationId` 设为可空，并新增来源字段：

| 字段 | 类型 | 用途 |
|---|---|---|
| `conversationId` | INT (nullable) | 普通私聊关联的 chat_conversations 记录 |
| `sourceType` | ENUM | `private_chat` / `facebook_live` / `facebook_post` / `facebook_reel` |
| `sourceEventId` | VARCHAR(255) | Flow 来源事件标识 |
| `sourceBindingId` | INT | Flow 绑定编号 |
| `matchedFlowId` | INT | 命中的 Flow 模板 ID |

Flow 日志不创建伪 Chat 对话。私聊日志 `sourceType` 为 `private_chat`，Flow 日志使用各自的来源类型。

### 2. AiProcessingContext 取得各引擎轨迹

`processChatAI(input, context?)` 增加可选 `AiProcessingContext` 参数。各引擎在执行过程中调用 `context.addStep(label, detail, result, durationMs)` 记录真实命中、未命中与耗时。外层 `messenger.ts` 不需要猜测或重复执行匹配来生成日志。

### 3. 主日志与发送尝试写入生命周期

完整生命周期如下：

1. 收到消息 → 建立 `AiProcessingContext`
2. 完成匹配并产生回复
3. 创建主 `ai_logs` 记录，状态 `pending`
4. 创建 `ai_log_delivery_attempts` 子记录，状态 `pending`
5. 执行发送
6. 更新 delivery attempt（`sent` / `failed` + platformMessageId + errorMessage）
7. 更新主日志为 `sent` / `failed`，写入 `aiReplyMessageId`、`platformMessageId`、`processingTimeMs`
8. SSE 推送 `aiLog` 事件

外键 `ai_log_delivery_attempts.aiLogId → ai_logs.id` 设置为 `ON DELETE CASCADE`。

---

## 二、验收清单

| # | 验收项 | 状态 |
|---|---|---|
| 1 | 数据库迁移结果 | 已执行 `0007_ai_logs.sql`，`ai_logs` 与 `ai_log_delivery_attempts` 表创建成功 |
| 2 | AI日志页面完整截图 | 已截图，统计卡片、筛选器、空状态布局正常 |
| 3 | 普通私聊完整处理轨迹 | 单元测试覆盖 pending→sent/failed 全路径（`messenger.ai-log.test.ts`） |
| 4 | 固定回复命中日志 | `AiProcessingContext.addStep` 在 Reply Rule Engine 中记录命中轨迹 |
| 5 | 知识库/LLM 命中日志 | Knowledge Engine 与 LLM 步骤同样通过 `addStep` 记录 |
| 6 | 转人工日志 | `isHandover` + `handoverReason` 字段持久化，前端展示转人工标签 |
| 7 | 发送失败和重试日志 | `ai_log_delivery_attempts` 子表记录每次尝试，失败写入 `errorCode` / `errorStage` / `errorMessage` |
| 8 | Chat 跳转测试 | 日志列表中私聊记录可点击「Chat」按钮跳转至 `/chat?conversationId=` |
| 9 | 两台设备 SSE 同步测试 | `realtime.ai-log.test.ts` 验证双客户端广播；`useRealtimeSync` 已注册 `aiLog` 缓存刷新映射 |
| 10 | TypeScript 与 Vitest 结果 | TypeScript 零错误；Vitest 21 个测试文件 / 144 项测试全部通过 |
| 11 | CHANGELOG 更新内容 | V1.1 条目已更新，包含 Added / Changed / Fixed / Database / Notes |

---

## 三、新增测试文件

| 文件 | 覆盖范围 | 测试数 |
|---|---|---|
| `server/ai-log-context.test.ts` | AiProcessingContext 轨迹收集与 finalize | 3 |
| `server/ai-log.db.test.ts` | createAiLog 字段写入、Flow 来源持久化、统计不计重试 | 5 |
| `server/ai-log.router.test.ts` | 管理员权限与筛选参数转发（含 sourceType） | 2 |
| `server/messenger.ai-log.test.ts` | 私聊发送成功/失败/日志隔离端到端 | 3 |
| `server/messenger.flow-log.test.ts` | Flow 来源日志无伪会话与发送生命周期 | 2 |
| `server/realtime.ai-log.test.ts` | aiLog SSE 双客户端广播 | 1 |
| `client/src/hooks/useRealtimeSync.test.ts` | aiLog SSE 缓存刷新映射 | 1 |
| `client/src/pages/aiBrainTabs.test.ts` | 深链接 tab=log 回归 | 2 |

---

## 四、关键文件变更

| 文件 | 变更内容 |
|---|---|
| `drizzle/schema.ts` | 新增 `ai_logs` 与 `ai_log_delivery_attempts` 表定义 |
| `drizzle/migrations/0007_ai_logs.sql` | 迁移 SQL |
| `server/aiLogContext.ts` | `AiProcessingContext` 类与 Flow 来源扩展 |
| `server/db.ts` | AI日志 CRUD + 统计 + 清理 + Flow 来源查询 |
| `server/messenger.ts` | 私聊与 Flow 评论的日志生命周期集成 |
| `server/routers.ts` | `aiLog` router（adminProcedure） |
| `server/_core/realtime.ts` | `aiLog` SyncCategory |
| `client/src/pages/AiBrainLog.tsx` | 日志管理页面 |
| `client/src/pages/AiBrain.tsx` | 第5个 Tab + 深链接支持 |
| `client/src/pages/AiBrainDashboard.tsx` | 「查看AI日志」按钮跳转 |
| `client/src/hooks/useRealtimeSync.ts` | aiLog 缓存刷新映射 |
| `CHANGELOG.md` | V1.1 版本记录 |

---

## 五、遵守的开发约束

- 不改变现有三引擎独立架构
- 普通私聊不误触发 Flow Engine
- 日志写入失败不影响客户消息收发（try/catch 隔离）
- 同一客户消息只建立一条主日志
- 所有统计使用主日志计算，不把重试误算为新处理次数
- AI日志仅 Admin 可查看
- AI测试和 AI分析保持「即将开发」状态
