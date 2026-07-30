# AI日志（AI Log Center）规划文档（修正版）

**版本：** Phase 2 Task 1 规划 v2  
**日期：** 2026-07-30  
**状态：** 待确认  
**范围：** 仅规划，不含编码  
**修订：** 根据用户反馈修正 9 项问题  

---

## 1. 现有数据结构检查结果

### 1.1 已有数据

| 数据表 / 字段 | 位置 | 记录内容 | 可直接用于 AI日志 |
|---|---|---|---|
| `chat_messages` | `drizzle/schema.ts:1917` | 每条消息的对话编号、发送者类型、内容、媒体、发送状态、错误信息、AI回复来源 | 是 — 通过 `customerMessageId` 和 `aiReplyMessageId` 精确关联 |
| `chat_messages.aiResponseSource` | `drizzle/schema.ts:1937` | AI回复来源标记（`product` / `reply_rule` / `knowledge` / `flow` / `ai_disabled` / `human_claimed` / `no_match`） | 是 — 但仅记录最终来源，不记录中间处理步骤 |
| `chat_conversations` | `drizzle/schema.ts:1887` | 对话编号、客户编号、渠道、AI开启状态、人工接手状态、接手人和接手时间 | 是 — 可关联为日志的对话上下文 |
| `ai_handover_requests` | `drizzle/schema.ts:1945` | 转人工记录：对话编号、客户编号、渠道、转人工原因、AI摘要、优先级、状态、接手人 | 是 — 可关联为日志的转人工信息 |
| `reply_rules` | `drizzle/schema.ts:1990` | 固定回复规则：名称、关键词、回复内容、优先级、渠道、启用状态、使用次数、最后命中时间 | 是 — 可通过 `matchedRuleId` 关联命中规则详情 |
| `ai_knowledge` | `drizzle/schema.ts:2010` | AI知识库条目：分类、主题、关键词、内容、优先级、是否使用LLM、使用次数、最后命中时间 | 是 — 可通过 `matchedKnowledgeId` 关联命中知识详情 |
| `live_ai_flows` | `drizzle/schema.ts:1566` | Flow Engine 规则：名称、关键词、回复内容、启用状态、排序 | 是 — 仅限已绑定 Flow 来源的事件，通过 `matchedFlowId` 关联 |
| `customers` | `drizzle/schema.ts:425` | 客户编号、Facebook名称、Messenger ID、电话、地址等 | 是 — 仅关联 `customerName` 快照，不复制电话/地址等敏感资料 |
| `ai_persona` | `drizzle/schema.ts:2060` | AI人设设置 | 间接 — 影响AI回复风格，不直接记录在日志中 |
| SSE `broadcastChange("chat")` | `server/_core/realtime.ts` | 实时推送消息变更 | 间接 — 日志页面可订阅 `aiLog` 类别实现实时更新 |

### 1.2 目前没有记录的数据

| 缺失数据 | 说明 | 影响 |
|---|---|---|
| **完整处理轨迹** | 当前 `aiResponseSource` 仅记录最终命中来源，不记录中间步骤 | Admin 无法知道 AI经过了哪些引擎、哪些被跳过 |
| **总处理时间** | 未记录从收到客户消息到发送AI回复的耗时 | 无法评估AI响应速度 |
| **发送结果详情** | `sendTextMessage` 返回值未存入数据库，仅 `chat_messages.status` 记录 sent/failed | 发送失败时缺少 Facebook API 返回的具体错误 |
| **匹配来源编号** | `chat_messages.aiResponseSource` 记录来源类型但未记录命中的规则/知识/商品编号 | 无法从消息直接定位命中条目 |
| **消息ID关联** | 当前无法精确关联"哪条客户消息"对应"哪条AI回复"和"哪次处理轨迹" | 同一对话多轮消息无法区分 |
| **LLM调用记录** | 知识库 `useLLM=true` 时调用 LLM 的输入输出未记录 | 无法审计 LLM 生成的回复内容 |
| **结构化错误信息** | 仅有 `errorMessage` 文本，无 `errorCode` 和 `errorStage` | 无法按错误类型统计 |
| **发送重试记录** | 当前无重试机制，也无重试日志 | 发送失败后无法追踪重试结果 |

---

## 2. 建议新增或修改的数据库字段

### 2.1 新增表：`ai_logs`

```sql
CREATE TABLE ai_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- 关联信息
  conversationId INT NOT NULL,          -- 关联 chat_conversations.id
  customerId INT,                       -- 关联 customers.id
  customerName VARCHAR(255),             -- 客户名称快照（仅显示名，不含电话/地址等敏感资料）
  platform ENUM('messenger','whatsapp','other') NOT NULL,
  -- 消息ID精确关联
  customerMessageId INT,                -- 关联 chat_messages.id（客户原始消息）
  aiReplyMessageId INT,                 -- 关联 chat_messages.id（AI回复消息）
  -- 客户原始消息
  customerMessage TEXT,                 -- 客户原始消息内容（截断前200字）
  receivedAt TIMESTAMP NOT NULL,        -- 接收时间
  -- AI状态
  aiEnabled BOOLEAN NOT NULL,           -- 收到消息时AI是否开启
  handoverStatus ENUM('none','pending','claimed') NOT NULL,
  -- 处理轨迹
  processingSteps JSON,                 -- 完整处理步骤数组（不硬性截断步数）
  -- 最终命中
  finalSource ENUM('order_keyword','product','reply_rule','knowledge','llm','flow','human_handover','no_match','error','ai_disabled','human_claimed') NOT NULL,
  matchedRuleId INT,                    -- 命中的 reply_rules.id
  matchedKnowledgeId INT,               -- 命中的 ai_knowledge.id
  matchedProductId INT,                 -- 命中的 products.id
  matchedFlowId INT,                    -- 命中的 live_ai_flows.id（仅限已绑定Flow来源）
  -- AI回复
  aiReply TEXT,                         -- AI最终回复内容
  -- 发送状态
  sendStatus ENUM('sent','failed','not_sent','pending') NOT NULL DEFAULT 'not_sent',
  platformMessageId VARCHAR(255),       -- Messenger返回的message_id
  -- 重试记录（方案A：主日志内记录）
  retryCount INT NOT NULL DEFAULT 0,    -- 发送重试次数
  lastRetryAt TIMESTAMP,                -- 最后重试时间
  -- 结构化错误
  errorCode VARCHAR(50),                -- 错误码（如 190=Token过期, 10=发送失败）
  errorStage VARCHAR(50),               -- 错误阶段（如 messenger_send, llm_call, db_write）
  errorMessage TEXT,                    -- 错误描述（截断前500字）
  -- 转人工
  isHandover BOOLEAN NOT NULL DEFAULT FALSE,
  handoverReason TEXT,
  -- 性能
  processingTimeMs INT,                 -- 总处理时间（毫秒）
  -- 时间戳
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- 索引
  INDEX idx_ai_logs_conversation (conversationId),
  INDEX idx_ai_logs_customer (customerId),
  INDEX idx_ai_logs_customer_msg (customerMessageId),
  INDEX idx_ai_logs_created (createdAt),
  INDEX idx_ai_logs_source (finalSource),
  INDEX idx_ai_logs_send_status (sendStatus),
  INDEX idx_ai_logs_platform (platform),
  INDEX idx_ai_logs_error_stage (errorStage)
);
```

### 2.2 新增表：`ai_log_delivery_attempts`（发送重试子表 — 方案B）

```sql
CREATE TABLE ai_log_delivery_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  aiLogId INT NOT NULL,                 -- 关联 ai_logs.id
  attemptNumber INT NOT NULL,           -- 尝试序号（1=首次发送）
  sendStatus ENUM('sent','failed','pending') NOT NULL,
  platformMessageId VARCHAR(255),       -- Messenger返回的message_id
  errorCode VARCHAR(50),                -- 错误码
  errorMessage TEXT,                     -- 错误描述（截断前500字）
  attemptedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_delivery_ai_log (aiLogId),
  INDEX idx_delivery_status (sendStatus)
);
```

**重试记录策略：** 采用方案B（发送尝试子表）。每次发送尝试（包括首次和重试）在 `ai_log_delivery_attempts` 中创建一条记录，主日志的 `sendStatus` 和 `retryCount` 同步更新。这样同一客户消息只生成一条主 AI日志，重试不会产生新的主日志。

### 2.3 `processingSteps` JSON 结构

```json
[
  { "step": "receive", "label": "收到客户消息", "ts": "2026-07-30T10:00:00Z", "detail": "渠道：Messenger" },
  { "step": "ai_check", "label": "AI开启检查", "result": "passed", "detail": "AI已开启，未被人工接手" },
  { "step": "flow_check", "label": "Flow来源检查", "result": "skipped", "detail": "普通私聊，不进入Flow Engine" },
  { "step": "order_keyword", "label": "下单关键词匹配", "result": "missed", "detail": "未命中下单关键词", "durationMs": 5 },
  { "step": "product_match", "label": "商品真实资料匹配", "result": "missed", "detail": "未命中商品关键词", "durationMs": 12 },
  { "step": "reply_rule", "label": "固定回复规则", "result": "hit", "detail": "命中规则：运费咨询（ID:5）", "ruleId": 5, "durationMs": 8 },
  { "step": "send", "label": "发送 Messenger", "result": "success", "detail": "message_id: mid.xxx", "ts": "2026-07-30T10:00:01Z", "durationMs": 95 }
]
```

**处理轨迹收集规则：**

- 每步 `detail` 限制 200 字，超长截断
- `detail` 仅记录命中/未命中、规则名称、规则编号、状态、错误码、耗时，**不重复保存完整客户原文**
- 如果客户消息中包含电话或地址，`processingSteps.detail` 不再次复制或扩散这些资料
- 数据库不硬性截断步数，完整保存所有处理步骤
- 前端界面默认显示前 15 步，超出部分可展开查看
- 超长技术资料（如完整 API 错误响应）放入 `errorMessage` 或 `ai_log_delivery_attempts.errorMessage`，不放入 `processingSteps.detail`

### 2.4 不修改的现有表

| 表 | 原因 |
|---|---|
| `chat_messages` | 已有 `aiResponseSource` 字段，不需要重复添加日志字段；AI日志通过 `customerMessageId` 和 `aiReplyMessageId` 精确关联 |
| `reply_rules` | 已有 `usageCount` 和 `lastMatchedAt`，由引擎自动更新 |
| `ai_knowledge` | 同上 |
| `ai_handover_requests` | 已有转人工记录，AI日志通过 `conversationId` 和 `customerId` 关联 |

---

## 3. AI日志处理流程图（修正版）

![AI日志处理流程图（修正版）](/manus-storage/ai-log-flow-v2_7f955363.png)

### 3.1 普通私聊处理顺序

收到客户消息后，系统按以下顺序处理：

1. **AI开启检查** — 若 AI未开启，记录 `source=ai_disabled`，不回复
2. **人工接手检查** — 若人工已接手，记录 `source=human_claimed`，不回复
3. **Flow来源检查** — 普通私聊不进入 Flow Engine，跳过此步骤
4. **下单关键词匹配** — 命中则回复，`source=order_keyword`
5. **商品真实资料匹配** — 命中则回复，`source=product`
6. **固定回复规则** — 读取 `reply_rules`，命中则回复，`source=reply_rule`
7. **AI知识库 / LLM** — 读取 `ai_knowledge`，命中则回复，`source=knowledge` 或 `source=llm`
8. **无法确认则转人工** — `source=no_match`，创建转人工请求

### 3.2 Flow Engine 适用范围

Flow Engine **仅处理**以下已绑定来源的事件：

- 已绑定 Facebook Live 的消息
- 已绑定 Facebook Post 的评论或消息
- 已绑定 Facebook Reel 的评论或消息
- 明确带有对应 Flow 来源及绑定编号的事件

**普通 Messenger／WhatsApp 私聊不可进入 Flow Engine。** AI日志可以记录 `finalSource=flow`，但仅限真正由已绑定 Flow 触发的事件。

---

## 4. 日志写入方式：AiProcessingContext

### 4.1 统一处理上下文

采用 `AiProcessingContext` 统一收集处理轨迹，避免在多个引擎函数中重复拼接日志。

```typescript
// server/aiLogContext.ts
export class AiProcessingContext {
  private steps: ProcessingStep[] = [];
  private startTime: number;

  constructor(
    public conversationId: number,
    public customerId: number | null,
    public customerName: string,
    public platform: string,
    public customerMessageId: number,
    public customerMessage: string,
    public aiEnabled: boolean,
    public handoverStatus: string,
  ) {
    this.startTime = Date.now();
    this.addStep('receive', '收到客户消息', `渠道：${platform}`);
    this.addStep('ai_check', 'AI开启检查',
      aiEnabled ? '通过' : 'AI未开启',
      aiEnabled ? 'passed' : 'skipped');
  }

  addStep(step: string, label: string, detail: string, result?: string, extra?: Record<string, any>): void {
    this.steps.push({
      step, label, detail: detail.slice(0, 200),
      result, ts: new Date().toISOString(),
      durationMs: extra?.durationMs,
      ...extra,
    });
  }

  finalize(finalSource: string, aiReply: string | null, sendStatus: string, extra?: Partial<AiLogRecord>): AiLogRecord {
    return {
      conversationId: this.conversationId,
      customerId: this.customerId,
      customerName: this.customerName,
      platform: this.platform,
      customerMessageId: this.customerMessageId,
      aiReplyMessageId: extra?.aiReplyMessageId ?? null,
      customerMessage: this.customerMessage.slice(0, 200),
      receivedAt: new Date(this.startTime),
      aiEnabled: this.aiEnabled,
      handoverStatus: this.handoverStatus,
      processingSteps: this.steps,
      finalSource,
      aiReply,
      sendStatus,
      processingTimeMs: Date.now() - this.startTime,
      ...extra,
    };
  }
}
```

### 4.2 写入时机

在 `server/messenger.ts` 的 `handleIncomingMessage` 函数中：

1. 收到客户消息后，创建 `AiProcessingContext`
2. 调用 `processChatAI`，在每个引擎匹配前后调用 `ctx.addStep()` 记录轨迹
3. AI处理完成后（无论成功、失败还是转人工），调用 `createAiLog(ctx.finalize(...))` 一次性写入 `ai_logs`
4. 发送回复时，首次尝试在 `ai_log_delivery_attempts` 中创建记录；重试时追加新记录并更新主日志的 `retryCount` 和 `lastRetryAt`

**关键原则：**

- 日志写入使用 `try/catch` 包裹，失败时仅 `console.error`，**不影响客户消息收发**
- 每次客户消息原则上只生成一条主处理日志
- 不同引擎使用 `ctx.addStep()` 统一步骤格式，日志逻辑不散落在引擎内部
- `processChatAI` 返回结构不变，轨迹由调用方（`messenger.ts`）通过 `AiProcessingContext` 收集

---

## 5. 后端接口规划

### 5.1 tRPC 路由：`aiLog`

| 接口 | 类型 | 权限 | 说明 |
|---|---|---|---|
| `aiLog.list` | query | admin | 分页查询日志列表，支持日期/客户/渠道/来源/发送状态/转人工/关键词筛选 |
| `aiLog.getDetail` | query | admin | 获取单条日志完整详情，包含 `processingSteps` 轨迹和 `delivery_attempts` |
| `aiLog.getStats` | query | admin | 获取日志统计摘要（今日/本周/本月的来源分布、成功率、平均处理时间、错误分布） |
| `aiLog.getDeliveryAttempts` | query | admin | 获取某条日志的发送尝试记录 |

### 5.2 `aiLog.list` 输入参数

```typescript
{
  page: number,           // 页码，默认1
  pageSize: number,      // 每页条数，默认20
  dateFrom?: string,      // 日期范围起
  dateTo?: string,        // 日期范围止
  customerName?: string,  // 客户名称搜索
  platform?: string,      // 渠道筛选
  finalSource?: string,   // 回复来源筛选
  sendStatus?: string,    // 发送状态筛选
  isHandover?: boolean,   // 是否转人工筛选
  errorStage?: string,    // 错误阶段筛选
  keyword?: string,       // 关键词搜索（客户消息或AI回复内容）
}
```

### 5.3 `aiLog.list` 返回结构

```typescript
{
  items: Array<{
    id: number,
    conversationId: number,
    customerName: string,
    platform: string,
    customerMessage: string,    // 截断前100字
    finalSource: string,
    sendStatus: string,
    retryCount: number,
    isHandover: boolean,
    errorCode: string | null,
    errorStage: string | null,
    processingTimeMs: number,
    createdAt: Date,
  }>,
  total: number,
  page: number,
  pageSize: number,
}
```

---

## 6. 前端页面结构

### 6.1 入口

在 AI大脑中**新增**「AI日志」Tab，不替换现有「AI测试」Tab。Tab 顺序：

1. 总控制台
2. AI人设
3. AI知识库
4. 固定回复
5. **AI日志**（新增）
6. AI测试（继续显示「即将开发」）
7. AI分析（继续显示「即将开发」）

Dashboard 的「查看 AI 日志」快捷按钮进入 AI日志 Tab。

### 6.2 页面布局

```
┌─────────────────────────────────────────────────────┐
│ AI日志                                               │
├─────────────────────────────────────────────────────┤
│ [日期范围] [客户搜索] [渠道▼] [来源▼] [状态▼] [转人工▼] [错误阶段▼] [关键词] │
├─────────────────────────────────────────────────────┤
│ 统计摘要：今日 52 条 | 成功 48 | 失败 2 | 转人工 5    │
├─────────────────────────────────────────────────────┤
│ #1024 │ 张三 │ Messenger │ 运费怎么算？ │ reply_rule │ ✓ │ 0次重试 │ 120ms │ 10:30 │
│ #1023 │ 李四 │ Messenger │ 有什么花？  │ knowledge  │ ✓ │ 0次重试 │ 340ms │ 10:28 │
│ #1022 │ 王五 │ Messenger │ 订购盆栽    │ product    │ ✗ │ 2次重试 │  89ms │ 10:25 │
│ ...                                                  │
│ [上一页] [1] [2] [3] [下一页]                         │
├─────────────────────────────────────────────────────┤
│ 点击某行展开 ↓                                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 处理轨迹（7步）                                   │ │
│ │ ① 收到客户消息 — 10:30:00                        │ │
│ │ ② AI开启检查 — 通过                              │ │
│ │ ③ Flow来源检查 — 跳过（普通私聊）                  │ │
│ │ ④ 下单关键词匹配 — 未命中                         │ │
│ │ ⑤ 商品真实资料匹配 — 未命中                       │ │
│ │ ⑥ 固定回复规则 — 命中「运费咨询」(ID:5)           │ │
│ │ ⑦ 发送 Messenger — 成功 (mid.xxx)               │ │
│ │                                                  │ │
│ │ AI回复内容：                                      │ │
│ │ "亲爱的，西马满RM150免邮..."                      │ │
│ │                                                  │ │
│ │ 发送尝试记录：                                    │ │
│ │ #1 成功 — mid.xxx — 10:30:01                    │ │
│ │                                                  │ │
│ │ [打开对应 Chat 对话]                              │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 6.3 交互功能

- **筛选**：日期范围、客户名称、渠道、回复来源、发送状态、是否转人工、错误阶段、关键词搜索
- **展开轨迹**：点击日志行展开完整 `processingSteps` 处理轨迹（默认显示前 15 步，超出可展开）
- **发送尝试记录**：展开后显示 `ai_log_delivery_attempts` 的每次发送尝试
- **跳转 Chat**：展开后点击「打开对应 Chat 对话」跳转至 Chat 页面并定位到对应对话
- **统计摘要**：页面顶部显示当日统计
- **分页**：每页 20 条，支持翻页
- **实时更新**：通过 SSE `aiLog` 类别推送，新日志自动出现在列表顶部

---

## 7. 日志保存及清理策略

### 7.1 保留期限配置

保留期限通过环境变量统一配置，不写死在多个地方：

```
AI_LOG_RETENTION_DAYS=90
```

在 `server/_core/env.ts` 中注册此环境变量，默认值 90 天。自动清理任务读取此配置。

### 7.2 自动清理

通过 Heartbeat 定时任务每日凌晨执行：

| 步骤 | 说明 |
|---|---|
| 读取配置 | `AI_LOG_RETENTION_DAYS`（默认 90） |
| 删除过期日志 | `DELETE FROM ai_logs WHERE createdAt < NOW() - INTERVAL ? DAY` |
| 删除关联发送尝试 | `DELETE FROM ai_log_delivery_attempts WHERE aiLogId NOT IN (SELECT id FROM ai_logs)` |
| 记录清理结果 | `console.log` 清理时间和清理数量 |
| 清理失败 | `try/catch` 包裹，失败时仅记录错误，不影响主系统 |

### 7.3 敏感资料处理

| 字段 | 处理方式 |
|---|---|
| `customerName` | 保存显示名快照（如 Facebook名称），不含电话/地址 |
| `customerMessage` | 截断前 200 字保存，原文已在 `chat_messages` 中 |
| `aiReply` | 原文保存 |
| `processingSteps.detail` | 仅记录命中/未命中、规则名称、规则编号、状态、错误码、耗时，**不重复保存完整客户原文** |
| 电话号码/地址 | **不记录**在 AI日志中；如需查看客户详情，通过 `customerId` 跳转至客户管理 |
| `errorMessage` | 截断前 500 字，不无限保存完整第三方返回内容 |

### 7.4 数据库增长控制

| 措施 | 说明 |
|---|---|
| 分页查询 | 列表默认每页 20 条，避免全量加载 |
| 索引优化 | 8 个索引覆盖常用查询路径 |
| 自动清理 | 90 天后自动删除，控制表大小 |
| 预估增长 | 每条约 1-2 KB（含 processingSteps JSON），日均 100 条约 200 KB，90 天约 18 MB |
| 手动删除 | Phase 1 不提供手动删除按钮 |

### 7.5 发送失败与重试

| 场景 | 处理方式 |
|---|---|
| 发送失败 | 主日志 `sendStatus=failed`，`errorCode` 和 `errorStage` 结构化记录，`errorMessage` 截断 500 字 |
| 重试发送 | 在 `ai_log_delivery_attempts` 中追加新记录，主日志 `retryCount` 递增，`lastRetryAt` 更新 |
| 重试后成功 | 主日志 `sendStatus` 更新为 `sent`，`platformMessageId` 更新 |
| 不产生新主日志 | 每次重试不创建新的 `ai_logs` 记录 |

---

## 8. 与现有 Chat、Flow、Reply Rule、Knowledge 的兼容方式

| 现有模块 | 兼容方式 |
|---|---|
| **Chat（chat_messages）** | AI日志通过 `customerMessageId` 和 `aiReplyMessageId` 精确关联 `chat_messages.id`，不修改 `chat_messages` 表结构。日志中记录的客户原始消息和AI回复与 `chat_messages` 中的记录一致，但日志额外保存完整处理轨迹。 |
| **Flow Engine（live_ai_flows）** | 日志 `matchedFlowId` 仅在消息来源为已绑定 Flow（Live/Post/Reel）时记录。普通私聊不进入 Flow Engine，日志中 `processingSteps` 记录 `flow_check: skipped`。Flow Engine 匹配逻辑不变。 |
| **Reply Rule Engine（reply_rules）** | 日志 `matchedRuleId` 关联命中的规则。`reply_rules` 的 `usageCount` 和 `lastMatchedAt` 继续由引擎更新，日志仅做独立记录。 |
| **Knowledge Engine（ai_knowledge）** | 日志 `matchedKnowledgeId` 关联命中的知识条目。同上，`ai_knowledge` 的使用统计继续由引擎更新。 |
| **AI Handover（ai_handover_requests）** | 日志 `isHandover` 和 `handoverReason` 与转人工记录一致。通过 `conversationId` 和 `customerId` 关联。 |
| **SSE 实时推送** | 新增 `aiLog` 到 `SyncCategory`，日志写入后通过 `broadcastChange("aiLog")` 推送，前端日志页面可实时更新。 |

**核心原则：** AI日志是只读旁路记录，不修改任何现有引擎逻辑、不修改现有表结构、不影响现有消息收发流程。仅在 AI处理完成后通过 `AiProcessingContext` 追加一条日志记录。

---

## 9. 可能风险及解决方法

| 风险 | 影响 | 解决方法 |
|---|---|---|
| 日志写入失败影响消息收发 | 高 | 日志写入使用 `try/catch` 包裹，失败时仅 `console.error`，不影响主流程 |
| `processingSteps` JSON 过大 | 中 | 每步 `detail` 截断 200 字；不硬性截断步数但前端默认显示前 15 步；超长技术资料放入 `errorMessage` |
| 数据库增长过快 | 低 | 90 天自动清理 + 分页查询 + 8 个索引优化 |
| 现有引擎逻辑变更 | 中 | `AiProcessingContext` 由调用方维护，引擎调整后调用方同步更新步骤记录 |
| Admin 误删日志 | 低 | Phase 1 不提供手动删除功能 |
| 多设备实时同步 | 低 | 通过 SSE `aiLog` 类别推送，与现有 Chat 实时同步机制一致 |
| 重试日志混淆统计 | 中 | 采用发送尝试子表，主日志只更新 `retryCount` 和 `sendStatus`，不产生新主日志 |
| 敏感资料扩散 | 中 | `processingSteps.detail` 不重复保存客户原文；`customerName` 仅保存显示名；电话/地址不记录 |
| 保留期限配置分散 | 低 | 统一使用 `AI_LOG_RETENTION_DAYS` 环境变量，不写死在多个地方 |

---

## 10. Task 1 开发步骤与验收标准（修正版）

### 10.1 开发步骤

| 步骤 | 内容 | 预计工时 |
|---|---|---|
| 1 | 创建 `ai_logs` 和 `ai_log_delivery_attempts` 表的 schema 和迁移 SQL | 0.5h |
| 2 | 在 `server/_core/env.ts` 中注册 `AI_LOG_RETENTION_DAYS` 环境变量 | 0.5h |
| 3 | 创建 `server/aiLogContext.ts`，实现 `AiProcessingContext` 类 | 1h |
| 4 | 在 `server/db.ts` 中添加 `createAiLog`、`getAiLogs`、`getAiLogDetail`、`getAiLogStats`、`addDeliveryAttempt`、`updateDeliveryAttempt`、`cleanupOldAiLogs` 辅助函数 | 1.5h |
| 5 | 在 `server/messenger.ts` 中集成 `AiProcessingContext`，在 AI处理完成后写入日志 | 1h |
| 6 | 在 `server/routers.ts` 中添加 `aiLog` 路由（list / getDetail / getStats / getDeliveryAttempts） | 0.5h |
| 7 | 在 `server/_core/realtime.ts` 的 `SyncCategory` 中添加 `"aiLog"` | 0.5h |
| 8 | 创建 `client/src/pages/AiBrainLog.tsx` 前端页面 | 2h |
| 9 | 在 `AiBrain.tsx` 中新增「AI日志」Tab（第5个Tab），保留 AI测试和 AI分析 Tab | 0.5h |
| 10 | Dashboard 快捷操作「查看 AI 日志」按钮跳转至日志 Tab | 0.5h |
| 11 | 添加 Heartbeat 定时任务：每日凌晨清理过期日志 | 0.5h |
| 12 | 添加 Vitest 测试覆盖 `createAiLog`、`aiLog.list` 和 `AiProcessingContext` | 1h |
| 13 | TypeScript 检查、测试运行、视觉验证 | 0.5h |

### 10.2 验收标准

| 标准 | 验证方式 |
|---|---|
| 客户发送消息后，AI日志中生成对应记录 | 从 Messenger 发送测试消息，检查日志页面 |
| 日志记录完整处理轨迹（所有引擎步骤） | 展开日志详情，确认步骤完整 |
| 日志记录最终命中来源、发送状态、处理时间 | 检查日志字段 |
| 普通私聊不进入 Flow Engine | 检查 `processingSteps` 中 `flow_check: skipped` |
| 已绑定 Flow 来源的消息可记录 `finalSource=flow` | 从直播/贴文/Reel 发送消息，检查日志 |
| 发送失败时日志记录结构化错误（errorCode + errorStage） | 模拟发送失败，检查日志 |
| 发送重试在 `ai_log_delivery_attempts` 中记录，不产生新主日志 | 触发重试，检查主日志 `retryCount` 和子表记录 |
| 转人工时日志记录转人工原因 | 发送无法匹配的消息，检查日志 |
| 日志通过 `customerMessageId` 和 `aiReplyMessageId` 精确关联消息 | 检查日志字段与 `chat_messages` 对应 |
| 日志页面支持日期、客户、渠道、来源、状态、转人工、错误阶段、关键词筛选 | 在页面操作筛选 |
| 点击日志可展开查看完整处理轨迹（默认前 15 步） | 在页面点击展开 |
| 展开后可查看发送尝试记录 | 检查 `delivery_attempts` 显示 |
| 展开后可跳转至对应 Chat 对话 | 点击跳转按钮 |
| Dashboard「查看 AI 日志」按钮跳转至日志页面 | 点击按钮验证 |
| AI大脑 Tab 顺序：总控制台/AI人设/AI知识库/固定回复/AI日志/AI测试/AI分析 | 检查 Tab 列表 |
| AI测试和 AI分析继续显示「即将开发」 | 检查 Tab 内容 |
| 日志页面通过 SSE 实时更新 | 两台设备同时打开日志页面，发送消息后确认同步 |
| 保留期限可通过 `AI_LOG_RETENTION_DAYS` 配置 | 检查环境变量 |
| 自动清理任务每日执行并记录清理结果 | 检查 Heartbeat 日志 |
| `processingSteps.detail` 不重复保存完整客户原文 | 检查日志数据 |
| TypeScript 零错误 | `npx tsc --noEmit` |
| Vitest 测试全部通过 | `npx vitest run` |
| 不修改现有表结构和引擎逻辑 | 代码审查确认 |

---

## 11. Phase 2 后续模块预留

本规划仅涉及 Task 1（AI日志）。Phase 2 后续模块的规划将在 Task 1 完成后依次进行：

| 顺序 | 模块 | 依赖 |
|---|---|---|
| 1 | AI日志 | 无（本规划） |
| 2 | AI测试中心 | 依赖 AI日志（可回放历史消息测试） |
| 3 | 回复模板 | 依赖 AI人设（模板风格与人设一致） |
| 4 | AI规则 | 依赖 AI日志（规则效果可追踪） |
| 5 | AI学习建议 | 依赖 AI日志和 AI分析（基于数据生成建议） |
| 6 | AI分析 | 依赖 AI日志（统计分析日志数据） |
