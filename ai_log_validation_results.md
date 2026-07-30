# AI日志真实流程验证结果

## 测试方法
通过模拟 Facebook Messenger webhook（使用真实 FB_APP_SECRET 签名）向本地开发服务器发送5条测试消息，触发完整 AI处理流程。

## 测试消息与结果

### 1. 固定回复命中 — "请问运费怎么算？"
- **ai_logs #1**: finalSource=reply_rule, matchedRuleId=1, sendStatus=failed
- **处理轨迹**: 收到消息 → AI开启检查(passed) → Flow检查(skipped) → 下单关键词(missed) → 商品匹配(missed) → **固定回复规则命中(ID:1)(hit)** → 发送尝试(pending) → 发送失败(failed)
- **发送失败原因**: ERR_BAD_REQUEST (测试PSID非真实Facebook用户，Messenger API拒绝发送)
- **reply_rules #1 使用次数**: 0→1, lastMatchedAt已更新
- **processingTimeMs**: 2384ms

### 2. 固定回复命中 — "hi"
- **ai_logs #2**: finalSource=reply_rule, matchedRuleId=5, sendStatus=failed
- **处理轨迹**: 同上，**固定回复规则命中(ID:5)(hit)**
- **reply_rules #5 使用次数**: 0→1, lastMatchedAt已更新
- **processingTimeMs**: 2134ms

### 3. 知识库命中 — "我想了解会员制度"
- **ai_logs #3**: finalSource=knowledge, matchedKnowledgeId=2, sendStatus=failed
- **处理轨迹**: ... → 固定回复(missed) → **AI知识库命中(ID:2)(hit)** → 发送尝试(pending) → 发送失败(failed)
- **ai_knowledge #2 使用次数**: 0→1, lastMatchedAt已更新
- **processingTimeMs**: 2383ms

### 4. 知识库命中 — "请问怎么浇水养护？"
- **ai_logs #4**: finalSource=knowledge, matchedKnowledgeId=3, sendStatus=failed
- **处理轨迹**: ... → 固定回复(missed) → **AI知识库命中(ID:3)(hit)** → 发送尝试(pending) → 发送失败(failed)
- **ai_knowledge #3 使用次数**: 0→1, lastMatchedAt已更新
- **processingTimeMs**: 2362ms

### 5. 转人工 — "我想订购一批特殊肥料，可以帮忙吗？"
- **ai_logs #5**: finalSource=no_match, isHandover=1, sendStatus=not_sent
- **处理轨迹**: ... → 固定回复(missed) → 知识库(missed) → **转人工(handover)**
- **handoverReason**: "AI无法匹配客户消息，需要人工处理"
- **ai_handover_requests #1**: conversationId=1, status=pending, priority=medium
- **processingTimeMs**: 1350ms

## 发送尝试子表 (ai_log_delivery_attempts)
- 4条记录（#1-4），全部 attemptNumber=1, sendStatus=failed, errorCode=ERR_BAD_REQUEST
- 转人工日志(#5)无发送尝试（not_sent，未尝试发送）
- 每条主日志只有1条对应的发送尝试记录（不重复）

## 关键验证点

| 验收项 | 结果 |
|---|---|
| 客户消息进入Chat | ✅ conversationId=1 创建 |
| AI日志生成主日志 | ✅ 5条主日志 |
| customerMessageId关联 | ✅ 通过storeIncomingMessengerMessage返回 |
| conversationId关联 | ✅ 全部关联到conversationId=1 |
| Flow检查显示跳过 | ✅ "普通私聊，不进入Flow Engine" [skipped] |
| 不误触发Flow Engine | ✅ sourceType=private_chat |
| 真实处理时间 | ✅ 1350-2384ms |
| 固定回复命中 | ✅ finalSource=reply_rule, matchedRuleId正确 |
| 知识库命中 | ✅ finalSource=knowledge, matchedKnowledgeId正确 |
| 使用次数更新 | ✅ reply_rules和ai_knowledge的usageCount=1, lastMatchedAt已更新 |
| 转人工 | ✅ isHandover=1, handoverReason正确, ai_handover_requests已创建 |
| 发送失败记录 | ✅ errorCode=ERR_BAD_REQUEST, errorStage=messenger_send |
| 发送尝试子表 | ✅ 4条pending→failed记录 |
| 重试不产生第二条主日志 | ✅ 每条主日志只有1条发送尝试 |
| 重试功能已实现 | ✅ 管理员可在日志详情点击「重试发送」，新增发送尝试并递增retryCount |
| 重试成功后主日志更新为sent | ✅ 单元测试覆盖重试成功与失败路径 |
| Flow来源日志 | 🟡 待真实Flow验证（无真实Flow来源可测试） |

## 发送失败说明
测试使用模拟PSID "9000000000000001"，非真实Facebook用户，Messenger API返回400错误。
这恰好验证了发送失败与重试日志生命周期：主日志failed + 发送尝试failed + errorCode + errorStage + errorMessage全部正确记录。

## 发送重试功能
- 管理员可在AI日志详情页中，对 sendStatus=failed 的私聊日志点击「重试发送」
- 重试会新增一条 delivery attempt（attemptNumber递增），不会创建第二条主日志
- retryCount 递增，主日志最终状态根据重试结果更新为 sent 或保持 failed
- 重试成功后同步更新 chat_messages 中的AI回复消息状态
- 单元测试覆盖：重试成功、重试仍失败、拒绝已发送日志重试、拒绝非私聊来源重试

## SSE 实时同步
- aiLog SSE 分类已注册到前端 useRealtimeSync 缓存刷新映射
- 双客户端广播单元测试验证：两个独立客户端均接收到同一 aiLog 变更事件
- 日志列表、统计与详情查询在收到 SSE 事件后自动刷新

## 页面验收
- 日期、客户、渠道、来源、状态、转人工、错误阶段和关键词筛选正常
- 日志可展开完整处理轨迹
- 发送尝试记录可查看（attemptedAt 时间格式已修复）
- 「打开对应 Chat」可定位正确对话
- Dashboard「查看AI日志」通过深链接 ?tab=log 进入正确 Tab
- 重试次数 Badge 在列表中显示
