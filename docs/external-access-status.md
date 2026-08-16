# 外部启用核对记录

更新日期：2026-08-16（GMT+8）

## Meta Developers 访问状态

- 核对入口：<https://developers.facebook.com/apps/25463141136716354/app-review/permissions/>
- 当前结果：浏览器被重定向到 Meta for Developers 登录页，尚无拥有该应用及 Page 管理权限的已登录会话。
- 阻塞影响：暂时无法读取 App Review 权限清单、核对企业验证状态，或完成真实 Messenger 受控演练。
- 后续动作：由业务管理员登录后，只核对并保留 `pages_messaging`；不申请公开留言／直播评论等第二阶段权限。

## xintian.com.my 邮件路由公开核对

- 查询来源：<https://mxtoolbox.com/SuperTool.aspx?action=mx%3axintian.com.my>
- 查询结果：公开 DNS 存在一项 MX 记录，优先级为 `0`，主机名为 `xintian.com.my`，解析 IP 为 `142.250.191.78`（Google LLC）；该查询同时显示尚未发现 DMARC 记录。
- 结论边界：MX 记录只能证明域名存在邮件路由，并不能证明 `admin@xintian.com.my` 这个实体邮箱已建立、可登录或可收外部邮件。要完成企业邮箱核对，仍需域名／邮件服务供应商管理入口及获得授权后进行实际收信测试。
