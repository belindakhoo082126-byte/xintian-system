# Meta Messenger 最小权限核对记录

记录日期：2026-08-15  
范围：XinTian Garden 的 Facebook Page 私聊收单、订单变更与付款凭据待审核流程。

## 官方核对结论

Meta 的 Messenger Webhooks 文档指出，接收 Messenger 私聊事件的端到端前提包括：发布 Meta 应用、配置 Webhooks、订阅所需字段，以及将 Messenger 应用安装／订阅至商家 Page。文档明确以 `messages` 作为需要订阅的字段示例。对于无应用角色的普通客户，Messenger Platform 需要 Advanced Access；仅对具有应用角色的管理员、开发者或测试人员可使用 Standard Access。

`pages_messaging` 的官方定义是访问和管理 Facebook Page 在 Messenger 中的对话。当前目标是接收与受控回复 XinTian Page 的 Messenger 私聊，因此它是本次审核的核心、最小业务权限。

`pages_manage_metadata` 与 `pages_show_list` 在 Page webhook／Page 安装和管理场景中常作为依赖或配置权限出现；在未确认当前应用实际 Graph API 调用之前，不应在本次审核中扩大提交范围。应用已经存在有效 Page Token、Webhook 回调验证成功并且订阅字段已在控制台启用，因此先以 `pages_messaging` 为唯一提交目标；若 Meta 审核页强制标示依赖项，再按其强制依赖逐项补充说明。

## 当前审核清单风险

Meta 的「应用审核提交内容」页面显示约 25 项待提交权限，其中含广告管理、WhatsApp、Instagram、Live Video、目录管理、业务管理、页面贴文管理和个人资料字段。它们均超出 XinTian 当前 Messenger 私聊收单范围。Meta 的权限参考明确要求仅选择应用按预期功能运行所需的权限；选择未使用权限是审核被拒的常见原因。

## 当前建议

1. 暂不点击「继续」或最终提交。
2. 在审核清单中先移除所有非 Messenger 私聊所需的项目。
3. 先保留 `pages_messaging`；`pages_show_list`、`pages_manage_metadata` 仅在页面明确列为 Messenger 的必需依赖时保留。
4. 不申请 `business_management`、`catalog_management`、`ads_management`、`whatsapp_business_management`、Instagram、Live Video、营销广播及页面受众资料相关权限。
5. 最小清单确认后，为每一个保留项分别准备真实用途、测试帐号、复现步骤与审核录像。

## 来源

1. Meta, [Webhooks for Messenger Platform](https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks)。
2. Meta, [Messenger Platform Overview](https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview)。
3. Meta, [Messenger Platform App Review](https://developers.facebook.com/documentation/business-messaging/messenger-platform/app-review)。
4. Meta, [Permissions Reference](https://developers.facebook.com/docs/permissions/)。

## 2026-08-15 控制台与官方资料复核

已由用户提供的 Meta Developers 控制台画面确认：Page 对象的 Webhook 回调网址、验证口令、`messages`、`messaging_postbacks`、`message_deliveries`、`message_echoes` 与 `message_reads` 订阅均已保存；Messenger 使用案例的第 1「配置 Webhook」与第 2「生成访问令牌」均为绿色完成。因此，当前不能接收非应用角色真实私聊的阻断不是 Webhook 或 Page 订阅，而是第 3「完成应用审核」。

Meta 官方的 [App Review](https://developers.facebook.com/documentation/resp-plat-initiatives/individual-processes/app-review) 与 [Access Levels](https://developers.facebook.com/docs/graph-api/overview/access-levels/) 说明，未持有应用角色的客户要使用相关功能需要 Advanced Access，且审核人员必须能实际测试所申请的功能；无法访问或无法复现功能会导致拒绝。2026-03-23 更新的 [Messenger Platform Overview](https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview) 同时列出了 Messenger 对话常见的登录权限与其依赖关系，其中提到 `business_management` 是 `pages_messaging` 的依赖。

本项目的明确业务约束仍为：**当前审核清单只应提交 `pages_messaging`，不得主动新增 `business_management`、广告、WhatsApp、Instagram、直播或其他不使用的权限。** 若 Meta 审核界面在只选 `pages_messaging` 时强制加入某项依赖，必须先保留该界面的明确提示并暂停提交，向用户说明后再决定；不得由系统自行扩大权限范围。
