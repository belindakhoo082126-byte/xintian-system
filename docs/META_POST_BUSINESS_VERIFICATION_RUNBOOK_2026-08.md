# Meta 企业验证通过后的操作清单与公开留言权限方案

**适用对象：** XinTian Messenger / XinTian Garden Page  
**企业法定名称：** ECOLAND NURSERY  
**当前审核范围：** 第一阶段仅申请 `pages_messaging`，用于客户主动发起的 Messenger 私聊。  
**编制日期：** 2026-08-15

> 本文件将 **Messenger 私聊收单** 与 **Facebook 直播／帖子公开留言捉单** 分成两条独立的审批、配置和验收路径。两者不要在同一次、同一份最小权限申请中混写或混测。

## 一、当前状态与上线原则

目前 Meta 企业验证已显示“审核中”，平台提示约需两个工作日。系统已具备已验证的 Webhook 回调、Page 订阅基础、访问令牌、App Secret 签名校验、公开隐私政策／条款／资料删除页，以及私聊 AI 的待审核草稿、订单变更请求和付款凭据人工审核边界。

企业验证通过并不是功能已自动上线。它只是使 App 可以提交 Advanced Access 审核的前置条件；每个权限仍须获得 Meta 批准，并要在真实 Page 上完成受控事件验收。[1]

| 工作流 | 当前申请范围 | 正式启用前的必要条件 |
|---|---|---|
| 客户主动发起的 Messenger 私聊 | `pages_messaging` | 企业验证通过、Advanced Access 获批、Page 保持订阅、真实端到端演练通过 |
| 帖子评论／直播公开留言捉单 | 独立范围，暂不加入本次私聊申请 | 额外权限逐项获批、`feed` Webhook 成功订阅、真实公开留言演练通过 |
| 公开评论自动回复 | 仅在业务确实需要时独立开启 | 在公开留言范围内取得评论管理权限，并通过回复验收 |

## 二、企业验证通过后：第一阶段 Messenger 私聊操作清单

### A. 先确认审核状态，不要重复提交

1. 在 Meta Business Settings 的“安全中心／公司验证”确认 ECOLAND NURSERY 状态变为 **已验证**。
2. 若显示“需要更多资料”或“被拒绝”，先依 Meta 指出的原因补正；不要改用虚构资料、Page 截图、转发邮箱或重复建立多个申请。
3. 验证通过后，回到 Meta for Developers 的 **XinTian Messenger App → 用例 → Messenger from Meta → 权限和功能**。

### B. 保持第一阶段仅申请 `pages_messaging`

4. 再次确认审核清单中只保留 **`pages_messaging`**。不要把 `business_management`、广告、Instagram、WhatsApp、Human Agent 或公开留言权限混入本次申请。
5. 在 `pages_messaging` 的审核说明填写以下实际用途，并确保与系统行为一致：

> XinTian Garden uses pages_messaging to receive and respond to customer messages sent to the XinTian Facebook Page via Messenger. The app reads incoming messages to detect order intents, including product inquiries, order placement, quantity changes, address updates, and payment proof images. Detected intents are queued as draft orders or change requests for admin review; no order is confirmed without human approval. Payment proof images are stored and reviewed by admins before payment is marked as received. The app also sends automated order confirmation, shipping notification, and checkout-link messages to customers who have initiated contact.

6. 填入测试账号 **Enabelle Khoo**、测试 Page **XinTian Garden**，并提供以下可复现步骤：

| 测试步骤 | 审核人员与系统应看到的结果 |
|---|---|
| 测试账号私信 Page：“你好，我想买黄豆肥 1 包” | 系统识别订单意图，只建立待审核草稿订单；不直接确认正式订单 |
| 管理员打开 `/draft-orders` | 可以查看草稿内容并由人工决定批准或拒绝 |
| 测试账号私信改地址或改数量／规格 | 系统建立订单变更请求；管理员在 `/order-change-requests` 审核 |
| 测试账号上传一张测试汇款凭据图片 | 图片进入付款凭据审核；管理员在 `/payment-proof-reviews` 核对金额后批准或拒绝 |

7. 附上简短录屏或按 Meta 当前界面要求提供可登录的测试路径。录屏必须展示“客户发讯息 → 系统记录 → 管理员审核”的完整闭环；不要展示 App Secret、Page Token、验证码、完整企业文件或真实客户付款资料。
8. 提交前由业务负责人确认：说明中没有承诺 AI 自动确认订单、自动更改订单或自动确认付款。
9. 由业务负责人在 Meta 页面提交。提交是对外申报动作，必须由负责人自行点击最终提交按钮。

### C. `pages_messaging` 获批后的受控真实演练

10. 确认 App 已按 Meta 当前页面指示切换为正式可用状态，且 XinTian Page 的 `messages`、`messaging_postbacks`、`message_deliveries`、`message_echoes`、`message_reads` 订阅仍然存在。
11. 使用 Enabelle Khoo 账户先发送一条普通问候，确认 Webhook 收到真实事件及正常自动回复；再依序完成本节 B 的三个测试案例。
12. 每次测试后由管理员检查：`chat_messages`、`draft_orders`、`order_change_requests`、付款凭据审核队列及订单审计记录。测试期只能使用标有测试用途的商品、凭据与订单。
13. 验收通过标准为：没有任何 AI 动作绕过人工审核直接确认私聊订单、直接修改订单或直接确认付款；无法识别或关联的讯息建立人工交接，而不是猜测。
14. 连续完成一次下单、一次资料变更和一次凭据上传后，更新真实演练记录；之后才向客户开放 Messenger 私聊收单。

## 三、直播公开留言／帖子评论捉单：应独立申请的最小权限

### 1. 关键结论

Meta 的 Page Webhook `feed` 字段覆盖 Page feed 的变化，其中包括贴文及互动；官方并没有提供一个单独名为“Live Comments”的 Webhook 字段。[2] 直播视频则是支持 `/comments` edge 的对象，因此直播留言通常通过 Page `feed` 事件和／或 Live Video 的 comments 对象处理，而不是因为“直播”就自动属于 `pages_messaging`。[3]

**因此，`pages_messaging` 不足以授权公开直播留言捉单。** 公共评论能力应在 Messenger 私聊审核完成、真实私聊演练稳定后，以独立用例申请和配置。

| 业务目标 | 最小权限／条件 | 说明 |
|---|---|---|
| 取得已管理 Page 清单及选择 XinTian Page | `pages_show_list` | 供应用识别授权给它的 Page，并取得对应的 Page access token。[4] |
| 将 App 订阅到 XinTian Page 的 `feed` Webhook | `pages_manage_metadata` + `pages_show_list` + Page task | 官方订阅 `feed` 的前置条件；Page 管理者需有 `CREATE_CONTENT`、`MANAGE` 或 `MODERATE` task。[5] |
| 只接收 Webhook 中的公开评论并按关键词处理 | 上述订阅权限；若 Meta 当前 Graph API／Dashboard 要求读取用户互动权限，再按实际提示申请 | Webhook 订阅成功不表示所有补拉／查询评论 API 都自动授权。当前官方页面对读取用户内容的显示名称存在版本差异，应以 App Dashboard 与实际 endpoint 提示为准。[4] [6] |
| 查询、补拉或读取完整用户评论内容 | 仅在真正需要时，按当前 Dashboard／endpoint 显示申请 `pages_read_user_content` 或 `pages_read_user_engagement` | 先用测试 Page 证明实际 endpoint 所需权限，避免凭旧文档过度申请。[4] [6] |
| 公开回复评论、隐藏／管理评论 | `pages_manage_engagement` + 具有 `MODERATE` task 的 Page access token | 如果不需要公开自动回复，就不要申请或启用这部分能力。[3] |

> **不应申请：** `Page Public Content Access`。它用于读取不由应用用户管理的其他公开 Page 内容，不是 XinTian 自己管理的 Page 直播捉单所需的最小权限。[7]

### 2. 现有系统实现核查

当前项目已经有 Page feed 的代码入口：Webhook 以 App Secret 的 `X-Hub-Signature-256` 校验为前提；当 `entry.changes` 出现 `feed`／`comments` 时，会提取评论、辨识直播／帖子／Reel 来源、按关键词比对直播间商品，并记录直播留言。对成功匹配的直播关键词，现有流程会建立或按既有规则合并订单，并尝试公开回复及／或私信发送结账链接。

这个现有流程意味着：**直播公开留言的精确“关键词＋数量”捉单属于既有的即时建单／合单逻辑，不是本次 Messenger 私聊的草稿订单流程。** 它只能在公开评论权限批准和真实测试通过后启用。若业务日后希望把直播公开留言也改成“只建待审核草稿”，需另行设计与测试，不能在未经确认下改变当前直播业务规则。

## 四、公开留言／直播捉单的申请与配置步骤

### A. 先准备独立审核材料

1. 不要在 `pages_messaging` 审核尚未完成时临时加入权限。先完成私聊演练并稳定运行。
2. 在 Meta Developers 创建第二份独立的公开互动用例说明，实际描述为：

> XinTian Garden uses Page feed webhooks to receive public comments posted to the XinTian Page and its live videos. During an active XinTian live sale, the app detects predefined product keywords and quantities in comments, matches them only against products configured for that live session, creates or merges an order according to the store’s existing order rules, and records an audit trail. When public reply is enabled, the app posts only a transactional acknowledgement. Comments that cannot be matched are not guessed and are directed to human support or Messenger. The app processes only content posted to the XinTian Page that the authorized Page administrator manages.

3. 先申请用于订阅 Page 的 `pages_show_list` 与 `pages_manage_metadata`。若实际测试显示评论读取 API 缺少权限，再根据 Dashboard 提示申请对应的读取用户内容／互动权限；不因“可能需要”而预先扩大范围。
4. **只有确实需要公开自动回复时**，才额外申请 `pages_manage_engagement`，并在审核录屏中演示一条测试评论的公开确认回复。若仅想接收留言并建立订单，不启用公开自动回复。
5. 为每个权限提供不同且真实的审核步骤、测试 Page、测试账号和最小数据说明。提交前检查任何说明都没有把顾客公开评论用于广告受众、跨 Page 追踪或未说明的用途。

### B. 权限获批后配置 Page

6. 确认授权人对 XinTian Page 具有 `CREATE_CONTENT`、`MANAGE` 或 `MODERATE` Page task；公开评论回复则必须有 `MODERATE` task。[5] [3]
7. 使用**授权后重新取得的 Page access token**，确认 Token 对应的 Page ID 是 `250376501495005`，没有把测试 Page 或其他 Page 的 token 混入生产设定。
8. 在 Meta Webhooks 的 Page 产品内订阅 `feed`。只有在需要直播状态自动结束时，才另行订阅／保留 `live_videos`；不要勾选与当前功能无关的字段。
9. 保持现有回调网址 `https://xintianfb-mkjyuzze.manus.space/api/facebook/webhook`，并重新执行验证握手。回调不应改为非 HTTPS 地址；App Secret 与 Verify Token 继续只保留在服务器环境变量。
10. 将 App 安装到 XinTian Page 的订阅集合，且只订阅必要字段。官方安装方式为 `POST /{page-id}/subscribed_apps?subscribed_fields=feed`；这一步须以获批权限与正确 Page access token 执行。[5]
11. 在系统后台建立一间**测试直播间**，仅放入测试商品与关键词，例如 `TESTSOYA+1`；不要用生产直播和真实商品进行首次测试。

### C. 直播公开留言真实验收

12. 使用 Enabelle Khoo 测试账户在测试直播或测试贴文评论 `TESTSOYA+1`。
13. 核对：Meta Webhook 仅收到一次事件；系统仅记录一次留言；同一 comment ID 重送时不能重复建单；商品只从当前直播间可售商品中匹配；库存／预售规则按当前业务逻辑正确执行。
14. 若启用公开回复，核对公开回复只为交易确认，不包含电话、地址、付款资料或订单私密链接。若要发送结账链接，应仅在获得适用 Messenger 授权与客户可接收私聊的前提下发送。
15. 依序测试：正常关键词、错误关键词、无库存、重复评论、同一客户跨渠道加单、XTC 与 XT 不可合并、以及直播结束事件。所有测试后检查订单审计、库存日志、直播留言记录和失败投递记录。
16. 所有测试正确后，才允许员工在真实直播将直播间状态切换为“直播中”。若 Page 订阅、token、Webhook 签名、订单审计或去重任一项异常，立即关闭公开自动回复并改为人工捉单，不应继续自动建单。

## 五、决策边界与日常复核

| 事项 | 建议决策 |
|---|---|
| 企业验证仍在审核中 | 等候结果；不重复提交、不更改已提交资料 |
| 企业验证通过 | 先只完成 `pages_messaging` 审核与私聊演练 |
| `pages_messaging` 获批 | 开启受控 Messenger 私聊，不自动放开公开直播留言 |
| 业务确需公开直播捉单 | 以本文件第四节申请最小公开互动权限、配置 `feed` 并独立验收 |
| 不需要公开评论回复 | 不申请／不开启 `pages_manage_engagement`，减少审批与风险范围 |
| Meta 权限界面与文档名称不一致 | 以当前 App Dashboard、Graph API 版本和实际 endpoint 错误提示为准，记录截图后再提交 |

## 参考资料

[1]: https://developers.facebook.com/docs/permissions/ "Meta Permissions Reference"
[2]: https://developers.facebook.com/docs/graph-api/webhooks/reference/page/ "Meta Page Webhooks Reference"
[3]: https://developers.facebook.com/docs/graph-api/reference/object/comments/ "Meta Object Comments Reference"
[4]: https://developers.facebook.com/documentation/pages-api "Meta Facebook Pages API Overview"
[5]: https://developers.facebook.com/documentation/pages-api/webhooks-for-pages "Meta Webhooks for Pages"
[6]: https://developers.facebook.com/documentation/pages-api/manage-pages "Meta Manage a Page"
[7]: https://developers.facebook.com/docs/features-reference/page-public-content-access/ "Meta Page Public Content Access"
