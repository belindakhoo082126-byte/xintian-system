# 真实 Messenger 演练阻塞记录

记录时间：2026-08-15（GMT+8）

## 已确认现象

1. 测试账号已向 XinTian Page 发送首条下单测试消息，但截至查询时，`chat_conversations`、`chat_messages`、`draft_orders` 和 `order_change_requests` 均没有新的对应记录。
2. 本地服务运行日志没有新的 `[Messenger] Received event` 或 webhook 处理记录；最新聊天记录停留在 2026-07-30 的历史测试会话。
3. 生产域名与 Manus 域名上的 `/api/facebook/webhook` 均可达；在未提供验证参数时返回 HTTP 403，符合 webhook 安全设计。
4. 已登录的正式后台可打开「Facebook 设置」页面；该页面展示 Page ID、App ID、Page Access Token、App Secret 和 Catalog Token 的配置状态，并提示须在 Meta 开发者后台将 webhook 回调 URL、验证口令、订阅字段和 Page 订阅完整配置。

## 当前结论

私聊 AI 的受控业务写入已发布，但真实消息尚未进入应用 webhook，故无法开始验证草稿、资料变更或付款凭据流程。阻断点位于 Meta Page / App 的 webhook 订阅或测试账号权限链路，而非私聊 AI 的业务写入逻辑。

## 后续核对项

在 Meta Developers 中确认：

- Messenger Webhook callback URL 使用正式站点 `https://www.xintian.com.my/api/facebook/webhook`；
- 验证口令与后台 Facebook 设置页显示值完全一致；
- 应用订阅 `messages`、`messaging_postbacks`、`feed`、`comments`；
- XinTian Page 已在「添加订阅」中绑定该应用；
- 发信的测试 Facebook 帐号是该 App 的管理员、开发者或测试者，或 App 已取得允许对应用户私聊的审核权限；
- 重新发送新消息后，后台聊天记录和服务端 webhook 日志同步出现入站事件。
