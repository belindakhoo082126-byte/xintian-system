# Meta Page 公开留言与直播捉单权限核查

记录日期：2026-08-15（GMT+8）  
用途：用于规划 XinTian Garden 的 Facebook Page 帖子评论、直播公开留言接收与受控捉单；不改变当前仅申请 `pages_messaging` 的私聊审核范围。

## 已核实的官方结论

Meta 的 Pages Webhooks 官方文档说明，Page 的 `feed` Webhook 会在 Page 动态发生变化时推送通知，范围包括贴文、评论、反应与分享。公开评论或直播公开互动应以 `feed` 订阅为接收入口，而不是以 Messenger 的 `messages` Webhook 代替。

对于 `feed` Webhook，官方明确列出：申请 Page access token 的人员必须具备 Page 的 `CREATE_CONTENT`、`MANAGE` 或 `MODERATE` 任务，并且应用需要 `pages_manage_metadata` 与 `pages_show_list`。通知仅会推送到已将该 Webhook 应用安装到 Page 的场景；安装操作使用 `POST /{page-id}/subscribed_apps?subscribed_fields=feed`。Page Webhook Reference（Graph API v26.0）还明确将 `feed` 定义为覆盖 Page feed 的几乎所有变化，并列举贴文、分享与互动；该文档没有提供另一个专门名为“live comments”的 webhook 字段。

Pages API Overview（2026-05-07 更新）列出：`pages_read_user_content` 用于读取用户在 Page 上发布的内容；`pages_manage_engagement` 用于审核、删除评论；`pages_read_engagement` 用于读取 Page 内容／互动；`pages_manage_metadata` 用于管理 Page 设定。同期的 Manage a Page 及 Posts 文档则将 `pages_read_user_engagement` 列入 Page 管理／贴文流程的权限集合。不同官方页面对“读取用户互动”显示的权限名称不完全一致，因此实际申请前必须以当前 App Dashboard 的权限名称、正在使用的 Graph API 版本和 endpoint 返回的必需权限为准，不能自行凭旧名称扩大提交范围。

官方 `/ {object-id}/comments` 参考确认：`Live Video` 是支持 `/comments` edge 的对象之一；读取评论遵循读取其父对象所需的同一权限。若以 Page 身份发布公开评论或回复，官方明确需要具有 `MODERATE` Page task 的 Page access token 及 `pages_manage_engagement`。因此，XinTian 的“只接收、匹配关键词、建立待审核请求”与“公开回复评论”必须划为两项独立功能和审核范围。

Page Public Content Access 是在应用缺少 `pages_read_engagement` 和 `pages_read_user_content` 时读取**不由应用用户管理的其他公开 Page** 内容的功能，并非 XinTian 自己管理的 Page 直播捉单所应优先申请的权限；它同样需要企业验证与 App Review。为避免扩大范围，本项目不把它纳入当前方案。

## 当前最小边界

1. **只接收并解析公开留言、只建立待审核捉单请求、不写公开回复**：先以 `pages_show_list` 与 `pages_manage_metadata` 建立 `feed` webhook 订阅，并在实际 endpoint 测试中确认是否还被 Meta 强制要求读取用户互动的权限。
2. **需要读取／查询完整的用户评论内容或补拉评论明细**：根据 App Dashboard 与最终 endpoint 的权限提示，在 `pages_read_user_content`／`pages_read_user_engagement` 中确认实际要求；不应在未实现或未需要补拉评论前预先申请。
3. **需要以 Page 身份写公开回复、隐藏、删除或审核评论**：预期需要评估 `pages_manage_engagement`；当前 XinTian 的受控捉单目标不应默认加入。
4. **需要发送私聊结账链接、私聊自动回复或处理 Messenger 对话**：仍属 `pages_messaging` 范围，必须和公开留言 `feed` 流程分开审核、分开演练。

## 需要在提交前进行的验证

- 在 App Dashboard 选择 Page 对象，保留既有 `messages` 字段，并增加／确认 `feed` 字段。
- 使用具备 Page `MANAGE` 或 `MODERATE` 任务的帐户生成、更新 Page token；仅对 Page 执行应用订阅，不将访问令牌暴露于截图、聊天或客户端。
- 以测试贴文或测试直播发送一条明确关键词留言，确认 webhook 原始事件已进入服务器日志。
- 后端应只为明确、可安全匹配的商品与数量建立待审核请求；不匹配时建立人工交接，不公开回复、不直接改订单、不确认付款。
- 如果要开启公开回复或私聊引导，应分别复核平台互动窗口、消息政策与所需权限后再提交。

## 来源

1. Meta, [Webhooks for Pages](https://developers.facebook.com/documentation/pages-api/webhooks-for-pages)（Page `feed`、应用安装、`pages_manage_metadata` 与 `pages_show_list` 要求）。
2. Meta, [Webhooks for Pages — Getting Started](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages/)（同一要求及 `subscribed_apps` 操作）。
3. Meta, [Facebook Pages API](https://developers.facebook.com/documentation/pages-api)（2026-05-07；Page 权限与公开评论管理范围）。
4. Meta, [Page Webhooks Reference](https://developers.facebook.com/docs/graph-api/webhooks/reference/page/)（Graph API v26.0；`feed` 字段范围）。
5. Meta, [Object Comments Reference](https://developers.facebook.com/docs/graph-api/reference/object/comments/)（Graph API v26.0；Live Video 为支持评论对象；公开回复的 `pages_manage_engagement` 要求）。
6. Meta, [Manage a Page](https://developers.facebook.com/documentation/pages-api/manage-pages)（2026-06-30；Page tasks 与当前权限集合）。
7. Meta, [Page Public Content Access](https://developers.facebook.com/docs/features-reference/page-public-content-access/)（其他公开 Page 内容的读取范围与审核要求）。
8. Meta, [Permissions Reference](https://developers.facebook.com/docs/permissions/)（Advanced Access 需要企业验证；只申请实际所需权限）。
