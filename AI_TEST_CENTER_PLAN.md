# AI大脑 Phase 2 Task 2：AI测试中心规划文档（修正版 v2）

**版本：** 规划修正版 v2  
**日期：** 2026-07-30  
**状态：** 待用户最终确认，确认后开始开发

---

## 1. 现有 AI处理函数复用方式

### 1.1 可复用的核心函数

当前 AI处理流水线由 `server/aiEngines.ts` 中的四个独立引擎和一个编排函数组成：

| 函数 | 职责 | 当前副作用 | 测试模式需要 |
|------|------|-----------|-------------|
| `runProductMatchEngine(ctx)` | 商品关键词匹配 | 无写入副作用 | ✅ 可直接复用 |
| `runReplyRuleEngine(ctx)` | 固定回复规则匹配 | `recordUsage("replyRules", id)` 递增 usageCount + lastMatchedAt | ⚠️ 需跳过写入 |
| `runKnowledgeEngine(ctx)` | 知识库匹配 | `recordUsage("aiKnowledge", id)` 递增 usageCount + lastMatchedAt | ⚠️ 需跳过写入 |
| `processChatAI(ctx, options)` | 编排全部引擎 | 依赖上述引擎的副作用 | ⚠️ 需测试模式参数 |

### 1.2 复用方案

**核心思路：** 为 `processChatAI` 增加一个 `dryRun` 选项，当 `dryRun=true` 时：

1. 传入一个 `AiProcessingContext`（复用现有轨迹收集机制），但 `conversationId`、`customerId`、`customerMessageId` 全部设为 `null`
2. 各引擎函数增加可选 `dryRun` 参数，当为 `true` 时跳过 `recordUsage` 调用
3. `processChatAI` 在 `dryRun` 模式下不创建真实对话、不写入 chat_messages、不创建转人工请求、不发送 Messenger 消息
4. 返回结构与正式处理完全一致的 `ChatAIResult`，同时通过 `AiProcessingContext.finalize()` 产出完整处理轨迹

**改动范围：**

```typescript
// aiEngines.ts — 引擎函数签名变更
export async function runReplyRuleEngine(
  ctx: MessageContext,
  options?: { dryRun?: boolean }
): Promise<EngineResult>

export async function runKnowledgeEngine(
  ctx: MessageContext,
  options?: { dryRun?: boolean }
): Promise<EngineResult>

// processChatAI 签名变更
export async function processChatAI(
  ctx: MessageContext,
  options: {
    aiEnabled: boolean;
    handoverStatus: "none" | "pending" | "claimed";
    logContext?: AiProcessingContext;
    dryRun?: boolean;  // 新增
  }
): Promise<ChatAIResult>
```

**不改变现有架构：** 正式处理路径不传 `dryRun`，行为与当前完全一致。测试模式仅是增加了一个可选的短路开关。

### 1.3 LLM 复用

当前 `aiBrain.previewReply` 已实现独立的 LLM 调用（`invokeLLM`），测试中心可复用相同的 system prompt 构建逻辑。当知识库条目的 `useLLM=true` 时，测试中心将：

1. 先用关键词匹配确定命中的知识条目
2. 使用该条目的 `content` 作为 LLM 的上下文，结合 AI人设 system prompt 调用 `invokeLLM`
3. 返回 LLM 生式的回复内容

---

## 2. 测试与正式消息处理的隔离方式

### 2.1 隔离原则

测试模式必须满足以下"九不"隔离要求：

| 隔离项 | 实现方式 |
|--------|---------|
| 不发送到 Messenger | 测试模式不调用 `sendTextMessage` 等发送函数 |
| 不发送到 WhatsApp | 同上 |
| 不建立真实客户对话 | 不调用 `getOrCreateConversation` / `storeIncomingMessengerMessage` |
| 不产生真实转人工通知 | 不调用 `createHandoverRequest` |
| 不增加未读数量 | 不操作 `chat_conversations.unreadCount` |
| 不触发真实订单 | 不进入捉单流程 |
| 不触发真实 Flow | `sourceType` 设为 `private_chat`，Flow Engine 自动跳过 |
| 不影响正式 Chat | 不写入 `chat_messages` 表 |
| 不影响 AI日志统计 | 使用独立 `ai_test_runs` 表，不写入 `ai_logs` |

### 2.2 隔离实现 — 统一副作用策略（修正项4）

**不依赖每个开发人员记得写 `if (!dryRun)`，而是建立统一的副作用拦截层。**

新增 `server/aiTestRunner.ts`，其中定义 `ExecutionMode` 与 `SideEffectPolicy`：

```typescript
type ExecutionMode = "live" | "dry_run";

class SideEffectPolicy {
  constructor(private mode: ExecutionMode) {}

  /** 在 dry_run 下调用禁止操作时立即抛出错误，而非静默跳过 */
  guard(action: string, fn: () => Promise<void>): Promise<void> {
    if (this.mode === "dry_run") {
      throw new Error(`[TestRunner] 禁止操作: "${action}" 在测试模式下不可执行`);
    }
    return fn();
  }
}
```

**所有可能产生副作用的操作必须经过统一入口：**

| 副作用操作 | 正式模式 | 测试模式（dry_run） |
|-----------|---------|-------------------|
| 发送消息 | 调用 `sendTextMessage` | **抛出错误**（如意外调用） |
| 创建对话 | 调用 `getOrCreateConversation` | **抛出错误** |
| 写入 Chat 消息 | 调用 `addChatMessage` | **抛出错误** |
| 创建转人工请求 | 调用 `createHandoverRequest` | **抛出错误** |
| 增加未读数量 | 更新 `unreadCount` | **抛出错误** |
| 修改规则使用次数 | `recordUsage("replyRules", id)` | 跳过（引擎层 dryRun 参数） |
| 修改知识库使用次数 | `recordUsage("aiKnowledge", id)` | 跳过（引擎层 dryRun 参数） |
| 建立订单 | 捉单流程 | **抛出错误** |
| 触发通知 | 通知服务 | **抛出错误** |
| 触发 Flow | Flow Engine | 自动跳过（sourceType=private_chat） |

**测试必须验证运行前后以下正式数据不变：**

- `chat_conversations` 行数
- `chat_messages` 行数
- `ai_logs` 行数
- `ai_handover_requests` 行数
- `reply_rules.usageCount` 值
- `ai_knowledge.usageCount` 值
- 订单相关表行数
- 通知记录行数

如果测试模式意外调用发送、订单或转人工函数，`SideEffectPolicy.guard()` 将立即抛出测试错误，而不是静默跳过。

### 2.3 测试入口

测试入口 `server/aiTestRunner.ts` 的执行流程：

1. 构造一个虚拟的 `MessageContext`（`conversationId=undefined`, `customerId=undefined`）
2. 构造一个 `AiProcessingContext`（所有 ID 字段为 null，`sourceType="private_chat"`）
3. 调用 `processChatAI(ctx, { aiEnabled, handoverStatus, logContext, dryRun: true })`
4. 如启用 LLM 且知识命中 `useLLM=true`，调用 `invokeLLM` 并记录轨迹
5. 收集 `ChatAIResult` + `AiProcessingContext.finalize()` 作为测试结果
6. 将结果写入独立的 `ai_test_runs` 表
7. **不调用任何发送函数、不写入任何正式表**

---

## 3. 建议数据库结构

### 3.1 方案选择：方案A — 独立 `ai_test_runs` 表

**推荐方案A**，理由如下：

| 对比维度 | 方案A（独立表） | 方案B（ai_logs + environment=test） |
|---------|---------------|----------------------------------|
| 统计隔离 | 天然隔离，不需要额外筛选 | 每个统计查询都需排除 `environment=test` |
| 误混风险 | 极低（物理隔离） | 中（依赖每个查询都记得加 WHERE 条件） |
| 字段差异 | 可按测试需求自由扩展 | 需在 ai_logs 上加 nullable 列，污染正式表 |
| 查询性能 | 不影响正式日志查询速度 | ai_logs 表增大，索引需覆盖 environment 列 |
| 回归风险 | 不影响现有 AI日志功能 | 现有统计查询可能遗漏筛选条件 |

### 3.2 `ai_test_runs` 表结构

```sql
CREATE TABLE ai_test_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- 测试配置
  platform ENUM('messenger', 'whatsapp') NOT NULL,
  language VARCHAR(20) DEFAULT 'auto',  -- auto/zh/en/ms
  aiEnabled BOOLEAN NOT NULL DEFAULT true,
  handoverStatus ENUM('none', 'pending', 'claimed') NOT NULL DEFAULT 'none',
  enableLLM BOOLEAN NOT NULL DEFAULT true,
  -- 模拟客户场景（修正项2：预留字段，当前引擎未接入）
  simulatedCustomerName VARCHAR(255),
  isMember BOOLEAN DEFAULT false,       -- 预留：当前引擎未使用，显示为"尚未接入"
  hasOrder BOOLEAN DEFAULT false,       -- 预留：当前引擎未使用，显示为"尚未接入"
  -- 测试输入
  testMessage TEXT NOT NULL,
  -- 处理结果
  processingSteps JSON,           -- 完整处理轨迹（与 ai_logs 格式一致）
  finalSource ENUM(
    'order_keyword', 'product', 'reply_rule', 'knowledge', 'llm',
    'no_match', 'error', 'ai_disabled', 'human_claimed'
  ) NOT NULL,                    -- 修正项1：移除 human_handover，统一用 no_match
  matchedRuleId INT,
  matchedKnowledgeId INT,
  matchedProductId INT,
  aiReply TEXT,
  shouldHandover BOOLEAN DEFAULT false,
  handoverReason TEXT,
  processingTimeMs INT,
  errorCode VARCHAR(50),
  errorStage VARCHAR(50),
  errorMessage TEXT,
  -- LLM 追踪（修正项5）
  llmCalled BOOLEAN DEFAULT false,
  llmModel VARCHAR(100),
  llmProcessingTimeMs INT,
  llmSuccess BOOLEAN,
  llmErrorStage VARCHAR(50),
  llmErrorCode VARCHAR(50),
  llmTimedOut BOOLEAN DEFAULT false,
  llmInputTokens INT,
  llmOutputTokens INT,
  -- AI人设快照（修正项3）
  personaSnapshot JSON,          -- 保存测试时的完整人设快照
  -- 管理信息
  testedBy VARCHAR(255) NOT NULL,
  notes TEXT,
  previousRunId INT,             -- 关联上一次测试（用于重新运行）
  -- 时间戳
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  -- 外键
  FOREIGN KEY (matchedRuleId) REFERENCES reply_rules(id) ON DELETE SET NULL,
  FOREIGN KEY (matchedKnowledgeId) REFERENCES ai_knowledge(id) ON DELETE SET NULL,
  FOREIGN KEY (matchedProductId) REFERENCES products(id) ON DELETE SET NULL
);
```

### 3.3 `ai_knowledge` 表扩展 — 草稿状态（修正项6）

当前 `ai_knowledge` 表只有 `isEnabled` 布尔值，无法区分"草稿"和"已发布"。需要新增字段：

```sql
ALTER TABLE ai_knowledge
  ADD COLUMN status ENUM('draft', 'published') DEFAULT 'published' NOT NULL,
  ADD COLUMN sourceAiTestRunId INT NULL,
  ADD COLUMN sourceNote TEXT NULL;
```

| 新增字段 | 用途 |
|---------|------|
| `status` | `draft` = 草稿（不参与引擎匹配），`published` = 已发布（参与匹配） |
| `sourceAiTestRunId` | 记录该知识条目由哪次测试产生（溯源） |
| `sourceNote` | 来源备注（如"由 AI测试 #123 转入"） |

**引擎匹配修改：** `runKnowledgeEngine` 查询时增加 `WHERE status = 'published'` 条件，草稿不参与匹配。

### 3.4 不需要的表

- 不需要 `ai_test_run_delivery_attempts`：测试不发送消息，无需记录发送尝试
- 不需要 `ai_test_run_steps` 子表：处理轨迹以 JSON 存储，与 `ai_logs` 一致

---

## 4. 单次测试处理流程

```
Admin 在 AI测试中心输入测试消息
        │
        ▼
┌─────────────────────────────────┐
│ 1. 构造测试配置                  │
│    - 渠道、语言                  │
│    - handoverStatus              │
│    - aiEnabled                   │
│    - enableLLM                   │
│    - 读取当前正式 AI人设          │
│      （不显示人设选择器）          │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 2. 保存 AI人设快照               │
│    - aiName, replyTone,          │
│      defaultLanguage,           │
│      replyLength, emojiLevel,    │
│      ctaTemplate, replyPrinciples│
│    - personaUpdatedAt            │
│    存入 personaSnapshot JSON     │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 3. 创建 AiProcessingContext       │
│    (conversationId=null,         │
│     customerId=null,             │
│     customerMessageId=null)      │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 4. 调用 processChatAI(           │
│      ctx, {                      │
│        aiEnabled,                │
│        handoverStatus,           │
│        logContext,               │
│        dryRun: true              │
│      })                          │
│                                  │
│  引擎执行顺序（与正式一致）：      │
│  a. AI开启检查                    │
│  b. 人工接手检查                   │
│  c. Flow来源检查（跳过）           │
│  d. 下单关键词/商品匹配            │
│  e. 固定回复规则匹配               │
│  f. 知识库匹配                    │
│  g. LLM调用（如启用且知识命中）     │
│  h. 无匹配 → no_match + 转人工建议 │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 5. LLM 追踪（如调用）             │
│    - llmCalled=true              │
│    - llmModel                    │
│    - llmProcessingTimeMs          │
│    - llmSuccess                  │
│    - llmInputTokens              │
│    - llmOutputTokens             │
│    - 错误时: llmErrorStage,       │
│      llmErrorCode, llmTimedOut   │
│    - 关闭时: 轨迹显示              │
│      "LLM：已跳过（测试配置关闭）" │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 6. 收集结果                       │
│    - ChatAIResult                │
│    - AiProcessingContext.finalize│
│    - 完整处理轨迹 JSON             │
│    - 各引擎命中/未命中/耗时        │
│    - 最终来源与回复内容            │
│    - 人设快照                     │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 7. 写入 ai_test_runs              │
│    (独立表，不影响正式统计)        │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│ 8. 返回前端显示                   │
│    - ⚠️ 模拟测试标识（固定顶部）   │
│    - 处理轨迹可视化               │
│    - 命中来源高亮                  │
│    - 最终回复预览                  │
│    - 转人工建议                    │
│    - 命中的规则/知识/商品链接       │
│    - LLM 追踪信息                 │
└─────────────────────────────────┘
```

---

## 5. 前端页面结构

### 5.1 页面布局

```
┌──────────────────────────────────────────────────────┐
│ AI测试中心                                             │
│                                                       │
│ ┌─────────────────────────────────────────────────┐ │
│ ⚠️ 模拟测试 — 不会发送给客户 · 不会建立对话 · 不影响正式统计 │
│ └─────────────────────────────────────────────────┘ │
├──────────────────────┬───────────────────────────────┤
│                      │                               │
│  测试配置面板          │  测试结果面板                   │
│  (左侧)               │  (右侧)                       │
│                      │                               │
│  ┌────────────────┐  │  ┌─────────────────────┐     │
│  │ 测试消息输入     │  │  │ 处理轨迹（时间线）     │     │
│  │ [文本框]        │  │  │ ✓ AI检查: 通过       │     │
│  │                │  │  │ ✓ Flow检查: 跳过      │     │
│  └────────────────┘  │  │ ✗ 下单关键词: 未命中   │     │
│                      │  │ ✗ 商品匹配: 未命中    │     │
│  ┌────────────────┐  │  │ ✓ 固定回复: 命中#3    │     │
│  │ 渠道: Messenger │  │  │ → 规则名称: 运费说明   │     │
│  │ 语言: 自动       │  │  │ → 耗时: 12ms         │     │
│  │ AI开启: ✅       │  │  │ ○ LLM: 已跳过（关闭） │     │
│  │ 人工接手: 无     │  │  └─────────────────────┘     │
│  │ 启用LLM: ✅      │  │                               │
│  └────────────────┘  │  ┌─────────────────────┐     │
│                      │  │ 最终来源: 固定回复规则   │     │
│  ┌────────────────┐  │  │ 命中规则: #3 运费说明   │     │
│  │ 模拟客户场景     │  │  │ 处理时间: 234ms       │     │
│  │ 客户名: 测试客户 │  │  │ 转人工: 否            │     │
│  │ ─ 预留功能 ─    │  │  └─────────────────────┘     │
│  │ ☐ 模拟会员       │  │                               │
│  │   (尚未接入)     │  │  ┌─────────────────────┐     │
│  │ ☐ 模拟有订单     │  │  │ 模拟回复预览          │     │
│  │   (尚未接入)     │  │  │ "您好，运费说明..."   │     │
│  └────────────────┘  │  │ [复制] [转为知识草稿]  │     │
│                      │  └─────────────────────┘     │
│  [运行测试] [清空]    │                               │
│                      │  [重新运行] [与上次比较]        │
├──────────────────────┴───────────────────────────────┤
│                                                       │
│  历史测试记录                                          │
│  ┌────┬────┬─────┬────┬────┬──────┬────┐            │
│  │ 时间 │ 问题 │ 来源 │ 命中 │ 转人工│ 测试人 │ 操作│            │
│  ├────┼────┼─────┼────┼────┼──────┼────┤            │
│  │ ...  │ ...  │ ...  │ ...  │ ...  │ ...   │ 查看│            │
│  └────┴────┴─────┴────┴────┴──────┴────┘            │
│  [筛选: 来源/日期/测试人]                              │
└───────────────────────────────────────────────────────┘
```

### 5.2 模拟测试标识（修正项9）

测试结果区域顶部固定显示醒目提示条：

> **⚠️ 模拟测试 — 不会发送给客户 · 不会建立对话 · 不影响正式统计**

该提示条始终可见，不可关闭，避免 Admin 将模拟回复误认为已经发送。

### 5.3 模拟会员与模拟订单（修正项2）

**当前引擎不读取会员或订单状态。** `processChatAI` 及各引擎函数的 `MessageContext` 中没有 `isMember` 或 `hasOrder` 字段，引擎逻辑中也没有相关分支。

**本阶段处理方式：**

- 在配置面板中显示"模拟会员"和"模拟有订单"两个选项
- 选项旁标注 **"（预留：尚未接入引擎）"** 灰色文字
- 勾选后对测试结果**无影响**，但在处理轨迹中记录"会员状态检查：预留功能，尚未接入引擎"
- **不提供**模拟订单状态、订单编号或付款状态等更细粒度选项
- 未来引擎接入会员/订单逻辑后，这些选项将自动生效

### 5.4 AI人设使用方式（修正项3）

**当前系统只有一套正式 `ai_persona`。** 测试中心直接读取当前已保存的正式人设，**不显示人设选择器**。

**人设快照保存：** 每次测试记录保存时，在 `personaSnapshot` JSON 字段中保存以下完整快照：

| 快照字段 | 来源 |
|---------|------|
| aiName | `ai_persona.aiName` |
| replyTone | `ai_persona.replyTone` |
| defaultLanguage | `ai_persona.defaultLanguage` |
| replyLength | `ai_persona.replyLength` |
| emojiLevel | `ai_persona.emojiLevel` |
| ctaTemplate | `ai_persona.ctaTemplate` |
| replyPrinciples | `ai_persona.replyPrinciples` |
| personaUpdatedAt | `ai_persona.updatedAt` |

这样以后修改人设后，仍能知道历史测试当时使用的是哪一版设置。未来如支持多套人设，需扩展 `personaId` 字段。

### 5.5 组件结构

| 组件 | 职责 |
|------|------|
| `AiBrainTest.tsx` | 主页面，管理测试配置、结果展示与历史记录 |
| `TestConfigPanel` | 左侧配置面板（消息输入、渠道、语言、场景开关） |
| `TestResultPanel` | 右侧结果面板（模拟测试标识、处理轨迹、命中详情、回复预览、LLM追踪） |
| `TestHistoryTable` | 底部历史记录表格（筛选、查看、重新运行、比较） |
| `TestCompareDialog` | 两次测试结果比较弹窗（并排显示差异，使用保存快照） |
| `ConvertToDraftDialog` | 转为知识库草稿确认弹窗（查重、确认、跳转） |

### 5.6 Tab 入口

将 `AiBrain.tsx` 中 `test` Tab 从 `disabled` 改为可点击，替换 `ComingSoon` 组件为 `AiBrainTest` 懒加载组件。不新增侧边栏菜单。

---

## 6. 测试记录保存策略

### 6.1 保存内容

| 字段 | 来源 | 说明 |
|------|------|------|
| testMessage | Admin 输入 | 测试问题原文 |
| processingSteps | AiProcessingContext.finalize() | 完整处理轨迹 JSON |
| finalSource | ChatAIResult.source | 最终命中来源 |
| matchedRuleId | ChatAIResult.ruleId | 命中的固定回复规则 ID |
| matchedKnowledgeId | ChatAIResult.knowledgeId | 命中的知识库条目 ID |
| matchedProductId | ChatAIResult.productId | 命中的商品 ID |
| aiReply | ChatAIResult.reply | AI 最终回复内容 |
| shouldHandover | ChatAIResult.shouldHandover | 是否建议转人工 |
| handoverReason | ChatAIResult.handoverReason | 转人工原因 |
| processingTimeMs | AiProcessingContext.finalize() | 总处理耗时 |
| errorCode | 测试异常 | 错误码（如有） |
| errorStage | 测试异常 | 错误阶段（如有） |
| errorMessage | 测试异常 | 错误信息（如有） |
| llmCalled | 测试运行服务 | 是否调用了 LLM |
| llmModel | invokeLLM 参数 | 使用的模型 ID |
| llmProcessingTimeMs | 测试运行服务 | LLM 处理耗时 |
| llmSuccess | invokeLLM 结果 | LLM 是否成功 |
| llmErrorStage | 测试异常 | LLM 错误阶段 |
| llmErrorCode | 测试异常 | LLM 错误码 |
| llmTimedOut | 测试异常 | 是否因超时回退 |
| llmInputTokens | invokeLLM 结果 | 输入 token 数（如可获取） |
| llmOutputTokens | invokeLLM 结果 | 输出 token 数（如可获取） |
| personaSnapshot | db.getAiPersona() | AI人设完整快照 JSON |
| testedBy | ctx.user.name | 测试管理员 |
| notes | Admin 手动输入 | 测试备注（可选） |
| previousRunId | 重新运行时 | 关联的原测试记录 ID |

### 6.2 保留策略

- 测试记录默认保留 180 天（可通过环境变量 `AI_TEST_RETENTION_DAYS` 配置）
- Heartbeat 定时清理任务每日执行，删除超期记录
- Admin 可手动删除单条或批量清理测试记录

### 6.3 不保存的内容

- 不保存发送尝试（测试不发送消息）
- 不保存 customerMessageId / aiReplyMessageId（测试不创建真实消息）
- 不保存 conversationId（测试不创建真实对话）

---

## 7. 与 AI日志的关系

| 维度 | AI日志 (ai_logs) | AI测试记录 (ai_test_runs) |
|------|------------------|--------------------------|
| 触发方式 | 真实客户消息 | Admin 手动测试 |
| 数据表 | `ai_logs` + `ai_log_delivery_attempts` | `ai_test_runs`（独立表） |
| 统计影响 | 计入 Dashboard、AI分析 | 不计入任何正式统计 |
| 发送行为 | 真实发送 + 重试 | 不发送 |
| 对话创建 | 创建真实 Chat 对话 | 不创建对话 |
| 转人工 | 创建真实转人工请求 | 仅显示建议，不创建 |
| 使用次数 | 递增 reply_rules / ai_knowledge 的 usageCount | 不递增 |
| 处理轨迹 | 格式一致（JSON） | 格式一致（JSON） |
| 查看权限 | Admin | Admin |

**关键保证：** Dashboard 总控制台统计、AI日志统计、AI分析（未来）默认只查询 `ai_logs` 表，`ai_test_runs` 完全不参与正式营运统计。

---

## 8. 与商品、固定回复、知识库、AI人设的兼容方式

### 8.1 只读复用，不建立第二套测试资料

测试中心直接读取以下正式表的数据，不创建测试专用副本：

| 数据源 | 读取方式 | 写入影响 |
|--------|---------|---------|
| AI人设 (`ai_persona`) | `db.getAiPersona()` | 只读，保存快照 |
| 固定回复规则 (`reply_rules`) | `runReplyRuleEngine(ctx, { dryRun: true })` | 跳过 `recordUsage` |
| 知识库 (`ai_knowledge`) | `runKnowledgeEngine(ctx, { dryRun: true })` | 跳过 `recordUsage`，仅匹配 `status='published'` |
| 商品资料 (`products`) | `runProductMatchEngine(ctx)` | 只读（本就无写入） |
| AI规则 | `processChatAI` 内部逻辑 | dryRun 模式跳过所有副作用 |

### 8.2 从测试结果跳转到正式资料

测试结果中命中的规则/知识/商品显示为可点击链接，点击后跳转到对应的 AI知识库或固定回复管理页面（使用 `?tab=knowledge` 或 `?tab=reply-rules` 深链接），方便 Admin 直接查看和修改。

### 8.3 转为知识库草稿（修正项6）

当测试结果为 `no_match`（无法回答）时，提供"转为知识库草稿"按钮。该操作必须满足：

| 要求 | 实现方式 |
|------|---------|
| 由 Admin 主动点击确认 | 弹窗确认，不自动执行 |
| 不自动发布 | 新建知识条目 `status='draft'` |
| 不自动启用 | `isEnabled=false`（草稿不参与匹配） |
| 不直接影响正式AI回复 | `status='draft'` 的条目被引擎排除 |
| 建立后状态为草稿 | `status='draft'`，`sourceAiTestRunId` 记录来源 |
| 保存来源 | `sourceAiTestRunId` = 当前测试记录 ID |
| 检查重复 | 查询 `ai_knowledge` 是否已有相同 `triggerKeywords` 或相近 `topic`，如有则提示 |
| 成功后提供跳转 | 显示"打开知识库草稿"按钮，跳转到 AI知识库管理页面 |

**需要扩展 `ai_knowledge` 表：** 新增 `status`、`sourceAiTestRunId`、`sourceNote` 字段（见 3.3 节）。不能用 `isEnabled=false` 代替草稿而不作区分。

---

## 9. 最终来源定义（修正项1）

### 9.1 统一规则

| finalSource | 含义 | 触发条件 |
|-------------|------|---------|
| `order_keyword` | 下单关键词 | 消息包含商品关键词（未来扩展） |
| `product` | 商品资料匹配 | `runProductMatchEngine` 命中 |
| `reply_rule` | 固定回复规则 | `runReplyRuleEngine` 命中 |
| `knowledge` | 知识库 | `runKnowledgeEngine` 命中（`useLLM=false`） |
| `llm` | LLM 生成 | 知识库 `useLLM=true` 且 LLM 调用成功 |
| `no_match` | 无匹配（所有引擎未命中） | 统一使用，`shouldHandover=true`，`handoverReason=...` |
| `error` | 处理错误 | 引擎执行异常 |
| `ai_disabled` | AI已关闭 | `aiEnabled=false` |
| `human_claimed` | 人工已接手 | `handoverStatus=claimed` |

**`human_handover` 保留但本阶段不使用。** 只有未来由明确的"转人工规则"主动触发时才使用 `finalSource=human_handover`（例如：客户输入"我要真人"，命中强制转人工规则）。本阶段普通"所有引擎未命中"统一使用 `no_match` + `shouldHandover=true`。

### 9.2 从 finalSource 枚举中移除 human_handover

`ai_test_runs.finalSource` 枚举不包含 `human_handover`，避免误用。未来需要时再通过迁移添加。

---

## 10. 历史比较与重新运行（修正项7）

### 10.1 历史比较

"与上次比较"比较两条**已保存**的测试记录，**不自动重新运行旧测试**。

比较内容：

| 比较维度 | 说明 |
|---------|------|
| 测试问题 | 并排显示两次的问题文本 |
| 测试配置 | 渠道、语言、AI开启、人工接手、LLM开启 |
| AI人设快照 | 并排显示两次的人设关键字段 |
| 命中来源 | 并排显示 finalSource |
| 命中的规则/知识/商品 | 并排显示 ID 与名称 |
| 最终回复 | 并排显示回复文本，高亮差异 |
| 是否转人工 | 并排显示 |
| 处理时间 | 并排显示数值 |
| 处理轨迹差异 | 逐步骤对比，标注差异步骤 |

比较弹窗使用 `TestCompareDialog` 组件，从 `ai_test_runs` 读取两条记录的完整数据（包括 `personaSnapshot` 和 `processingSteps`），不重新执行引擎。

### 10.2 重新运行

"重新运行"作为独立按钮，使用原测试的 `testMessage` 和配置参数**重新执行**引擎，建立**新的** `ai_test_runs` 记录，通过 `previousRunId` 关联原测试。

---

## 11. 测试记录删除与审计（修正项8）

| 要求 | 实现方式 |
|------|---------|
| 仅 Admin 可删除 | 路由使用 `adminProcedure` |
| 删除前二次确认 | 前端弹窗确认 |
| 支持单条删除和批量清理 | `aiTest.delete` + `aiTest.batchDelete` |
| 不允许删除正式 AI日志 | 测试删除只操作 `ai_test_runs` 表 |
| 自动清理与手动删除都记录数量和时间 | 写入系统日志（console + 可选数据库审计表） |

本阶段不需要复杂审计页面，但删除操作会在服务器日志中记录：`[AI Test] Admin {name} deleted {count} test run(s) at {timestamp}`。

---

## 12. LLM 测试追踪（修正项5）

### 12.1 启用 LLM 时

当 `enableLLM=true` 且知识库命中 `useLLM=true` 的条目时：

| 追踪字段 | 来源 | 说明 |
|---------|------|------|
| llmCalled | 测试运行服务 | `true` |
| llmModel | invokeLLM 参数 | 使用的模型 ID |
| llmProcessingTimeMs | 测试运行服务计时 | LLM 调用耗时 |
| llmSuccess | invokeLLM 结果 | 是否成功 |
| llmErrorStage | 异常捕获 | 错误阶段（如 `llm_call`） |
| llmErrorCode | 异常捕获 | 错误码 |
| llmTimedOut | 超时检测 | 是否因超时回退 |
| llmInputTokens | invokeLLM 结果 `usage.prompt_tokens` | 输入 token 数（如可获取） |
| llmOutputTokens | invokeLLM 结果 `usage.completion_tokens` | 输出 token 数（如可获取） |

处理轨迹中增加 LLM 步骤，显示模型、耗时、token 使用量。

### 12.2 关闭 LLM 时

当 `enableLLM=false` 时：

- **不调用 LLM**
- 处理轨迹明确显示：`LLM：已跳过（测试配置关闭）`
- `llmCalled=false`
- 如知识命中 `useLLM=true` 的条目，仍返回该条目的 `content` 作为回复（不经过 LLM 加工），`finalSource=knowledge`

---

## 13. 风险与解决方法

| 风险 | 影响 | 解决方法 |
|------|------|---------|
| 引擎函数 dryRun 参数遗漏 | 测试模式递增 usageCount，污染真实统计 | SideEffectPolicy 统一拦截 + 单元测试验证 usageCount 不变 |
| 测试模式误创建对话 | 正式 Chat 出现虚假对话 | SideEffectPolicy.guard() 抛出错误 + 测试入口不调用任何对话/消息创建函数 |
| LLM 调用失败 | 测试结果不完整 | 捕获 LLM 错误，记录 `llmErrorStage`、`llmErrorCode`，返回部分结果 |
| LLM 超时 | 测试卡住 | 设置超时限制，`llmTimedOut=true`，回退到知识库原文 |
| 测试记录膨胀 | 数据库空间占用 | 180 天保留期限 + Heartbeat 定时清理 |
| Admin 误以为测试结果已发送 | 误导操作判断 | 结果面板顶部固定显示模拟测试标识 |
| 现有 previewReply 功能冲突 | 功能重叠 | 保留 previewReply 作为人设页面的快速预览，测试中心提供更完整的引擎轨迹与场景模拟 |
| 并发测试影响 | 多 Admin 同时测试 | 测试为无状态读取，不修改任何正式数据，天然支持并发 |
| 知识库草稿误参与匹配 | 草稿内容被发送给客户 | 引擎查询增加 `status='published'` 条件 |
| 历史比较误重新运行 | 旧结果受当前规则影响 | 比较只读取已保存记录，不重新执行引擎 |

---

## 14. 开发步骤与验收标准

### 14.1 开发步骤

| 步骤 | 内容 | 涉及文件 |
|------|------|---------|
| 1 | 数据库 schema：新增 `ai_test_runs` 表 + 扩展 `ai_knowledge` 表（status/sourceAiTestRunId/sourceNote） | `drizzle/schema.ts`, `drizzle/migrations/0008_ai_test_runs.sql` |
| 2 | 引擎 dryRun 改造：为 `runReplyRuleEngine`、`runKnowledgeEngine`、`processChatAI` 增加 `dryRun` 参数；知识库查询增加 `status='published'` | `server/aiEngines.ts` |
| 3 | SideEffectPolicy + 测试运行服务：新增 `server/aiTestRunner.ts` | `server/aiTestRunner.ts` |
| 4 | 数据库辅助函数：`createTestRun`、`getTestRuns`、`getTestRunDetail`、`deleteTestRun`、`batchDeleteTestRuns`、`cleanupOldTestRuns`、`createKnowledgeDraft`、`checkDuplicateKnowledge` | `server/db.ts` |
| 5 | tRPC 路由：`aiTest.run`、`aiTest.list`、`aiTest.getDetail`、`aiTest.delete`、`aiTest.batchDelete`、`aiTest.compare`、`aiTest.rerun`、`aiTest.convertToDraft` | `server/routers.ts` |
| 6 | 前端页面：`AiBrainTest.tsx`（配置面板 + 结果面板 + 历史表格 + 比较弹窗 + 转草稿弹窗） | `client/src/pages/AiBrainTest.tsx` |
| 7 | AiBrain.tsx 启用 test Tab，替换 ComingSoon | `client/src/pages/AiBrain.tsx` |
| 8 | Heartbeat 定时清理任务 | `server/_core/heartbeat.ts` |
| 9 | 单元测试：dryRun 副作用隔离、usageCount 不变、SideEffectPolicy 抛错、测试运行服务、路由权限、转草稿查重、比较使用快照 | `server/ai-test.*.test.ts`, `client/src/pages/aiBrainTest.test.ts` |
| 10 | CHANGELOG 更新、TypeScript 检查、Vitest 全部通过 | `CHANGELOG.md` |

### 14.2 验收标准

| 验收项 | 标准 |
|--------|------|
| 单次测试 | Admin 输入问题 → 显示完整处理轨迹 + 最终来源 + 模拟回复 + 转人工建议 |
| 模拟测试标识 | 结果区域顶部固定显示"模拟测试"提示 |
| 不真实发送 | 测试过程中不调用任何 Messenger/WhatsApp 发送函数 |
| 不创建对话 | `chat_conversations` 和 `chat_messages` 表无新增记录 |
| 不影响统计 | `reply_rules.usageCount` 和 `ai_knowledge.usageCount` 不递增 |
| 不创建转人工 | `ai_handover_requests` 表无新增记录 |
| 不影响 AI日志 | `ai_logs` 表无新增记录 |
| 副作用隔离 | SideEffectPolicy 在 dry_run 下对禁止操作抛出错误 |
| 处理轨迹完整 | 显示 AI检查、Flow检查、下单关键词、商品匹配、固定回复、知识库、LLM、转人工全部步骤 |
| 命中来源区分 | 正确显示 product / reply_rule / knowledge / llm / no_match / ai_disabled / human_claimed / error |
| 命中详情 | 显示命中的规则名称与编号、知识条目名称与编号、商品名称与编号 |
| 处理时间 | 显示真实总处理时间与各步骤耗时 |
| LLM 追踪 | 显示是否调用 LLM、模型、耗时、token 数、成功/失败 |
| LLM 关闭 | 关闭时轨迹显示"LLM：已跳过（测试配置关闭）"，不调用 LLM |
| 会员/订单预留 | 选项标注"尚未接入"，勾选对结果无影响 |
| 人设快照 | 历史记录可查看当时的人设配置 |
| 历史记录 | 可查看历史测试列表，支持按来源/日期/测试人筛选 |
| 重新运行 | 可从历史记录重新运行测试，新记录通过 previousRunId 关联 |
| 结果比较 | 可比较两次测试结果差异，使用保存快照而非重新运行 |
| 跳转链接 | 可从命中结果跳转到对应知识库/固定回复管理页面 |
| 转为草稿 | Admin 确认后创建草稿知识条目，查重提示，跳转入口 |
| 草稿不参与匹配 | `status='draft'` 的知识条目不被引擎匹配 |
| Admin 备注 | 可为测试记录添加备注 |
| 删除审计 | 删除操作记录到系统日志 |
| Tab 启用 | AI大脑中 AI测试 Tab 可点击，不再显示"即将开发" |
| TypeScript | 零错误 |
| Vitest | 全部测试通过 |
| 正式处理不受影响 | 现有 processChatAI 正式调用行为不变，回归测试全部通过 |
| 正式数据不变 | 测试前后 chat_conversations/chat_messages/ai_logs/ai_handover_requests/usageCount 行数和值不变 |
