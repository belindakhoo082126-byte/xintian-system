# 统一 AI 客服与语音处理：外部能力核验

> 本记录仅保存本轮规划所使用的外部平台能力事实；业务规则以用户上传的《AI客服规划》为准。

## Meta Messenger

Meta 的 Messenger `messages` Webhook 事件支持 `audio` 附件。音频附件的 `message.attachments[].payload.url` 提供可供系统获取与保存的媒体 URL。因此，现有 Messenger 入站 Webhook 可以在持久化聊天消息后，将音频文件存入受控文件存储，再交给转写服务；原始文件必须保留以支持人工复听与争议处理。

来源：[Meta — messages Webhook Event Reference](https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks/webhook-events/messages)。

## Meta WhatsApp Business Cloud API

WhatsApp Cloud API 可发送语音消息和普通音频消息；语音消息采用 OPUS 编码的 `.ogg` 文件。系统应将客户入站语音以原始媒体形式保存，并将转写显示为可修正的附属数据；是否以语音回复可作为后续阶段能力，不是第一阶段实现的前置条件。

来源：[Meta — WhatsApp Cloud API Audio Messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/audio-messages)。

## 定时自动跟进约束

未付款提醒、购物车跟进、会员到期提醒和回购提醒不得依赖应用内计时器。它们应通过平台托管的 HTTP Heartbeat 调度执行，并需具备幂等性、人工接管/已购买/已付款等停止条件、失败记录与安全鉴权。

来源：项目实施规范 `/home/ubuntu/skills/webdev-periodic-updates/SKILL.md`。
